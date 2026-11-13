"use client";

import { Delete } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { getCurrency } from "@/lib/money/currency";
import { evaluateExpression, isExpression } from "@/lib/money/calc";
import { formatMoney, toMinor } from "@/lib/money";
import { haptic } from "@/lib/platform";
import { cn } from "@/lib/utils/cn";
import type { CurrencyCode } from "@/types/models";

const KEYS = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", ".", "0", "⌫", "+"] as const;

/**
 * An on-screen calculator for amounts: type “120+45×2” and use the result.
 * The amount field above stays editable with the regular keyboard too.
 *
 * With `onInput` it becomes the primary way to enter an amount rather than a
 * detour: plain digits write straight through to the field as they are
 * pressed, so there is nothing to confirm. Only an actual sum needs the
 * button, because "120+45" has no meaning until it is worked out.
 */
export function AmountKeypad({
  initial,
  currency,
  onUse,
  onInput,
}: {
  initial: string;
  currency: CurrencyCode;
  onUse: (value: string) => void;
  onInput?: (value: string) => void;
}) {
  const [expr, setExpr] = useState(initial);
  const info = getCurrency(currency);
  const result = evaluateExpression(expr);
  const showsMath = isExpression(expr);
  const valid = result !== null && result > 0;

  // Mirror plain digits into the field above. Guarded on the value so an
  // echo back through `initial` can't start a loop, and skipped while an
  // expression is half-typed — "120+" is not an amount.
  const lastSent = useRef(initial);
  useEffect(() => {
    if (!onInput || showsMath) return;
    if (expr === lastSent.current) return;
    lastSent.current = expr;
    onInput(expr);
  }, [expr, showsMath, onInput]);

  const press = (key: (typeof KEYS)[number]) => {
    void haptic("light");
    if (key === "⌫") return setExpr((e) => e.slice(0, -1));
    setExpr((e) => {
      const last = e.slice(-1);
      if ("+−×÷".includes(key)) {
        // An operator replaces a trailing operator; nothing leads with one.
        if (!e) return e;
        return "+−×÷".includes(last) ? e.slice(0, -1) + key : e + key;
      }
      if (key === "." && /\.\d*$/.test(e.split(/[+−×÷]/).pop() ?? "")) return e;
      return (e + key).slice(0, 40);
    });
  };

  const use = () => {
    if (!valid) return;
    const rounded = Number(result.toFixed(info.decimals));
    lastSent.current = String(rounded);
    onUse(String(rounded));
    setExpr(String(rounded));
  };

  return (
    <m.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="mt-2 rounded-[22px] bg-surface-2 p-2.5">
        {/* Writing through live, the field above already shows the number —
            this row would just repeat it, so it only appears for a sum. */}
        {onInput && !showsMath ? null : (
          <div className="mb-2 flex min-h-11 items-center justify-between gap-2 px-2" aria-live="polite">
            <span className="tabular min-w-0 truncate text-title-3 font-semibold text-ink-2">{expr || "0"}</span>
            {showsMath ? (
              <span className={cn("tabular shrink-0 text-callout font-bold", valid ? "text-brand" : "text-ink-3")}>
                = {valid ? formatMoney(toMinor(result, currency), currency, { trimZeros: true }) : "…"}
              </span>
            ) : null}
          </div>
        )}
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Calculator">
          {KEYS.map((key) => {
            const op = "+−×÷".includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label={key === "⌫" ? "Delete" : key === "÷" ? "Divide" : key === "×" ? "Multiply" : key === "−" ? "Minus" : key === "+" ? "Plus" : key}
                className={cn(
                  "press flex h-12 items-center justify-center rounded-2xl text-title-3 font-semibold",
                  op ? "bg-brand-soft text-brand-soft-ink" : "bg-surface text-ink shadow-xs",
                )}
              >
                {key === "⌫" ? <Delete className="size-5" aria-hidden /> : key}
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          <button type="button" onClick={() => setExpr("")} className="press h-11 rounded-2xl text-callout font-semibold text-ink-2 hover:bg-surface">
            Clear
          </button>
          {/* Writing through live, the button is only needed to settle a sum;
              otherwise the amount is already in the field. */}
          {onInput && !showsMath ? (
            <p className="col-span-3 flex h-11 items-center justify-center text-caption text-ink-3">
              Type a sum like 120+45 to add things up.
            </p>
          ) : (
            <button
              type="button"
              onClick={use}
              disabled={!valid}
              className="press col-span-3 h-11 rounded-2xl bg-brand text-callout font-bold text-brand-ink disabled:opacity-40"
            >
              {showsMath && valid ? `Use ${formatMoney(toMinor(result, currency), currency, { trimZeros: true })}` : "Use amount"}
            </button>
          )}
        </div>
      </div>
    </m.div>
  );
}
