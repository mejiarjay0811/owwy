import { describe, expect, it } from "vitest";
import { answerLocally, STARTER_GROUPS, STARTER_QUESTIONS, type AssistantContext } from "@/lib/assistant/local-engine";
import { buildContext } from "@/lib/assistant/prompt";
import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";
import { describeMainGoals, MAIN_GOALS, mainGoalLabel, toggleMainGoal } from "@/lib/defaults/main-goals";
import { pickOwwyMessage, type OwwyVoiceInput } from "@/lib/finance/owwy-voice";
import { computeFinanceState } from "@/lib/finance/state";
import { withDefaults } from "@/lib/storage/repositories/settings";
import type { SafeToSpendResult } from "@/lib/finance/safe-to-spend";
import type { MainGoal, OwwyDataset } from "@/types/models";
import { account, bill, dataset, debt, goal, P, tx } from "./fixtures";

const TODAY = "2026-09-14";

describe("choosing what matters most", () => {
  it("adds and removes an answer", () => {
    expect(toggleMainGoal(["understand"], "save")).toEqual(["understand", "save"]);
    expect(toggleMainGoal(["understand", "save"], "understand")).toEqual(["save"]);
  });

  it("keeps the last one, because 'nothing' isn't an answer to the question", () => {
    expect(toggleMainGoal(["save"], "save")).toEqual(["save"]);
  });

  it("describes a few without listing them all", () => {
    expect(describeMainGoals(["save"])).toBe("Save money");
    expect(describeMainGoals(["save", "debt", "control"])).toBe("Save money and 2 more");
    expect(describeMainGoals([])).toBe("Not set");
  });

  it("labels every choice setup offers", () => {
    for (const g of MAIN_GOALS) expect(mainGoalLabel(g.value)).toBe(g.label);
  });
});

describe("an install that answered the old single-choice question", () => {
  it("keeps its answer instead of being reset to the default", () => {
    const next = withDefaults({ schemaVersion: 4, mainGoal: "debt" });
    expect(next.mainGoals).toEqual(["debt"]);
    expect(next.mainGoal).toBe("debt");
  });

  it("holds the two fields in step, so nothing reads a focus that isn't chosen", () => {
    const next = withDefaults({ schemaVersion: 4, mainGoal: "save", mainGoals: ["control", "debt"] });
    expect(next.mainGoals).toEqual(["control", "debt"]);
    expect(next.mainGoal).toBe("control");
  });

  it("falls back to understanding your money when nothing was ever answered", () => {
    expect(withDefaults({}).mainGoals).toEqual(["understand"]);
  });

  it("starts new installs on Owwy's own colours and a card that follows them", () => {
    const fresh = withDefaults({});
    expect(fresh.palette).toBe("evergreen");
    expect(fresh.heroStyle).toBe("theme");
    expect(fresh.heroPattern).toBe("rings");
  });

  it("leaves a chosen palette and finish alone", () => {
    const next = withDefaults({ palette: "berry", heroStyle: "parchment", heroPattern: "waves" });
    expect([next.palette, next.heroStyle, next.heroPattern]).toEqual(["berry", "parchment", "waves"]);
  });
});

const STS: SafeToSpendResult = {
  amount: P(5000),
  rawAmount: P(5000),
  available: P(9000),
  committed: P(4000),
  lines: [],
  nextIncomeDate: "2026-10-01",
  periodEnd: "2026-09-30",
  daysLeft: 16,
  perDay: P(300),
  status: "healthy",
  spendableAccountIds: [],
};

/** A quiet day: nothing urgent, so Owwy talks about the chosen focus. */
const quietDay = (focus: MainGoal[], extra: Partial<OwwyVoiceInput> = {}): OwwyVoiceInput => ({
  today: TODAY,
  hasAccounts: true,
  transactionCount: 42,
  spentToday: P(120),
  monthToDateSpent: P(8000),
  previousMonthToDateSpent: 0,
  safeToSpend: STS,
  budgets: [],
  goals: [],
  upcomingBills: [],
  focus,
  savedThisMonth: 0,
  owed: 0,
  format: (m) => `P${(m / 100).toFixed(0)}`,
  ...extra,
});

describe("Owwy's closing line follows the chosen focus", () => {
  it("talks about savings when that's the point", () => {
    expect(pickOwwyMessage(quietDay(["save"])).text).toContain("Nothing set aside yet");
    expect(pickOwwyMessage(quietDay(["save"], { savedThisMonth: P(2000) })).text).toContain("P2000 set aside");
  });

  it("talks about what was spent when the point is control", () => {
    expect(pickOwwyMessage(quietDay(["control"])).text).toContain("P8000 spent so far");
  });

  it("talks about what's left to clear when the point is debt", () => {
    expect(pickOwwyMessage(quietDay(["debt"], { owed: P(15000) })).text).toContain("P15000 left to clear");
    expect(pickOwwyMessage(quietDay(["debt"])).text).toContain("Nothing owed");
  });

  it("counts what's been logged when the point is understanding it", () => {
    expect(pickOwwyMessage(quietDay(["understand"])).text).toContain("42 transactions");
  });

  it("uses the first focus it can say something about", () => {
    expect(pickOwwyMessage(quietDay(["other", "debt"])).text).toContain("Nothing owed");
    expect(pickOwwyMessage(quietDay(["other"])).text).toBe("You're doing great this month.");
  });

  it("still puts something urgent first — a plan never outranks bills at risk", () => {
    const atRisk = quietDay(["save"], { safeToSpend: { ...STS, status: "atRisk" } });
    expect(pickOwwyMessage(atRisk).text).toContain("bills need more");
  });
});

/* ------------------------------------------------- a wallet with a history */

const cash = account({ name: "Cash", type: "cash", openingBalance: P(3000) });
const bank = account({ name: "Main Wallet", openingBalance: P(50000) });
const savings = account({ name: "Savings", type: "savings", openingBalance: P(20000) });

function ctxFor(overrides: Partial<OwwyDataset> = {}): AssistantContext {
  const data = dataset({
    accounts: [cash, bank, savings],
    bills: [bill({ name: "Electricity", categoryId: "cat_utilities", amount: P(3400), nextDueDate: "2026-09-20", anchorDay: 20 })],
    goals: [goal({ accountId: savings.id, name: "Emergency fund", targetAmount: P(50000) })],
    debts: [debt({ name: "Phone", startingBalance: P(18000), originalAmount: P(18000) })],
    transactions: [
      tx({ type: "expense", amount: P(180), accountId: cash.id, categoryId: "cat_food", note: "Coffee", date: "2026-09-12" }),
      tx({ type: "expense", amount: P(2400), accountId: bank.id, categoryId: "cat_groceries", note: "Puregold", date: "2026-09-08" }),
      tx({ type: "expense", amount: P(3400), accountId: bank.id, categoryId: "cat_utilities", note: "Electricity", date: "2026-08-20" }),
      tx({ type: "expense", amount: P(640), accountId: cash.id, categoryId: "cat_food", note: "Dinner", date: "2026-08-14" }),
      tx({ type: "expense", amount: P(245), accountId: cash.id, categoryId: "cat_transport", note: "Grab", date: "2026-09-02" }),
      tx({ type: "income", amount: P(30000), accountId: bank.id, categoryId: "cat_salary", note: "Salary", date: "2026-09-01" }),
    ],
    ...overrides,
  });
  data.settings.income = { frequency: "monthly", paydays: [1] };
  data.categories = DEFAULT_CATEGORIES;
  return { data, state: computeFinanceState(data, TODAY), today: TODAY, currency: "PHP", brief: true };
}

describe("the starter questions", () => {
  const all = STARTER_GROUPS.flatMap((g) => g.questions);

  it("offer a good spread without becoming a wall", () => {
    expect(STARTER_GROUPS.length).toBeGreaterThanOrEqual(3);
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(new Set(all).size).toBe(all.length);
  });

  it("keep the short fallback list a subset of the real one", () => {
    for (const q of STARTER_QUESTIONS) expect(all).toContain(q);
  });

  /**
   * The point of this check: a suggestion that only works once you've paid for
   * an AI service is an advert dressed as a suggestion. Every chip has to be
   * answerable on the device, so none of them may fall through to the generic
   * "here's what I can do" reply.
   */
  it("are all answered on the device, with no key and no network", () => {
    const ctx = ctxFor();
    for (const question of all) {
      const blocks = answerLocally(question, ctx).blocks;
      const kinds = blocks.map((b) => b.type);
      expect(kinds, `"${question}" produced ${JSON.stringify(kinds)}`).not.toContain("error");
      expect(blocks.some((b) => b.type === "suggestions"), `"${question}" fell through to the generic help reply`).toBe(false);
    }
  });
});

describe("Ask Owwy is told what the user is here for", () => {
  it("names the chosen focus in the context block", () => {
    const ctx = ctxFor();
    ctx.data.settings.mainGoals = ["debt", "save"];
    expect(buildContext(ctx, [])).toContain("Pay off debt; Save money");
  });
});

describe("the new categories", () => {
  const ctx = ctxFor();

  it("give income more than six places to go", () => {
    expect(ctx.state.categories.filter((c) => c.kind === "income").length).toBeGreaterThanOrEqual(10);
  });

  it("keep 'Other' for things that really are other", () => {
    const other = ctx.state.categoriesById.get("cat_other");
    expect(other?.keywords).not.toContain("haircut");
    expect(ctx.state.categoriesById.get("cat_personal")?.keywords).toContain("haircut");
  });

  it("don't give one word to two categories, which would be a coin toss", () => {
    const seen = new Map<string, string>();
    for (const c of DEFAULT_CATEGORIES) {
      for (const word of c.keywords) {
        expect(seen.has(word), `"${word}" is on both ${seen.get(word)} and ${c.name}`).toBe(false);
        seen.set(word, c.name);
      }
    }
  });
});
