/**
 * The OpenAI `/chat/completions` wire format, spoken by nearly everything
 * that isn't Anthropic: OpenAI, Gemini's compatibility endpoint, OpenRouter,
 * Groq, DeepSeek, Mistral, and anything self-hosted like Ollama or LM Studio.
 *
 * Written against `fetch` rather than a vendor SDK — one format, one
 * implementation, no dependency that assumes a particular host. The tool loop
 * mirrors the Anthropic one in ./claude.ts, and runs the same local tools, so
 * the answer the user sees is built the same way whichever service replies.
 */
import type { ChatBlock, ChatMessage } from "@/types/models";
import type { AssistantContext } from "./local-engine";
import { buildContext, MAX_TOOL_ROUNDS, SYSTEM_PROMPT } from "./prompt";
import { runTool, TOOL_DEFINITIONS } from "./tools";

/** Owwy's tool definitions in OpenAI's shape. Same schemas, different envelope. */
const OPENAI_TOOLS = TOOL_DEFINITIONS.map((tool) => ({
  type: "function" as const,
  function: { name: tool.name, description: tool.description, parameters: tool.input_schema },
}));

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface ChatChoiceMessage {
  content?: string | null;
  tool_calls?: ToolCall[];
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface AskOpenAiOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  question: string;
  history: ChatMessage[];
  ctx: AssistantContext;
  shareNotes: boolean;
  onBlock: (block: ChatBlock) => void;
  signal?: AbortSignal;
}

/** Thrown with the service's own message when it returns an error status. */
export class AssistantHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AssistantHttpError";
  }
}

export async function askOpenAiCompatible(options: AskOpenAiOptions): Promise<ChatBlock[]> {
  const blocks: ChatBlock[] = [];
  const emit = (block: ChatBlock) => {
    blocks.push(block);
    options.onBlock(block);
  };

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `${buildContext(options.ctx, options.history)}\n\n${options.question}` },
  ];

  const endpoint = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: options.signal,
      headers: {
        "content-type": "application/json",
        // A self-hosted service may need no key; sending "Bearer " with
        // nothing after it makes some of them reject the request outright.
        ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: options.model, messages, tools: OPENAI_TOOLS, tool_choice: "auto" }),
    });

    if (!response.ok) throw new AssistantHttpError(response.status, await readError(response));

    const payload = (await response.json()) as { choices?: { message?: ChatChoiceMessage }[] };
    const message = payload.choices?.[0]?.message;
    if (!message) throw new AssistantHttpError(response.status, "The service replied in a format Owwy doesn't recognise.");

    const calls = message.tool_calls ?? [];
    if (!calls.length) {
      const text = (message.content ?? "").trim();
      if (text) emit({ type: "text", text });
      else emit({ type: "error", text: "The model replied with nothing. Try asking again." });
      return blocks;
    }

    messages.push({ role: "assistant", content: message.content ?? "", tool_calls: calls });
    for (const call of calls) {
      // A model can emit malformed JSON arguments; that is a tool error to
      // report back, not a crash — it usually corrects itself next round.
      let input: unknown = {};
      let parseFailed = false;
      try {
        input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        parseFailed = true;
      }
      const run = parseFailed
        ? { result: JSON.stringify({ error: "Arguments were not valid JSON." }), isError: true, block: undefined }
        : runTool(call.function.name, input, options.ctx, { shareNotes: options.shareNotes });
      if (run.block) emit(run.block);
      messages.push({ role: "tool", tool_call_id: call.id, content: run.result });
    }
  }

  emit({ type: "error", text: "That took more steps than expected. Try asking in a simpler way." });
  return blocks;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } | string };
    const message = typeof body.error === "string" ? body.error : body.error?.message;
    if (message) return message;
  } catch {
    // Not JSON — fall through to the status text.
  }
  return response.statusText || `HTTP ${response.status}`;
}
