import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-timezone/lib";
import { normaliseReference, type ChangeOrder } from "./order.js";

/**
 * Change orders live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/change-order/`, in `change-orders.json`
 * and `counter.json`. Nothing else is written anywhere.
 *
 * NO SIBLING STORE IS READ. The quote or work order a change order refers to is named by
 * its id and its original value is stated once per reference here; this server does not
 * open the quotes store or the work-order store to find it. Both of those servers'
 * `dataDir()` CREATE their directory as a side effect of a read, and a change order that
 * refused to exist until its reference could be found on this machine would refuse every
 * quote that was raised on another one. `change_order_invoice_payload` returns
 * `invoice_create` and `quote_create` arguments; it creates neither document.
 *
 * NO DELTA IS STORED. A record holds its lines and its status history; the delta, the
 * running contract value and the VAT are derived on every call. A stored total is a
 * second copy of what the lines already decide, and the copy is the one that gets
 * believed after somebody edits a line.
 *
 * Reads go through the timezone engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker
 * beside it, and every later call fails loudly instead of reading a file that is still on
 * disk as "no change orders" and reporting the original contract value as current.
 */

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "change-order");
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

export function getOrders(): ChangeOrder[] { return read<ChangeOrder[]>("change-orders.json", []); }
export function setOrders(v: ChangeOrder[]): void { write("change-orders.json", v); }

/**
 * Allocate the next id in the `CO-<YYYY>-<NNNN>` series.
 *
 * The counter is per year and is written BEFORE the record is stored, so a crash burns a
 * number rather than reusing one. Ids already in the store are also scanned, so a restored
 * or hand-edited store cannot reissue a number that is already on a document a client
 * signed.
 */
export function nextId(year: string, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `CO-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

/** Allocate the next line id within one change order. Line ids never repeat inside one. */
export function nextLineId(o: ChangeOrder): string {
  let n = o.lines.length;
  const used = new Set(o.lines.map((l) => l.id));
  let id: string;
  do { n += 1; id = `L${String(n).padStart(2, "0")}`; } while (used.has(id));
  return id;
}

/** Every change order against one reference, oldest first. */
export function byReference(list: ChangeOrder[], reference: string): ChangeOrder[] {
  const ref = normaliseReference(reference);
  return list.filter((o) => o.reference === ref).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/**
 * Resolve a change order by exact id (case-insensitive), then by exact title, then --
 * only if nothing exact matched -- by partial title. More than one partial candidate is
 * refused with the list rather than silently picking the first, so a line cannot be
 * booked to the wrong change order.
 */
export function findOrder(list: ChangeOrder[], ref: string): ChangeOrder | undefined {
  const needle = String(ref).trim().toLowerCase();
  const byId = list.find((o) => o.id.toLowerCase() === needle);
  if (byId) return byId;
  const exact = list.filter((o) => o.title.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((o) => o.title.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(`"${ref}" matches more than one change order: ${pool.map((o) => `${o.id} (${o.title}, ${o.status})`).join(", ")}. Pass the exact id.`);
  }
  return pool[0];
}

export function resolveOrder(list: ChangeOrder[], ref: string): ChangeOrder {
  if (!list.length) throw new Error("there is no change order yet. Run change_order_create with a reference, a client, a title and the original contract value.");
  const o = findOrder(list, ref);
  if (!o) throw new Error(`no change order matches "${ref}". Ids look like CO-2026-0001. Run change_order_list to see them.`);
  return o;
}
