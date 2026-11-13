import { computeGoalProgress } from "@/lib/finance/goals";
import { createId } from "@/lib/utils/id";
import type { ID, ISODate, Minor, SavingsGoal, Transaction } from "@/types/models";
import { getDB } from "../db";
import { goalSchema, validate } from "../schemas";
import { buildTransaction } from "./transactions";

export interface GoalInput {
  name: string;
  emoji: string;
  targetAmount: Minor;
  startingAmount?: Minor;
  targetDate?: ISODate;
  accountId: ID;
  color: string;
}

export async function createGoal(input: GoalInput): Promise<SavingsGoal> {
  const db = getDB();
  if (!(await db.accounts.get(input.accountId))) throw new Error("Choose where this goal's money is kept.");
  const now = Date.now();
  const goal = validate(goalSchema, {
    id: createId("goal"),
    ...input,
    name: input.name.trim(),
    startingAmount: input.startingAmount ?? 0,
    targetDate: input.targetDate || undefined,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.goals.add(goal);
  return goal;
}

export async function updateGoal(id: ID, patch: Partial<GoalInput> & { archived?: boolean }): Promise<SavingsGoal> {
  const db = getDB();
  return db.transaction("rw", db.goals, async () => {
    const current = await db.goals.get(id);
    if (!current) throw new Error("This goal no longer exists.");
    const next = validate(goalSchema, {
      ...current,
      ...patch,
      name: (patch.name ?? current.name).trim(),
      targetDate: patch.targetDate === undefined ? current.targetDate : patch.targetDate || undefined,
      updatedAt: Date.now(),
    });
    await db.goals.put(next);
    return next;
  });
}

/** Removes the goal. Money already moved stays in its account; history stays as transfers. */
export async function deleteGoal(id: ID): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.goals, db.transactions, async () => {
    await db.transactions.where("goalId").equals(id).modify({ goalId: undefined });
    await db.goals.delete(id);
  });
}

export interface GoalMoveInput {
  goalId: ID;
  /** The other account: source for contributions, destination for withdrawals. */
  accountId: ID;
  amount: Minor;
  date: ISODate;
  note?: string;
}

/**
 * Moves money into a goal: a transfer from `accountId` to the goal's account.
 * Balances, goal progress, monthly savings and Safe-to-Spend all update from it.
 */
export async function contributeToGoal(input: GoalMoveInput): Promise<{ transaction: Transaction; completed: boolean }> {
  return moveGoalMoney(input, "in");
}

export async function withdrawFromGoal(input: GoalMoveInput): Promise<{ transaction: Transaction; completed: boolean }> {
  return moveGoalMoney(input, "out");
}

async function moveGoalMoney(input: GoalMoveInput, direction: "in" | "out") {
  const db = getDB();
  return db.transaction("rw", db.goals, db.transactions, db.accounts, async () => {
    const goal = await db.goals.get(input.goalId);
    if (!goal) throw new Error("This goal no longer exists.");
    if (input.accountId === goal.accountId) {
      throw new Error("Pick a different account — this goal's money already lives there.");
    }
    if (!(await db.accounts.get(input.accountId))) throw new Error("Choose an account.");

    const transaction = buildTransaction({
      type: "transfer",
      amount: input.amount,
      accountId: direction === "in" ? input.accountId : goal.accountId,
      toAccountId: direction === "in" ? goal.accountId : input.accountId,
      date: input.date,
      note: input.note || (direction === "in" ? `Saved for ${goal.name}` : `Withdrew from ${goal.name}`),
      goalId: goal.id,
    });
    await db.transactions.add(transaction);

    const history = await db.transactions.where("goalId").equals(goal.id).toArray();
    const progress = computeGoalProgress(goal, history, input.date);
    const completed = progress.remaining === 0;
    if (completed && !goal.completedAt) await db.goals.update(goal.id, { completedAt: Date.now() });
    if (!completed && goal.completedAt) await db.goals.update(goal.id, { completedAt: undefined });
    return { transaction, completed: completed && !goal.completedAt };
  });
}
