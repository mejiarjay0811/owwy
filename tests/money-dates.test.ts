import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonthKey,
  addMonths,
  diffDays,
  formatRelativeDate,
  isValidISODate,
  monthEnd,
  nextOccurrence,
  occurrencesBetween,
  startOfWeek,
} from "@/lib/dates";
import { formatMoney, parseAmount, splitEvenly, toMajor, toMinor } from "@/lib/money";

describe("money", () => {
  it("converts between major and minor units without float drift", () => {
    expect(toMinor(0.1 + 0.2, "PHP")).toBe(30);
    expect(toMinor(1240.555, "PHP")).toBe(124056);
    expect(toMinor(1500, "JPY")).toBe(1500);
    expect(toMajor(18050, "PHP")).toBe(180.5);
  });

  it("parses everyday amount formats", () => {
    expect(parseAmount("180", "PHP")).toBe(18000);
    expect(parseAmount("₱1,240.50", "PHP")).toBe(124050);
    expect(parseAmount("1.2k", "PHP")).toBe(120000);
    expect(parseAmount("30k", "USD")).toBe(3000000);
    expect(parseAmount(".5", "PHP")).toBe(50);
    expect(parseAmount("abc", "PHP")).toBeNull();
    expect(parseAmount("", "PHP")).toBeNull();
    expect(parseAmount("1,24", "PHP")).toBeNull();
  });

  it("formats with the currency's own symbol", () => {
    expect(formatMoney(2485000, "PHP")).toBe("₱24,850.00");
    expect(formatMoney(2485000, "PHP", { trimZeros: true })).toBe("₱24,850");
    expect(formatMoney(-18000, "PHP", { trimZeros: true })).toBe("−₱180");
    expect(formatMoney(18000, "PHP", { signed: true, trimZeros: true })).toBe("+₱180");
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
    expect(formatMoney(999, "USD")).toBe("$9.99");
  });

  it("splits amounts so parts add back to the total", () => {
    const parts = splitEvenly(1000, 3);
    expect(parts).toEqual([334, 333, 333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });
});

describe("dates", () => {
  it("validates calendar dates", () => {
    expect(isValidISODate("2026-02-29")).toBe(false);
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(isValidISODate("2026-13-01")).toBe(false);
  });

  it("does day and month arithmetic across boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-09-14", "2026-10-01")).toBe(17);
    expect(monthEnd("2028-02")).toBe("2028-02-29");
    expect(addMonthKey("2026-01", -1)).toBe("2025-12");
  });

  it("keeps the anchor day when adding months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-02-28", 1, 31)).toBe("2026-03-31");
    expect(nextOccurrence("2026-01-31", "monthly", 31)).toBe("2026-02-28");
    expect(nextOccurrence("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    expect(nextOccurrence("2024-02-29", "yearly", 29)).toBe("2025-02-28");
    expect(nextOccurrence("2026-09-15", "once")).toBeNull();
  });

  it("lists occurrences in a window", () => {
    expect(occurrencesBetween("2026-09-01", "weekly", "2026-09-10", "2026-09-30")).toEqual([
      "2026-09-15",
      "2026-09-22",
      "2026-09-29",
    ]);
    expect(occurrencesBetween("2026-09-01", "biweekly", "2026-09-01", "2026-09-30")).toEqual(["2026-09-01", "2026-09-15", "2026-09-29"]);
  });

  it("computes week starts and relative labels", () => {
    expect(startOfWeek("2026-09-14", 1)).toBe("2026-09-14"); // Monday
    expect(startOfWeek("2026-09-13", 1)).toBe("2026-09-07"); // Sunday
    expect(startOfWeek("2026-09-14", 0)).toBe("2026-09-13");
    expect(formatRelativeDate("2026-09-15", "2026-09-14")).toBe("Tomorrow");
    expect(formatRelativeDate("2026-09-18", "2026-09-14")).toBe("In 4 days");
    expect(formatRelativeDate("2026-10-02", "2026-09-14")).toBe("Oct 2");
  });
});
