"use client";

import { HandCoins, Pencil, Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Page, PageHeader } from "@/components/layout/page";
import { SplitBillSheet } from "@/components/transactions/split-bill-sheet";
import { Button, IconButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, Money, ProgressBar } from "@/components/ui/display";
import { AmountInput, Chip, Field, Select, SwitchRow, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { formatRelativeDate, formatShortDate, relativeDatePhrase, today as localToday } from "@/lib/dates";
import type { ReceivableProgress } from "@/lib/finance/receivables";
import { minorToInput, parseAmount } from "@/lib/money";
import { accountCurrency } from "@/lib/money/fx";
import { haptic } from "@/lib/platform";
import { createReceivable, deleteReceivable, recordCollection, updateReceivable } from "@/lib/storage/repositories/receivables";
import { deleteTransaction } from "@/lib/storage/repositories/transactions";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { Receivable } from "@/types/models";

type Filter = "open" | "done";

export default function OwedPage() {
  const { state } = useFinance();
  const [filter, setFilter] = useState<Filter>("open");
  const [form, setForm] = useState<{ receivable?: Receivable } | null>(null);
  const [collecting, setCollecting] = useState<ReceivableProgress | null>(null);
  const [splitting, setSplitting] = useState(false);

  const all = state.receivableProgress;
  const open = all.filter((p) => p.status === "open" || p.status === "overdue");
  const done = all.filter((p) => p.status === "collected" || p.status === "closed");
  const shown = filter === "open" ? open : done;
  const collectedTotal = all.reduce((t, p) => t + p.collected, 0);
  const overdue = open.filter((p) => p.status === "overdue").length;

  return (
    <Page>
      <PageHeader
        title="Owed to you"
        back="/more/"
        subtitle="Money you lent to friends and family."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSplitting(true)}>
              <Users />
              Split
            </Button>
            <Button size="sm" onClick={() => setForm({})}>
              <Plus />
              Entry
            </Button>
          </div>
        }
      />

      {all.length === 0 ? (
        <Card>
          <EmptyState
            mood="encouraging"
            title="Nobody owes you anything"
            description="Lent someone money, or paid for the table? Track it here. It won't count as spending, and what's still owed shows up in your net worth."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setForm({})}>
                  <Plus />
                  Add an entry
                </Button>
                <Button variant="secondary" onClick={() => setSplitting(true)}>
                  <Users />
                  Split a bill
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="mb-5 overflow-hidden p-5">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-caption font-semibold text-ink-3">Still to collect</p>
                <Money value={state.stillToCollect} animate className="block text-[2.25rem] leading-tight font-extrabold tracking-tight" />
                <p className="mt-1 text-callout text-ink-2">
                  {open.length} {open.length === 1 ? "person" : "people"}
                  {overdue ? <span className="font-semibold text-negative"> · {overdue} past due</span> : null}
                </p>
              </div>
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-ink" aria-hidden>
                <HandCoins className="size-7" />
              </span>
            </div>
            <ProgressBar
              className="mt-4"
              height="h-2.5"
              tone="positive"
              value={(collectedTotal / Math.max(1, collectedTotal + state.stillToCollect)) * 100}
              label="Share of lent money collected back"
            />
            <p className="mt-2 text-caption text-ink-3">
              <Money value={collectedTotal} className="font-semibold text-positive" /> collected back so far
            </p>
          </Card>

          <div className="mb-4 flex gap-2" role="group" aria-label="Filter entries">
            <Chip selected={filter === "open"} onClick={() => setFilter("open")}>
              Still owed · {open.length}
            </Chip>
            <Chip selected={filter === "done"} onClick={() => setFilter("done")}>
              Settled · {done.length}
            </Chip>
          </div>

          {shown.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {shown.map((p) => (
                <ReceivableCard key={p.receivable.id} progress={p} onCollect={() => setCollecting(p)} onEdit={() => setForm({ receivable: p.receivable })} />
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-callout text-ink-3">{filter === "open" ? "Everyone's paid you back." : "Nothing settled yet."}</p>
          )}
        </>
      )}

      <Sheet open={Boolean(form)} onOpenChange={(o) => !o && setForm(null)} title={form?.receivable ? "Edit entry" : "Someone owes you"}>
        {form ? <ReceivableForm receivable={form.receivable} onDone={() => setForm(null)} /> : null}
      </Sheet>
      <Sheet open={Boolean(collecting)} onOpenChange={(o) => !o && setCollecting(null)} title="Money came back" size="sm">
        {collecting ? <CollectForm progress={collecting} onDone={() => setCollecting(null)} /> : null}
      </Sheet>
      <SplitBillSheet open={splitting} onOpenChange={setSplitting} />
    </Page>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function ReceivableCard({ progress: p, onCollect, onEdit }: { progress: ReceivableProgress; onCollect: () => void; onEdit: () => void }) {
  const { today, state } = useFinance();
  const history = useMemo(() => state.transactions.filter((t) => t.receivableId === p.receivable.id).slice(0, 3), [state.transactions, p.receivable.id]);
  const open = p.status === "open" || p.status === "overdue";

  return (
    // min-w-0: same grid-item shrink fix as the debts and goals cards.
    <Card as="li" className="min-w-0 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-callout font-extrabold text-brand-soft-ink" aria-hidden>
          {initials(p.receivable.person) || "🤝"}
        </span>
        <div className="min-w-0 flex-1">
          {/* h2, not h3: each card sits directly under the page's h1. */}
          <h2 className="truncate text-title-3 font-bold">{p.receivable.person}</h2>
          <p className="truncate text-caption text-ink-3">{p.receivable.note || `Tracking since ${formatShortDate(localToday(new Date(p.receivable.createdAt)), today)}`}</p>
        </div>
        <IconButton size="sm" label={`Edit ${p.receivable.person}`} onClick={onEdit}>
          <Pencil />
        </IconButton>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-caption font-semibold text-ink-3">{open ? "Still owes you" : p.status === "collected" ? "Paid back" : "Settled"}</p>
          <Money value={open ? p.remaining : p.receivable.originalAmount} className="text-title-1 font-extrabold tracking-tight" />
        </div>
        <span className="pb-1 text-caption text-ink-3">
          of <Money value={p.receivable.originalAmount} className="font-semibold text-ink-2" />
        </span>
      </div>
      <ProgressBar className="mt-2" height="h-2" tone="positive" value={p.percent} label={`${Math.round(p.percent)}% collected from ${p.receivable.person}`} />

      <div className="mt-3 flex flex-wrap gap-2">
        {p.status === "collected" ? <Badge tone="positive">All paid back</Badge> : null}
        {p.status === "closed" ? <Badge>Settled</Badge> : null}
        {open && p.receivable.dueDate ? (
          <Badge tone={p.status === "overdue" ? "negative" : p.daysUntilDue !== null && p.daysUntilDue <= 3 ? "warning" : "neutral"}>
            {p.status === "overdue" ? "Past due" : "Due"} {relativeDatePhrase(p.receivable.dueDate, today)}
          </Badge>
        ) : null}
        {p.collected > 0 && open ? (
          <Badge tone="positive">
            <Money value={p.collected} /> back
          </Badge>
        ) : null}
      </div>

      {history.length ? (
        <ul className="mt-3 flex flex-col gap-1 border-t border-line/70 pt-3">
          {history.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-caption">
              <span className="truncate text-ink-2">
                {t.type === "income" ? "Collected" : "Lent"} · {formatRelativeDate(t.date, today)}
              </span>
              <Money value={t.type === "income" ? t.amount : -t.amount} signed className={cn("font-semibold", t.type === "income" ? "text-positive" : "text-ink-2")} currency={accountCurrency(state.accountsById.get(t.accountId), state.fx)} />
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <Button className="mt-4 w-full" onClick={onCollect}>
          Record money back
        </Button>
      ) : null}
    </Card>
  );
}

function ReceivableForm({ receivable, onDone }: { receivable?: Receivable; onDone: () => void }) {
  const { state, currency, today } = useFinance();
  const accounts = state.mainAccounts.filter((a) => a.type !== "credit");
  const [person, setPerson] = useState(receivable?.person ?? "");
  const [note, setNote] = useState(receivable?.note ?? "");
  const [amount, setAmount] = useState(receivable ? minorToInput(receivable.originalAmount, currency) : "");
  const [already, setAlready] = useState("");
  const [dueDate, setDueDate] = useState(receivable?.dueDate ?? "");
  const [recordLend, setRecordLend] = useState(true);
  const [accountId, setAccountId] = useState(accounts.find((a) => a.includeInSafeToSpend)?.id ?? accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!person.trim()) return setError("Who owes you?");
    const minor = parseAmount(amount, currency);
    if (!minor) return setError("How much do they owe?");
    setSaving(true);
    try {
      if (receivable) {
        await updateReceivable(receivable.id, { person, note, originalAmount: minor, dueDate });
        toast.success("Entry updated");
      } else {
        await createReceivable({
          person,
          note,
          amount: minor,
          alreadyCollected: parseAmount(already, currency) ?? 0,
          dueDate: dueDate || undefined,
          lentFromAccountId: recordLend && accountId ? accountId : undefined,
          date: today,
        });
        void haptic("success");
        toast.success(`${person.trim()} added`, { description: recordLend && accountId ? "Recorded as money lent — not spending." : undefined });
      }
      onDone();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  const open = receivable && !receivable.closedAt;

  return (
    <div className="flex flex-col gap-5">
      <Field label="Who owes you" error={error && !person.trim() ? error : null}>
        {(props) => <TextInput {...props} value={person} onChange={(e) => setPerson(e.target.value)} placeholder="e.g. Migs" maxLength={40} autoFocus={!receivable} />}
      </Field>
      <Field label="How much" error={error && person.trim() ? error : null}>
        {(props) => <AmountInput {...props} size="xl" value={amount} onValueChange={(v) => { setAmount(v); setError(null); }} currency={currency} />}
      </Field>
      <Field label="What for (optional)">{(props) => <TextInput {...props} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Concert tickets" maxLength={80} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pay back by">{(props) => <TextInput {...props} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>
        {!receivable ? (
          <Field label="Already paid back">{(props) => <AmountInput {...props} value={already} onValueChange={setAlready} currency={currency} />}</Field>
        ) : null}
      </div>
      {!receivable && accounts.length ? (
        <div className="rounded-2xl border border-line/70 p-3">
          <SwitchRow checked={recordLend} onCheckedChange={setRecordLend} label="The money left my account today" description="Lowers that account's balance without counting as spending." />
          {recordLend ? (
            <Field label="From" className="mt-2">
              {(props) => (
                <Select {...props} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {receivable ? (
          <>
            <Button
              variant="dangerSoft"
              size="xl"
              onClick={async () => {
                await deleteReceivable(receivable.id);
                toast.show(`${receivable.person} removed`, { description: "Linked transactions stay in your log." });
                onDone();
              }}
            >
              Delete
            </Button>
            <Button
              variant="secondary"
              size="xl"
              onClick={async () => {
                await updateReceivable(receivable.id, { closedAt: open ? Date.now() : undefined });
                toast.show(open ? "Marked as settled" : "Reopened");
                onDone();
              }}
            >
              {open ? "Settle" : "Reopen"}
            </Button>
          </>
        ) : null}
        <Button size="xl" className="flex-1" onClick={save} loading={saving}>
          {receivable ? "Save" : "Add entry"}
        </Button>
      </div>
    </div>
  );
}

function CollectForm({ progress: p, onDone }: { progress: ReceivableProgress; onDone: () => void }) {
  const { state, currency, today, fmt } = useFinance();
  const accounts = state.mainAccounts.filter((a) => a.type !== "credit");
  const [amount, setAmount] = useState(minorToInput(p.remaining, currency));
  const [accountId, setAccountId] = useState(accounts.find((a) => a.includeInSafeToSpend)?.id ?? accounts[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const minor = parseAmount(amount, currency);
    if (!minor) return setError("Enter the amount you got back.");
    if (minor > p.remaining) return setError(`${p.receivable.person} only owes ${fmt(p.remaining)}.`);
    if (!accountId) return setError("Choose where the money arrived.");
    setSaving(true);
    try {
      const { transaction, fullyCollected } = await recordCollection({ receivableId: p.receivable.id, accountId, amount: minor, date });
      void haptic("success");
      toast.success(`${fmt(minor)} back from ${p.receivable.person}`, {
        description: fullyCollected ? "All paid back. Nice!" : `${fmt(p.remaining - minor)} still to collect`,
        action: {
          label: "Undo",
          onClick: async () => {
            await deleteTransaction(transaction.id);
            if (fullyCollected) await updateReceivable(p.receivable.id, { closedAt: undefined });
          },
        },
      });
      onDone();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-callout text-ink-2">
        <span className="font-bold text-ink">{p.receivable.person}</span> · <Money value={p.remaining} /> still owed
      </p>
      <Field label="Amount" error={error}>
        {(props) => <AmountInput {...props} size="xl" value={amount} onValueChange={(v) => { setAmount(v); setError(null); }} currency={currency} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        {[0.25, 0.5, 1].map((share) => {
          const value = Math.round(p.remaining * share);
          return (
            <Chip key={share} selected={parseAmount(amount, currency) === value} onClick={() => setAmount(minorToInput(value, currency))}>
              {share === 1 ? "All of it" : `${share * 100}%`}
            </Chip>
          );
        })}
      </div>
      <Field label="Arrived in">
        {(props) => (
          <Select {...props} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Date">{(props) => <TextInput {...props} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}</Field>
      <Button size="xl" onClick={submit} loading={saving}>
        Record money back
      </Button>
    </div>
  );
}
