/**
 * What every AI mode is told, whichever service answers.
 *
 * Shared so the two wire formats can't drift apart: the same rules, the same
 * context, the same limits, so switching provider changes who replies and
 * nothing about what they were asked.
 */
import type { ChatBlock, ChatMessage } from "@/types/models";
import type { AssistantContext } from "./local-engine";

export const MAX_TOOL_ROUNDS = 6;

export const SYSTEM_PROMPT = `You are Owwy, the friendly owl inside Owwy — a private, offline-first personal budgeting app. You help the user understand their own money and log transactions.

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

/** The names and dates the model needs — never the transactions themselves. */
export function buildContext(ctx: AssistantContext, history: ChatMessage[]): string {
  return [
    `<context>`,
    `Today: ${ctx.today}. Currency: ${ctx.currency}.`,
    `Accounts: ${ctx.state.activeAccounts.map((a) => `${a.name} (${a.type})`).join(", ") || "none yet"}.`,
    `Expense categories: ${ctx.state.categories.filter((c) => c.kind === "expense" && !c.archived).map((c) => c.name).join(", ")}.`,
    `Income categories: ${ctx.state.categories.filter((c) => c.kind === "income" && !c.archived).map((c) => c.name).join(", ")}.`,
    `Answer length: ${ctx.brief ? "brief" : "detailed (a short paragraph is fine)"}.`,
    recentHistory(history),
    `</context>`,
  ]
    .filter(Boolean)
    .join("\n");
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
