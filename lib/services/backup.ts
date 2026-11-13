import { toMajor } from "@/lib/money";
import { decryptText, encryptText, type EncryptedPayload } from "@/lib/security/crypto";
import { getDB, loadDataset } from "@/lib/storage/db";
import { datasetSchema } from "@/lib/storage/schemas";
import { withDefaults } from "@/lib/storage/repositories/settings";
import type { OwwyDataset } from "@/types/models";

export const BACKUP_FORMAT = "owwy-backup";
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: "Owwy";
  exportedAt: string;
  data: OwwyDataset;
}

export async function exportDataset(): Promise<OwwyDataset> {
  const raw = await loadDataset();
  return { ...raw, settings: withDefaults(raw.settings ?? {}) };
}

/** App lock secrets are device-specific and never leave the device in a backup. */
function stripSecrets(data: OwwyDataset): OwwyDataset {
  return {
    ...data,
    settings: {
      ...data.settings,
      security: { pinEnabled: false, autoLockMinutes: data.settings.security.autoLockMinutes, biometricEnabled: false },
    },
  };
}

export function serializeBackup(data: OwwyDataset, exportedAt = new Date()): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: "Owwy",
    exportedAt: exportedAt.toISOString(),
    data: stripSecrets(data),
  };
  return JSON.stringify(file, null, 2);
}

export async function createEncryptedBackup(data: OwwyDataset, passphrase: string): Promise<string> {
  if (passphrase.length < 8) throw new Error("Use a passphrase of at least 8 characters.");
  return JSON.stringify(await encryptText(serializeBackup(data), passphrase), null, 2);
}

export class PassphraseRequiredError extends Error {
  constructor() {
    super("This backup is encrypted. Enter its passphrase to continue.");
    this.name = "PassphraseRequiredError";
  }
}

export interface ParsedBackup {
  data: OwwyDataset;
  exportedAt: string;
  counts: { accounts: number; transactions: number; budgets: number; bills: number; goals: number; debts: number };
}

/** Reads a backup file (plain or encrypted), validating every record before anything is replaced. */
export async function parseBackup(text: string, passphrase?: string): Promise<ParsedBackup> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("This file isn't an Owwy backup.");
  }

  if (isEncrypted(json)) {
    if (!passphrase) throw new PassphraseRequiredError();
    json = JSON.parse(await decryptText(json, passphrase));
  }

  if (!json || typeof json !== "object" || (json as BackupFile).format !== BACKUP_FORMAT) {
    throw new Error("This file isn't an Owwy backup.");
  }
  const file = json as BackupFile;
  if (file.version > BACKUP_VERSION) {
    throw new Error("This backup was made by a newer version of Owwy. Update the app, then try again.");
  }

  const candidate = { ...file.data, settings: withDefaults(file.data?.settings ?? {}) };
  const result = datasetSchema.safeParse(candidate);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`This backup looks damaged (${issue?.path.join(".") || "unknown field"}: ${issue?.message}). Nothing was changed.`);
  }
  const data = result.data as OwwyDataset;
  return {
    data,
    exportedAt: file.exportedAt,
    counts: {
      accounts: data.accounts.length,
      transactions: data.transactions.length,
      budgets: data.budgets.length,
      bills: data.bills.length,
      goals: data.goals.length,
      debts: data.debts.length,
    },
  };
}

function isEncrypted(value: unknown): value is EncryptedPayload {
  return Boolean(value && typeof value === "object" && (value as EncryptedPayload).format === "owwy-backup-encrypted");
}

/** Replaces all local data with the backup in a single atomic transaction. Keeps this device's app lock. */
export async function restoreBackup(data: OwwyDataset): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.dataTables, async () => {
    const current = await db.settings.get("app");
    await Promise.all(db.dataTables.map((table) => table.clear()));
    await db.settings.put({
      ...data.settings,
      security: current?.security ?? data.settings.security,
      onboarded: true,
      updatedAt: Date.now(),
    });
    await db.accounts.bulkAdd(data.accounts);
    await db.categories.bulkAdd(data.categories);
    await db.transactions.bulkAdd(data.transactions);
    await db.budgets.bulkAdd(data.budgets);
    await db.bills.bulkAdd(data.bills);
    await db.goals.bulkAdd(data.goals);
    await db.debts.bulkAdd(data.debts);
    await db.recurring.bulkAdd(data.recurring);
    await db.snapshots.bulkAdd(data.snapshots);
    await db.receivables.bulkAdd(data.receivables ?? []);
    await db.notes.bulkAdd(data.notes ?? []);
    await db.trips.bulkAdd(data.trips ?? []);
  });
}

/** Spreadsheet-friendly export of every transaction. */
export function transactionsToCSV(data: OwwyDataset): string {
  const currency = data.settings.currency;
  const accounts = new Map(data.accounts.map((a) => [a.id, a.name]));
  const categories = new Map(data.categories.map((c) => [c.id, c.name]));
  const header = ["Date", "Type", "Amount", "Currency", "Category", "Account", "To account", "Note", "Tags"];
  const rows = [...data.transactions]
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((tx) => {
      const signed = tx.type === "expense" ? -tx.amount : tx.amount;
      return [
        tx.date,
        tx.type,
        toMajor(signed, currency).toFixed(currency === "JPY" ? 0 : 2),
        currency,
        textCell(tx.categoryId ? (categories.get(tx.categoryId) ?? "") : ""),
        textCell(accounts.get(tx.accountId) ?? ""),
        textCell(tx.toAccountId ? (accounts.get(tx.toAccountId) ?? "") : ""),
        textCell(tx.note),
        textCell(tx.tags.join(" ")),
      ].map(csvEscape);
    });
  return [header.map(csvEscape), ...rows].map((r) => r.join(",")).join("\r\n");
}

/** Neutralizes spreadsheet formula injection in free-text cells. */
function textCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function backupFileName(kind: "json" | "encrypted" | "csv", date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  if (kind === "csv") return `owwy-transactions-${stamp}.csv`;
  if (kind === "encrypted") return `owwy-backup-${stamp}.owwy`;
  return `owwy-backup-${stamp}.json`;
}
