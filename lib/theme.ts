import type { ThemePreference } from "@/types/models";

export type ResolvedTheme = "light" | "dark";

/**
 * When Owwy follows the clock it uses the same boundaries as its greetings:
 * light once the morning starts, dark once the evening does.
 */
export const DAY_STARTS_HOUR = 5;
export const NIGHT_STARTS_HOUR = 18;

export function themeForHour(hour: number): ResolvedTheme {
  return hour >= DAY_STARTS_HOUR && hour < NIGHT_STARTS_HOUR ? "light" : "dark";
}

/** What the app should actually show, given the preference and the device. */
export function resolveTheme(preference: ThemePreference, options: { prefersDark: boolean; now?: Date }): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  if (preference === "timeOfDay") return themeForHour((options.now ?? new Date()).getHours());
  return options.prefersDark ? "dark" : "light";
}

/** Milliseconds until the clock would flip the theme by itself. */
export function msUntilNextThemeChange(now = new Date()): number {
  const hour = now.getHours();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(hour < DAY_STARTS_HOUR ? DAY_STARTS_HOUR : hour < NIGHT_STARTS_HOUR ? NIGHT_STARTS_HOUR : DAY_STARTS_HOUR + 24);
  return Math.max(1000, next.getTime() - now.getTime());
}

/** A plain description of what the clock setting does right now. */
export function describeTimeOfDayTheme(now = new Date()): string {
  const light = themeForHour(now.getHours()) === "light";
  return light ? `Light until ${NIGHT_STARTS_HOUR}:00, then dark for the evening.` : `Dark until ${DAY_STARTS_HOUR}:00, then light for the day.`;
}
