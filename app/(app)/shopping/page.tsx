"use client";

import { Check, ChevronRight, Minus, Plus, ScanLine, ShoppingCart, Trash, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Page, PageHeader } from "@/components/layout/page";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { ScanPriceSheet, type ScannedPrice } from "@/components/shopping/scan-price-sheet";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge, Card, EmptyState, Money, ProgressBar } from "@/components/ui/display";
import { AmountInput, Chip, Field, Select, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { formatShortDate, today as localToday } from "@/lib/dates";
import { frequentItems, itemsToPutBack, itemTotal, lastPaidPrice, tripProgress, tripStatusLine } from "@/lib/finance/shopping";
import { minorToInput, parseAmount } from "@/lib/money";
import { haptic } from "@/lib/platform";
import { abandonTrip, addItem, deleteTrip, finishTrip, removeItem, startTrip, undoFinishTrip, updateItem, updateTrip } from "@/lib/storage/repositories/trips";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { ShoppingTrip } from "@/types/models";

export default function ShoppingPage() {
  const { data } = useFinance();
  const trips = data.trips ?? [];
  const active = trips.find((t) => t.status === "active");

  return (
    <Page>
      <PageHeader title="Shopping" back="/more/" subtitle={active ? undefined : "Set a budget for a trip and watch the trolley against it."} />
      {active ? <ActiveTrip trip={active} past={trips} /> : <StartTrip past={trips} />}
    </Page>
  );
}

/* ------------------------------------------------------------- start a trip */

function StartTrip({ past }: { past: ShoppingTrip[] }) {
  const { state, currency, today } = useFinance();
  const accounts = state.mainAccounts.filter((a) => a.type !== "credit");
  const groceries = state.categories.find((c) => c.id === "cat_groceries") ?? state.categories.find((c) => c.kind === "expense");
  const [name, setName] = useState("Grocery run");
  const [budget, setBudget] = useState("");
  const [categoryId, setCategoryId] = useState(groceries?.id ?? "");
  const [accountId, setAccountId] = useState(accounts.find((a) => a.includeInSafeToSpend)?.id ?? accounts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const finished = past.filter((t) => t.status === "done").sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));

  const begin = async () => {
    setBusy(true);
    try {
      await startTrip({ name, budget: parseAmount(budget, currency) ?? 0, categoryId, accountId: accountId || undefined });
      void haptic("success");
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="mb-5 p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-soft-ink">
            <ShoppingCart className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-title-3 font-bold">New trip</h2>
            <p className="text-caption text-ink-3">Owwy keeps the running total as you shop.</p>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Field label="What trip is this?">
            {(props) => <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Grocery run" />}
          </Field>
          <Field label="Budget for this trip" hint="Leave empty to just keep a running total">
            {(props) => <AmountInput {...props} size="xl" value={budget} onValueChange={setBudget} currency={currency} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              {(props) => (
                <Select {...props} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {state.categories
                    .filter((c) => c.kind === "expense" && !c.archived)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
            <Field label="Paying with">
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
          </div>
          <Button size="xl" onClick={begin} loading={busy} disabled={!categoryId}>
            <ShoppingCart />
            Start shopping
          </Button>
        </div>
      </Card>

      {finished.length ? (
        <section aria-labelledby="past-trips">
          <h2 id="past-trips" className="mb-3 px-1 text-eyebrow font-bold tracking-[0.09em] text-ink-3 uppercase">
            Past trips
          </h2>
          <Card className="divide-y divide-line/60">
            {finished.slice(0, 10).map((trip) => {
              const progress = tripProgress(trip);
              return (
                <div key={trip.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-[18px]" aria-hidden>
                    🛒
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{trip.name}</p>
                    <p className="text-caption text-ink-3">
                      {trip.closedAt ? formatShortDate(localToday(new Date(trip.closedAt)), today) : ""} · {progress.cartCount} items
                      {trip.budget > 0 ? (progress.over ? " · over budget" : " · within budget") : ""}
                    </p>
                  </div>
                  <Money value={progress.total} className="font-bold" />
                </div>
              );
            })}
          </Card>
        </section>
      ) : (
        <Card>
          <EmptyState
            mood="encouraging"
            compact
            title="No trips yet"
            description="Start one before you walk into the shop. Add things as they go in the trolley and Owwy tells you what's left."
          />
        </Card>
      )}
    </>
  );
}

/* ------------------------------------------------------------ active trip */

function ActiveTrip({ trip, past }: { trip: ShoppingTrip; past: ShoppingTrip[] }) {
  const { currency, fmt } = useFinance();
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [scanning, setScanning] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);

  const progress = tripProgress(trip);
  const putBack = itemsToPutBack(trip);
  const suggestions = useMemo(() => frequentItems(past).filter((s) => !trip.items.some((i) => i.label.toLowerCase() === s.label.toLowerCase())), [past, trip.items]);
  const remembered = label.trim() ? lastPaidPrice(label, past) : null;

  const add = async (item: { label: string; price: number; scanned?: boolean }) => {
    if (!item.label.trim() || item.price <= 0) return;
    try {
      await addItem(trip.id, { label: item.label, price: item.price, scanned: item.scanned });
      void haptic("light");
      setLabel("");
      setPrice("");
    } catch (e) {
      toast.error(e);
    }
  };

  const tone = progress.over ? "negative" : progress.percent >= 85 || progress.willGoOver ? "warning" : "brand";

  return (
    <>
      {/* Running total — the number you're actually watching in the aisle. */}
      <Card className={cn("mb-4 p-5", progress.over && "border-negative/40")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-eyebrow font-bold tracking-[0.09em] text-ink-3 uppercase">{trip.name}</p>
            <p className="mt-1 text-[2.25rem] leading-tight font-extrabold tracking-tight">
              <Money value={progress.total} animate />
            </p>
          </div>
          <div className="text-right">
            <p className="text-caption text-ink-3">{trip.budget > 0 ? "Budget" : "No budget"}</p>
            <button type="button" onClick={() => setEditingBudget(true)} className="press text-callout font-bold text-brand">
              {trip.budget > 0 ? fmt(trip.budget) : "Set one"}
            </button>
          </div>
        </div>

        {trip.budget > 0 ? (
          <ProgressBar
            className="mt-3"
            height="h-2.5"
            value={progress.percent}
            tone={tone === "negative" ? "negative" : tone === "warning" ? "warning" : "brand"}
            label={`${Math.round(progress.percent)}% of this trip's budget used`}
          />
        ) : null}
        <p className={cn("mt-2 text-callout", progress.over ? "font-semibold text-negative" : progress.willGoOver ? "text-warning" : "text-ink-2")}>
          {tripStatusLine(progress, fmt)}
        </p>

        {putBack.length ? (
          <div className="mt-3 flex items-start gap-3 rounded-2xl bg-negative-soft/60 p-3">
            <OwwyMascot mood="concerned" size={38} />
            <p className="min-w-0 flex-1 text-callout text-ink-2">
              Putting back <span className="font-semibold text-ink">{putBack.map((i) => i.label).join(", ")}</span> would bring you back under.
            </p>
          </div>
        ) : null}
      </Card>

      {/* Add an item */}
      <Card className="mb-4 p-4">
        <div className="flex gap-2">
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What did you pick up?" maxLength={60} aria-label="Item name" className="min-w-0 flex-1" />
          <div className="w-[34%] max-w-[130px]">
            <AmountInput value={price} onValueChange={setPrice} currency={currency} aria-label="Price" />
          </div>
        </div>
        {remembered && !price ? (
          <button type="button" onClick={() => setPrice(minorToInput(remembered, currency))} className="press mt-2 text-caption font-semibold text-brand">
            Last time this was {fmt(remembered)} — use it
          </button>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={() => setScanning(true)} className="px-4" aria-label="Scan a price tag">
            <ScanLine />
          </Button>
          <Button className="flex-1" onClick={() => add({ label, price: parseAmount(price, currency) ?? 0 })} disabled={!label.trim() || !parseAmount(price, currency)}>
            <Plus />
            Add to trolley
          </Button>
        </div>
        {suggestions.length ? (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {suggestions.slice(0, 6).map((s) => (
              <Chip key={s.label} onClick={() => add({ label: s.label, price: s.price })} className="h-9">
                {s.label}
                <span className="text-ink-3">{fmt(s.price)}</span>
              </Chip>
            ))}
          </div>
        ) : null}
      </Card>

      {/* The trolley */}
      {trip.items.length ? (
        <Card className="divide-y divide-line/60">
          {trip.items.map((item) => (
            // The name gets a line of its own; the fiddly controls sit underneath it.
            <div key={item.id} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void updateItem(trip.id, item.id, { inCart: !item.inCart })}
                  aria-pressed={item.inCart}
                  aria-label={item.inCart ? `${item.label} is in the trolley` : `Put ${item.label} in the trolley`}
                  className={cn(
                    "press flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                    item.inCart ? "border-brand bg-brand text-brand-ink" : "border-line-strong text-transparent",
                  )}
                >
                  <Check className="size-4" />
                </button>
                <p className={cn("min-w-0 flex-1 truncate font-semibold", !item.inCart && "text-ink-3 line-through")}>{item.label}</p>
                <Money value={itemTotal(item)} className={cn("shrink-0 font-bold", !item.inCart && "text-ink-3")} />
                <IconButton size="sm" label={`Remove ${item.label}`} onClick={() => void removeItem(trip.id, item.id)}>
                  <X />
                </IconButton>
              </div>
              <div className="mt-1 flex items-center gap-2 pl-11">
                <IconButton size="sm" label={`Fewer ${item.label}`} disabled={item.quantity <= 1} onClick={() => void updateItem(trip.id, item.id, { quantity: item.quantity - 1 })}>
                  <Minus />
                </IconButton>
                <span className="tabular w-5 text-center text-callout font-semibold">{item.quantity}</span>
                <IconButton size="sm" label={`More ${item.label}`} onClick={() => void updateItem(trip.id, item.id, { quantity: item.quantity + 1 })}>
                  <Plus />
                </IconButton>
                <span className="truncate text-caption text-ink-3">
                  <Money value={item.price} /> each{item.scanned ? " · scanned" : ""}
                </span>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState compact mood="sleeping" title="Trolley's empty" description="Add the first thing you pick up — or scan its price tag." />
        </Card>
      )}

      <div className="mt-5 flex gap-2">
        <Button variant="dangerSoft" onClick={() => setConfirmAbandon(true)}>
          <Trash />
          Abandon
        </Button>
        <Button size="lg" className="flex-1" onClick={() => setFinishing(true)} disabled={progress.total <= 0}>
          Finish · {fmt(progress.total)}
          <ChevronRight />
        </Button>
      </div>

      <ScanPriceSheet open={scanning} onOpenChange={setScanning} onUse={(item: ScannedPrice) => void add({ ...item, scanned: true })} />
      <FinishSheet open={finishing} onOpenChange={setFinishing} trip={trip} />
      <BudgetSheet open={editingBudget} onOpenChange={setEditingBudget} trip={trip} />
      <ConfirmDialog
        open={confirmAbandon}
        onOpenChange={setConfirmAbandon}
        title="Abandon this trip?"
        description="Nothing is logged and the trolley is cleared. Your spending is untouched."
        confirmLabel="Abandon trip"
        destructive
        onConfirm={async () => {
          await abandonTrip(trip.id);
          toast.show("Trip abandoned", { action: { label: "Delete it", onClick: () => deleteTrip(trip.id) } });
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ sheets */

function BudgetSheet({ open, onOpenChange, trip }: { open: boolean; onOpenChange: (o: boolean) => void; trip: ShoppingTrip }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Trip budget" size="sm">
      {/* Mounted only while open, so it always opens on the current budget. */}
      {open ? <BudgetForm trip={trip} onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function BudgetForm({ trip, onDone }: { trip: ShoppingTrip; onDone: () => void }) {
  const { currency } = useFinance();
  const [budget, setBudget] = useState(trip.budget ? minorToInput(trip.budget, currency) : "");

  return (
      <div className="flex flex-col gap-4">
        <Field label="Budget for this trip" hint="Empty means no budget — Owwy just keeps the total.">
          {(props) => <AmountInput {...props} size="xl" value={budget} onValueChange={setBudget} currency={currency} autoFocus />}
        </Field>
        <Button
          size="xl"
          onClick={async () => {
            await updateTrip(trip.id, { budget: parseAmount(budget, currency) ?? 0 });
            onDone();
          }}
        >
          Save budget
        </Button>
      </div>
  );
}

function FinishSheet({ open, onOpenChange, trip }: { open: boolean; onOpenChange: (o: boolean) => void; trip: ShoppingTrip }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Finish the trip" description="Owwy logs one expense for the trip and keeps the itemised list here." size="sm">
      {/* Mounted only while open, so the total is always the trolley as it stands now. */}
      {open ? <FinishForm trip={trip} onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function FinishForm({ trip, onDone }: { trip: ShoppingTrip; onDone: () => void }) {
  const { state, currency, today, fmt } = useFinance();
  const accounts = state.mainAccounts.filter((a) => a.type !== "credit");
  const progress = tripProgress(trip);
  const [accountId, setAccountId] = useState(trip.accountId ?? accounts.find((a) => a.includeInSafeToSpend)?.id ?? accounts[0]?.id ?? "");
  const [amount, setAmount] = useState(minorToInput(progress.total, currency));
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const total = parseAmount(amount, currency) ?? 0;
  const leftBehind = trip.items.filter((i) => !i.inCart).length;

  const finish = async () => {
    setSaving(true);
    try {
      const result = await finishTrip({ tripId: trip.id, accountId, date, amount: total });
      void haptic("success");
      toast.success(`${fmt(result.amount)} logged · ${trip.name}`, {
        description: trip.budget > 0 ? (result.amount <= trip.budget ? `Under budget by ${fmt(trip.budget - result.amount)}` : `Over budget by ${fmt(result.amount - trip.budget)}`) : undefined,
        action: { label: "Undo", onClick: () => undoFinishTrip(result) },
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
        <Field label="Total paid" hint="Adjust if the till total differs — discounts, promos, a forgotten item.">
          {(props) => <AmountInput {...props} size="xl" value={amount} onValueChange={setAmount} currency={currency} />}
        </Field>
        {trip.budget > 0 ? (
          <div className="flex items-center gap-2">
            <Badge tone={total <= trip.budget ? "positive" : "negative"}>
              {total <= trip.budget ? `${fmt(trip.budget - total)} under budget` : `${fmt(total - trip.budget)} over budget`}
            </Badge>
          </div>
        ) : null}
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
        <Field label="Date">{(props) => <TextInput {...props} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}</Field>
        {leftBehind ? <p className="text-caption text-ink-3">{leftBehind} item{leftBehind > 1 ? "s" : ""} still on the list won&apos;t be included.</p> : null}
        <Button size="xl" onClick={finish} loading={saving} disabled={total <= 0 || !accountId}>
          Log {fmt(total)}
        </Button>
      </div>
  );
}
