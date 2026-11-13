import Dexie, { type EntityTable } from "dexie";
import type {
  Account,
  AppSettings,
  Attachment,
  Bill,
  Budget,
  Category,
  ChatMessage,
  Debt,
  LocalBackup,
  MoneyNote,
  MonthlySnapshot,
  OwwyDataset,
  Receivable,
  RecurringTransaction,
  SavingsGoal,
  ShoppingTrip,
  Transaction,
} from "@/types/models";

export const DB_NAME = "owwy";

export interface SecretRecord {
  id: string;
  /** Non-extractable device key, or AES-GCM encrypted payload. */
  key?: CryptoKey;
  iv?: Uint8Array<ArrayBuffer>;
  ciphertext?: ArrayBuffer;
  updatedAt: number;
}

/**
 * Local IndexedDB database. Only repositories and services talk to it;
 * UI components read through `useFinance()` and write through services.
 *
 * Booleans are never indexed (IndexedDB can't index them).
 * When the schema changes, add a new `version(n)` with an upgrade function —
 * never edit an existing version.
 */
export class OwwyDB extends Dexie {
  settings!: EntityTable<AppSettings, "id">;
  accounts!: EntityTable<Account, "id">;
  categories!: EntityTable<Category, "id">;
  transactions!: EntityTable<Transaction, "id">;
  budgets!: EntityTable<Budget, "id">;
  bills!: EntityTable<Bill, "id">;
  goals!: EntityTable<SavingsGoal, "id">;
  debts!: EntityTable<Debt, "id">;
  recurring!: EntityTable<RecurringTransaction, "id">;
  snapshots!: EntityTable<MonthlySnapshot, "id">;
  receivables!: EntityTable<Receivable, "id">;
  notes!: EntityTable<MoneyNote, "id">;
  /** Shopping trips: a budget, the trolley, and the expense it becomes. */
  trips!: EntityTable<ShoppingTrip, "id">;
  /** Ask Owwy conversation. Device-only: never included in backups. */
  chatMessages!: EntityTable<ChatMessage, "id">;
  /** Encrypted secrets (e.g. the user's own AI key) and the device key. Never exported. */
  secrets!: EntityTable<SecretRecord, "id">;
  /** Receipt photos. Device-only binary data, kept out of JSON backups. */
  attachments!: EntityTable<Attachment, "id">;
  /** Automatic daily backups kept on this device. */
  localBackups!: EntityTable<LocalBackup, "id">;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      settings: "id",
      accounts: "id, type, order",
      categories: "id, kind, order",
      transactions: "id, date, type, accountId, toAccountId, categoryId, billId, goalId, debtId, recurringId, [recurringId+date]",
      budgets: "id, month, categoryId, [month+categoryId]",
      bills: "id, nextDueDate",
      goals: "id, accountId",
      debts: "id, accountId",
      recurring: "id, nextDate",
      snapshots: "id",
    });
    this.version(2)
      .stores({
        chatMessages: "id, createdAt",
        secrets: "id",
      })
      .upgrade(async (tx) => {
        // Automations created before v2 always logged themselves.
        await tx
          .table("recurring")
          .toCollection()
          .modify((rule: Partial<RecurringTransaction>) => {
            if (!rule.mode) rule.mode = "auto";
          });
      });
    this.version(3).stores({
      transactions: "id, date, type, accountId, toAccountId, categoryId, billId, goalId, debtId, recurringId, receivableId, [recurringId+date]",
      receivables: "id, createdAt",
      notes: "id, updatedAt",
      attachments: "id, transactionId",
      localBackups: "id, createdAt",
    });
    this.version(4).stores({
      trips: "id, status, startedAt",
    });
  }

  /** Financial data: backed up, exported, and replaced on restore. */
  get dataTables() {
    return [
      this.settings,
      this.accounts,
      this.categories,
      this.transactions,
      this.budgets,
      this.bills,
      this.goals,
      this.debts,
      this.recurring,
      this.snapshots,
      this.receivables,
      this.notes,
      this.trips,
    ];
  }
}

let instance: OwwyDB | null = null;

export function getDB(): OwwyDB {
  if (!instance) instance = new OwwyDB();
  return instance;
}

/** Test hook: swap in a database with a unique name. */
export function setDB(db: OwwyDB | null): void {
  instance = db;
}

export type DatasetWithoutSettings = Omit<OwwyDataset, "settings">;

/** Reads every table in one consistent read transaction. */
export async function loadDataset(db: OwwyDB = getDB()): Promise<Omit<OwwyDataset, "settings"> & { settings: AppSettings | undefined }> {
  return db.transaction("r", db.dataTables, async () => {
    const [settings, accounts, categories, transactions, budgets, bills, goals, debts, recurring, snapshots, receivables, notes, trips] = await Promise.all([
      db.settings.get("app"),
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.budgets.toArray(),
      db.bills.toArray(),
      db.goals.toArray(),
      db.debts.toArray(),
      db.recurring.toArray(),
      db.snapshots.toArray(),
      db.receivables.toArray(),
      db.notes.toArray(),
      db.trips.toArray(),
    ]);
    return { settings, accounts, categories, transactions, budgets, bills, goals, debts, recurring, snapshots, receivables, notes, trips };
  });
}
