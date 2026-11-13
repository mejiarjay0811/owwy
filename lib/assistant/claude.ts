import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_MODELS } from "@/lib/defaults/settings";
import type { ChatBlock, ChatMessage } from "@/types/models";
import type { AssistantContext } from "./local-engine";
import { runTool, TOOL_DEFINITIONS } from "./tools";

/**
 * Optional AI mode: the user's own Claude API key, called directly from this
 * device. Owwy has no server in between. Only the question, a short recent
 * history, category/account names, and the results of the tools Claude asks
 * for are sent — never the whole database.
 */

const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `You are Owwy, the friendly owl inside Owwy — a private, offline-first personal budgeting app. You help the user understand their own money and log transactions.

How to work:
- Get every number from tools. Never estimate or invent amounts, dates, or balances. If the data doesn't answer the question, say what's missing.
- Use query_transactions for questions about spending, income, categories, merchants, trends, or periods. Compare periods by querying each one.
- Use get_overview for balances, Safe to Spend, budgets, goals, bills, and debts.
- When the user describes money they spent, received, or moved, call stage_transactions with every item in the message. They review and save it in the app — don't say it was saved.
- Amounts from tools are in major units of the user's currency. Write them with the currency symbol and thousands separators (e.g. ₱23,173.31).

How to answer:
- Lead with the answer. Plain sentences; use **bold** only for the key amounts or names. No headings, lists of more than a few items, or tables — the app already shows the query results under your reply.
- Match the requested length: brief means 1–3 sentences.
- You're a budgeting helper, not a financial advisor. Don't recommend specific investments, loans, or products; work from the user's own data.`;

export function modelLabel(model: string): string {
  return ASSISTANT_MODELS.find((m) => m.id === model)?.label ?? model;
}

export interface AskClaudeOptions {
  apiKey: string;
  model: string;
  question: string;
  history: ChatMessage[];
  ctx: AssistantContext;
  shareNotes: boolean;
  /** Called as tool calls happen, so the UI can show "Ran a query" live. */
  onBlock: (block: ChatBlock) => void;
  signal?: AbortSignal;
}

export async function askClaude(options: AskClaudeOptions): Promise<ChatBlock[]> {
  const { ctx } = options;
  const client = new Anthropic({ apiKey: options.apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 120_000 });
  const blocks: ChatBlock[] = [];
  const emit = (block: ChatBlock) => {
    blocks.push(block);
    options.onBlock(block);
  };

  const context = [
    `<context>`,
    `Today: ${ctx.today}. Currency: ${ctx.currency}.`,
    `Accounts: ${ctx.state.activeAccounts.map((a) => `${a.name} (${a.type})`).join(", ") || "none yet"}.`,
    `Expense categories: ${ctx.state.categories.filter((c) => c.kind === "expense" && !c.archived).map((c) => c.name).join(", ")}.`,
    `Income categories: ${ctx.state.categories.filter((c) => c.kind === "income" && !c.archived).map((c) => c.name).join(", ")}.`,
    `Answer length: ${ctx.brief ? "brief" : "detailed (a short paragraph is fine)"}.`,
    recentHistory(options.history),
    `</context>`,
  ]
    .filter(Boolean)
    .join("\n");

  // Each question starts a fresh, append-only exchange; earlier turns are summarized as text context.
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: `${context}\n\n${options.question}` }];
  const usesOpus5 = options.model === "claude-opus-5";
  const supportsEffort = options.model !== "claude-haiku-4-5";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create(
      {
        model: options.model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
        ...(supportsEffort ? { output_config: { effort: "medium" as const } } : {}),
        // Server-side refusal fallback, routed by category (Claude Opus 5).
        ...(usesOpus5 ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      },
      { signal: options.signal },
    );

    if (response.stop_reason === "refusal") {
      emit({ type: "error", text: "Claude couldn't help with that request. Try rephrasing, or switch to On device." });
      return blocks;
    }

    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

    if (response.stop_reason === "pause_turn") continue;

    if (response.stop_reason !== "tool_use" || !toolUses.length) {
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n\n")
        .trim();
      if (text) emit({ type: "text", text });
      if (response.stop_reason === "max_tokens") emit({ type: "error", text: "The answer was cut off. Try a narrower question." });
      return blocks;
    }

    // Execute every tool call from this turn locally, then return all results in one message.
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((use) => {
      const run = runTool(use.name, use.input, ctx, { shareNotes: options.shareNotes });
      if (run.block) emit(run.block);
      return { type: "tool_result", tool_use_id: use.id, content: run.result, is_error: run.isError };
    });
    messages.push({ role: "user", content: results });
  }

  emit({ type: "error", text: "That took more steps than expected. Try asking in a simpler way." });
  return blocks;
}

function recentHistory(history: ChatMessage[]): string {
  const turns = history
    .slice(-6)
    .map((m) => {
      const text = m.blocks
        .filter((b): b is Extract<ChatBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .slice(0, 400);
      return text ? `${m.role === "user" ? "User" : "Owwy"}: ${text}` : null;
    })
    .filter(Boolean);
  return turns.length ? `Earlier in this conversation:\n${turns.join("\n")}` : "";
}

/** Friendly, specific messages for API failures. */
export function describeClaudeError(error: unknown): string {
  if (error instanceof Anthropic.APIUserAbortError) return "Stopped.";
  if (error instanceof Anthropic.AuthenticationError) return "That API key didn't work. Check it in Settings → Ask Owwy.";
  if (error instanceof Anthropic.PermissionDeniedError) return "This API key doesn't have access to that model. Try another model in Settings.";
  if (error instanceof Anthropic.RateLimitError) return "Claude is busy or your key hit its limit. Try again in a moment, or switch to On device.";
  if (error instanceof Anthropic.APIConnectionError) return "Couldn't reach Claude — you may be offline. On device answers still work without internet.";
  if (error instanceof Anthropic.APIError) return `Claude returned an error (${error.status ?? "unknown"}). Your data wasn't changed.`;
  return "Something went wrong talking to Claude. Your data wasn't changed.";
}
