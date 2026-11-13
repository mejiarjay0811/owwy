"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Page, PageHeader } from "@/components/layout/page";
import { Card, Money, OwwySays, SectionHeader } from "@/components/ui/display";
import { AmountInput, Chip, Field, Segmented, Select, SwitchRow, TextInput } from "@/components/ui/form";
import { useFinance } from "@/hooks/use-finance";
import { formatShortDate } from "@/lib/dates";
import { ACCOUNT_TYPES } from "@/lib/defaults/card-styles";
import type { SafeToSpendLine } from "@/lib/finance/safe-to-spend";
import { minorToInput, parseAmount } from "@/lib/money";
import { updateAccount } from "@/lib/storage/repositories/accounts";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { cn } from "@/lib/utils/cn";
import type { PayFrequency } from "@/types/models";

export default function SafeToSpendPage() {
  const { state, settings, today, currency, data } = useFinance();
  const sts = state.safeToSpend;
  const config = settings.safeToSpend;
  const usesRule = data.recurring.some((r) => r.active && r.type === "income");

  return (
    <Page>
      <PageHeader title="Safe to spend" back="/more/" subtitle="Not just your balance — what's actually free to spend until your next income." />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <Card className="hero-surface border-0 p-6">
            <p className="text-eyebrow font-bold tracking-[0.12em] text-hero-ink-2 uppercase">Safe to spend</p>
            <p className="mt-1 text-[3rem] leading-none font-extrabold tracking-tight">
              <Money value={sts.amount} whole animate />
            </p>
            <p className="mt-2 text-callout text-hero-ink-2">
              About <Money value={sts.perDay} whole className="font-semibold text-hero-ink" /> a day for {sts.daysLeft} day{sts.daysLeft > 1 ? "s" : ""}, until your next income on {formatShortDate(sts.nextIncomeDate, today)}.
            </p>
          </Card>

          <Card className="p-5">
            <SectionHeader title="How it's worked out" />
            <ol className="flex flex-col">
              {sts.lines.map((line, index) => (
                <LedgerLine key={line.key} line={line} first={index === 0} />
              ))}
              <li className="mt-2 flex items-center justify-between border-t-2 border-ink pt-3">
                <span className="text-title-3 font-extrabold">Safe to spend</span>
                <Money value={sts.rawAmount} whole className={cn("text-title-3 font-extrabold", sts.rawAmount < 0 && "text-negative")} />
              </li>
            </ol>
            {sts.rawAmount < 0 ? (
              <p className="mt-3 rounded-xl bg-negative-soft px-3 py-2 text-callout text-negative">
                Your plans need <Money value={-sts.rawAmount} whole className="font-bold" /> more than you have. Consider lowering the cushion or savings plan this period, or moving money into a spending account.
              </p>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <Card className="p-5">
            <SectionHeader title="Spending accounts" />
            <p className="-mt-2 mb-2 text-callout text-ink-3">Only money in these counts as spendable.</p>
            <div className="divide-y divide-line/60">
              {state.activeAccounts
                .filter((a) => !ACCOUNT_TYPES[a.type].liability)
                .map((a) => (
                  <SwitchRow
                    key={a.id}
                    checked={a.includeInSafeToSpend}
                    onCheckedChange={(checked) => void updateAccount(a.id, { includeInSafeToSpend: checked })}
                    label={`${ACCOUNT_TYPES[a.type].emoji} ${a.name}`}
                    description={ACCOUNT_TYPES[a.type].label}
                  />
                ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader title="Next income" />
            <IncomeSettings />
            {usesRule ? <p className="mt-3 text-caption text-ink-3">A recurring income rule is set, so Owwy uses whichever payday comes first.</p> : null}
          </Card>

          <Card className="p-5">
            <SectionHeader title="Savings plan" />
            <SwitchRow
              checked={config.useGoalSuggestions && config.monthlySavingsTarget === 0}
              onCheckedChange={(checked) => void updateSettings({ safeToSpend: { useGoalSuggestions: checked, monthlySavingsTarget: checked ? 0 : config.monthlySavingsTarget } })}
              label="Use my goals"
              description="Reserve what your dated goals need each month."
            />
            <AmountSetting
              label="Or a fixed monthly savings target"
              value={config.monthlySavingsTarget}
              currency={currency}
              onSave={(v) => updateSettings({ safeToSpend: { monthlySavingsTarget: v } })}
            />
          </Card>

          <Card className="p-5">
            <SectionHeader title="Safety margins" />
            <AmountSetting
              label="Minimum balance"
              hint="Never plan to go below this."
              value={config.minimumBalance}
              currency={currency}
              onSave={(v) => updateSettings({ safeToSpend: { minimumBalance: v } })}
            />
            <div className="mt-5">
              <p className="mb-2 text-callout font-semibold text-ink-2">Cushion for surprises</p>
              <Segmented
                label="Cushion type"
                value={config.bufferMode}
                onChange={(bufferMode) => void updateSettings({ safeToSpend: { bufferMode } })}
                options={[
                  { value: "percent", label: "Percent" },
                  { value: "fixed", label: "Fixed amount" },
                ]}
              />
              {config.bufferMode === "percent" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {[0, 5, 10, 15, 20].map((p) => (
                    <Chip key={p} selected={config.bufferPercent === p} onClick={() => void updateSettings({ safeToSpend: { bufferPercent: p } })}>
                      {p === 0 ? "None" : `${p}%`}
                    </Chip>
                  ))}
                </div>
              ) : (
                <AmountSetting label="Cushion amount" value={config.bufferAmount} currency={currency} onSave={(v) => updateSettings({ safeToSpend: { bufferAmount: v } })} />
              )}
            </div>
          </Card>

          <OwwySays mood="thinking">Safe to Spend is an estimate from your own numbers — not financial advice.</OwwySays>
        </div>
      </div>
    </Page>
  );
}

function LedgerLine({ line, first }: { line: SafeToSpendLine; first: boolean }) {
  const [open, setOpen] = useState(false);
  const { today } = useFinance();
  const expandable = line.items.length > 0;

  return (
    <li className="border-b border-line/50 py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        className={cn("flex w-full items-start gap-3 text-left", !expandable && "cursor-default")}
        aria-expanded={expandable ? open : undefined}
      >
        <span className="w-4 pt-0.5 text-center font-bold text-ink-3" aria-hidden>
          {first ? "" : "−"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold">
            {line.label}
            {expandable ? <ChevronDown className={cn("size-4 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden /> : null}
          </span>
          <span className="block text-caption text-ink-3">{line.explanation}</span>
        </span>
        <Money value={line.amount} whole={line.key === "buffer" || line.key === "savings"} className={cn("font-bold", line.amount === 0 && "text-ink-3")} />
      </button>
      {open ? (
        <ul className="mt-2 ml-7 flex flex-col gap-1 rounded-xl bg-surface-2 p-3 text-callout">
          {line.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate text-ink-2">
                {item.label}
                {item.date ? <span className="text-ink-3"> · {formatShortDate(item.date, today)}</span> : null}
              </span>
              <Money value={item.amount} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function IncomeSettings() {
  const { settings } = useFinance();
  const income = settings.income;
  const setFrequency = (frequency: PayFrequency) =>
    void updateSettings({
      income: {
        frequency,
        paydays: frequency === "monthly" ? [income.paydays[0] ?? 30] : frequency === "semimonthly" ? (income.paydays.length === 2 ? income.paydays : [15, 31]) : income.paydays,
      },
    });

  return (
    <div className="flex flex-col gap-4">
      <Field label="How often you're paid">
        {(props) => (
          <Select {...props} value={income.frequency} onChange={(e) => setFrequency(e.target.value as PayFrequency)}>
            <option value="monthly">Monthly</option>
            <option value="semimonthly">Twice a month</option>
            <option value="biweekly">Every two weeks</option>
            <option value="weekly">Weekly</option>
            <option value="irregular">Irregular (plan to month end)</option>
          </Select>
        )}
      </Field>
      {income.frequency === "monthly" || income.frequency === "semimonthly" ? (
        <div className="grid grid-cols-2 gap-3">
          {(income.frequency === "monthly" ? [0] : [0, 1]).map((i) => (
            <Field key={i} label={income.frequency === "monthly" ? "Payday" : i === 0 ? "First payday" : "Second payday"}>
              {(props) => (
                <Select
                  {...props}
                  value={String(income.paydays[i] ?? (i === 0 ? 15 : 31))}
                  onChange={(e) => {
                    const next = [...income.paydays];
                    next[i] = Number(e.target.value);
                    void updateSettings({ income: { paydays: next.slice(0, income.frequency === "monthly" ? 1 : 2) } });
                  }}
                >
                  {Array.from({ length: 31 }, (_, d) => d + 1).map((d) => (
                    <option key={d} value={d}>
                      {d === 31 ? "Last day" : `Day ${d}`}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ))}
        </div>
      ) : income.frequency !== "irregular" ? (
        <Field label="A recent or upcoming payday">
          {(props) => <TextInput {...props} type="date" value={income.anchorDate ?? ""} onChange={(e) => void updateSettings({ income: { anchorDate: e.target.value || undefined } })} />}
        </Field>
      ) : null}
    </div>
  );
}

function AmountSetting({ label, hint, value, currency, onSave }: { label: string; hint?: string; value: number; currency: Parameters<typeof minorToInput>[1]; onSave: (value: number) => unknown }) {
  const [draft, setDraft] = useState(value ? minorToInput(value, currency) : "");
  return (
    <Field label={label} hint={hint} className="mt-4">
      {(props) => (
        <AmountInput
          {...props}
          value={draft}
          onValueChange={setDraft}
          currency={currency}
          onBlur={() => {
            const next = parseAmount(draft, currency) ?? 0;
            if (next !== value) void onSave(next);
          }}
        />
      )}
    </Field>
  );
}
