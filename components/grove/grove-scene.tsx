"use client";

import { ArrowUp, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, PenLine, RotateCcw, Sparkles } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "@/components/ui/app-link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { RemindersButton } from "@/components/dashboard/reminders";
import { OwwyMascot, OwwyMark } from "@/components/owwy/owwy-mascot";
import { Money } from "@/components/ui/display";
import { useFinance } from "@/hooks/use-finance";
import { looksLikeQuestion } from "@/lib/assistant/local-engine";
import { addDays, diffDays, formatShortDate, greetingFor, monthKey, monthName, monthStart, weekdayName } from "@/lib/dates";
import { parseLogEntries } from "@/lib/finance/log-splitter";
import type { OwwyMessage } from "@/lib/finance/owwy-voice";
import { haptic } from "@/lib/platform";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { cn } from "@/lib/utils/cn";
import { useUI } from "@/stores/ui";
import type { Category, ID, ISODate, Transaction } from "@/types/models";

const MAX_TREES = 6;
const MAX_DAYS_BACK = 180;
const DRAG_STEP_PX = 34;

interface TreeModel {
  category: Category;
  total: number;
  count: number;
  /** 0–1 share of the tallest tree's month total. */
  height: number;
  x: number;
}

/**
 * The Grove — Owwy's home scene. Each spending category is a tree that grows
 * as the month's spending adds up; Owwy perches on the tallest. The selected
 * day's transactions float as fireflies. Drag sideways to travel back in time.
 */
export function GroveScene({ message }: { message: OwwyMessage }) {
  const { state, settings, today } = useFinance();
  const router = useRouter();
  const [selected, setSelected] = useState<ISODate>(today);
  const [activeTree, setActiveTree] = useState<ID | null>(null);
  const [activeFirefly, setActiveFirefly] = useState<ID | null>(null);
  const drag = useRef<{ x: number; days: number; moved: boolean } | null>(null);

  const isToday = selected === today;
  const month = monthKey(selected);
  const monthEndView = month === state.month ? today : `${month}-31`;

  const trees = useMemo<TreeModel[]>(() => {
    const totals = new Map<ID, { full: number; upTo: number; count: number }>();
    for (const tx of state.baseTransactions) {
      if (tx.type !== "expense" || !tx.categoryId || tx.receivableId || tx.date < monthStart(month) || tx.date > monthEndView) continue;
      const entry = totals.get(tx.categoryId) ?? { full: 0, upTo: 0, count: 0 };
      entry.full += tx.amount;
      if (tx.date <= selected) {
        entry.upTo += tx.amount;
        entry.count++;
      }
      totals.set(tx.categoryId, entry);
    }
    const ranked = [...totals.entries()]
      .map(([id, t]) => ({ category: state.categoriesById.get(id), ...t }))
      .filter((t): t is { category: Category; full: number; upTo: number; count: number } => Boolean(t.category))
      .sort((a, b) => b.full - a.full)
      .slice(0, MAX_TREES);
    const max = Math.max(1, ...ranked.map((r) => r.full));
    // Tallest in the middle, smaller trees fanning outward, like a real grove.
    const order = arrangeCenterOut(ranked.length);
    return ranked.map((r, i) => ({
      category: r.category,
      total: r.upTo,
      count: r.count,
      height: r.upTo / max,
      x: order[i],
    }));
  }, [state.baseTransactions, state.categoriesById, month, monthEndView, selected]);

  const dayTransactions = useMemo(
    () => state.transactions.filter((t) => t.date === selected && t.type !== "transfer").slice(0, 14),
    [state.transactions, selected],
  );
  const daySpent = dayTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const tallest = trees.reduce<TreeModel | null>((best, t) => (!best || t.height > best.height ? t : best), null);

  const travel = (days: number) => {
    const next = addDays(selected, days);
    if (next > today || diffDays(next, today) > MAX_DAYS_BACK) return;
    setSelected(next);
    setActiveFirefly(null);
    setActiveTree(null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, form")) return;
    drag.current = { x: e.clientX, days: 0, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const steps = Math.trunc((e.clientX - drag.current.x) / DRAG_STEP_PX);
    if (steps !== drag.current.days) {
      // Dragging right pulls the past into view.
      const delta = drag.current.days - steps;
      drag.current.days = steps;
      drag.current.moved = true;
      travel(delta);
      void haptic("light");
    }
  };
  const endDrag = () => {
    drag.current = null;
  };

  const name = settings.displayName.trim();

  return (
    <section
      aria-label="The Grove: your month as a forest"
      data-tour="grove"
      className={cn(
        "relative isolate -mx-4 flex touch-pan-y flex-col overflow-hidden rounded-b-[36px] select-none sm:mx-0 sm:rounded-[32px]",
        // A full-height forest with nothing in it is just a wall of empty sky
        // that pushes Safe to Spend and everything below it off the screen.
        // Before the first expense the scene collapses to a compact invitation.
        trees.length === 0 ? "min-h-[300px] lg:min-h-[300px]" : "min-h-[520px] lg:min-h-[460px]",
      )}
      style={{ background: "linear-gradient(180deg, #0b221d 0%, #12352d 46%, #1a4638 70%, #102a22 100%)" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "ArrowLeft") travel(-1);
        if (e.key === "ArrowRight") travel(1);
      }}
      tabIndex={0}
    >
      <SkyBackdrop />

      {/* Header */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-[calc(14px+var(--safe-top))] sm:pt-4">
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.2em] text-[#e9e3d2]/80">
          <OwwyMark size={16} tone="light" />
          OWWY
        </span>
        <div className="flex items-center gap-2">
          <RemindersButton tone="scene" />
          <SceneIcon label={settings.hideBalances ? "Show balances" : "Hide balances"} onClick={() => void updateSettings({ hideBalances: !settings.hideBalances })}>
            {settings.hideBalances ? <EyeOff /> : <Eye />}
          </SceneIcon>
          {settings.security.pinEnabled ? (
            <SceneIcon label="App lock is on" onClick={() => router.push("/settings/#security")}>
              <Lock />
            </SceneIcon>
          ) : null}
        </div>
      </div>

      <div className="relative z-20 mt-1 flex flex-col items-center px-6 text-center text-[#f1ecdf]">
        <AnimatePresence mode="wait" initial={false}>
          {isToday ? (
            <m.div key="today" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <h1 className="font-display text-[2rem] leading-tight">
                {greetingFor()}
                {name ? `, ${name}` : ""}
              </h1>
              <p className="mt-0.5 text-callout text-[#f1ecdf]/65">
                {weekdayName(today)}, {formatShortDate(today)}
              </p>
            </m.div>
          ) : (
            <m.div key={selected} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              <h1 className="font-display text-[1.75rem] leading-tight">
                {weekdayName(selected)}, {Number(selected.slice(8, 10))} {monthName(month)}
              </h1>
              <p className="mt-0.5 text-callout text-[#f1ecdf]/65">
                {dayTransactions.length} transaction{dayTransactions.length === 1 ? "" : "s"}
                {daySpent ? (
                  <>
                    {" · "}
                    <Money value={daySpent} /> spent
                  </>
                ) : null}
              </p>
            </m.div>
          )}
        </AnimatePresence>

        {isToday ? (
          message.href ? (
            <Link href={message.href} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-callout text-[#f1ecdf] ring-1 ring-white/12 backdrop-blur-md ring-inset hover:bg-white/15">
              <span className="size-1.5 shrink-0 rounded-full bg-[#f2b458]" aria-hidden />
              <span className="truncate">{message.text}</span>
            </Link>
          ) : (
            <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-callout ring-1 ring-white/12 backdrop-blur-md ring-inset">
              <span className="size-1.5 shrink-0 rounded-full bg-[#6cc7b3]" aria-hidden />
              <span className="truncate">{message.text}</span>
            </p>
          )
        ) : (
          <button
            type="button"
            onClick={() => {
              setSelected(today);
              setActiveFirefly(null);
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-callout font-semibold ring-1 ring-white/12 ring-inset hover:bg-white/15"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Back to today
          </button>
        )}
      </div>

      {/* The grove */}
      <div
        className={cn("relative z-10 flex-1", trees.length === 0 ? "min-h-[96px]" : "min-h-[240px]")}
        onClick={(e) => e.target === e.currentTarget && (setActiveTree(null), setActiveFirefly(null))}
      >
        {trees.length === 0 ? (
          <EmptyGrove />
        ) : (
          trees.map((tree, rank) => (
            <Tree
              key={tree.category.id}
              tree={tree}
              rank={rank}
              perched={tallest?.category.id === tree.category.id}
              active={activeTree === tree.category.id}
              onSelect={() => setActiveTree(activeTree === tree.category.id ? null : tree.category.id)}
            />
          ))
        )}

        {tallest && tallest.height > 0.05 ? (
          <div
            className="pointer-events-none absolute z-20 transition-[bottom,left] duration-700 ease-[var(--ease-soft)]"
            style={{ left: `${tallest.x}%`, bottom: `calc(${treeBottom}% + ${treeHeightPct(tallest.height)}% - 10px)`, transform: "translateX(-50%)" }}
          >
            <OwwyMascot mood={message.mood} size={52} animated className="text-black drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]" />
          </div>
        ) : null}

        <AnimatePresence>
          {dayTransactions.map((tx, i) => {
            const tree = trees.find((t) => t.category.id === tx.categoryId);
            const x = tree ? tree.x + jitter(tx.id, 9) : 12 + ((i * 17) % 76);
            const y = tree ? Math.min(78, treeBottom + treeHeightPct(tree.height) * (0.35 + ((hash(tx.id) % 40) / 100))) : 55 + (hash(tx.id) % 20);
            return (
              <m.button
                key={tx.id}
                type="button"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", damping: 14, stiffness: 260, delay: i * 0.03 }}
                onClick={() => setActiveFirefly(activeFirefly === tx.id ? null : tx.id)}
                aria-label={`${tx.note || state.categoriesById.get(tx.categoryId ?? "")?.name || "Transaction"}, ${tx.type}`}
                // The button is an invisible catcher around a 10px dot, so its
                // size is purely the tap target: make it a full 44px.
                className="absolute z-30 flex size-11 -translate-x-1/2 translate-y-1/2 items-center justify-center"
                style={{ left: `${x}%`, bottom: `${y}%` }}
              >
                <span className="grove-firefly block size-2.5 rounded-full" style={{ background: tx.type === "income" ? "#8ff0d6" : "#ffd27a", boxShadow: `0 0 14px 5px ${tx.type === "income" ? "rgba(143,240,214,0.55)" : "rgba(255,196,94,0.55)"}`, animationDelay: `${(hash(tx.id) % 30) / 10}s` }} />
              </m.button>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {activeFirefly ? <FireflyCard key={activeFirefly} tx={dayTransactions.find((t) => t.id === activeFirefly)} onClose={() => setActiveFirefly(null)} /> : null}
          {activeTree ? <TreeCard key={activeTree} tree={trees.find((t) => t.category.id === activeTree)} month={month} onClose={() => setActiveTree(null)} /> : null}
        </AnimatePresence>

        {/* Time travel controls (also: drag the scene, or arrow keys) */}
        <div className="absolute inset-x-3 bottom-2 z-20 flex justify-between">
          <SceneIcon label="Previous day" onClick={() => travel(-1)} disabled={diffDays(selected, today) >= MAX_DAYS_BACK}>
            <ChevronLeft />
          </SceneIcon>
          <SceneIcon label="Next day" onClick={() => travel(1)} disabled={isToday}>
            <ChevronRight />
          </SceneIcon>
        </div>
      </div>

      <GroveComposer />

      <p className="sr-only" aria-live="polite">
        {trees.length
          ? `${isToday ? "This month so far" : `Up to ${formatShortDate(selected, today)}`}: ${trees.map((t) => `${t.category.name} ${t.count} transactions`).join(", ")}.`
          : "No spending recorded this month yet."}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ composer */

function GroveComposer() {
  const { settings, state, today, currency } = useFinance();
  const router = useRouter();
  const openAdd = useUI((s) => s.openAddTransaction);
  const [text, setText] = useState("");

  const submit = () => {
    const value = text.trim();
    if (!value) {
      router.push("/ask/");
      return;
    }
    const ctx = { categories: state.categories, accounts: state.activeAccounts, today, currency };
    const parsed = parseLogEntries(value, ctx);
    const single = parsed.entries.length === 1 && parsed.entries[0].amount !== null;
    setText("");
    if (!looksLikeQuestion(value) && single) {
      openAdd({ quickText: value, type: parsed.entries[0].type });
      return;
    }
    router.push(`/ask/?q=${encodeURIComponent(value)}`);
  };

  const aiOn = settings.assistant.provider === "anthropic";

  return (
    <div className="relative z-30 px-4 pt-2 pb-4">
      <div className="mb-2.5 flex items-center justify-between">
        <Link
          href="/settings/#assistant"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-black/25 px-3 text-caption font-semibold text-[#f1ecdf]/85 ring-1 ring-white/10 backdrop-blur-md ring-inset hover:bg-black/35"
        >
          {aiOn ? <Sparkles className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
          {aiOn ? "On device + AI" : "On device"}
        </Link>
        <button
          type="button"
          onClick={() => openAdd()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-black/25 px-3 text-caption font-semibold text-[#f1ecdf]/85 ring-1 ring-white/10 backdrop-blur-md ring-inset hover:bg-black/35"
        >
          <PenLine className="size-3.5" aria-hidden />
          By hand
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        data-tour="composer"
        className="flex h-14 items-center gap-2 rounded-[20px] bg-[#0a1a16]/70 pr-1.5 pl-1.5 ring-1 ring-white/12 backdrop-blur-xl ring-inset focus-within:ring-[#6cc7b3]/70"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/8" aria-hidden>
          <OwwyMascot mood="happy" size={30} />
        </span>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Type a transaction or ask a question</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a transaction…"
            className="h-12 w-full bg-transparent text-body text-[#f5f1e6] outline-none placeholder:text-[#f1ecdf]/45"
            enterKeyHint="send"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          aria-label={text.trim() ? "Send" : "Open Ask Owwy"}
          className={cn(
            "press flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors",
            text.trim() ? "bg-[#6cc7b3] text-[#062520]" : "bg-white/10 text-[#f1ecdf]/80",
          )}
        >
          {text.trim() ? <ArrowUp className="size-5" strokeWidth={2.5} /> : <Sparkles className="size-5" />}
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

/** Trees stand on the ground line at this % from the bottom of the grove area. */
const treeBottom = 6;

function treeHeightPct(height: number): number {
  // Saplings stay visible; the tallest reaches ~74% of the grove.
  return 12 + Math.max(0, Math.min(1, height)) * 62;
}

function Tree({ tree, rank, perched, active, onSelect }: { tree: TreeModel; rank: number; perched: boolean; active: boolean; onSelect: () => void }) {
  const { fmt, hidden } = useFinance();
  const tint = `color-mix(in srgb, ${tree.category.color} 30%, #2f7a5c)`;
  const tintDark = `color-mix(in srgb, ${tree.category.color} 22%, #1c5140)`;
  const heightPct = treeHeightPct(tree.height);
  // Only the three biggest trees get full name tags; the rest show their emoji, so tags never collide.
  const showName = rank < 3 || active;
  const edge = tree.x < 22 ? "left-0" : tree.x > 78 ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${tree.category.name}: ${hidden ? "amount hidden" : fmt(tree.total)} this month`}
      aria-pressed={active}
      className="group absolute z-10 flex w-[17%] max-w-[92px] min-w-[54px] -translate-x-1/2 flex-col items-center outline-none"
      style={{ left: `${tree.x}%`, bottom: `${treeBottom}%`, height: `${heightPct}%`, transition: "height 800ms var(--ease-soft)", zIndex: 10 + rank }}
    >
      <span
        className={cn(
          "absolute z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#f1ecdf] ring-1 ring-white/10 backdrop-blur-md ring-inset transition-colors",
          // The perched tree's tag sits inside the canopy so Owwy doesn't cover it.
          perched ? "top-[22%]" : "-top-7",
          edge,
          active ? "bg-[#f2b458] text-[#2a1a04]" : "bg-black/35 group-hover:bg-black/50",
        )}
      >
        <span aria-hidden>{tree.category.emoji}</span>
        {showName ? tree.category.name : null}
      </span>
      <svg viewBox="0 0 100 220" preserveAspectRatio="none" className={cn("grove-tree h-full w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)]", active && "brightness-125")} style={{ animationDelay: `${(hash(tree.category.id) % 50) / 10}s` }} aria-hidden>
        <rect x="45" y="170" width="10" height="50" rx="3" fill="#3b2a1c" />
        <path d="M50 4 C58 30 88 60 92 86 C70 82 60 80 50 80 C40 80 30 82 8 86 C12 60 42 30 50 4 Z" fill={tint} />
        <path d="M50 52 C60 80 94 112 96 140 C72 134 62 132 50 132 C38 132 28 134 4 140 C6 112 40 80 50 52 Z" fill={tintDark} />
        <path d="M50 100 C62 128 98 160 98 186 C74 180 62 178 50 178 C38 178 26 180 2 186 C2 160 38 128 50 100 Z" fill={tint} />
        <path d="M50 8 C54 26 66 44 74 58" stroke="rgba(255,255,255,0.18)" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/**
 * Before the first expense there is no forest to draw.
 *
 * Rather than solid trees — which contradict the line underneath them — the
 * ground shows three outlines: the shape the month *will* take, waiting to be
 * filled. The owl sleeps next to them instead of above, so the whole thing
 * reads as one compact row rather than a tall, half-empty scene.
 */
function EmptyGrove() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end pb-[6%]">
      <div className="flex items-end gap-5">
        {[26, 38, 22].map((h, i) => (
          <svg key={i} viewBox="0 0 100 200" width={26} height={h} aria-hidden className="opacity-45">
            <path
              d="M50 12 C62 58 94 118 94 182 L6 182 C6 118 38 58 50 12 Z"
              fill="none"
              stroke="#8fd8c7"
              strokeWidth="7"
              strokeLinejoin="round"
              strokeDasharray="16 13"
            />
          </svg>
        ))}
        <OwwyMascot mood="sleeping" size={40} animated className="-mb-1 text-black" />
      </div>
      <p className="mt-2.5 max-w-[17rem] text-center text-callout text-[#f1ecdf]/75">Nothing growing yet — log an expense and your first tree sprouts.</p>
    </div>
  );
}

function FireflyCard({ tx, onClose }: { tx?: Transaction; onClose: () => void }) {
  const { state } = useFinance();
  const openEdit = useUI((s) => s.openEditTransaction);
  if (!tx) return null;
  const category = tx.categoryId ? state.categoriesById.get(tx.categoryId) : undefined;
  const account = state.accountsById.get(tx.accountId);
  return (
    <m.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-x-6 bottom-14 z-40 mx-auto max-w-[280px]"
    >
      <button
        type="button"
        onClick={() => {
          onClose();
          openEdit(tx);
        }}
        className="flex w-full items-center gap-3 rounded-2xl bg-[#0a1a16]/85 p-3 text-left text-[#f1ecdf] shadow-lg ring-1 ring-white/12 backdrop-blur-xl ring-inset"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-[20px]" aria-hidden>
          {category?.emoji ?? "💰"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{tx.note || category?.name || "Transaction"}</span>
          <span className="block truncate text-caption text-[#f1ecdf]/60">
            {category?.name}
            {tx.time ? ` · ${tx.time}` : ""}
          </span>
          <span className="mt-0.5 block text-title-3 font-bold">
            <Money value={tx.type === "expense" ? -tx.amount : tx.amount} signed={tx.type === "income"} />
          </span>
          <span className="block truncate text-caption text-[#f1ecdf]/60">{account?.name}</span>
        </span>
      </button>
    </m.div>
  );
}

function TreeCard({ tree, month, onClose }: { tree?: TreeModel; month: string; onClose: () => void }) {
  const { state } = useFinance();
  if (!tree) return null;
  const budget = month === state.month ? state.budgetProgress.find((b) => b.budget.categoryId === tree.category.id && !b.budget.paused) : undefined;
  return (
    <m.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-x-6 bottom-14 z-40 mx-auto max-w-[300px] rounded-2xl bg-[#0a1a16]/85 p-4 text-[#f1ecdf] shadow-lg ring-1 ring-white/12 backdrop-blur-xl ring-inset"
    >
      <div className="flex items-center gap-2">
        <span className="text-[22px]" aria-hidden>
          {tree.category.emoji}
        </span>
        <span className="flex-1 font-semibold">{tree.category.name}</span>
        <button type="button" onClick={onClose} className="text-caption text-[#f1ecdf]/60 hover:text-[#f1ecdf]">
          Close
        </button>
      </div>
      <p className="mt-1 text-title-2 font-bold">
        <Money value={tree.total} />
      </p>
      <p className="text-caption text-[#f1ecdf]/60">
        {tree.count} transaction{tree.count === 1 ? "" : "s"} in {monthName(month)}
        {budget ? ` · ${Math.round(budget.percent)}% of budget` : ""}
      </p>
      <Link
        href={`/transactions/?q=${encodeURIComponent(`${tree.category.name} ${monthName(month)} ${month.slice(0, 4)}`)}`}
        className="mt-3 inline-flex text-callout font-semibold text-[#8fd8c7] hover:underline"
      >
        See transactions →
      </Link>
    </m.div>
  );
}

function SkyBackdrop() {
  const stars = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        x: (i * 37.7) % 100,
        y: (i * 23.3) % 46,
        r: i % 5 === 0 ? 1.6 : 1,
        delay: (i % 9) * 0.4,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden>
      {stars.map((s, i) => (
        <span key={i} className="grove-star absolute rounded-full bg-[#fff6dd]" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2, animationDelay: `${s.delay}s` }} />
      ))}
      {/* Moon: low in the left sky, clear of the greeting and the header buttons */}
      <span className="absolute top-[12.4%] left-[5.2%] size-9 rounded-full bg-[radial-gradient(circle,rgba(246,212,141,0.22),transparent_70%)]" />
      <span
        className="absolute top-[13.2%] left-[6.4%] size-7 rounded-full bg-[#f6d48d]"
        style={{ WebkitMaskImage: "radial-gradient(circle at 78% 28%, transparent 46%, #000 47%)", maskImage: "radial-gradient(circle at 78% 28%, transparent 46%, #000 47%)" }}
      />
      {/* Distant hills */}
      <svg className="absolute inset-x-0 bottom-0 h-[58%] w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
        <path d="M0 90 C60 60 120 70 180 88 C240 104 300 60 400 74 L400 200 L0 200 Z" fill="#153b31" opacity="0.8" />
        <path d="M0 130 C70 104 150 118 220 128 C290 138 340 112 400 118 L400 200 L0 200 Z" fill="#11332a" />
        <path d="M0 168 C80 156 170 164 260 160 C320 157 370 150 400 152 L400 200 L0 200 Z" fill="#0d271f" />
      </svg>
      {/* Mist */}
      <div className="absolute inset-x-0 bottom-[22%] h-24 bg-gradient-to-t from-transparent via-[#c9f0e2]/5 to-transparent" />
    </div>
  );
}

function SceneIcon({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="press hit inline-flex size-9 items-center justify-center rounded-full text-[#f1ecdf]/80 hover:bg-white/10 disabled:opacity-25 [&_svg]:size-[18px]"
    >
      {children}
    </button>
  );
}

/** Positions (in %) for n trees: tallest in the middle, alternating outward. */
function arrangeCenterOut(n: number): number[] {
  if (n === 0) return [];
  const slots = Array.from({ length: n }, (_, i) => 50 + (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * (n <= 3 ? 24 : n <= 4 ? 19 : 15));
  return slots.map((x) => Math.max(10, Math.min(90, x)));
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function jitter(id: string, range: number): number {
  return ((hash(id) % (range * 20)) / 10 - range) * 0.6;
}
