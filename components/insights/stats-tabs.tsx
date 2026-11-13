"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import { LineChart } from "@/components/charts/charts";
import { StreakHeatmap } from "@/components/insights/streak-heatmap";
import { Card, Money, SectionHeader } from "@/components/ui/display";
import { Segmented } from "@/components/ui/form";
import { useFinance } from "@/hooks/use-finance";
import { monthName } from "@/lib/dates";
import { cashFlowHistory, netWorthHistory, periodEnds, projectBalance, type TrendGranularity } from "@/lib/finance/trends";
import { cn } from "@/lib/utils/cn";

/** Net worth over time — the long view. */
export function TrendTab() {
  const { data, baseData, state, today, fmt } = useFinance();
  const [granularity, setGranularity] = useState<TrendGranularity>("monthly");

  const points = useMemo(
    () => netWorthHistory(state.accounts, data.transactions, data.debts, periodEnds(granularity, today), state.fx),
    [state.accounts, data.transactions, data.debts, granularity, today, state.fx],
  );
  const first = points[0]?.value ?? 0;
  const last = points.at(-1)?.value ?? 0;
  const change = last - first;
  const flow = useMemo(() => {
    const from = periodEnds(granularity, today)[0]?.date ?? today;
    let income = 0;
    let spent = 0;
    for (const t of baseData.transactions) {
      if (t.date < from || t.date > today || t.receivableId) continue;
      if (t.type === "income") income += t.amount;
      if (t.type === "expense") spent += t.amount;
    }
    return { income, spent };
  }, [baseData.transactions, granularity, today]);

  const periodLabel = granularity === "daily" ? "30 days" : granularity === "monthly" ? "12 months" : "5 years";

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        label="Trend period"
        size="sm"
        value={granularity}
        onChange={setGranularity}
        options={[
          { value: "daily", label: "Daily" },
          { value: "monthly", label: "Monthly" },
          { value: "annually", label: "Annually" },
        ]}
        className="max-w-sm"
      />
      <Card className="overflow-hidden">
        <div className="hero-surface p-5">
          <p className="text-eyebrow font-bold tracking-[0.12em] text-hero-ink-2 uppercase">Net worth</p>
          <p className="mt-1 text-[2.25rem] leading-none font-extrabold tracking-tight">
            <Money value={last} animate />
          </p>
          <p className={cn("mt-2 inline-flex items-center gap-1 text-callout font-semibold", change >= 0 ? "text-[#8fe3c2]" : "text-[#ffb4a6]")}>
            {change >= 0 ? <ArrowUpRight className="size-4" aria-hidden /> : <ArrowDownRight className="size-4" aria-hidden />}
            <Money value={Math.abs(change)} /> {change >= 0 ? "up" : "down"} over {periodLabel}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-callout">
            <div>
              <p className="text-caption text-hero-ink-2">Income</p>
              <Money value={flow.income} className="font-bold" />
            </div>
            <div>
              <p className="text-caption text-hero-ink-2">Spent</p>
              <Money value={flow.spent} className="font-bold" />
            </div>
          </div>
        </div>
        <div className="p-5">
          <LineChart
            data={points}
            label={`Net worth over the last ${periodLabel}`}
            formatValue={(v) => fmt(v, { compact: Math.abs(v) >= 10_000_000 })}
            tickEvery={granularity === "daily" ? 7 : granularity === "monthly" ? 3 : 1}
          />
        </div>
      </Card>
      <p className="px-1 text-caption text-ink-3">Net worth = account balances minus credit and debts, recalculated from your records at the end of each period.</p>
      <StreakHeatmap />
    </div>
  );
}

/** Income vs spending, month by month. */
export function CashFlowTab() {
  const { baseData, state, today } = useFinance();
  const flow = useMemo(() => cashFlowHistory(baseData.transactions, state.accounts, baseData.goals, today, 6), [baseData.transactions, state.accounts, baseData.goals, today]);
  const max = Math.max(1, ...flow.flatMap((f) => [f.income, f.spent]));

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <SectionHeader
          title="Money in vs money out"
          action={
            <span className="flex gap-3 text-caption font-semibold text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-positive" aria-hidden /> In
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-accent" aria-hidden /> Out
              </span>
            </span>
          }
        />
        <div className="flex h-44 items-end gap-3" role="img" aria-label="Monthly income and spending for the last six months">
          {flow.map((f) => (
            <div key={f.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div className="flex h-full w-full items-end justify-center gap-1">
                <span className="w-1/2 max-w-5 rounded-t-md bg-positive transition-[height] duration-700" style={{ height: `${(f.income / max) * 100}%` }} />
                <span className="w-1/2 max-w-5 rounded-t-md bg-accent transition-[height] duration-700" style={{ height: `${(f.spent / max) * 100}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-ink-3">{f.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="divide-y divide-line/60">
        {[...flow].reverse().map((f) => (
          <div key={f.month} className="flex items-center gap-3 px-4 py-3">
            <span className="w-24 font-semibold">{monthName(f.month)}</span>
            <span className="flex-1 text-callout text-ink-3">
              <Money value={f.income} className="text-positive" /> in · <Money value={f.spent} /> out
            </span>
            <Money value={f.net} signed className={cn("font-bold", f.net >= 0 ? "text-positive" : "text-negative")} />
          </div>
        ))}
      </Card>
    </div>
  );
}

/** Where your balance is heading if things continue as they are. */
export function ProjectionTab() {
  const { baseData, state, today, fmt } = useFinance();
  const projection = useMemo(
    () => projectBalance({ today, startBalance: state.totals.totalBalance, transactions: baseData.transactions, recurring: baseData.recurring, bills: baseData.bills, months: 6 }),
    [today, state.totals.totalBalance, baseData.transactions, baseData.recurring, baseData.bills],
  );
  const series = [{ key: "now", label: "Now", value: state.totals.totalBalance }, ...projection.points.map((p) => ({ key: p.month, label: p.label, value: p.balance }))];
  const end = projection.points.at(-1)?.balance ?? state.totals.totalBalance;

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <p className="text-caption font-semibold text-ink-3">In 6 months, at this pace</p>
        <Money value={end} whole className={cn("text-[2rem] leading-tight font-extrabold tracking-tight", end < 0 && "text-negative")} />
        <p className="text-callout text-ink-2">
          {end >= state.totals.totalBalance ? "Your balance keeps growing" : "Your balance would shrink"} — <Money value={Math.abs(end - state.totals.totalBalance)} whole className="font-semibold" />{" "}
          {end >= state.totals.totalBalance ? "more" : "less"} than today.
        </p>
        <div className="mt-5">
          <LineChart data={series} projectedFrom={1} label="Projected total balance over the next six months" formatValue={(v) => fmt(v, { compact: Math.abs(v) >= 10_000_000, whole: true })} color="var(--accent)" />
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-callout">
          <thead className="border-b border-line text-caption text-ink-3">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Month</th>
              <th className="px-2 py-2.5 text-right font-semibold">In</th>
              <th className="px-2 py-2.5 text-right font-semibold">Bills & automations</th>
              <th className="px-2 py-2.5 text-right font-semibold">Everyday</th>
              <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {projection.points.map((p) => (
              <tr key={p.month} className="border-b border-line/50 last:border-0">
                <td className="px-4 py-2.5 font-semibold">{monthName(p.month, true)}</td>
                <td className="px-2 py-2.5 text-right">
                  <Money value={p.income} whole className="text-positive" />
                </td>
                <td className="px-2 py-2.5 text-right">
                  <Money value={p.scheduled} whole />
                </td>
                <td className="px-2 py-2.5 text-right">
                  <Money value={p.everyday} whole />
                </td>
                <td className="px-4 py-2.5 text-right font-bold">
                  <Money value={p.balance} whole />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="px-1 text-caption text-ink-3">
        An estimate, not a promise: scheduled income, bills and automations, plus everyday spending at your recent average of{" "}
        <Money value={projection.everydayAverage} whole /> a month. It updates as you log.
      </p>
    </div>
  );
}
