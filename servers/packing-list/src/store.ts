import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-timezone/lib";
import { referenceKey, type PackingList } from "./packing.js";

/**
 * Packing lists live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/packing-list/`, in `packing-lists.json`
 * and `counter.json`. Nothing else is written anywhere.
 *
 * NO SIBLING STORE IS READ. The order a shipment ships against is named by its id, and what
 * that order said should ship is DECLARED here with `packing_expect`. The quotes, work-order
 * and invoice stores are not opened: each of those servers' `dataDir()` creates its directory
 * as a side effect of a read, and a packing list that refused to exist until its order could
 * be found on this machine would refuse every order raised on another one. The one file this
 * server reads and never writes is the shared business profile, for the name at the top of
 * the slip.
 *
 * NOTHING DERIVED IS STORED. A record holds its cartons, its expected lines and its packed
 * lines; the net, gross, volumetric and chargeable weights and the shortfall are computed on
 * every call. See src/packing.ts for why.
 *
 * Reads go through the timezone engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker beside
 * it, and every later call fails loudly instead of reading a file that is still on disk as
 * "no packing lists" and letting a second slip be raised for goods that already shipped.
 */

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "packing-list");
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

export function getLists(): PackingList[] { return read<PackingList[]>("packing-lists.json", []); }
export function setLists(v: PackingList[]): void { write("packing-lists.json", v); }

/**
 * Allocate the next id in the `PL-<YYYY>-<NNNN>` series.
 *
 * The counter is per year and is written BEFORE the record is stored, so a crash burns a
 * number rather than reusing one. Ids already in the store are also scanned, so a restored
 * or hand-edited store cannot reissue a number that is already on a slip inside a box.
 */
export function nextId(year: string, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `PL-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

/** Allocate the next id in a per-record series (C01, L01, E01). Ids never repeat in a record. */
export function nextSeq(prefix: string, used: string[]): string {
  const taken = new Set(used);
  let n = used.length;
  let id: string;
  do { n += 1; id = `${prefix}${String(n).padStart(2, "0")}`; } while (taken.has(id));
  return id;
}

/** Every packing list against one order reference, oldest first. */
export function byReference(list: PackingList[], reference: string): PackingList[] {
  const ref = referenceKey(reference);
  return list.filter((p) => referenceKey(p.reference) === ref)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/**
 * Resolve a packing list by exact id (case-insensitive), then by exact order reference, then
 * -- only if nothing exact matched -- by partial reference or consignee. More than one
 * candidate is refused with the list rather than silently picking the first, so a carton
 * cannot be packed into the wrong shipment.
 */
export function findList(list: PackingList[], ref: string): PackingList | undefined {
  const needle = String(ref).trim().toLowerCase();
  const byId = list.find((p) => p.id.toLowerCase() === needle);
  if (byId) return byId;
  const exact = list.filter((p) => referenceKey(p.reference) === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((p) => referenceKey(p.reference).includes(needle) || p.consignee.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(`"${ref}" matches more than one packing list: ${pool.map((p) => `${p.id} (${p.reference}, ${p.consignee}, ${p.status})`).join(", ")}. Pass the exact id.`);
  }
  return pool[0];
}

export function resolveList(list: PackingList[], ref: string): PackingList {
  if (!list.length) throw new Error("there is no packing list yet. Run packing_list_create with the order reference and the consignee.");
  const p = findList(list, ref);
  if (!p) throw new Error(`no packing list matches "${ref}". Ids look like PL-2026-0001. Run packing_list_list to see them.`);
  return p;
}
