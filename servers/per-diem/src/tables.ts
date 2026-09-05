import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The rate tables are BUNDLED JSON, read from disk once at first use and never fetched.
 * There is no network call anywhere in this server: a per diem figure that changed under
 * the user between two runs of the same trip is worse than one that is visibly stale, and
 * a tax number has to be reproducible from the file the build shipped.
 *
 * Every table carries a `header` naming the authority, the instrument, the source URL, the
 * date the rates took effect and the date they were read. `perdiem_rates` returns that
 * header with the rates, so the provenance travels with the number.
 *
 * A value that could not be stated with confidence from public regulation text is OMITTED,
 * and the header's `coverage` field says what was left out and why. See README.md.
 */

export interface TableHeader {
  scheme: string;
  part: string;
  authority: string;
  instrument: string;
  source_url: string;
  effective_date: string;
  retrieved_date: string;
  currency: string;
  coverage?: string;
  bundled?: boolean;
  note?: string;
}

export interface Band { min_hours: number; amount_minor: number; meals_covered: number; label: string }

export interface RateRow {
  country: string;
  code?: string;
  currency?: string;
  locality?: string;
  diet_minor?: number;
  lodging_flat_minor?: number;
  transit_flat_minor?: number;
  bands?: Band[];
  late_evening_supplement_minor?: number;
  note?: string;
}

export interface FiscalYear {
  fiscal_year: string;
  from: string;
  to: string;
  lodging_cap_minor: number;
  mie_minor: number;
  meals: { breakfast_minor: number; lunch_minor: number; dinner_minor: number; incidentals_minor: number };
  first_last_day_minor: number;
}

export interface Table {
  header: TableHeader;
  rates: RateRow[];
  fiscal_years?: FiscalYear[];
  current_fiscal_year?: string;
}

const FILES = {
  "pl-domestic": "pl-domestic.json",
  "pl-foreign": "pl-foreign.json",
  "uk-domestic": "uk-domestic.json",
  "uk-overseas": "uk-overseas.json",
  "us-gsa": "us-gsa.json",
} as const;

export type TableId = keyof typeof FILES;

const cache = new Map<TableId, Table>();

export function table(id: TableId): Table {
  const hit = cache.get(id);
  if (hit) return hit;
  const path = fileURLToPath(new URL(`./tables/${FILES[id]}`, import.meta.url));
  const t = JSON.parse(readFileSync(path, "utf8")) as Table;
  cache.set(id, t);
  return t;
}

export const TABLE_IDS = Object.keys(FILES) as TableId[];

/**
 * ISO 4217 minor-unit counts, for the currencies these tables actually name. A currency
 * this server never emits is not listed: a wrong decimal count turns JPY 7,532 into
 * JPY 75.32 silently, so the map is small and only covers what is bundled.
 */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "CLP", "ISK", "VND", "XOF", "XAF", "XPF"]);
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
