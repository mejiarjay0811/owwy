"use client";

import { cn } from "@/lib/utils/cn";

/**
 * Picks one or more days of the month — a payday on the 15th *and* the 30th
 * is the normal case here, not an edge case, so this is multi-select by
 * default rather than a single value with a workaround.
 *
 * 31 means "last day": a rule on the 31st fires on 28 February rather than
 * skipping the month, which is what people mean when they say "end of month".
 */

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const PRESETS: { label: string; days: number[] }[] = [
  { label: "15th & 30th", days: [15, 30] },
  { label: "1st & 16th", days: [1, 16] },
  { label: "1st", days: [1] },
  { label: "Last day", days: [31] },
];

export function ordinal(day: number): string {
  if (day === 31) return "last day";
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][day % 10] ?? "th");
  return `${day}${suffix}`;
}

/** "the 15th and the last day", for sentences in labels and toasts. */
export function describeMonthDays(days: readonly number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (!sorted.length) return "no days chosen";
  const parts = sorted.map((d) => `the ${ordinal(d)}`);
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

const sameDays = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((d, i) => d === b[i]);

export function MonthDayPicker({
  value,
  onChange,
  describedBy,
  invalid,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  const selected = new Set(value);
  const toggle = (day: number) => {
    const next = selected.has(day) ? value.filter((d) => d !== day) : [...value, day];
    onChange(next.sort((a, b) => a - b));
  };

  return (
    <div
      className={cn(
        "rounded-[18px] border bg-surface-2 p-3",
        invalid ? "border-negative" : "border-transparent",
      )}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const active = sameDays(value, preset.days);
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(preset.days)}
              className={cn(
                "press hit inline-flex h-8 items-center rounded-full border px-3 text-caption font-bold transition-colors",
                active ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="Days of the month" aria-describedby={describedBy} className="grid grid-cols-7 gap-1">
        {DAYS.map((day) => {
          const on = selected.has(day);
          return (
            <button
              key={day}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={day === 31 ? "Last day of the month" : `Day ${day}`}
              onClick={() => toggle(day)}
              className={cn(
                "tabular press relative flex h-11 items-center justify-center rounded-xl text-callout font-bold transition-colors",
                on ? "bg-brand text-brand-ink" : "bg-surface text-ink-2 hover:bg-surface-3",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 text-caption text-ink-3">
        {value.length ? (
          <>
            Repeats on {describeMonthDays(value)} of every month.
            {value.some((d) => d > 28) ? " Short months use their last day." : ""}
          </>
        ) : (
          <>Tap the days it should repeat on — pick two for a twice-a-month payday.</>
        )}
      </p>
    </div>
  );
}
