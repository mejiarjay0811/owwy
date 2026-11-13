"use client";

import { Flame } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Card, SectionHeader } from "@/components/ui/display";
import { useFinance } from "@/hooks/use-finance";
import { formatShortDate, monthName } from "@/lib/dates";
import { computeStreak, heatmapWeeks, loggedDays, streakLine, weekdayInitials } from "@/lib/finance/streak";
import { cn } from "@/lib/utils/cn";

const WEEKS = 26;

const LEVEL_CLASS = [
  "bg-surface-2",
  "bg-brand/25",
  "bg-brand/45",
  "bg-brand/70",
  "bg-brand",
];

/** Six months of logging at a glance, and the streak it adds up to. */
export function StreakHeatmap() {
  const { data, settings, today } = useFinance();
  const days = useMemo(() => loggedDays(data.transactions), [data.transactions]);
  const streak = useMemo(() => computeStreak(days, today), [days, today]);
  const weeks = useMemo(() => heatmapWeeks(days, today, WEEKS, settings.weekStartsOn), [days, today, settings.weekStartsOn]);
  const labels = weekdayInitials(settings.weekStartsOn);
  const scroller = useRef<HTMLDivElement>(null);

  // Open on this week: the recent squares are the ones that matter.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  // A month label above the week where each new month starts.
  const months = weeks.map((week, index) => {
    const first = week[0].date;
    const previous = weeks[index - 1]?.[0].date;
    const changed = !previous || first.slice(5, 7) !== previous.slice(5, 7);
    return changed ? monthName(first.slice(0, 7), true) : "";
  });

  return (
    <Card className="p-5">
      <SectionHeader
        title="Your logging"
        action={
          streak.current > 0 ? (
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-bold", streak.atRisk ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand-soft-ink")}>
              <Flame className="size-3.5" aria-hidden />
              {streak.current} day{streak.current === 1 ? "" : "s"}
            </span>
          ) : null
        }
      />

      <div ref={scroller} className="no-scrollbar -mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-[3px]">
          <div className="mr-1 flex flex-col gap-[3px] pt-[14px]">
            {labels.map((label, i) => (
              // Every other row, starting with the first, so the labels read M · W · F.
              <span key={`${label}-${i}`} className="flex h-[13px] items-center text-[9px] leading-none text-ink-3">
                {i % 2 === 0 ? label : ""}
              </span>
            ))}
          </div>
          {weeks.map((week, index) => (
            <div key={week[0].date} className="flex flex-col gap-[3px]">
              <span className="h-[11px] text-[9px] leading-none text-ink-3">{months[index]}</span>
              {week.map((day) => (
                <span
                  key={day.date}
                  title={day.future ? "" : `${formatShortDate(day.date, today)} · ${day.count} ${day.count === 1 ? "entry" : "entries"}`}
                  className={cn("size-[13px] rounded-[3px]", day.future ? "bg-transparent" : LEVEL_CLASS[day.level])}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className={cn("text-callout", streak.atRisk ? "font-semibold text-warning" : "text-ink-2")}>{streakLine(streak)}</p>
        <p className="text-caption text-ink-3">
          Best {streak.longest} · {streak.daysLogged} days logged
        </p>
      </div>
    </Card>
  );
}
