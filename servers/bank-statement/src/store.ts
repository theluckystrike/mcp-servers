import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Txn {
  id: string;
  account: string;
  date: string;                 // YYYY-MM-DD, the booking date
  description: string;
  counterparty?: string;
  amount_minor: number;         // SIGNED integer minor units: debit negative, credit positive
  currency: string;             // ISO 4217, uppercase
  balance_minor?: number;
  category?: string;
  bank: string;                 // the profile that read the file
  dedupe: string;               // date + amount + description hash, with an occurrence index
  imported: string;             // ISO timestamp
}

export interface Account { name: string; currency?: string; bank?: string; created: string }

export interface Rule { match: string; category: string; regex?: boolean }

export interface DB { version: 1; accounts: Account[]; transactions: Txn[]; rules: Rule[] }

const EMPTY: DB = { version: 1, accounts: [], transactions: [], rules: [] };

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", "bank-statement");
}

export function dbPath(): string { return join(dataDir(), "data.json"); }
export function lockPath(): string { return join(dataDir(), ".lock"); }

/** Where servers/expense-tracker keeps its ledger. Read-only, and only if it exists. */
export function expenseDbPath(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", "expense-tracker", "data.json");
}

/**
 * A read or JSON.parse failure must never be reported as "empty database": the next
 * import would then overwrite a history that is still on disk. Only ENOENT means empty.
 * A parse failure quarantines the file byte-for-byte as <file>.corrupt-<timestamp>,
 * writes a marker so every later call (read or write) keeps failing until a human
 * resolves it, and throws. Same contract as expense-tracker and calendar.
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
  } catch { return t; }
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
    throw new CorruptDataError(`cannot read the data file ${file}: ${(e as Error).message}; nothing was written.`);
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

/** A row of the wrong shape is dropped, not fatal: one bad object must not hide a year of history. */
function isTxn(v: unknown): v is Txn {
  const t = v as Txn;
  return !!t && typeof t === "object"
    && typeof t.id === "string" && typeof t.date === "string"
    && typeof t.amount_minor === "number" && Number.isFinite(t.amount_minor)
    && typeof t.currency === "string" && typeof t.account === "string";
}

function isAccount(v: unknown): v is Account {
  const a = v as Account;
  return !!a && typeof a === "object" && typeof a.name === "string" && a.name !== "";
}

function isRule(v: unknown): v is Rule {
  const r = v as Rule;
  return !!r && typeof r === "object" && typeof r.match === "string" && typeof r.category === "string";
}

export function load(): DB {
  const raw = readJsonFile<Partial<DB>>(dbPath(), { ...EMPTY });
  return {
    version: 1,
    accounts: Array.isArray(raw.accounts) ? raw.accounts.filter(isAccount) : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions.filter(isTxn) : [],
    rules: Array.isArray(raw.rules) ? raw.rules.filter(isRule) : [],
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

/* ------------------------------------------------- the expense ledger, read-only */

export interface ForeignExpense {
  id: string;
  date: string;
  amount_minor: number;   // gross, POSITIVE, in expense-tracker's shape
  currency: string;
  category?: string;
  merchant?: string;
  project?: string;
}

/**
 * Read servers/expense-tracker's ledger. This server never writes it and never locks it:
 * a torn read is possible in principle but expense-tracker writes tmp+rename, so the file
 * is always a whole document. A missing or unparseable file is "no expenses", not an
 * error -- reconciliation is a read-side convenience and must not fail because the other
 * server was never installed.
 */
export function readExpenses(): { present: boolean; expenses: ForeignExpense[]; note?: string } {
  const file = expenseDbPath();
  if (!existsSync(file)) return { present: false, expenses: [] };
  let parsed: { expenses?: unknown };
  try { parsed = JSON.parse(readFileSync(file, "utf8")) as { expenses?: unknown }; }
  catch (e) { return { present: true, expenses: [], note: `the expense ledger at ${file} could not be read (${(e as Error).message}); nothing was matched against it.` }; }
  const rows = Array.isArray(parsed.expenses) ? parsed.expenses : [];
  const out: ForeignExpense[] = [];
  for (const r of rows as ForeignExpense[]) {
    if (!r || typeof r !== "object") continue;
    if (typeof r.date !== "string" || typeof r.amount_minor !== "number" || typeof r.currency !== "string") continue;
    out.push({
      id: String(r.id ?? ""), date: r.date, amount_minor: r.amount_minor,
      currency: r.currency.toUpperCase(), category: r.category, merchant: r.merchant, project: r.project,
    });
  }
  return { present: true, expenses: out };
}
