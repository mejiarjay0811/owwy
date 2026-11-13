import { describe, expect, it } from "vitest";
import { createDefaultSettings } from "@/lib/defaults/settings";
import { evaluateAffordability } from "@/lib/finance/afford";
import { computeBalances } from "@/lib/finance/balances";
import { computeDebtProgress } from "@/lib/finance/debts";
import { computeGoalProgress } from "@/lib/finance/goals";
import { computeSafeToSpend, type SafeToSpendInput } from "@/lib/finance/safe-to-spend";
import type { AppSettings } from "@/types/models";
import { account, bill, debt, goal, P, recurring } from "./fixtures";

const TODAY = "2026-09-14";

function settings(overrides: Partial<AppSettings["safeToSpend"]> = {}): Pick<AppSettings, "income" | "safeToSpend"> {
  const base = createDefaultSettings(0);
  return {
    income: { frequency: "monthly", paydays: [1] },
    safeToSpend: { ...base.safeToSpend, bufferPercent: 0, ...overrides },
  };
}

function input(overrides: Partial<SafeToSpendInput>): SafeToSpendInput {
  const accounts = overrides.accounts ?? [];
  return {
    today: TODAY,
    settings: settings(),
    accounts,
    balances: computeBalances(accounts, []),
    bills: [],
    recurring: [],
    goals: [],
    goalProgress: [],
    debtProgress: [],
    transactions: [],
    savedThisMonth: 0,
    ...overrides,
  };
}

describe("safe to spend", () => {
  const wallet = account({ openingBalance: P(8450) });
  const cash = account({ type: "cash", openingBalance: P(1200) });
  const savings = account({ type: "savings", openingBalance: P(25000), includeInSafeToSpend: false });
  const card = account({ type: "credit", openingBalance: -P(4820), includeInSafeToSpend: false });
  const accounts = [wallet, cash, savings, card];

  it("counts only spendable accounts and plans until the day before next income", () => {
    const result = computeSafeToSpend(input({ accounts }));
    expect(result.available).toBe(P(9650));
    expect(result.amount).toBe(P(9650));
    expect(result.nextIncomeDate).toBe("2026-10-01");
    expect(result.periodEnd).toBe("2026-09-30");
    expect(result.daysLeft).toBe(17);
    expect(result.perDay).toBe(Math.floor(P(9650) / 17));
    expect(result.status).toBe("healthy");
  });

  it("subtracts bills due before payday but not after", () => {
    const result = computeSafeToSpend(
      input({
        accounts,
        bills: [
          bill({ amount: P(2100), nextDueDate: "2026-09-15" }),
          bill({ amount: P(1699), nextDueDate: "2026-09-18", name: "Internet" }),
          bill({ amount: P(5000), nextDueDate: "2026-10-05", name: "Rent" }),
          bill({ amount: P(300), nextDueDate: "2026-09-20", name: "Card-paid", accountId: card.id }),
          bill({ amount: P(480), nextDueDate: "2026-09-10", name: "Overdue water" }),
        ],
      }),
    );
    const bills = result.lines.find((l) => l.key === "bills")!;
    expect(bills.amount).toBe(P(2100 + 1699 + 480));
    expect(bills.items.map((i) => i.date)).toEqual(["2026-09-10", "2026-09-15", "2026-09-18"]);
    expect(result.amount).toBe(P(9650 - 4279));
  });

  it("includes recurring expenses and remaining debt minimums", () => {
    const loan = debt({ minimumPayment: P(1000), nextDueDate: "2026-09-20" });
    const result = computeSafeToSpend(
      input({
        accounts,
        recurring: [recurring({ accountId: wallet.id, type: "expense", amount: P(149), nextDate: "2026-09-22", categoryId: "cat_subscriptions", name: "Spotify" })],
        debtProgress: [computeDebtProgress(loan, [], new Map(), TODAY)],
      }),
    );
    expect(result.lines.find((l) => l.key === "bills")!.amount).toBe(P(149));
    expect(result.lines.find((l) => l.key === "debts")!.amount).toBe(P(1000));
    expect(result.committed).toBe(P(1149));
  });

  it("reserves the rest of the monthly savings plan and goal money in spending accounts", () => {
    const phone = goal({ accountId: savings.id, targetAmount: P(40000), startingAmount: P(18500), targetDate: "2026-12-20" });
    const envelope = goal({ accountId: wallet.id, targetAmount: P(5000), startingAmount: P(800), name: "Gift" });
    const goalProgress = [computeGoalProgress(phone, [], TODAY), computeGoalProgress(envelope, [], TODAY)];
    const result = computeSafeToSpend(input({ accounts, goals: [phone, envelope], goalProgress, savedThisMonth: P(4000) }));
    // Phone needs 5,375/month; 4,000 already saved; 17 of 17 days remain in the period.
    expect(result.lines.find((l) => l.key === "savings")!.amount).toBe(P(1375));
    expect(result.lines.find((l) => l.key === "goals")!.amount).toBe(P(800));
    expect(result.amount).toBe(P(9650 - 1375 - 800));
  });

  it("applies minimum balance and a percentage cushion to what's left", () => {
    const result = computeSafeToSpend(
      input({ accounts, settings: settings({ minimumBalance: P(1000), bufferMode: "percent", bufferPercent: 10 }) }),
    );
    expect(result.lines.find((l) => l.key === "buffer")!.amount).toBe(P(865));
    expect(result.amount).toBe(P(9650 - 1000 - 865));
  });

  it("caps a fixed cushion at what's left and flags shortfalls", () => {
    const tight = computeSafeToSpend(
      input({ accounts: [account({ openingBalance: P(1000) })], settings: settings({ bufferMode: "fixed", bufferAmount: P(5000) }) }),
    );
    expect(tight.amount).toBe(0);
    expect(tight.status).toBe("short");

    const broke = computeSafeToSpend(
      input({ accounts: [account({ openingBalance: P(1000) })], bills: [bill({ amount: P(2100), nextDueDate: "2026-09-15" })] }),
    );
    expect(broke.rawAmount).toBe(-P(1100));
    expect(broke.amount).toBe(0);
    expect(broke.status).toBe("atRisk");
  });
});

describe("can I afford it", () => {
  const wallet = account({ openingBalance: P(10000) });
  const base = computeSafeToSpend(
    input({
      accounts: [wallet],
      bills: [bill({ amount: P(2000), nextDueDate: "2026-09-20" })],
      settings: settings({ bufferMode: "fixed", bufferAmount: P(1000) }),
    }),
  );

  it("starts from the Safe-to-Spend figure", () => {
    expect(base.amount).toBe(P(7000));
  });

  it("is comfortable when plenty remains", () => {
    const result = evaluateAffordability(P(3500), base);
    expect(result.verdict).toBe("comfortable");
    expect(result.safeAfter).toBe(P(3500));
    expect(result.perDayAfter).toBe(Math.floor(P(3500) / base.daysLeft));
  });

  it("asks to think when it uses most of the money or the cushion", () => {
    expect(evaluateAffordability(P(6000), base).verdict).toBe("think");
    const cushion = evaluateAffordability(P(7500), base);
    expect(cushion.verdict).toBe("think");
    expect(cushion.headline).toMatch(/cushion/);
  });

  it("is not recommended when bills would be at risk", () => {
    const result = evaluateAffordability(P(8500), base);
    expect(result.verdict).toBe("notRecommended");
    expect(result.safeAfter).toBeLessThan(0);
  });
});
