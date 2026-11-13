import { createId } from "@/lib/utils/id";
import type { ID, MoneyNote } from "@/types/models";
import { getDB } from "../db";
import { noteSchema, validate } from "../schemas";

export async function createNote(text: string): Promise<MoneyNote> {
  const now = Date.now();
  const note = validate(noteSchema, { id: createId("note"), text, pinned: false, createdAt: now, updatedAt: now });
  await getDB().notes.add(note);
  return note;
}

export async function updateNote(id: ID, patch: Partial<Pick<MoneyNote, "text" | "pinned">>): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.notes, async () => {
    const current = await db.notes.get(id);
    if (!current) throw new Error("This note no longer exists.");
    await db.notes.put(validate(noteSchema, { ...current, ...patch, updatedAt: patch.text !== undefined ? Date.now() : current.updatedAt }));
  });
}

export async function deleteNote(id: ID): Promise<MoneyNote | undefined> {
  const db = getDB();
  const note = await db.notes.get(id);
  if (note) await db.notes.delete(id);
  return note;
}

export async function restoreNote(note: MoneyNote): Promise<void> {
  await getDB().notes.put(note);
}
