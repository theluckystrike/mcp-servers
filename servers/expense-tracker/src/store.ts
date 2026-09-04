import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Mileage {
  distance: number;
  unit: "km" | "mile";
  rate: number;
  region: string;
  purpose: string;
}

export interface Expense {
  id: string;
  date: string;                 // YYYY-MM-DD
  amount_minor: number;         // gross, integer minor units
  currency: string;             // ISO 4217, uppercase
  category?: string;
  merchant?: string;
  project?: string;
  note?: string;
  receipt_path?: string;
  receipt_sha256?: string;
  billable: boolean;
  vat_rate?: number;            // percent, the amount is VAT-inclusive
  mileage?: Mileage;
  rebilled_at?: string;         // ISO timestamp, set by expense_mark_rebilled (or expense_to_invoice with mark_rebilled)
  rebilled_invoice?: string;    // Invoice number the expense was billed on, when known
  created: string;
}

export interface Rule { match: string; category: string }

export interface Settings {
  /** Applied by expense_add when the call gives no vat_rate. Opt-in: unset means no VAT is assumed. */
  default_vat_rate?: number;
  /** Applied by expense_add when the call gives no currency. Unset means EUR. */
  default_currency?: string;
}

export interface DB { version: 1; expenses: Expense[]; rules: Rule[]; settings: Settings }

const EMPTY: DB = { version: 1, expenses: [], rules: [], settings: {} };

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", "expense-tracker");
}

export function dbPath(): string { return join(dataDir(), "data.json"); }
export function lockPath(): string { return join(dataDir(), ".lock"); }

/** Where servers/bank-statement keeps its ledger. Read-only, and only if it exists. */
export function bankDbPath(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", "bank-statement", "data.json");
}

export interface ForeignTxn { date: string; amount_minor: number; currency: string }

/**
 * D-B4. expense_summary and expense_export answer from the hand-logged receipts alone, and
 * a caller asking "what did I spend" gets a confident answer built from one seeded receipt
 * while an imported bank ledger with dozens of rows sits unread in the same session. Mirrors
 * kanban's timeTrackerProjects and bank-statement's own readExpenses: same XDG data root,
 * read-only, best effort. A missing or corrupt sibling store is not this server's problem, so
 * it is reported as absent rather than thrown.
 */
export function readBankTransactions(): { present: boolean; transactions: ForeignTxn[]; note?: string } {
  const file = bankDbPath();
  if (!existsSync(file)) return { present: false, transactions: [] };
  let parsed: { transactions?: unknown };
  try { parsed = JSON.parse(readFileSync(file, "utf8")) as { transactions?: unknown }; }
  catch (e) { return { present: true, transactions: [], note: `the bank ledger at ${file} could not be read (${(e as Error).message}).` }; }
  const rows = Array.isArray(parsed.transactions) ? parsed.transactions : [];
  const out: ForeignTxn[] = [];
  for (const r of rows as ForeignTxn[]) {
    if (!r || typeof r !== "object") continue;
    if (typeof r.date !== "string" || typeof r.amount_minor !== "number" || typeof r.currency !== "string") continue;
    out.push({ date: r.date, amount_minor: r.amount_minor, currency: r.currency.toUpperCase() });
  }
  return { present: true, transactions: out };
}


/**
 * Codex v3 #1 (P0). A read or JSON.parse failure must never be reported as "empty
 * database": the next mutation would then overwrite a history that is still on disk.
 * Only ENOENT means empty. A parse failure quarantines the file byte-for-byte as
 * <file>.corrupt-<timestamp>, writes a marker so every later call (read or write)
 * keeps failing until a human resolves it, and throws.
 */
export class CorruptDataError extends Error {}

export function markerPath(file: string): string { return `${file}.corrupt`; }

function corruptStamp(): string { return new Date().toISOString().replace(/[:.]/g, "-"); }

function blocked(file: string, moved: string): CorruptDataError {
  return new CorruptDataError(
    `data file is corrupt; moved to ${moved}; nothing was written. ` +
    `Restore a good copy to ${file}, then delete ${markerPath(file)} to continue.`,
  );
}

/**
 * D-R23: the marker is read by a model as often as by a human, so its contents are a
 * one-line JSON object that explains itself rather than a bare path. Older markers hold
 * just the quarantine path, so reading falls back to the raw text.
 */
export function markerBody(quarantined: string): string {
  return JSON.stringify({
    quarantined,
    at: new Date().toISOString(),
    hint: "the original data file failed to parse; it was moved, nothing was overwritten; restore it manually or delete this marker to start fresh",
  }) + "\n";
}

function markerQuarantinePath(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  try {
    const parsed = JSON.parse(t) as { quarantined?: unknown };
    if (typeof parsed.quarantined === "string" && parsed.quarantined) return parsed.quarantined;
    return undefined;
  } catch { return t; }   // pre-D-R23 marker: the file held the path alone
}

export function readJsonFile<T>(file: string, empty: T): T {
  const marker = markerPath(file);
  if (existsSync(marker)) {
    let moved = `${file}.corrupt-*`;
    try { moved = markerQuarantinePath(readFileSync(marker, "utf8")) ?? moved; } catch { /* marker unreadable */ }
    throw blocked(file, moved);
  }
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty;
    throw new CorruptDataError(
      `cannot read the data file ${file}: ${(e as Error).message}; nothing was written.`,
    );
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const moved = `${file}.corrupt-${corruptStamp()}`;
    try { renameSync(file, moved); writeFileSync(marker, markerBody(moved)); } catch { /* keep the parse error */ }
    process.stderr.write(`${file} is not valid JSON (${(e as Error).message}); moved to ${moved}\n`);
    throw blocked(file, moved);
  }
}

export function load(): DB {
  const raw = readJsonFile<Partial<DB>>(dbPath(), { ...EMPTY });
  return {
    version: 1,
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    rules: Array.isArray(raw.rules) ? raw.rules : [],
    settings: raw.settings && typeof raw.settings === "object" ? raw.settings : {},
  };
}

/** tmp + rename, so a crash mid-write never leaves a half file. */
export function save(db: DB): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = dbPath();
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, p);
}
