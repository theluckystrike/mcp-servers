import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "../../shims/fs.js";
import { homedir } from "../../shims/os.js";
import { join } from "node:path";
import { readSharedProfile, writeSharedProfile } from "../../shims/license.js";
import type { ComputedLine, TaxLine } from "./money.js";

export interface Business {
  name: string;
  address?: string;
  email?: string;
  vat_id?: string;
  iban?: string;
  bank?: string;
  logo_path?: string;
  default_currency: string;
  default_tax_rate: number;
  payment_terms_days: number;
  invoice_prefix: string;
}

export interface Client {
  id: string;
  name: string;
  address?: string;
  email?: string;
  vat_id?: string;
  created: string;
}

export interface Invoice {
  number: string;
  client_id: string;
  client: { name: string; address?: string; email?: string; vat_id?: string };
  issue_date: string;
  due_date: string;
  currency: string;
  decimals: number;
  lines: ComputedLine[];
  subtotal_minor: number;
  discount_percent: number;
  discount_minor: number;
  net_minor: number;
  tax_lines: TaxLine[];
  tax_minor: number;
  total_minor: number;
  notes?: string;
  status: "unpaid" | "paid" | "partial";
  paid_date?: string;
  paid_minor: number;
  created: string;
  branded: boolean;
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "invoice");
  mkdirSync(dir, { recursive: true });
  return dir;
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

export function readJsonFile<T>(file: string, empty: T): T {
  const marker = markerPath(file);
  if (existsSync(marker)) {
    let moved = `${file}.corrupt-*`;
    try {
      const t = readFileSync(marker, "utf8").trim();
      if (t) { try { const j = JSON.parse(t) as { quarantined?: unknown }; moved = typeof j.quarantined === "string" && j.quarantined ? j.quarantined : t; } catch { moved = t; } }
    } catch { /* marker unreadable */ }
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
    try { renameSync(file, moved); writeFileSync(marker, JSON.stringify({ quarantined: moved, at: new Date().toISOString(), hint: "the original data file failed to parse; it was moved, nothing was overwritten; restore it manually or delete this marker to start fresh" }) + "\n"); } catch { /* keep the parse error */ }
    process.stderr.write(`${file} is not valid JSON (${(e as Error).message}); moved to ${moved}\n`);
    throw blocked(file, moved);
  }
}

function readJson<T>(file: string, fallback: T): T {
  return readJsonFile<T>(join(dataDir(), file), fallback);
}

function writeJson(file: string, value: unknown): void {
  const p = join(dataDir(), file);
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
}

export const DEFAULT_BUSINESS: Business = {
  name: "", default_currency: "EUR", default_tax_rate: 0,
  payment_terms_days: 14, invoice_prefix: "INV",
};

/**
 * D-R31. The issuer identity is one fact for the whole suite. The shared profile at
 * mcp-servers/profile/business.json is read first and wins field by field; the local
 * business.json is kept as the compatibility copy and as the fallback when no shared
 * profile exists yet. A field absent from the shared profile never blanks a local one.
 */
export function getBusiness(): Business {
  const local = readJson<Partial<Business>>("business.json", {});
  const shared = readSharedProfile();
  const fromShared: Partial<Business> = {};
  if (shared.name) fromShared.name = shared.name;
  if (shared.address) fromShared.address = shared.address;
  if (shared.email) fromShared.email = shared.email;
  if (shared.vat_id) fromShared.vat_id = shared.vat_id;
  if (shared.iban) fromShared.iban = shared.iban;
  if (shared.bank) fromShared.bank = shared.bank;
  if (shared.logo_path) fromShared.logo_path = shared.logo_path;
  if (shared.default_currency) fromShared.default_currency = shared.default_currency;
  if (typeof shared.default_tax_rate === "number") fromShared.default_tax_rate = shared.default_tax_rate;
  if (typeof shared.payment_terms_days === "number") fromShared.payment_terms_days = shared.payment_terms_days;
  if (shared.invoice_prefix) fromShared.invoice_prefix = shared.invoice_prefix;
  return { ...DEFAULT_BUSINESS, ...local, ...fromShared };
}

/** Writes the shared profile as well, so docx, expense-tracker and recurring see it. */
export function setBusiness(b: Business): void {
  writeJson("business.json", b);
  writeSharedProfile(b as unknown as Record<string, unknown>);
}

export function hasBusiness(): boolean {
  return existsSync(join(dataDir(), "business.json")) || !!readSharedProfile().name;
}

export function getClients(): Client[] { return readJson<Client[]>("clients.json", []); }
export function setClients(c: Client[]): void { writeJson("clients.json", c); }

export function getInvoices(): Invoice[] { return readJson<Invoice[]>("invoices.json", []); }
export function setInvoices(i: Invoice[]): void { writeJson("invoices.json", i); }

/**
 * Allocate the next invoice number: <prefix>-<YYYY>-<NNNN>.
 * The counter file is written before the invoice is stored, so a crash burns a number
 * rather than reusing one. Existing invoice numbers are also scanned so a restored or
 * hand-edited invoices.json can never hand back a number that is already on a document.
 */
export function nextNumber(prefix: string, year: string): string {
  const counters = readJson<Record<string, number>>("counter.json", {});
  const key = `${prefix}-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(getInvoices().map((i) => i.number));
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  writeJson("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

export function findClient(ref: string): Client | undefined {
  const clients = getClients();
  const needle = ref.trim().toLowerCase();
  return clients.find((c) => c.id === ref) ?? clients.find((c) => c.name.toLowerCase() === needle)
    ?? clients.find((c) => c.name.toLowerCase().includes(needle));
}

export function invoicesInMonth(month: string): Invoice[] {
  return getInvoices().filter((i) => i.issue_date.slice(0, 7) === month);
}
