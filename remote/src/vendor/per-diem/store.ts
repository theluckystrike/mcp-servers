import { mkdirSync, readFileSync, renameSync, writeFileSync } from "../../shims/fs.js";
import { homedir } from "../../shims/os.js";
import { join } from "node:path";
import { readJsonFile } from "../timezone/lib.js";
import type { CalcResult } from "./schemes.js";

/**
 * Trips live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/per-diem/`. Nothing else is written:
 * the expense ledger belongs to servers/expense-tracker and this server never reaches
 * into it (see `trip_export` and README.md for why).
 *
 * Reads go through the timezone engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker
 * beside it and every later call fails loudly instead of treating a store that is still
 * on disk as "no trips". Writes are tmp + rename.
 */

export interface Trip {
  /** `TRIP-<YYYY>-<NNNN>`, allocated per year of the start date. */
  id: string;
  name: string;
  traveller: string;
  traveller_source: "shared profile" | "call" | "unknown";
  purpose?: string;
  project?: string;
  calc: CalcResult;
  exported_at?: string;
  created: string;
  updated: string;
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "per-diem");
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

export function getTrips(): Trip[] { return read<Trip[]>("trips.json", []); }
export function setTrips(v: Trip[]): void { write("trips.json", v); }

/**
 * Allocate the next trip id: `TRIP-<YYYY>-<NNNN>`.
 *
 * The counter is per year and is written BEFORE the trip is stored, so a crash burns an
 * id rather than reusing one. Ids already in the store are also scanned, so a restored or
 * hand-edited store cannot reissue one that is already on a submitted claim.
 */
export function nextTripId(year: string, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `TRIP-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

/**
 * Resolve a trip by exact id (case-insensitive), then by exact name, then -- only if
 * nothing exact matched -- by partial name. More than one partial candidate is refused
 * with the list rather than silently picking the first, so an export cannot claim the
 * wrong trip.
 */
export function findTrip(list: Trip[], ref: string): Trip | undefined {
  const needle = String(ref).trim().toLowerCase();
  const byId = list.find((t) => t.id.toLowerCase() === needle);
  if (byId) return byId;
  const exact = list.filter((t) => t.name.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((t) => t.name.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(
      `"${ref}" matches more than one trip: ${pool.map((t) => `${t.id} (${t.name})`).join(", ")}. Pass the exact id.`,
    );
  }
  return pool[0];
}

/**
 * A row in servers/expense-tracker's own ledger, read-only. Only the fields this server
 * needs to NAME a dependent are typed; the owning server's shape is its own business.
 */
export interface ExpenseRow { id?: string; date?: string; note?: string; merchant?: string }

/**
 * D-P2. Read-only, best effort: the rows servers/expense-tracker holds in its ledger.
 *
 * `trip_export` writes nothing there, but a caller who ran the payload it handed back
 * leaves an expense whose note opens with the trip id (see the note builder in
 * `trip_export`). That row is a DEPENDENT: deleting the trip under it would leave a
 * booked expense citing an id that no longer resolves, and the per diem behind a filed
 * claim would be gone. So `trip_delete` looks, and refuses when it finds one.
 *
 * Same XDG data root, read-only, never written -- the pattern expense-tracker itself uses
 * for the bank ledger and kanban uses for time-tracker. A sibling store that is missing,
 * unreadable or not JSON is not this server's problem and is reported as absent rather
 * than thrown, because a deletion must not fail on someone else's broken file. Absence is
 * reported to the caller so "no dependents" is never confused with "did not look".
 */
export function readExpenseRows(): { present: boolean; rows: ExpenseRow[]; note?: string } {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const file = join(base, "mcp-servers", "expense-tracker", "data.json");
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return { present: false, rows: [], note: `no expense-tracker ledger at ${file}, so only this server's own export marker was checked` };
  }
  try {
    const db = JSON.parse(raw) as { expenses?: unknown };
    const rows = Array.isArray(db.expenses) ? (db.expenses as ExpenseRow[]) : [];
    return { present: true, rows };
  } catch {
    return { present: false, rows: [], note: `the expense-tracker ledger at ${file} is not readable JSON, so only this server's own export marker was checked` };
  }
}
