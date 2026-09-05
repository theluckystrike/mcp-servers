import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-invoice/lib";

/**
 * This server owns exactly two files, under
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/cash-book/`:
 *
 *  - `periods.json`, the register of the periods a ledger was built for, which is what
 *    the free tier is metered on;
 *  - `closes.json`, the months that were closed, each with the trial balance snapshot as
 *    it stood at the moment of closing.
 *
 * Nothing else is written anywhere. Every debit and every credit this server reports is
 * DERIVED, on the call, from books other servers own: the invoice ledger, the credit note
 * and purchase order store, the deposit store, the expense ledger, the bank import and
 * the fixed asset register. None of those is ever written back to, and no figure is ever
 * read back out of the two files above to compute a balance. A ledger that stores its own
 * copy of a balance has a second number to be wrong, and the second number is the one that
 * gets believed.
 *
 * The close snapshot is the one exception, and it is deliberately a SNAPSHOT and not a
 * source: it records what the trial balance said on the day the month was closed, so a
 * later change in a sibling store can be seen as a change rather than quietly becoming
 * the new truth. `month_close` compares the two and says so.
 *
 * Reads go through `readJsonFile` from `@theluckystrike/mcp-invoice/lib`, so a register
 * that is not JSON is quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a
 * `.corrupt` marker beside it. Writes are tmp + rename.
 */

/** One period a ledger was built for. The unit the free tier meters. */
export interface PeriodRecord {
  from: string;
  to: string;
  currency: string;
  /** Posted lines the build produced. */
  lines: number;
  debits_minor: number;
  credits_minor: number;
  /** debits - credits, zero on a ledger that balances. */
  imbalance_minor: number;
  /** The calendar month the period was first built, `YYYY-MM`. What the meter counts. */
  built_month: string;
  built: string;
  updated: string;
}

/** One closed month, with the trial balance as it stood at the close. */
export interface CloseRecord {
  /** `YYYY-MM`. */
  month: string;
  currency: string;
  closed: string;
  debits_minor: number;
  credits_minor: number;
  imbalance_minor: number;
  /** Account id to signed balance in minor units, debit positive. */
  balances: Record<string, number>;
  /** The exceptions that were open at the close, kept verbatim. */
  open_exceptions: string[];
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "cash-book");
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

export function getPeriods(): PeriodRecord[] { return read<PeriodRecord[]>("periods.json", []); }
export function setPeriods(v: PeriodRecord[]): void { write("periods.json", v); }
export function getCloses(): CloseRecord[] { return read<CloseRecord[]>("closes.json", []); }
export function setCloses(v: CloseRecord[]): void { write("closes.json", v); }

/**
 * The key a built period is identified by: one period is one date range in one currency.
 * Rebuilding the same range does not allocate a second row and is never metered again,
 * because the meter is on distinct periods and not on repeated questions about one.
 */
export function periodKey(from: string, to: string, currency: string): string {
  return `${from}|${to}|${currency.toUpperCase()}`;
}

export function findPeriod(list: PeriodRecord[], key: string): PeriodRecord | undefined {
  return list.find((p) => periodKey(p.from, p.to, p.currency) === key);
}

export function findClose(list: CloseRecord[], month: string, currency: string): CloseRecord | undefined {
  return list.find((c) => c.month === month && c.currency.toUpperCase() === currency.toUpperCase());
}
