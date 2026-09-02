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
  rebilled_at?: string;         // ISO timestamp, set by expense_to_invoice
  created: string;
}

export interface Rule { match: string; category: string }

export interface DB { version: 1; expenses: Expense[]; rules: Rule[] }

const EMPTY: DB = { version: 1, expenses: [], rules: [] };

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", "expense-tracker");
}

export function dbPath(): string { return join(dataDir(), "data.json"); }
export function lockPath(): string { return join(dataDir(), ".lock"); }

export function load(): DB {
  try {
    const raw = JSON.parse(readFileSync(dbPath(), "utf8")) as Partial<DB>;
    return {
      version: 1,
      expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
      rules: Array.isArray(raw.rules) ? raw.rules : [],
    };
  } catch { return { ...EMPTY, expenses: [], rules: [] }; }
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
