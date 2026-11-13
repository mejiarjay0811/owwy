"use client";

import { ArrowDown, Calculator, ChevronDown, ScanLine, Sparkles, Trash } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/display";
import { AmountInput, Chip, Field, Segmented, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { addDays, formatShortDate, isValidISODate } from "@/lib/dates";
import { ACCOUNT_TYPES, getCardStyle } from "@/lib/defaults/card-styles";
import { parseSmartInput, type SmartInputResult } from "@/lib/finance/smart-input";
import { formatMoney, minorToInput, parseAmount, toMinor } from "@/lib/money";
import { minorFactor } from "@/lib/money/currency";
import { accountCurrency, convertMinor, rateToBase } from "@/lib/money/fx";
import { haptic } from "@/lib/platform";
import { addReceipt } from "@/lib/storage/repositories/attachments";
import { addTransaction, deleteTransaction, restoreTransactions, updateTransaction } from "@/lib/storage/repositories/transactions";
import { AmountKeypad } from "./amount-keypad";
import { ReceiptPicker } from "./receipt-picker";
import { ScanReceiptSheet, type ScannedReceipt } from "./scan-receipt-sheet";
import { cn } from "@/lib/utils/cn";
import { readLocal, writeLocal } from "@/lib/utils/local";
import { toast, useUI } from "@/stores/ui";
import type { Category, CurrencyCode, ID, ISODate, Transaction, TransactionType } from "@/types/models";

const LAST_ACCOUNT_KEY = "owwy-last-account";

interface Draft {
  type: TransactionType;
  amount: string;
  /** What the destination account receives, for transfers between currencies. */
  toAmount: string;
  categoryId?: ID;
  accountId?: ID;
  toAccountId?: ID;
  date: ISODate;
  time: string;
  note: string;
  tags: string;
}

type DraftField = keyof Draft;

type TokenField = "amount" | "accountId" | "date" | "note" | "tags";

interface InputToken {
  id: string;
  text: string;
  field: TokenField;
}

/** Applies a smart-input result onto a draft, respecting fields the user already changed. */
function applyParse(d: Draft, result: SmartInputResult, touched: Set<DraftField>, currency: Parameters<typeof minorToInput>[1]): Draft {
  const next = { ...d };
  if (result.typeConfident || result.categoryId) next.type = result.type;
  if (result.amount !== null) next.amount = minorToInput(result.amount, currency);
  if (result.categoryId) next.categoryId = result.categoryId;
  else if (result.type !== d.type && !touched.has("categoryId")) next.categoryId = undefined;
  if (result.accountId) next.accountId = result.accountId;
  if (result.toAccountId) next.toAccountId = result.toAccountId;
  next.date = result.date;
  if (result.description) next.note = result.description;
  if (result.tags.length) next.tags = result.tags.join(", ");
  return next;
}

/** Words from the typed sentence, labelled with the field each one fills. */
function tokensFor(result: SmartInputResult, accountName: string | undefined, fmt: (n: number) => string): InputToken[] {
  const tokens: InputToken[] = [];
  if (result.description) tokens.push({ id: "note", text: result.description.toLowerCase(), field: "note" });
  if (result.amount !== null) tokens.push({ id: "amount", text: fmt(result.amount), field: "amount" });
  if (accountName) tokens.push({ id: "account", text: accountName.toLowerCase(), field: "accountId" });
  if (result.dateLabel) tokens.push({ id: "date", text: result.dateLabel.toLowerCase(), field: "date" });
  result.tags.forEach((tag) => tokens.push({ id: `tag-${tag}`, text: `#${tag}`, field: "tags" }));
  return tokens;
}

export function TransactionSheet() {
  const { open, editing, preset, session } = useUI((s) => s.transactionSheet);
  const close = useUI((s) => s.closeTransactionSheet);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && close()}
      title={editing ? "Edit transaction" : preset?.quickText ? `Confirm ${preset.type ?? "entry"}` : "Add transaction"}
      size="md"
    >
      {/* Keyed by session so drafts never leak between entries. */}
      <TransactionForm key={session} editing={editing} preset={preset} onDone={close} />
    </Sheet>
  );
}

function TransactionForm({ editing, preset, onDone }: { editing?: Transaction; preset?: ReturnType<typeof useUI.getState>["transactionSheet"]["preset"]; onDone: () => void }) {
  const { state, data, currency, today, fmt } = useFinance();
  const router = useRouter();
  const accounts = state.activeAccounts;

  const defaultAccount = useMemo(() => {
    const last = readLocal(LAST_ACCOUNT_KEY);
    if (last && accounts.some((a) => a.id === last)) return last;
    return accounts.find((a) => a.includeInSafeToSpend)?.id ?? accounts[0]?.id;
  }, [accounts]);

  // Text typed on the home composer is parsed once, up front.
  const initialParse = useMemo(
    () => (preset?.quickText ? parseSmartInput(preset.quickText, { categories: state.categories, accounts, today, currency }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parse only when the sheet opens
    [],
  );

  const [draft, setDraft] = useState<Draft>(() => {
    if (editing) {
      const from = accountCurrency(state.accountsById.get(editing.accountId), state.fx);
      const to = accountCurrency(state.accountsById.get(editing.toAccountId ?? ""), state.fx);
      return {
        type: editing.type,
        amount: minorToInput(editing.amount, from),
        toAmount: editing.toAmount !== undefined ? minorToInput(editing.toAmount, to) : "",
        categoryId: editing.categoryId,
        accountId: editing.accountId,
        toAccountId: editing.toAccountId,
        date: editing.date,
        time: editing.time ?? "",
        note: editing.note,
        tags: editing.tags.join(", "),
      };
    }
    const base: Draft = {
      type: preset?.type ?? "expense",
      amount: preset?.amount ? minorToInput(preset.amount, currency) : "",
      toAmount: "",
      categoryId: preset?.categoryId,
      accountId: preset?.accountId ?? defaultAccount,
      toAccountId: preset?.toAccountId,
      date: preset?.date ?? today,
      time: currentTime(),
      note: preset?.note ?? "",
      tags: "",
    };
    return initialParse ? applyParse(base, initialParse, new Set(), currency) : base;
  });
  const touched = useRef(new Set<DraftField>(editing ? ["amount", "categoryId", "accountId", "date", "note", "type"] : []));
  const [quick, setQuick] = useState(preset?.quickText ?? "");
  const [parsed, setParsed] = useState<SmartInputResult | null>(initialParse);

  // Fly each recognized word from the sentence into its field.
  const tokens = useMemo(
    () => (initialParse ? tokensFor(initialParse, initialParse.accountId ? state.accountsById.get(initialParse.accountId)?.name : undefined, (n) => fmt(n)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tokens are fixed for this sheet
    [],
  );
  const [landed, setLanded] = useState<Set<string>>(new Set());
  const [settled, setSettled] = useState(tokens.length === 0);
  useEffect(() => {
    if (!tokens.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = reduce ? 0 : 420;
    const step = reduce ? 0 : 230;
    const timers = tokens.map((token, i) => window.setTimeout(() => setLanded((prev) => new Set(prev).add(token.id)), start + i * step));
    timers.push(window.setTimeout(() => setSettled(true), start + tokens.length * step + (reduce ? 0 : 900)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [tokens]);
  const landedFor = (field: TokenField) => (settled ? [] : tokens.filter((t) => t.field === field && landed.has(t.id)));
  const highlight = (field: TokenField) => !settled && tokens.some((t) => t.field === field && landed.has(t.id));
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showDetails, setShowDetails] = useState(Boolean(editing?.tags.length));
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [saving, setSaving] = useState(false);
  // The keypad is how an amount gets entered, not a detour off the text
  // field: it opens with the sheet for a new transaction, writes through as
  // you tap, and keeps the device keyboard out of the way. Editing starts
  // closed — the amount is already right, and the rest of the form matters
  // more than re-typing it.
  const [calculator, setCalculator] = useState(() => !editing && !preset?.quickText && !preset?.scan);
  const [receipts, setReceipts] = useState<File[]>([]);
  const [scanning, setScanning] = useState(Boolean(preset?.scan));

  /** A scanned receipt fills the draft and keeps the photo with the transaction. */
  const applyScan = (result: ScannedReceipt) => {
    for (const field of ["type", "amount", "categoryId", "date", "note"] as const) touched.current.add(field);
    setDraft((d) => ({ ...d, type: "expense", amount: result.amount, categoryId: result.categoryId ?? d.categoryId, date: result.date, note: result.note || d.note }));
    setReceipts((current) => [...current, result.file].slice(0, 4));
    setShowDetails(true);
    setErrors({});
  };
  const amountRef = useRef<HTMLInputElement>(null);

  // Expenses you log often, one tap to repeat.
  const recents = useMemo(() => {
    if (editing || preset?.quickText || preset?.amount) return [];
    const since = addDays(today, -45);
    const seen = new Map<string, { tx: Transaction; count: number }>();
    for (const t of state.transactions) {
      if (t.date < since) break;
      if (t.type !== "expense" || t.receivableId || t.billId || !t.categoryId || !state.accountsById.get(t.accountId) || state.accountsById.get(t.accountId)?.archived) continue;
      const key = `${t.categoryId}|${t.note.trim().toLowerCase()}|${t.amount}`;
      const entry = seen.get(key);
      if (entry) entry.count++;
      else seen.set(key, { tx: t, count: 1 });
    }
    return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, 6).map((e) => e.tx);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suggestions are fixed while the sheet is open
  }, []);

  const repeat = (t: Transaction) => {
    const from = accountCurrency(state.accountsById.get(t.accountId), state.fx);
    for (const field of ["type", "amount", "categoryId", "accountId", "note"] as const) touched.current.add(field);
    setDraft((d) => ({ ...d, type: "expense", amount: minorToInput(t.amount, from), categoryId: t.categoryId, accountId: t.accountId, note: t.note }));
    setErrors({});
    void haptic("light");
  };

  const set = <K extends DraftField>(field: K, value: Draft[K], manual = true) => {
    if (manual) touched.current.add(field);
    setDraft((d) => ({ ...d, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const categories = useMemo(() => rankCategories(state.categories, data.transactions, draft.type === "income" ? "income" : "expense", today), [state.categories, data.transactions, draft.type, today]);
  const visibleCategories = showAllCategories ? categories : categories.slice(0, 8);
  const selectedHidden = draft.categoryId && !visibleCategories.some((c) => c.id === draft.categoryId) ? categories.find((c) => c.id === draft.categoryId) : undefined;

  const onQuickChange = (text: string) => {
    setQuick(text);
    if (!text.trim()) {
      setParsed(null);
      return;
    }
    const result = parseSmartInput(text, { categories: state.categories, accounts, today, currency });
    setParsed(result);
    setDraft((d) => applyParse(d, result, touched.current, currency));
    if (result.tags.length) setShowDetails(true);
    setErrors({});
  };

  const changeType = (type: TransactionType) => {
    touched.current.add("type");
    setDraft((d) => {
      const category = d.categoryId ? state.categoriesById.get(d.categoryId) : undefined;
      return { ...d, type, categoryId: category && category.kind === type ? d.categoryId : undefined };
    });
    setErrors({});
  };

  const fromCurrency = accountCurrency(state.accountsById.get(draft.accountId ?? ""), state.fx);
  const toCurrency = accountCurrency(state.accountsById.get(draft.toAccountId ?? ""), state.fx);
  const crossCurrency = draft.type === "transfer" && Boolean(draft.toAccountId) && fromCurrency !== toCurrency;
  const amountMinor = parseAmount(draft.amount, fromCurrency) ?? 0;
  const suggestedToAmount = crossCurrency ? convertMinor(amountMinor, fromCurrency, toCurrency, state.fx) : 0;
  const toAmountMinor = crossCurrency ? (parseAmount(draft.toAmount, toCurrency) ?? suggestedToAmount) : undefined;
  const fmtFrom = (minor: number) => (fromCurrency === currency ? fmt(minor) : formatMoney(minor, fromCurrency, { trimZeros: true }));
  const category = draft.categoryId ? state.categoriesById.get(draft.categoryId) : undefined;

  const save = async () => {
    const nextErrors: Partial<Record<DraftField, string>> = {};
    if (amountMinor <= 0) nextErrors.amount = "Enter an amount greater than zero.";
    if (!draft.accountId) nextErrors.accountId = accounts.length ? "Choose an account." : "Add an account first.";
    if (draft.type === "transfer") {
      if (!draft.toAccountId) nextErrors.toAccountId = "Choose where the money goes.";
      else if (draft.toAccountId === draft.accountId) nextErrors.toAccountId = "Pick a different account.";
      else if (crossCurrency && !toAmountMinor) nextErrors.toAmount = "Enter how much arrives.";
    } else if (!draft.categoryId) {
      nextErrors.categoryId = "Choose a category.";
    }
    if (!isValidISODate(draft.date)) nextErrors.date = "Choose a valid date.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      void haptic("warning");
      if (nextErrors.amount) amountRef.current?.focus();
      return;
    }

    setSaving(true);
    const input = {
      type: draft.type,
      amount: amountMinor,
      accountId: draft.accountId!,
      toAccountId: draft.type === "transfer" ? draft.toAccountId : undefined,
      toAmount: crossCurrency ? toAmountMinor : undefined,
      categoryId: draft.type === "transfer" ? undefined : draft.categoryId,
      date: draft.date,
      time: /^\d{2}:\d{2}$/.test(draft.time) ? draft.time : undefined,
      note: draft.note,
      tags: draft.tags.split(/[,\s#]+/).filter(Boolean),
    };

    try {
      let savedId: ID;
      if (editing) {
        const previous = editing;
        await updateTransaction(editing.id, input);
        savedId = editing.id;
        toast.success("Changes saved", {
          action: { label: "Undo", onClick: () => restoreTransactions([previous]) },
        });
      } else {
        const created = await addTransaction(input);
        savedId = created.id;
        writeLocal(LAST_ACCOUNT_KEY, created.accountId);
        toast.success(successMessage(draft.type, fmtFrom(amountMinor), category?.name), {
          description: fromCurrency === currency ? budgetNote(state, created, fmt) : undefined,
          action: { label: "Undo", onClick: () => void deleteTransaction(created.id) },
        });
      }
      if (receipts.length) {
        // The transaction is saved either way; a photo that fails is reported on its own.
        await Promise.all(receipts.map((file) => addReceipt(savedId, file))).catch((e) => toast.error(e, "The receipt photo couldn't be saved."));
      }
      void haptic("success");
      onDone();
    } catch (error) {
      toast.error(error);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const removed = await deleteTransaction(editing.id);
    onDone();
    if (removed) {
      toast.show("Transaction deleted", { action: { label: "Undo", onClick: () => restoreTransactions([removed]) } });
    }
  };

  if (!accounts.length) {
    return (
      <div className="py-6 text-center">
        <p className="text-title-3 font-bold">Add an account first</p>
        <p className="mt-1 text-body text-ink-2">Owwy needs to know where your money is — cash, a bank, or an e-wallet.</p>
        <Button className="mt-5" onClick={() => { onDone(); router.push("/accounts/?new=1"); }}>
          Add an account
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      {!editing ? (
        <div>
          {tokens.length && landed.size < tokens.length ? (
            <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl border border-brand/50 bg-surface px-3 py-2" aria-hidden>
              <Sparkles className="mr-0.5 size-[18px] shrink-0 text-accent" />
              {tokens
                .filter((t) => !landed.has(t.id))
                .map((t) => (
                  <TokenChip key={t.id} token={t} />
                ))}
            </div>
          ) : (
            <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-dashed border-line-strong bg-surface px-3.5 focus-within:border-solid focus-within:border-brand">
              <Sparkles className="size-[18px] shrink-0 text-accent" aria-hidden />
              <span className="sr-only">Quick add</span>
              <input
                value={quick}
                onChange={(e) => onQuickChange(e.target.value)}
                placeholder="Quick add: coffee 180 cash"
                className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-3"
                autoComplete="off"
                enterKeyHint="done"
                aria-describedby="quick-hint"
              />
              <button
                type="button"
                onClick={() => setScanning(true)}
                aria-label="Scan a receipt"
                title="Scan a receipt"
                className="press -mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                <ScanLine className="size-[19px]" aria-hidden />
              </button>
            </label>
          )}
          <QuickHint parsed={parsed} onPick={(id) => set("categoryId", id)} categories={state.categoriesById} />
          {recents.length && !quick ? (
            <div className="mt-3">
              <p className="mb-1.5 px-1 text-caption font-semibold text-ink-3">Again?</p>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
                {recents.map((t) => {
                  const c = t.categoryId ? state.categoriesById.get(t.categoryId) : undefined;
                  const code = accountCurrency(state.accountsById.get(t.accountId), state.fx);
                  const active = draft.categoryId === t.categoryId && draft.note === t.note && parseAmount(draft.amount, code) === t.amount && draft.type === "expense";
                  return (
                    <Chip key={t.id} selected={active} onClick={() => repeat(t)} className="h-10 max-w-[220px]">
                      <span aria-hidden>{c?.emoji}</span>
                      <span className="truncate">{t.note || c?.name}</span>
                      <span className={cn("tabular shrink-0", active ? "opacity-80" : "text-ink-3")}>{code === currency ? fmt(t.amount, { trimZeros: true }) : formatMoney(t.amount, code, { trimZeros: true })}</span>
                    </Chip>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <Segmented
        label="Transaction type"
        value={draft.type}
        onChange={changeType}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
          { value: "transfer", label: "Transfer" },
        ]}
      />

      <div className="relative">
        <Field label="Amount" error={errors.amount} hideLabel>
          {(props) => (
            <AmountInput
              ref={amountRef}
              size="xl"
              value={draft.amount}
              onValueChange={(v) => set("amount", v)}
              currency={fromCurrency}
              aria-label="Amount"
              // While the keypad is up it owns the input: the device keyboard
              // would otherwise slide over it and the two would compete for
              // the same field. The field stays focusable and editable.
              inputMode={calculator ? "none" : "decimal"}
              className={cn("pr-16 transition-shadow duration-500", highlight("amount") && "shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_35%,transparent)]")}
              {...props}
            />
          )}
        </Field>
        <TokenLanding tokens={landedFor("amount")} className="absolute top-[38px] right-16 -translate-y-1/2" />
        <button
          type="button"
          onClick={() => setCalculator((v) => !v)}
          aria-pressed={calculator}
          aria-label={calculator ? "Hide calculator" : "Show calculator"}
          className={cn(
            "press absolute top-[38px] right-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-2xl",
            calculator ? "bg-brand text-brand-ink" : "bg-surface text-ink-2 shadow-xs hover:text-ink",
          )}
        >
          <Calculator className="size-5" aria-hidden />
        </button>
        <AnimatePresence initial={false}>
          {calculator ? (
            <AmountKeypad
              key="keypad"
              initial={draft.amount}
              currency={fromCurrency}
              onInput={(value) => set("amount", value)}
              onUse={(value) => set("amount", value)}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {draft.type === "transfer" ? (
        <>
          <AccountPicker label="From" value={draft.accountId} onChange={(id) => set("accountId", id)} error={errors.accountId} />
          <AccountPicker label="To" value={draft.toAccountId} onChange={(id) => set("toAccountId", id)} error={errors.toAccountId} exclude={draft.accountId} />
          {crossCurrency ? (
            <div className="rounded-2xl border border-line/70 p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-callout font-semibold text-ink-2">
                <ArrowDown className="size-4 text-brand" aria-hidden />
                {state.accountsById.get(draft.toAccountId ?? "")?.name} receives
              </p>
              <Field label={`Amount received in ${toCurrency}`} error={errors.toAmount} hideLabel>
                {(props) => (
                  <AmountInput
                    {...props}
                    value={draft.toAmount}
                    onValueChange={(v) => set("toAmount", v)}
                    currency={toCurrency}
                    placeholder={suggestedToAmount ? minorToInput(suggestedToAmount, toCurrency) : "0"}
                  />
                )}
              </Field>
              <p className="mt-1.5 text-caption text-ink-3">
                <RateHint from={fromCurrency} to={toCurrency} amount={amountMinor} received={draft.toAmount ? toAmountMinor : undefined} />
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <fieldset>
            <legend className="mb-2 text-callout font-semibold text-ink-2">Category</legend>
            <div className="grid grid-cols-4 gap-2">
              {[...(selectedHidden ? [selectedHidden] : []), ...visibleCategories].map((c) => {
                const selected = c.id === draft.categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => set("categoryId", c.id)}
                    className={cn(
                      "press flex min-h-[86px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-2 text-caption font-semibold outline-none transition-colors",
                      selected ? "border-brand bg-brand-soft text-brand-soft-ink" : "border-line/70 bg-surface text-ink-2 hover:border-line-strong",
                    )}
                  >
                    {/* The category's own colour carries the tile, so the grid
                        is scannable by shape and hue before any label is read. */}
                    <span
                      className={cn(
                        "flex size-11 items-center justify-center rounded-2xl text-[22px] leading-none transition-transform",
                        selected && "scale-105",
                      )}
                      style={{ background: `color-mix(in srgb, ${c.color} ${selected ? 30 : 16}%, transparent)` }}
                      aria-hidden
                    >
                      {c.emoji}
                    </span>
                    <span className="w-full truncate text-center">{c.name}</span>
                  </button>
                );
              })}
            </div>
            {categories.length > 8 ? (
              <button type="button" onClick={() => setShowAllCategories((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-callout font-semibold text-brand">
                {showAllCategories ? "Show fewer" : `All ${categories.length} categories`}
                <ChevronDown className={cn("size-4 transition-transform", showAllCategories && "rotate-180")} aria-hidden />
              </button>
            ) : null}
            {errors.categoryId ? <p role="alert" className="mt-1.5 text-caption font-medium text-negative">{errors.categoryId}</p> : null}
          </fieldset>
          <AccountPicker
            label={draft.type === "income" ? "Received in" : "Paid from"}
            value={draft.accountId}
            onChange={(id) => set("accountId", id)}
            error={errors.accountId}
            landing={<TokenLanding tokens={landedFor("accountId")} />}
          />
        </>
      )}

      <fieldset>
        <legend className="mb-2 flex w-full items-center justify-between text-callout font-semibold text-ink-2">
          Date & time
          <TokenLanding tokens={landedFor("date")} />
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          <Chip selected={draft.date === today} onClick={() => set("date", today)}>Today</Chip>
          <Chip selected={draft.date === addDays(today, -1)} onClick={() => set("date", addDays(today, -1))}>Yesterday</Chip>
          <label className={cn("relative inline-flex h-9 items-center rounded-full border px-3.5 text-callout font-semibold", draft.date !== today && draft.date !== addDays(today, -1) ? "border-ink bg-ink text-ink-inverse" : "border-line bg-surface text-ink-2")}>
            {draft.date !== today && draft.date !== addDays(today, -1) ? formatShortDate(draft.date, today) : "Pick a date"}
            <input
              type="date"
              value={draft.date}
              max={addDays(today, 366)}
              onChange={(e) => e.target.value && set("date", e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Transaction date"
            />
          </label>
          <input
            type="time"
            value={draft.time}
            onChange={(e) => set("time", e.target.value)}
            aria-label="Time (optional)"
            className="tabular h-9 rounded-full border border-line bg-surface px-3 text-callout font-semibold text-ink-2 outline-none focus:border-brand"
          />
        </div>
        {errors.date ? <p role="alert" className="mt-1.5 text-caption font-medium text-negative">{errors.date}</p> : null}
      </fieldset>

      <Field label="Note" trailing={<TokenLanding tokens={landedFor("note")} />}>
        {(props) => (
          <TextInput
            {...props}
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder={draft.type === "income" ? "e.g. Salary" : draft.type === "transfer" ? "e.g. Top up" : "e.g. Lunch with team"}
            maxLength={140}
            className={cn("transition-shadow duration-500", highlight("note") && "shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_35%,transparent)]")}
          />
        )}
      </Field>

      {showDetails || receipts.length ? (
        <>
          <Field label="Tags" hint="Separate with commas, e.g. work, trip">
            {(props) => <TextInput {...props} value={draft.tags} onChange={(e) => set("tags", e.target.value)} placeholder="work, family" />}
          </Field>
          {draft.type !== "transfer" ? <ReceiptPicker transactionId={editing?.id} pending={receipts} onPendingChange={setReceipts} /> : null}
        </>
      ) : (
        <button type="button" onClick={() => setShowDetails(true)} className="-mt-2 self-start text-callout font-semibold text-brand">
          + Tags or receipt photo
        </button>
      )}

      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line/60 bg-bg-elevated px-5 pt-3 pb-1">
        {editing ? (
          <Button variant="dangerSoft" size="xl" onClick={remove} aria-label="Delete transaction" className="px-5">
            <Trash />
          </Button>
        ) : preset?.quickText ? (
          <Button variant="outline" size="xl" onClick={onDone} className="flex-1">
            Cancel
          </Button>
        ) : null}
        <ScanReceiptSheet open={scanning} onOpenChange={setScanning} onUse={applyScan} />
        <Button type="submit" size="xl" className="flex-1" loading={saving}>
          {editing ? "Save changes" : preset?.quickText ? "Confirm" : amountMinor > 0 ? `Add ${fmtFrom(amountMinor)} ${draft.type}` : `Add ${draft.type}`}
        </Button>
      </div>
    </form>
  );
}

function QuickHint({ parsed, onPick, categories }: { parsed: SmartInputResult | null; onPick: (id: ID) => void; categories: Map<ID, Category> }) {
  const { fmt, state } = useFinance();
  if (!parsed) {
    return (
      <p id="quick-hint" className="mt-1.5 px-1 text-caption text-ink-3">
        Type naturally — Owwy fills in the details.
      </p>
    );
  }
  const category = parsed.categoryId ? categories.get(parsed.categoryId) : undefined;
  const account = parsed.accountId ? state.accountsById.get(parsed.accountId) : undefined;
  const bits = [
    parsed.amount !== null ? fmt(parsed.amount) : null,
    parsed.type === "transfer" ? "Transfer" : category ? `${category.emoji} ${category.name}` : null,
    account?.name,
    parsed.dateLabel,
  ].filter(Boolean);

  const askCategory = parsed.type !== "transfer" && !parsed.categoryId && parsed.categoryCandidates.length > 1;

  return (
    <div id="quick-hint" className="mt-1.5 px-1" aria-live="polite">
      {bits.length ? (
        <p className="text-caption text-ink-2">
          <span className="font-semibold text-brand">Got it:</span> {bits.join(" · ")}
        </p>
      ) : null}
      {askCategory ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-caption font-semibold text-ink-2">Which one?</span>
          {parsed.categoryCandidates.slice(0, 3).map((id) => {
            const c = categories.get(id);
            return c ? (
              <Chip key={id} onClick={() => onPick(id)} className="h-8">
                {c.emoji} {c.name}
              </Chip>
            ) : null;
          })}
        </div>
      ) : parsed.needs.includes("amount") ? (
        <p className="text-caption text-ink-3">Add an amount, like “{parsed.description || "coffee"} 180”.</p>
      ) : null}
    </div>
  );
}

function TokenChip({ token }: { token: InputToken }) {
  return (
    <m.span
      layoutId={`token-${token.id}`}
      transition={{ type: "spring", damping: 26, stiffness: 320 }}
      className="inline-flex h-7 items-center rounded-full bg-brand-soft px-2.5 text-callout font-semibold whitespace-nowrap text-brand-soft-ink"
    >
      {token.text}
    </m.span>
  );
}

/** Where a flying token lands; it lingers briefly, then fades. */
function TokenLanding({ tokens, className }: { tokens: InputToken[]; className?: string }) {
  return (
    <span className={cn("pointer-events-none flex gap-1", className)} aria-hidden>
      <AnimatePresence>
        {tokens.map((t) => (
          <m.span key={t.id} exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.25 } }}>
            <TokenChip token={t} />
          </m.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

/** The effective exchange rate of a transfer, or the rate Owwy will assume. */
function RateHint({ from, to, amount, received }: { from: CurrencyCode; to: CurrencyCode; amount: number; received?: number }) {
  const { state, currency } = useFinance();
  if (received && amount) {
    const rate = amount / minorFactor(from) / (received / minorFactor(to));
    return <>Your rate: 1 {to} = {formatMoney(toMinor(rate, from), from, { trimZeros: true })}</>;
  }
  const foreign = to === currency ? from : to;
  return (
    <>
      Leave empty to use 1 {foreign} ≈ {formatMoney(toMinor(rateToBase(foreign, state.fx), currency), currency, { trimZeros: true })}. Enter what actually arrived for accuracy.
    </>
  );
}

function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function AccountPicker({ label, value, onChange, error, exclude, landing }: { label: string; value?: ID; onChange: (id: ID) => void; error?: string; exclude?: ID; landing?: React.ReactNode }) {
  const { state, today } = useFinance();
  // "Recently" used accounts first.
  const ordered = useMemo(() => {
    const since = addDays(today, -30);
    const uses = new Map<ID, number>();
    for (const t of state.transactions) {
      if (t.date < since) break;
      uses.set(t.accountId, (uses.get(t.accountId) ?? 0) + 1);
    }
    return [...state.activeAccounts].sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0));
  }, [state.transactions, state.activeAccounts, today]);

  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-center justify-between text-callout font-semibold text-ink-2">
        {label}
        {landing}
      </legend>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {ordered
          .filter((a) => a.id !== exclude)
          .map((account) => {
            const selected = account.id === value;
            const style = getCardStyle(account.cardStyle);
            return (
              <button
                key={account.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(account.id)}
                className={cn(
                  "press flex h-14 shrink-0 items-center gap-2.5 rounded-2xl border py-2 pr-4 pl-2 text-left outline-none",
                  selected ? "border-brand bg-brand-soft" : "border-line/70 bg-surface hover:border-line-strong",
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-xl text-[18px]" style={{ background: style.background }} aria-hidden>
                  {ACCOUNT_TYPES[account.type].emoji}
                </span>
                <span className="flex flex-col">
                  <span className={cn("text-callout font-semibold", selected ? "text-brand-soft-ink" : "text-ink")}>{account.name}</span>
                  <Money value={state.balances.get(account.id) ?? 0} currency={account.currency} className="text-caption text-ink-3" />
                </span>
              </button>
            );
          })}
      </div>
      {error ? <p role="alert" className="mt-1.5 text-caption font-medium text-negative">{error}</p> : null}
    </fieldset>
  );
}

/** Most-used categories first (last 90 days), then the default order. */
function rankCategories(categories: Category[], transactions: Transaction[], kind: "expense" | "income", today: ISODate): Category[] {
  const since = addDays(today, -90);
  const counts = new Map<ID, number>();
  for (const tx of transactions) {
    if (tx.date >= since && tx.categoryId) counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
  }
  return categories
    .filter((c) => c.kind === kind && !c.archived)
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.order - b.order);
}

function successMessage(type: TransactionType, amount: string, category?: string) {
  if (type === "income") return `Added ${amount} income${category ? ` · ${category}` : ""}`;
  if (type === "transfer") return `Moved ${amount}`;
  return `Added ${amount}${category ? ` · ${category}` : ""}`;
}

/** A gentle heads-up when an expense pushes a budget near or over its limit. */
function budgetNote(state: ReturnType<typeof useFinance>["state"], tx: Transaction, fmt: (n: number) => string): string | undefined {
  if (tx.type !== "expense" || !tx.categoryId || tx.date.slice(0, 7) !== state.month) return undefined;
  const progress = state.budgetProgress.find((b) => b.budget.categoryId === tx.categoryId && !b.budget.paused);
  if (!progress) return undefined;
  const spent = progress.spent + tx.amount;
  const percent = (spent / progress.budget.amount) * 100;
  if (percent > 100) return `${progress.category?.name} is ${fmt(spent - progress.budget.amount)} over budget.`;
  if (percent >= 85) return `${progress.category?.name} is at ${Math.round(percent)}% of its budget.`;
  return `${fmt(progress.budget.amount - spent)} left in ${progress.category?.name}.`;
}
