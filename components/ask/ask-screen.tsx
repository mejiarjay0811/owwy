"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUp, ChevronRight, ClipboardCopy, Info, Lock, Sparkles, Square, Trash } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Chip } from "@/components/ui/form";
import { useFinance } from "@/hooks/use-finance";
import { askClaude, describeAssistantError } from "@/lib/assistant/claude";
import { askOpenAiCompatible } from "@/lib/assistant/openai-compatible";
import { describeModel, providerInfo } from "@/lib/assistant/providers";
import { answerLocally, STARTER_GROUPS } from "@/lib/assistant/local-engine";
import { haptic } from "@/lib/platform";
import { isDraftComplete, saveStagedDrafts } from "@/lib/services/staged";
import { readAssistantKey } from "@/lib/security/secrets";
import { addChatMessage, clearChat, listChat, updateChatBlocks } from "@/lib/storage/repositories/chat";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { ChatBlock, ChatMessage } from "@/types/models";
import { AssistantSettingsSheet } from "./assistant-settings";
import { useVoiceSupported, VoiceButton } from "./voice-button";
import { QueryBlock, RichText, StagedBlock } from "./chat-blocks";

export function AskScreen() {
  const finance = useFinance();
  const { settings } = finance;
  const router = useRouter();
  const params = useSearchParams();
  const messages = useLiveQuery(listChat, [], [] as ChatMessage[]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const handledQuery = useRef(false);
  const financeRef = useRef(finance);
  useEffect(() => {
    financeRef.current = finance;
  });

  const aiOn = settings.assistant.provider !== "local";
  const voiceSupported = useVoiceSupported();

  const send = useCallback(async (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    const { data, state, today, currency, settings: s } = financeRef.current;
    const ctx = { data, state, today, currency, brief: s.assistant.brief };
    setText("");
    setBusy(true);
    const history = await listChat();
    await addChatMessage("user", [{ type: "text", text: question }]);

    const provider = providerInfo(s.assistant.provider);
    const usingAi = s.assistant.provider !== "local";
    const apiKey = usingAi ? ((await readAssistantKey()) ?? "") : "";
    // A self-hosted service may legitimately need no key; everything else
    // falls back to answering on device until one is saved.
    if (!usingAi || (!apiKey && !provider.keyOptional)) {
      const reply = answerLocally(question, ctx);
      // A beat of "thinking" keeps the exchange feeling natural.
      await new Promise((r) => setTimeout(r, 350));
      await addChatMessage("assistant", s.assistant.autoLog ? await autoLog(reply.blocks) : reply.blocks, "On device");
      setBusy(false);
      return;
    }

    const placeholder = await addChatMessage("assistant", [{ type: "status", text: "Thinking…" }], describeModel(s.assistant.provider, s.assistant.model));
    const live: ChatBlock[] = [];
    abort.current = new AbortController();
    const request = {
      apiKey,
      baseUrl: s.assistant.baseUrl || provider.baseUrl,
      model: s.assistant.model,
      question,
      history,
      ctx,
      shareNotes: s.assistant.shareNotes,
      signal: abort.current.signal,
      onBlock: (block: ChatBlock) => {
        live.push(block);
        void updateChatBlocks(placeholder.id, [...live, ...(block.type === "text" || block.type === "error" ? [] : [{ type: "status" as const, text: "Working it out…" }])]);
      },
    };
    try {
      // Two wire formats cover every service in the catalogue.
      await (provider.api === "anthropic" ? askClaude(request) : askOpenAiCompatible(request));
      const final: ChatBlock[] = live.length ? live : [{ type: "text", text: "I didn't find anything to say about that." }];
      await updateChatBlocks(placeholder.id, s.assistant.autoLog ? await autoLog(final) : final);
    } catch (error) {
      const offlineFallback = answerLocally(question, ctx);
      const stopped = error instanceof Error && (error.name === "APIUserAbortError" || error.name === "AbortError");
      await updateChatBlocks(placeholder.id, [...live, { type: "error", text: describeAssistantError(error) }, ...(stopped ? [] : offlineFallback.blocks)]);
    } finally {
      abort.current = null;
      setBusy(false);
    }
  }, []);

  // Questions typed on the home composer arrive as ?q=
  useEffect(() => {
    const q = params.get("q");
    if (q && !handledQuery.current) {
      handledQuery.current = true;
      router.replace("/ask/");
      void send(q);
    }
  }, [params, router, send]);

  const lastBlockCount = messages.at(-1)?.blocks.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastBlockCount]);

  const copyLog = async () => {
    const log = messages
      .map((msg) => {
        const body = msg.blocks
          .map((b) => (b.type === "text" || b.type === "status" || b.type === "error" ? b.text : b.type === "query" ? `[${b.title}: ${b.rowCount} rows]` : b.type === "staged" ? `[${b.drafts.length} staged, ${b.status}]` : ""))
          .filter(Boolean)
          .join("\n");
        return `${msg.role === "user" ? "You" : `Owwy (${msg.source ?? "On device"})`}: ${body}`;
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(log);
      toast.success("Conversation copied");
    } catch {
      toast.error(new Error("Couldn't copy on this device."));
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--nav-height)-var(--safe-bottom)-28px)] w-full max-w-[760px] flex-col px-4 sm:px-6 lg:min-h-dvh lg:px-10">
      <header className="sticky top-0 z-30 -mx-4 bg-bg/85 px-4 pt-[calc(10px+var(--safe-top))] pb-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-8 lg:backdrop-blur-none">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <OwwyMascot mood={busy ? "thinking" : "happy"} size={40} animated />
          {/* The title held a fixed size and refused to wrap, so the action
              buttons were pushed off a 320px screen. It now shrinks, and
              ellipsises rather than overflowing if it still runs out of room. */}
          <h1 className="min-w-0 truncate font-display text-[1.5rem] leading-none sm:text-[1.75rem]">Ask Owwy</h1>
          <IconButton size="sm" label="How Ask Owwy works" onClick={() => setInfoOpen(true)}>
            <Info />
          </IconButton>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={copyLog}
              disabled={!messages.length}
              aria-label="Copy log"
              // Collapses to an icon under `sm`, which puts it under 44px.
              className="press hit inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-2.5 text-caption font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-40 sm:px-3"
            >
              <ClipboardCopy className="size-4" aria-hidden />
              <span className="max-sm:hidden">Copy log</span>
            </button>
            <IconButton size="sm" variant="surface" label="Clear conversation" onClick={() => setConfirmClear(true)} disabled={!messages.length}>
              <Trash />
            </IconButton>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="press mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-caption font-semibold text-ink-2 hover:text-ink"
        >
          {aiOn ? <Sparkles className="size-3.5 text-accent" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
          {aiOn ? describeModel(settings.assistant.provider, settings.assistant.model) : "On device"}
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 py-4" role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <OwwyMascot mood="happy" size={96} animated />
            <p className="font-display mt-4 text-[1.5rem]">{settings.displayName ? `Hi ${settings.displayName}!` : "Ask about your money"}</p>
            <p className="mt-1 max-w-sm text-body text-ink-2">
              Ask about your money, or just type {voiceSupported ? "or dictate " : ""}a transaction like “Spent 250 on food” or “Salary 15000” and I&apos;ll{" "}
              {settings.assistant.autoLog ? "log it" : "get it ready for you"}.
            </p>
{/* Grouped rather than a single pile of chips: four examples read as
                "here are some things", twelve read as a wall. Every one is
                answered on the device — see STARTER_GROUPS. */}
            <div className="mt-6 flex w-full max-w-md flex-col gap-4 text-left">
              {STARTER_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="mb-1.5 px-1 text-eyebrow font-bold tracking-[0.09em] text-ink-3 uppercase">{group.title}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.questions.map((q) => (
                      <Chip key={q} multiline onClick={() => void send(q)}>
                        {q}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageView key={msg.id} message={msg} onSuggestion={(q) => void send(q)} />)
        )}
        <AnimatePresence>
          {busy && !aiOn ? (
            <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-callout text-ink-3">
              <TypingDots /> Owwy is reading your data…
            </m.div>
          ) : null}
        </AnimatePresence>
        {/* Scroll margin keeps the newest message clear of the sticky composer and nav. */}
        <div ref={endRef} className="scroll-mb-[calc(var(--nav-inset)+150px)] lg:scroll-mb-40" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy && abort.current) abort.current.abort();
          else void send(text);
        }}
        // Pinned above whatever is at the bottom — the tab bar normally, the
        // keyboard while you're typing. See --nav-inset.
        className="sticky bottom-[calc(var(--nav-inset)+20px)] z-20 mb-2 rounded-[22px] border border-line bg-bg-elevated/95 p-2 shadow-md backdrop-blur-xl lg:bottom-6"
      >
        <div className="mb-1.5 flex items-center gap-1.5 px-1">
          <button
            type="button"
            aria-pressed={settings.assistant.brief}
            onClick={() => void updateSettings({ assistant: { brief: !settings.assistant.brief } })}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-caption font-semibold",
              settings.assistant.brief ? "border-brand/60 bg-brand-soft text-brand-soft-ink" : "border-line text-ink-3",
            )}
          >
            Brief
          </button>
          <button
            type="button"
            aria-pressed={settings.assistant.autoLog}
            onClick={() => void updateSettings({ assistant: { autoLog: !settings.assistant.autoLog } })}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-caption font-semibold",
              settings.assistant.autoLog ? "border-brand/60 bg-brand-soft text-brand-soft-ink" : "border-line text-ink-3",
            )}
            title="Log clear entries instantly, with Cancel"
          >
            Instant log
          </button>
          <span className="truncate text-caption text-ink-3">{settings.assistant.autoLog ? "Logs right away" : "Review before saving"}</span>
        </div>
        <div className="flex items-center gap-2">
          {voiceSupported ? <VoiceButton onText={(t) => setText((current) => (current ? `${current} ${t}` : t))} /> : null}
          <label className="min-w-0 flex-1">
            <span className="sr-only">Ask or log anything</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask about your data…"
              className="h-12 w-full rounded-2xl bg-surface-2 px-4 outline-none placeholder:text-ink-3 focus:bg-surface focus:ring-2 focus:ring-brand/50"
              enterKeyHint="send"
              autoComplete="off"
              disabled={busy && !aiOn}
            />
          </label>
          <button
            type="submit"
            aria-label={busy && aiOn ? "Stop" : "Send"}
            disabled={!busy && !text.trim()}
            className="press flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-ink disabled:bg-surface-3 disabled:text-ink-3"
          >
            {busy && aiOn ? <Square className="size-4 fill-current" /> : <ArrowUp className="size-5" strokeWidth={2.5} />}
          </button>
        </div>
      </form>

      <AssistantSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear this conversation?"
        description="Messages are removed from this device. Transactions you saved stay in your log."
        confirmLabel="Clear"
        destructive
        onConfirm={() => clearChat()}
      />
      <ConfirmDialog
        open={infoOpen}
        onOpenChange={setInfoOpen}
        title="How Ask Owwy works"
        description={
          <span className="flex flex-col gap-2">
            <span>Log things by typing them — “lunch 250 and grab home 120, gcash” — then review and save.</span>
            <span>Ask questions and Owwy runs a query on your own data. Tap “Ran a query” under any answer to see exactly what it looked at.</span>
            <span>{aiOn ? "AI mode sends only what each question needs to the service you chose, using your own key." : "On device mode never sends anything anywhere."}</span>
          </span>
        }
        confirmLabel="Got it"
        cancelLabel="Close"
        onConfirm={() => undefined}
      />
    </div>
  );
}

/**
 * Instant-log mode: clear, complete entries are saved right away and shown as
 * "Logged" with a Cancel button. Anything missing details still waits for review.
 */
async function autoLog(blocks: ChatBlock[]): Promise<ChatBlock[]> {
  const result: ChatBlock[] = [];
  for (const block of blocks) {
    if (block.type === "staged" && block.status === "pending" && block.drafts.length && block.drafts.every(isDraftComplete)) {
      try {
        const { savedIds, previousBills } = await saveStagedDrafts(block.drafts);
        void haptic("success");
        result.push({ ...block, status: "saved", savedIds, previousBills, auto: true });
        continue;
      } catch {
        // Fall back to review if saving failed.
      }
    }
    result.push(block);
  }
  return result;
}

function MessageView({ message, onSuggestion }: { message: ChatMessage; onSuggestion: (q: string) => void }) {
  if (message.role === "user") {
    const text = message.blocks.find((b) => b.type === "text");
    return (
      <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <p className="max-w-[85%] rounded-[20px] rounded-br-md bg-brand px-4 py-2.5 text-body text-brand-ink">{text?.type === "text" ? text.text : ""}</p>
      </m.div>
    );
  }

  const queries = message.blocks.filter((b) => b.type === "query").length;
  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex max-w-[92%] flex-col gap-2">
      {message.blocks.map((block, i) => {
        switch (block.type) {
          case "status":
            return (
              <p key={i} className="flex items-center gap-2 px-1 text-callout text-ink-3 italic">
                {i === message.blocks.length - 1 ? <TypingDots /> : null}
                {block.text}
              </p>
            );
          case "query":
            return <QueryBlock key={i} block={block} />;
          case "text":
            return (
              <div key={i} className="rounded-[20px] rounded-tl-md border border-line/70 bg-surface px-4 py-3 text-body text-ink-2 shadow-xs">
                <RichText text={block.text} />
              </div>
            );
          case "staged":
            return <StagedBlock key={i} message={message} index={i} block={block} />;
          case "suggestions":
            return (
              <div key={i} className="flex flex-wrap gap-2">
                {block.items.map((q) => (
                  <Chip key={q} multiline onClick={() => onSuggestion(q)} className="min-h-8">
                    {q}
                  </Chip>
                ))}
              </div>
            );
          case "error":
            return (
              <p key={i} className="rounded-2xl bg-warning-soft px-4 py-2.5 text-callout text-warning">
                {block.text}
              </p>
            );
        }
      })}
      <p className="px-1 text-caption text-ink-3">
        {queries ? `${queries} ${queries === 1 ? "query" : "queries"} · ` : ""}
        {message.source ?? "On device"}
      </p>
    </m.div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}
