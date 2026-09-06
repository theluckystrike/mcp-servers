import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-timezone/lib";
import type { RateCard, Sku, UsageRow } from "./catalogue.js";

/**
 * The catalogue lives in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/catalogue/`, in `skus.json`,
 * `rates.json`, `register.json`, `counter.json` and `pdf/`. Nothing else is written
 * anywhere: `lines_resolve` hands back `invoice_create` and `quote_create` arguments and
 * creates neither document, so no invoice and no quote is ever written from here.
 *
 * NO PRICE IS DERIVED AND STORED. A SKU record holds its price ROWS, each with the day it
 * came into force; the price on a date is worked out on the call. A stored "current price"
 * is a second copy of what the rows already decide, and the copy is the one that is still
 * being quoted a month after the rise.
 *
 * Reads go through the timezone engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker
 * beside it, and every later call fails loudly instead of reading a priced catalogue as
 * an empty one and resolving nothing.
 */

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "catalogue");
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

export function getSkus(): Sku[] { return read<Sku[]>("skus.json", []); }
export function setSkus(v: Sku[]): void { write("skus.json", v); }

export function getRates(): RateCard[] { return read<RateCard[]>("rates.json", []); }
export function setRates(v: RateCard[]): void { write("rates.json", v); }

export function getRegister(): UsageRow[] { return read<UsageRow[]>("register.json", []); }
export function setRegister(v: UsageRow[]): void { write("register.json", v); }

/**
 * Allocate the next id in the `RES-<YYYY>-<NNNN>` resolution series.
 *
 * The counter is written BEFORE the register row, so a crash burns a number rather than
 * reusing one: two resolutions with one id would put one customer's prices under another
 * customer's reference.
 */
export function nextResolutionId(year: string): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `RES-${year}`;
  const n = (counters[key] ?? 0) + 1;
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

/**
 * Resolve a SKU by exact code, then by exact name, then -- only if nothing exact matched
 * -- by partial name. More than one partial candidate is refused with the list rather than
 * silently picking the first, so a line cannot be priced off the wrong product.
 */
export function findSku(list: Sku[], ref: string): Sku | undefined {
  const needle = String(ref).trim().toLowerCase();
  const byCode = list.find((s) => s.sku.toLowerCase() === needle);
  if (byCode) return byCode;
  const exact = list.filter((s) => s.name.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((s) => s.name.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(`"${ref}" matches more than one SKU: ${pool.map((s) => `${s.sku} (${s.name})`).join(", ")}. Pass the exact code.`);
  }
  return pool[0];
}

export function resolveSku(list: Sku[], ref: string): Sku {
  if (!list.length) throw new Error("the catalogue is empty. Run sku_set with a code, a name, a unit and a price before resolving anything.");
  const s = findSku(list, ref);
  if (!s) {
    throw new Error(
      `no SKU matches "${ref}". Nothing was priced and no price was invented for it. ` +
      `Run sku_list to see the codes, or sku_set to add it.`,
    );
  }
  return s;
}

export function findRate(list: RateCard[], role: string): RateCard | undefined {
  const needle = String(role).trim().toLowerCase();
  return list.find((c) => c.role === needle) ?? list.find((c) => c.role.includes(needle));
}

export function resolveRate(list: RateCard[], role: string): RateCard {
  const c = findRate(list, role);
  if (!c) {
    throw new Error(
      `no rate card matches "${role}". Nothing was priced and no hourly rate was invented for it. ` +
      `Run rate_set {role, currency, hourly_minor, valid_from} first.`,
    );
  }
  return c;
}
