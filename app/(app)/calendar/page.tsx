"use client";

import { useMemo, useState } from "react";
import { MonthSwitcher, Page, PageHeader } from "@/components/layout/page";
import { Card, Money } from "@/components/ui/display";
import { useFinance } from "@/hooks/use-finance";
import { addMonthKey, dayOfWeek, formatDayHeading, formatMonth, parseISODate, weekdayName } from "@/lib/dates";
import { buildMoneyCalendar, type CalendarDay, type CalendarEvent } from "@/lib/finance/calendar";
import { cn } from "@/lib/utils/cn";
import type { ISODate } from "@/types/models";

export default function CalendarPage() {
  // Daily totals use main-currency amounts.
  const { state, baseData: data, settings, today, fmt } = useFinance();
  const [month, setMonth] = useState(state.month);
  const [selected, setSelected] = useState<ISODate>(today);

  const calendar = useMemo(
    () =>
      buildMoneyCalendar({
        month,
        today,
        weekStartsOn: settings.weekStartsOn,
        transactions: data.transactions,
        accounts: state.accounts,
        categories: state.categories,
        goals: data.goals,
        bills: data.bills,
        recurring: data.recurring,
        debtProgress: state.debtProgress,
        income: settings.income,
        spendableBalance: state.safeToSpend.available,
        spendableAccountIds: state.safeToSpend.spendableAccountIds,
      }),
    [month, today, settings, data, state],
  );

  const weekdays = calendar.weeks[0].map((d) => weekdayName(d.date, true).slice(0, 2));
  const day = calendar.days.get(selected) ?? calendar.days.get(`${month}-01`)!;

  const changeMonth = (delta: number) => {
    const next = addMonthKey(month, delta);
    setMonth(next);
    setSelected(next === state.month ? today : `${next}-01`);
  };

  return (
    <Page width="wide">
      <PageHeader title="Money calendar" back="/more/" subtitle="What happened, and what's coming — day by day." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MonthSwitcher label={formatMonth(month)} onPrevious={() => changeMonth(-1)} onNext={() => changeMonth(1)} />
        <div className="flex gap-3 text-caption font-semibold text-ink-3">
          <Legend className="bg-ink-3" label="Spent" />
          <Legend className="bg-positive" label="Income" />
          <Legend className="bg-accent" label="Due" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="p-3 sm:p-4 lg:col-span-7">
          <div className="mb-1 grid grid-cols-7 text-center text-caption font-bold text-ink-3" aria-hidden>
            {weekdays.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div role="grid" aria-label={formatMonth(month)} className="grid gap-1">
            {calendar.weeks.map((week, i) => (
              <div role="row" key={i} className="grid grid-cols-7 gap-1">
                {week.map((d) => (
                  <DayCell key={d.date} day={d} selected={d.date === selected} onSelect={() => setSelected(d.date)} fmt={fmt} />
                ))}
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <Card className="p-5" aria-live="polite">
            <h2 className="text-title-3 font-bold">{formatDayHeading(day.date, today)}</h2>
            {day.projectedBalance !== null ? (
              <p className="mt-1 text-callout text-ink-2">
                Spending money at the end of the day:{" "}
                <Money value={day.projectedBalance} className={cn("font-bold", day.projectedBalance < 0 ? "text-negative" : "text-ink")} />
              </p>
            ) : day.spent || day.income ? (
              <p className="mt-1 text-callout text-ink-2">
                {day.spent ? (
                  <>
                    Spent <Money value={day.spent} className="font-bold text-ink" />
                  </>
                ) : null}
                {day.spent && day.income ? " · " : ""}
                {day.income ? (
                  <>
                    Received <Money value={day.income} className="font-bold text-positive" />
                  </>
                ) : null}
              </p>
            ) : null}

            {day.events.length ? (
              <ul className="mt-4 flex flex-col gap-2">
                {day.events.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-callout text-ink-3">{day.isPast ? "No money moved this day." : "Nothing scheduled."}</p>
            )}
          </Card>

          <Card className="grid grid-cols-3 gap-3 p-5">
            <div>
              <p className="text-caption font-semibold text-ink-3">Spent</p>
              <Money value={calendar.totals.spent} className="text-title-3 font-bold" />
            </div>
            <div>
              <p className="text-caption font-semibold text-ink-3">Income</p>
              <Money value={calendar.totals.income} className="text-title-3 font-bold text-positive" />
            </div>
            <div>
              <p className="text-caption font-semibold text-ink-3">Still due</p>
              <Money value={calendar.totals.dueRemaining} className="text-title-3 font-bold text-warning" />
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}

function DayCell({ day, selected, onSelect, fmt }: { day: CalendarDay; selected: boolean; onSelect: () => void; fmt: (n: number, o?: { compact?: boolean }) => string }) {
  const { hidden } = useFinance();
  const { d } = parseISODate(day.date);
  const hasIncome = day.events.some((e) => e.kind === "income" || e.kind === "expectedIncome");
  const hasDue = day.due > 0;
  const weekend = dayOfWeek(day.date) === 0 || dayOfWeek(day.date) === 6;
  const label = [
    formatDayHeading(day.date, day.date),
    day.spent ? `spent ${fmt(day.spent)}` : "",
    hasDue ? `${fmt(day.due)} due` : "",
    hasIncome ? "income" : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={selected}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        "press relative flex aspect-[0.9] flex-col items-center rounded-xl pt-1.5 text-center outline-none sm:aspect-square",
        !day.inMonth && "opacity-35",
        selected ? "bg-brand text-brand-ink" : day.isToday ? "bg-brand-soft" : "hover:bg-surface-2",
      )}
    >
      <span className={cn("text-callout font-bold", !selected && weekend && "text-ink-2", !selected && day.isToday && "text-brand-soft-ink")}>{d}</span>
      {!hidden && day.spent > 0 ? (
        <span className={cn("tabular mt-auto mb-1 max-w-full truncate px-0.5 text-[10px] leading-none font-semibold", selected ? "text-brand-ink/80" : "text-ink-3")}>
          {fmt(day.spent, { compact: true }).replace(/\.0(?=[KMB])/, "")}
        </span>
      ) : !hidden && hasDue ? (
        <span className={cn("tabular mt-auto mb-1 max-w-full truncate px-0.5 text-[10px] leading-none font-bold", selected ? "text-brand-ink" : "text-warning")}>
          {fmt(day.due, { compact: true })}
        </span>
      ) : (
        <span className="mt-auto" />
      )}
      <span className="absolute top-1.5 right-1.5 flex gap-0.5" aria-hidden>
        {hasIncome ? <span className={cn("size-1.5 rounded-full", selected ? "bg-brand-ink" : "bg-positive")} /> : null}
        {hasDue ? <span className={cn("size-1.5 rounded-full", selected ? "bg-brand-ink" : "bg-accent")} /> : null}
      </span>
    </button>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5", event.projected ? "border border-dashed border-line-strong" : "bg-surface-2")}>
      <span className="text-[20px]" aria-hidden>
        {event.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-callout font-semibold">{event.label}</span>
        <span className="block text-caption text-ink-3">
          {event.projected ? (event.kind === "expectedIncome" ? "Expected" : "Scheduled") : event.kind === "savings" ? "Saved" : event.kind === "transfer" ? "Transfer" : event.kind === "income" ? "Income" : "Spent"}
        </span>
      </span>
      {event.amount !== null ? (
        <Money
          value={event.direction === "in" ? event.amount : event.direction === "out" ? -event.amount : event.amount}
          signed={event.direction === "in"}
          className={cn("text-callout font-bold", event.direction === "in" && "text-positive", event.projected && event.direction === "out" && "text-warning")}
        />
      ) : null}
    </li>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} aria-hidden />
      {label}
    </span>
  );
}
