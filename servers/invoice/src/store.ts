import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
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

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(join(dataDir(), file), "utf8")) as T; } catch { return fallback; }
}

function writeJson(file: string, value: unknown): void {
  const p = join(dataDir(), file);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
}

export const DEFAULT_BUSINESS: Business = {
  name: "", default_currency: "EUR", default_tax_rate: 0,
  payment_terms_days: 14, invoice_prefix: "INV",
};

export function getBusiness(): Business {
  return { ...DEFAULT_BUSINESS, ...readJson<Partial<Business>>("business.json", {}) };
}
export function setBusiness(b: Business): void { writeJson("business.json", b); }
export function hasBusiness(): boolean { return existsSync(join(dataDir(), "business.json")); }

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
