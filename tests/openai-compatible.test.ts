import { afterEach, describe, expect, it, vi } from "vitest";
import { askOpenAiCompatible, AssistantHttpError } from "@/lib/assistant/openai-compatible";
import type { AssistantContext } from "@/lib/assistant/local-engine";
import { computeFinanceState } from "@/lib/finance/state";
import type { ChatBlock } from "@/types/models";
import { account, dataset, P, tx } from "./fixtures";

/**
 * The wire format for every AI service that isn't Anthropic.
 *
 * It can't be tested against a real provider — that needs someone's key and
 * their money — but the part that would actually break is the shape of what
 * Owwy sends and how it reads the reply back. A stubbed `fetch` pins exactly
 * that: the tool schemas it offers, the tool results it posts back, and what
 * it does with each kind of answer.
 */

const TODAY = "2026-09-14";
const cash = account({ name: "Cash" });

function ctx(): AssistantContext {
  const data = dataset({
    accounts: [cash],
    transactions: [
      tx({ type: "expense", amount: P(180), accountId: cash.id, date: "2026-09-10", note: "Coffee" }),
      tx({ type: "expense", amount: P(320), accountId: cash.id, date: "2026-09-12", note: "Lunch" }),
    ],
  });
  return { data, state: computeFinanceState(data, TODAY), today: TODAY, currency: "PHP", brief: true };
}

const reply = (message: unknown) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: async () => ({ choices: [{ message }] }),
});

function stubFetch(responses: unknown[]) {
  const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const fetchStub = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
    return responses.shift() as Response;
  });
  vi.stubGlobal("fetch", fetchStub);
  return calls;
}

const ask = (overrides: Partial<Parameters<typeof askOpenAiCompatible>[0]> = {}) =>
  askOpenAiCompatible({
    apiKey: "sk-test",
    baseUrl: "https://api.example.com/v1",
    model: "some-model",
    question: "How much did I spend on food?",
    history: [],
    ctx: ctx(),
    shareNotes: true,
    onBlock: () => {},
    ...overrides,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAI-compatible assistant", () => {
  it("offers Owwy's tools in OpenAI's shape, not Anthropic's", async () => {
    const calls = stubFetch([reply({ content: "You spent ₱500." })]);
    await ask();

    const tools = calls[0].body.tools as { type: string; function: { name: string; parameters: unknown } }[];
    expect(calls[0].url).toBe("https://api.example.com/v1/chat/completions");
    expect(tools.every((t) => t.type === "function")).toBe(true);
    expect(tools.map((t) => t.function.name).sort()).toEqual(["get_overview", "query_transactions", "stage_transactions"]);
    // The schema must be under `parameters`; `input_schema` is Anthropic's.
    expect(tools[0].function.parameters).toHaveProperty("type", "object");
    expect(tools[0].function).not.toHaveProperty("input_schema");
  });

  it("sends the key as a bearer token, and sends none when there isn't one", async () => {
    const withKey = stubFetch([reply({ content: "ok" })]);
    await ask();
    expect(withKey[0].headers.authorization).toBe("Bearer sk-test");

    vi.unstubAllGlobals();
    // A model on the user's own machine usually rejects an empty Bearer.
    const noKey = stubFetch([reply({ content: "ok" })]);
    await ask({ apiKey: "" });
    expect(noKey[0].headers).not.toHaveProperty("authorization");
  });

  it("puts the rules and the user's question in, and nothing else", async () => {
    const calls = stubFetch([reply({ content: "ok" })]);
    await ask();

    const messages = calls[0].body.messages as { role: string; content: string }[];
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("How much did I spend on food?");
    // Names and dates travel; the ledger does not.
    expect(messages[1].content).toContain("Cash");
    expect(messages[1].content).not.toContain("Coffee");
  });

  it("runs a tool call locally and posts the result back as a tool message", async () => {
    const calls = stubFetch([
      reply({
        content: null,
        tool_calls: [{ id: "call_1", function: { name: "get_overview", arguments: "{}" } }],
      }),
      reply({ content: "Your balance is fine." }),
    ]);

    const blocks = await ask();

    const second = calls[1].body.messages as { role: string; tool_call_id?: string; content?: string }[];
    const toolResult = second.find((m) => m.role === "tool");
    expect(toolResult?.tool_call_id).toBe("call_1");
    // The result is Owwy's own data, worked out on the device.
    expect(toolResult?.content).toContain("safe_to_spend");
    expect(blocks.at(-1)).toEqual({ type: "text", text: "Your balance is fine." });
  });

  it("reports malformed tool arguments back instead of crashing", async () => {
    const calls = stubFetch([
      reply({ content: null, tool_calls: [{ id: "call_1", function: { name: "get_overview", arguments: "{not json" } }] }),
      reply({ content: "Let me try that again." }),
    ]);

    await expect(ask()).resolves.toBeDefined();
    const second = calls[1].body.messages as { role: string; content?: string }[];
    expect(second.find((m) => m.role === "tool")?.content).toContain("not valid JSON");
  });

  it("surfaces the service's own error message", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: { message: "Incorrect API key provided." } }),
    }));

    await expect(ask()).rejects.toThrow(AssistantHttpError);
    await expect(ask()).rejects.toThrow("Incorrect API key provided.");
  });

  it("says so when the model replies with nothing at all", async () => {
    stubFetch([reply({ content: "" })]);
    const blocks = await ask();
    expect(blocks).toEqual([{ type: "error", text: "The model replied with nothing. Try asking again." }]);
  });

  it("gives up rather than looping forever on tool calls", async () => {
    const forever = Array.from({ length: 12 }, () =>
      reply({ content: null, tool_calls: [{ id: "call_x", function: { name: "get_overview", arguments: "{}" } }] }),
    );
    stubFetch(forever);

    const blocks: ChatBlock[] = await ask();
    expect(blocks.at(-1)).toMatchObject({ type: "error" });
    expect((blocks.at(-1) as { text: string }).text).toContain("more steps than expected");
  });

  it("tolerates a trailing slash on the address", async () => {
    const calls = stubFetch([reply({ content: "ok" })]);
    await ask({ baseUrl: "https://api.example.com/v1/" });
    expect(calls[0].url).toBe("https://api.example.com/v1/chat/completions");
  });
});
