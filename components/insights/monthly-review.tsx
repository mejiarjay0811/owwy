"use client";

import { ArrowDownRight, ArrowUpRight, Printer } from "lucide-react";
import { useEffect, useMemo } from "react";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmojiTile, Money, ProgressBar } from "@/components/ui/display";
import { useFinance } from "@/hooks/use-finance";
import { formatShortDate, monthName } from "@/lib/dates";
import { buildMonthlyReview, type MonthlyReview } from "@/lib/finance/review";
import { markReviewSeen } from "@/lib/services/snapshots";
import { cn } from "@/lib/utils/cn";
import type { MonthKey } from "@/types/models";

export function useMonthlyReview(month: MonthKey): MonthlyReview {
  const { baseData: data, today, fmt } = useFinance();
  return useMemo(() => buildMonthlyReview(data, month, today, (v) => fmt(v)), [data, month, today, fmt]);
}

export function MonthlyReviewView({ month, printable = false }: { month: MonthKey; printable?: boolean }) {
  const { data, today } = useFinance();
  const review = useMonthlyReview(month);
  const snapshot = data.snapshots.find((s) => s.id === month);

  useEffect(() => {
    if (snapshot && !snapshot.seen && !printable) void markReviewSeen(month);
  }, [snapshot, month, printable]);

  const { current, previous } = review;

  return (
    <div className="flex flex-col gap-5">
      <Card className={cn("relative overflow-hidden p-6 text-center", !printable && "hero-surface border-0")}>
        <OwwyMascot mood={review.mood} size={104} animated={!printable} className="mx-auto" />
        <p className={cn("mt-3 text-eyebrow font-bold tracking-[0.14em] uppercase", printable ? "text-ink-3" : "text-hero-ink-2")}>{review.label} 🦉</p>
        <h2 className="mt-2 text-title-1 font-extrabold tracking-tight text-balance">{review.headline}</h2>
        <p className={cn("mx-auto mt-2 max-w-md text-body", printable ? "text-ink-2" : "text-hero-ink-2")}>{review.message}</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReviewStat label="Income" value={current.income} previous={previous.income} goodWhenUp />
        <ReviewStat label="Spent" value={current.spent} previous={previous.spent} />
        <ReviewStat label="Saved" value={current.saved} previous={previous.saved} goodWhenUp />
        <Card className="p-4">
          <p className="text-caption font-semibold text-ink-3">Savings rate</p>
          <p className="mt-1 text-title-2 font-extrabold">{review.savingsRate.toFixed(0)}%</p>
          <p className="text-caption text-ink-3">{previous.income > 0 ? `${review.previousSavingsRate.toFixed(0)}% last month` : "of income"}</p>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-title-3 font-bold">Where it went</h3>
          {review.topCategories.length ? (
            <ul className="flex flex-col gap-3">
              {review.topCategories.map((c) => (
                <li key={c.categoryId}>
                  <div className="mb-1 flex items-center gap-2 text-callout">
                    <span aria-hidden>{c.category?.emoji}</span>
                    <span className="flex-1 font-semibold">{c.category?.name ?? "Other"}</span>
                    <Money value={c.current} className="font-bold" />
                  </div>
                  <ProgressBar value={c.share} tone="custom" color={c.category?.color ?? "var(--ink-3)"} label={`${c.category?.name}: ${Math.round(c.share)}% of spending`} height="h-1.5" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-callout text-ink-3">No spending recorded.</p>
          )}
        </Card>

        <div className="flex flex-col gap-3">
          {review.bestCategory?.category ? (
            <Highlight emoji={review.bestCategory.category.emoji} color={review.bestCategory.category.color} title="Best category" tone="positive">
              {review.bestCategory.category.name} <ArrowDownRight className="inline size-4" aria-label="down" /> {Math.abs(Math.round(review.bestCategory.change ?? 0))}% ·{" "}
              <Money value={-review.bestCategory.diff} /> less
            </Highlight>
          ) : null}
          {review.highestIncrease?.category ? (
            <Highlight emoji={review.highestIncrease.category.emoji} color={review.highestIncrease.category.color} title="Highest increase" tone="attention">
              {review.highestIncrease.category.name} <ArrowUpRight className="inline size-4" aria-label="up" /> {Math.round(review.highestIncrease.change ?? 0)}% ·{" "}
              <Money value={review.highestIncrease.diff} /> more
            </Highlight>
          ) : null}
          {review.budgets.total ? (
            <Highlight emoji="🎯" title="Budgets" tone={review.budgets.over ? "attention" : "positive"}>
              {review.budgets.within} of {review.budgets.total} stayed within budget
            </Highlight>
          ) : null}
          {review.noSpendDays > 0 ? (
            <Highlight emoji="✨" title="No-spend days" tone="positive">
              {review.noSpendDays} day{review.noSpendDays > 1 ? "s" : ""} without spending
            </Highlight>
          ) : null}
          {review.biggestExpense ? (
            <Highlight emoji="🧾" title="Biggest expense" tone="neutral">
              {review.biggestExpense.note || "Expense"} · <Money value={review.biggestExpense.amount} /> on {formatShortDate(review.biggestExpense.date, today)}
            </Highlight>
          ) : null}
        </div>
      </div>

      {review.goals.length ? (
        <Card className="p-5">
          <h3 className="mb-3 text-title-3 font-bold">Goal progress in {monthName(month)}</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {review.goals.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <span className="text-[24px]" aria-hidden>{g.emoji}</span>
                <span className="flex-1 font-semibold">{g.name}</span>
                <Money value={g.contributed} signed className={cn("font-bold", g.contributed > 0 ? "text-positive" : "text-warning")} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {!printable ? (
        <div className="no-print flex justify-center">
          <ButtonLink href={`/report/?month=${month}`} variant="secondary">
            <Printer />
            Print or save as PDF
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

function ReviewStat({ label, value, previous, goodWhenUp }: { label: string; value: number; previous: number; goodWhenUp?: boolean }) {
  const diff = value - previous;
  const good = goodWhenUp ? diff >= 0 : diff <= 0;
  return (
    <Card className="p-4">
      <p className="text-caption font-semibold text-ink-3">{label}</p>
      <p className="mt-1 truncate text-title-2 font-extrabold">
        <Money value={value} />
      </p>
      {previous !== 0 || value !== 0 ? (
        <p className={cn("text-caption font-semibold", diff === 0 ? "text-ink-3" : good ? "text-positive" : "text-warning")}>
          {diff === 0 ? "Same as last month" : (
            <>
              <Money value={Math.abs(diff)} /> {diff > 0 ? "more" : "less"}
            </>
          )}
        </p>
      ) : null}
    </Card>
  );
}

function Highlight({ emoji, color, title, tone, children }: { emoji: string; color?: string; title: string; tone: "positive" | "attention" | "neutral"; children: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <EmojiTile emoji={emoji} color={color} />
      <div className="min-w-0">
        <p className={cn("text-caption font-bold", tone === "positive" ? "text-positive" : tone === "attention" ? "text-warning" : "text-ink-3")}>{title}</p>
        <p className="text-callout font-semibold">{children}</p>
      </div>
    </Card>
  );
}
