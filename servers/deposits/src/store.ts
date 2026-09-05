import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-invoice/lib";

/**
 * Deposits live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/deposits/`. The invoices a deposit is
 * applied to are read AND written through the shared engine
 * (@theluckystrike/mcp-invoice/lib), so the payment a deposit makes is the same payment
 * the invoice server's own invoice_mark_paid writes: `paid_minor`, `paid_date`, `status`.
 *
 * Two directories, two locks, always taken in the same order (deposits, then invoice),
 * the same order servers/billing-docs, servers/quotes and servers/recurring use, so no
 * two processes in this repo can deadlock.
 *
 * Reads go through the invoice engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker
 * beside it, and every later call fails loudly instead of treating a store that is still
 * on disk as "no deposits". Writes are tmp + rename.
 */

export interface Party {
  name: string;
  address?: string;
  email?: string;
  vat_id?: string;
}

/** What the money is being held for. Both are held; only the reason differs. */
export type DepositKind = "security" | "retainer";

/**
 * Derived, never asked for: `held` while any of the deposit is still held, otherwise
 * `applied` if any of it went to an invoice and `refunded` if it all went back.
 */
export type DepositStatus = "held" | "applied" | "refunded";

export interface DepositApplication {
  date: string;
  invoice_number: string;
  amount_minor: number;
  note?: string;
}

export interface DepositRefund {
  date: string;
  amount_minor: number;
  method: string;
  note?: string;
}

export interface Deposit {
  /** `DEP-<YYYY>-<NNNN>`, allocated per year. */
  id: string;
  client_id?: string;
  client: Party;
  /** Always POSITIVE, in minor units. What was received. */
  amount_minor: number;
  currency: string;
  decimals: number;
  kind: DepositKind;
  received_date: string;
  /** The bank reference, cheque number or transfer note the money arrived with. */
  reference?: string;
  notes?: string;
  applications: DepositApplication[];
  refunds: DepositRefund[];
  status: DepositStatus;
  created: string;
  updated: string;
  branded: boolean;
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "deposits");
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

export function getDeposits(): Deposit[] { return read<Deposit[]>("deposits.json", []); }
export function setDeposits(v: Deposit[]): void { write("deposits.json", v); }

/** Applied, refunded and still held, in minor units, from the movements themselves. */
export function movements(d: Deposit): { applied_minor: number; refunded_minor: number; held_minor: number } {
  const applied = d.applications.reduce((a, x) => a + x.amount_minor, 0);
  const refunded = d.refunds.reduce((a, x) => a + x.amount_minor, 0);
  return { applied_minor: applied, refunded_minor: refunded, held_minor: d.amount_minor - applied - refunded };
}

/**
 * The status is DERIVED from the movements every time one is written, never taken from
 * the caller. A stored status and a movement list that disagree is the class of bug that
 * makes a deposit look returned while the money is still on the books.
 */
export function statusOf(d: Deposit): DepositStatus {
  const m = movements(d);
  if (m.held_minor > 0) return "held";
  return m.applied_minor > 0 ? "applied" : "refunded";
}

/**
 * Allocate the next deposit id: `DEP-<YYYY>-<NNNN>`.
 *
 * The counter is per year and is written BEFORE the deposit is stored, so a crash burns
 * an id rather than reusing one. Ids already in the store are also scanned, so a restored
 * or hand-edited store can never hand back an id that is already on a receipt a client
 * has seen. The year is part of the id for the same reason it is part of `INV-YYYY-NNNN`
 * and `CN-YYYY-NNNN`: a bare `DEP-0001` reset every January collides with last January's.
 */
export function nextDepositId(year: string, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `DEP-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

/**
 * Resolve a deposit by exact id (case-insensitive), then by exact client name, then --
 * only if nothing exact matched -- by partial client name. More than one partial
 * candidate is refused with the list rather than silently picking the first, so
 * deposit_refund cannot pay back the wrong client's money.
 */
export function findDeposit(list: Deposit[], ref: string): Deposit | undefined {
  const needle = String(ref).trim().toLowerCase();
  const byId = list.find((d) => d.id.toLowerCase() === needle);
  if (byId) return byId;
  const exact = list.filter((d) => d.client.name.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((d) => d.client.name.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(
      `"${ref}" matches more than one deposit: ${pool.map((d) => `${d.id} (${d.client.name})`).join(", ")}. Pass the exact id.`,
    );
  }
  return pool[0];
}
