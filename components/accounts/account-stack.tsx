"use client";

import { AnimatePresence, m } from "motion/react";
import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { haptic } from "@/lib/platform";
import { cn } from "@/lib/utils/cn";
import type { Account } from "@/types/models";
import { AccountCard } from "./account-card";

/**
 * How much of each card behind the front one stays visible. The deck grows
 * *upward*: the front card sits lowest and on top, so every card behind shows
 * its own top edge — the type chip and the mark — rather than a blank strip of
 * its bottom, which would be a target you can't identify before tapping it.
 */
const PEEK = 42;
/**
 * How many cards behind the front one get their own slot by default.
 *
 * On a dashboard summary a five-card deck is the point: it says "this is your
 * wallet" without becoming the whole screen, and "All accounts" is right
 * there. The Wallet screen passes `depth="all"`, because a card you cannot
 * see on the screen whose entire job is showing your cards is a bug.
 */
const VISIBLE = 4;

const SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;

export interface StackAccount extends Account {
  balance: number;
}

/**
 * The wallet, as a deck rather than a filmstrip.
 *
 * A horizontal scroller hid every card but one and gave no sense of how many
 * there were. Stacked, the whole wallet is visible at a glance: the front card
 * is readable in full and the rest peek out behind it in order. Tapping a card
 * behind deals it to the front; tapping the front card opens it.
 *
 * Order is presentational only — it never touches the stored account order, so
 * shuffling the deck here doesn't rearrange the Wallet screen.
 */
export function AccountStack({
  accounts,
  onOpen,
  onAdd,
  className,
  depth = VISIBLE,
}: {
  accounts: StackAccount[];
  onOpen: (account: StackAccount) => void;
  onAdd: () => void;
  className?: string;
  /** Cards drawn apart behind the front one; "all" fans out the whole wallet. */
  depth?: number | "all";
}) {
  const [frontId, setFrontId] = useState<string | null>(null);

  // The chosen card first, everything else in its original order behind it.
  const ordered = useMemo(() => {
    if (!frontId) return accounts;
    const front = accounts.find((a) => a.id === frontId);
    if (!front) return accounts;
    return [front, ...accounts.filter((a) => a.id !== frontId)];
  }, [accounts, frontId]);

  const bringForward = useCallback((account: StackAccount) => {
    setFrontId(account.id);
    void haptic("light");
  }, []);

  const slots = depth === "all" ? ordered.length - 1 : depth;
  const fanned = Math.max(0, Math.min(ordered.length - 1, slots));
  const height = `calc(var(--card-h) + ${fanned * PEEK}px)`;

  return (
    <div className={cn("@container", className)}>
      {/* The card is a fixed 1.62 ratio, so its height follows the column width. */}
      <div
        className="relative [--card-h:calc((100cqw_-_0px)/1.62)]"
        style={{ height }}
        role="list"
        aria-label={`${accounts.length} accounts, stacked`}
      >
        <AnimatePresence initial={false}>
          {ordered.map((account, index) => {
            const buried = index > fanned;
            const isFront = index === 0;
            // The front card is pushed furthest down and drawn on top; each
            // card behind sits one PEEK higher, leaving its top edge showing.
            const step = Math.min(index, fanned);
            return (
              <m.div
                key={account.id}
                role="listitem"
                layout
                initial={false}
                animate={{ y: (fanned - step) * PEEK, opacity: buried ? 0 : 1 }}
                transition={SPRING}
                style={{ zIndex: ordered.length - index }}
                className="absolute inset-x-0 top-0"
              >
                <AccountCard
                  account={account}
                  onClick={() => (isFront ? onOpen(account) : bringForward(account))}
                  label={isFront ? `${account.name}, open details` : `${account.name}, bring to front`}
                  // Only the front card is reachable by tab; the rest would be
                  // a long detour past cards you cannot read yet.
                  tabIndex={buried ? -1 : 0}
                  hidden={buried}
                />
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="press mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong text-callout font-semibold text-ink-2 hover:border-brand hover:text-brand"
      >
        <Plus className="size-4" aria-hidden />
        Add account
      </button>
    </div>
  );
}
