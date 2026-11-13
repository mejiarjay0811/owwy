import { addDays, addMonthKey, addMonths, dayOfWeek, daysInMonth, makeDate, monthEnd, monthKey, monthStart, parseISODate } from "@/lib/dates";
import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";
import { computeBalances } from "@/lib/finance/balances";
import { buildTransaction, type TransactionInput } from "@/lib/storage/repositories/transactions";
import { getDB } from "@/lib/storage/db";
import { getSettings } from "@/lib/storage/repositories/settings";
import type {
  Account,
  Bill,
  Budget,
  Debt,
  ID,
  ISODate,
  Minor,
  MoneyNote,
  Receivable,
  RecurringTransaction,
  SavingsGoal,
  Transaction,
} from "@/types/models";

/**
 * Sample data so Owwy can be explored before entering real numbers.
 * Clearly flagged with `settings.demoMode` and removable in one tap.
 * Everything is generated relative to `today` with a seeded random source,
 * so the same day always produces the same data set.
 */

const P = (major: number): Minor => Math.round(major * 100);

function seededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoDataset {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  bills: Bill[];
  goals: SavingsGoal[];
  debts: Debt[];
  recurring: RecurringTransaction[];
  receivables: Receivable[];
  notes: MoneyNote[];
}

export function buildDemoDataset(today: ISODate): DemoDataset {
  const now = Date.now();
  const rand = seededRandom(Number(today.replace(/-/g, "")));
  const between = (min: number, max: number) => P(Math.round((min + rand() * (max - min)) / 5) * 5);
  const chance = (p: number) => rand() < p;

  const account = (id: ID, name: string, type: Account["type"], cardStyle: string, order: number, extra: Partial<Account> = {}): Account => ({
    id,
    name,
    type,
    openingBalance: 0,
    cardStyle,
    cardPattern: "feathers",
    includeInSafeToSpend: ["cash", "bank", "ewallet"].includes(type),
    archived: false,
    order,
    createdAt: now,
    updatedAt: now,
    ...extra,
  });

  const accounts: Account[] = [
    account("acc_demo_main", "Main Wallet", "bank", "evergreen", 1, { last4: "2841" }),
    account("acc_demo_savings", "Savings", "savings", "amber", 2, {
      last4: "7730",
      cardPattern: "waves",
      interestRate: 4,
      interestTaxRate: 20,
      interestPostedThrough: addMonthKey(monthKey(today), -1),
    }),
    account("acc_demo_cash", "Cash", "cash", "moss", 3, { cardPattern: "dots" }),
    account("acc_demo_ewallet", "E-wallet", "ewallet", "lagoon", 4, { last4: "0917", cardPattern: "waves" }),
    account("acc_demo_emergency", "Emergency Fund", "emergency", "midnight", 5, { cardPattern: "dots" }),
    account("acc_demo_credit", "Credit Card", "credit", "graphite", 6, { last4: "5104", creditLimit: P(40000), dueDay: 20 }),
    account("acc_demo_usd", "Travel USD", "bank", "dusk", 7, { currency: "USD", last4: "4410", cardPattern: "dots", includeInSafeToSpend: false }),
  ];
  const targetBalances: Record<ID, Minor> = {
    acc_demo_main: P(8450),
    acc_demo_savings: P(25000),
    acc_demo_cash: P(1200),
    acc_demo_ewallet: P(2315),
    acc_demo_emergency: P(12500),
    acc_demo_credit: -P(4820),
    acc_demo_usd: 42000, // $420.00
  };

  const month = monthKey(today);
  const start = monthStart(addMonthKey(month, -2));
  const { y, m } = parseISODate(today);

  // Goals
  const phoneTarget = (() => {
    let date = makeDate(y, 12, 20);
    if (date <= addDays(today, 45)) date = makeDate(y + 1, 3, 20);
    return date;
  })();
  const goals: SavingsGoal[] = [
    { id: "goal_demo_phone", name: "New Phone", emoji: "📱", targetAmount: P(40000), startingAmount: P(12500), targetDate: phoneTarget, accountId: "acc_demo_savings", color: "#E8A33D", archived: false, createdAt: now - 3, updatedAt: now },
    { id: "goal_demo_emergency", name: "Emergency Fund", emoji: "🛟", targetAmount: P(30000), startingAmount: P(10500), accountId: "acc_demo_emergency", color: "#3C6E8F", archived: false, createdAt: now - 2, updatedAt: now },
    { id: "goal_demo_trip", name: "Beach Trip", emoji: "🏝️", targetAmount: P(15000), startingAmount: 0, targetDate: addMonths(today, 8), accountId: "acc_demo_savings", color: "#2F8FA3", archived: false, createdAt: now - 1, updatedAt: now },
  ];

  // Bills: due days within the month; paid automatically in the past.
  const billDefs = [
    { id: "bill_demo_electric", name: "Electricity", emoji: "💡", amount: P(2100), day: 15, categoryId: "cat_utilities", accountId: "acc_demo_main" },
    { id: "bill_demo_internet", name: "Internet", emoji: "🌐", amount: P(1699), day: 18, categoryId: "cat_utilities", accountId: "acc_demo_main" },
    { id: "bill_demo_water", name: "Water", emoji: "💧", amount: P(480), day: 20, categoryId: "cat_utilities", accountId: "acc_demo_main" },
    { id: "bill_demo_netflix", name: "Netflix", emoji: "🎬", amount: P(249), day: 22, categoryId: "cat_subscriptions", accountId: "acc_demo_credit" },
    { id: "bill_demo_mobile", name: "Mobile plan", emoji: "📶", amount: P(999), day: 25, categoryId: "cat_utilities", accountId: "acc_demo_main" },
  ];

  const tx: Transaction[] = [];
  let createdAt = now - 10_000_000;
  const add = (input: TransactionInput) => {
    tx.push({ ...buildTransaction(input, createdAt), createdAt: createdAt++ });
  };
  const at = (hour: number) => `${String(hour).padStart(2, "0")}:${String(Math.floor(rand() * 12) * 5).padStart(2, "0")}`;

  const lunches = ["Lunch", "Lunch", "Carinderia lunch", "Jollibee", "Chowking", "Lunch with team"];
  const coffees = ["Coffee", "Iced coffee", "Milk tea", "Latte"];
  const dinners = ["Dinner with friends", "Samgyup night", "Family dinner", "Pizza night"];
  const shopping = [
    { day: 6, note: "Shopee order", min: 450, max: 900 },
    { day: 12, note: "New shoes", min: 1400, max: 1800 },
    { day: 23, note: "Clothes", min: 700, max: 1200 },
  ];

  for (let date = start; date <= today; date = addDays(date, 1)) {
    const { d, y: dy, m: dm } = parseISODate(date);
    const dow = dayOfWeek(date);
    const weekday = dow >= 1 && dow <= 5;
    const isPast = date < today;
    const isCurrentMonth = monthKey(date) === month;

    if (d === 1) add({ type: "income", amount: P(30000), accountId: "acc_demo_main", categoryId: "cat_salary", date, note: "Salary", recurringId: "rec_demo_salary" });
    if (d === 2) {
      add({ type: "expense", amount: P(2000), accountId: "acc_demo_main", categoryId: "cat_family", date, note: "Padala to parents", recurringId: "rec_demo_padala" });
      add({ type: "transfer", amount: P(3000), accountId: "acc_demo_main", toAccountId: "acc_demo_savings", date, note: "Saved for New Phone", goalId: "goal_demo_phone" });
      add({ type: "transfer", amount: P(1000), accountId: "acc_demo_main", toAccountId: "acc_demo_emergency", date, note: "Saved for Emergency Fund", goalId: "goal_demo_emergency" });
      add({ type: "transfer", amount: P(1500), accountId: "acc_demo_main", toAccountId: "acc_demo_savings", date, note: "Saved for Beach Trip", goalId: "goal_demo_trip" });
    }
    if ((d === 3 || d === 17) && date <= today) add({ type: "transfer", amount: P(1500), accountId: "acc_demo_main", toAccountId: "acc_demo_ewallet", date, note: "E-wallet top up" });
    if (dow === 1) add({ type: "transfer", amount: P(1000), accountId: "acc_demo_main", toAccountId: "acc_demo_cash", date, note: "ATM withdrawal" });
    if (d === 8) add({ type: "expense", amount: P(149), accountId: "acc_demo_credit", categoryId: "cat_subscriptions", date, note: "Spotify", recurringId: "rec_demo_spotify" });

    for (const bill of billDefs) {
      if (Math.min(bill.day, daysInMonth(dy, dm)) === d && isPast) {
        const variance = bill.id === "bill_demo_electric" ? between(-250, 250) : 0;
        add({ type: "expense", amount: bill.amount + variance, accountId: bill.accountId, categoryId: bill.categoryId, date, note: bill.name, billId: bill.id });
      }
    }

    if (d === 20 && isPast) add({ type: "transfer", amount: P(2500), accountId: "acc_demo_main", toAccountId: "acc_demo_credit", date, note: "Credit Card payment", debtId: "debt_demo_card" });
    if (d === 28 && monthKey(date) === addMonthKey(month, -1)) {
      add({ type: "expense", amount: P(1000), accountId: "acc_demo_main", categoryId: "cat_debt", date, note: "Borrowed from family payment", debtId: "debt_demo_family" });
    }

    // Everyday life.
    if (weekday && chance(0.8)) add({ type: "expense", amount: between(130, 220), accountId: "acc_demo_cash", categoryId: "cat_food", date, time: at(12), note: lunches[Math.floor(rand() * lunches.length)] });
    if (weekday && chance(isCurrentMonth ? 0.45 : 0.6)) add({ type: "expense", amount: between(120, 190), accountId: "acc_demo_ewallet", categoryId: "cat_food", date, time: at(15), note: coffees[Math.floor(rand() * coffees.length)] });
    if ((dow === 2 || dow === 5) && chance(0.7)) add({ type: "expense", amount: between(160, 320), accountId: "acc_demo_ewallet", categoryId: "cat_transport", date, time: at(7), note: "Grab to office" });
    if (dow === 1) add({ type: "expense", amount: P(500), accountId: "acc_demo_cash", categoryId: "cat_transport", date, time: at(8), note: "Beep card load" });
    if (dow === 6) add({ type: "expense", amount: between(900, 1600), accountId: "acc_demo_main", categoryId: "cat_groceries", date, time: at(10), note: chance(0.5) ? "Groceries" : "Weekly market run" });
    if (dow === 0 && chance(0.75)) add({ type: "expense", amount: between(450, 950), accountId: "acc_demo_credit", categoryId: "cat_food", date, time: at(19), note: dinners[Math.floor(rand() * dinners.length)] });
    // Savings interest, paid at month end after 20% withholding tax.
    if (date === monthEnd(monthKey(date)) && date < today) add({ type: "income", amount: between(60, 80), accountId: "acc_demo_savings", categoryId: "cat_interest", date, note: "Interest (after 20% tax)" });
    for (const item of shopping) {
      if (d === item.day) add({ type: "expense", amount: between(item.min, item.max), accountId: "acc_demo_credit", categoryId: "cat_shopping", date, note: item.note });
    }
    if ((d === 10 || d === 24) && chance(0.8)) add({ type: "expense", amount: between(320, 560), accountId: "acc_demo_ewallet", categoryId: "cat_entertainment", date, note: d === 10 ? "Movie night" : "Karaoke" });
    if (d === 16 && isPast) add({ type: "expense", amount: between(280, 520), accountId: "acc_demo_cash", categoryId: "cat_health", date, note: "Pharmacy" });
    if (d === 14 && monthKey(date) === addMonthKey(month, -2)) add({ type: "income", amount: P(3500), accountId: "acc_demo_ewallet", categoryId: "cat_freelance", date, note: "Logo design client" });
    // Lent a friend money last month; part came back.
    if (d === 6 && monthKey(date) === addMonthKey(month, -1)) add({ type: "expense", amount: P(6000), accountId: "acc_demo_main", categoryId: "cat_other", date, note: "Lent to Migs", receivableId: "rcv_demo_migs" });
    if (d === 27 && monthKey(date) === addMonthKey(month, -1)) add({ type: "income", amount: P(1500), accountId: "acc_demo_ewallet", categoryId: "cat_income_other", date, note: "Migs paid back", receivableId: "rcv_demo_migs" });
  }

  // Opening balances make today's balances land on friendly numbers.
  const net = computeBalances(accounts, tx);
  for (const a of accounts) a.openingBalance = targetBalances[a.id] - (net.get(a.id) ?? 0);

  const nextDue = (day: number) => {
    const thisMonth = makeDate(y, m, Math.min(day, daysInMonth(y, m)));
    return thisMonth >= today ? thisMonth : addMonths(thisMonth, 1, day);
  };

  const bills: Bill[] = billDefs.map((b, i) => ({
    id: b.id,
    name: b.name,
    emoji: b.emoji,
    amount: b.amount,
    categoryId: b.categoryId,
    accountId: b.accountId,
    frequency: "monthly",
    nextDueDate: nextDue(b.day),
    anchorDay: b.day,
    remindDaysBefore: 2,
    lastPaidDate: tx.filter((t) => t.billId === b.id).at(-1)?.date,
    active: true,
    createdAt: now + i,
    updatedAt: now,
  }));

  const budgetAmounts: [ID, number][] = [
    ["cat_food", 5000],
    ["cat_groceries", 5500],
    ["cat_transport", 3000],
    ["cat_shopping", 2500],
    ["cat_entertainment", 1500],
    ["cat_subscriptions", 500],
    ["cat_utilities", 5500],
  ];
  const budgets: Budget[] = [-2, -1, 0].flatMap((offset) =>
    budgetAmounts.map(([categoryId, amount]) => ({
      id: `bud_demo_${categoryId}_${offset + 2}`,
      categoryId,
      month: addMonthKey(month, offset),
      amount: P(amount),
      paused: false,
      createdAt: now,
    })),
  );

  const debts: Debt[] = [
    { id: "debt_demo_card", name: "Credit Card", kind: "credit_card", startingBalance: P(12500), originalAmount: P(12500), minimumPayment: P(1000), nextDueDate: nextDue(20), anchorDay: 20, interestRate: 36, accountId: "acc_demo_credit", archived: false, createdAt: now, updatedAt: now },
    { id: "debt_demo_family", name: "Borrowed from family", kind: "borrowed", startingBalance: P(5000), originalAmount: P(5000), minimumPayment: P(1000), nextDueDate: nextDue(28), anchorDay: 28, lender: "Tita Rose", archived: false, createdAt: now, updatedAt: now },
  ];

  const nextMonthly = (day: number) => {
    const thisMonth = makeDate(y, m, Math.min(day, daysInMonth(y, m)));
    return thisMonth > today ? thisMonth : addMonths(thisMonth, 1, day);
  };
  const rule = (id: ID, name: string, type: RecurringTransaction["type"], amount: Minor, accountId: ID, categoryId: ID, day: number, mode: RecurringTransaction["mode"] = "auto"): RecurringTransaction => ({
    mode,
    id,
    name,
    type,
    amount,
    accountId,
    categoryId,
    note: name,
    frequency: "monthly",
    startDate: makeDate(parseISODate(start).y, parseISODate(start).m, day),
    nextDate: nextMonthly(day),
    anchorDay: day,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  const recurring: RecurringTransaction[] = [
    rule("rec_demo_salary", "Salary", "income", P(30000), "acc_demo_main", "cat_salary", 1),
    rule("rec_demo_padala", "Padala to parents", "expense", P(2000), "acc_demo_main", "cat_family", 2),
    rule("rec_demo_spotify", "Spotify", "expense", P(149), "acc_demo_credit", "cat_subscriptions", 8),
    // "Ask first" automation that's waiting today, to show the confirm flow.
    { ...rule("rec_demo_load", "Load for Mom", "expense", P(300), "acc_demo_ewallet", "cat_family", parseISODate(today).d, "confirm"), nextDate: today },
  ];

  const receivables: Receivable[] = [
    { id: "rcv_demo_migs", person: "Migs", note: "Concert tickets", originalAmount: P(6000), startingCollected: 0, dueDate: addDays(today, 16), archived: false, createdAt: now, updatedAt: now },
  ];
  const notes: MoneyNote[] = [
    { id: "note_demo_1", text: "Ask Tita Rose if she's okay with ₱1,000 a month until the loan is done.", pinned: true, createdAt: now - 2, updatedAt: now - 2 },
    { id: "note_demo_2", text: "Check if the mobile plan has a cheaper option before renewing in December.", pinned: false, createdAt: now - 1, updatedAt: now - 1 },
  ];

  return { accounts, transactions: tx, budgets, bills, goals, debts, recurring, receivables, notes };
}

/** Replaces all financial data with the sample set. */
export async function loadDemoData(today: ISODate): Promise<void> {
  const db = getDB();
  const demo = buildDemoDataset(today);
  const settings = await getSettings();
  await db.transaction("rw", db.dataTables, async () => {
    await clearFinancialTables();
    await db.categories.bulkPut(DEFAULT_CATEGORIES);
    await db.accounts.bulkAdd(demo.accounts);
    await db.transactions.bulkAdd(demo.transactions);
    await db.budgets.bulkAdd(demo.budgets);
    await db.bills.bulkAdd(demo.bills);
    await db.goals.bulkAdd(demo.goals);
    await db.debts.bulkAdd(demo.debts);
    await db.recurring.bulkAdd(demo.recurring);
    await db.receivables.bulkAdd(demo.receivables);
    await db.notes.bulkAdd(demo.notes);
    await db.settings.put({
      ...settings,
      onboarded: true,
      demoMode: true,
      currency: "PHP",
      income: { frequency: "monthly", paydays: [1] },
      updatedAt: Date.now(),
    });
  });
}

/** Removes every account, transaction and plan while keeping preferences. */
export async function clearFinancialData(): Promise<void> {
  const db = getDB();
  const settings = await getSettings();
  await db.transaction("rw", db.dataTables, async () => {
    await clearFinancialTables();
    await db.categories.bulkPut(DEFAULT_CATEGORIES);
    await db.settings.put({ ...settings, demoMode: false, updatedAt: Date.now() });
  });
}

async function clearFinancialTables(): Promise<void> {
  const db = getDB();
  await Promise.all([
    db.accounts.clear(),
    db.categories.clear(),
    db.transactions.clear(),
    db.budgets.clear(),
    db.bills.clear(),
    db.goals.clear(),
    db.debts.clear(),
    db.recurring.clear(),
    db.snapshots.clear(),
    db.receivables.clear(),
    db.notes.clear(),
  ]);
}
