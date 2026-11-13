"use client";

import { ArrowRight, CircleCheck, CircleQuestionMark, OctagonAlert, Plus } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useDeferredValue, useMemo, useState } from "react";
import { Page, PageHeader } from "@/components/layout/page";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Button } from "@/components/ui/button";
import { Card, Money } from "@/components/ui/display";
import { AmountInput, Field, TextInput } from "@/components/ui/form";
import { useFinance } from "@/hooks/use-finance";
import { formatShortDate } from "@/lib/dates";
import { evaluateAffordability, type AffordVerdict } from "@/lib/finance/afford";
import { parseAmount } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { useUI } from "@/stores/ui";

const VERDICTS: Record<AffordVerdict, { label: string; icon: React.ReactNode; className: string; mood: "happy" | "thinking" | "concerned" }> = {
  comfortable: { label: "Comfortable", icon: <CircleCheck />, className: "bg-positive-soft text-positive", mood: "happy" },
  think: { label: "Think about it", icon: <CircleQuestionMark />, className: "bg-warning-soft text-warning", mood: "thinking" },
  notRecommended: { label: "Not recommended", icon: <OctagonAlert />, className: "bg-negative-soft text-negative", mood: "concerned" },
};

export default function AffordPage() {
  const { state, currency, today } = useFinance();
  const openAdd = useUI((s) => s.openAddTransaction);
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState("");
  const deferred = useDeferredValue(amount);
  const price = parseAmount(deferred, currency) ?? 0;
  const sts = state.safeToSpend;
  const result = useMemo(() => evaluateAffordability(price, sts), [price, sts]);
  const verdict = VERDICTS[result.verdict];

  return (
    <Page width="narrow">
      <PageHeader title="Can I afford it?" back="/more/" subtitle="Check a purchase against your bills, savings plan and cushion before you buy." />

      <Card className="p-5">
        <Field label="How much is it?">
          {(props) => <AmountInput {...props} size="xl" value={amount} onValueChange={setAmount} currency={currency} autoFocus />}
        </Field>
        <Field label="What is it? (optional)" className="mt-4">
          {(props) => <TextInput {...props} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. New running shoes" maxLength={60} />}
        </Field>
      </Card>

      <AnimatePresence mode="wait">
        {price > 0 ? (
          <m.div key={result.verdict} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="mt-5" aria-live="polite">
            <Card className="overflow-hidden">
              <div className="flex items-center gap-4 p-5">
                <OwwyMascot mood={verdict.mood} size={72} animated />
                <div className="min-w-0">
                  <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-callout font-bold [&_svg]:size-4", verdict.className)}>
                    {verdict.icon}
                    {verdict.label}
                  </span>
                  <p className="mt-2 text-title-3 font-bold text-balance">{result.headline}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 border-t border-line/60">
                <div className="border-r border-line/60 p-4">
                  <p className="text-caption font-semibold text-ink-3">Safe to spend</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-body font-bold">
                    <Money value={result.safeBefore} whole />
                    <ArrowRight className="size-4 text-ink-3" aria-label="becomes" />
                    <Money value={result.safeAfter} whole className={cn(result.safeAfter < 0 && "text-negative")} />
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-caption font-semibold text-ink-3">Per day until {formatShortDate(sts.nextIncomeDate, today)}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-body font-bold">
                    <Money value={result.perDayBefore} whole />
                    <ArrowRight className="size-4 text-ink-3" aria-label="becomes" />
                    <Money value={result.perDayAfter} whole className={cn(result.perDayAfter === 0 && "text-negative")} />
                  </p>
                </div>
              </div>

              <ul className="flex flex-col gap-1 border-t border-line/60 p-5 text-callout text-ink-2">
                {result.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>

              <div className="border-t border-line/60 bg-surface-2/60 p-5">
                <p className="mb-2 text-caption font-bold tracking-wider text-ink-3 uppercase">What Owwy considered</p>
                <dl className="flex flex-col gap-1.5 text-callout">
                  {sts.lines
                    .filter((l) => l.amount !== 0 || l.key === "available")
                    .map((line) => (
                      <div key={line.key} className="flex justify-between gap-3">
                        <dt className="text-ink-2">{line.label}</dt>
                        <dd className="font-semibold">
                          <Money value={line.key === "available" ? line.amount : -line.amount} />
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            </Card>

            <Button
              variant="secondary"
              size="lg"
              className="mt-4 w-full"
              onClick={() => openAdd({ type: "expense", amount: price, note: what })}
            >
              <Plus />
              I bought it — add as expense
            </Button>
          </m.div>
        ) : null}
      </AnimatePresence>

      <p className="mt-6 px-1 text-caption text-ink-3">
        This is a budgeting calculation based only on the numbers you&apos;ve entered in Owwy. It isn&apos;t financial advice, and it can&apos;t see anything outside this app.
      </p>
    </Page>
  );
}
