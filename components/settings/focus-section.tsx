"use client";

import { Check } from "lucide-react";
import { useFinance } from "@/hooks/use-finance";
import { MAIN_GOALS, toggleMainGoal } from "@/lib/defaults/main-goals";
import { haptic } from "@/lib/platform";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { cn } from "@/lib/utils/cn";

/**
 * What matters most right now — the same question setup asks, editable.
 *
 * It changes what Owwy says on a quiet day (see `focusMessage` in
 * lib/finance/owwy-voice) and is part of what Ask Owwy is told, so it is
 * worth being able to change when the answer changes.
 */
export function FocusSection() {
  const { settings } = useFinance();
  const chosen = settings.mainGoals;

  const toggle = (value: (typeof MAIN_GOALS)[number]["value"]) => {
    const next = toggleMainGoal(chosen, value);
    if (next.length === chosen.length && next.every((g, i) => g === chosen[i])) return;
    void haptic("light");
    void updateSettings({ mainGoals: next, mainGoal: next[0] });
  };

  return (
    <fieldset>
      <legend className="mb-1 text-callout font-semibold text-ink-2">What matters most right now?</legend>
      <p className="mb-2.5 text-caption text-ink-3">Pick as many as you like. Owwy leans on these when it has something to say.</p>
      <div className="flex flex-col gap-2">
        {MAIN_GOALS.map((g) => {
          const selected = chosen.includes(g.value);
          return (
            <button
              key={g.value}
              type="button"
              role="checkbox"
              aria-checked={selected}
              onClick={() => toggle(g.value)}
              className={cn(
                "press flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left outline-none",
                selected ? "border-brand bg-brand-soft/60" : "border-line/70 bg-surface hover:border-line-strong",
              )}
            >
              <span className="text-[22px]" aria-hidden>
                {g.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{g.label}</span>
                <span className="block text-caption text-ink-3">{g.hint}</span>
              </span>
              <span
                className={cn("flex size-6 shrink-0 items-center justify-center rounded-lg border-2", selected ? "border-brand bg-brand text-brand-ink" : "border-line-strong")}
                aria-hidden
              >
                {selected ? <Check className="size-4" strokeWidth={3} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
