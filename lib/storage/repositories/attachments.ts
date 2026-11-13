import { createId } from "@/lib/utils/id";
import type { Attachment, ID } from "@/types/models";
import { getDB } from "../db";

const MAX_EDGE = 1600;
const MAX_BYTES = 12 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TRANSACTION = 4;

/**
 * Stores a receipt photo for a transaction, downscaled to keep the device
 * database small. Photos never leave the device.
 */
export async function addReceipt(transactionId: ID, file: File): Promise<Attachment> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPG, PNG or HEIC).");
  if (file.size > MAX_BYTES) throw new Error("That photo is too large. Try one under 12 MB.");
  const db = getDB();
  const existing = await db.attachments.where("transactionId").equals(transactionId).count();
  if (existing >= MAX_ATTACHMENTS_PER_TRANSACTION) throw new Error(`You can attach up to ${MAX_ATTACHMENTS_PER_TRANSACTION} photos.`);

  const { blob, width, height } = await compressImage(file);
  const attachment: Attachment = { id: createId("att"), transactionId, blob, mimeType: blob.type, width, height, size: blob.size, createdAt: Date.now() };
  await db.attachments.add(attachment);
  return attachment;
}

export async function listReceipts(transactionId: ID): Promise<Attachment[]> {
  return getDB().attachments.where("transactionId").equals(transactionId).sortBy("createdAt");
}

export async function deleteReceipt(id: ID): Promise<void> {
  await getDB().attachments.delete(id);
}

/** Removes photos whose transaction was deleted more than a day ago (after Undo windows). */
export async function pruneOrphanedReceipts(): Promise<number> {
  const db = getDB();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return db.transaction("rw", db.attachments, db.transactions, async () => {
    const all = await db.attachments.toArray();
    const orphaned: ID[] = [];
    for (const a of all) {
      if (a.createdAt < cutoff && !(await db.transactions.get(a.transactionId))) orphaned.push(a.id);
    }
    await db.attachments.bulkDelete(orphaned);
    return orphaned.length;
  });
}

async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { blob: file, width: 0, height: 0 };
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  return { blob: blob ?? file, width, height };
}
