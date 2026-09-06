import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-timezone/lib";
import type { Frequency, Method } from "./schedule.js";

/**
 * Loans live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/amortization/`, in `loans.json` and
 * `counter.json`. Nothing else is written anywhere: the journal this server produces is
 * handed back as a payload for the servers that own the ledger and the expense book, and
 * is never posted from here.
 *
 * NO SCHEDULE IS STORED. Only the terms are, and every row is derived on the call. A
 * stored schedule is a second copy of a figure that the terms already determine, and the
 * copy is the one that gets believed after somebody edits the rate.
 *
 * Reads go through the timezone engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker
 * beside it, and every later call fails loudly instead of reading a register that is
 * still on disk as "no loans" and reporting nothing outstanding.
 */

export interface Loan {
  /** `LOAN-<YYYY>-<NNNN>`, allocated per year of the start date. */
  id: string;
  name: string;
  lender?: string;
  kind: "loan" | "lease";
  principal_minor: number;
  currency: string;
  rate_bps: number;
  compounding: Frequency;
  payment_frequency: Frequency;
  term_periods: number;
  method: Method;
  start_date: string;
  fees_minor: number;
  balloon_minor: number;
  /** Derived once at creation and stored only so a list does not have to rebuild every schedule. */
  payment_minor: number;
  effective_annual_rate_bps: number;
  note?: string;
  /**
   * The journals already taken from this agreement, by their label ("period 3", "2026-04").
   * Set by `loan_journal` and by nothing else. It is the only dependency this server can
   * see: an entry that is already in somebody's ledger has terms behind it, so a loan
   * carrying one is refused by `loan_delete` rather than removed out from under it.
   */
  journalled?: string[];
  created: string;
  updated: string;
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "amortization");
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

export function getLoans(): Loan[] { return read<Loan[]>("loans.json", []); }
export function setLoans(v: Loan[]): void { write("loans.json", v); }

/**
 * Allocate the next loan id: `LOAN-<YYYY>-<NNNN>`.
 *
 * The counter is per year and is written BEFORE the loan is stored, so a crash burns an
 * id rather than reusing one. Ids already in the store are also scanned, so a restored or
 * hand-edited register cannot reissue a number that is already on a signed agreement.
 */
export function nextLoanId(year: string, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `LOAN-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

/**
 * Resolve a loan by exact id (case-insensitive), then by exact name, then -- only if
 * nothing exact matched -- by partial name. More than one partial candidate is refused
 * with the list rather than silently picking the first, so an early settlement cannot be
 * computed against the wrong agreement.
 */
export function findLoan(list: Loan[], ref: string): Loan | undefined {
  const needle = String(ref).trim().toLowerCase();
  const byId = list.find((a) => a.id.toLowerCase() === needle);
  if (byId) return byId;
  const exact = list.filter((a) => a.name.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((a) => a.name.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(`"${ref}" matches more than one loan: ${pool.map((a) => `${a.id} (${a.name})`).join(", ")}. Pass the exact id.`);
  }
  return pool[0];
}
