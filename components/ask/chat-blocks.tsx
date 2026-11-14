"use client";

import { Check, ChevronRight, Pencil, TriangleAlert, X } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/display";
import { AmountInput, Chip, Field, Select, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { formatShortDate } from "@/lib/dates";
import { minorToInput, parseAmount } from "@/lib/money";
import { haptic } from "@/lib/platform";
import { isDraftComplete, saveStagedDrafts, undoStagedSave } from "@/lib/services/staged";
import { updateChatBlocks } from "@/lib/storage/repositories/chat";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { ChatBlock, ChatMessage, StagedTransaction } from "@/types/models";

/** Renders **bold** and line breaks from assistant text; everything else is plain text. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((paragraph, p) => (
        <p key={p} className={p > 0 ? "mt-2.5" : undefined}>
          {paragraph.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={i} className="font-bold text-ink">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <Fragment key={i}>
                {part.split("\n").map((line, j, arr) => (
                  <Fragment key={j}>
                    {line}
                    {j < arr.length - 1 ? <br /> : null}
                  </Fragment>
                ))}
              </Fragment>
            ),
          )}
        </p>
      ))}
    </>
  );
}

export function QueryBlock({ block }: { block: Extract<ChatBlock, { type: "query" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface/70">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-callout text-ink-2 hover:text-ink">
        <ChevronRight className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")} aria-hidden />
        <span className="flex-1 truncate font-medium">{block.title === "Ran a query" || block.title === "Read your overview" ? block.title : `Ran a query · ${block.title}`}</span>
        <span className="shrink-0 text-caption text-ink-3">
          {block.rowCount} {block.rowCount === 1 ? "row" : "rows"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-line px-3.5 pt-3 pb-3.5">
          <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 font-mono text-[12px] leading-relaxed whitespace-pre text-ink-2">{block.query}</pre>
          {block.rows.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-caption">
                <thead>
                  <tr className="border-b border-line text-ink-3">
                    {block.columns.map((c, i) => (
                      <th key={i} className={cn("py-1.5 pr-3 font-semibold", i === block.columns.length - 1 && "text-right")}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r} className="border-b border-line/50 last:border-0">
                      {row.map((cell, i) => (
                        <td key={i} className={cn("tabular py-1.5 pr-3 whitespace-nowrap text-ink-2", i === row.length - 1 && "text-right")}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {block.rowCount > block.rows.length ? <p className="mt-1.5 text-caption text-ink-3">Showing {block.rows.length} of {block.rowCount}.</p> : null}
            </div>
          ) : (
            <p className="mt-2 text-caption text-ink-3">No rows matched.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Staged transactions: nothing is saved until the user taps Save. */
export function StagedBlock({ message, index, block }: { message: ChatMessage; index: number; block: Extract<ChatBlock, { type: "staged" }> }) {
  const { state, today } = useFinance();
  const [editing, setEditing] = useState<StagedTransaction | null>(null);
  const [saving, setSaving] = useState(false);

  const replaceBlock = (next: ChatBlock) => {
    const blocks = message.blocks.map((b, i) => (i === index ? next : b));
    return updateChatBlocks(message.id, blocks);
  };

  const incomplete = block.drafts.filter((d) => !isDraftComplete(d));

  const save = async () => {
    if (incomplete.length) {
      setEditing(incomplete[0]);
      return;
    }
    setSaving(true);
    try {
      const { savedIds, previousBills } = await saveStagedDrafts(block.drafts);
      await replaceBlock({ ...block, status: "saved", savedIds, previousBills });
      void haptic("success");
      toast.success(`Saved ${savedIds.length} to your log`);
    } catch (error) {
      toast.error(error);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    await undoStagedSave(block.savedIds ?? [], block.previousBills ?? []);
    await replaceBlock({ ...block, status: "cancelled", savedIds: [], previousBills: [] });
    toast.show(block.drafts.length === 1 ? "Entry removed from your log" : `${block.drafts.length} entries removed from your log`);
  };

  return (
    <div className="flex flex-col gap-2">
      {block.drafts.map((d) => {
        const category = d.categoryId ? state.categoriesById.get(d.categoryId) : undefined;
        const account = d.accountId ? state.accountsById.get(d.accountId) : undefined;
        const to = d.toAccountId ? state.accountsById.get(d.toAccountId) : undefined;
        const missing = incomplete.includes(d);
        return (
          <button
            key={d.key}
            type="button"
            disabled={block.status !== "pending"}
            onClick={() => setEditing(d)}
            className={cn(
              "press flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left",
              block.status === "saved" ? "border-positive/40 bg-positive-soft/40" : missing ? "border-warning/60 bg-warning-soft/40" : "border-line bg-surface hover:border-line-strong",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-callout font-semibold">
                {d.type === "income" ? "Income" : d.type === "transfer" ? "Transfer" : "Expense"} · <Money value={d.amount} alwaysShow />
              </span>
              <span className="block truncate text-caption text-ink-3">
                {[account?.name ?? "Choose account", d.type === "transfer" ? `→ ${to?.name ?? "choose account"}` : category ? `${category.emoji} ${category.name}` : "Choose category", d.note, d.date !== today ? formatShortDate(d.date, today) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            {block.status === "pending" ? (
              missing ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Needs details" /> : <Pencil className="mt-0.5 size-4 shrink-0 text-ink-3" aria-label="Edit" />
            ) : null}
          </button>
        );
      })}

      {block.status === "pending" ? (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => replaceBlock({ ...block, status: "dismissed" })}>
            Dismiss
          </Button>
          <Button size="sm" onClick={save} loading={saving}>
            {incomplete.length ? "Review details" : `Save ${block.drafts.length === 1 ? "to your log" : `${block.drafts.length} to your log`}`}
          </Button>
        </div>
      ) : block.status === "saved" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-positive px-3 text-caption font-bold text-positive-ink">
            <Check className="size-3.5" aria-hidden />
            {block.auto ? "Logged" : "Saved"} {block.drafts.length} to your log
          </span>
          {block.drafts.some((d) => d.billId) ? <span className="text-caption text-ink-3">Bill marked paid</span> : null}
          <Button size="sm" variant="ghost" onClick={cancel}>
            <X />
            Cancel
          </Button>
        </div>
      ) : block.status === "cancelled" ? (
        <span className="text-caption text-ink-3">Cancelled — removed from your log.</span>
      ) : (
        <span className="text-caption text-ink-3">Dismissed — nothing was saved.</span>
      )}

      <Sheet open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} title="Review transaction" size="sm">
        {editing ? (
          <DraftEditor
            draft={editing}
            onSave={async (updated) => {
              await replaceBlock({ ...block, drafts: block.drafts.map((d) => (d.key === updated.key ? updated : d)) });
              setEditing(null);
            }}
          />
        ) : null}
      </Sheet>
    </div>
  );
}

function DraftEditor({ draft, onSave }: { draft: StagedTransaction; onSave: (d: StagedTransaction) => void }) {
  const { state, currency } = useFinance();
  const [d, setD] = useState(draft);
  const [amount, setAmount] = useState(minorToInput(draft.amount, currency));
  const categories = state.categories.filter((c) => c.kind === (d.type === "income" ? "income" : "expense") && !c.archived);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(["expense", "income", "transfer"] as const).map((type) => (
          <Chip key={type} selected={d.type === type} onClick={() => setD({ ...d, type, categoryId: undefined })}>
            {type[0].toUpperCase() + type.slice(1)}
          </Chip>
        ))}
      </div>
      <Field label="Amount">{(props) => <AmountInput {...props} value={amount} onValueChange={setAmount} currency={currency} />}</Field>
      <Field label={d.type === "income" ? "Into" : "From"}>
        {(props) => (
          <Select {...props} value={d.accountId ?? ""} onChange={(e) => setD({ ...d, accountId: e.target.value })}>
            <option value="">Choose…</option>
            {state.activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {d.type === "transfer" ? (
        <Field label="To">
          {(props) => (
            <Select {...props} value={d.toAccountId ?? ""} onChange={(e) => setD({ ...d, toAccountId: e.target.value })}>
              <option value="">Choose…</option>
              {state.activeAccounts.filter((a) => a.id !== d.accountId).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : (
        <Field label="Category">
          {(props) => (
            <Select {...props} value={d.categoryId ?? ""} onChange={(e) => setD({ ...d, categoryId: e.target.value })}>
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field label="Note">{(props) => <TextInput {...props} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} maxLength={140} />}</Field>
      <Field label="Date">{(props) => <TextInput {...props} type="date" value={d.date} onChange={(e) => e.target.value && setD({ ...d, date: e.target.value })} />}</Field>
      <Button size="lg" onClick={() => onSave({ ...d, amount: parseAmount(amount, currency) ?? d.amount })}>
        Done
      </Button>
    </div>
  );
}
