import { getDB } from "@/lib/storage/db";
import { getSettings } from "@/lib/storage/repositories/settings";
import type { ISODate, LocalBackup } from "@/types/models";
import { exportDataset, parseBackup, restoreBackup, serializeBackup } from "./backup";

export const LOCAL_BACKUPS_KEPT = 7;

/**
 * Once a day, keeps a full copy of your data on this device, so a mistaken
 * delete or a bad import can be rolled back. It protects against mistakes,
 * not against losing the device — exported backups do that.
 */
export async function runDailyBackup(today: ISODate): Promise<LocalBackup | null> {
  const settings = await getSettings();
  if (!settings.autoBackup || !settings.onboarded) return null;
  const db = getDB();
  if (await db.localBackups.get(today)) return null;

  const dataset = await exportDataset();
  if (!dataset.transactions.length && !dataset.accounts.length) return null;
  const data = serializeBackup(dataset);
  const backup: LocalBackup = { id: today, createdAt: Date.now(), size: data.length, transactionCount: dataset.transactions.length, data };
  await db.transaction("rw", db.localBackups, async () => {
    await db.localBackups.put(backup);
    const keys = await db.localBackups.orderBy("createdAt").reverse().primaryKeys();
    await db.localBackups.bulkDelete(keys.slice(LOCAL_BACKUPS_KEPT));
  });
  return backup;
}

export async function listLocalBackups(): Promise<Omit<LocalBackup, "data">[]> {
  const all = await getDB().localBackups.orderBy("createdAt").reverse().toArray();
  return all.map(({ data: _data, ...meta }) => {
    void _data;
    return meta;
  });
}

export async function restoreLocalBackup(id: ISODate): Promise<void> {
  const backup = await getDB().localBackups.get(id);
  if (!backup) throw new Error("That backup is no longer available.");
  const parsed = await parseBackup(backup.data);
  await restoreBackup(parsed.data);
}
