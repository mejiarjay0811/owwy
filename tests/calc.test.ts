import { describe, expect, it } from "vitest";
import { evaluateExpression, isExpression } from "@/lib/money/calc";

describe("evaluateExpression", () => {
  it.each([
    ["120", 120],
    ["120+45", 165],
    ["120 + 45×2", 210],
    ["(120+45)*2", 330],
    ["1,500 − 250", 1250],
    ["300 ÷ 4", 75],
    ["-5+10", 5],
    ["12.5x2", 25],
  ])("%s = %d", (input, expected) => {
    expect(evaluateExpression(input)).toBeCloseTo(expected);
  });

  it.each(["", "12+", "1..2", "5/0", "(3+4", "abc", "3++", "alert(1)"])("rejects %j", (input) => {
    expect(evaluateExpression(input)).toBeNull();
  });

  it("detects expressions", () => {
    expect(isExpression("120+45")).toBe(true);
    expect(isExpression("1,200.50")).toBe(false);
    expect(isExpression("-50")).toBe(false);
  });
});
