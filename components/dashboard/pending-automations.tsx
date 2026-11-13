"use client";

import { Check, Repeat } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, EmojiTile, Money, SectionHeader } from "@/components/ui/display";
import { useFinance } from "@/hooks/use-finance";
import { formatRelativeDate } from "@/lib/dates";
import { pendingAutomations } from "@/lib/finance/recurring";
import { haptic } from "@/lib/platform";
import { confirmAutomation, restoreRecurring, skipAutomation } from "@/lib/storage/repositories/recurring";
import { deleteTransaction } from "@/lib/storage/repositories/transactions";
import { toast } from "@/stores/ui";
import type { ID } from "@/types/models";

/** "Ask first" automations whose date has come: one tap to log, or skip. */
export function PendingAutomationsWidget() {
  const { data, state, today, fmt } = useFinance();
  const [busy, setBusy] = useState<ID | null>(null);
  const pending = pendingAutomations(data.recurring, today);
  if (!pending.length) return null;

  return (
    <Card as="section" aria-labelledby="pending-title" className="p-5">
      <SectionHeader id="pending-title" title="Waiting for you" href="/recurring/" actionLabel="Automations" />
      <ul className="flex flex-col gap-2">
        {pending.map((rule) => {
          const category = rule.categoryId ? state.categoriesById.get(rule.categoryId) : undefined;
          const account = state.accountsById.get(rule.accountId);
          return (
            <li key={rule.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-surface-2/70 p-3">
              {category ? (
                <EmojiTile emoji={category.emoji} color={category.color} size="sm" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-xl bg-surface-3 text-ink-2" aria-hidden>
                  <Repeat className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{rule.name}</p>
                <p className="truncate text-caption text-ink-3">
                  {formatRelativeDate(rule.nextDate, today)} · {account?.name}
                </p>
              </div>
              <Money value={rule.type === "expense" ? -rule.amount : rule.amount} signed={rule.type === "income"} className="text-callout font-bold" />
              <div className="ml-auto flex w-full justify-end gap-1 sm:w-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === rule.id}
                  onClick={async () => {
                    setBusy(rule.id);
                    try {
                      const previous = await skipAutomation(rule.id);
                      toast.show(`Skipped ${rule.name}`, { action: { label: "Undo", onClick: () => restoreRecurring(previous) } });
                    } catch (e) {
                      toast.error(e);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  loading={busy === rule.id}
                  onClick={async () => {
                    setBusy(rule.id);
                    try {
                      const { transaction, previous } = await confirmAutomation(rule.id);
                      void haptic("success");
                      toast.success(`Saved to your log · ${fmt(rule.amount)}`, {
                        action: {
                          label: "Undo",
                          onClick: async () => {
                            await deleteTransaction(transaction.id);
                            await restoreRecurring(previous);
                          },
                        },
                      });
                    } catch (e) {
                      toast.error(e);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Check />
                  Log it
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
