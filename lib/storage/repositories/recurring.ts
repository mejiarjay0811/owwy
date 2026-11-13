import { parseISODate } from "@/lib/dates";
import { planRecurringCatchUp } from "@/lib/finance/recurring";
import { createId } from "@/lib/utils/id";
import type { AutomationMode, Frequency, ID, ISODate, Minor, RecurringTransaction, Transaction, TransactionType } from "@/types/models";
import { firstMonthDayOnOrAfter, nextOccurrence } from "@/lib/dates";
import { getDB } from "../db";
import { recurringSchema, validate } from "../schemas";
import { buildTransaction } from "./transactions";

export interface RecurringInput {
  name: string;
  type: TransactionType;
  amount: Minor;
  accountId: ID;
  toAccountId?: ID;
  categoryId?: ID;
  note?: string;
  frequency: Exclude<Frequency, "once">;
  /** Required when `frequency` is "monthDays": which days of the month to fire on. */
  monthDays?: number[];
  startDate: ISODate;
  endDate?: ISODate;
  mode?: AutomationMode;
}

/**
 * A `monthDays` rule must sit on one of its chosen days, or it would fire on
 * whatever date the form happened to be opened with. Snap forward to the
 * first chosen day on or after the requested date.
 */
function alignToSchedule(date: ISODate, frequency: Exclude<Frequency, "once">, monthDays?: number[]): ISODate {
  if (frequency !== "monthDays") return date;
  return firstMonthDayOnOrAfter(date, monthDays ?? []) ?? date;
}

export async function createRecurring(input: RecurringInput): Promise<RecurringTransaction> {
  const now = Date.now();
  const nextDate = alignToSchedule(input.startDate, input.frequency, input.monthDays);
  const rule = validate(recurringSchema, {
    id: createId("rec"),
    ...input,
    name: input.name.trim(),
    note: input.note?.trim() ?? "",
    toAccountId: input.type === "transfer" ? input.toAccountId : undefined,
    categoryId: input.type === "transfer" ? undefined : input.categoryId,
    monthDays: input.frequency === "monthDays" ? input.monthDays : undefined,
    nextDate,
    anchorDay: parseISODate(nextDate).d,
    endDate: input.endDate || undefined,
    mode: input.mode ?? "auto",
    active: true,
    createdAt: now,
    updatedAt: now,
  }) as RecurringTransaction;
  await getDB().recurring.add(rule);
  return rule;
}

export async function updateRecurring(id: ID, patch: Partial<RecurringInput> & { active?: boolean; nextDate?: ISODate }): Promise<RecurringTransaction> {
  const db = getDB();
  return db.transaction("rw", db.recurring, async () => {
    const current = await db.recurring.get(id);
    if (!current) throw new Error("This recurring item no longer exists.");
    const type = patch.type ?? current.type;
    const frequency = patch.frequency ?? current.frequency;
    const monthDays = frequency === "monthDays" ? (patch.monthDays ?? current.monthDays) : undefined;
    // Changing the chosen days has to move the rule onto one of them, or it
    // would keep firing on the date it had before.
    const nextDate = alignToSchedule(patch.nextDate ?? current.nextDate, frequency, monthDays);
    const next = validate(recurringSchema, {
      ...current,
      ...patch,
      name: (patch.name ?? current.name).trim(),
      toAccountId: type === "transfer" ? (patch.toAccountId ?? current.toAccountId) : undefined,
      categoryId: type === "transfer" ? undefined : (patch.categoryId ?? current.categoryId),
      endDate: patch.endDate === undefined ? current.endDate : patch.endDate || undefined,
      frequency,
      monthDays,
      nextDate,
      anchorDay: parseISODate(nextDate).d,
      updatedAt: Date.now(),
    }) as RecurringTransaction;
    await db.recurring.put(next);
    return next;
  });
}

export async function deleteRecurring(id: ID): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.recurring, db.transactions, async () => {
    await db.transactions.where("recurringId").equals(id).modify({ recurringId: undefined });
    await db.recurring.delete(id);
  });
}

/** Logs the waiting occurrence of an "ask first" automation and moves it to its next date. */
export async function confirmAutomation(id: ID, overrides: { amount?: Minor; date?: ISODate } = {}): Promise<{ transaction: Transaction; previous: RecurringTransaction }> {
  const db = getDB();
  return db.transaction("rw", db.recurring, db.transactions, db.accounts, async () => {
    const rule = await db.recurring.get(id);
    if (!rule) throw new Error("This automation no longer exists.");
    const occurrence = rule.nextDate;
    const transaction = buildTransaction({
      type: rule.type,
      amount: overrides.amount ?? rule.amount,
      accountId: rule.accountId,
      toAccountId: rule.toAccountId,
      categoryId: rule.categoryId,
      date: overrides.date ?? occurrence,
      note: rule.note || rule.name,
      recurringId: rule.id,
    });
    if (!(await db.accounts.get(rule.accountId))) throw new Error("This automation's account was deleted. Edit it first.");
    await db.transactions.add(transaction);
    await advance(rule);
    return { transaction, previous: rule };
  });
}

export async function skipAutomation(id: ID): Promise<RecurringTransaction> {
  const db = getDB();
  return db.transaction("rw", db.recurring, async () => {
    const rule = await db.recurring.get(id);
    if (!rule) throw new Error("This automation no longer exists.");
    await advance(rule);
    return rule;
  });
}

export async function restoreRecurring(rule: RecurringTransaction): Promise<void> {
  await getDB().recurring.put(rule);
}

async function advance(rule: RecurringTransaction): Promise<void> {
  const next = nextOccurrence(rule.nextDate, rule.frequency, rule.anchorDay, rule.monthDays) ?? rule.nextDate;
  await getDB().recurring.update(rule.id, { nextDate: next, active: !rule.endDate || next <= rule.endDate, updatedAt: Date.now() });
}

/**
 * Posts every recurring occurrence due up to `today`. Safe to call on every
 * launch: occurrences already posted (same rule + date) are never duplicated.
 */
export async function runRecurringRules(today: ISODate): Promise<number> {
  const db = getDB();
  return db.transaction("rw", db.recurring, db.transactions, db.accounts, async () => {
    const rules = await db.recurring.toArray();
    const accountIds = new Set((await db.accounts.toArray()).map((a) => a.id));
    let posted = 0;

    for (const rule of rules) {
      // "Ask first" automations wait for the user on the home screen.
      if (rule.mode === "confirm") continue;
      const plan = planRecurringCatchUp(rule, today);
      if (!plan.dates.length && plan.active === rule.active) continue;

      const accountsOk = accountIds.has(rule.accountId) && (rule.type !== "transfer" || (rule.toAccountId && accountIds.has(rule.toAccountId)));
      if (accountsOk) {
        for (const date of plan.dates) {
          const exists = await db.transactions.where("[recurringId+date]").equals([rule.id, date]).count();
          if (exists) continue;
          await db.transactions.add(
            buildTransaction({
              type: rule.type,
              amount: rule.amount,
              accountId: rule.accountId,
              toAccountId: rule.toAccountId,
              categoryId: rule.categoryId,
              date,
              note: rule.note || rule.name,
              recurringId: rule.id,
            }),
          );
          posted++;
        }
      }
      await db.recurring.update(rule.id, { nextDate: plan.nextDate, active: accountsOk ? plan.active : false, updatedAt: Date.now() });
    }
    return posted;
  });
}
