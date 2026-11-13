"use client";

import { Plus, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Money } from "@/components/ui/display";
import { AmountInput, Field, Segmented, Select, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { addDays, formatShortDate } from "@/lib/dates";
import { checkSplit, customShares, evenShares } from "@/lib/finance/split";
import { parseAmount } from "@/lib/money";
import { haptic } from "@/lib/platform";
import { saveSplitBill, undoSplitBill } from "@/lib/services/split";
import { cn } from "@/lib/utils/cn";
import { createId } from "@/lib/utils/id";
import { toast } from "@/stores/ui";

interface Person {
  key: string;
  name: string;
  /** Typed share, used only in custom mode. */
  amount: string;
}

export function SplitBillSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Split a bill" description="You paid for everyone — Owwy logs your share and tracks the rest as money owed to you." size="sm">
      {open ? <SplitBillForm onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function SplitBillForm({ onDone }: { onDone: () => void }) {
  const { state, currency, today, fmt } = useFinance();
  const accounts = state.mainAccounts.filter((a) => a.type !== "credit");
  const expenseCategories = state.categories.filter((c) => c.kind === "expense" && !c.archived);

  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState(accounts.find((a) => a.includeInSafeToSpend)?.id ?? accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(expenseCategories.find((c) => c.id === "cat_food")?.id ?? expenseCategories[0]?.id ?? "");
  const [mode, setMode] = useState<"even" | "custom">("even");
  const [people, setPeople] = useState<Person[]>([{ key: createId("p"), name: "", amount: "" }]);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalMinor = parseAmount(total, currency) ?? 0;
  const shares = useMemo(
    () =>
      mode === "even"
        ? evenShares(totalMinor, people.map((p) => p.name))
        : customShares(totalMinor, people.map((p) => ({ person: p.name, amount: parseAmount(p.amount, currency) ?? 0 }))),
    [mode, totalMinor, people, currency],
  );
  const check = checkSplit(totalMinor, shares);
  const yourShare = shares.find((s) => s.isYou)?.amount ?? 0;

  const update = (key: string, patch: Partial<Person>) => setPeople((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const save = async () => {
    if (!check.valid) return setError(check.problem);
    if (!accountId) return setError("Choose the account you paid from.");
    setSaving(true);
    try {
      const result = await saveSplitBill({
        description,
        date,
        accountId,
        categoryId,
        yourShare,
        others: shares.filter((s) => !s.isYou).map((s) => ({ person: s.person, amount: s.amount })),
        dueDate: dueDate || undefined,
      });
      void haptic("success");
      toast.success(`${fmt(result.total)} split ${shares.length} ways`, {
        description: `${fmt(result.owed)} owed to you · ${fmt(yourShare)} logged as yours`,
        action: { label: "Undo", onClick: () => undoSplitBill(result) },
      });
      onDone();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!accounts.length) {
    return <p className="py-6 text-center text-body text-ink-2">Add an account first — Owwy needs to know where the money came from.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="What was it for?">
        {(props) => <TextInput {...props} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Dinner at Samgyup" maxLength={80} autoFocus />}
      </Field>

      <Field label="Total you paid" error={error && totalMinor <= 0 ? error : null}>
        {(props) => <AmountInput {...props} size="xl" value={total} onValueChange={(v) => { setTotal(v); setError(null); }} currency={currency} />}
      </Field>

      <Segmented
        label="How to split"
        size="sm"
        value={mode}
        onChange={setMode}
        options={[
          { value: "even", label: "Split evenly" },
          { value: "custom", label: "Different amounts" },
        ]}
      />

      <fieldset>
        <legend className="mb-2 flex w-full items-center gap-1.5 text-callout font-semibold text-ink-2">
          <Users className="size-4" aria-hidden />
          Splitting with
        </legend>
        <ul className="flex flex-col gap-2">
          {people.map((person, index) => (
            <li key={person.key} className="flex items-center gap-2">
              <TextInput
                value={person.name}
                onChange={(e) => update(person.key, { name: e.target.value })}
                placeholder={`Person ${index + 1}`}
                maxLength={40}
                aria-label={`Name of person ${index + 1}`}
                className="min-w-0 flex-1"
              />
              {mode === "custom" ? (
                <div className="w-[38%] max-w-[150px]">
                  <AmountInput value={person.amount} onValueChange={(v) => update(person.key, { amount: v })} currency={currency} aria-label={`${person.name || `Person ${index + 1}`}'s share`} />
                </div>
              ) : (
                <span className="tabular w-[30%] max-w-[120px] text-right text-callout font-semibold text-ink-2">
                  <Money value={shares[index + 1]?.amount ?? 0} />
                </span>
              )}
              <IconButton
                size="sm"
                label={`Remove person ${index + 1}`}
                disabled={people.length === 1}
                onClick={() => setPeople((list) => list.filter((p) => p.key !== person.key))}
              >
                <X />
              </IconButton>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPeople((list) => [...list, { key: createId("p"), name: "", amount: "" }])}>
          <Plus />
          Add person
        </Button>
      </fieldset>

      <div className="rounded-2xl bg-surface-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">Your share</span>
          <Money value={yourShare} className={cn("text-title-3 font-extrabold", yourShare < 0 && "text-negative")} />
        </div>
        <p className="mt-1 text-caption text-ink-3">
          {check.owed > 0 ? (
            <>
              <Money value={check.owed} className="font-semibold text-ink-2" /> becomes money owed to you
            </>
          ) : (
            "Their shares appear under Owed to you."
          )}
        </p>
        {mode === "custom" && yourShare > 0 && totalMinor > 0 ? (
          <p className="mt-1 text-caption text-ink-3">Whatever isn&apos;t assigned stays yours.</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Paid from">
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
        <Field label="Category">
          {(props) => (
            <Select {...props} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">{(props) => <TextInput {...props} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} max={addDays(today, 1)} />}</Field>
        <Field label="Pay you back by" hint="Optional">
          {(props) => <TextInput {...props} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
        </Field>
      </div>

      {error && totalMinor > 0 ? (
        <p role="alert" className="rounded-xl bg-negative-soft px-3 py-2 text-callout text-negative">
          {error}
        </p>
      ) : null}

      <Button size="xl" onClick={save} loading={saving} disabled={!check.valid}>
        {check.valid ? `Split ${fmt(totalMinor)} · ${shares.length} people` : check.problem ?? "Split"}
      </Button>
      <p className="-mt-2 text-center text-caption text-ink-3">
        Logged on {formatShortDate(date, today)} · only your share counts as spending
      </p>
    </div>
  );
}
