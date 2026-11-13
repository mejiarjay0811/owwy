import Anthropic from "@anthropic-ai/sdk";
import type { ChatBlock, ChatMessage } from "@/types/models";
import type { AssistantContext } from "./local-engine";
import { buildContext, MAX_TOOL_ROUNDS, SYSTEM_PROMPT } from "./prompt";
import { runTool, TOOL_DEFINITIONS } from "./tools";

/**
 * Anthropic's wire format. One of two AI modes; everything else speaks the
 * OpenAI shape in ./openai-compatible.ts.
 *
 * The user's own key, called directly from this device — Owwy has no server
 * in between. Only the question, a short recent history, category/account
 * names, and the results of the tools the model asks for are sent — never
 * the whole database.
 */

export interface AskClaudeOptions {
  apiKey: string;
  baseUrl?: string;
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
  const client = new Anthropic({
    apiKey: options.apiKey,
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
    timeout: 120_000,
  });
  const blocks: ChatBlock[] = [];
  const emit = (block: ChatBlock) => {
    blocks.push(block);
    options.onBlock(block);
  };

  const context = buildContext(ctx, options.history);

  // Each question starts a fresh, append-only exchange; earlier turns are summarized as text context.
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: `${context}\n\n${options.question}` }];
  // Model-specific options, applied only to the models known to take them —
  // a user can type any model name here.
  const usesOpus5 = options.model === "claude-opus-5";
  const supportsEffort = /^claude-(opus|sonnet)-5/.test(options.model);

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
      emit({ type: "error", text: "The model couldn't help with that request. Try rephrasing, or switch to On device." });
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

/**
 * Friendly, specific messages for API failures, from either wire format.
 *
 * Worth being specific: "that key didn't work" and "you're offline" lead to
 * completely different fixes, and the service's own message is usually the
 * most useful thing we can show for anything else.
 */
export function describeAssistantError(error: unknown): string {
  if (error instanceof Anthropic.APIUserAbortError) return "Stopped.";
  if (error instanceof DOMException && error.name === "AbortError") return "Stopped.";

  const status = statusOf(error);
  if (status === 401 || status === 403) return "That API key didn't work, or it can't use that model. Check it in Settings → Ask Owwy.";
  if (status === 404) return "That model name wasn't found on this service. Check the model in Settings → Ask Owwy.";
  if (status === 429) return "The service is busy or your key hit its limit. Try again in a moment, or switch to On device.";
  if (status && status >= 500) return "The AI service had a problem. Your data wasn't changed — On device answers still work.";

  if (error instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI service — you may be offline. On device answers still work without internet.";
  if (error instanceof TypeError) return "Couldn't reach the AI service. Check the address in Settings → Ask Owwy, or switch to On device.";

  const detail = error instanceof Error && error.message ? ` (${error.message.slice(0, 120)})` : "";
  return `Something went wrong talking to the AI service${detail}. Your data wasn't changed.`;
}

function statusOf(error: unknown): number | undefined {
  if (error instanceof Anthropic.APIError) return error.status;
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") return error.status;
  return undefined;
}
