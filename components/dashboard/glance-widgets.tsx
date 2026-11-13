"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarCheck, ChevronRight, Plus } from "lucide-react";
import Link from "@/components/ui/app-link";
import { useMemo, useState } from "react";
import { PayBillSheet } from "@/components/bills/pay-bill-sheet";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmojiTile, Money, ProgressBar, SectionHeader } from "@/components/ui/display";
import { Segmented } from "@/components/ui/form";
import { useFinance } from "@/hooks/use-finance";
import { formatRelativeDate, formatShortDate, weekdayName } from "@/lib/dates";
import { spendingSeries, type SpendingPeriod } from "@/lib/finance/spending";
import type { MoneyMove } from "@/lib/finance/upcoming";
import { cn } from "@/lib/utils/cn";
import type { Bill } from "@/types/models";

/* ---------------------------------------------------------------- Payday */

export function PaydayWidget() {
  const { state, today } = useFinance();
  const { payday } = state;
  const progress = ((payday.cycleDays - payday.daysLeft) / payday.cycleDays) * 100;
  const tomorrow = payday.daysLeft === 1;

  return (
    <Card as="section" aria-labelledby="payday-title" className="flex h-full min-h-[172px] flex-col p-4">
      <div className="flex h-7 items-center justify-between gap-2">
        <h2 id="payday-title" className="text-eyebrow font-bold tracking-[0.09em] text-ink-3 uppercase">
          Payday
        </h2>
        <CalendarCheck className={cn("size-[18px]", payday.daysLeft <= 3 ? "text-brand" : "text-ink-3")} aria-hidden />
      </div>
      <p className="mt-2 text-title-2 leading-tight font-extrabold tracking-tight">
        {tomorrow ? (
          "Tomorrow!"
        ) : (
          <>
            <span className="tabular">{payday.daysLeft}</span> <span className="text-title-3 font-bold text-ink-2">days</span>
          </>
        )}
      </p>
      <p className="truncate text-caption text-ink-3">
        {weekdayName(payday.date, true)}, {formatShortDate(payday.date, today)}
      </p>
      <div className="mt-auto pt-3">
        <ProgressBar value={progress} tone="accent" height="h-2" label={`${Math.round(progress)}% of the way to payday`} />
      </div>
      <p className="mt-2 truncate text-caption text-ink-2">
        {payday.expectedAmount ? (
          <>
            {payday.basis === "automation" ? "Expecting " : "Usually "}
            <Money value={payday.expectedAmount} compact={payday.expectedAmount >= 100_000_00} whole className="font-bold text-positive" />
          </>
        ) : (
          <Link href="/recurring/" className="font-semibold text-brand hover:underline">
            Add your salary
          </Link>
        )}
      </p>
    </Card>
  );
}

/* ---------------------------------------------------------------- Spending pulse */

const PERIOD_LABEL: Record<SpendingPeriod, { title: string; unit: string }> = {
  day: { title: "Today", unit: "day" },
  week: { title: "This week", unit: "wk" },
  month: { title: "This month", unit: "mo" },
};
const NEXT_PERIOD: Record<SpendingPeriod, SpendingPeriod> = { day: "week", week: "month", month: "day" };

export function SpendingWidget() {
  const { state, settings, today } = useFinance();
  const [period, setPeriod] = useState<SpendingPeriod>("day");
  const series = useMemo(() => spendingSeries(state.baseTransactions, today, period, settings.weekStartsOn), [state.baseTransactions, today, period, settings.weekStartsOn]);
  const max = Math.max(1, ...series.buckets.map((b) => b.amount));
  const over = series.average > 0 && series.current > series.average;

  return (
    <Card as="section" aria-labelledby="spending-title" className="flex h-full min-h-[172px] flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="spending-title" className="text-eyebrow font-bold tracking-[0.09em] text-ink-3 uppercase">
          Spent
        </h2>
        <button
          type="button"
          onClick={() => setPeriod(NEXT_PERIOD[period])}
          className="press -mr-1 inline-flex h-7 items-center gap-0.5 rounded-full bg-surface-2 pr-1.5 pl-2.5 text-caption font-bold text-ink-2 hover:text-ink"
          aria-label={`Showing ${PERIOD_LABEL[period].title.toLowerCase()}. Switch to ${PERIOD_LABEL[NEXT_PERIOD[period]].title.toLowerCase()}`}
        >
          {PERIOD_LABEL[period].title}
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
      <p className="mt-2 truncate text-title-2 font-extrabold tracking-tight">
        <Money value={series.current} compact={series.current >= 1_000_000_00} whole={series.current >= 1_000_00} />
      </p>
      <p className={cn("truncate text-caption", over ? "font-semibold text-warning" : "text-ink-3")} title={over ? "Above your average" : "Within your average"}>
        {series.average > 0 ? (
          <>
            {over ? "↑ " : ""}avg <Money value={series.average} compact={series.average >= 100_000_00} whole />/{PERIOD_LABEL[period].unit}
          </>
        ) : (
          "No history yet"
        )}
      </p>
      <ul className="mt-auto flex h-14 items-end gap-1 pt-3" aria-label={`Spending, last ${series.buckets.length} ${period === "day" ? "days" : period === "week" ? "weeks" : "months"}`}>
        {series.buckets.map((b) => (
          <li key={b.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={b.longLabel}>
            <span
              className={cn("w-full max-w-[18px] rounded-full transition-[height] duration-500", b.current ? "bg-brand" : b.amount ? "bg-surface-3" : "bg-surface-2")}
              style={{ height: `${Math.max(8, (b.amount / max) * 100)}%` }}
              aria-hidden
            />
            <span className="sr-only">
              {b.longLabel}: <Money value={b.amount} alwaysShow={false} />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex gap-1" aria-hidden>
        {series.buckets.map((b) => (
          <span key={b.start} className={cn("flex-1 truncate text-center text-[10px] font-semibold", b.current ? "text-ink" : "text-ink-3")}>
            {period === "week" ? b.label.replace(/^\w+ /, "") : period === "day" ? b.label.slice(0, 1) : b.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- Upcoming */

type Direction = "out" | "in";

export function UpcomingMovesWidget() {
  const { state, data } = useFinance();
  const { income, expenses } = state.upcoming;
  const [direction, setDirection] = useState<Direction>(() => (expenses.length || !income.length ? "out" : "in"));
  const [paying, setPaying] = useState<Bill | null>(null);
  const moves = direction === "out" ? expenses : income;
  const total = moves.reduce((t, m) => t + m.amount, 0);
  const billsById = useMemo(() => new Map(data.bills.map((b) => [b.id, b])), [data.bills]);
  // Only a bill's next occurrence can be paid.
  const firstBillMove = new Set<string>();
  const seenBills = new Set<string>();
  for (const m of expenses) {
    if (m.source === "bill" && !seenBills.has(m.refId)) {
      seenBills.add(m.refId);
      firstBillMove.add(m.id);
    }
  }

  return (
    <Card as="section" aria-labelledby="upcoming-title" className="p-5">
      <SectionHeader id="upcoming-title" title="Upcoming" href="/calendar/" actionLabel="Calendar" />
      <Segmented
        size="sm"
        label="Upcoming money"
        value={direction}
        onChange={setDirection}
        options={[
          { value: "out", label: `Going out${expenses.length ? ` · ${expenses.length}` : ""}` },
          { value: "in", label: `Coming in${income.length ? ` · ${income.length}` : ""}` },
        ]}
      />

      {moves.length ? (
        <>
          <p className="mt-3 flex items-center gap-1.5 text-caption text-ink-3">
            {direction === "out" ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownLeft className="size-3.5 text-positive" aria-hidden />}
            <Money value={total} className={cn("font-bold", direction === "in" ? "text-positive" : "text-ink")} /> {direction === "out" ? "due" : "expected"} in the next 30 days
          </p>
          <ul className="-mx-2 mt-2 flex flex-col">
            {moves.slice(0, 5).map((move) => (
              <li key={move.id}>
                <MoveRow
                  move={move}
                  onPay={move.source === "bill" && firstBillMove.has(move.id) && billsById.get(move.refId) ? () => setPaying(billsById.get(move.refId) ?? null) : undefined}
                />
              </li>
            ))}
          </ul>
          {moves.length > 5 ? (
            <Link href={direction === "out" ? "/bills/" : "/recurring/"} className="press mt-1 inline-flex rounded-full px-2 py-1 text-callout font-semibold text-brand hover:bg-brand-soft">
              {moves.length - 5} more
            </Link>
          ) : null}
        </>
      ) : direction === "out" ? (
        <div className="py-4 text-center">
          <p className="text-callout text-ink-2">Nothing due in the next 30 days.</p>
          <ButtonLink href="/bills/?new=1" variant="secondary" size="sm" className="mt-3">
            <Plus />
            Add a bill
          </ButtonLink>
        </div>
      ) : (
        <div className="py-4 text-center">
          <p className="text-callout text-ink-2">No income scheduled yet.</p>
          <ButtonLink href="/recurring/" variant="secondary" size="sm" className="mt-3">
            <Plus />
            Add salary automation
          </ButtonLink>
        </div>
      )}
      <PayBillSheet bill={paying} onOpenChange={(open) => !open && setPaying(null)} />
    </Card>
  );
}

const SOURCE_HREF: Record<MoneyMove["source"], string> = {
  bill: "/bills/",
  automation: "/recurring/",
  credit: "/accounts/",
  debt: "/debts/",
  receivable: "/owed/",
};

function MoveRow({ move, onPay }: { move: MoneyMove; onPay?: () => void }) {
  const { today } = useFinance();
  const content = (
    <>
      <EmojiTile emoji={move.emoji} size="sm" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-body font-semibold">{move.label}</span>
        <span className="block truncate text-caption text-ink-3">
          {weekdayName(move.date, true)}, {formatShortDate(move.date, today)}
          {move.source === "automation" ? " · automation" : move.source === "credit" ? " · card due" : ""}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <Money value={move.amount} className={cn("text-body font-bold", move.direction === "in" && "text-positive")} signed={move.direction === "in"} />
        <DaysLeftBadge move={move} />
      </span>
    </>
  );
  const className = "press flex w-full items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2/60";
  return onPay ? (
    <button type="button" onClick={onPay} className={className} aria-label={`${move.label}, ${formatRelativeDate(move.date, today)}. Mark paid`}>
      {content}
    </button>
  ) : (
    <Link href={SOURCE_HREF[move.source]} className={className}>
      {content}
    </Link>
  );
}

export function DaysLeftBadge({ move }: { move: Pick<MoneyMove, "daysLeft" | "overdue" | "direction"> }) {
  const text = move.overdue ? (move.direction === "in" ? "Late" : "Overdue") : move.daysLeft === 0 ? "Today" : move.daysLeft === 1 ? "1 day left" : `${move.daysLeft} days left`;
  const tone = move.overdue
    ? "bg-negative-soft text-negative"
    : move.daysLeft <= 3
      ? move.direction === "in"
        ? "bg-positive-soft text-positive"
        : "bg-warning-soft text-warning"
      : "bg-surface-2 text-ink-3";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] leading-4 font-bold tracking-wide whitespace-nowrap uppercase", tone)}>{text}</span>;
}
