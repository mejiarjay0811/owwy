"use client";

import { ArrowLeftRight, Repeat } from "lucide-react";
import { EmojiTile, Money } from "@/components/ui/display";
import { useFinance } from "@/hooks/use-finance";
import { formatDayHeading } from "@/lib/dates";
import { accountCurrency, toBase } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { useUI } from "@/stores/ui";
import type { ISODate, Transaction } from "@/types/models";

export function TransactionItem({ transaction: tx, showDate = false, className }: { transaction: Transaction; showDate?: boolean; className?: string }) {
  const { state, data } = useFinance();
  const openEdit = useUI((s) => s.openEditTransaction);
  const category = tx.categoryId ? state.categoriesById.get(tx.categoryId) : undefined;
  const account = state.accountsById.get(tx.accountId);
  const toAccount = tx.toAccountId ? state.accountsById.get(tx.toAccountId) : undefined;
  const goal = tx.goalId ? data.goals.find((g) => g.id === tx.goalId) : undefined;
  const currency = accountCurrency(account, state.fx);

  const title = tx.note || category?.name || (tx.type === "transfer" ? "Transfer" : "Transaction");
  const subtitleParts =
    tx.type === "transfer"
      ? [`${account?.name ?? "Deleted account"} → ${toAccount?.name ?? "Deleted account"}`]
      : [category && tx.note ? category.name : null, account?.name ?? "Deleted account"];
  if (showDate) subtitleParts.unshift(formatDayHeading(tx.date, state.today));

  return (
    <button
      type="button"
      onClick={() => openEdit(tx)}
      className={cn("press group flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left outline-none hover:bg-surface-2/70", className)}
    >
      {tx.type === "transfer" ? (
        goal ? (
          <EmojiTile emoji={goal.emoji} color={goal.color} />
        ) : (
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-surface-2 text-ink-2" aria-hidden>
            <ArrowLeftRight className="size-5" />
          </span>
        )
      ) : (
        <EmojiTile emoji={category?.emoji ?? "🧾"} color={category?.color} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-body font-semibold text-ink">{title}</span>
          {tx.recurringId ? <Repeat className="size-3.5 shrink-0 text-ink-3" aria-label="Recurring" /> : null}
        </span>
        <span className="block truncate text-caption text-ink-3">
          {subtitleParts.filter(Boolean).join(" · ")}
          {tx.tags.length ? <span className="text-ink-3"> · {tx.tags.map((t) => `#${t}`).join(" ")}</span> : null}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {tx.type === "income" ? (
          <Money value={tx.amount} currency={currency} signed className={cn("text-body font-bold", tx.receivableId ? "text-ink-2" : "text-positive")} />
        ) : tx.type === "expense" ? (
          <Money value={-tx.amount} currency={currency} className={cn("text-body font-bold", tx.receivableId ? "text-ink-2" : "text-ink")} />
        ) : (
          <Money value={tx.amount} currency={currency} className="text-body font-semibold text-ink-2" />
        )}
        {tx.receivableId ? <span className="block text-[10px] font-semibold text-ink-3">{tx.type === "income" ? "Collected" : "Lent"}</span> : null}
      </span>
    </button>
  );
}

export function TransactionGroups({ transactions, limit }: { transactions: Transaction[]; limit?: number }) {
  const { state } = useFinance();
  const items = limit ? transactions.slice(0, limit) : transactions;
  const groups = new Map<ISODate, Transaction[]>();
  for (const tx of items) {
    const list = groups.get(tx.date);
    if (list) list.push(tx);
    else groups.set(tx.date, [tx]);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([date, list]) => {
        const spent = list
          .filter((t) => t.type === "expense" && !t.receivableId)
          .reduce((s, t) => s + toBase(t.amount, accountCurrency(state.accountsById.get(t.accountId), state.fx), state.fx), 0);
        return (
          <section key={date} aria-label={formatDayHeading(date, state.today)}>
            <div className="mb-1 flex items-baseline justify-between px-2">
              {/* h2: these day groups sit directly under the page's h1. */}
              <h2 className="text-caption font-bold text-ink-3">{formatDayHeading(date, state.today)}</h2>
              {spent > 0 ? (
                <span className="text-caption font-semibold text-ink-3">
                  <Money value={-spent} />
                </span>
              ) : null}
            </div>
            <ul className="flex flex-col">
              {list.map((tx) => (
                <li key={tx.id}>
                  <TransactionItem transaction={tx} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
