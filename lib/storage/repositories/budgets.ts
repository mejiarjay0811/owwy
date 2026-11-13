import { addMonthKey } from "@/lib/dates";
import { planBudgetCopy } from "@/lib/finance/budgets";
import { createId } from "@/lib/utils/id";
import type { Budget, ID, Minor, MonthKey } from "@/types/models";
import { getDB } from "../db";
import { budgetSchema, validate } from "../schemas";

/**
 * Creates or updates the budget for a category in a month.
 *
 * `label` is what this budget is for when the category is a catch-all.
 * Passing `undefined` keeps whatever label is already there; passing an
 * empty string clears it.
 */
export async function setBudget(categoryId: ID, month: MonthKey, amount: Minor, label?: string): Promise<Budget> {
  const db = getDB();
  return db.transaction("rw", db.budgets, db.categories, async () => {
    const category = await db.categories.get(categoryId);
    if (!category || category.kind !== "expense") throw new Error("Budgets can only be set for spending categories.");
    const existing = await db.budgets.where("[month+categoryId]").equals([month, categoryId]).first();
    const nextLabel = label === undefined ? existing?.label : label.trim() || undefined;
    const budget = validate(budgetSchema, {
      id: existing?.id ?? createId("bud"),
      categoryId,
      month,
      amount,
      paused: existing?.paused ?? false,
      label: nextLabel,
      createdAt: existing?.createdAt ?? Date.now(),
    });
    await db.budgets.put(budget);
    return budget;
  });
}

export async function setBudgetPaused(id: ID, paused: boolean): Promise<void> {
  await getDB().budgets.update(id, { paused });
}

export async function deleteBudget(id: ID): Promise<Budget | undefined> {
  const db = getDB();
  const budget = await db.budgets.get(id);
  if (budget) await db.budgets.delete(id);
  return budget;
}

export async function restoreBudget(budget: Budget): Promise<void> {
  await getDB().budgets.put(budget);
}

/** Copies last month's budgets into `month`. Returns how many were created. */
export async function copyBudgetsFromPreviousMonth(month: MonthKey): Promise<number> {
  const db = getDB();
  return db.transaction("rw", db.budgets, async () => {
    const all = await db.budgets.toArray();
    const toCopy = planBudgetCopy(all, addMonthKey(month, -1), month);
    const now = Date.now();
    await db.budgets.bulkAdd(
      toCopy.map((b) => ({ id: createId("bud"), categoryId: b.categoryId, month, amount: b.amount, paused: b.paused, label: b.label, createdAt: now })),
    );
    return toCopy.length;
  });
}
