/**
 * Which AI service answers, when the user supplies their own key.
 *
 * Owwy has no server and no key of its own, so "AI mode" is always the user's
 * own account somewhere. Tying that to one vendor would be an odd restriction
 * on an app whose whole point is that your data is yours — so any service
 * that speaks one of the two common wire formats works, including one running
 * on the user's own machine.
 *
 * `api` is the wire format, not the brand: nearly every provider exposes an
 * OpenAI-shaped `/chat/completions` with tool calling, so one implementation
 * covers all of them and Anthropic gets its own.
 */

export type AssistantApi = "anthropic" | "openai";

export interface ModelChoice {
  id: string;
  label: string;
  hint: string;
}

export interface ProviderInfo {
  id: string;
  label: string;
  api: AssistantApi;
  /** Where requests go. The user can override it for a self-hosted service. */
  baseUrl: string;
  /** Shown under the key field. */
  keyHint: string;
  /** Where to get a key, as plain text — never a link we send the user's data to. */
  console?: string;
  /** Suggested models. The user can type any other name. */
  models: ModelChoice[];
  /** Some services need no key at all (a model running on the same machine). */
  keyOptional?: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    api: "anthropic",
    baseUrl: "https://api.anthropic.com",
    keyHint: "Starts with sk-ant-.",
    console: "console.anthropic.com",
    models: [
      { id: "claude-opus-5", label: "Claude Opus 5", hint: "Most thorough" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5", hint: "Fast and capable" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "Quickest, lowest cost" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    api: "openai",
    baseUrl: "https://api.openai.com/v1",
    keyHint: "Starts with sk-.",
    console: "platform.openai.com",
    models: [
      { id: "gpt-4.1", label: "GPT-4.1", hint: "Most thorough" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", hint: "Fast and cheaper" },
      { id: "gpt-4o-mini", label: "GPT-4o mini", hint: "Quickest, lowest cost" },
    ],
  },
  {
    id: "google",
    label: "Google AI Studio (Gemini)",
    api: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyHint: "An AI Studio API key.",
    console: "aistudio.google.com",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Most thorough" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Fast and cheaper" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    api: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    keyHint: "Starts with sk-or-.",
    console: "openrouter.ai",
    models: [
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", hint: "Balanced" },
      { id: "openai/gpt-4.1-mini", label: "GPT-4.1 mini", hint: "Fast and cheaper" },
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Quickest" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    api: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    keyHint: "Starts with gsk_.",
    console: "console.groq.com",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", hint: "Balanced" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", hint: "Quickest" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    api: "openai",
    baseUrl: "https://api.deepseek.com",
    keyHint: "Starts with sk-.",
    console: "platform.deepseek.com",
    models: [{ id: "deepseek-chat", label: "DeepSeek Chat", hint: "Balanced" }],
  },
  {
    id: "mistral",
    label: "Mistral",
    api: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    keyHint: "A Mistral API key.",
    console: "console.mistral.ai",
    models: [
      { id: "mistral-large-latest", label: "Mistral Large", hint: "Most thorough" },
      { id: "mistral-small-latest", label: "Mistral Small", hint: "Fast and cheaper" },
    ],
  },
  {
    id: "custom",
    label: "Something else (OpenAI-compatible)",
    api: "openai",
    // Ollama and LM Studio both speak this on the same machine, so nothing
    // leaves the device at all.
    baseUrl: "http://localhost:11434/v1",
    keyHint: "Many self-hosted services need no key — leave it blank.",
    keyOptional: true,
    models: [{ id: "llama3.1", label: "llama3.1", hint: "Type the model your service serves" }],
  },
];

export function providerInfo(id: string): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

/** Every provider's suggested models, for a model name the user has typed. */
export function describeModel(providerId: string, model: string): string {
  return providerInfo(providerId).models.find((m) => m.id === model)?.label ?? model;
}
