import { describe, expect, it } from "vitest";
import { computeStreak, heatmapWeeks, loggedDays, streakLine, weekdayInitials } from "@/lib/finance/streak";
import type { Transaction } from "@/types/models";

const TODAY = "2026-09-28";

const tx = (date: string, over: Partial<Transaction> = {}): Transaction =>
  ({ id: Math.random().toString(36), type: "expense", amount: 100_00, accountId: "a1", categoryId: "cat_food", date, note: "", tags: [], createdAt: 0, updatedAt: 0, ...over }) as Transaction;

describe("loggedDays", () => {
  it("counts entries per day", () => {
    const days = loggedDays([tx("2026-09-28"), tx("2026-09-28"), tx("2026-09-27")]);
    expect(days.get("2026-09-28")).toBe(2);
    expect(days.get("2026-09-27")).toBe(1);
  });

  it("ignores what logged itself — automations and interest", () => {
    const days = loggedDays([tx("2026-09-28", { recurringId: "r1" }), tx("2026-09-27", { categoryId: "cat_interest" })]);
    expect(days.size).toBe(0);
  });
});

describe("computeStreak", () => {
  const streakFrom = (dates: string[]) => computeStreak(new Map(dates.map((d) => [d, 1])), TODAY);

  it("counts consecutive days up to today", () => {
    expect(streakFrom(["2026-09-26", "2026-09-27", "2026-09-28"])).toMatchObject({ current: 3, longest: 3, daysLogged: 3, atRisk: false });
  });

  it("keeps the streak alive until midnight when today is still empty", () => {
    expect(streakFrom(["2026-09-26", "2026-09-27"])).toMatchObject({ current: 2, atRisk: true });
  });

  it("drops the streak after a missed day", () => {
    expect(streakFrom(["2026-09-20", "2026-09-21"])).toMatchObject({ current: 0, longest: 2, atRisk: false });
  });

  it("remembers the longest run even when the current one is shorter", () => {
    expect(streakFrom(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-28"])).toMatchObject({ current: 1, longest: 4 });
  });

  it("handles no history at all", () => {
    expect(streakFrom([])).toMatchObject({ current: 0, longest: 0, daysLogged: 0, lastLogged: null });
  });

  it("ignores days in the future", () => {
    expect(streakFrom(["2026-09-28", "2026-10-05"])).toMatchObject({ current: 1, daysLogged: 1 });
  });
});

describe("heatmapWeeks", () => {
  const days = new Map([["2026-09-28", 3], ["2026-09-01", 1]]);

  it("builds whole weeks ending with this one", () => {
    const weeks = heatmapWeeks(days, TODAY, 4, 1);
    expect(weeks).toHaveLength(4);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // 2026-09-28 is a Monday: the first square of the last week.
    expect(weeks[3][0]).toMatchObject({ date: "2026-09-28", count: 3, level: 2 });
  });

  it("marks days that haven't happened yet", () => {
    const weeks = heatmapWeeks(days, TODAY, 2, 1);
    const future = weeks.flat().filter((d) => d.future);
    expect(future.every((d) => d.date > TODAY)).toBe(true);
    expect(future).toHaveLength(6);
  });

  it("scales intensity with how much was logged", () => {
    const levels = heatmapWeeks(new Map([["2026-09-28", 1], ["2026-09-27", 3], ["2026-09-26", 9]]), TODAY, 2, 1)
      .flat()
      .filter((d) => d.count > 0)
      .map((d) => d.level);
    expect(levels.sort()).toEqual([1, 2, 4]);
  });

  it("labels rows from the day the week starts", () => {
    expect(weekdayInitials(1)[0]).toBe("M");
    expect(weekdayInitials(0)[0]).toBe("S");
  });
});

describe("streakLine", () => {
  it("says the right thing at each stage", () => {
    expect(streakLine({ current: 0, longest: 0, daysLogged: 0, lastLogged: null, atRisk: false })).toMatch(/first expense/);
    expect(streakLine({ current: 4, longest: 9, daysLogged: 20, lastLogged: TODAY, atRisk: false })).toBe("4 days in a row.");
    expect(streakLine({ current: 4, longest: 9, daysLogged: 20, lastLogged: "2026-09-27", atRisk: true })).toMatch(/keep it/);
    expect(streakLine({ current: 7, longest: 7, daysLogged: 30, lastLogged: TODAY, atRisk: false })).toMatch(/best run/);
  });
});
