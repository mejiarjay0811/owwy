import { today as localToday } from "@/lib/dates";
import { tripProgress } from "@/lib/finance/shopping";
import { createId } from "@/lib/utils/id";
import type { ID, ISODate, Minor, ShoppingItem, ShoppingTrip } from "@/types/models";
import { getDB } from "../db";
import { tripSchema, validate } from "../schemas";
import { buildTransaction } from "./transactions";

export interface TripInput {
  name: string;
  budget: Minor;
  categoryId: ID;
  accountId?: ID;
}

export async function startTrip(input: TripInput): Promise<ShoppingTrip> {
  const db = getDB();
  const now = Date.now();
  const trip = validate(tripSchema, {
    id: createId("trip"),
    name: input.name.trim() || "Shopping trip",
    budget: Math.max(0, input.budget),
    categoryId: input.categoryId,
    accountId: input.accountId,
    items: [],
    status: "active",
    startedAt: now,
    updatedAt: now,
  }) as ShoppingTrip;
  await db.trips.add(trip);
  return trip;
}

/** The trip you're on right now, if any. */
export async function activeTrip(): Promise<ShoppingTrip | undefined> {
  return getDB().trips.where("status").equals("active").first();
}

async function edit(id: ID, change: (trip: ShoppingTrip) => ShoppingTrip): Promise<ShoppingTrip> {
  const db = getDB();
  return db.transaction("rw", db.trips, async () => {
    const current = await db.trips.get(id);
    if (!current) throw new Error("This trip is no longer here.");
    const next = validate(tripSchema, { ...change(current), updatedAt: Date.now() }) as ShoppingTrip;
    await db.trips.put(next);
    return next;
  });
}

export function updateTrip(id: ID, patch: Partial<TripInput>): Promise<ShoppingTrip> {
  return edit(id, (trip) => ({ ...trip, ...patch, budget: patch.budget === undefined ? trip.budget : Math.max(0, patch.budget) }));
}

export interface ItemInput {
  label: string;
  price: Minor;
  quantity?: number;
  inCart?: boolean;
  scanned?: boolean;
}

export function addItem(tripId: ID, input: ItemInput): Promise<ShoppingTrip> {
  const item: ShoppingItem = {
    id: createId("item"),
    label: input.label.trim(),
    price: Math.max(0, input.price),
    quantity: Math.max(1, Math.round(input.quantity ?? 1)),
    inCart: input.inCart ?? true,
    scanned: input.scanned,
    createdAt: Date.now(),
  };
  return edit(tripId, (trip) => ({ ...trip, items: [...trip.items, item] }));
}

export function updateItem(tripId: ID, itemId: ID, patch: Partial<Omit<ShoppingItem, "id" | "createdAt">>): Promise<ShoppingTrip> {
  return edit(tripId, (trip) => ({
    ...trip,
    items: trip.items.map((item) => (item.id === itemId ? { ...item, ...patch, quantity: Math.max(1, Math.round(patch.quantity ?? item.quantity)) } : item)),
  }));
}

export function removeItem(tripId: ID, itemId: ID): Promise<ShoppingTrip> {
  return edit(tripId, (trip) => ({ ...trip, items: trip.items.filter((item) => item.id !== itemId) }));
}

export interface FinishTripInput {
  tripId: ID;
  accountId: ID;
  date?: ISODate;
  /** Override the trolley total, e.g. when the till total differs. */
  amount?: Minor;
}

export interface FinishedTrip {
  trip: ShoppingTrip;
  transactionId: ID;
  amount: Minor;
}

/**
 * Ends a trip and logs it as one expense — the way it appears on your
 * statement — while the trip keeps the itemised detail.
 */
export async function finishTrip(input: FinishTripInput): Promise<FinishedTrip> {
  const db = getDB();
  return db.transaction("rw", db.trips, db.transactions, db.accounts, db.categories, async () => {
    const trip = await db.trips.get(input.tripId);
    if (!trip) throw new Error("This trip is no longer here.");
    if (trip.status !== "active") throw new Error("This trip is already finished.");
    if (!(await db.accounts.get(input.accountId))) throw new Error("Choose the account you paid from.");

    const amount = input.amount ?? tripProgress(trip).total;
    if (amount <= 0) throw new Error("Add something to the trolley first.");

    const inCart = trip.items.filter((item) => item.inCart);
    const transaction = buildTransaction({
      type: "expense",
      amount,
      accountId: input.accountId,
      categoryId: trip.categoryId,
      date: input.date ?? localToday(),
      note: trip.name,
      tags: ["shopping-trip"],
    });
    await db.transactions.add(transaction);

    const done = validate(tripSchema, {
      ...trip,
      // Anything left on the list wasn't bought.
      items: inCart,
      accountId: input.accountId,
      status: "done",
      closedAt: Date.now(),
      transactionId: transaction.id,
      updatedAt: Date.now(),
    }) as ShoppingTrip;
    await db.trips.put(done);

    return { trip: done, transactionId: transaction.id, amount };
  });
}

/** Puts a finished trip back on the shelf, removing the expense it created. */
export async function undoFinishTrip(result: FinishedTrip): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.trips, db.transactions, async () => {
    await db.transactions.delete(result.transactionId);
    const trip = await db.trips.get(result.trip.id);
    if (trip) await db.trips.put({ ...trip, status: "active", closedAt: undefined, transactionId: undefined, updatedAt: Date.now() });
  });
}

export function abandonTrip(id: ID): Promise<ShoppingTrip> {
  return edit(id, (trip) => ({ ...trip, status: "abandoned", closedAt: Date.now() }));
}

export async function deleteTrip(id: ID): Promise<void> {
  await getDB().trips.delete(id);
}
