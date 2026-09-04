import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { dataDir as invoiceDataDir, hasBusiness, readJsonFile } from "@theluckystrike/mcp-invoice/lib";
import type { ComputedLine, TaxLine } from "@theluckystrike/mcp-invoice/lib";

/**
 * Quotes live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/quotes/`. The invoices an accepted quote
 * turns into are written into the INVOICE server's directory through the shared engine
 * (@theluckystrike/mcp-invoice/lib), so they share one client list and one number series.
 *
 * Two directories, two locks, always taken in the same order (quotes, then invoice), the
 * same order servers/recurring uses, so no two processes in this repo can deadlock.
 *
 * Reads go through the invoice engine's `readJsonFile`, so a quotes.json that is not JSON
 * is quarantined byte-for-byte as `quotes.json.corrupt-<timestamp>` with a `.corrupt`
 * marker beside it, and every later call fails loudly instead of treating a store that is
 * still on disk as "no quotes".
 */

export type QuoteStatus = "open" | "accepted" | "declined";

export interface QuoteParty {
  name: string;
  address?: string;
  email?: string;
  vat_id?: string;
}

export interface Quote {
  /** `Q-<YYYY>-<NNNN>`, allocated per year. */
  id: string;
  client_id?: string;
  client: QuoteParty;
  issue_date: string;
  /** Last day the quote is good for, inclusive. */
  valid_until: string;
  validity_days: number;
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
  status: QuoteStatus;
  accepted_date?: string;
  declined_date?: string;
  decline_reason?: string;
  /** Set when accepting created a real invoice in the invoice server. */
  invoice_number?: string;
  created: string;
  updated: string;
  /** Free tier renders a footer credit on the PDF. */
  branded: boolean;
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "quotes");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function lockPath(): string { return join(dataDir(), ".lock"); }

function read<T>(file: string, empty: T): T {
  return readJsonFile<T>(join(dataDir(), file), empty);
}

/** Atomic: per-process temp name, then rename over the target. */
function write(file: string, value: unknown): void {
  const p = join(dataDir(), file);
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
}

export function getQuotes(): Quote[] { return read<Quote[]>("quotes.json", []); }
export function setQuotes(q: Quote[]): void { write("quotes.json", q); }

/**
 * Allocate the next quote id: `Q-<YYYY>-<NNNN>`.
 *
 * The counter is per year and is written BEFORE the quote is stored, so a crash burns an
 * id rather than reusing one. Ids already in the store are also scanned, so a restored or
 * hand-edited quotes.json can never hand back an id that is already on a document a
 * client has seen. The year is part of the id on purpose: a bare `Q-0001` reset every
 * January collides with last January's quote, and the two are different documents.
 */
export function nextQuoteId(year: string, existing: Quote[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `Q-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(existing.map((q) => q.id));
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

/**
 * Resolve a quote by exact id (case-insensitive), then by exact client name, then -- only
 * if nothing exact matched -- by partial client name. More than one partial candidate is
 * refused with the list rather than silently picking the first, so quote_accept cannot
 * accept the wrong client's quote.
 */
export function findQuote(list: Quote[], ref: string): Quote | undefined {
  const needle = String(ref).trim().toLowerCase();
  const byId = list.find((q) => q.id.toLowerCase() === needle);
  if (byId) return byId;
  const byClient = list.filter((q) => q.client.name.toLowerCase() === needle);
  if (byClient.length === 1) return byClient[0];
  const pool = byClient.length ? byClient : list.filter((q) => q.client.name.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(
      `"${ref}" matches more than one quote: ${pool.map((q) => `${q.id} (${q.client.name}, ${q.status})`).join(", ")}. ` +
      `Pass the exact quote id.`,
    );
  }
  return pool[0];
}

/**
 * Is the invoice server's store actually in use on this machine? True when it already
 * holds invoices, a client list or a business profile. quote_accept uses this to decide
 * between creating the invoice directly and handing back invoice_create-ready items.
 */
export function invoiceStorePresent(): boolean {
  const dir = invoiceDataDir();
  return existsSync(join(dir, "invoices.json"))
    || existsSync(join(dir, "clients.json"))
    || hasBusiness();
}
