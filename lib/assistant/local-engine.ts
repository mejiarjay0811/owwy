import { addMonthKey, formatShortDate, monthEnd, monthKey, monthName, monthStart } from "@/lib/dates";
import { evaluateAffordability } from "@/lib/finance/afford";
import { isLiability } from "@/lib/finance/balances";
import { parseLogEntries } from "@/lib/finance/log-splitter";
import { filterTransactions, parseSearchQuery, type SearchFilters } from "@/lib/finance/search";
import { matchBill, type SmartInputResult } from "@/lib/finance/smart-input";
import type { FinanceState } from "@/lib/finance/state";
import { summarizePeriod } from "@/lib/finance/summary";
import { normalize } from "@/lib/finance/text";
import { formatMoney, parseAmount } from "@/lib/money";
import { createId } from "@/lib/utils/id";
import type { ChatBlock, CurrencyCode, ID, ISODate, Minor, OwwyDataset, StagedTransaction, Transaction } from "@/types/models";

export interface AssistantContext {
  data: OwwyDataset;
  state: FinanceState;
  today: ISODate;
  currency: CurrencyCode;
  brief: boolean;
}

export interface AssistantReply {
  blocks: ChatBlock[];
}

export const STARTER_QUESTIONS = [
  "Where did my money go last month?",
  "Is my food spending going up?",
  "How much can I spend until payday?",
  "lunch 250 and grab home 120",
];

const QUESTION_START = /^(how|what|where|when|why|which|who|is|am|are|was|were|can|could|should|do|does|did|will|show|list|compare|tell|give|find|any)\b/;
const QUESTION_WORDS = /\b(how much|how many|where did|what did|what was|what's|whats|when did|breakdown|compare|going up|going down|trend|afford|safe to spend|balance|net worth|due|budget|goal|biggest|largest|top \d*\s*(expenses|purchases)|summary|spent on|spend on)\b/;

/** Questions get answers; everything else with an amount is treated as something to log. */
export function looksLikeQuestion(text: string): boolean {
  const t = normalize(text);
  if (t.endsWith("?")) return true;
  if (QUESTION_START.test(t)) return true;
  return QUESTION_WORDS.test(t) && !/^\S+\s+[₱$€£¥]?\d/.test(t);
}

export function answerLocally(input: string, ctx: AssistantContext): AssistantReply {
  const text = normalize(input);
  const money = (minor: Minor) => formatMoney(minor, ctx.currency);
  const helpers = { ...ctx, money, text, raw: input };

  try {
    if (/\b(afford|can i buy|should i buy|is it ok to buy)\b/.test(text)) return afford(helpers);
    if (!looksLikeQuestion(input) && parseAmount(firstAmount(text) ?? "", ctx.currency)) return logEntries(helpers);
    if (/\b(safe to spend|can i spend|left to spend|spend (today|this week|until)|spending money)\b/.test(text)) return safeToSpend(helpers);
    if (/\b(going up|going down|increas|decreas|more than last|less than last|compared?|trend|versus|vs\.?|higher|lower)\b/.test(text)) return trend(helpers);
    if (/\b(last|latest|previous|most recent)\b.*\b(one|bill|payment|time|paid|bought|purchase)\b|\bwhen did i (last|pay|buy)\b|\bwhat was the last\b/.test(text)) return lastOccurrence(helpers);
    if (/\b(biggest|largest|most expensive|top \d*\s*(expenses|purchases|spending))\b/.test(text)) return biggest(helpers);
    if (/\b(where did|where does|breakdown|by category|what did i spend (my )?money on|spending summary|where('s| is) my money going)\b/.test(text)) return breakdown(helpers);
    if (/\b(balance|how much (money )?(do i have|is in|is left in)|net worth|total money|in my accounts?)\b/.test(text)) return balances(helpers);
    if (/\b(due|bills?|upcoming|coming up)\b/.test(text)) return bills(helpers);
    if (/\bbudgets?\b|\bover budget\b/.test(text)) return budgets(helpers);
    if (/\b(goals?|saving for|savings progress)\b/.test(text)) return goals(helpers);
    if (/\b(how much|total|spent|spend|earn|earned|income|received|paid)\b/.test(text)) return total(helpers);
  } catch (error) {
    console.error(error);
    return { blocks: [{ type: "error", text: "Something went wrong while reading your data. Nothing was changed." }] };
  }
  return help(helpers);
}

type Helpers = AssistantContext & { money: (m: Minor) => string; text: string; raw: string };

/* --------------------------------------------------------------- logging */

function logEntries(h: Helpers): AssistantReply {
  const ctx = { categories: h.state.categories, accounts: h.state.activeAccounts, today: h.today, currency: h.currency };
  const parsed = parseLogEntries(h.raw, ctx);
  const fallbackAccount = h.state.activeAccounts.find((a) => a.includeInSafeToSpend)?.id ?? h.state.activeAccounts[0]?.id;
  const drafts = parsed.entries
    .filter((e) => e.amount)
    .map((e) => {
      const draft = toDraft(e, fallbackAccount);
      // "paid 3,421 for my electric bill" pays the Electricity bill.
      const bill = draft.type === "expense" ? matchBill(e.description, h.data.bills) : undefined;
      if (bill) {
        draft.billId = bill.id;
        draft.categoryId = draft.categoryId ?? bill.categoryId;
        draft.accountId = e.accountId ?? bill.accountId ?? draft.accountId;
        draft.note = bill.name;
      }
      return draft;
    });
  const blocks: ChatBlock[] = [];

  if (drafts.length > 1) {
    blocks.push({ type: "status", text: `${capitalizeFirst(numberWord(drafts.length))} amounts in there — splitting them…` });
    blocks.push({ type: "text", text: parsed.summary });
  } else {
    const d = drafts[0];
    const category = d.categoryId ? h.state.categoriesById.get(d.categoryId) : undefined;
    const bill = d.billId ? h.data.bills.find((b) => b.id === d.billId) : undefined;
    const to = d.toAccountId ? h.state.accountsById.get(d.toAccountId) : undefined;
    blocks.push({
      type: "text",
      text: bill
        ? `Got it — **${h.money(d.amount)}** for ${bill.name}. Saving also marks the bill paid.`
        : d.type === "transfer"
          ? `Got it — moving **${h.money(d.amount)}**${to ? ` to ${to.name}` : ""}.`
          : category
            ? `Got it — ${d.type === "income" ? "income" : category.name.toLowerCase()} for **${h.money(d.amount)}**.`
            : `Got **${h.money(d.amount)}**. Which category should it go under?`,
    });
  }
  if (!h.state.activeAccounts.length) {
    blocks.push({ type: "error", text: "Add an account first so I know where this money came from." });
  }
  blocks.push({ type: "staged", drafts, status: "pending" });
  return { blocks };
}

export function toDraft(entry: SmartInputResult, fallbackAccount?: ID): StagedTransaction {
  return {
    key: createId("draft"),
    type: entry.type,
    amount: entry.amount ?? 0,
    accountId: entry.accountId ?? fallbackAccount,
    toAccountId: entry.toAccountId ?? undefined,
    categoryId: entry.categoryId ?? entry.categoryCandidates[0] ?? undefined,
    date: entry.date,
    note: entry.description,
    tags: entry.tags,
  };
}

/* --------------------------------------------------------------- questions */

function breakdown(h: Helpers): AssistantReply {
  const { from, to, label } = period(h);
  const expenses = expensesBetween(h, from, to);
  const byCategory = groupBy(expenses, (t) => t.categoryId ?? "other");
  const rows = [...byCategory.entries()]
    .map(([id, list]) => ({ name: h.state.categoriesById.get(id)?.name ?? "Other", total: sum(list), count: list.length, discretionary: h.state.categoriesById.get(id)?.discretionary }))
    .sort((a, b) => b.total - a.total);
  const spent = sum(expenses);

  const blocks: ChatBlock[] = [
    { type: "status", text: `Reading ${label}'s expenses, grouped by category…` },
    query(
      `Expenses by category · ${label}`,
      [`FROM transactions`, `WHERE type = 'expense'`, `  AND date BETWEEN '${from}' AND '${to}'`, `GROUP BY category`, `ORDER BY total DESC`],
      ["category", "total", "n"],
      rows.map((r) => [r.name, toMajorString(r.total, h.currency), r.count]),
    ),
  ];

  if (!rows.length) {
    blocks.push({ type: "text", text: `I don't see any spending in ${label} yet.` });
    return { blocks };
  }

  const top = rows.slice(0, 5);
  let answer = `${capitalizeFirst(label)} went mostly to ${numberWord(top.length)} place${top.length > 1 ? "s" : ""}: ${top.map((r) => `${r.name.toLowerCase()} **${h.money(r.total)}**`).join(", ")}.`;
  const flexible = rows.find((r) => r.discretionary);
  if (!h.brief && flexible && spent > 0) {
    answer += ` ${flexible.name} alone was ${h.money(flexible.total)} — about ${Math.round((flexible.total / spent) * 100)}% of everything you spent.`;
  }
  answer += ` Total: **${h.money(spent)}**.`;
  blocks.push({ type: "text", text: answer });
  return { blocks };
}

function trend(h: Helpers): AssistantReply {
  const filters = searchFilters(h);
  const categoryId = filters.categoryIds[0];
  const category = categoryId ? h.state.categoriesById.get(categoryId) : undefined;
  const inProgress = /\bthis month\b/.test(h.text);

  const currentMonth = inProgress ? h.state.month : addMonthKey(h.state.month, -1);
  const previousMonth = addMonthKey(currentMonth, -1);
  const currentTo = inProgress ? h.today : monthEnd(currentMonth);
  const sameDay = Math.min(Number(currentTo.slice(8, 10)), Number(monthEnd(previousMonth).slice(8, 10)));
  const previousTo = inProgress ? `${previousMonth}-${String(sameDay).padStart(2, "0")}` : monthEnd(previousMonth);

  const pick = (from: ISODate, to: ISODate) => expensesBetween(h, from, to).filter((t) => !categoryId || t.categoryId === categoryId);
  const now = pick(monthStart(currentMonth), currentTo);
  const before = pick(monthStart(previousMonth), previousTo);
  const nowTotal = sum(now);
  const beforeTotal = sum(before);
  const subject = category ? category.name : "Spending";

  const blocks: ChatBlock[] = [
    { type: "status", text: "Let me compare the last two months." },
    query(
      `${subject} · ${monthName(previousMonth)} vs ${monthName(currentMonth)}`,
      [
        `FROM transactions`,
        `WHERE type = 'expense'${category ? `\n  AND category = '${category.name}'` : ""}`,
        `  AND (date BETWEEN '${monthStart(previousMonth)}' AND '${previousTo}'`,
        `    OR date BETWEEN '${monthStart(currentMonth)}' AND '${currentTo}')`,
        `GROUP BY month`,
      ],
      ["month", "total", "n"],
      [
        [monthName(previousMonth), toMajorString(beforeTotal, h.currency), before.length],
        [monthName(currentMonth), toMajorString(nowTotal, h.currency), now.length],
      ],
    ),
  ];

  if (!beforeTotal && !nowTotal) {
    blocks.push({ type: "text", text: `I don't have ${subject.toLowerCase()} records for ${monthName(previousMonth)} or ${monthName(currentMonth)} yet.` });
    return { blocks };
  }
  if (!beforeTotal) {
    blocks.push({ type: "text", text: `${subject} came to **${h.money(nowTotal)}** in ${monthName(currentMonth)}, and there was nothing in ${monthName(previousMonth)} to compare with.` });
    return { blocks };
  }

  const change = ((nowTotal - beforeTotal) / beforeTotal) * 100;
  const up = nowTotal > beforeTotal;
  const askedDown = /\b(going down|decreas|less|lower)\b/.test(h.text);
  const verdict = Math.abs(change) < 3 ? "About the same." : up === !askedDown ? "Yes." : "No.";
  const span = inProgress ? ` so far (vs the same days of ${monthName(previousMonth)})` : "";
  let answer = `${verdict} ${subject} came to **${h.money(nowTotal)}** in ${monthName(currentMonth)}${span}, against ${h.money(beforeTotal)} in ${monthName(previousMonth)}: ${Math.abs(Math.round(change))}% ${up ? "up" : "down"}.`;

  if (!h.brief) {
    // Which notes drove the change.
    const byNote = (list: Transaction[]) => groupBy(list, (t) => normalize(t.note || "untitled"));
    const nowNotes = byNote(now);
    const beforeNotes = byNote(before);
    const driver = [...nowNotes.entries()]
      .map(([note, list]) => ({ note, now: sum(list), before: sum(beforeNotes.get(note) ?? []) }))
      .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))[0];
    if (driver && driver.note !== "untitled" && Math.abs(driver.now - driver.before) > Math.abs(nowTotal - beforeTotal) * 0.25) {
      answer += `\n\nMost of that is **${capitalizeFirst(driver.note)}**: ${h.money(driver.now)} against ${h.money(driver.before)}.`;
    }
  }
  blocks.push({ type: "text", text: answer });
  return { blocks };
}

function total(h: Helpers): AssistantReply {
  const filters = searchFilters(h);
  const wantsIncome = /\b(earn|earned|income|received|make|made|got paid)\b/.test(h.text);
  const { from, to, label } = period(h, filters);
  const type = wantsIncome ? "income" : "expense";
  const results = filterTransactions(h.state.baseTransactions, { ...filters, types: [type], from, to, terms: filters.terms.filter((t) => !STOP_TERMS.has(t)) }, lookups(h));
  const amount = sum(results);
  const what = [
    filters.categoryIds.map((id) => h.state.categoriesById.get(id)?.name).filter(Boolean).join(" & "),
    filters.accountIds.length ? `from ${filters.accountIds.map((id) => h.state.accountsById.get(id)?.name).join(" & ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const blocks: ChatBlock[] = [
    query(
      `${wantsIncome ? "Income" : "Spending"}${what ? ` · ${what}` : ""} · ${label}`,
      [
        `FROM transactions`,
        `WHERE type = '${type}'`,
        `  AND date BETWEEN '${from}' AND '${to}'`,
        ...describeFilters(filters, h),
        `ORDER BY amount DESC`,
      ],
      ["date", "details", "amount"],
      results
        .slice()
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 12)
        .map((t) => [t.date, t.note || h.state.categoriesById.get(t.categoryId ?? "")?.name || "—", toMajorString(t.amount, h.currency)]),
      results.length,
    ),
  ];

  if (!results.length) {
    blocks.push({ type: "text", text: `I found nothing${what ? ` for ${what}` : ""} in ${label}.` });
    return { blocks };
  }
  let answer = wantsIncome
    ? `You received **${h.money(amount)}** in ${label}${what ? ` (${what})` : ""}, across ${results.length} ${results.length === 1 ? "entry" : "entries"}.`
    : `You spent **${h.money(amount)}**${what ? ` on ${what}` : ""} in ${label}, across ${results.length} ${results.length === 1 ? "transaction" : "transactions"}.`;
  if (!h.brief && results.length > 1) {
    const biggestTx = results.reduce((a, b) => (b.amount > a.amount ? b : a));
    answer += ` The biggest was ${biggestTx.note || "one entry"} at ${h.money(biggestTx.amount)} on ${formatShortDate(biggestTx.date, h.today)}.`;
  }
  blocks.push({ type: "text", text: answer });
  return { blocks };
}

function lastOccurrence(h: Helpers): AssistantReply {
  const bill = h.data.bills.find((b) => h.text.includes(normalize(b.name)));
  const filters = searchFilters(h);
  let matches: Transaction[];
  let subject: string;

  if (bill) {
    subject = bill.name;
    matches = h.state.baseTransactions.filter((t) => t.billId === bill.id || normalize(t.note) === normalize(bill.name));
  } else {
    // Keep only words that actually appear in some record ("meralco", "coffee"), dropping filler.
    const terms = filters.terms.filter(
      (t) =>
        !STOP_TERMS.has(t) &&
        !["last", "latest", "one", "time", "paid", "bought", "pay", "buy", "was", "when", "what", "did", "due"].includes(t) &&
        h.state.baseTransactions.some((tx) => normalize(tx.note).includes(t)),
    );
    subject = filters.categoryIds.length ? (h.state.categoriesById.get(filters.categoryIds[0])?.name ?? "that") : terms.join(" ") || "that";
    matches = filterTransactions(h.state.baseTransactions, { ...filters, from: undefined, to: undefined, terms }, lookups(h));
  }

  const blocks: ChatBlock[] = [
    query(
      `Most recent · ${subject}`,
      [`FROM transactions`, bill ? `WHERE bill = '${bill.name}' OR note = '${bill.name}'` : `WHERE ${describeFilters(filters, h).join(" ").replace(/^\s*AND\s*/, "") || "note matches your words"}`, `ORDER BY date DESC`, `LIMIT 5`],
      ["date", "details", "account", "amount"],
      matches.slice(0, 5).map((t) => [t.date, t.note || "—", h.state.accountsById.get(t.accountId)?.name ?? "—", toMajorString(t.amount, h.currency)]),
      matches.length,
    ),
  ];

  const last = matches[0];
  if (!last) {
    blocks.push({ type: "text", text: `I couldn't find a past ${subject} payment.${bill ? ` It's due ${formatShortDate(bill.nextDueDate, h.today)} for about ${h.money(bill.amount)}.` : ""}` });
    return { blocks };
  }
  let answer = `The last **${capitalizeFirst(subject)}** was **${h.money(last.amount)}** on ${formatShortDate(last.date, h.today)}, from ${h.state.accountsById.get(last.accountId)?.name ?? "a deleted account"}.`;
  if (bill && bill.active) answer += ` Next one is due ${formatShortDate(bill.nextDueDate, h.today)}.`;
  if (!h.brief && matches[1]) answer += ` Before that: ${h.money(matches[1].amount)} on ${formatShortDate(matches[1].date, h.today)}.`;
  blocks.push({ type: "text", text: answer });
  return { blocks };
}

function biggest(h: Helpers): AssistantReply {
  const { from, to, label } = period(h);
  const list = expensesBetween(h, from, to).sort((a, b) => b.amount - a.amount);
  const blocks: ChatBlock[] = [
    query(
      `Biggest expenses · ${label}`,
      [`FROM transactions`, `WHERE type = 'expense'`, `  AND date BETWEEN '${from}' AND '${to}'`, `ORDER BY amount DESC`, `LIMIT 5`],
      ["date", "details", "category", "amount"],
      list.slice(0, 5).map((t) => [t.date, t.note || "—", h.state.categoriesById.get(t.categoryId ?? "")?.name ?? "—", toMajorString(t.amount, h.currency)]),
      list.length,
    ),
  ];
  if (!list.length) blocks.push({ type: "text", text: `No expenses recorded in ${label}.` });
  else
    blocks.push({
      type: "text",
      text: `Your biggest expense in ${label} was **${list[0].note || "an entry"}** at **${h.money(list[0].amount)}** on ${formatShortDate(list[0].date, h.today)}.${!h.brief && list[1] ? ` Next: ${list[1].note || "an entry"} (${h.money(list[1].amount)}).` : ""}`,
    });
  return { blocks };
}

function safeToSpend(h: Helpers): AssistantReply {
  const sts = h.state.safeToSpend;
  const blocks: ChatBlock[] = [
    query(
      "Safe to spend",
      ["spending balances", "- unpaid bills before next income", "- debt minimums", "- planned savings", "- goal money in spending accounts", "- minimum balance", "- cushion"],
      ["line", "amount"],
      sts.lines.map((l) => [l.label, toMajorString(l.key === "available" ? l.amount : -l.amount, h.currency)]),
    ),
    {
      type: "text",
      text:
        sts.amount > 0
          ? `You can safely spend about **${formatMoney(sts.amount, h.currency, { whole: true })}** until ${formatShortDate(sts.periodEnd, h.today)} — roughly ${formatMoney(sts.perDay, h.currency, { whole: true })} a day.${h.brief ? "" : " That already sets aside your upcoming bills, savings plan and cushion."}`
          : sts.status === "atRisk"
            ? `Right now your upcoming bills need **${h.money(-sts.rawAmount)}** more than what's in your spending accounts.`
            : "Your bills are covered, but there's nothing extra to spend until your next income.",
    },
  ];
  return { blocks };
}

function afford(h: Helpers): AssistantReply {
  const raw = firstAmount(h.text);
  const price = raw ? parseAmount(raw, h.currency) : null;
  if (!price) return { blocks: [{ type: "text", text: "How much is it? Try “can I afford 3500”." }] };
  const result = evaluateAffordability(price, h.state.safeToSpend);
  const label = { comfortable: "🟢 Comfortable", think: "🟡 Think about it", notRecommended: "🔴 Not recommended" }[result.verdict];
  return {
    blocks: [
      query(
        `Can I afford ${h.money(price)}?`,
        ["safe_to_spend_after = safe_to_spend - price", "per_day_after = safe_to_spend_after / days_until_income"],
        ["", "before", "after"],
        [
          ["Safe to spend", toMajorString(result.safeBefore, h.currency), toMajorString(result.safeAfter, h.currency)],
          ["Per day", toMajorString(result.perDayBefore, h.currency), toMajorString(result.perDayAfter, h.currency)],
        ],
      ),
      {
        type: "text",
        text: `**${label}.** ${result.headline} Safe to spend would go from ${formatMoney(result.safeBefore, h.currency, { whole: true })} to ${formatMoney(result.safeAfter, h.currency, { whole: true })}.${h.brief ? "" : " This is a budgeting calculation from your own numbers, not financial advice."}`,
      },
    ],
  };
}

function balances(h: Helpers): AssistantReply {
  const named = h.state.activeAccounts.filter((a) => h.text.includes(normalize(a.name)));
  const accounts = named.length ? named : h.state.activeAccounts;
  const rows = accounts.map((a) => [a.name, toMajorString(h.state.balances.get(a.id) ?? 0, h.currency)] as (string | number)[]);
  const blocks: ChatBlock[] = [query("Account balances", ["FROM accounts", named.length ? `WHERE name IN (${named.map((a) => `'${a.name}'`).join(", ")})` : "WHERE archived = false", "balance = opening + income - expenses ± transfers"], ["account", "balance"], rows)];

  if (named.length === 1) {
    const account = named[0];
    const balance = h.state.balances.get(account.id) ?? 0;
    blocks.push({ type: "text", text: isLiability(account) ? `You owe **${h.money(Math.max(0, -balance))}** on ${account.name}.` : `${account.name} has **${h.money(balance)}**.` });
  } else {
    const { totals, netWorth } = h.state;
    blocks.push({
      type: "text",
      text: `You have **${h.money(totals.totalBalance)}** across ${accounts.filter((a) => !isLiability(a)).length} accounts${totals.owed ? `, and owe ${h.money(totals.owed)} on credit` : ""}.${h.brief ? "" : ` Your net worth is ${h.money(netWorth.netWorth)}.`}`,
    });
  }
  return { blocks };
}

function bills(h: Helpers): AssistantReply {
  const upcoming = h.state.upcomingBills.slice(0, 8);
  const blocks: ChatBlock[] = [
    query("Upcoming bills · next 30 days", ["FROM bills", "WHERE active AND due <= today + 30 days", "ORDER BY due"], ["due", "bill", "amount"], upcoming.map((o) => [o.date, o.bill.name, toMajorString(o.amount, h.currency)])),
  ];
  if (!upcoming.length) blocks.push({ type: "text", text: "Nothing due in the next 30 days." });
  else {
    const next = upcoming[0];
    blocks.push({
      type: "text",
      text: `Next up: **${next.bill.name}** (${h.money(next.amount)}) on ${formatShortDate(next.date, h.today)}. ${upcoming.length > 1 ? `${upcoming.length} bills total **${h.money(sum(upcoming.map((o) => ({ amount: o.amount }))))}** over the next 30 days.` : ""}`.trim(),
    });
  }
  return { blocks };
}

function budgets(h: Helpers): AssistantReply {
  const list = h.state.budgetProgress.filter((b) => !b.budget.paused);
  const blocks: ChatBlock[] = [
    query(`Budgets · ${monthName(h.state.month)}`, ["FROM budgets JOIN spending", `WHERE month = '${h.state.month}'`, "ORDER BY used DESC"], ["category", "spent", "budget", "used"], list.map((b) => [b.category?.name ?? "—", toMajorString(b.spent, h.currency), toMajorString(b.budget.amount, h.currency), `${Math.round(b.percent)}%`])),
  ];
  if (!list.length) blocks.push({ type: "text", text: "You haven't set any budgets this month yet." });
  else {
    const over = list.filter((b) => b.status === "over");
    blocks.push({
      type: "text",
      text: over.length
        ? `${over.map((b) => `**${b.category?.name}** is at ${Math.round(b.percent)}%`).join(", ")} — over budget. ${h.brief ? "" : `The rest are within their limits.`}`.trim()
        : `All ${list.length} budgets are within their limits. Closest: **${list[0].category?.name}** at ${Math.round(list[0].percent)}%.`,
    });
  }
  return { blocks };
}

function goals(h: Helpers): AssistantReply {
  const list = h.state.goalProgress;
  const blocks: ChatBlock[] = [
    query("Savings goals", ["FROM goals", "saved = starting + contributions - withdrawals"], ["goal", "saved", "target", "progress"], list.map((g) => [g.goal.name, toMajorString(g.saved, h.currency), toMajorString(g.goal.targetAmount, h.currency), `${Math.round(g.percent)}%`])),
  ];
  if (!list.length) blocks.push({ type: "text", text: "You don't have any savings goals yet. What would you like to save for?" });
  else
    blocks.push({
      type: "text",
      text: list
        .slice(0, h.brief ? 2 : 4)
        .map((g) => `**${g.goal.name}**: ${h.money(g.saved)} of ${h.money(g.goal.targetAmount)} (${Math.round(g.percent)}%)${g.requiredMonthly ? ` — ${h.money(g.requiredMonthly)}/month to stay on track` : ""}`)
        .join("\n"),
    });
  return { blocks };
}

function help(h: Helpers): AssistantReply {
  return {
    blocks: [
      {
        type: "text",
        text: `I can log things for you — like “coffee 180” or “lunch 250 and grab home 120, ${h.state.activeAccounts[0]?.name.toLowerCase() ?? "cash"}” — or answer questions about your money, right here on your device.`,
      },
      { type: "suggestions", items: STARTER_QUESTIONS },
    ],
  };
}

/* --------------------------------------------------------------- helpers */

const STOP_TERMS = new Set(["how", "much", "did", "i", "spend", "spent", "on", "my", "what", "was", "the", "is", "in", "for", "total", "money", "do", "have", "a", "an", "of", "to", "me", "show", "whats", "going", "up", "earn", "earned", "income", "received"]);

function searchFilters(h: Helpers): SearchFilters {
  return parseSearchQuery(h.raw.replace(/[?!.]+$/, ""), { categories: h.state.categories, accounts: h.state.accounts, today: h.today, currency: h.currency });
}

/** The period a question is about; defaults to this month so far. */
function period(h: Helpers, filters = searchFilters(h)): { from: ISODate; to: ISODate; label: string } {
  if (filters.from && filters.to) {
    const sameMonth = filters.from.slice(0, 7) === filters.to.slice(0, 7) && filters.from.endsWith("-01");
    const label = sameMonth ? (monthKey(filters.from) === h.state.month ? "this month" : monthName(monthKey(filters.from))) : `${formatShortDate(filters.from, h.today)} – ${formatShortDate(filters.to, h.today)}`;
    return { from: filters.from, to: filters.to, label };
  }
  return { from: monthStart(h.state.month), to: h.today, label: "this month" };
}

function expensesBetween(h: Helpers, from: ISODate, to: ISODate): Transaction[] {
  return h.state.baseTransactions.filter((t) => t.type === "expense" && !t.receivableId && t.date >= from && t.date <= to);
}

function lookups(h: Helpers) {
  return { categoriesById: h.state.categoriesById, accountsById: h.state.accountsById };
}

function describeFilters(filters: SearchFilters, h: Helpers): string[] {
  const lines: string[] = [];
  if (filters.categoryIds.length) lines.push(`  AND category IN (${filters.categoryIds.map((id) => `'${h.state.categoriesById.get(id)?.name}'`).join(", ")})`);
  if (filters.accountIds.length) lines.push(`  AND account IN (${filters.accountIds.map((id) => `'${h.state.accountsById.get(id)?.name}'`).join(", ")})`);
  if (filters.minAmount !== undefined) lines.push(`  AND amount >= ${toMajorString(filters.minAmount, h.currency)}`);
  if (filters.maxAmount !== undefined) lines.push(`  AND amount <= ${toMajorString(filters.maxAmount, h.currency)}`);
  const terms = filters.terms.filter((t) => !STOP_TERMS.has(t));
  if (terms.length) lines.push(`  AND note LIKE '%${terms.join(" ")}%'`);
  if (filters.tags.length) lines.push(`  AND tags INCLUDE (${filters.tags.map((t) => `'#${t}'`).join(", ")})`);
  return lines;
}

function query(title: string, lines: string[], columns: string[], rows: (string | number)[][], rowCount = rows.length): ChatBlock {
  return { type: "query", title, query: lines.join("\n"), columns, rows, rowCount };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function sum(items: { amount: Minor }[]): Minor {
  return items.reduce((t, i) => t + i.amount, 0);
}

function toMajorString(minor: Minor, currency: CurrencyCode): string {
  return formatMoney(minor, currency, { noSymbol: true });
}

function firstAmount(text: string): string | null {
  const match = text.match(/(?<![\p{L}\p{N}\-/])[₱$€£¥]?\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?(k)?(?![\p{L}\p{N}\-/])/u);
  return match ? match[0] : null;
}

function numberWord(n: number): string {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
}

function capitalizeFirst(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** Plain summary of a spending period, reused by the AI tools. */
export function periodSummary(ctx: AssistantContext, from: ISODate, to: ISODate) {
  return summarizePeriod(ctx.data.transactions, ctx.data.accounts, ctx.data.goals, from, to);
}
