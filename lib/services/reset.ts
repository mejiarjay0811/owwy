import { getDB, setDB } from "@/lib/storage/db";

/**
 * Every key Owwy writes to localStorage. The reset promises to remove
 * everything stored on the device, so this list has to be complete —
 * `owwy-last-account` in particular holds an account id, which would otherwise
 * survive a reset.
 */
export const LOCAL_KEYS = [
  "owwy-theme",
  "owwy-hide",
  "owwy-install-dismissed",
  "owwy-pin-attempts",
  "owwy-accounts-view",
  "owwy-last-account",
  "owwy.reminders.seen",
];

/** Permanently deletes every piece of Owwy data stored on this device. */
export async function resetOwwy(): Promise<void> {
  const db = getDB();
  db.close();
  await db.delete();
  setDB(null);
  try {
    for (const key of LOCAL_KEYS) localStorage.removeItem(key);
    sessionStorage.clear();
  } catch {
    // Storage may be unavailable (private mode); IndexedDB was already removed.
  }
}
