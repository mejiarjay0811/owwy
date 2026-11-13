"use client";

import { Plus, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Page, PageHeader } from "@/components/layout/page";
import { TransactionGroups } from "@/components/transactions/transaction-item";
import { Button, IconButton } from "@/components/ui/button";
import { Card, EmptyState, Money } from "@/components/ui/display";
import { Chip, Segmented } from "@/components/ui/form";
import { useFinance } from "@/hooks/use-finance";
import { filterTransactions, parseSearchQuery } from "@/lib/finance/search";
import { useUI } from "@/stores/ui";
import type { TransactionType } from "@/types/models";

const SUGGESTIONS = ["this week", "last month", "food over 500", "income", "transport", "#work"];
const PAGE_SIZE = 80;

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsScreen />
    </Suspense>
  );
}

function TransactionsScreen() {
  const { state, currency, fmt, today } = useFinance();
  const params = useSearchParams();
  const openAdd = useUI((s) => s.openAddTransaction);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (params.get("search")) inputRef.current?.focus();
  }, [params]);

  const filters = useMemo(
    () => parseSearchQuery(deferredQuery, { categories: state.categories, accounts: state.accounts, today, currency }),
    [deferredQuery, state.categories, state.accounts, today, currency],
  );

  const results = useMemo(() => {
    const effective = type === "all" ? filters : { ...filters, types: [...new Set([...filters.types, type])] };
    return filterTransactions(state.transactions, effective, { categoriesById: state.categoriesById, accountsById: state.accountsById });
  }, [filters, type, state.transactions, state.categoriesById, state.accountsById]);

  const totals = useMemo(() => {
    let spent = 0;
    let income = 0;
    for (const t of results) {
      if (t.type === "expense") spent += t.amount;
      if (t.type === "income") income += t.amount;
    }
    return { spent, income };
  }, [results]);

  const searching = deferredQuery.trim().length > 0 || type !== "all";

  return (
    <Page>
      <PageHeader
        title="Log"
        subtitle="Everything you've spent, received and moved."
        actions={
          <Button size="sm" onClick={() => openAdd()}>
            <Plus />
            Add
          </Button>
        }
      />

      <div className="sticky top-[calc(var(--safe-top)+64px)] z-20 -mx-4 bg-bg/90 px-4 pb-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 shadow-xs focus-within:border-brand">
          <Search className="size-5 shrink-0 text-ink-3" aria-hidden />
          <span className="sr-only">Search transactions</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="coffee, food over 500, last month…"
            className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
            enterKeyHint="search"
          />
          {query ? (
            <IconButton label="Clear search" size="sm" onClick={() => setQuery("")}>
              <X />
            </IconButton>
          ) : null}
        </label>
        <Segmented
          className="mt-3"
          size="sm"
          label="Filter by type"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All" },
            { value: "expense", label: "Spent" },
            { value: "income", label: "Income" },
            { value: "transfer", label: "Transfers" },
          ]}
        />
      </div>

      {!deferredQuery ? (
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
          {SUGGESTIONS.map((s) => (
            <Chip key={s} onClick={() => setQuery(s)} className="h-8">
              {s}
            </Chip>
          ))}
        </div>
      ) : filters.chips.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-live="polite">
          <span className="text-caption font-semibold text-ink-3">Showing</span>
          {filters.chips.map((chip, i) => (
            <span key={i} className="inline-flex h-7 items-center rounded-full bg-brand-soft px-2.5 text-caption font-semibold text-brand-soft-ink">
              {chip.kind === "amount"
                ? filters.minAmount !== undefined && filters.maxAmount !== undefined
                  ? `${fmt(filters.minAmount)}–${fmt(filters.maxAmount)}`
                  : filters.minAmount !== undefined
                    ? `Over ${fmt(filters.minAmount)}`
                    : `Under ${fmt(filters.maxAmount ?? 0)}`
                : chip.label}
            </span>
          ))}
        </div>
      ) : null}

      {state.transactions.length === 0 ? (
        <EmptyState
          mood="sleeping"
          title="Nothing here yet"
          description="Add your first expense and Owwy will start helping you understand your spending."
          action={
            <Button onClick={() => openAdd()}>
              <Plus />
              Add expense
            </Button>
          }
        />
      ) : results.length === 0 ? (
        <EmptyState mood="thinking" title="No matches" description={`Nothing found for “${deferredQuery}”. Try a category, a month, or an amount like “over 500”.`} compact />
      ) : (
        <>
          {searching ? (
            <Card className="mb-4 flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-callout font-semibold text-ink-2">
                {results.length} {results.length === 1 ? "transaction" : "transactions"}
              </span>
              <span className="flex gap-3 text-callout">
                {totals.spent > 0 ? (
                  <span>
                    Spent <Money value={totals.spent} className="font-bold" />
                  </span>
                ) : null}
                {totals.income > 0 ? (
                  <span>
                    In <Money value={totals.income} className="font-bold text-positive" />
                  </span>
                ) : null}
              </span>
            </Card>
          ) : null}
          <div className="-mx-2">
            <TransactionGroups transactions={results.slice(0, limit)} />
          </div>
          {results.length > limit ? (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Show more ({results.length - limit} left)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Page>
  );
}
