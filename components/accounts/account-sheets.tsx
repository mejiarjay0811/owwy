"use client";

import { Archive, ArchiveRestore, ArrowLeftRight, Check, Minus, Pencil, Plus, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { TransactionItem } from "@/components/transactions/transaction-item";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Money } from "@/components/ui/display";
import { AmountInput, Chip, Field, Select, SwitchRow, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { ACCOUNT_TYPE_LIST, ACCOUNT_TYPES, CARD_PATTERNS, CARD_STYLES } from "@/lib/defaults/card-styles";
import { addDays, formatShortDate } from "@/lib/dates";
import { defaultInterestTax, monthlyInterest } from "@/lib/finance/interest";
import { accountBalanceHistory } from "@/lib/finance/trends";
import { formatMoney, minorToInput, parseAmount } from "@/lib/money";
import { CURRENCY_LIST, minorFactor } from "@/lib/money/currency";
import { rateToBase } from "@/lib/money/fx";
import { haptic } from "@/lib/platform";
import { createAccount, deleteAccount, setAccountArchived, updateAccount } from "@/lib/storage/repositories/accounts";
import { cn } from "@/lib/utils/cn";
import { toast, useUI } from "@/stores/ui";
import type { Account, AccountType, CardPattern, CurrencyCode } from "@/types/models";
import { AccountCard } from "./account-card";

interface AccountFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
  onCreated?: (account: Account) => void;
  defaultType?: AccountType;
}

export function AccountFormSheet({ open, onOpenChange, account, onCreated, defaultType }: AccountFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={account ? "Edit account" : "New account"} description={account ? undefined : "Add where your money lives. It stays on this device."}>
      {open ? <AccountForm account={account} defaultType={defaultType} onDone={(created) => { onOpenChange(false); if (created) onCreated?.(created); }} /> : null}
    </Sheet>
  );
}

function AccountForm({ account, onDone, defaultType }: { account?: Account; onDone: (created?: Account) => void; defaultType?: AccountType }) {
  const { state, currency } = useFinance();
  const currentBalance = account ? (state.balances.get(account.id) ?? 0) : 0;
  const initialType = account?.type ?? defaultType ?? "bank";

  const [type, setType] = useState<AccountType>(initialType);
  const [name, setName] = useState(account?.name ?? "");
  const [balance, setBalance] = useState(account ? minorToInput(Math.abs(currentBalance), account.currency ?? currency) : "");
  const [negative, setNegative] = useState(account ? !ACCOUNT_TYPES[account.type].liability && currentBalance < 0 : false);
  const [creditLimit, setCreditLimit] = useState(account?.creditLimit ? minorToInput(account.creditLimit, account.currency ?? currency) : "");
  const [cardStyle, setCardStyle] = useState(account?.cardStyle ?? ACCOUNT_TYPES[initialType].defaultStyle);
  const [cardPattern, setCardPattern] = useState<CardPattern>(account?.cardPattern ?? "feathers");
  const [last4, setLast4] = useState(account?.last4 ?? "");
  const [spendable, setSpendable] = useState(account?.includeInSafeToSpend ?? ACCOUNT_TYPES[initialType].spendable);
  const [interestRate, setInterestRate] = useState(account?.interestRate ? String(account.interestRate) : "");
  const [interestTax, setInterestTax] = useState(String(account?.interestTaxRate ?? defaultInterestTax(currency)));
  const [styleTouched, setStyleTouched] = useState(Boolean(account));
  const [accountCurrencyCode, setAccountCurrencyCode] = useState<CurrencyCode>(account?.currency ?? currency);
  const [dueDay, setDueDay] = useState(account?.dueDay ? String(account.dueDay) : "");
  const [errors, setErrors] = useState<{ name?: string; last4?: string }>({});
  const [saving, setSaving] = useState(false);

  const info = ACCOUNT_TYPES[type];
  // Amounts on this form are typed in the account's own currency.
  const code = accountCurrencyCode;
  const foreign = code !== currency;
  const balanceMinor = (parseAmount(balance, code) ?? 0) * (negative && !info.liability ? -1 : 1);

  const chooseType = (next: AccountType) => {
    setType(next);
    if (!styleTouched) setCardStyle(ACCOUNT_TYPES[next].defaultStyle);
    if (!account) setSpendable(ACCOUNT_TYPES[next].spendable);
  };

  const save = async () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = "Give this account a name.";
    if (last4 && !/^\d{4}$/.test(last4)) nextErrors.last4 = "Use exactly 4 digits, or leave it empty.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const common = {
        name,
        type,
        cardStyle,
        cardPattern,
        last4,
        creditLimit: info.liability ? (parseAmount(creditLimit, code) ?? undefined) : undefined,
        includeInSafeToSpend: spendable,
        interestRate: info.liability ? undefined : Number(interestRate) || 0,
        interestTaxRate: info.liability ? undefined : Math.min(100, Number(interestTax) || 0),
        currency: foreign ? code : undefined,
        dueDay: info.liability && Number(dueDay) >= 1 && Number(dueDay) <= 31 ? Number(dueDay) : undefined,
      };
      if (account) {
        // Editing "current balance" adjusts the opening balance by the difference.
        const desired = info.liability ? -Math.abs(balanceMinor) : balanceMinor;
        const delta = desired - currentBalance;
        const opening = account.openingBalance + delta;
        await updateAccount(account.id, { ...common, openingBalance: info.liability ? Math.abs(opening) : opening });
        toast.success("Account updated");
        onDone();
      } else {
        const created = await createAccount({ ...common, openingBalance: info.liability ? Math.abs(balanceMinor) : balanceMinor });
        void haptic("success");
        toast.success(`${created.name} added`);
        onDone(created);
      }
    } catch (error) {
      toast.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex flex-col gap-5" noValidate>
      <div className="mx-auto w-full max-w-[340px] pt-1">
        <AccountCard
          account={{
            name: name || info.label,
            type,
            balance: info.liability ? -Math.abs(balanceMinor) : balanceMinor,
            cardStyle,
            cardPattern,
            last4: /^\d{4}$/.test(last4) ? last4 : undefined,
            creditLimit: parseAmount(creditLimit, code) ?? undefined,
            includeInSafeToSpend: spendable,
            currency: foreign ? code : undefined,
            dueDay: Number(dueDay) || undefined,
          }}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-callout font-semibold text-ink-2">Type</legend>
        <div className="grid grid-cols-4 gap-2">
          {ACCOUNT_TYPE_LIST.map((t) => (
            <button
              key={t.type}
              type="button"
              aria-pressed={type === t.type}
              onClick={() => chooseType(t.type)}
              className={cn(
                "press flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-caption font-semibold",
                type === t.type ? "border-brand bg-brand-soft text-brand-soft-ink" : "border-line/70 bg-surface text-ink-2",
              )}
            >
              <span className="text-[22px] leading-none" aria-hidden>{t.emoji}</span>
              <span className="w-full truncate text-center">{t.label.replace(" account", "")}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Name" error={errors.name}>
        {(props) => <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "ewallet" ? "e.g. My e-wallet" : type === "bank" ? "e.g. Main Wallet" : `e.g. ${info.label}`} maxLength={40} />}
      </Field>

      <Field
        label={info.liability ? "Amount owed right now" : "Current balance"}
        hint={account ? "Changing this records the difference as an adjustment, not a transaction." : undefined}
        trailing={
          !info.liability ? (
            <button type="button" onClick={() => setNegative((n) => !n)} className="inline-flex items-center gap-1 text-caption font-semibold text-ink-3 hover:text-ink">
              {negative ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
              {negative ? "Overdrawn" : "Positive"}
            </button>
          ) : undefined
        }
      >
        {(props) => <AmountInput {...props} value={balance} onValueChange={setBalance} currency={code} />}
      </Field>

      <Field
        label="Currency"
        hint={
          foreign
            ? `1 ${code} ≈ ${formatMoney(Math.round(rateToBase(code, state.fx) * minorFactor(currency)), currency)} — totals convert at this rate. Adjust it in Settings › Exchange rates.`
            : account && account.currency && account.currency !== currency
              ? "Existing amounts keep their numbers; only the currency label changes."
              : undefined
        }
      >
        {(props) => (
          <Select {...props} value={code} onChange={(e) => setAccountCurrencyCode(e.target.value as CurrencyCode)}>
            {CURRENCY_LIST.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.code} · {c.name}
                {c.code === currency ? " (main)" : ""}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {info.liability ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Credit limit">
            {(props) => <AmountInput {...props} value={creditLimit} onValueChange={setCreditLimit} currency={code} />}
          </Field>
          <Field label="Due day" hint="Day of the month">
            {(props) => (
              <TextInput {...props} inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="e.g. 20" />
            )}
          </Field>
        </div>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-callout font-semibold text-ink-2">Card finish</legend>
        <div className="grid grid-cols-5 gap-2.5">
          {CARD_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-label={s.name}
              aria-pressed={cardStyle === s.id}
              title={s.name}
              onClick={() => { setCardStyle(s.id); setStyleTouched(true); }}
              className={cn("press relative aspect-square rounded-2xl ring-offset-2 ring-offset-bg-elevated", cardStyle === s.id && "ring-2 ring-ink")}
              style={{ background: s.background }}
            >
              {cardStyle === s.id ? <Check className={cn("absolute inset-0 m-auto size-5", s.tone === "light" ? "text-[#2b2418]" : "text-white")} aria-hidden /> : null}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CARD_PATTERNS.map((p) => (
            <Chip key={p.id} selected={cardPattern === p.id} onClick={() => setCardPattern(p.id)}>
              {p.name}
            </Chip>
          ))}
        </div>
      </fieldset>

      {type !== "cash" ? (
        <Field label="Last 4 digits (optional)" error={errors.last4} hint="Just to recognize it. Never enter a full card or account number.">
          {(props) => <TextInput {...props} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="2841" className="tabular tracking-[0.3em]" />}
        </Field>
      ) : null}

      {!info.liability ? (
        <SwitchRow
          checked={spendable}
          onCheckedChange={setSpendable}
          label="Use for everyday spending"
          description="Counts toward Safe to Spend. Turn off for savings you don't want to touch."
        />
      ) : null}

      {!info.liability && type !== "cash" ? (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="font-semibold">Earns interest</p>
          <p className="text-callout text-ink-3">Owwy adds it every month, after tax — no typing needed.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Rate per year (%)">
              {(props) => (
                <TextInput {...props} inputMode="decimal" value={interestRate} onChange={(e) => setInterestRate(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))} placeholder="e.g. 4" />
              )}
            </Field>
            <Field label="Tax on interest (%)">
              {(props) => <TextInput {...props} inputMode="decimal" value={interestTax} onChange={(e) => setInterestTax(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} />}
            </Field>
          </div>
          {Number(interestRate) > 0 && balanceMinor > 0 ? (
            <p className="mt-2 text-caption text-ink-2">
              About <Money value={monthlyInterest(balanceMinor, Number(interestRate), Number(interestTax) || 0).net} alwaysShow className="font-bold text-positive" /> a month at today&apos;s balance.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="sticky bottom-0 -mx-5 border-t border-line/60 bg-bg-elevated px-5 pt-3 pb-1">
        <Button type="submit" size="xl" className="w-full" loading={saving}>
          {account ? "Save changes" : "Add account"}
        </Button>
      </div>
    </form>
  );
}

export function AccountDetailSheet({ account, onOpenChange }: { account: Account | null; onOpenChange: (open: boolean) => void }) {
  const { state, today } = useFinance();
  const openAdd = useUI((s) => s.openAddTransaction);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const live = account ? (state.accountsById.get(account.id) ?? account) : null;
  const history = useMemo(
    () => (live ? state.transactions.filter((t) => t.accountId === live.id || t.toAccountId === live.id) : []),
    [live, state.transactions],
  );
  const month = today.slice(0, 7);
  const flow = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    if (!live) return { inflow, outflow };
    for (const t of history) {
      if (!t.date.startsWith(month)) continue;
      if ((t.type === "income" && t.accountId === live.id) || (t.type === "transfer" && t.toAccountId === live.id)) inflow += t.amount;
      else outflow += t.amount;
    }
    return { inflow, outflow };
  }, [history, live, month]);

  if (!live) return <Sheet open={false} onOpenChange={onOpenChange} title="Account">{null}</Sheet>;
  const balance = state.balances.get(live.id) ?? 0;

  return (
    <>
      <Sheet open={Boolean(account) && !editing} onOpenChange={onOpenChange} title={live.name} hideTitle>
        <div className="flex flex-col gap-5">
          <div className="mx-auto w-full max-w-[360px]">
            <AccountCard account={{ ...live, balance }} size="lg" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-surface-2 p-3.5">
              <p className="text-caption font-semibold text-ink-3">In this month</p>
              <Money value={flow.inflow} currency={live.currency} className="text-title-3 font-bold text-positive" />
            </div>
            <div className="rounded-2xl bg-surface-2 p-3.5">
              <p className="text-caption font-semibold text-ink-3">Out this month</p>
              <Money value={flow.outflow} currency={live.currency} className="text-title-3 font-bold" />
            </div>
          </div>

          <BalanceBars account={live} />

          <div className="grid grid-cols-4 gap-2">
            <QuickAction label="Expense" icon={<Minus />} onClick={() => { onOpenChange(false); openAdd({ type: "expense", accountId: live.id }); }} />
            <QuickAction label="Income" icon={<Plus />} onClick={() => { onOpenChange(false); openAdd({ type: "income", accountId: live.id }); }} />
            <QuickAction label="Transfer" icon={<ArrowLeftRight />} onClick={() => { onOpenChange(false); openAdd({ type: "transfer", accountId: live.id }); }} />
            <QuickAction label="Edit" icon={<Pencil />} onClick={() => setEditing(true)} />
          </div>

          <div>
            <h3 className="mb-1 px-2 text-caption font-bold tracking-wider text-ink-3 uppercase">Recent activity</h3>
            {history.length ? (
              <ul>
                {history.slice(0, 8).map((t) => (
                  <li key={t.id}>
                    <TransactionItem transaction={t} showDate />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2 py-4 text-callout text-ink-3">No transactions yet for this account.</p>
            )}
          </div>

          <div className="flex gap-2 border-t border-line/60 pt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={async () => {
                await setAccountArchived(live.id, !live.archived);
                toast.show(live.archived ? `${live.name} restored` : `${live.name} archived`, {
                  description: live.archived ? undefined : "Its history stays in your reports.",
                  action: { label: "Undo", onClick: () => setAccountArchived(live.id, live.archived) },
                });
                onOpenChange(false);
              }}
            >
              {live.archived ? <ArchiveRestore /> : <Archive />}
              {live.archived ? "Restore" : "Archive"}
            </Button>
            {history.length === 0 ? (
              <Button variant="dangerSoft" onClick={() => setConfirmDelete(true)}>
                <Trash />
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      </Sheet>

      <AccountFormSheet open={Boolean(account) && editing} onOpenChange={(o) => !o && setEditing(false)} account={live} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${live.name}?`}
        description="This account has no transactions, so nothing else changes."
        confirmLabel="Delete account"
        destructive
        onConfirm={async () => {
          try {
            await deleteAccount(live.id);
            toast.show("Account deleted");
            onOpenChange(false);
          } catch (error) {
            toast.error(error);
          }
        }}
      />
    </>
  );
}

const BALANCE_DAYS = 14;

/** End-of-day balance for the last two weeks, as small bars. */
function BalanceBars({ account }: { account: Account }) {
  const { data, today } = useFinance();
  const liability = ACCOUNT_TYPES[account.type].liability;
  const points = useMemo(() => {
    const dates = Array.from({ length: BALANCE_DAYS }, (_, i) => addDays(today, i - (BALANCE_DAYS - 1)));
    const values = accountBalanceHistory(account, data.transactions, dates);
    return dates.map((date, i) => ({ date, value: liability ? Math.max(0, -values[i]) : values[i] }));
  }, [account, data.transactions, today, liability]);

  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  const change = last - first;
  const good = liability ? change <= 0 : change >= 0;

  return (
    <div className="rounded-2xl border border-line/70 p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-caption font-semibold text-ink-3">{liability ? "Owed" : "Balance"} · last 2 weeks</p>
        <p className={cn("text-caption font-bold", change === 0 ? "text-ink-3" : good ? "text-positive" : "text-negative")}>
          {change === 0 ? "No change" : <Money value={change} signed currency={account.currency} />}
        </p>
      </div>
      <ul className="mt-3 flex h-16 items-end gap-1" aria-label={`Daily ${liability ? "amount owed" : "balance"}, last ${BALANCE_DAYS} days`}>
        {points.map((p, i) => (
          <li key={p.date} className="flex h-full flex-1 items-end" title={`${formatShortDate(p.date)}`}>
            <span
              className={cn("block w-full rounded-[4px]", p.value < 0 ? "bg-negative/60" : i === points.length - 1 ? "bg-brand" : "bg-brand/25")}
              style={{ height: `${Math.max(6, (Math.abs(p.value) / max) * 100)}%` }}
              aria-hidden
            />
            <span className="sr-only">
              {formatShortDate(p.date)}: <Money value={p.value} currency={account.currency} />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-ink-3" aria-hidden>
        <span>{formatShortDate(points[0]?.date ?? today)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function QuickAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex flex-col items-center gap-1.5 rounded-2xl py-2 text-caption font-semibold text-ink-2 hover:bg-surface-2">
      <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-soft-ink [&_svg]:size-5">{icon}</span>
      {label}
    </button>
  );
}
