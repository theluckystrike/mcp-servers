import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Bills of sale live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/bill-of-sale/`, in `sales.json` and
 * `counter.json`. Rendered documents default to a `documents/` subfolder. Nothing else is
 * written anywhere.
 *
 * A finalized document stays in the store as it was finalized: it is the local copy of a
 * record the buyer may already hold on paper. sale_delete removes even a finalized copy,
 * because the copy is not the sale, but the BOS number is never reissued, so a gap in the
 * series is the record that a document was deleted.
 */

export interface Party {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
}

export interface Identifiers {
  vin?: string;
  serial?: string;
  imei?: string;
  other?: string;
}

export interface Sale {
  id: string;                       // BOS-YYYY-NNNN
  status: "draft" | "final";
  seller: Party;
  buyer: Party;
  item: {
    description: string;
    category?: string;
    identifiers?: Identifiers;
    quantity: number;
    condition?: string;
  };
  price_minor: number;
  currency: string;
  date: string;                     // date of sale, YYYY-MM-DD
  as_is: boolean;
  warranty?: string;
  notes?: string;
  created: string;
  updated: string;
  finalized_on?: string;
}

/**
 * Create a directory and any missing ancestors, without mkdirSync's recursive mode.
 * mkdirSync(recursive) never returns on a pseudo-filesystem: a caller-supplied output path
 * under /proc, /sys or /dev reads as a missing parent and Node retries forever. Ancestors
 * are walked under a hard bound and each level created non-recursively, so a repeated
 * ENOENT terminates on the first one.
 */
export function ensureDirBounded(dir: string): void {
  if (existsSync(dir)) return;
  const missing: string[] = [];
  let cur = dir;
  for (let i = 0; i < 64 && !existsSync(cur); i++) {
    missing.push(cur);
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  if (!existsSync(cur)) throw new Error(`cannot create ${dir}: no existing ancestor directory`);
  for (const d of missing.reverse()) mkdirSync(d);
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "bill-of-sale");
  ensureDirBounded(dir);
  return dir;
}

export function lockPath(): string { return join(dataDir(), ".lock"); }

function read<T>(file: string, empty: T): T {
  const p = join(dataDir(), file);
  try {
    const raw = readFileSync(p, "utf8");
    return JSON.parse(raw) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty;
    // A store that is not JSON is quarantined byte-for-byte and every later call starts
    // from empty rather than reading half a document as "no sales".
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    try { renameSync(p, `${p}.corrupt-${stamp}`); } catch { /* best effort */ }
    return empty;
  }
}

/** Atomic: per-process temp name (pid + random), then rename over the target. */
function write(file: string, value: unknown): void {
  const p = join(dataDir(), file);
  const tmp = `${p}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(value, null, 2));
    renameSync(tmp, p);
  } catch (e) {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* best effort */ }
    throw e;
  }
}

export function getSales(): Sale[] { return read<Sale[]>("sales.json", []); }
export function setSales(v: Sale[]): void { write("sales.json", v); }

/**
 * Allocate the next id in the BOS series: `BOS-<YYYY>-<NNNN>`. The counter is written
 * BEFORE the record is stored, so a crash burns a number rather than reusing one. Ids
 * already in the store are also scanned, so a restored or hand-edited store cannot
 * reissue a number that is already written on a signed document.
 */
export function nextId(year: string, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `BOS-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

/** Resolve a sale by exact id, case-insensitive. There is no name lookup: ids are short. */
export function findSale(list: Sale[], ref: string): Sale {
  const needle = String(ref).trim().toLowerCase();
  const s = list.find((x) => x.id.toLowerCase() === needle);
  if (!s) {
    throw new Error(`no bill of sale has the id "${ref}". Ids look like BOS-2026-0003. Known: ${list.map((x) => x.id).join(", ") || "none"}. Nothing was written.`);
  }
  return s;
}
