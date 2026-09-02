import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "../../shims/fs.js";
import { homedir } from "../../shims/os.js";
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

export function load(): DB {
  try {
    const raw = JSON.parse(readFileSync(dbPath(), "utf8")) as Partial<DB>;
    return {
      version: 1,
      expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
      rules: Array.isArray(raw.rules) ? raw.rules : [],
      settings: raw.settings && typeof raw.settings === "object" ? raw.settings : {},
    };
  } catch { return { version: 1, expenses: [], rules: [], settings: {} }; }
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
