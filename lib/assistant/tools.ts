import { z } from "zod";
import { isValidISODate, monthStart } from "@/lib/dates";
import { filterTransactions, type SearchFilters } from "@/lib/finance/search";
import { normalize } from "@/lib/finance/text";
import { formatMoney, toMajor, toMinor } from "@/lib/money";
import { createId } from "@/lib/utils/id";
import type { ChatBlock, ID, StagedTransaction, Transaction } from "@/types/models";
import type { AssistantContext } from "./local-engine";

/**
 * Tools the optional AI can call. They run on this device against local data
 * and return only what's needed to answer — never the whole database.
 * Each call also produces a chat block so the user can see exactly what ran.
 */

export const TOOL_DEFINITIONS = [
  {
    name: "query_transactions",
    description:
      "Search and total the user's recorded transactions. Use for any question about spending, income, categories, merchants, or periods. Amounts in results are in major currency units. Prefer group_by to keep results small.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["expense", "income", "transfer"], description: "Transaction type. Omit for all types." },
        categories: { type: "array", items: { type: "string" }, description: "Category names, e.g. [\"Food\"]." },
        accounts: { type: "array", items: { type: "string" }, description: "Account names, e.g. [\"Cash\"]." },
        from: { type: "string", description: "Start date YYYY-MM-DD (inclusive)." },
        to: { type: "string", description: "End date YYYY-MM-DD (inclusive)." },
        text: { type: "string", description: "Words that must appear in the note, e.g. \"coffee\"." },
        min_amount: { type: "number" },
        max_amount: { type: "number" },
        group_by: { type: "string", enum: ["none", "category", "account", "day", "month", "note"], description: "Aggregate results. Default none (individual transactions)." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Max rows returned. Default 20." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_overview",
    description:
      "Get the user's current financial picture: account balances, Safe to Spend (with its breakdown), this month's income/spending/savings, budgets, savings goals, upcoming bills and debts.",
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
  },
  {
    name: "stage_transactions",
    description:
      "Prepare one or more transactions the user described (e.g. \"lunch 250 and grab 120 from gcash\") for them to review. Nothing is saved until the user taps Save in the app. Use exact category and account names from the context when possible.",
    input_schema: {
      type: "object" as const,
      properties: {
        transactions: {
          type: "array",
          minItems: 1,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["expense", "income", "transfer"] },
              amount: { type: "number", description: "Positive amount in major units." },
              category: { type: "string" },
              account: { type: "string", description: "Account the money left (or arrived in, for income)." },
              to_account: { type: "string", description: "Destination account for transfers." },
              date: { type: "string", description: "YYYY-MM-DD. Default today." },
              note: { type: "string", description: "Short description, e.g. \"Lunch\"." },
            },
            required: ["type", "amount"],
            additionalProperties: false,
          },
        },
      },
      required: ["transactions"],
      additionalProperties: false,
    },
  },
];

const queryInput = z.object({
  type: z.enum(["expense", "income", "transfer"]).optional(),
  categories: z.array(z.string()).optional(),
  accounts: z.array(z.string()).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  text: z.string().optional(),
  min_amount: z.number().optional(),
  max_amount: z.number().optional(),
  group_by: z.enum(["none", "category", "account", "day", "month", "note"]).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const stageInput = z.object({
  transactions: z
    .array(
      z.object({
        type: z.enum(["expense", "income", "transfer"]),
        amount: z.number().positive(),
        category: z.string().optional(),
        account: z.string().optional(),
        to_account: z.string().optional(),
        date: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

export interface ToolRun {
  /** JSON string returned to the model. */
  result: string;
  isError: boolean;
  block?: ChatBlock;
}

export interface ToolOptions {
  shareNotes: boolean;
}

export function runTool(name: string, input: unknown, ctx: AssistantContext, options: ToolOptions): ToolRun {
  try {
    switch (name) {
      case "query_transactions":
        return queryTransactions(queryInput.parse(input), ctx, options);
      case "get_overview":
        return overview(ctx);
      case "stage_transactions":
        return stage(stageInput.parse(input), ctx);
      default:
        return { result: JSON.stringify({ error: `Unknown tool ${name}` }), isError: true };
    }
  } catch (error) {
    const message = error instanceof z.ZodError ? `Invalid input: ${error.issues[0]?.path.join(".")} ${error.issues[0]?.message}` : "Tool failed";
    return { result: JSON.stringify({ error: message }), isError: true };
  }
}

function findByName<T extends { id: ID; name: string }>(items: readonly T[], name: string | undefined): T | undefined {
  if (!name) return undefined;
  const n = normalize(name);
  return items.find((i) => normalize(i.name) === n) ?? items.find((i) => normalize(i.name).includes(n) || n.includes(normalize(i.name)));
}

function queryTransactions(input: z.infer<typeof queryInput>, ctx: AssistantContext, options: ToolOptions): ToolRun {
  const { state, currency } = ctx;
  const categoryIds = (input.categories ?? []).map((c) => findByName(state.categories, c)?.id).filter((id): id is ID => Boolean(id));
  const accountIds = (input.accounts ?? []).map((a) => findByName(state.accounts, a)?.id).filter((id): id is ID => Boolean(id));
  const from = input.from && isValidISODate(input.from) ? input.from : undefined;
  const to = input.to && isValidISODate(input.to) ? input.to : undefined;

  const filters: SearchFilters = {
    terms: input.text ? normalize(input.text).split(" ").filter(Boolean) : [],
    categoryIds,
    accountIds,
    types: input.type ? [input.type] : [],
    tags: [],
    minAmount: input.min_amount !== undefined ? toMinor(input.min_amount, currency) : undefined,
    maxAmount: input.max_amount !== undefined ? toMinor(input.max_amount, currency) : undefined,
    from,
    to,
    chips: [],
  };
  const results = filterTransactions(state.baseTransactions, filters, { categoriesById: state.categoriesById, accountsById: state.accountsById });
  const limit = input.limit ?? 20;
  const groupBy = input.group_by ?? "none";
  const major = (m: number) => toMajor(m, currency);
  const total = results.reduce((t, r) => t + r.amount, 0);

  let columns: string[];
  let rows: (string | number)[][];
  let payloadRows: Record<string, unknown>[];

  if (groupBy === "none") {
    const list = results.slice(0, limit);
    columns = ["date", "details", "category", "account", "amount"];
    rows = list.map((t) => [t.date, options.shareNotes ? t.note || "—" : "—", state.categoriesById.get(t.categoryId ?? "")?.name ?? t.type, state.accountsById.get(t.accountId)?.name ?? "—", formatMoney(t.amount, currency, { noSymbol: true })]);
    payloadRows = list.map((t) => ({
      date: t.date,
      type: t.type,
      amount: major(t.amount),
      category: state.categoriesById.get(t.categoryId ?? "")?.name,
      account: state.accountsById.get(t.accountId)?.name,
      to_account: t.toAccountId ? state.accountsById.get(t.toAccountId)?.name : undefined,
      note: options.shareNotes ? t.note || undefined : undefined,
    }));
  } else {
    const keyOf = (t: Transaction): string => {
      if (groupBy === "category") return state.categoriesById.get(t.categoryId ?? "")?.name ?? (t.type === "transfer" ? "Transfer" : "Other");
      if (groupBy === "account") return state.accountsById.get(t.accountId)?.name ?? "Deleted account";
      if (groupBy === "day") return t.date;
      if (groupBy === "month") return t.date.slice(0, 7);
      return options.shareNotes ? normalize(t.note) || "(no note)" : "(notes hidden)";
    };
    const groups = new Map<string, { total: number; count: number }>();
    for (const t of results) {
      const key = keyOf(t);
      const g = groups.get(key) ?? { total: 0, count: 0 };
      g.total += t.amount;
      g.count++;
      groups.set(key, g);
    }
    const sorted = [...groups.entries()].sort((a, b) => (groupBy === "day" || groupBy === "month" ? a[0].localeCompare(b[0]) : b[1].total - a[1].total)).slice(0, limit);
    columns = [groupBy, "total", "n"];
    rows = sorted.map(([key, g]) => [key, formatMoney(g.total, currency, { noSymbol: true }), g.count]);
    payloadRows = sorted.map(([key, g]) => ({ [groupBy]: key, total: major(g.total), count: g.count }));
  }

  const where = [
    input.type ? `type = '${input.type}'` : null,
    categoryIds.length ? `category IN (${categoryIds.map((id) => `'${state.categoriesById.get(id)?.name}'`).join(", ")})` : null,
    accountIds.length ? `account IN (${accountIds.map((id) => `'${state.accountsById.get(id)?.name}'`).join(", ")})` : null,
    from || to ? `date BETWEEN '${from ?? "…"}' AND '${to ?? "…"}'` : null,
    input.text ? `note LIKE '%${input.text}%'` : null,
    input.min_amount !== undefined ? `amount >= ${input.min_amount}` : null,
    input.max_amount !== undefined ? `amount <= ${input.max_amount}` : null,
  ].filter(Boolean);
  const queryText = [`FROM transactions`, where.length ? `WHERE ${where.join("\n  AND ")}` : null, groupBy !== "none" ? `GROUP BY ${groupBy}` : `ORDER BY date DESC`, `LIMIT ${limit}`].filter(Boolean).join("\n");

  const unknown = [...(input.categories ?? []).filter((c) => !findByName(state.categories, c)), ...(input.accounts ?? []).filter((a) => !findByName(state.accounts, a))];

  return {
    isError: false,
    result: JSON.stringify({
      currency,
      matched_transactions: results.length,
      total: major(total),
      rows: payloadRows,
      ...(unknown.length ? { unknown_names: unknown, hint: "These names didn't match; use names from the context." } : {}),
    }),
    block: { type: "query", title: "Ran a query", query: queryText, columns, rows, rowCount: groupBy === "none" ? results.length : rows.length },
  };
}

function overview(ctx: AssistantContext): ToolRun {
  const { state, currency, today } = ctx;
  const major = (m: number) => toMajor(m, currency);
  const sts = state.safeToSpend;
  const payload = {
    today,
    currency,
    accounts: state.activeAccounts.map((a) => ({ name: a.name, type: a.type, balance: major(state.balances.get(a.id) ?? 0), counts_as_spending_money: a.includeInSafeToSpend })),
    totals: { total_balance: major(state.totals.totalBalance), owed_on_credit: major(state.totals.owed), net_worth: major(state.netWorth.netWorth) },
    safe_to_spend: {
      amount: major(sts.amount),
      per_day: major(sts.perDay),
      until: sts.periodEnd,
      next_income: sts.nextIncomeDate,
      breakdown: sts.lines.map((l) => ({ line: l.label, amount: major(l.amount) })),
    },
    this_month: { month: state.month, income: major(state.thisMonth.income), spent: major(state.thisMonth.spent), saved: major(state.thisMonth.saved) },
    budgets: state.budgetProgress.map((b) => ({ category: b.category?.name, spent: major(b.spent), budget: major(b.budget.amount), percent_used: Math.round(b.percent), paused: b.budget.paused })),
    goals: state.goalProgress.map((g) => ({ goal: g.goal.name, saved: major(g.saved), target: major(g.goal.targetAmount), target_date: g.goal.targetDate, monthly_needed: major(g.requiredMonthly) })),
    upcoming_bills: state.upcomingBills.slice(0, 10).map((o) => ({ bill: o.bill.name, due: o.date, amount: major(o.amount) })),
    debts: state.debtProgress.map((d) => ({ debt: d.debt.name, remaining: major(d.remaining), minimum_payment: major(d.debt.minimumPayment), next_due: d.debt.nextDueDate })),
    month_start: monthStart(state.month),
  };
  return {
    isError: false,
    result: JSON.stringify(payload),
    block: {
      type: "query",
      title: "Read your overview",
      query: "balances · safe to spend · this month · budgets · goals · bills · debts",
      columns: ["item", "value"],
      rows: [
        ["Total balance", formatMoney(state.totals.totalBalance, currency, { noSymbol: true })],
        ["Safe to spend", formatMoney(sts.amount, currency, { noSymbol: true })],
        ["Spent this month", formatMoney(state.thisMonth.spent, currency, { noSymbol: true })],
        ["Budgets", state.budgetProgress.length],
        ["Goals", state.goalProgress.length],
        ["Upcoming bills", state.upcomingBills.length],
      ],
      rowCount: 6,
    },
  };
}

function stage(input: z.infer<typeof stageInput>, ctx: AssistantContext): ToolRun {
  const { state, currency, today } = ctx;
  const fallbackAccount = state.activeAccounts.find((a) => a.includeInSafeToSpend)?.id ?? state.activeAccounts[0]?.id;
  const drafts: StagedTransaction[] = input.transactions.map((t) => {
    const category = findByName(
      state.categories.filter((c) => c.kind === (t.type === "income" ? "income" : "expense")),
      t.category,
    );
    return {
      key: createId("draft"),
      type: t.type,
      amount: toMinor(t.amount, currency),
      accountId: findByName(state.activeAccounts, t.account)?.id ?? fallbackAccount,
      toAccountId: t.type === "transfer" ? findByName(state.activeAccounts, t.to_account)?.id : undefined,
      categoryId: t.type === "transfer" ? undefined : category?.id,
      date: t.date && isValidISODate(t.date) ? t.date : today,
      note: (t.note ?? "").slice(0, 140),
      tags: [],
    };
  });
  const incomplete = drafts.filter((d) => (d.type !== "transfer" && !d.categoryId) || (d.type === "transfer" && !d.toAccountId)).length;
  return {
    isError: false,
    result: JSON.stringify({
      staged: drafts.length,
      needs_review: incomplete,
      note: "Shown to the user as cards. Nothing is saved until they tap Save. Don't claim it was saved.",
    }),
    block: { type: "staged", drafts, status: "pending" },
  };
}
