"use client";

import { ChevronLeft, Printer } from "lucide-react";
import Link from "@/components/ui/app-link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { MonthlyReviewView } from "@/components/insights/monthly-review";
import { Splash } from "@/components/layout/app-shell";
import { OwwyMark } from "@/components/owwy/owwy-mascot";
import { Button } from "@/components/ui/button";
import { useFinanceStatus, useOptionalFinance } from "@/hooks/use-finance";
import { addMonthKey, formatMonth, monthEnd, monthStart } from "@/lib/dates";
import { summarizeMonth } from "@/lib/finance/summary";
import { formatMoney } from "@/lib/money";
import { accountCurrency } from "@/lib/money/fx";

/**
 * Print-friendly monthly report. "Save as PDF" in the system print dialog
 * produces the PDF — no server and no extra library required.
 */
export default function ReportPage() {
  return (
    <Suspense fallback={<Splash />}>
      <Report />
    </Suspense>
  );
}

function Report() {
  const status = useFinanceStatus();
  const finance = useOptionalFinance();
  const params = useSearchParams();

  const month = useMemo(() => {
    const requested = params.get("month");
    if (requested && /^\d{4}-\d{2}$/.test(requested)) return requested;
    return finance ? addMonthKey(finance.state.month, -1) : "";
  }, [params, finance]);

  if (status !== "ready" || !finance) return <Splash />;
  const { data, settings, state } = finance;
  const transactions = data.transactions
    .filter((t) => t.date >= monthStart(month) && t.date <= monthEnd(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  return (
    <div className="min-h-dvh bg-bg">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg-elevated/90 px-4 py-3 backdrop-blur pt-[calc(12px+var(--safe-top))]">
        <Link href={`/review/?month=${month}`} className="inline-flex items-center gap-1 text-callout font-semibold">
          <ChevronLeft className="size-5" /> Back
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer />
          Print / Save PDF
        </Button>
      </div>

      <main id="main" className="mx-auto max-w-3xl px-5 py-8 print:max-w-none print:p-0">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <OwwyMark size={30} />
            <span className="text-title-3 font-extrabold">owwy</span>
          </div>
          <div className="text-right text-caption text-ink-3">
            {/* The page's own heading — it had none, so the report started at h2. */}
            <h1 className="text-callout font-semibold text-ink">{formatMonth(month)} report</h1>
            <p>
              {settings.displayName ? `${settings.displayName} · ` : ""}Generated on this device {new Date().toLocaleDateString()}
            </p>
          </div>
        </header>

        <MonthlyReviewView month={month} printable />

        <IncomeStatement month={month} />

        <section className="mt-8 break-before-page">
          <h2 className="mb-3 text-title-3 font-bold">All transactions · {formatMonth(month)}</h2>
          {/* Five columns never fit a phone. Scroll it sideways on screen —
              reachable by keyboard — and let print lay out the full width. */}
          <div
            role="region"
            aria-label={`All transactions for ${formatMonth(month)}, scrollable`}
            tabIndex={0}
            className="-mx-5 overflow-x-auto px-5 print:mx-0 print:overflow-visible print:px-0"
          >
            <table className="w-full min-w-[34rem] text-left text-callout print:min-w-0">
              <thead className="border-b border-line text-caption text-ink-3">
                <tr>
                  <th className="py-2 pr-2 font-semibold">Date</th>
                  <th className="py-2 pr-2 font-semibold">Details</th>
                  <th className="py-2 pr-2 font-semibold">Category</th>
                  <th className="py-2 pr-2 font-semibold">Account</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-line/60 align-top">
                    <td className="tabular py-1.5 pr-2 whitespace-nowrap">{t.date.slice(5)}</td>
                    <td className="py-1.5 pr-2">{t.note || "—"}</td>
                    <td className="py-1.5 pr-2">{t.type === "transfer" ? "Transfer" : (state.categoriesById.get(t.categoryId ?? "")?.name ?? "")}</td>
                    <td className="py-1.5 pr-2">
                      {state.accountsById.get(t.accountId)?.name}
                      {t.toAccountId ? ` → ${state.accountsById.get(t.toAccountId)?.name}` : ""}
                    </td>
                    <td className="tabular py-1.5 text-right whitespace-nowrap">
                      {formatMoney(t.type === "expense" ? -t.amount : t.amount, accountCurrency(state.accountsById.get(t.accountId), state.fx), { signed: t.type === "income" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {transactions.length === 0 ? <p className="py-4 text-callout text-ink-3">No transactions this month.</p> : null}
        </section>
        <p className="mt-8 text-caption text-ink-3">This report was created locally by Owwy from your own records. It is not a bank statement.</p>
      </main>
    </div>
  );
}

/** Income and spending by category, in the main currency, with the month's net result. */
function IncomeStatement({ month }: { month: string }) {
  const finance = useOptionalFinance();
  const summary = useMemo(() => (finance ? summarizeMonth(finance.baseData.transactions, finance.state.accounts, finance.baseData.goals, month) : null), [finance, month]);
  if (!finance || !summary) return null;
  const { state, settings } = finance;
  const fmt = (v: number, signed = false) => formatMoney(v, settings.currency, { signed });
  const rows = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([id, amount]) => ({ id, amount, category: state.categoriesById.get(id) }))
      .sort((a, b) => b.amount - a.amount);

  return (
    <section className="mt-8 break-inside-avoid" aria-labelledby="statement-title">
      <h2 id="statement-title" className="mb-3 text-title-3 font-bold">
        Income statement · {formatMonth(month)}
      </h2>
      <table className="w-full text-left text-callout">
        <tbody>
          <tr className="border-b border-line">
            <th colSpan={2} className="pt-2 pb-1 text-caption font-bold tracking-wider text-ink-3 uppercase">
              Income
            </th>
          </tr>
          {rows(summary.incomeByCategory).map((r) => (
            <tr key={`in-${r.id}`} className="border-b border-line/50">
              <td className="py-1.5 pr-2">{r.category ? `${r.category.emoji} ${r.category.name}` : "Other"}</td>
              <td className="tabular py-1.5 text-right">{fmt(r.amount)}</td>
            </tr>
          ))}
          <tr className="border-b border-line font-bold">
            <td className="py-2 pr-2">Total income</td>
            <td className="tabular py-2 text-right">{fmt(summary.income)}</td>
          </tr>
          <tr className="border-b border-line">
            <th colSpan={2} className="pt-4 pb-1 text-caption font-bold tracking-wider text-ink-3 uppercase">
              Spending
            </th>
          </tr>
          {rows(summary.byCategory).map((r) => (
            <tr key={`out-${r.id}`} className="border-b border-line/50">
              <td className="py-1.5 pr-2">{r.category ? `${r.category.emoji} ${r.category.name}` : "Other"}</td>
              <td className="tabular py-1.5 text-right">{fmt(r.amount)}</td>
            </tr>
          ))}
          <tr className="border-b border-line font-bold">
            <td className="py-2 pr-2">Total spending</td>
            <td className="tabular py-2 text-right">{fmt(summary.spent)}</td>
          </tr>
          <tr className="text-body font-extrabold">
            <td className="pt-3 pr-2">Net result</td>
            <td className="tabular pt-3 text-right">{fmt(summary.net, true)}</td>
          </tr>
          {summary.saved ? (
            <tr className="text-caption text-ink-3">
              <td className="pr-2">Moved into savings</td>
              <td className="tabular text-right">{fmt(summary.saved)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {state.multiCurrency ? <p className="mt-2 text-caption text-ink-3">Amounts in other currencies are converted with your exchange rates.</p> : null}
    </section>
  );
}
