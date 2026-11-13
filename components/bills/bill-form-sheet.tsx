"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { AmountInput, Field, Select, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { addDays } from "@/lib/dates";
import { minorToInput, parseAmount } from "@/lib/money";
import { createBill, deleteBill, restoreBill, updateBill } from "@/lib/storage/repositories/bills";
import { toast } from "@/stores/ui";
import type { Bill, Frequency } from "@/types/models";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  once: "One time",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Every 3 months",
  yearly: "Yearly",
};

const BILL_EMOJIS = ["💡", "🌐", "💧", "📶", "🏠", "🎬", "🎵", "☁️", "🚗", "🛡️", "🎓", "💳", "🏋️", "📺", "🔥", "🧾"];

export function BillFormSheet({ open, onOpenChange, bill }: { open: boolean; onOpenChange: (o: boolean) => void; bill?: Bill }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={bill ? "Edit bill" : "New bill"} description={bill ? undefined : "Recurring bills and subscriptions you pay yourself."}>
      {open ? <BillForm bill={bill} onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function BillForm({ bill, onDone }: { bill?: Bill; onDone: () => void }) {
  const { state, currency, today } = useFinance();
  const expenseCategories = state.categories.filter((c) => c.kind === "expense" && !c.archived);
  const [name, setName] = useState(bill?.name ?? "");
  const [emoji, setEmoji] = useState(bill?.emoji ?? "🧾");
  const [amount, setAmount] = useState(bill ? minorToInput(bill.amount, currency) : "");
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? "cat_utilities");
  const [accountId, setAccountId] = useState(bill?.accountId ?? "");
  const [frequency, setFrequency] = useState<Frequency>(bill?.frequency ?? "monthly");
  const [dueDate, setDueDate] = useState(bill?.nextDueDate ?? addDays(today, 7));
  const [remind, setRemind] = useState(String(bill?.remindDaysBefore ?? 2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const minor = parseAmount(amount, currency);
    if (!name.trim()) return setError("Name this bill.");
    if (!minor) return setError("Enter the usual amount.");
    setSaving(true);
    const input = { name, emoji, amount: minor, categoryId, accountId: accountId || undefined, frequency, nextDueDate: dueDate, remindDaysBefore: Number(remind) };
    try {
      if (bill) await updateBill(bill.id, { ...input, accountId: accountId || "" });
      else await createBill(input);
      toast.success(bill ? "Bill updated" : `${emoji} ${name} added`);
      onDone();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <EmojiPicker label="Icon" value={emoji} onChange={setEmoji} options={BILL_EMOJIS} />
      <Field label="Name" error={error && !name.trim() ? error : null}>
        {(props) => <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electricity" maxLength={40} />}
      </Field>
      <Field label="Usual amount" error={error && name.trim() ? error : null} hint="You can adjust the exact amount each time you pay.">
        {(props) => <AmountInput {...props} value={amount} onValueChange={setAmount} currency={currency} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Repeats">
          {(props) => (
            <Select {...props} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {(Object.keys(FREQUENCY_LABELS) as Frequency[]).filter((f) => f !== "daily").map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={bill ? "Next due" : "First due date"}>
          {(props) => <TextInput {...props} type="date" value={dueDate} onChange={(e) => e.target.value && setDueDate(e.target.value)} />}
        </Field>
      </div>
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Usually paid from">
          {(props) => (
            <Select {...props} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Any account</option>
              {state.mainAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Remind me">
          {(props) => (
            <Select {...props} value={remind} onChange={(e) => setRemind(e.target.value)}>
              <option value="0">On the day</option>
              <option value="1">1 day before</option>
              <option value="2">2 days before</option>
              <option value="3">3 days before</option>
              <option value="7">A week before</option>
            </Select>
          )}
        </Field>
      </div>

      <div className="flex gap-2">
        {bill ? (
          <Button
            variant="dangerSoft"
            size="xl"
            onClick={async () => {
              const removed = await deleteBill(bill.id);
              onDone();
              if (removed) toast.show(`${bill.name} removed`, { description: "Past payments stay in your history.", action: { label: "Undo", onClick: () => restoreBill(removed) } });
            }}
          >
            Delete
          </Button>
        ) : null}
        <Button size="xl" className="flex-1" onClick={save} loading={saving}>
          {bill ? "Save changes" : "Add bill"}
        </Button>
      </div>
    </div>
  );
}
