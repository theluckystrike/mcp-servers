import {
  computeTotals, currencyDecimals, roundHalfUp, type InputItem, type Totals,
} from "@theluckystrike/mcp-invoice/lib";

/**
 * The catalogue engine: the record shapes, the valid-from ladder and the two payload
 * shapes the sibling servers take.
 *
 * Nothing here reads a file, a licence or the network, so every figure below is
 * reproducible from its arguments alone and the unit suite recomputes each one by hand.
 *
 * THE TWO SIBLING SERVERS TAKE THE SAME LINE IN DIFFERENT UNITS. `invoice_create`'s item
 * carries `unit_price` in MAJOR units (servers/invoice/src/index.ts: "Price per unit in
 * major units, e.g. 90 for 90 EUR"); `quote_create`'s item carries `unit_price_minor` in
 * MINOR units ("9000 = 90.00 EUR, 90 = JPY 90. Never a decimal"). A catalogue that stored
 * one number and emitted the same field into both would price a EUR line 100x wrong in
 * one of them, and 1000x wrong in a 3-decimal currency such as KWD. So the catalogue
 * stores MINOR units, which is the only lossless form, and the two payload builders below
 * are the only place the scale is applied.
 *
 * A stored price is a whole number of minor units, so `invoice_create`'s own
 * `computeTotals` rounds it straight back to the same integer: `rounding_drift_minor` on
 * a resolution is zero by construction, and the unit suite asserts it.
 */

export const MAX_MINOR = 1e12;
export const MAX_QUANTITY = 1_000_000;
export const MAX_HOURS = 100_000;
export const MAX_ROWS = 500;
export const MAX_PRICE_ROWS = 100;
export const MAX_RATE_ROWS = 100;
export const MAX_LINES = 200;
export const MAX_VAT = 1000;

/** The tier every price row sits in unless a Pro key names another one. */
export const DEFAULT_TIER = "standard";

/** SKU codes are a filing system, not prose: upper case, and no spaces to mistype. */
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{0,63}$/;
export const ROLE_PATTERN = /^[a-z0-9][a-z0-9._/ -]{0,63}$/;

export interface PriceRow {
  currency: string;
  tier: string;
  valid_from: string;
  amount_minor: number;
  created: string;
}

export interface Sku {
  sku: string;
  name: string;
  unit: string;
  vat_rate: number | null;
  prices: PriceRow[];
  note?: string;
  created: string;
  updated: string;
}

export interface RateRow {
  currency: string;
  valid_from: string;
  hourly_minor: number;
  created: string;
}

export interface RateCard {
  role: string;
  sku: string | null;
  rates: RateRow[];
  note?: string;
  created: string;
  updated: string;
}

/**
 * One row per SKU or role that a resolution has ever priced a customer line from.
 *
 * The register is what makes `sku_delete` safe to leave free: a code that has priced a
 * line is a fact about a document somebody sent, so it is refused BY NAME with the times
 * it was used and the last resolution id, rather than deleted and then missing from the
 * next reconciliation. Bounded by the size of the catalogue, not by traffic: a hundredth
 * resolution of one SKU updates its row, it does not add one.
 */
export interface UsageRow {
  kind: "sku" | "role";
  ref: string;
  times: number;
  first_used: string;
  last_used: string;
  last_resolution: string;
}

export type Normalised = { sku: string } | { role: string };

export const normaliseSku = (s: string): string => String(s).trim().toUpperCase().replace(/\s+/g, "");
export const normaliseRole = (s: string): string => String(s).trim().toLowerCase().replace(/\s+/g, " ");
export const normaliseText = (s: string): string => String(s).trim().replace(/\s+/g, " ");
export const normaliseTier = (s: string | undefined): string => (s === undefined ? DEFAULT_TIER : normaliseText(s).toLowerCase());
export const normaliseCurrency = (s: string): string => String(s).trim().toUpperCase();

/** The key a price row is unique on. An update replaces the row that carries this key. */
export const rowKey = (currency: string, tier: string, validFrom: string): string =>
  `${normaliseCurrency(currency)}|${normaliseTier(tier)}|${validFrom}`;

export const priceRowKey = (r: PriceRow): string => rowKey(r.currency, r.tier, r.valid_from);
export const rateRowKey = (r: RateRow): string => `${normaliseCurrency(r.currency)}|${r.valid_from}`;

/** Rows read oldest first, so "the latest valid_from at or before the date" is the last match. */
export const sortRows = <T extends { currency: string; tier?: string; valid_from: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) =>
    a.currency.localeCompare(b.currency) ||
    (a.tier ?? "").localeCompare(b.tier ?? "") ||
    a.valid_from.localeCompare(b.valid_from));

/**
 * The price row in force for a currency and tier ON a date: the latest `valid_from` at or
 * before it. A date before every row has no price, and that is refused rather than filled
 * with the earliest row, because a price that did not exist yet is not a price.
 */
export function priceAsOf(s: Sku, currency: string, tier: string, date: string): PriceRow | null {
  const cur = normaliseCurrency(currency);
  const t = normaliseTier(tier);
  const candidates = s.prices.filter((r) => r.currency === cur && r.tier === t && r.valid_from <= date);
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (b.valid_from > a.valid_from ? b : a));
}

/** The row that takes over from `row`, if a later one is already booked. */
export function supersededBy(s: Sku, row: PriceRow): PriceRow | null {
  const later = s.prices.filter((r) =>
    r.currency === row.currency && r.tier === row.tier && r.valid_from > row.valid_from);
  if (!later.length) return null;
  return later.reduce((a, b) => (b.valid_from < a.valid_from ? b : a));
}

export function rateAsOf(c: RateCard, currency: string, date: string): RateRow | null {
  const cur = normaliseCurrency(currency);
  const candidates = c.rates.filter((r) => r.currency === cur && r.valid_from <= date);
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (b.valid_from > a.valid_from ? b : a));
}

/** Every (currency, tier) pair a SKU carries a price in, in a stable order. */
export function pairsOf(s: Sku): { currency: string; tier: string }[] {
  const seen = new Map<string, { currency: string; tier: string }>();
  for (const r of s.prices) seen.set(`${r.currency}|${r.tier}`, { currency: r.currency, tier: r.tier });
  return [...seen.values()].sort((a, b) => a.currency.localeCompare(b.currency) || a.tier.localeCompare(b.tier));
}

/**
 * The identity of a catalogue entry for duplicate refusal: the product, not its code.
 * Two codes carrying one name, one unit and one price row are one product filed twice far
 * more often than they are two products. Checked BEFORE the free cap, so the refusal names
 * the code already stored rather than selling an upgrade.
 */
export function productKey(name: string, unit: string, row: { currency: string; tier: string; amount_minor: number }): string {
  return JSON.stringify([
    normaliseText(name).toLowerCase(),
    normaliseText(unit).toLowerCase(),
    normaliseCurrency(row.currency),
    normaliseTier(row.tier),
    row.amount_minor,
  ]);
}

/* ------------------------------------------------------------------ resolution */

export type ResolvedKind = "sku" | "role";

export interface ResolvedLine {
  kind: ResolvedKind;
  ref: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price_minor: number;
  tax_rate: number;
  /** The row this price came from, named so a customer query lands on one line of one file. */
  from: { currency: string; tier: string; valid_from: string };
  value_minor: number;
}

/** What one resolved line is worth, on exactly the basis `computeTotals` will use. */
export const lineValueMinor = (l: { quantity: number; unit_price_minor: number }): number =>
  roundHalfUp(l.quantity * l.unit_price_minor);

/** Minor units as a plain major-unit decimal string. The invoice server takes majors. */
export function major(minor: number, currency: string): string {
  const d = currencyDecimals(currency);
  return (minor / 10 ** d).toFixed(d);
}

/**
 * `invoice_create` items. `unit_price` is in MAJOR units and is the catalogue price
 * expressed exactly, so `computeTotals` rounds it back to the same integer minor unit.
 */
export function invoiceItems(lines: ResolvedLine[], currency: string): InputItem[] {
  return lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit_price: Number(major(l.unit_price_minor, currency)),
    tax_rate: l.tax_rate,
  }));
}

/** `quote_create` items. The SAME price, in MINOR units, which is what that tool takes. */
export function quoteItems(lines: ResolvedLine[], currency: string): {
  description: string; quantity: number; unit_price_minor: number; tax_rate: number; currency: string;
}[] {
  return lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit_price_minor: l.unit_price_minor,
    tax_rate: l.tax_rate,
    currency,
  }));
}

/** The totals the invoice server will compute from those items. Same function, no copy. */
export function resolutionTotals(lines: ResolvedLine[], currency: string): Totals {
  return computeTotals(invoiceItems(lines, currency), currency, 0, 0);
}
