import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-timezone/lib";
import type { GoodsReceiptNote, PurchaseOrder, PoLine, GrnLine } from "./lib.js";

/**
 * Goods-receipt data lives in this server's OWN directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/goods-receipt/`, in `store.json`
 * (all POs and GRNs; POs are read-only history once every GRN against them is closed,
 * but keep both in one file so a report can reconcile received vs ordered in one place),
 * and `counter.json` for the PO- and GRN- series. Nothing else is written anywhere.
 *
 * The purchase-order store is read, never written from another server. Like the siblings,
 * `dataDir()` creates its directory as a side effect of a read, so a GRN can be raised
 * against a PO id on a machine that never saw that PO; the reference is a string that must
 * exist in THIS store (you create the PO here with `po_add`). No other store on the estate
 * is opened.
 *
 * Reads go through the timezone engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker beside
 * it, and every later call fails loudly instead of silently reading "no POs" and letting a
 * GRN be raised against a PO that was never ordered.
 *
 * Every mutation happens under `withFileLock(lockPath(), ...)` from mcp-license, so two
 * server processes receiving for the same PO reconcile a lock and neither drops a line.
 */

export interface Store {
  pos: PurchaseOrder[];
  grns: GoodsReceiptNote[];
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "goods-receipt");
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

export function getStore(): Store {
  return read<Store>("store.json", { pos: [], grns: [] });
}
export function setStore(v: Store): void { write("store.json", v); }

/**
 * Allocate the next id in a counter series. The counter is written BEFORE the record is
 * stored, so a crash burns a number rather than reusing one, and the ids already in the
 * store are scanned as well, so a restored or hand-edited store cannot reissue a number
 * that is already on a GRN somebody signed.
 */
export function nextId(key: string, pad: number, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(pad, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(pad, "0")}`;
}

export function nextPoId(existing: string[]): string { return nextId("PO", 4, existing); }
export function nextGrnId(existing: string[]): string { return nextId("GRN", 4, existing); }

export function findPo(list: PurchaseOrder[], ref: string): PurchaseOrder {
  const needle = ref.trim().toLowerCase();
  const byId = list.find((p) => p.id.toLowerCase() === needle);
  if (byId) return byId;
  const byRef = list.filter((p) => p.reference.toLowerCase() === needle);
  if (byRef.length === 1) return byRef[0];
  if (byRef.length > 1) {
    throw new Error(`"${ref}" matches more than one purchase order by reference: ${byRef.map((p) => p.id).join(", ")}. Pass the PO id.`);
  }
  throw new Error(`no purchase order matches "${ref}". Ids look like PO-0001. Run po_list to see them.`);
}

function findPoRaw(list: PurchaseOrder[], ref: string): PurchaseOrder | undefined {
  try { return findPo(list, ref); } catch { return undefined; }
}

export function findGrn(list: GoodsReceiptNote[], ref: string): GoodsReceiptNote {
  const needle = ref.trim().toLowerCase();
  const byId = list.find((g) => g.id.toLowerCase() === needle);
  if (byId) return byId;
  throw new Error(`no goods-receipt note matches "${ref}". Ids look like GRN-0001. Run grn_list to see them.`);
}

interface JoinRow {
  line: PoLine;
  ordered: number;
  received: number;
  damaged: number;
  shortage: number;
}
export interface ReportLine extends JoinRow {
  sku: string; description: string; open: number; discrepancy: boolean;
}

/**
 * Join every GRN line back to its PO line so received/damaged/shortage are reconciled
 * against ordered exactly once. Amounts are whole units; received may exceed ordered only
 * within the PO's over tolerance.
 */
export function reconcile(store: Store, po: PurchaseOrder): Record<string, JoinRow> {
  const out: Record<string, JoinRow> = {};
  for (const line of po.lines) {
    out[line.id] = { line, ordered: line.ordered, received: 0, damaged: 0, shortage: 0 };
  }
  for (const grn of store.grns) {
    if (grn.po !== po.id) continue;
    for (const gl of grn.lines) {
      const row = out[gl.line];
      if (!row) continue;
      row.received += gl.received;
      row.damaged += gl.damaged;
      if (gl.shortage) row.shortage += gl.shortage;
    }
  }
  return out;
}

export function reportLine(row: JoinRow): ReportLine {
  const open = Math.max(0, row.ordered - row.received);
  const discrepancy = row.damaged > 0 || row.shortage > 0 || row.received !== row.ordered;
  return { ...row, sku: row.line.sku, description: row.line.description, open, discrepancy };
}

/** Cumulative received for a line across every GRN against a PO. */
export function receivedForLine(store: Store, po: PurchaseOrder, lineId: string): number {
  let total = 0;
  for (const grn of store.grns) {
    if (grn.po !== po.id) continue;
    for (const gl of grn.lines) if (gl.line === lineId) total += gl.received;
  }
  return total;
}

export type { PurchaseOrder, PoLine, GoodsReceiptNote, GrnLine };