import { today as getToday } from "@/lib/dates";
import { ensureDefaultCategories } from "@/lib/storage/repositories/categories";
import { runRecurringRules } from "@/lib/storage/repositories/recurring";
import { getSettings } from "@/lib/storage/repositories/settings";
import { pruneOrphanedReceipts } from "@/lib/storage/repositories/attachments";
import { runDailyBackup } from "./auto-backup";
import { postInterest } from "./interest";
import { ensureMonthlySnapshots } from "./snapshots";

/**
 * Runs on every launch and when the app returns to the foreground:
 * seeds defaults, posts due recurring items, and prepares monthly reviews.
 * Every step is idempotent.
 */
export async function initializeApp(today = getToday()): Promise<{ posted: number }> {
  await getSettings();
  await ensureDefaultCategories();
  const posted = await runRecurringRules(today);
  await postInterest(today);
  await ensureMonthlySnapshots(today);
  // Housekeeping never blocks opening the app.
  await runDailyBackup(today).catch((error: unknown) => console.warn("Daily backup skipped", error));
  await pruneOrphanedReceipts().catch(() => 0);
  return { posted };
}
