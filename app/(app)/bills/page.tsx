"use client";

import { BellRing, CalendarDays, CircleCheck, Plus, SkipForward } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { BillFormSheet, FREQUENCY_LABELS } from "@/components/bills/bill-form-sheet";
import { PayBillSheet } from "@/components/bills/pay-bill-sheet";
import { Page, PageHeader } from "@/components/layout/page";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Badge, Card, EmojiTile, EmptyState, Money } from "@/components/ui/display";
import { useFinance } from "@/hooks/use-finance";
import { addDays, relativeDatePhrase } from "@/lib/dates";
import { billStatus, monthlyEquivalent, type BillStatus } from "@/lib/finance/bills";
import { isNative } from "@/lib/platform";
import { restoreBill, skipBill } from "@/lib/storage/repositories/bills";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { Bill } from "@/types/models";

const SECTIONS: { status: BillStatus; title: string }[] = [
  { status: "overdue", title: "Overdue" },
  { status: "dueSoon", title: "Due soon" },
  { status: "upcoming", title: "Coming up" },
  { status: "paid", title: "Paid this month" },
  { status: "inactive", title: "Finished" },
];

export default function BillsPage() {
  return (
    <Suspense>
      <BillsScreen />
    </Suspense>
  );
}

function BillsScreen() {
  const { data, today, state } = useFinance();
  const params = useSearchParams();
  const [form, setForm] = useState<{ bill?: Bill } | null>(() => (params.get("new") ? {} : null));
  const [paying, setPaying] = useState<Bill | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<BillStatus, Bill[]>();
    for (const bill of [...data.bills].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))) {
      const status = billStatus(bill, today);
      map.set(status, [...(map.get(status) ?? []), bill]);
    }
    return map;
  }, [data.bills, today]);

  const monthlyTotal = data.bills.filter((b) => b.active).reduce((t, b) => t + monthlyEquivalent(b.amount, b.frequency), 0);
  const next30 = state.upcomingBills.filter((o) => o.date <= addDays(today, 30)).reduce((t, o) => t + o.amount, 0);

  return (
    <Page>
      <PageHeader
        title="Bills"
        back="/more/"
        subtitle="Everything you need to pay, and what's already handled."
        actions={
          <>
            <ButtonLink href="/calendar/" variant="ghost" size="sm" className="max-sm:hidden">
              <CalendarDays />
              Calendar
            </ButtonLink>
            <Button size="sm" onClick={() => setForm({})}>
              <Plus />
              Bill
            </Button>
          </>
        }
      />

      {data.bills.length === 0 ? (
        <Card>
          <EmptyState
            mood="thinking"
            title="No bills yet"
            description="Add electricity, internet, rent or subscriptions. Owwy keeps them out of your Safe to Spend until they're paid."
            action={
              <Button onClick={() => setForm({})}>
                <Plus />
                Add a bill
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-caption font-semibold text-ink-3">Due in the next 30 days</p>
              <p className="mt-1 text-title-2 font-extrabold">
                <Money value={next30} />
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-caption font-semibold text-ink-3">Bills cost about</p>
              <p className="mt-1 text-title-2 font-extrabold">
                <Money value={monthlyTotal} />
                <span className="text-callout font-semibold text-ink-3"> /mo</span>
              </p>
            </Card>
          </div>

          <div className="flex flex-col gap-7">
            {SECTIONS.map(({ status, title }) => {
              const bills = grouped.get(status);
              if (!bills?.length) return null;
              return (
                <section key={status} aria-labelledby={`bills-${status}`}>
                  <h2 id={`bills-${status}`} className={cn("mb-2 px-1 text-eyebrow font-bold tracking-[0.09em] uppercase", status === "overdue" ? "text-negative" : "text-ink-3")}>
                    {title}
                  </h2>
                  <Card as="section" className="divide-y divide-line/60">
                    {bills.map((bill) => (
                      <BillRow key={bill.id} bill={bill} status={status} onPay={() => setPaying(bill)} onEdit={() => setForm({ bill })} />
                    ))}
                  </Card>
                </section>
              );
            })}
          </div>

          <p className="mt-8 flex items-start gap-2 px-1 text-caption text-ink-3">
            <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
            {isNative()
              ? "Reminders arrive on this device before each due date."
              : "Owwy reminds you inside the app. Install the mobile app for on-device notifications."}
          </p>
        </>
      )}

      <BillFormSheet open={Boolean(form)} onOpenChange={(o) => !o && setForm(null)} bill={form?.bill} />
      <PayBillSheet bill={paying} onOpenChange={(o) => !o && setPaying(null)} />
    </Page>
  );
}

function BillRow({ bill, status, onPay, onEdit }: { bill: Bill; status: BillStatus; onPay: () => void; onEdit: () => void }) {
  const { state, today } = useFinance();
  const category = state.categoriesById.get(bill.categoryId);
  const account = bill.accountId ? state.accountsById.get(bill.accountId) : undefined;

  const skip = async () => {
    const { previous, updated } = await skipBill(bill.id, today);
    toast.show(`Skipped · next due ${relativeDatePhrase(updated.nextDueDate, today)}`, { action: { label: "Undo", onClick: () => restoreBill(previous) } });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <EmojiTile emoji={bill.emoji} color={category?.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{bill.name}</span>
          <span className="block truncate text-caption text-ink-3">
            {FREQUENCY_LABELS[bill.frequency]}
            {account ? ` · ${account.name}` : ""}
          </span>
          <span className={cn("block text-caption font-semibold", status === "overdue" ? "text-negative" : status === "dueSoon" ? "text-warning" : "text-ink-2")}>
            {status === "paid" ? (
              <span className="inline-flex items-center gap-1 text-positive">
                <CircleCheck className="size-3.5" aria-hidden /> Paid · next {relativeDatePhrase(bill.nextDueDate, today)}
              </span>
            ) : status === "inactive" ? (
              `Last paid ${bill.lastPaidDate ? relativeDatePhrase(bill.lastPaidDate, today) : "—"}`
            ) : status === "overdue" ? (
              `Was due ${relativeDatePhrase(bill.nextDueDate, today)}`
            ) : (
              `Due ${relativeDatePhrase(bill.nextDueDate, today)}`
            )}
          </span>
        </span>
      </button>
      <div className="flex flex-col items-end gap-1.5">
        <Money value={bill.amount} className="font-bold" />
        {status === "inactive" ? (
          <Badge>Done</Badge>
        ) : status === "paid" ? null : (
          <div className="flex items-center gap-2">
            <IconButton size="sm" label={`Skip this ${bill.name} payment`} onClick={skip}>
              <SkipForward />
            </IconButton>
            <Button size="sm" variant={status === "overdue" || status === "dueSoon" ? "primary" : "secondary"} onClick={onPay}>
              Pay
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
