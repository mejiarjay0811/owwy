"use client";

import { ChevronDown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { formatShortDate, today as localToday } from "@/lib/dates";
import { CURRENCY_LIST, getCurrency } from "@/lib/money/currency";
import { approximateRate } from "@/lib/money/fx";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { CurrencyCode, ExchangeRates } from "@/types/models";

export function ExchangeRatesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Exchange rates" description="Used to add up accounts in other currencies. Owwy works offline, so you set the rates." size="sm">
      {open ? <RatesForm onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function trimRate(value: number): string {
  return String(Number(value.toFixed(value >= 10 ? 4 : 6)));
}

function RatesForm({ onDone }: { onDone: () => void }) {
  const { settings, state, today } = useFinance();
  const base = settings.currency;
  const used = new Set(state.accounts.map((a) => a.currency).filter((c): c is CurrencyCode => Boolean(c) && c !== base));
  const others = CURRENCY_LIST.filter((c) => c.code !== base);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(others.map((c) => [c.code, settings.exchangeRates[c.code] ? trimRate(settings.exchangeRates[c.code]!) : ""])),
  );
  const [showAll, setShowAll] = useState(used.size === 0);
  const shown = others.filter((c) => showAll || used.has(c.code));

  const save = async () => {
    const rates: ExchangeRates = {};
    for (const c of others) {
      const value = Number((draft[c.code] ?? "").replace(/,/g, ""));
      if (value > 0 && Number.isFinite(value)) rates[c.code] = value;
    }
    try {
      await updateSettings({ exchangeRates: rates, exchangeRatesUpdatedAt: Date.now() });
      toast.success("Exchange rates saved", { description: used.size ? "Totals and reports now use these rates." : undefined });
      onDone();
    } catch (e) {
      toast.error(e);
    }
  };

  const baseInfo = getCurrency(base);

  return (
    <div className="flex flex-col gap-4">
      {settings.exchangeRatesUpdatedAt ? (
        <p className="text-caption text-ink-3">Last updated {formatShortDate(localToday(new Date(settings.exchangeRatesUpdatedAt)), today)}.</p>
      ) : null}
      <ul className="flex flex-col divide-y divide-line/60 rounded-2xl border border-line/70 px-3">
        {shown.map((c) => {
          const approx = approximateRate(c.code, base);
          const value = draft[c.code] ?? "";
          return (
            <li key={c.code} className="flex items-center gap-3 py-3">
              <span className="text-[22px]" aria-hidden>
                {c.flag}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold">
                  1 {c.code}
                  {used.has(c.code) ? <Badge tone="brand" className="h-5 px-2 text-[10px]">In use</Badge> : null}
                </span>
                <span className="block truncate text-caption text-ink-3">{value ? c.name : `About ${trimRate(approx)} if left empty`}</span>
              </span>
              <label className="flex h-11 w-[44%] max-w-[170px] items-center gap-1.5 rounded-xl border border-line bg-surface px-3 focus-within:border-brand">
                <span className="text-callout text-ink-3" aria-hidden>
                  {baseInfo.symbol}
                </span>
                <span className="sr-only">
                  {baseInfo.code} per 1 {c.code}
                </span>
                <input
                  inputMode="decimal"
                  value={value}
                  placeholder={trimRate(approx)}
                  onChange={(e) => setDraft((d) => ({ ...d, [c.code]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 14) }))}
                  className="tabular min-w-0 flex-1 bg-transparent text-body font-semibold outline-none placeholder:font-normal placeholder:text-ink-3"
                />
              </label>
            </li>
          );
        })}
      </ul>
      {!showAll ? (
        <button type="button" onClick={() => setShowAll(true)} className="inline-flex items-center gap-1 self-start text-callout font-semibold text-brand">
          Other currencies
          <ChevronDown className="size-4" aria-hidden />
        </button>
      ) : null}
      <p className={cn("rounded-xl bg-surface-2 px-3 py-2 text-caption text-ink-2")}>
        Check today&apos;s rate from your bank or e-wallet app. Empty rows use a rough built-in estimate, which may be out of date.
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="xl" onClick={() => setDraft(Object.fromEntries(others.map((c) => [c.code, ""])))}>
          <RotateCcw />
          Clear
        </Button>
        <Button size="xl" className="flex-1" onClick={save}>
          Save rates
        </Button>
      </div>
    </div>
  );
}
