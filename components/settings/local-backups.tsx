"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SwitchRow } from "@/components/ui/form";
import { useFinance } from "@/hooks/use-finance";
import { formatRelativeDate, relativeDatePhrase } from "@/lib/dates";
import { listLocalBackups, LOCAL_BACKUPS_KEPT, restoreLocalBackup, runDailyBackup } from "@/lib/services/auto-backup";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { toast } from "@/stores/ui";
import type { LocalBackup } from "@/types/models";

type BackupMeta = Omit<LocalBackup, "data">;

/** Daily on-device snapshots: a safety net for mistakes, with one-tap restore. */
export function LocalBackups() {
  const { settings, today } = useFinance();
  const [backups, setBackups] = useState<BackupMeta[] | null>(null);
  const [restoring, setRestoring] = useState<BackupMeta | null>(null);

  useEffect(() => {
    void listLocalBackups().then(setBackups);
  }, []);

  const toggle = async (autoBackup: boolean) => {
    await updateSettings({ autoBackup });
    if (autoBackup) {
      await runDailyBackup(today);
      setBackups(await listLocalBackups());
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface px-4 pb-3">
      <SwitchRow
        checked={settings.autoBackup}
        onCheckedChange={(v) => void toggle(v)}
        label="Daily backups on this device"
        description={`Keeps the last ${LOCAL_BACKUPS_KEPT} days so you can undo a mistake. Export a backup to protect against losing your phone.`}
        icon={<History className="size-5 shrink-0 text-ink-3" aria-hidden />}
      />
      {backups?.length ? (
        <ul className="mt-1 flex flex-col divide-y divide-line/60 border-t border-line/60">
          {backups.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-callout font-semibold">{formatRelativeDate(b.id, today)}</span>
                <span className="block text-caption text-ink-3">
                  {b.transactionCount.toLocaleString()} transactions · {(b.size / 1024).toFixed(0)} KB
                </span>
              </span>
              <Button size="sm" variant="secondary" onClick={() => setRestoring(b)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      ) : settings.autoBackup && backups ? (
        <p className="pb-1 text-caption text-ink-3">Your first copy is made the next time Owwy opens.</p>
      ) : null}

      <ConfirmDialog
        open={Boolean(restoring)}
        onOpenChange={(o) => !o && setRestoring(null)}
        title={restoring ? `Go back to ${relativeDatePhrase(restoring.id, today)}?` : "Restore backup?"}
        description="Everything in Owwy returns to how it was in this copy. Changes made after it will be lost."
        confirmLabel="Restore this copy"
        destructive
        onConfirm={async () => {
          if (!restoring) return;
          try {
            await restoreLocalBackup(restoring.id);
            toast.success("Restored", { description: `Owwy is back to ${relativeDatePhrase(restoring.id, today)}.` });
          } catch (e) {
            toast.error(e, "Restore failed. Your current data was kept.");
          }
        }}
      />
    </div>
  );
}
