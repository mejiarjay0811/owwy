"use client";

import { Plus, Repeat } from "lucide-react";
import { useState } from "react";
import { FREQUENCY_LABELS } from "@/components/bills/bill-form-sheet";
import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmojiTile, EmptyState, Money } from "@/components/ui/display";
import { AmountInput, Field, Segmented, Select, SwitchRow, TextInput } from "@/components/ui/form";
import { describeMonthDays, MonthDayPicker } from "@/components/ui/month-day-picker";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { firstMonthDayOnOrAfter, relativeDatePhrase } from "@/lib/dates";
import { minorToInput, parseAmount } from "@/lib/money";
import { createRecurring, deleteRecurring, runRecurringRules, updateRecurring } from "@/lib/storage/repositories/recurring";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { AutomationMode, Frequency, RecurringTransaction, TransactionType } from "@/types/models";

const GROUPS: { type: TransactionType; title: string }[] = [
  { type: "income", title: "Money coming in" },
  { type: "expense", title: "Money going out" },
  { type: "transfer", title: "Automatic transfers" },
];

export default function RecurringPage() {
  const { data } = useFinance();
  const [form, setForm] = useState<{ rule?: RecurringTransaction } | null>(null);

  return (
    <Page>
      <PageHeader
        title="Automations"
        back="/more/"
        subtitle="Money that moves on a schedule — logged every time, without being asked. Or set one to ask you first."
        actions={
          <Button size="sm" onClick={() => setForm({})}>
            <Plus />
            New
          </Button>
        }
      />

      {data.recurring.length === 0 ? (
        <Card>
          <EmptyState
            mood="thinking"
            title="No automations yet"
            description="Add your salary, “to savings every 1st”, rent, or loan payments — and never type them again."
            action={
              <Button onClick={() => setForm({})}>
                <Plus />
                Add automation
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-7">
          {GROUPS.map(({ type, title }) => {
            const rules = data.recurring.filter((r) => r.type === type).sort((a, b) => Number(b.active) - Number(a.active) || a.nextDate.localeCompare(b.nextDate));
            if (!rules.length) return null;
            return (
              <section key={type} aria-labelledby={`rec-${type}`}>
                <h2 id={`rec-${type}`} className="mb-2 px-1 text-eyebrow font-bold tracking-[0.09em] text-ink-3 uppercase">
                  {title}
                </h2>
                <Card className="divide-y divide-line/60">
                  {rules.map((rule) => (
                    <RuleRow key={rule.id} rule={rule} onEdit={() => setForm({ rule })} />
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}

      <Sheet open={Boolean(form)} onOpenChange={(o) => !o && setForm(null)} title={form?.rule ? "Edit automation" : "New automation"} description="Owwy logs it on its date, even if you haven't opened the app.">
        {form ? <RuleForm rule={form.rule} onDone={() => setForm(null)} /> : null}
      </Sheet>
    </Page>
  );
}

function RuleRow({ rule, onEdit }: { rule: RecurringTransaction; onEdit: () => void }) {
  const { state, today } = useFinance();
  const category = rule.categoryId ? state.categoriesById.get(rule.categoryId) : undefined;
  const account = state.accountsById.get(rule.accountId);
  const to = rule.toAccountId ? state.accountsById.get(rule.toAccountId) : undefined;

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3.5", !rule.active && "opacity-60")}>
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {category ? (
          <EmojiTile emoji={category.emoji} color={category.color} />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-[14px] bg-surface-2 text-ink-2" aria-hidden>
            <Repeat className="size-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{rule.name}</span>
          <span className="block truncate text-caption text-ink-3">
            {rule.frequency === "monthDays" && rule.monthDays?.length
              ? `Monthly on ${describeMonthDays(rule.monthDays)}`
              : FREQUENCY_LABELS[rule.frequency]}{" "}
            · {account?.name ?? "Deleted account"}
            {to ? ` → ${to.name}` : ""}
          </span>
          <span className="flex items-center gap-1.5 text-caption font-semibold text-ink-2">
            {rule.active ? `Next ${relativeDatePhrase(rule.nextDate, today)}` : "Paused"}
            <Badge tone={rule.mode === "confirm" ? "accent" : "brand"} className="h-5 px-2 text-[10px]">
              {rule.mode === "confirm" ? "Asks first" : "Automatic"}
            </Badge>
          </span>
        </span>
      </button>
      <div className="flex flex-col items-end gap-1">
        <Money value={rule.type === "expense" ? -rule.amount : rule.amount} signed={rule.type === "income"} className={cn("font-bold", rule.type === "income" && "text-positive")} />
        {/* The label is only 16px tall; the negative margin keeps the layout
            while giving the control a 44px touch area on a phone. */}
        <button
          type="button"
          aria-label={rule.active ? `Pause ${rule.name}` : `Resume ${rule.name}`}
          className="-my-2.5 -mr-2 inline-flex min-h-11 items-center px-2 py-2.5 text-caption font-semibold text-brand"
          onClick={async () => {
            await updateRecurring(rule.id, { active: !rule.active });
            if (!rule.active) await runRecurringRules(today);
            toast.show(rule.active ? `${rule.name} paused` : `${rule.name} resumed`);
          }}
        >
          {rule.active ? "Pause" : "Resume"}
        </button>
      </div>
    </div>
  );
}

function RuleForm({ rule, onDone }: { rule?: RecurringTransaction; onDone: () => void }) {
  const { state, currency, today } = useFinance();
  const [type, setType] = useState<TransactionType>(rule?.type ?? "income");
  const [name, setName] = useState(rule?.name ?? "");
  const [amount, setAmount] = useState(rule ? minorToInput(rule.amount, currency) : "");
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? "");
  const [accountId, setAccountId] = useState(rule?.accountId ?? state.mainAccounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(rule?.toAccountId ?? "");
  const [frequency, setFrequency] = useState<Exclude<Frequency, "once">>(rule?.frequency ?? "monthly");
  const [monthDays, setMonthDays] = useState<number[]>(rule?.monthDays ?? [15, 30]);
  const [nextDate, setNextDate] = useState(rule?.nextDate ?? today);
  const [endDate, setEndDate] = useState(rule?.endDate ?? "");
  const [mode, setMode] = useState<AutomationMode>(rule?.mode ?? "auto");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = state.categories.filter((c) => c.kind === (type === "income" ? "income" : "expense") && !c.archived);
  const byDays = frequency === "monthDays";
  // The start date is a floor, not the schedule: show where the rule will
  // actually land so nobody has to work out "the 15th after 13 Nov".
  const firstFire = byDays ? firstMonthDayOnOrAfter(nextDate, monthDays) : null;
  const scheduleLabel = byDays ? `on ${describeMonthDays(monthDays)} of every month` : FREQUENCY_LABELS[frequency].toLowerCase();

  const save = async () => {
    const minor = parseAmount(amount, currency);
    if (!name.trim()) return setError("Give it a name.");
    if (!minor) return setError("Enter an amount.");
    if (type !== "transfer" && !categoryId) return setError("Choose a category.");
    if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return setError("Choose a different destination account.");
    if (byDays && !monthDays.length) return setError("Pick at least one day of the month.");
    setSaving(true);
    try {
      const input = {
        name,
        type,
        amount: minor,
        accountId,
        toAccountId: type === "transfer" ? toAccountId : undefined,
        categoryId: type === "transfer" ? undefined : categoryId,
        frequency,
        monthDays: byDays ? monthDays : undefined,
        note: name,
        mode,
      };
      if (rule) await updateRecurring(rule.id, { ...input, nextDate, endDate: endDate || "" });
      else await createRecurring({ ...input, startDate: nextDate, endDate: endDate || undefined });
      const posted = await runRecurringRules(today);
      toast.success(rule ? "Automation saved" : mode === "confirm" ? `${name}: Owwy will ask you ${scheduleLabel}` : `${name} will log itself ${scheduleLabel}`, {
        description: posted ? `${posted} due item${posted > 1 ? "s were" : " was"} added now.` : undefined,
      });
      onDone();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  const repeatsField = (
    <Field label="Repeats">
      {(props) => (
        <Select {...props} value={frequency} onChange={(e) => setFrequency(e.target.value as Exclude<Frequency, "once">)}>
          {(["daily", "weekly", "biweekly", "monthly", "monthDays", "quarterly", "yearly"] as const).map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_LABELS[f]}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );

  return (
    <div className="flex flex-col gap-5">
      <Segmented label="Type" value={type} onChange={(t) => { setType(t); setCategoryId(""); }} options={[{ value: "income", label: "Income" }, { value: "expense", label: "Expense" }, { value: "transfer", label: "Transfer" }]} />
      <Field label="Name" error={error && !name.trim() ? error : null}>
        {(props) => <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "income" ? "e.g. Salary" : type === "transfer" ? "e.g. Monthly savings" : "e.g. Rent"} maxLength={40} />}
      </Field>
      <Field label="Amount" error={error && name.trim() ? error : null}>
        {(props) => <AmountInput {...props} size="xl" value={amount} onValueChange={setAmount} currency={currency} />}
      </Field>
      <SwitchRow
        checked={mode === "auto"}
        onCheckedChange={(auto) => setMode(auto ? "auto" : "confirm")}
        label={mode === "auto" ? "Repeat without being asked" : "Ask me before logging"}
        description={mode === "auto" ? "Logs itself on its date." : "Shows up on Home on its date — tap Log it or Skip."}
      />
      {type !== "transfer" ? (
        <Field label="Category">
          {(props) => (
            <Select {...props} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label={type === "income" ? "Into" : "From"}>
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
        {type === "transfer" ? (
          <Field label="To">
            {(props) => (
              <Select {...props} value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Choose…</option>
                {state.mainAccounts.filter((a) => a.id !== accountId).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          repeatsField
        )}
      </div>
      {type === "transfer" ? repeatsField : null}

      {byDays ? (
        <Field label="Which days" error={error && !monthDays.length ? error : null}>
          {(props) => (
            <MonthDayPicker
              value={monthDays}
              onChange={setMonthDays}
              describedBy={props["aria-describedby"]}
              invalid={props["aria-invalid"]}
            />
          )}
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={rule ? "Next date" : byDays ? "Not before" : "Starts"}
          hint={
            byDays
              ? firstFire
                ? `Starts ${relativeDatePhrase(firstFire, today)}.`
                : undefined
              : !rule && nextDate < today
                ? "Past dates are added right away."
                : undefined
          }
        >
          {(props) => <TextInput {...props} type="date" value={nextDate} onChange={(e) => e.target.value && setNextDate(e.target.value)} />}
        </Field>
        <Field label="Ends (optional)">{(props) => <TextInput {...props} type="date" value={endDate} min={nextDate} onChange={(e) => setEndDate(e.target.value)} />}</Field>
      </div>
      <div className="flex gap-2">
        {rule ? (
          <Button variant="dangerSoft" size="xl" onClick={async () => { await deleteRecurring(rule.id); toast.show(`${rule.name} removed`, { description: "Entries already added stay in your history." }); onDone(); }}>
            Delete
          </Button>
        ) : null}
        <Button size="xl" className="flex-1" onClick={save} loading={saving}>
          {rule ? "Save changes" : "Save"}
        </Button>
      </div>
    </div>
  );
}
