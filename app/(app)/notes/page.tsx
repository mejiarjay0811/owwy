"use client";

import { Pin, PinOff, Search, Trash, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useMemo, useState } from "react";
import { Page, PageHeader } from "@/components/layout/page";
import { Button, IconButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/display";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { formatRelativeDate, today as localToday } from "@/lib/dates";
import { createNote, deleteNote, restoreNote, updateNote } from "@/lib/storage/repositories/notes";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { MoneyNote } from "@/types/models";

const PROMPTS = ["Save for Mom's birthday gift in May", "Cancel the streaming trial before the 20th", "Grocery budget felt tight — try ₱1,500 a week"];

export default function NotesPage() {
  const { data } = useFinance();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MoneyNote | null>(null);

  const notes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(data.notes ?? [])]
      .filter((n) => !q || n.text.toLowerCase().includes(q))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [data.notes, query]);
  const total = data.notes?.length ?? 0;

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      await createNote(text);
      setDraft("");
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Page width="narrow">
      <PageHeader title="Money notes" back="/more/" subtitle="Reminders, plans and thoughts — kept on this device." />

      <Card className="mb-5 p-3">
        <label htmlFor="new-note" className="sr-only">
          New note
        </label>
        <textarea
          id="new-note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void add();
          }}
          rows={draft.split("\n").length > 2 ? 4 : 2}
          maxLength={2000}
          placeholder={`Jot something down… e.g. “${PROMPTS[total % PROMPTS.length]}”`}
          className="w-full resize-none rounded-xl bg-transparent px-2 py-1.5 text-body outline-none placeholder:text-ink-3"
        />
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-caption text-ink-3">{draft.length ? `${draft.length}/2000` : ""}</span>
          <Button size="sm" onClick={add} disabled={!draft.trim()}>
            Save note
          </Button>
        </div>
      </Card>

      {total > 4 ? (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
            className="h-11 w-full rounded-full border border-line bg-surface pr-10 pl-10 text-body outline-none focus:border-brand"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      {total === 0 ? (
        <Card>
          <EmptyState mood="thinking" title="No notes yet" description="Write down what you're planning, what to cancel, or what you noticed about your spending." />
        </Card>
      ) : notes.length === 0 ? (
        <p className="py-8 text-center text-callout text-ink-3">No notes match “{query}”.</p>
      ) : (
        <ul className="columns-1 gap-3 sm:columns-2">
          <AnimatePresence initial={false}>
            {notes.map((note) => (
              <m.li key={note.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="mb-3 break-inside-avoid">
                <NoteCard note={note} onEdit={() => setEditing(note)} />
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Sheet open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} title="Edit note" size="sm">
        {editing ? <EditNote note={editing} onDone={() => setEditing(null)} /> : null}
      </Sheet>
    </Page>
  );
}

function NoteCard({ note, onEdit }: { note: MoneyNote; onEdit: () => void }) {
  const { today } = useFinance();
  const remove = async () => {
    const removed = await deleteNote(note.id);
    if (removed) toast.show("Note deleted", { action: { label: "Undo", onClick: () => void restoreNote(removed) } });
  };

  return (
    <Card className={cn("px-4 pt-4 pb-2", note.pinned && "border-accent/50 bg-accent-soft/40")}>
      <button type="button" onClick={onEdit} className="block w-full text-left" aria-label="Edit note">
        <p className="line-clamp-[12] text-body whitespace-pre-wrap text-ink">{note.text}</p>
      </button>
      <div className="mt-1 -mr-2 flex items-center gap-2">
        <p className="flex-1 text-caption text-ink-3">
          {note.pinned ? "Pinned · " : ""}
          {formatRelativeDate(localToday(new Date(note.updatedAt)), today)}
        </p>
        <IconButton size="sm" label={note.pinned ? "Unpin note" : "Pin note"} onClick={() => void updateNote(note.id, { pinned: !note.pinned })} aria-pressed={note.pinned}>
          {note.pinned ? <PinOff /> : <Pin />}
        </IconButton>
        <IconButton size="sm" label="Delete note" onClick={() => void remove()}>
          <Trash />
        </IconButton>
      </div>
    </Card>
  );
}

function EditNote({ note, onDone }: { note: MoneyNote; onDone: () => void }) {
  const [text, setText] = useState(note.text);
  const save = async () => {
    if (!text.trim()) return;
    try {
      await updateNote(note.id, { text: text.trim() });
      onDone();
    } catch (e) {
      toast.error(e);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor="edit-note" className="sr-only">
        Note
      </label>
      <textarea
        id="edit-note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        maxLength={2000}
        autoFocus
        className="w-full resize-none rounded-2xl border border-line bg-surface p-3 text-body outline-none focus:border-brand"
      />
      <Button size="xl" onClick={save} disabled={!text.trim()}>
        Save
      </Button>
    </div>
  );
}
