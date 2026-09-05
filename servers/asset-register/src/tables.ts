import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The rate tables are BUNDLED JSON, read from disk once at first use and never fetched.
 * There is no network call anywhere in this server. A depreciation rate ends up on a tax
 * return: a figure that changed under the user between two runs of the same register is
 * worse than one that is visibly stale, because the stale one is checkable against the
 * file the build shipped and the moving one is not.
 *
 * Every table carries a `header` naming the authority, the instrument, the source URL,
 * the date the rates took effect and the date they were read, and `asset_rates` returns
 * that header with the rates, so the provenance travels with the number.
 *
 * A value that could not be stated with confidence from the public text is OMITTED, and
 * the header's `coverage` field says what was left out and why. See README.md.
 */

export interface TableHeader {
  scheme: string;
  table: string;
  authority: string;
  instrument: string;
  source_url: string;
  effective_date: string;
  retrieved_date: string;
  currency: string;
  convention: Convention;
  coverage?: string;
  note?: string;
}

export type Convention = "pl-month-following" | "uk-full-period" | "us-half-year";

export interface RateRow {
  code: string;
  name_pl?: string;
  name_en: string;
  /** Annual straight-line or reducing-balance percentage. Absent on the MACRS rows, which are table-driven. */
  rate_pct?: number;
  group?: string;
  /** MACRS only: the published per-year percentages of cost, in order. */
  percentages?: number[];
  life_years?: number;
  method?: "straight-line" | "declining-balance";
  declining_pct?: number;
  declining_allowed?: boolean;
  convention?: string;
  aia_limit_gbp?: number;
  note?: string;
}

export interface Table {
  header: TableHeader;
  declining_coefficient_max?: number;
  rates: RateRow[];
}

const FILES = {
  "pl-kst": "pl-kst.json",
  "uk-capital-allowances": "uk-capital-allowances.json",
  "us-macrs": "us-macrs.json",
} as const;

export type TableId = keyof typeof FILES;
export type SchemeId = "pl" | "uk" | "us";

export const SCHEMES: SchemeId[] = ["pl", "uk", "us"];
export const TABLE_IDS = Object.keys(FILES) as TableId[];

const SCHEME_TABLE: Record<SchemeId, TableId> = {
  pl: "pl-kst",
  uk: "uk-capital-allowances",
  us: "us-macrs",
};

const cache = new Map<TableId, Table>();

export function table(id: TableId): Table {
  const hit = cache.get(id);
  if (hit) return hit;
  const path = fileURLToPath(new URL(`./tables/${FILES[id]}`, import.meta.url));
  const t = JSON.parse(readFileSync(path, "utf8")) as Table;
  cache.set(id, t);
  return t;
}

export function schemeTable(scheme: SchemeId): Table {
  return table(SCHEME_TABLE[scheme]);
}

export function tableIdFor(scheme: SchemeId): TableId {
  return SCHEME_TABLE[scheme];
}

/**
 * Resolve a category to a table row: exact code, then exact English or Polish name, then
 * a PREFIX of the name. Never a substring. `"land".includes("and")` is true, and a
 * substring fallback would silently price a piece of equipment at the land row's 0
 * percent and say nothing about it.
 */
export function findRate(scheme: SchemeId, category: string): RateRow | undefined {
  const rows = schemeTable(scheme).rates;
  const needle = String(category).trim().toLowerCase();
  if (!needle) return undefined;
  const exactCode = rows.find((r) => r.code.toLowerCase() === needle);
  if (exactCode) return exactCode;
  const exactName = rows.find(
    (r) => r.name_en.toLowerCase() === needle || (r.name_pl ?? "").toLowerCase() === needle,
  );
  if (exactName) return exactName;
  if (needle.length < 4) return undefined;
  const prefix = rows.filter(
    (r) => r.name_en.toLowerCase().startsWith(needle) || (r.name_pl ?? "").toLowerCase().startsWith(needle),
  );
  return prefix.length === 1 ? prefix[0] : undefined;
}

/**
 * ISO 4217 minor-unit counts for the currencies these tables name plus the common
 * zero-decimal ones. A wrong decimal count turns JPY 7,532 into JPY 75.32 in silence, so
 * the set is explicit rather than assumed.
 */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "CLP", "ISK", "VND", "XOF", "XAF", "XPF", "HUF"]);

export function currencyDecimals(code: string): number {
  return ZERO_DECIMAL.has(code.toUpperCase()) ? 0 : 2;
}

export function formatMoney(minor: number, code: string): string {
  const d = currencyDecimals(code);
  const neg = minor < 0;
  const abs = Math.abs(Math.round(minor));
  if (d === 0) return `${code} ${neg ? "-" : ""}${abs.toLocaleString("en-US")}`;
  const unit = Math.floor(abs / 10 ** d);
  const frac = String(abs % 10 ** d).padStart(d, "0");
  return `${code} ${neg ? "-" : ""}${unit.toLocaleString("en-US")}.${frac}`;
}
