"use client";

import { ArrowUp, Lock, PenLine, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "@/components/ui/app-link";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { useFinance } from "@/hooks/use-finance";
import { looksLikeQuestion } from "@/lib/assistant/local-engine";
import { parseLogEntries } from "@/lib/finance/log-splitter";
import { cn } from "@/lib/utils/cn";
import { useUI } from "@/stores/ui";

/**
 * Type a transaction the way you'd say it, or ask a question.
 *
 * Lives on home in both of its shapes: inside the Grove, where it sits on
 * the dark forest, and on its own when the Grove is off. It is the quickest
 * way into the app, so turning the Grove off must not take it away — the
 * only difference between the two is colour.
 */
export function QuickComposer({ tone = "scene" }: { tone?: "scene" | "surface" }) {
  const { settings, state, today, currency } = useFinance();
  const router = useRouter();
  const openAdd = useUI((s) => s.openAddTransaction);
  const [text, setText] = useState("");
  const scene = tone === "scene";

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

  const aiOn = settings.assistant.provider !== "local";
  const chip = scene
    ? "bg-black/25 text-[#f1ecdf]/85 ring-1 ring-white/10 ring-inset backdrop-blur-md hover:bg-black/35"
    : "border border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink";

  return (
    <div className={cn("relative z-30", scene ? "px-4 pt-2 pb-4" : "pb-5")}>
      <div className="mb-2.5 flex items-center justify-between">
        <Link href="/settings/#assistant" className={cn("press hit inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-caption font-semibold", chip)}>
          {aiOn ? <Sparkles className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
          {aiOn ? "On device + AI" : "On device"}
        </Link>
        <button type="button" onClick={() => openAdd()} className={cn("press hit inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-caption font-semibold", chip)}>
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
        className={cn(
          "flex h-14 items-center gap-2 rounded-[20px] pr-1.5 pl-1.5",
          scene
            ? "bg-[#0a1a16]/70 ring-1 ring-white/12 backdrop-blur-xl ring-inset focus-within:ring-[#6cc7b3]/70"
            : "border border-line bg-surface shadow-xs focus-within:border-brand",
        )}
      >
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", scene ? "bg-white/8" : "bg-brand-soft")} aria-hidden>
          <OwwyMascot mood="happy" size={30} />
        </span>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Type a transaction or ask a question</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a transaction…"
            className={cn(
              "h-12 w-full bg-transparent text-body outline-none",
              scene ? "text-[#f5f1e6] placeholder:text-[#f1ecdf]/45" : "text-ink placeholder:text-ink-3",
            )}
            enterKeyHint="send"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          aria-label={text.trim() ? "Send" : "Open Ask Owwy"}
          className={cn(
            "press flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors",
            text.trim()
              ? scene
                ? "bg-[#6cc7b3] text-[#062520]"
                : "bg-brand text-brand-ink"
              : scene
                ? "bg-white/10 text-[#f1ecdf]/80"
                : "bg-surface-2 text-ink-3",
          )}
        >
          {text.trim() ? <ArrowUp className="size-5" strokeWidth={2.5} /> : <Sparkles className="size-5" />}
        </button>
      </form>
    </div>
  );
}
