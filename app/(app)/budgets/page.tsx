"use client";

import { Copy, Pause, Pencil, Play, Plus, Trash } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { MonthSwitcher, Page, PageHeader } from "@/components/layout/page";
import { Button, IconButton } from "@/components/ui/button";
import { Badge, Card, EmojiTile, EmptyState, Money, ProgressBar, ProgressRing } from "@/components/ui/display";
import { AmountInput, Field } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { addMonthKey, daysInMonth, formatMonth, monthName } from "@/lib/dates";
import { computeBudgetProgress, computeBudgetTotals, type BudgetProgress } from "@/lib/finance/budgets";
import { budgetStatusText, budgetTone } from "@/lib/finance/labels";
import { summarizeMonth } from "@/lib/finance/summary";
import { minorFactor, minorToInput, parseAmount } from "@/lib/money";
import { copyBudgetsFromPreviousMonth, deleteBudget, restoreBudget, setBudget, setBudgetPaused } from "@/lib/storage/repositories/budgets";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { Category, ID, MonthKey } from "@/types/models";

export default function BudgetsPage() {
  return (
    <Suspense>
      <BudgetsScreen />
    </Suspense>
  );
}

function BudgetsScreen() {
  const { state, baseData: data, today } = useFinance();
  const params = useSearchParams();
  const [month, setMonth] = useState<MonthKey>(state.month);
  const [editing, setEditing] = useState<{ categoryId?: ID } | null>(() => (params.get("new") ? {} : null));

  const summary = useMemo(() => summarizeMonth(data.transactions, data.accounts, data.goals, month), [data, month]);
  const progress = useMemo(() => computeBudgetProgress(data.budgets, state.categories, summary.byCategory, month, today), [data.budgets, state.categories, summary, month, today]);
  const totals = computeBudgetTotals(progress);
  const previousMonth = addMonthKey(month, -1);
  const previousCount = data.budgets.filter((b) => b.month === previousMonth).length;
  const missingFromPrevious = data.budgets.filter((b) => b.month === previousMonth && !progress.some((p) => p.budget.categoryId === b.categoryId)).length;

  const unbudgeted = [...summary.byCategory.entries()]
    .filter(([id, amount]) => amount > 0 && !progress.some((p) => p.budget.categoryId === id))
    .map(([id, amount]) => ({ category: state.categoriesById.get(id), amount }))
    .filter((u): u is { category: Category; amount: number } => Boolean(u.category))
    .sort((a, b) => b.amount - a.amount);

  const copy = async () => {
    const count = await copyBudgetsFromPreviousMonth(month);
    toast.success(count ? `Copied ${count} budget${count > 1 ? "s" : ""} from ${monthName(previousMonth)}` : "Everything was already budgeted");
  };

  const isCurrent = month === state.month;
  const [y, m] = month.split("-").map(Number);
  const day = isCurrent ? Number(today.slice(8, 10)) : null;

  return (
    <Page>
      <PageHeader
        title="Budgets"
        back="/more/"
        subtitle="Set a limit for each category. Owwy tells you early when one is running hot."
        actions={
          <Button size="sm" onClick={() => setEditing({})}>
            <Plus />
            Budget
          </Button>
        }
      />

      <div className="mb-4 flex justify-center lg:justify-start">
        <MonthSwitcher label={formatMonth(month)} onPrevious={() => setMonth(addMonthKey(month, -1))} onNext={() => setMonth(addMonthKey(month, 1))} nextDisabled={month > state.month} />
      </div>

      {progress.length === 0 ? (
        <Card className="mb-6">
          <EmptyState
            mood="thinking"
            title={`No budgets for ${monthName(month)}`}
            description={previousCount ? `You had ${previousCount} budgets in ${monthName(previousMonth)}. Bring them over in one tap.` : "Start with the category where money disappears fastest — often food or shopping."}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {previousCount ? (
                  <Button onClick={copy}>
                    <Copy />
                    Copy from {monthName(previousMonth)}
                  </Button>
                ) : null}
                <Button variant={previousCount ? "secondary" : "primary"} onClick={() => setEditing({})}>
                  <Plus />
                  Create a budget
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="mb-5 flex items-center gap-5 p-5">
            <ProgressRing
              value={totals.budgeted ? (totals.spent / totals.budgeted) * 100 : 0}
              size={92}
              stroke={9}
              color={totals.spent > totals.budgeted ? "var(--negative)" : "var(--brand)"}
              label={`${Math.round(totals.budgeted ? (totals.spent / totals.budgeted) * 100 : 0)}% of total budget used`}
            >
              <span className="text-title-3 font-extrabold">{Math.round(totals.budgeted ? (totals.spent / totals.budgeted) * 100 : 0)}%</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="text-caption font-semibold text-ink-3">{totals.remaining >= 0 ? "Left to spend" : "Over budget"}</p>
              <p className={cn("text-title-1 font-extrabold tracking-tight", totals.remaining < 0 && "text-negative")}>
                <Money value={Math.abs(totals.remaining)} />
              </p>
              <p className="text-callout text-ink-2">
                <Money value={totals.spent} /> of <Money value={totals.budgeted} /> budgeted
              </p>
              {day ? (
                <p className="mt-1 text-caption text-ink-3">
                  Day {day} of {daysInMonth(y, m)}
                  {totals.overCount ? ` · ${totals.overCount} over budget` : ""}
                </p>
              ) : null}
            </div>
          </Card>

          {missingFromPrevious > 0 && isCurrent ? (
            <button type="button" onClick={copy} className="press mb-4 flex w-full items-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-3 text-left text-callout font-semibold text-ink-2 hover:border-brand hover:text-brand">
              <Copy className="size-4" aria-hidden />
              Copy {missingFromPrevious} more from {monthName(previousMonth)}
            </button>
          ) : null}

          <ul className="grid gap-3 lg:grid-cols-2">
            {progress.map((p) => (
              <BudgetRow key={p.budget.id} progress={p} onEdit={() => setEditing({ categoryId: p.budget.categoryId })} />
            ))}
          </ul>
        </>
      )}

      {unbudgeted.length ? (
        <section className="mt-8" aria-labelledby="unbudgeted">
          <h2 id="unbudgeted" className="mb-2 text-title-3 font-bold">
            Spending without a budget
          </h2>
          <Card className="divide-y divide-line/60">
            {unbudgeted.map(({ category, amount }) => (
              <div key={category.id} className="flex items-center gap-3 px-4 py-3">
                <EmojiTile emoji={category.emoji} color={category.color} size="sm" />
                <span className="flex-1 font-semibold">{category.name}</span>
                <Money value={amount} className="font-bold" />
                <Button size="sm" variant="secondary" onClick={() => setEditing({ categoryId: category.id })}>
                  Set
                </Button>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <BudgetSheet month={month} target={editing} onClose={() => setEditing(null)} />
    </Page>
  );
}

function BudgetRow({ progress: p, onEdit }: { progress: BudgetProgress; onEdit: () => void }) {
  const { fmt } = useFinance();
  const name = p.category?.name ?? "Deleted category";

  const remove = async () => {
    const removed = await deleteBudget(p.budget.id);
    if (removed) toast.show(`${name} budget removed`, { action: { label: "Undo", onClick: () => restoreBudget(removed) } });
  };

  return (
    <Card as="li" className={cn("p-4", p.budget.paused && "opacity-70")}>
      <div className="flex items-center gap-3">
        <EmojiTile emoji={p.category?.emoji ?? "📦"} color={p.category?.color} />
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-bold">{name}</span>
          <span className="block text-callout text-ink-2">
            <Money value={p.spent} className="font-semibold text-ink" /> of <Money value={p.budget.amount} />
          </span>
        </button>
        {p.budget.paused ? <Badge>Paused</Badge> : p.status === "over" ? <Badge tone="negative">Over</Badge> : p.status === "near" ? <Badge tone="warning">Almost</Badge> : null}
        <div className="flex gap-2">
          <IconButton size="sm" label={p.budget.paused ? `Resume ${name} budget` : `Pause ${name} budget`} onClick={() => setBudgetPaused(p.budget.id, !p.budget.paused)}>
            {p.budget.paused ? <Play /> : <Pause />}
          </IconButton>
          <IconButton size="sm" label={`Edit ${name} budget`} onClick={onEdit} className="max-sm:hidden">
            <Pencil />
          </IconButton>
          <IconButton size="sm" label={`Delete ${name} budget`} onClick={remove}>
            <Trash />
          </IconButton>
        </div>
      </div>
      <ProgressBar className="mt-3" height="h-2.5" value={p.percent} tone={p.budget.paused ? "brand" : budgetTone(p.status)} marker={p.monthElapsed} label={`${name}: ${Math.round(p.percent)}% used`} />
      <p className={cn("mt-2 text-callout", p.status === "over" && !p.budget.paused ? "text-negative" : "text-ink-3")}>
        {p.status === "over" && !p.budget.paused
          ? `You've used ${Math.round(p.percent)}% of your ${name.toLowerCase()} budget. That's ${fmt(-p.remaining)} less available for other categories.`
          : p.remaining > 0 && !p.budget.paused && p.monthElapsed < 100 && p.projected > p.budget.amount
            ? `${fmt(p.remaining)} left. At this pace you'd reach ${fmt(p.projected)} by month end.`
            : p.remaining >= 0
              ? `${fmt(p.remaining)} left · ${budgetStatusText(p)}`
              : budgetStatusText(p)}
      </p>
    </Card>
  );
}

function BudgetSheet({ month, target, onClose }: { month: MonthKey; target: { categoryId?: ID } | null; onClose: () => void }) {
  return (
    <Sheet open={Boolean(target)} onOpenChange={(o) => !o && onClose()} title={target?.categoryId ? "Budget" : "New budget"} description={`For ${formatMonth(month)}`}>
      {target ? <BudgetForm month={month} initialCategory={target.categoryId} onDone={onClose} /> : null}
    </Sheet>
  );
}

function BudgetForm({ month, initialCategory, onDone }: { month: MonthKey; initialCategory?: ID; onDone: () => void }) {
  const { state, baseData: data, currency, fmt } = useFinance();
  const existing = (id?: ID) => data.budgets.find((b) => b.month === month && b.categoryId === id);
  const [categoryId, setCategoryId] = useState<ID | undefined>(initialCategory);
  const [amount, setAmount] = useState(() => (existing(initialCategory) ? minorToInput(existing(initialCategory)!.amount, currency) : ""));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const history = useMemo(() => {
    if (!categoryId) return null;
    const months = [1, 2, 3].map((i) => summarizeMonth(data.transactions, data.accounts, data.goals, addMonthKey(month, -i)).byCategory.get(categoryId) ?? 0);
    const withData = months.filter((v) => v > 0);
    return { last: months[0], average: withData.length ? Math.round(withData.reduce((a, b) => a + b, 0) / withData.length) : 0 };
  }, [categoryId, data, month]);

  const categories = state.categories.filter((c) => c.kind === "expense" && !c.archived);

  const save = async () => {
    const minor = parseAmount(amount, currency);
    if (!categoryId) return setError("Choose a category.");
    if (!minor) return setError("Enter a budget amount.");
    setSaving(true);
    try {
      await setBudget(categoryId, month, minor);
      toast.success(`${state.categoriesById.get(categoryId)?.name} budget set to ${fmt(minor)}`);
      onDone();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Suggestions round up to a friendly 100 units of the currency.
  const step = minorFactor(currency) * 100;
  const round = (v: number) => Math.ceil(v / step) * step;

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-callout font-semibold text-ink-2">Category</legend>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((c) => {
            const has = existing(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoryId === c.id}
                onClick={() => {
                  setCategoryId(c.id);
                  setAmount(existing(c.id) ? minorToInput(existing(c.id)!.amount, currency) : "");
                  setError(null);
                }}
                className={cn(
                  "press relative flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-caption font-semibold",
                  categoryId === c.id ? "border-brand bg-brand-soft text-brand-soft-ink" : "border-line/70 bg-surface text-ink-2",
                )}
              >
                <span className="text-[22px] leading-none" aria-hidden>{c.emoji}</span>
                <span className="w-full truncate text-center">{c.name}</span>
                {has ? <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brand" aria-label="Has budget" /> : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Monthly limit" error={error}>
        {(props) => <AmountInput {...props} size="xl" value={amount} onValueChange={(v) => { setAmount(v); setError(null); }} currency={currency} />}
      </Field>

      {history && (history.last > 0 || history.average > 0) ? (
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="text-callout text-ink-2">
            You spent <span className="font-bold text-ink">{fmt(history.last)}</span> on this last month
            {history.average ? (
              <>
                , and <span className="font-bold text-ink">{fmt(history.average)}</span> on average.
              </>
            ) : (
              "."
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[history.last, history.average].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).map((v) => (
              <Button key={v} size="sm" variant="outline" onClick={() => setAmount(minorToInput(round(v), currency))}>
                Use {fmt(round(v))}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <Button size="xl" onClick={save} loading={saving}>
        Save budget
      </Button>
    </div>
  );
}
