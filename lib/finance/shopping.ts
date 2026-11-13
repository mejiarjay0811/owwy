import { normalize } from "@/lib/finance/text";
import type { Minor, ShoppingItem, ShoppingTrip } from "@/types/models";

export interface TripProgress {
  /** Everything in the trolley. */
  total: Minor;
  /** Items on the list but not picked up yet. */
  pending: Minor;
  /** total + pending — where you'd land if you take everything. */
  projected: Minor;
  budget: Minor;
  /** Budget minus what's in the trolley; negative once you're over. */
  left: Minor;
  /** 0–100+, for the bar. */
  percent: number;
  over: boolean;
  /** The trolley is fine but taking the rest of the list would go over. */
  willGoOver: boolean;
  itemCount: number;
  cartCount: number;
}

export function itemTotal(item: Pick<ShoppingItem, "price" | "quantity">): Minor {
  return item.price * Math.max(1, item.quantity);
}

/** Where a trip stands right now. */
export function tripProgress(trip: Pick<ShoppingTrip, "items" | "budget">): TripProgress {
  let total = 0;
  let pending = 0;
  let cartCount = 0;
  for (const item of trip.items) {
    const amount = itemTotal(item);
    if (item.inCart) {
      total += amount;
      cartCount++;
    } else {
      pending += amount;
    }
  }
  const budget = trip.budget;
  return {
    total,
    pending,
    projected: total + pending,
    budget,
    left: budget - total,
    percent: budget > 0 ? (total / budget) * 100 : 0,
    over: budget > 0 && total > budget,
    willGoOver: budget > 0 && total <= budget && total + pending > budget,
    itemCount: trip.items.length,
    cartCount,
  };
}

/** A short, honest line about how the trip is going. */
export function tripStatusLine(progress: TripProgress, format: (minor: Minor) => string): string {
  if (progress.budget === 0) return progress.cartCount ? `${format(progress.total)} in the trolley.` : "No budget set — just keeping the total.";
  if (progress.over) return `${format(-progress.left)} over budget.`;
  if (progress.willGoOver) return `The rest of your list would put you ${format(progress.projected - progress.budget)} over.`;
  if (progress.percent >= 85) return `${format(progress.left)} left — getting close.`;
  return `${format(progress.left)} left to spend.`;
}

/**
 * What this item cost last time, from trips you've already finished. Prices
 * come from your own receipts, never from a price database.
 */
export function lastPaidPrice(label: string, trips: readonly ShoppingTrip[]): Minor | null {
  const wanted = normalize(label);
  if (!wanted) return null;
  let best: { price: Minor; at: number } | null = null;
  for (const trip of trips) {
    if (trip.status !== "done") continue;
    for (const item of trip.items) {
      if (normalize(item.label) !== wanted) continue;
      if (!best || item.createdAt > best.at) best = { price: item.price, at: item.createdAt };
    }
  }
  return best?.price ?? null;
}

/** Items you buy often, most recent first, for one-tap adding. */
export function frequentItems(trips: readonly ShoppingTrip[], limit = 8): { label: string; price: Minor }[] {
  const seen = new Map<string, { label: string; price: Minor; count: number; at: number }>();
  for (const trip of trips) {
    if (trip.status !== "done") continue;
    for (const item of trip.items) {
      const key = normalize(item.label);
      if (!key) continue;
      const entry = seen.get(key);
      if (entry) {
        entry.count++;
        if (item.createdAt > entry.at) {
          entry.price = item.price;
          entry.at = item.createdAt;
        }
      } else {
        seen.set(key, { label: item.label, price: item.price, count: 1, at: item.createdAt });
      }
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || b.at - a.at)
    .slice(0, limit)
    .map(({ label, price }) => ({ label, price }));
}

/**
 * Which items to put back to get under budget: the fewest, cheapest-to-lose
 * first — most expensive items go back first so you put back as little as
 * possible. Owwy suggests; it never removes anything itself.
 */
export function itemsToPutBack(trip: Pick<ShoppingTrip, "items" | "budget">): ShoppingItem[] {
  const progress = tripProgress(trip);
  if (!progress.over) return [];
  let excess = -progress.left;
  const candidates = trip.items.filter((i) => i.inCart).sort((a, b) => itemTotal(b) - itemTotal(a));
  const putBack: ShoppingItem[] = [];
  for (const item of candidates) {
    if (excess <= 0) break;
    putBack.push(item);
    excess -= itemTotal(item);
  }
  return putBack;
}
