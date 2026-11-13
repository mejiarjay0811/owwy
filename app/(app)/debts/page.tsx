"use client";

import { CalendarClock, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Page, PageHeader } from "@/components/layout/page";
import { Button, IconButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, Money, ProgressBar } from "@/components/ui/display";
import { AmountInput, Chip, Field, Select, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { formatShortDate, relativeDatePhrase } from "@/lib/dates";
import type { DebtProgress } from "@/lib/finance/debts";
import { installmentPlan, installmentTotals, monthlyForPlan, type InstallmentPlan } from "@/lib/finance/installments";
import { minorToInput, parseAmount } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { haptic } from "@/lib/platform";
import { createDebt, deleteDebt, recordDebtPayment, updateDebt } from "@/lib/storage/repositories/debts";
import { deleteTransaction } from "@/lib/storage/repositories/transactions";
import { toast } from "@/stores/ui";
import type { Debt, DebtKind } from "@/types/models";

const KINDS: { value: DebtKind; label: string; emoji: string }[] = [
  { value: "credit_card", label: "Credit card", emoji: "💳" },
  { value: "personal_loan", label: "Loan", emoji: "🏦" },
  { value: "borrowed", label: "Borrowed", emoji: "🤝" },
  { value: "installment", label: "Installment", emoji: "🛍️" },
  { value: "other", label: "Other", emoji: "🧾" },
];

export default function DebtsPage() {
  const { state, today } = useFinance();
  const [form, setForm] = useState<{ debt?: Debt } | null>(null);
  const [paying, setPaying] = useState<DebtProgress | null>(null);

  const debts = state.debtProgress;
  const totalRemaining = debts.reduce((t, d) => t + d.remaining, 0);
  const totalPaid = debts.reduce((t, d) => t + d.paid, 0);
  const minimums = debts.filter((d) => d.remaining > 0).reduce((t, d) => t + d.debt.minimumPayment, 0);
  const plans = installmentTotals(debts.map((d) => installmentPlan(d, today)).filter((p): p is InstallmentPlan => p !== null));

  return (
    <Page>
      <PageHeader
        title="Debts"
        back="/more/"
        subtitle="Credit cards, loans, and money you've borrowed."
        actions={
          <Button size="sm" onClick={() => setForm({})}>
            <Plus />
            Debt
          </Button>
        }
      />

      {debts.length === 0 ? (
        <Card>
          <EmptyState
            mood="encouraging"
            title="No debts tracked"
            description="If you owe on a card, a loan, or to family, add it here. Owwy shows your payoff progress and keeps minimum payments out of Safe to Spend."
            action={
              <Button onClick={() => setForm({})}>
                <Plus />
                Add a debt
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="mb-5 p-5">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-caption font-semibold text-ink-3">Still owed</p>
                <Money value={totalRemaining} className="text-title-2 font-extrabold" />
              </div>
              <div>
                <p className="text-caption font-semibold text-ink-3">Paid off</p>
                <Money value={totalPaid} className="text-title-2 font-extrabold text-positive" />
              </div>
              <div>
                <p className="text-caption font-semibold text-ink-3">Minimums / mo</p>
                <Money value={minimums} className="text-title-2 font-extrabold" />
              </div>
            </div>
            <ProgressBar className="mt-4" height="h-2.5" tone="positive" value={(totalPaid / Math.max(1, totalPaid + totalRemaining)) * 100} label="Share of all debt paid off" />
            {plans.active > 0 ? (
              <p className="mt-3 flex flex-wrap items-center gap-x-1.5 border-t border-line/60 pt-3 text-caption text-ink-2">
                <CalendarClock className="size-3.5 text-ink-3" aria-hidden />
                {plans.active} installment plan{plans.active > 1 ? "s" : ""} running ·
                <Money value={plans.monthly} className="font-bold text-ink" /> a month ·
                <Money value={plans.remaining} className="font-semibold" /> to go
              </p>
            ) : null}
          </Card>

          <ul className="grid gap-4 md:grid-cols-2">
            {debts.map((p) => (
              <DebtCard key={p.debt.id} progress={p} onPay={() => setPaying(p)} onEdit={() => setForm({ debt: p.debt })} />
            ))}
          </ul>
        </>
      )}

      <Sheet open={Boolean(form)} onOpenChange={(o) => !o && setForm(null)} title={form?.debt ? "Edit debt" : "New debt"}>
        {form ? <DebtForm debt={form.debt} onDone={() => setForm(null)} /> : null}
      </Sheet>
      <Sheet open={Boolean(paying)} onOpenChange={(o) => !o && setPaying(null)} title="Record a payment" size="sm">
        {paying ? <PaymentForm progress={paying} onDone={() => setPaying(null)} /> : null}
      </Sheet>
    </Page>
  );
}

function DebtCard({ progress: p, onPay, onEdit }: { progress: DebtProgress; onPay: () => void; onEdit: () => void }) {
  const { today } = useFinance();
  const kind = KINDS.find((k) => k.value === p.debt.kind);
  const done = p.remaining === 0;
  const plan = installmentPlan(p, today);

  return (
    // min-w-0: a grid item defaults to min-width:auto and refuses to shrink
    // below its content, which pushed this card past a 320px screen.
    <Card as="li" className="min-w-0 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-[24px]" aria-hidden>
          {kind?.emoji}
        </span>
        <div className="min-w-0 flex-1">
          {/* h2, not h3: each card sits directly under the page's h1. */}
          <h2 className="truncate text-title-3 font-bold">{p.debt.name}</h2>
          <p className="text-caption text-ink-3">
            {kind?.label}
            {p.debt.lender ? ` · ${p.debt.lender}` : ""}
            {p.debt.interestRate ? ` · ${p.debt.interestRate}% a year` : ""}
          </p>
        </div>
        <IconButton size="sm" label={`Edit ${p.debt.name}`} onClick={onEdit}>
          <Pencil />
        </IconButton>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-caption font-semibold text-ink-3">{done ? "Paid off" : "Remaining"}</p>
          <Money value={p.remaining} className="text-title-1 font-extrabold tracking-tight" />
        </div>
        <span className="text-callout font-bold text-positive">{Math.round(p.percent)}% paid</span>
      </div>
      <ProgressBar className="mt-2" height="h-2.5" tone="positive" value={p.percent} label={`${p.debt.name}: ${Math.round(p.percent)}% paid off`} />

      {plan ? <InstallmentSchedule plan={plan} /> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-caption text-ink-2">
        {done ? (
          <Badge tone="positive">Debt free</Badge>
        ) : (
          <>
            {p.debt.minimumPayment ? (
              <span>
                Minimum <Money value={p.debt.minimumPayment} className="font-bold text-ink" />
              </span>
            ) : null}
            {p.debt.nextDueDate ? <Badge tone={p.debt.nextDueDate < today ? "negative" : "neutral"}>Due {relativeDatePhrase(p.debt.nextDueDate, today)}</Badge> : null}
            {p.minimumMetThisMonth && p.debt.minimumPayment ? <Badge tone="positive">Paid this month</Badge> : null}
          </>
        )}
      </div>
      {!done && p.payoffDate && p.monthsToPayoff ? (
        <p className="mt-2 text-caption text-ink-3">
          At the minimum, you&apos;d be done in about {p.monthsToPayoff} month{p.monthsToPayoff > 1 ? "s" : ""} ({formatShortDate(p.payoffDate, today)}){p.debt.interestRate ? ", before interest" : ""}.
        </p>
      ) : null}

      {!done ? (
        <Button className="mt-4 w-full" onClick={onPay}>
          Record payment
        </Button>
      ) : null}
    </Card>
  );
}

/** An installment plan reads as months, not percentages: one pip per payment. */
function InstallmentSchedule({ plan }: { plan: InstallmentPlan }) {
  const { today } = useFinance();
  return (
    <div className="mt-3 rounded-2xl bg-surface-2 p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-callout font-bold">
          {plan.monthsPaid} of {plan.termMonths} paid
        </p>
        <p className="text-caption text-ink-3">
          <Money value={plan.monthly} className="font-semibold text-ink-2" /> a month
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1" role="img" aria-label={`${plan.monthsPaid} of ${plan.termMonths} payments made`}>
        {Array.from({ length: plan.termMonths }, (_, i) => (
          <span key={i} className={cn("h-2 w-full max-w-[22px] min-w-[8px] flex-1 rounded-full", i < plan.monthsPaid ? "bg-positive" : i < plan.monthsPaid + plan.behind ? "bg-negative/70" : "bg-surface-3")} />
        ))}
      </div>
      <p className="mt-2 text-caption text-ink-3">
        {plan.complete ? (
          "Fully paid"
        ) : (
          <>
            {plan.monthsLeft} left
            {plan.nextDue ? <> · next {formatShortDate(plan.nextDue, today)}</> : null}
            {plan.finalDue ? <> · ends {formatShortDate(plan.finalDue, today)}</> : null}
          </>
        )}
      </p>
      {plan.behind > 0 ? (
        <p className="mt-1 text-caption font-semibold text-negative">
          {plan.behind} payment{plan.behind > 1 ? "s" : ""} behind schedule.
        </p>
      ) : null}
    </div>
  );
}

function DebtForm({ debt, onDone }: { debt?: Debt; onDone: () => void }) {
  const { state, currency } = useFinance();
  const creditAccounts = state.mainAccounts.filter((a) => a.type === "credit");
  const [name, setName] = useState(debt?.name ?? "");
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? "personal_loan");
  const [balance, setBalance] = useState(debt ? minorToInput(debt.startingBalance, currency) : "");
  const [original, setOriginal] = useState(debt ? minorToInput(debt.originalAmount, currency) : "");
  const [minimum, setMinimum] = useState(debt ? minorToInput(debt.minimumPayment, currency) : "");
  const [dueDate, setDueDate] = useState(debt?.nextDueDate ?? "");
  const [rate, setRate] = useState(debt?.interestRate ? String(debt.interestRate) : "");
  const [accountId, setAccountId] = useState(debt?.accountId ?? "");
  const [lender, setLender] = useState(debt?.lender ?? "");
  const [termMonths, setTermMonths] = useState(debt?.termMonths ? String(debt.termMonths) : "");
  const [startedOn, setStartedOn] = useState(debt?.startedOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const linked = Boolean(accountId);
  const isPlan = kind === "installment";
  const term = Number(termMonths) || 0;

  /** Typing a term fills in the monthly amount — the arithmetic everyone does anyway. */
  const chooseTerm = (months: number) => {
    setTermMonths(String(months));
    const total = parseAmount(original, currency) ?? parseAmount(balance, currency);
    if (total && months > 1) setMinimum(minorToInput(monthlyForPlan(total, months), currency));
  };

  const save = async () => {
    if (!name.trim()) return setError("Name this debt.");
    const starting = linked ? 0 : parseAmount(balance, currency);
    if (!linked && !starting) return setError("How much do you still owe?");
    setSaving(true);
    const input = {
      name,
      kind,
      startingBalance: starting ?? 0,
      originalAmount: parseAmount(original, currency) ?? starting ?? 0,
      minimumPayment: parseAmount(minimum, currency) ?? 0,
      nextDueDate: dueDate || undefined,
      interestRate: rate ? Number(rate) : undefined,
      accountId: accountId || undefined,
      lender,
      termMonths: isPlan && term > 1 ? term : undefined,
      startedOn: isPlan && startedOn ? startedOn : undefined,
    };
    try {
      if (debt) await updateDebt(debt.id, { ...input, nextDueDate: dueDate || "", accountId: accountId || "" });
      else await createDebt(input);
      toast.success(debt ? "Debt updated" : `${name} added`);
      onDone();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Chip key={k.value} selected={kind === k.value} onClick={() => setKind(k.value)}>
            {k.emoji} {k.label}
          </Chip>
        ))}
      </div>
      <Field label="Name" error={error && !name.trim() ? error : null}>
        {(props) => <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Motorcycle loan" maxLength={40} />}
      </Field>
      {kind === "credit_card" && creditAccounts.length ? (
        <Field label="Linked credit card" hint="Remaining balance follows this card's balance in Owwy.">
          {(props) => (
            <Select {...props} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Not linked</option>
              {creditAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      {!linked ? (
        <Field label={debt ? "Balance when you started tracking" : "How much you owe now"} error={error && name.trim() ? error : null}>
          {(props) => <AmountInput {...props} value={balance} onValueChange={setBalance} currency={currency} />}
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Original amount" hint="For payoff progress">
          {(props) => <AmountInput {...props} value={original} onValueChange={setOriginal} currency={currency} />}
        </Field>
        <Field label="Minimum payment">
          {(props) => <AmountInput {...props} value={minimum} onValueChange={setMinimum} currency={currency} />}
        </Field>
      </div>
      {isPlan ? (
        <fieldset className="rounded-2xl border border-line/70 p-4">
          <legend className="px-1 text-callout font-semibold text-ink-2">Installment plan</legend>
          <div className="flex flex-wrap gap-2">
            {[3, 6, 9, 12, 24].map((months) => (
              <Chip key={months} selected={term === months} onClick={() => chooseTerm(months)}>
                {months} months
              </Chip>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Months" hint="How long the plan runs">
              {(props) => <TextInput {...props} inputMode="numeric" value={termMonths} onChange={(e) => setTermMonths(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="e.g. 12" />}
            </Field>
            <Field label="First payment" hint="For the schedule">
              {(props) => <TextInput {...props} type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />}
            </Field>
          </div>
          {term > 1 ? (
            <p className="mt-2 text-caption text-ink-3">
              Owwy sets aside the monthly amount in Safe to Spend until the plan ends.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Next due date">{(props) => <TextInput {...props} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>
        <Field label="Interest % / year">
          {(props) => <TextInput {...props} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, "").slice(0, 6))} placeholder="Optional" />}
        </Field>
      </div>
      <Field label="Lender (optional)">{(props) => <TextInput {...props} value={lender} onChange={(e) => setLender(e.target.value)} placeholder="e.g. Tita Rose" maxLength={60} />}</Field>
      <div className="flex gap-2">
        {debt ? (
          <Button variant="dangerSoft" size="xl" onClick={async () => { await deleteDebt(debt.id); toast.show(`${debt.name} removed`); onDone(); }}>
            Delete
          </Button>
        ) : null}
        <Button size="xl" className="flex-1" onClick={save} loading={saving}>
          {debt ? "Save changes" : "Add debt"}
        </Button>
      </div>
    </div>
  );
}

function PaymentForm({ progress: p, onDone }: { progress: DebtProgress; onDone: () => void }) {
  const { state, currency, today, fmt } = useFinance();
  const sources = state.mainAccounts.filter((a) => a.id !== p.debt.accountId && a.type !== "credit");
  const [amount, setAmount] = useState(minorToInput(Math.min(p.remaining, Math.max(p.debt.minimumPayment - p.paidThisMonth, 0) || p.debt.minimumPayment), currency));
  const [accountId, setAccountId] = useState(sources.find((a) => a.includeInSafeToSpend)?.id ?? sources[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const minor = parseAmount(amount, currency);
    if (!minor) return setError("Enter the amount you paid.");
    if (!accountId) return setError("Choose the account you paid from.");
    setSaving(true);
    try {
      const tx = await recordDebtPayment({ debtId: p.debt.id, fromAccountId: accountId, amount: minor, date });
      void haptic("success");
      toast.success(`${fmt(minor)} paid toward ${p.debt.name}`, {
        description: minor >= p.remaining ? "That clears it. Amazing!" : `${fmt(Math.max(0, p.remaining - minor))} to go`,
        action: { label: "Undo", onClick: () => void deleteTransaction(tx.id) },
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
        <span className="font-bold text-ink">{p.debt.name}</span> · <Money value={p.remaining} /> remaining
      </p>
      <Field label="Amount" error={error}>
        {(props) => <AmountInput {...props} size="xl" value={amount} onValueChange={(v) => { setAmount(v); setError(null); }} currency={currency} />}
      </Field>
      <Field label="Paid from">
        {(props) => (
          <Select {...props} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {sources.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Date">{(props) => <TextInput {...props} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}</Field>
      <Button size="xl" onClick={submit} loading={saving}>
        Record payment
      </Button>
    </div>
  );
}
