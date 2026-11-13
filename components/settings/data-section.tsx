"use client";

import { Database, FileJson, FileSpreadsheet, FileText, FlaskConical, KeyRound, Sheet as SheetIcon, Trash, Upload } from "lucide-react";
import Link from "@/components/ui/app-link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { CsvImportSheet } from "./csv-import-sheet";
import { LocalBackups } from "./local-backups";
import { useFinance } from "@/hooks/use-finance";
import { addMonthKey } from "@/lib/dates";
import { getStorageStatus, requestPersistentStorage, saveFile, type StorageStatus } from "@/lib/platform";
import { backupFileName, createEncryptedBackup, exportDataset, parseBackup, PassphraseRequiredError, restoreBackup, serializeBackup, transactionsToCSV, type ParsedBackup } from "@/lib/services/backup";
import { clearFinancialData, loadDemoData } from "@/lib/services/demo";
import { resetOwwy } from "@/lib/services/reset";
import { toast } from "@/stores/ui";

export function DataSection() {
  const { settings, state, today } = useFinance();
  const [encryptOpen, setEncryptOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [sampleConfirm, setSampleConfirm] = useState<"load" | "remove" | null>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);

  useEffect(() => {
    void getStorageStatus().then(setStorage);
  }, []);

  const exportJSON = async () => {
    try {
      await saveFile(backupFileName("json"), serializeBackup(await exportDataset()), "application/json");
      toast.success("Backup exported");
    } catch (e) {
      toast.error(e, "Couldn't export the backup.");
    }
  };

  const exportCSV = async () => {
    try {
      await saveFile(backupFileName("csv"), transactionsToCSV(await exportDataset()), "text/csv");
      toast.success("Transactions exported");
    } catch (e) {
      toast.error(e, "Couldn't export transactions.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <DataButton icon={<FileSpreadsheet />} title="Export CSV" description="Every transaction, for spreadsheets" onClick={exportCSV} />
        <DataButton icon={<FileJson />} title="Export backup" description="Everything, as a JSON file" onClick={exportJSON} />
        <DataButton icon={<KeyRound />} title="Encrypted backup" description="Protected with a passphrase" onClick={() => setEncryptOpen(true)} />
        <DataButton icon={<Upload />} title="Import backup" description="Move from another device" onClick={() => setImportOpen(true)} />
        <DataButton icon={<SheetIcon />} title="Import CSV" description="Transactions from a bank or another app" onClick={() => setCsvOpen(true)} />
        <Link href={`/report/?month=${addMonthKey(state.month, -1)}`} className="press flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left hover:bg-surface-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-ink [&_svg]:size-5" aria-hidden>
            <FileText />
          </span>
          <span>
            <span className="block font-semibold">PDF report</span>
            <span className="block text-caption text-ink-3">Print or save a monthly report</span>
          </span>
        </Link>
      </div>

      <LocalBackups />

      <div className="flex items-start gap-3 rounded-2xl bg-surface-2 p-4">
        <Database className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
        <div className="min-w-0 flex-1 text-callout">
          <p className="font-semibold">Stored on this device</p>
          <p className="text-ink-3">
            {storage?.persisted ? "Protected storage is on — the browser won't clear it to free up space." : "The browser may clear site data when space runs low. Keep a backup."}
            {storage?.usageBytes ? ` Using ${(storage.usageBytes / 1024 / 1024).toFixed(1)} MB.` : ""}
          </p>
          {!storage?.persisted ? (
            <button
              type="button"
              className="mt-1 font-semibold text-brand"
              onClick={async () => {
                const granted = await requestPersistentStorage();
                setStorage(await getStorageStatus());
                toast.show(granted ? "Protected storage is on" : "This browser didn't allow protected storage. Regular backups keep you safe.");
              }}
            >
              Protect my data
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-line-strong p-4">
        <FlaskConical className="size-5 text-ink-3" aria-hidden />
        <p className="min-w-0 flex-1 text-callout text-ink-2">{settings.demoMode ? "Sample data is loaded." : "Want to look around first? Load sample data."}</p>
        <Button size="sm" variant="secondary" onClick={() => setSampleConfirm(settings.demoMode ? "remove" : "load")}>
          {settings.demoMode ? "Remove sample data" : "Load sample data"}
        </Button>
      </div>

      <div className="mt-2 rounded-2xl border border-negative/30 bg-negative-soft/40 p-4">
        <p className="font-semibold text-negative">Reset Owwy</p>
        <p className="text-callout text-ink-2">This permanently deletes all local Owwy data from this device.</p>
        <Button size="sm" variant="danger" className="mt-3" onClick={() => setResetOpen(true)}>
          <Trash />
          Reset Owwy
        </Button>
      </div>

      <EncryptedBackupSheet open={encryptOpen} onOpenChange={setEncryptOpen} />
      <ImportSheet open={importOpen} onOpenChange={setImportOpen} />
      <CsvImportSheet open={csvOpen} onOpenChange={setCsvOpen} />
      <ResetDialog open={resetOpen} onOpenChange={setResetOpen} onExport={exportJSON} />
      <ConfirmDialog
        open={sampleConfirm !== null}
        onOpenChange={(o) => !o && setSampleConfirm(null)}
        title={sampleConfirm === "load" ? "Load sample data?" : "Remove sample data?"}
        description={
          sampleConfirm === "load"
            ? "This replaces your accounts, transactions, budgets, bills and goals with sample data. Export a backup first if you've added your own."
            : "All sample accounts, transactions and plans are removed. Your preferences stay."
        }
        confirmLabel={sampleConfirm === "load" ? "Replace with sample data" : "Remove sample data"}
        destructive
        onConfirm={async () => {
          if (sampleConfirm === "load") await loadDemoData(today);
          else await clearFinancialData();
          toast.success(sampleConfirm === "load" ? "Sample data loaded" : "Sample data removed");
        }}
      />
    </div>
  );
}

function DataButton({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left hover:bg-surface-2">
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-ink [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-caption text-ink-3">{description}</span>
      </span>
    </button>
  );
}

function EncryptedBackupSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (passphrase.length < 8) return setError("Use at least 8 characters.");
    if (passphrase !== again) return setError("The passphrases don't match.");
    setBusy(true);
    try {
      await saveFile(backupFileName("encrypted"), await createEncryptedBackup(await exportDataset(), passphrase), "application/json");
      toast.success("Encrypted backup exported");
      setPassphrase("");
      setAgain("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Encrypted backup" description="AES-256 encryption with a passphrase only you know." size="sm">
      <div className="flex flex-col gap-4">
        <Field label="Passphrase" error={error}>
          {(props) => <TextInput {...props} type="password" autoComplete="new-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />}
        </Field>
        <Field label="Repeat passphrase">{(props) => <TextInput {...props} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />}</Field>
        <p className="text-caption text-ink-3">There&apos;s no way to recover a forgotten passphrase — not even for us.</p>
        <Button size="lg" onClick={create} loading={busy}>
          Create encrypted backup
        </Button>
      </div>
    </Sheet>
  );
}

function ImportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Import a backup" description="Replaces the data on this device with the backup's data." size="sm">
      {/* Mounted only while open, so a previous file or passphrase never lingers. */}
      {open ? <ImportForm onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const read = async (text: string, pass?: string) => {
    setBusy(true);
    setError(null);
    try {
      setParsed(await parseBackup(text, pass));
      setNeedsPassphrase(false);
    } catch (e) {
      if (e instanceof PassphraseRequiredError) setNeedsPassphrase(true);
      else setError(e instanceof Error ? e.message : "Couldn't read this file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
        <div className="flex flex-col gap-4">
          <input
            ref={fileRef}
            type="file"
            accept=".json,.owwy,application/json"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 50 * 1024 * 1024) return setError("That file is too large to be an Owwy backup.");
              const text = await file.text();
              setFileText(text);
              void read(text);
            }}
          />
          <Button variant="secondary" size="lg" onClick={() => fileRef.current?.click()}>
            <Upload />
            {fileText ? "Choose a different file" : "Choose backup file"}
          </Button>

          {needsPassphrase ? (
            <div className="flex flex-col gap-3">
              <Field label="This backup is encrypted. Passphrase:">
                {(props) => <TextInput {...props} type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />}
              </Field>
              <Button onClick={() => fileText && read(fileText, passphrase)} loading={busy}>
                Unlock backup
              </Button>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-xl bg-negative-soft px-3 py-2 text-callout text-negative">
              {error}
            </p>
          ) : null}

          {parsed ? (
            <div className="rounded-2xl bg-surface-2 p-4 text-callout">
              <p className="font-semibold">Backup from {new Date(parsed.exportedAt).toLocaleString()}</p>
              <ul className="mt-2 grid grid-cols-2 gap-1 text-ink-2">
                <li>{parsed.counts.accounts} accounts</li>
                <li>{parsed.counts.transactions} transactions</li>
                <li>{parsed.counts.budgets} budgets</li>
                <li>{parsed.counts.bills} bills</li>
                <li>{parsed.counts.goals} goals</li>
                <li>{parsed.counts.debts} debts</li>
              </ul>
              <Button className="mt-4 w-full" onClick={() => setConfirm(true)}>
                Restore this backup
              </Button>
            </div>
          ) : null}
        </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Replace data on this device?"
        description="Everything currently in Owwy on this device will be replaced by the backup. This can't be undone — export a backup first if you're unsure."
        confirmLabel="Replace my data"
        destructive
        onConfirm={async () => {
          if (!parsed) return;
          try {
            await restoreBackup(parsed.data);
            toast.success("Backup restored");
            onDone();
          } catch (e) {
            toast.error(e, "Restore failed. Your existing data was kept.");
          }
        }}
      />
    </>
  );
}

function ResetDialog({ open, onOpenChange, onExport }: { open: boolean; onOpenChange: (o: boolean) => void; onExport: () => void }) {
  const [typed, setTyped] = useState("");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
      title="Reset Owwy?"
      description="This permanently deletes all local Owwy data from this device — accounts, transactions, budgets, goals, settings and your app lock."
      confirmLabel="Delete everything"
      destructive
      confirmDisabled={typed.trim().toUpperCase() !== "RESET"}
      onConfirm={async () => {
        await resetOwwy();
        window.location.replace("/welcome/");
      }}
    >
      <div className="flex flex-col gap-3">
        <Button variant="secondary" onClick={onExport}>
          Export a backup first
        </Button>
        <Field label='Type "RESET" to confirm'>{(props) => <TextInput {...props} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}</Field>
      </div>
    </ConfirmDialog>
  );
}
