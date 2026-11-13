import { describe, expect, it } from "vitest";
import { msUntilNextThemeChange, resolveTheme, themeForHour } from "@/lib/theme";

const at = (hour: number, minute = 0) => new Date(2026, 8, 28, hour, minute, 0, 0);

describe("themeForHour", () => {
  it.each([
    [0, "dark"],
    [4, "dark"],
    [5, "light"],
    [9, "light"],
    [13, "light"],
    [17, "light"],
    [18, "dark"],
    [23, "dark"],
  ])("%i:00 is %s", (hour, expected) => {
    expect(themeForHour(hour)).toBe(expected);
  });
});

describe("resolveTheme", () => {
  it("honours an explicit choice whatever the time or device", () => {
    expect(resolveTheme("light", { prefersDark: true, now: at(22) })).toBe("light");
    expect(resolveTheme("dark", { prefersDark: false, now: at(9) })).toBe("dark");
  });

  it("follows the device when set to system", () => {
    expect(resolveTheme("system", { prefersDark: true, now: at(9) })).toBe("dark");
    expect(resolveTheme("system", { prefersDark: false, now: at(22) })).toBe("light");
  });

  it("follows the clock, ignoring the device, when set to the time of day", () => {
    expect(resolveTheme("timeOfDay", { prefersDark: true, now: at(9) })).toBe("light");
    expect(resolveTheme("timeOfDay", { prefersDark: false, now: at(20) })).toBe("dark");
  });
});

describe("msUntilNextThemeChange", () => {
  const hours = (ms: number) => ms / 3_600_000;

  it("waits for the evening during the day", () => {
    expect(hours(msUntilNextThemeChange(at(9)))).toBeCloseTo(9);
    expect(hours(msUntilNextThemeChange(at(17, 30)))).toBeCloseTo(0.5);
  });

  it("waits for the morning at night, across midnight", () => {
    expect(hours(msUntilNextThemeChange(at(2)))).toBeCloseTo(3);
    expect(hours(msUntilNextThemeChange(at(20)))).toBeCloseTo(9);
    expect(hours(msUntilNextThemeChange(at(23, 30)))).toBeCloseTo(5.5);
  });

  it("never schedules a busy loop", () => {
    expect(msUntilNextThemeChange(at(18))).toBeGreaterThanOrEqual(1000);
    expect(msUntilNextThemeChange(at(5))).toBeGreaterThanOrEqual(1000);
  });
});
