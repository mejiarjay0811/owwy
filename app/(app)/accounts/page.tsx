"use client";

import { Archive, ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown, Ellipsis, Eye, Minus, Pencil, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountDetailSheet, AccountFormSheet } from "@/components/accounts/account-sheets";
import { Page, PageHeader } from "@/components/layout/page";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Button, IconButton } from "@/components/ui/button";
import { Card, EmptyState, Money } from "@/components/ui/display";
import { Chip, Segmented } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { useFinance } from "@/hooks/use-finance";
import { addDays } from "@/lib/dates";
import { ACCOUNT_TYPES, getCardStyle } from "@/lib/defaults/card-styles";
import { netWorthHistory } from "@/lib/finance/trends";
import { reorderAccounts, setAccountArchived } from "@/lib/storage/repositories/accounts";
import { cn } from "@/lib/utils/cn";
import { readLocal, writeLocal } from "@/lib/utils/local";
import { toast, useUI } from "@/stores/ui";
import type { Account, AccountType } from "@/types/models";

export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsScreen />
    </Suspense>
  );
}

type Filter = "all" | "everyday" | "savings" | "credit";

const FILTER_TYPES: Record<Exclude<Filter, "all">, AccountType[]> = {
  everyday: ["bank", "cash", "ewallet", "other"],
  savings: ["savings", "emergency", "investment"],
  credit: ["credit"],
};

const FILTER_LABELS: Record<Filter, string> = { all: "All", everyday: "Everyday", savings: "Savings", credit: "Credit" };

function AccountsScreen() {
  const { state, settings } = useFinance();
  const params = useSearchParams();
  const openAdd = useUI((s) => s.openAddTransaction);
  // The screen only renders on the client (after local data loads), so reading these up front is safe.
  const [adding, setAdding] = useState(() => Boolean(params.get("new")));
  const [selected, setSelected] = useState<Account | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"cards" | "list">(() => (readLocal(VIEW_KEY) === "list" ? "list" : "cards"));

  const changeView = (next: "cards" | "list") => {
    setView(next);
    writeLocal(VIEW_KEY, next);
  };

  const archived = state.accounts.filter((a) => a.archived);
  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: state.activeAccounts.length, everyday: 0, savings: 0, credit: 0 };
    for (const a of state.activeAccounts) {
      for (const key of ["everyday", "savings", "credit"] as const) if (FILTER_TYPES[key].includes(a.type)) result[key]++;
    }
    return result;
  }, [state.activeAccounts]);
  const visible = filter === "all" ? state.activeAccounts : state.activeAccounts.filter((a) => FILTER_TYPES[filter].includes(a.type));

  const menuFor = (account: Account) => (
    <Menu
      label={`${account.name} actions`}
      tone="glass"
      items={[
        { label: "Add expense", icon: <Minus />, onSelect: () => openAdd({ type: "expense", accountId: account.id }) },
        { label: "Add income", icon: <Plus />, onSelect: () => openAdd({ type: "income", accountId: account.id }) },
        { label: "Transfer", icon: <ArrowLeftRight />, onSelect: () => openAdd({ type: "transfer", accountId: account.id }) },
        { label: "View details", icon: <Eye />, onSelect: () => setSelected(account) },
        { label: "Edit card", icon: <Pencil />, onSelect: () => setEditing(account) },
        {
          label: "Archive",
          icon: <Archive />,
          destructive: true,
          onSelect: async () => {
            await setAccountArchived(account.id, true);
            toast.show(`${account.name} archived`, { description: "Its history stays in your reports.", action: { label: "Undo", onClick: () => setAccountArchived(account.id, false) } });
          },
        },
      ]}
    >
      <Ellipsis />
    </Menu>
  );

  return (
    <Page width="wide">
      <PageHeader
        title="Wallet"
        subtitle="Every place your money lives, as cards."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus />
            Account
          </Button>
        }
      />

      {state.activeAccounts.length === 0 ? (
        <Card>
          <EmptyState
            mood="encouraging"
            title="No accounts yet"
            description="Add cash, a bank account, an e-wallet or a credit card. Owwy never connects to your bank — you stay in control."
            action={
              <Button onClick={() => setAdding(true)}>
                <Plus />
                Add account
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <WalletHero />
            <WalletInsight />

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filter accounts">
                {(Object.keys(FILTER_LABELS) as Filter[])
                  .filter((f) => f === "all" || counts[f] > 0)
                  .map((f) => (
                    <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
                      {FILTER_LABELS[f]}
                      <span className="opacity-60">{counts[f]}</span>
                    </Chip>
                  ))}
              </div>
              <Segmented
                className="w-[168px]"
                size="sm"
                label="Account view"
                value={view}
                onChange={changeView}
                options={[
                  { value: "cards", label: "Cards" },
                  { value: "list", label: "List" },
                ]}
              />
            </div>

            {view === "cards" ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {visible.map((account) => (
                  // min-w-0: without it the grid item keeps the card's
                  // min-content width and the row runs off a 320px screen.
                  <li key={account.id} className="min-w-0">
                    <AccountCard account={{ ...account, balance: state.balances.get(account.id) ?? 0 }} onClick={() => setSelected(account)} label={`${account.name}, open details`} menu={menuFor(account)} />
                  </li>
                ))}
              </ul>
            ) : (
              <AccountList accounts={visible} onSelect={setSelected} canReorder={filter === "all"} />
            )}

            {archived.length ? (
              <div className="mt-6">
                <button type="button" onClick={() => setShowArchived((v) => !v)} className="inline-flex items-center gap-1 text-callout font-semibold text-ink-2" aria-expanded={showArchived}>
                  Archived ({archived.length})
                  <ChevronDown className={cn("size-4 transition-transform", showArchived && "rotate-180")} aria-hidden />
                </button>
                {showArchived ? (
                  <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                    {archived.map((account) => (
                      <li key={account.id} className="min-w-0">
                        <AccountCard account={{ ...account, balance: state.balances.get(account.id) ?? 0 }} onClick={() => setSelected(account)} label={`${account.name} (archived)`} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          {settings.showNetWorth ? (
            <div className="lg:col-span-4">
              <NetWorthBreakdown />
            </div>
          ) : null}
        </div>
      )}

      <AccountFormSheet open={adding} onOpenChange={setAdding} />
      <AccountFormSheet open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} account={editing ?? undefined} />
      <AccountDetailSheet account={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </Page>
  );
}

const VIEW_KEY = "owwy-accounts-view";

function useNetWorthChange() {
  const { state, data, today } = useFinance();
  return useMemo(() => {
    const [before, now] = netWorthHistory(
      state.accounts,
      data.transactions,
      data.debts,
      [
        { key: "before", label: "30 days ago", date: addDays(today, -30) },
        { key: "now", label: "Today", date: today },
      ],
      state.fx,
    );
    const change = now.value - before.value;
    const percent = before.value !== 0 ? (change / Math.abs(before.value)) * 100 : null;
    return { change, percent };
  }, [state.accounts, state.fx, data.transactions, data.debts, today]);
}

function WalletHero() {
  const { state, settings } = useFinance();
  const { change, percent } = useNetWorthChange();
  const showWorth = settings.showNetWorth;
  const up = change >= 0;

  return (
    <section aria-label="Wallet summary" className="relative mb-4 overflow-hidden rounded-[28px] bg-brand p-5 text-brand-ink shadow-[0_18px_40px_-22px_rgb(20_70_63/0.8)] sm:p-6">
      <svg className="pointer-events-none absolute -top-10 -right-12 size-56 opacity-[0.12]" viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="18" />
        <circle cx="100" cy="100" r="46" fill="none" stroke="currentColor" strokeWidth="10" />
      </svg>
      <p className="text-eyebrow font-bold tracking-[0.09em] uppercase opacity-75">{showWorth ? "Net worth" : "Total balance"}</p>
      <p className="mt-1 text-[2.25rem] leading-tight font-extrabold tracking-tight sm:text-[2.625rem]">
        <Money value={showWorth ? state.netWorth.netWorth : state.totals.totalBalance} animate />
      </p>
      {showWorth ? (
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-caption font-bold">
          {up ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
          <Money value={change} signed />
          {percent !== null && Math.abs(percent) >= 0.1 ? <span className="opacity-80">({up ? "+" : "−"}{Math.abs(percent).toFixed(1)}%)</span> : null}
          <span className="font-semibold opacity-75">· 30 days</span>
        </p>
      ) : null}

      <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4">
        <HeroStat label="Spendable" value={state.totals.spendable} />
        <HeroStat label="Savings" value={state.totals.savings} />
        <HeroStat label="Owed" value={state.totals.owed} />
      </dl>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption font-semibold opacity-70">{label}</dt>
      <dd className="truncate text-callout font-bold sm:text-body">
        <Money value={value} compact={value >= 1_000_000_00} />
      </dd>
    </div>
  );
}

/** One friendly observation about the wallet, picked by what matters most. */
function WalletInsight() {
  const { state, fmt } = useFinance();
  const { change } = useNetWorthChange();

  const insight = useMemo(() => {
    const cards = state.activeAccounts
      .filter((a) => a.type === "credit" && a.creditLimit)
      .map((a) => ({ account: a, usage: (Math.max(0, -(state.balances.get(a.id) ?? 0)) / (a.creditLimit ?? 1)) * 100 }))
      .sort((a, b) => b.usage - a.usage);
    const busiest = cards[0];
    if (busiest && busiest.usage >= 50) {
      return { mood: "concerned" as const, text: `${busiest.account.name} is ${Math.round(busiest.usage)}% used. Paying it below 30% keeps interest and stress low.` };
    }
    if (state.stillToCollect > 0) {
      return { mood: "thinking" as const, text: `${fmt(state.stillToCollect)} is still owed to you — it's counted in your net worth until it comes back.` };
    }
    if (change > 0) return { mood: "celebrating" as const, text: `You're ${fmt(change)} better off than 30 days ago. Nicely done!` };
    if (change < 0) return { mood: "encouraging" as const, text: `Down ${fmt(-change)} from 30 days ago. A quick look at Stats shows where it went.` };
    const places = state.activeAccounts.length;
    return { mood: "happy" as const, text: `Your money lives in ${places} ${places === 1 ? "place" : "places"}. Tap a card to see its story.` };
  }, [state.activeAccounts, state.balances, state.stillToCollect, change, fmt]);

  return (
    <div className="mb-5 flex items-center gap-3 rounded-[22px] border border-line/70 bg-surface p-3 pr-4 shadow-xs">
      <OwwyMascot mood={insight.mood} size={44} />
      <p className="min-w-0 flex-1 text-callout text-ink-2">{insight.text}</p>
    </div>
  );
}

const GROUPS: { title: string; types: AccountType[] }[] = [
  { title: "Everyday", types: ["bank", "cash", "other"] },
  { title: "Top-up & e-wallets", types: ["ewallet"] },
  { title: "Savings", types: ["savings", "emergency"] },
  { title: "Investments", types: ["investment"] },
  { title: "Credit", types: ["credit"] },
];

/** Compact list grouped by kind, with each card's color as an accent. Reorder mode moves accounts up and down. */
function AccountList({ accounts: shown, onSelect, canReorder }: { accounts: Account[]; onSelect: (account: Account) => void; canReorder: boolean }) {
  const { state } = useFinance();
  const [reordering, setReordering] = useState(false);
  const active = state.activeAccounts;

  const move = async (account: Account, delta: number) => {
    const ids = active.map((a) => a.id);
    const index = ids.indexOf(account.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await reorderAccounts(ids);
    } catch (e) {
      toast.error(e);
    }
  };

  if (reordering) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-callout text-ink-2">Move accounts to set their order everywhere.</p>
          <Button size="sm" onClick={() => setReordering(false)}>
            Done
          </Button>
        </div>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line/60">
            {active.map((account, index) => (
              <li key={account.id} className="flex items-center gap-3 py-2 pr-2 pl-3">
                <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: getCardStyle(account.cardStyle).background }} aria-hidden />
                <span className="text-[20px]" aria-hidden>
                  {ACCOUNT_TYPES[account.type].emoji}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{account.name}</span>
                <IconButton size="sm" label={`Move ${account.name} up`} disabled={index === 0} onClick={() => void move(account, -1)}>
                  <ArrowUp />
                </IconButton>
                <IconButton size="sm" label={`Move ${account.name} down`} disabled={index === active.length - 1} onClick={() => void move(account, 1)}>
                  <ArrowDown />
                </IconButton>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => {
        const accounts = shown.filter((a) => group.types.includes(a.type));
        if (!accounts.length) return null;
        const total = accounts.reduce((t, a) => t + (state.baseBalances.get(a.id) ?? 0), 0);
        return (
          <section key={group.title} aria-label={group.title}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="font-display text-[1.125rem]">{group.title}</h2>
              <Money value={group.types.includes("credit") ? Math.max(0, -total) : total} className="text-callout font-semibold text-ink-3" />
            </div>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line/60">
                {accounts.map((account) => {
                  const balance = state.balances.get(account.id) ?? 0;
                  const liability = ACCOUNT_TYPES[account.type].liability;
                  return (
                    <li key={account.id}>
                      <button type="button" onClick={() => onSelect(account)} className="press flex w-full items-center gap-3 py-3.5 pr-4 pl-3 text-left hover:bg-surface-2/60">
                        <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: getCardStyle(account.cardStyle).background }} aria-hidden />
                        <span className="text-[20px]" aria-hidden>
                          {ACCOUNT_TYPES[account.type].emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{account.name}</span>
                          <span className="block truncate text-caption text-ink-3">
                            {account.currency ? `${account.currency} · ` : ""}
                            {account.interestRate
                              ? `${account.interestRate}% a year${account.interestTaxRate ? ` · after ${account.interestTaxRate}% tax` : ""}`
                              : liability && account.dueDay
                                ? `Due day ${account.dueDay}`
                                : account.last4
                                  ? `•••• ${account.last4}`
                                  : ACCOUNT_TYPES[account.type].label}
                          </span>
                        </span>
                        <Money value={liability ? Math.max(0, -balance) : balance} currency={account.currency} className={cn("font-bold", liability && "text-negative")} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        );
      })}
      {canReorder && state.activeAccounts.length > 1 ? (
        <Button variant="ghost" size="sm" className="self-center" onClick={() => setReordering(true)}>
          <ArrowDown />
          Reorder accounts
        </Button>
      ) : null}
    </div>
  );
}

function NetWorthBreakdown() {
  const { state } = useFinance();
  const { netWorth } = state;
  return (
    <Card className="p-5 lg:sticky lg:top-8">
      <p className="text-eyebrow font-bold tracking-[0.09em] text-ink-3 uppercase">What makes up your net worth</p>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span className="bg-positive" style={{ width: `${(netWorth.totalAssets / Math.max(1, netWorth.totalAssets + netWorth.totalLiabilities)) * 100}%` }} />
        <span className="bg-negative/70" style={{ width: `${(netWorth.totalLiabilities / Math.max(1, netWorth.totalAssets + netWorth.totalLiabilities)) * 100}%` }} />
      </div>
      <WorthList title="You own" total={netWorth.totalAssets} entries={netWorth.assets} tone="positive" />
      <WorthList title="You owe" total={netWorth.totalLiabilities} entries={netWorth.liabilities} tone="negative" />
    </Card>
  );
}

function WorthList({ title, total, entries, tone }: { title: string; total: number; entries: { id: string; label: string; emoji: string; amount: number }[]; tone: "positive" | "negative" }) {
  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-callout font-bold">
          <span className={cn("size-2 rounded-full", tone === "positive" ? "bg-positive" : "bg-negative/70")} aria-hidden />
          {title}
        </p>
        <Money value={total} className="text-callout font-bold" />
      </div>
      {entries.length ? (
        <ul className="flex flex-col">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 py-1 text-callout text-ink-2">
              <span aria-hidden>{e.emoji}</span>
              <span className="flex-1 truncate">{e.label}</span>
              <Money value={e.amount} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-ink-3">Nothing here.</p>
      )}
    </div>
  );
}
