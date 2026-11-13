"use client";

import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import Link from "@/components/ui/app-link";
import { useState } from "react";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountStack } from "@/components/accounts/account-stack";
import { AccountDetailSheet, AccountFormSheet } from "@/components/accounts/account-sheets";
import { TransactionGroups } from "@/components/transactions/transaction-item";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, Money, ProgressBar, ProgressRing, SectionHeader } from "@/components/ui/display";
import { useFinance } from "@/hooks/use-finance";
import { monthName } from "@/lib/dates";
import { budgetTone, budgetStatusText } from "@/lib/finance/labels";
import { cn } from "@/lib/utils/cn";
import { useUI } from "@/stores/ui";
import type { Account } from "@/types/models";

/* ---------------------------------------------------------------- Your money */

export function AccountsWidget() {
  const { state } = useFinance();
  const [selected, setSelected] = useState<Account | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section aria-labelledby="money-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="money-title" className="text-eyebrow font-bold tracking-[0.09em] text-ink-3 uppercase">
            Your money
          </h2>
          <p className="mt-0.5 text-title-1 font-extrabold tracking-tight">
            <Money value={state.totals.totalBalance} animate />
          </p>
          {state.totals.owed > 0 ? (
            <p className="text-caption text-ink-3">
              <Money value={state.totals.owed} /> owed on credit
            </p>
          ) : null}
        </div>
        <Link href="/accounts/" className="press mb-1 rounded-full px-2 py-1 text-callout font-semibold text-brand hover:bg-brand-soft">
          All accounts
        </Link>
      </div>

      {/* A deck on phones — the whole wallet visible at once, tap a card to
          deal it forward. Desktop has the width for a plain grid. */}
      <div className="lg:hidden">
        <AccountStack
          accounts={state.activeAccounts.map((account) => ({ ...account, balance: state.balances.get(account.id) ?? 0 }))}
          onOpen={(account) => setSelected(account)}
          onAdd={() => setAdding(true)}
        />
      </div>

      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-3 xl:grid-cols-3" role="list">
        {state.activeAccounts.map((account) => (
          <div key={account.id} role="listitem" className="min-w-0">
            <AccountCard
              account={{ ...account, balance: state.balances.get(account.id) ?? 0 }}
              onClick={() => setSelected(account)}
              label={`${account.name}, open details`}
            />
          </div>
        ))}
        <div role="listitem" className="min-w-0">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="press flex aspect-[1.62] h-full w-full flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-line-strong text-callout font-semibold text-ink-2 hover:border-brand hover:text-brand"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-surface-2">
              <Plus className="size-5" aria-hidden />
            </span>
            Add account
          </button>
        </div>
      </div>

      <AccountDetailSheet account={selected} onOpenChange={(open) => !open && setSelected(null)} />
      <AccountFormSheet open={adding} onOpenChange={setAdding} />
    </section>
  );
}

/* ---------------------------------------------------------------- This month */

export function ThisMonthWidget() {
  const { state } = useFinance();
  const { thisMonth, lastMonthToDate } = state;
  const spendDiff = thisMonth.spent - lastMonthToDate.spent;
  const hasComparison = lastMonthToDate.spent > 0;
  const spentShare = thisMonth.income > 0 ? (thisMonth.spent / thisMonth.income) * 100 : 0;

  return (
    <Card as="section" aria-labelledby="month-title" className="p-5">
      <SectionHeader id="month-title" title={`This month · ${monthName(state.month)}`} href="/insights/" actionLabel="Insights" />
      <div className="grid grid-cols-3 gap-3">
        <MonthStat label="Income" value={thisMonth.income} tone="positive" />
        <MonthStat label="Spent" value={thisMonth.spent} />
        <MonthStat label="Saved" value={thisMonth.saved} tone="brand" />
      </div>
      {thisMonth.income > 0 ? (
        <div className="mt-4">
          <ProgressBar value={spentShare} tone={spentShare > 100 ? "negative" : spentShare > 85 ? "warning" : "brand"} label="Share of income spent" />
          <p className="mt-2 text-caption text-ink-3">
            {Math.round(spentShare)}% of this month&apos;s income spent
          </p>
        </div>
      ) : null}
      {hasComparison ? (
        <p className={cn("mt-3 flex items-center gap-1.5 rounded-xl px-3 py-2 text-callout font-medium", spendDiff <= 0 ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning")}>
          {spendDiff <= 0 ? <ArrowDownRight className="size-4 shrink-0" aria-hidden /> : <ArrowUpRight className="size-4 shrink-0" aria-hidden />}
          <span>
            <Money value={Math.abs(spendDiff)} className="font-bold" /> {spendDiff <= 0 ? "less" : "more"} than this time last month
          </span>
        </p>
      ) : null}
    </Card>
  );
}

function MonthStat({ label, value, tone }: { label: string; value: number; tone?: "positive" | "brand" }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-caption font-semibold text-ink-3">
        <span className={cn("size-2 rounded-full", tone === "positive" ? "bg-positive" : tone === "brand" ? "bg-accent" : "bg-ink-3")} aria-hidden />
        {label}
      </p>
      <p className="mt-1 truncate text-title-3 font-bold sm:text-title-2">
        <Money value={value} compact={Math.abs(value) >= 100_000_000} />
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- Budgets */

export function BudgetsWidget() {
  const { state } = useFinance();
  const active = state.budgetProgress.filter((b) => !b.budget.paused).slice(0, 3);

  return (
    <Card as="section" aria-labelledby="budgets-title" className="p-5">
      <SectionHeader id="budgets-title" title="Budgets" href="/budgets/" />
      {active.length ? (
        <ul className="flex flex-col gap-4">
          {active.map((b) => (
            <li key={b.budget.id}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[18px]" aria-hidden>{b.category?.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-callout font-semibold">{b.category?.name}</span>
                <span className="text-caption text-ink-3">
                  <Money value={b.spent} className="font-semibold text-ink" /> / <Money value={b.budget.amount} />
                </span>
              </div>
              <ProgressBar value={b.percent} tone={budgetTone(b.status)} marker={b.monthElapsed} label={`${b.category?.name} budget used`} />
              <p className={cn("mt-1 text-caption", b.status === "over" ? "font-semibold text-negative" : b.status === "near" || b.status === "watch" ? "text-warning" : "text-ink-3")}>
                {budgetStatusText(b)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-2 text-center">
          <p className="text-callout text-ink-2">Budgets help you notice overspending early.</p>
          <ButtonLink href="/budgets/?new=1" variant="secondary" size="sm" className="mt-3">
            <Plus />
            Set a budget
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- Goals */

export function GoalsWidget() {
  const { state } = useFinance();
  const goals = state.goalProgress.filter((g) => g.pace !== "complete").slice(0, 2);

  return (
    <Card as="section" aria-labelledby="goals-title" className="p-5">
      <SectionHeader id="goals-title" title="Savings goals" href="/goals/" />
      {goals.length ? (
        <ul className="flex flex-col gap-3">
          {goals.map((g) => (
            <li key={g.goal.id}>
              <Link href="/goals/" className="press -mx-1 flex items-center gap-3 rounded-2xl p-1 hover:bg-surface-2/60">
                <ProgressRing value={g.percent} size={52} stroke={5} color={g.goal.color} label={`${Math.round(g.percent)}% saved`}>
                  <span className="text-[20px]" aria-hidden>{g.goal.emoji}</span>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold">{g.goal.name}</p>
                  <p className="text-caption text-ink-3">
                    <Money value={g.saved} className="font-semibold text-ink" /> of <Money value={g.goal.targetAmount} />
                  </p>
                </div>
                <span className="text-callout font-bold text-ink-2">{Math.round(g.percent)}%</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-2 text-center">
          <p className="text-callout text-ink-2">What&apos;s something you&apos;re saving for?</p>
          <ButtonLink href="/goals/?new=1" variant="secondary" size="sm" className="mt-3">
            <Plus />
            Create a goal
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- Recent */

export function RecentWidget() {
  const { state } = useFinance();
  const openAdd = useUI((s) => s.openAddTransaction);

  return (
    <Card as="section" aria-labelledby="recent-title" className="p-5 pb-3">
      <SectionHeader id="recent-title" title="Recent" href="/transactions/" />
      {state.transactions.length ? (
        <div className="-mx-2">
          <TransactionGroups transactions={state.transactions} limit={6} />
        </div>
      ) : (
        <EmptyState
          compact
          mood="sleeping"
          title="Nothing here yet"
          description="Add your first expense and I'll start helping you understand your spending."
          action={
            <Button size="sm" onClick={() => openAdd()}>
              <Plus />
              Add expense
            </Button>
          }
        />
      )}
    </Card>
  );
}
