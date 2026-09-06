import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-timezone/lib";
import type { Method } from "./depreciation.js";
import type { SchemeId } from "./tables.js";

/**
 * Assets live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/asset-register/`. Nothing else is
 * written: the expense ledger belongs to servers/expense-tracker and this server never
 * reaches into it (see `asset_journal` and README.md for why).
 *
 * Reads go through the timezone engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker
 * beside it, and every later call fails loudly instead of treating a register that is
 * still on disk as "no assets" and depreciating nothing.
 */

export interface Disposal {
  date: string;
  proceeds_minor: number;
  accumulated_minor: number;
  nbv_minor: number;
  result_minor: number;
  result: "gain" | "loss" | "break-even";
  note?: string;
}

export interface Asset {
  /** `ASSET-<YYYY>-<NNNN>`, allocated per year of the in-service date. */
  id: string;
  name: string;
  scheme: SchemeId;
  category: string;
  category_name: string;
  cost_minor: number;
  currency: string;
  residual_minor: number;
  purchase_date: string;
  in_service_date: string;
  method: Method;
  life_years: number;
  life_source: string;
  rate_pct: number;
  declining_coefficient?: number;
  life_override?: number;
  rate_override?: number;
  project?: string;
  note?: string;
  disposal?: Disposal;
  /**
   * The months `asset_journal` has already produced a line for, as `YYYY-MM`, ascending.
   *
   * The journal writes nothing into the expense ledger, but it does leave this mark on
   * the register, because without it "has anything downstream been posted for this asset"
   * is unanswerable and `asset_delete` would have to either refuse everything or delete
   * the cost behind a figure that is already in someone's books.
   */
  journaled?: string[];
  created: string;
  updated: string;
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "asset-register");
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

export function getAssets(): Asset[] { return read<Asset[]>("assets.json", []); }
export function setAssets(v: Asset[]): void { write("assets.json", v); }

/**
 * Allocate the next asset id: `ASSET-<YYYY>-<NNNN>`.
 *
 * The counter is per year and is written BEFORE the asset is stored, so a crash burns an
 * id rather than reusing one. Ids already in the store are also scanned, so a restored or
 * hand-edited register cannot reissue a number that is already on a filed fixed asset
 * schedule.
 */
export function nextAssetId(year: string, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `ASSET-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

/**
 * Resolve an asset by exact id (case-insensitive), then by exact name, then -- only if
 * nothing exact matched -- by partial name. More than one partial candidate is refused
 * with the list rather than silently picking the first, so a disposal cannot be booked
 * against the wrong machine.
 */
export function findAsset(list: Asset[], ref: string): Asset | undefined {
  const needle = String(ref).trim().toLowerCase();
  const byId = list.find((a) => a.id.toLowerCase() === needle);
  if (byId) return byId;
  const exact = list.filter((a) => a.name.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((a) => a.name.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(
      `"${ref}" matches more than one asset: ${pool.map((a) => `${a.id} (${a.name})`).join(", ")}. Pass the exact id.`,
    );
  }
  return pool[0];
}
