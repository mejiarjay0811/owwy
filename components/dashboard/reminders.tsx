"use client";

import { Bell, ChevronRight } from "lucide-react";
import Link from "@/components/ui/app-link";
import { useMemo, useState } from "react";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Money } from "@/components/ui/display";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { computeReminders, remindersHeadline, type Reminder } from "@/lib/finance/reminders";
import { cn } from "@/lib/utils/cn";

const SEEN_KEY = "owwy.reminders.seen";

function readSeen(): Set<string> {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    // Private mode or storage blocked — the dot just shows again next time.
  }
}

export function useReminders(): Reminder[] {
  const { state, data, settings } = useFinance();
  return useMemo(
    () =>
      computeReminders({
        today: state.today,
        month: state.month,
        expenses: settings.billReminders ? state.upcoming.expenses : state.upcoming.expenses.filter((m) => m.source !== "bill"),
        recurring: data.recurring,
        budgets: state.budgetProgress,
        receivables: state.receivableProgress,
        snapshots: data.snapshots,
        paydayDaysLeft: state.payday.daysLeft,
      }),
    [state, data.recurring, data.snapshots, settings.billReminders],
  );
}

/** Bell with an unread dot; opens a sheet of everything that needs attention. */
export function RemindersButton({ tone = "surface" }: { tone?: "surface" | "scene" }) {
  const reminders = useReminders();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const unread = reminders.filter((r) => !seen.has(r.id)).length;

  const openSheet = () => {
    setOpen(true);
    const ids = reminders.map((r) => r.id);
    writeSeen([...seen, ...ids.filter((id) => !seen.has(id))]);
    setSeen(new Set([...seen, ...ids]));
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={unread ? `Reminders, ${unread} new` : "Reminders"}
        title="Reminders"
        className={cn(
          "press relative inline-flex items-center justify-center rounded-full [&_svg]:size-[18px]",
          tone === "scene" ? "size-9 text-[#f1ecdf]/80 hover:bg-white/10" : "size-11 border border-line bg-surface text-ink shadow-xs hover:bg-surface-2 [&_svg]:size-[20px]",
        )}
      >
        <Bell aria-hidden />
        {unread ? (
          <span
            className={cn(
              "absolute flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-4 font-extrabold text-[#241a06]",
              tone === "scene" ? "top-0.5 right-0.5" : "top-1 right-1",
            )}
            aria-hidden
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      <RemindersSheet open={open} onOpenChange={setOpen} reminders={reminders} />
    </>
  );
}

export function RemindersSheet({ open, onOpenChange, reminders }: { open: boolean; onOpenChange: (open: boolean) => void; reminders: Reminder[] }) {
  const calm = reminders.length === 0;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Reminders" size="sm">
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-2/70 p-3">
        <OwwyMascot mood={calm ? "sleeping" : reminders.some((r) => r.kind === "overdue") ? "concerned" : "encouraging"} size={48} />
        <p className="text-callout font-medium text-ink-2">{remindersHeadline(reminders)}</p>
      </div>
      {calm ? (
        <p className="pb-2 text-center text-caption text-ink-3">Bills due soon, over-budget categories and automations waiting for you will show up here.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {reminders.map((r) => (
            <li key={r.id}>
              <Link href={r.href} onClick={() => onOpenChange(false)} className="press flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-surface-2/60">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl text-[20px]",
                    r.kind === "overdue" ? "bg-negative-soft" : r.kind === "due" || r.kind === "budget" ? "bg-warning-soft" : "bg-surface-2",
                  )}
                  aria-hidden
                >
                  {r.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body leading-snug font-semibold">{r.title}</span>
                  <span className={cn("block text-caption", r.kind === "overdue" ? "font-semibold text-negative" : "text-ink-3")}>{r.detail}</span>
                </span>
                {r.amount ? <Money value={r.amount} className="text-callout font-bold" /> : null}
                <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
