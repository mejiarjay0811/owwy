"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmojiTile } from "@/components/ui/display";
import { AmountInput, Field, Select, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { relativeDatePhrase } from "@/lib/dates";
import { minorToInput, parseAmount } from "@/lib/money";
import { haptic } from "@/lib/platform";
import { payBill, undoBillPayment } from "@/lib/storage/repositories/bills";
import { toast } from "@/stores/ui";
import type { Bill } from "@/types/models";

export function PayBillSheet({ bill, onOpenChange }: { bill: Bill | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={Boolean(bill)} onOpenChange={onOpenChange} title="Mark as paid" description="Records the payment and moves the bill to its next due date." size="sm">
      {bill ? <PayBillForm bill={bill} onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function PayBillForm({ bill, onDone }: { bill: Bill; onDone: () => void }) {
  const { state, currency, today, fmt } = useFinance();
  const [amount, setAmount] = useState(minorToInput(bill.amount, currency));
  const [accountId, setAccountId] = useState(bill.accountId && state.accountsById.has(bill.accountId) ? bill.accountId : (state.mainAccounts.find((a) => a.includeInSafeToSpend)?.id ?? ""));
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    const minor = parseAmount(amount, currency);
    if (!minor) return setError("Enter the amount you paid.");
    if (!accountId) return setError("Choose the account you paid from.");
    setSaving(true);
    try {
      const result = await payBill(bill.id, { accountId, amount: minor, date });
      void haptic("success");
      toast.success(`${bill.name} paid · ${fmt(minor)}`, {
        description: result.updated.active ? `Next due ${relativeDatePhrase(result.updated.nextDueDate, today)}` : "One-time bill completed",
        action: { label: "Undo", onClick: () => undoBillPayment(result) },
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
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <EmojiTile emoji={bill.emoji} color={state.categoriesById.get(bill.categoryId)?.color} />
        <div className="min-w-0">
          <p className="font-bold">{bill.name}</p>
          <p className="text-caption text-ink-3">Due {relativeDatePhrase(bill.nextDueDate, today)}</p>
        </div>
      </div>
      <Field label="Amount paid" hint="Bills change month to month — adjust if needed." error={error}>
        {(props) => <AmountInput {...props} value={amount} onValueChange={(v) => { setAmount(v); setError(null); }} currency={currency} />}
      </Field>
      <Field label="Paid from">
        {(props) => (
          <Select {...props} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {state.mainAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Payment date">{(props) => <TextInput {...props} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}</Field>
      <Button size="xl" onClick={pay} loading={saving} className="mt-1 w-full">
        Mark {bill.name} paid
      </Button>
    </div>
  );
}
