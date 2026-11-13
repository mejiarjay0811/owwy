import { DEFAULT_CATEGORIES, FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_INCOME_CATEGORY_ID } from "@/lib/defaults/categories";
import { createId } from "@/lib/utils/id";
import type { Category, CategoryKind, ID } from "@/types/models";
import { getDB } from "../db";
import { categorySchema, validate } from "../schemas";

export interface CategoryInput {
  name: string;
  emoji: string;
  color: string;
  kind: CategoryKind;
  discretionary?: boolean;
  keywords?: string[];
}

export async function ensureDefaultCategories(): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.categories, async () => {
    const existing = new Set((await db.categories.toArray()).map((c) => c.id));
    const missing = DEFAULT_CATEGORIES.filter((c) => !existing.has(c.id));
    if (missing.length) await db.categories.bulkAdd(missing);
  });
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const db = getDB();
  const order = (await db.categories.count()) + 1;
  const category = validate(categorySchema, {
    id: createId("cat"),
    name: input.name.trim(),
    emoji: input.emoji,
    color: input.color,
    kind: input.kind,
    discretionary: input.discretionary ?? input.kind === "expense",
    keywords: normalizeKeywords(input.keywords ?? []),
    isDefault: false,
    archived: false,
    order,
  });
  await db.categories.add(category);
  return category;
}

export async function updateCategory(id: ID, patch: Partial<CategoryInput> & { archived?: boolean }): Promise<Category> {
  const db = getDB();
  return db.transaction("rw", db.categories, async () => {
    const current = await db.categories.get(id);
    if (!current) throw new Error("This category no longer exists.");
    const next = validate(categorySchema, {
      ...current,
      ...patch,
      name: (patch.name ?? current.name).trim(),
      keywords: patch.keywords ? normalizeKeywords(patch.keywords) : current.keywords,
      kind: current.kind, // Kind is fixed so existing transactions stay consistent.
    });
    await db.categories.put(next);
    return next;
  });
}

/**
 * Removes a custom category. Its transactions, budgets and bills move to
 * "Other" so no money disappears from reports. Default categories can only be archived.
 */
export async function deleteCategory(id: ID): Promise<void> {
  const db = getDB();
  await db.transaction("rw", [db.categories, db.transactions, db.budgets, db.bills, db.recurring], async () => {
    const category = await db.categories.get(id);
    if (!category) return;
    if (category.isDefault) throw new Error("Built-in categories can be hidden, not deleted.");
    const fallback = category.kind === "income" ? FALLBACK_INCOME_CATEGORY_ID : FALLBACK_EXPENSE_CATEGORY_ID;
    await db.transactions.where("categoryId").equals(id).modify({ categoryId: fallback });
    await db.bills.filter((b) => b.categoryId === id).modify({ categoryId: fallback });
    await db.recurring.filter((r) => r.categoryId === id).modify({ categoryId: fallback });
    await db.budgets.where("categoryId").equals(id).delete();
    await db.categories.delete(id);
  });
}

function normalizeKeywords(keywords: string[]): string[] {
  return [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 200);
}
