"use client";

import { CircleAlert, CircleCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { haptic } from "@/lib/platform";
import { applyCsvImport, planCsvImport, type CsvImportPlan } from "@/lib/services/csv-import";
import { toast } from "@/stores/ui";

export function CsvImportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Import transactions" description="From a CSV file — Owwy's own export, or most bank and app exports." size="sm">
      {open ? <CsvImportForm onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function CsvImportForm({ onDone }: { onDone: () => void }) {
  const { data, state, settings, today } = useFinance();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<CsvImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file: File) => {
    setError(null);
    setPlan(null);
    if (file.size > 20 * 1024 * 1024) return setError("That file is too large to import.");
    setFileName(file.name);
    try {
      const text = await file.text();
      const next = planCsvImport(text, { accounts: state.accounts, categories: state.categories, transactions: data.transactions, currency: settings.currency, today });
      if (next.missingColumns.length) setError(`This file needs a ${next.missingColumns.join(" and ")} column.`);
      else if (!next.rows.length) setError("No rows found in this file.");
      setPlan(next);
    } catch {
      setError("Couldn't read this file. Make sure it's a CSV.");
    }
  };

  const importNow = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const count = await applyCsvImport(plan);
      void haptic("success");
      toast.success(`${count} transaction${count === 1 ? "" : "s"} imported`, { description: plan.newAccounts.length ? `New accounts: ${plan.newAccounts.join(", ")}. Set their opening balances in Wallet.` : undefined });
      onDone();
    } catch (e) {
      toast.error(e, "Import failed. Nothing was added.");
    } finally {
      setBusy(false);
    }
  };

  const problems = plan?.rows.filter((r) => r.error && !r.error.startsWith("Already")).slice(0, 5) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void choose(file);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" size="lg" onClick={() => fileRef.current?.click()}>
        <Upload />
        {fileName ? "Choose a different file" : "Choose CSV file"}
      </Button>

      {!plan ? (
        <div className="rounded-2xl bg-surface-2 p-4 text-callout text-ink-2">
          <p className="font-semibold text-ink">What Owwy looks for</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>
              <span className="font-semibold">Date</span> and <span className="font-semibold">Amount</span> (required)
            </li>
            <li>Type, Category, Account, To account, Note, Tags (optional)</li>
            <li>Negative amounts are treated as expenses</li>
          </ul>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-negative-soft px-3 py-2 text-callout text-negative">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {plan && !plan.missingColumns.length && plan.rows.length ? (
        <div className="rounded-2xl border border-line/70 p-4">
          <p className="truncate text-caption text-ink-3">{fileName}</p>
          <p className="mt-1 flex items-center gap-2 text-title-3 font-bold">
            <CircleCheck className="size-5 text-positive" aria-hidden />
            {plan.valid} ready to import
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-callout text-ink-2">
            {plan.duplicates ? <li>{plan.duplicates} already in Owwy — skipped</li> : null}
            {plan.errors ? <li className="text-warning">{plan.errors} rows couldn&apos;t be read</li> : null}
            {plan.uncategorized ? <li>{plan.uncategorized} without a matching category — filed under Other</li> : null}
            {plan.newAccounts.length ? <li>New accounts: {plan.newAccounts.join(", ")}</li> : null}
          </ul>
          {problems.length ? (
            <ul className="mt-3 flex flex-col gap-0.5 rounded-xl bg-surface-2 p-3 text-caption text-ink-3">
              {problems.map((p) => (
                <li key={p.line}>
                  Line {p.line}: {p.error}
                </li>
              ))}
            </ul>
          ) : null}
          <Button size="xl" className="mt-4 w-full" onClick={importNow} loading={busy} disabled={!plan.valid}>
            Import {plan.valid} transaction{plan.valid === 1 ? "" : "s"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
