"use client";

import { useEffect, useRef } from "react";
import { useFinance } from "@/hooks/use-finance";
import { addDays, parseISODate } from "@/lib/dates";
import { billOccurrences } from "@/lib/finance/bills";
import { isNative, scheduleReminders } from "@/lib/platform";

/**
 * Keeps on-device bill reminders in sync (native app only).
 * Reminders fire at 9:00 local time, `remindDaysBefore` days before the due date.
 */
export function ReminderSync() {
  const { data, settings, today, fmt, state } = useFinance();
  const lastKey = useRef("");

  useEffect(() => {
    if (!isNative() || !settings.billReminders) return;
    const occurrences = billOccurrences(data.bills, today, addDays(today, 60), false);
    const reminders = occurrences.map((o) => {
      const { y, m, d } = parseISODate(addDays(o.date, -o.bill.remindDaysBefore));
      const days = o.bill.remindDaysBefore;
      return {
        id: `${o.bill.id}:${o.date}`,
        title: `${o.bill.emoji} ${o.bill.name} is due ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}`,
        body: state.accountsById.get(o.bill.accountId ?? "") ? `${fmt(o.amount)} from ${state.accountsById.get(o.bill.accountId ?? "")?.name}` : fmt(o.amount),
        at: new Date(y, m - 1, d, 9, 0, 0),
      };
    });
    const key = reminders.map((r) => `${r.id}@${r.at.getTime()}`).join("|");
    if (key === lastKey.current) return;
    lastKey.current = key;
    void scheduleReminders(reminders);
  }, [data.bills, settings.billReminders, today, fmt, state.accountsById]);

  return null;
}
