"use client";

import { ArrowDownRight, ArrowUpRight, ChevronRight, Landmark } from "lucide-react";
import Link from "@/components/ui/app-link";
import { useMemo, useState } from "react";
import { BarChart, DonutChart, Sparkbars } from "@/components/charts/charts";
import { CashFlowTab, ProjectionTab, TrendTab } from "@/components/insights/stats-tabs";
import { Segmented } from "@/components/ui/form";
import { MonthSwitcher, Page, PageHeader } from "@/components/layout/page";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Card, EmptyState, Money, OwwySays, SectionHeader } from "@/components/ui/display";
import { useFinance } from "@/hooks/use-finance";
import { addMonthKey, daysInMonth, formatMonth, monthName, monthStart } from "@/lib/dates";
import { computeBudgetProgress, monthElapsedPercent } from "@/lib/finance/budgets";
import { forecastMonth } from "@/lib/finance/forecast";
import { categoryChanges, generateInsights, type Insight } from "@/lib/finance/insights";
import { percentChange, savingsRate, summarizeMonth, summarizePeriod } from "@/lib/finance/summary";
import { cn } from "@/lib/utils/cn";

export default function InsightsPage() {
  // Analysis uses main-currency amounts.
  const { state, baseData: data, today, fmt, settings } = useFinance();
  const [month, setMonth] = useState(state.month);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "trend" | "cashflow" | "projection">("overview");

  const isCurrent = month === state.month;
  const analysis = useMemo(() => {
    const current = isCurrent ? state.thisMonth : summarizeMonth(data.transactions, data.accounts, data.goals, month);
    const prevKey = addMonthKey(month, -1);
    const previousFull = summarizeMonth(data.transactions, data.accounts, data.goals, prevKey);
    const [py, pm] = prevKey.split("-").map(Number);
    const dayNumber = isCurrent ? Number(today.slice(8, 10)) : 31;
    const previousSameSpan = isCurrent
      ? summarizePeriod(data.transactions, data.accounts, data.goals, monthStart(prevKey), `${prevKey}-${String(Math.min(dayNumber, daysInMonth(py, pm))).padStart(2, "0")}`)
      : previousFull;
    const budgets = computeBudgetProgress(data.budgets, state.categories, current.byCategory, month, today);
    const [y, m] = month.split("-").map(Number);
    const daysElapsed = isCurrent ? dayNumber : daysInMonth(y, m);
    const insights = generateInsights({
      current,
      previousSameSpan,
      previousFull,
      categoriesById: state.categoriesById,
      budgets,
      monthElapsed: monthElapsedPercent(month, today),
      daysElapsed,
      format: (v) => fmt(v),
    });
    const changes = categoryChanges(current, previousSameSpan, state.categoriesById).filter((c) => c.current > 0);
    return { current, previousFull, previousSameSpan, insights, changes, daysElapsed };
  }, [isCurrent, state, data, month, today, fmt]);

  const { current, previousSameSpan, insights, changes } = analysis;
  // The donut's centre explains the hovered category, or the biggest one.
  const focus = changes.find((c) => c.categoryId === activeCategory) ?? [...changes].sort((a, b) => b.current - a.current)[0];
  const top = changes.slice(0, 5);
  const rest = changes.slice(5).reduce((t, c) => t + c.current, 0);
  const segments = [
    ...top.map((c) => ({ id: c.categoryId, label: c.category?.name ?? "Other", value: c.current, color: c.category?.color ?? "#8A9491" })),
    ...(rest > 0 ? [{ id: "rest", label: "Everything else", value: rest, color: "#B9B2A3" }] : []),
  ];

  const [y, m] = month.split("-").map(Number);
  const days = daysInMonth(y, m);
  const bars = Array.from({ length: days }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { key: date, label: String(i + 1), value: current.byDay.get(date) ?? 0, highlight: date === today, muted: date > today };
  });
  const average = analysis.daysElapsed ? Math.round(current.spent / analysis.daysElapsed) : 0;
  // The single heaviest day of the month so far, and what share of the month
  // it accounts for — one unusual day often explains a whole month.
  const peakDay = bars.filter((b) => !b.muted && b.value > 0).sort((a, b) => b.value - a.value)[0];
  const peakDayShare = peakDay && current.spent > 0 ? Math.round((peakDay.value / current.spent) * 100) : 0;

  const reviewMonths = useMemo(() => {
    const months = new Set(data.transactions.map((t) => t.date.slice(0, 7)));
    return [...months].filter((mk) => mk < state.month).sort().reverse().slice(0, 6);
  }, [data.transactions, state.month]);

  const lead = insights[0];
  const hasData = current.transactionCount > 0;
  const rate = savingsRate(current);

  return (
    <Page width="wide">
      <PageHeader title="Stats" subtitle="Where your money went — and where it's heading." />
      <Segmented
        className="mb-5 max-w-xl"
        label="Stats view"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Month" },
          { value: "trend", label: "Trend" },
          { value: "cashflow", label: "Flow" },
          { value: "projection", label: "Ahead" },
        ]}
      />

      {tab === "trend" ? (
        <TrendTab />
      ) : tab === "cashflow" ? (
        <CashFlowTab />
      ) : tab === "projection" ? (
        <ProjectionTab />
      ) : (
        <>
      <div className="mb-5 flex justify-center lg:justify-start">
        <MonthSwitcher label={formatMonth(month)} onPrevious={() => setMonth(addMonthKey(month, -1))} onNext={() => setMonth(addMonthKey(month, 1))} nextDisabled={isCurrent} />
      </div>

      {!hasData ? (
        <Card>
          <EmptyState mood="sleeping" title={`No activity in ${monthName(month)}`} description="Once you add transactions, Owwy explains your spending here." />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
            {lead ? (
              <Card className="p-5">
                <OwwySays mood={lead.tone === "positive" ? "happy" : lead.tone === "attention" ? "thinking" : "neutral"} size={52}>
                  <span className="block font-bold">{lead.title}</span>
                  <span className="text-ink-2">{lead.detail}</span>
                </OwwySays>
              </Card>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Spent" dot="bg-accent" value={current.spent} change={percentChange(current.spent, previousSameSpan.spent)} />
              <StatCard label="Income" dot="bg-positive" value={current.income} change={percentChange(current.income, previousSameSpan.income)} positiveIsGood />
              <StatCard
                label="Net flow"
                dot={current.net >= 0 ? "bg-brand" : "bg-negative"}
                value={current.net}
                signed
                tone={current.net >= 0 ? "text-positive" : "text-negative"}
                hint={current.saved > 0 ? `${fmt(current.saved)} saved${current.income > 0 ? ` · ${rate.toFixed(0)}%` : ""}` : "Income minus spending"}
              />
              <Card className="p-4">
                <p className="flex items-center gap-1.5 text-caption font-semibold text-ink-3">
                  <span className="size-2 rounded-full bg-ink-3" aria-hidden />
                  Transactions
                </p>
                <p className="tabular mt-1 text-title-3 font-extrabold sm:text-title-2">{current.transactionCount}</p>
                <p className="mt-1 truncate text-caption text-ink-3">
                  <Money value={average} whole /> a day on average
                </p>
              </Card>
            </div>

            {/* Two-up: a number paired with the shape behind it. Each tile
                answers one question on its own, so the row reads at a glance
                without opening the full charts below. */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="flex flex-col p-4">
                <p className="text-caption font-semibold text-ink-3">Last 14 days</p>
                <p className="tabular mt-1 text-title-3 font-extrabold sm:text-title-2">
                  <Money value={average} whole />
                  <span className="text-caption font-semibold text-ink-3"> / day</span>
                </p>
                <Sparkbars data={bars.filter((b) => !b.muted).slice(-14)} className="mt-auto pt-3" />
              </Card>
              <Card className="flex flex-col p-4">
                <p className="text-caption font-semibold text-ink-3">Biggest day</p>
                {peakDay ? (
                  <>
                    <p className="tabular mt-1 text-title-3 font-extrabold sm:text-title-2">
                      <Money value={-peakDay.value} whole />
                    </p>
                    <p className="mt-auto pt-3 truncate text-caption text-ink-3">
                      {monthName(month, true)} {peakDay.label}
                      {peakDayShare ? ` · ${peakDayShare}% of the month` : ""}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-callout text-ink-3">Nothing spent yet.</p>
                )}
              </Card>
            </div>

            {isCurrent ? <ForecastCard /> : null}

            <Card className="p-5">
              <SectionHeader title="Spending by category" />
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                <DonutChart segments={segments} label={`Spending by category in ${formatMonth(month)}`} activeId={activeCategory}>
                  {focus ? (
                    <>
                      <span className="text-[22px] leading-none" aria-hidden>
                        {focus.category?.emoji}
                      </span>
                      <span className="tabular text-title-2 leading-tight font-extrabold">{Math.round(current.spent ? (focus.current / current.spent) * 100 : 0)}%</span>
                      <span className="max-w-[96px] truncate text-caption font-semibold text-ink-3">{focus.category?.name ?? "Other"}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-caption font-semibold text-ink-3">Spent</span>
                      <Money value={current.spent} className="text-title-2 font-extrabold" />
                    </>
                  )}
                </DonutChart>
                <ul className="w-full flex-1">
                  {changes.slice(0, 8).map((c) => {
                    const share = current.spent ? (c.current / current.spent) * 100 : 0;
                    return (
                      <li key={c.categoryId}>
                        <Link
                          href={`/transactions/?q=${encodeURIComponent(`${c.category?.name ?? ""} ${monthName(month)} ${month.slice(0, 4)}`)}`}
                          onMouseEnter={() => setActiveCategory(c.categoryId)}
                          onMouseLeave={() => setActiveCategory(null)}
                          onFocus={() => setActiveCategory(c.categoryId)}
                          onBlur={() => setActiveCategory(null)}
                          className="press -mx-2 flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-2"
                        >
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.category?.color }} aria-hidden />
                          <span className="text-[16px]" aria-hidden>{c.category?.emoji}</span>
                          <span className="min-w-0 flex-1 truncate text-callout font-semibold">{c.category?.name}</span>
                          <ChangePill change={c.change} />
                          <span className="w-10 text-right text-caption text-ink-3">{Math.round(share)}%</span>
                          <Money value={c.current} className="w-20 text-right text-callout font-bold" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader title="Daily spending" action={<span className="text-caption text-ink-3">Hover a bar for details</span>} />
              <BarChart data={bars} average={average} label={`Daily spending in ${formatMonth(month)}`} formatValue={(v) => fmt(v, { compact: v >= 100000 })} />
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
            {insights.length > 1 ? (
              <section aria-labelledby="insights-list">
                <h2 id="insights-list" className="mb-3 text-title-3 font-bold">
                  What Owwy noticed
                </h2>
                <ul className="flex flex-col gap-3">
                  {insights.slice(1).map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </ul>
              </section>
            ) : null}

            {reviewMonths.length ? (
              <Card className="p-5">
                <SectionHeader title="Monthly reviews" />
                <ul className="-mx-2">
                  {reviewMonths.map((mk) => (
                    <li key={mk}>
                      <Link href={`/review/?month=${mk}`} className="press flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                        <OwwyMascot mood="happy" size={32} />
                        <span className="flex-1 font-semibold">{monthName(mk)} Review</span>
                        <span className="text-caption text-ink-3">{mk.slice(0, 4)}</span>
                        <ChevronRight className="size-4 text-ink-3" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {settings.showNetWorth ? (
              <Link href="/accounts/" className="press block">
                <Card className="flex items-center gap-4 p-5 hover:bg-surface-2/50">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-soft-ink">
                    <Landmark className="size-6" aria-hidden />
                  </span>
                  <div className="flex-1">
                    <p className="text-caption font-semibold text-ink-3">Net worth</p>
                    <Money value={state.netWorth.netWorth} className="text-title-2 font-extrabold" />
                    <p className="text-caption text-ink-3">What you own minus what you owe</p>
                  </div>
                  <ChevronRight className="size-5 text-ink-3" aria-hidden />
                </Card>
              </Link>
            ) : null}
            <p className="px-1 text-caption text-ink-3">
              {isCurrent
                ? `Changes compare with the first ${analysis.daysElapsed} days of ${monthName(addMonthKey(month, -1))}, so a month in progress is judged fairly.`
                : `Changes compare with all of ${monthName(addMonthKey(month, -1))}.`}
            </p>
          </div>
        </div>
      )}
        </>
      )}
    </Page>
  );
}

function StatCard({ label, value, change, positiveIsGood, hint, dot, signed, tone }: { label: string; value: number; change?: number | null; positiveIsGood?: boolean; hint?: string; dot?: string; signed?: boolean; tone?: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-caption font-semibold text-ink-3">
        {dot ? <span className={cn("size-2 rounded-full", dot)} aria-hidden /> : null}
        {label}
      </p>
      <p className={cn("mt-1 truncate text-title-3 font-extrabold sm:text-title-2", tone)}>
        <Money value={value} signed={signed} compact={Math.abs(value) >= 10_000_000} />
      </p>
      {change !== undefined ? (
        <p className="mt-1 flex items-center gap-1 text-caption text-ink-3">
          <ChangePill change={change} positiveIsGood={positiveIsGood} />
          <span className="truncate">vs last month</span>
        </p>
      ) : hint ? (
        <p className="mt-1 truncate text-caption text-ink-3">{hint}</p>
      ) : null}
    </Card>
  );
}

/** Where this month should land: logged so far, still scheduled, and everyday spending at today's pace. */
function ForecastCard() {
  const { state, baseData, today } = useFinance();
  const f = useMemo(() => forecastMonth({ today, transactions: baseData.transactions, upcoming: state.upcoming }), [today, baseData.transactions, state.upcoming]);
  const incomeTotal = f.actualIncome + f.expectedIncome;
  const spendTotal = f.actualSpent + f.scheduledSpend + f.everydaySpend;
  const max = Math.max(1, incomeTotal, spendTotal);
  const good = f.projectedNet >= 0;

  return (
    <Card className="p-5">
      <SectionHeader title="Month-end forecast" action={<span className="text-caption text-ink-3">{f.daysLeft} days left</span>} />
      <p className="text-callout text-ink-2">
        At this pace you&apos;ll end {monthName(state.month)}{" "}
        <Money value={f.projectedNet} signed whole className={cn("font-extrabold", good ? "text-positive" : "text-negative")} />
        {good ? " ahead." : " short — worth a look at what's scheduled."}
      </p>
      <div className="mt-4 flex flex-col gap-3.5">
        <ForecastBar label="Money in" actual={f.actualIncome} expected={f.expectedIncome} max={max} color="bg-positive" soft="bg-positive/30" />
        <ForecastBar label="Money out" actual={f.actualSpent} expected={f.scheduledSpend + f.everydaySpend} max={max} color="bg-accent" soft="bg-accent/35" />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line/60 pt-3 text-caption">
        <div>
          <dt className="text-ink-3">Coming in</dt>
          <dd className="font-bold text-positive">
            <Money value={f.expectedIncome} whole />
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">Bills & autos</dt>
          <dd className="font-bold">
            <Money value={f.scheduledSpend} whole />
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">Everyday</dt>
          <dd className="font-bold">
            <Money value={f.everydayPerDay} whole />
            <span className="font-normal text-ink-3">/day</span>
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function ForecastBar({ label, actual, expected, max, color, soft }: { label: string; actual: number; expected: number; max: number; color: string; soft: string }) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-caption">
        <span className="font-semibold text-ink-2">{label}</span>
        <span className="text-ink-3">
          <Money value={actual} whole className="font-bold text-ink" /> → <Money value={actual + expected} whole />
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${label}: so far and expected by month end`}>
        <span className={cn("h-full", color)} style={{ width: `${(actual / max) * 100}%` }} />
        <span className={cn("h-full", soft)} style={{ width: `${(expected / max) * 100}%` }} />
      </div>
    </div>
  );
}

function ChangePill({ change, positiveIsGood, className }: { change: number | null | undefined; positiveIsGood?: boolean; className?: string }) {
  if (change === null || change === undefined || Math.abs(change) < 1) {
    return <span className={cn("text-caption text-ink-3", className)}>{change === null ? "new" : "≈ same"}</span>;
  }
  const up = change > 0;
  const good = positiveIsGood ? up : !up;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-caption font-bold", good ? "text-positive" : "text-warning", className)}>
      {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
      <span className="sr-only">{up ? "up" : "down"}</span>
      {Math.abs(Math.round(change))}%
    </span>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <Card as="li" className="flex gap-3 p-4">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl text-[20px]",
          insight.tone === "positive" ? "bg-positive-soft" : insight.tone === "attention" ? "bg-warning-soft" : "bg-surface-2",
        )}
        aria-hidden
      >
        {insight.emoji}
      </span>
      <div className="min-w-0">
        <p className="font-bold">{insight.title}</p>
        <p className="text-callout text-ink-2">{insight.detail}</p>
      </div>
    </Card>
  );
}
