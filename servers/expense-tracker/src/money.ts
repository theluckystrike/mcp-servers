/**
 * Money is handled in integer minor units everywhere in this server.
 *
 * Contract (tested in test/money.test.mjs):
 *  1. An expense amount is the GROSS amount printed on the receipt, in minor units.
 *  2. vat_rate splits that gross into net and VAT: net = roundHalfUp(gross * 100 / (100 + rate)),
 *     vat = gross - net. The two parts always add back to the exact gross.
 *  3. Summaries sum already-rounded per-expense values, grouped by currency. Amounts in
 *     different currencies are never added together and never converted.
 *  4. Mileage money = roundHalfUp(distance * rate_major * 10^decimals) in the rate's currency.
 */

/** Zero-decimal currencies; everything else uses 2 decimals. */
const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

/** Half-up rounding, stable against binary floating point representation error. */
export function roundHalfUp(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  return sign * Math.floor(abs + 0.5 + 1e-9);
}

/** Major units (12.34 EUR) to integer minor units (1234). */
export function toMinor(amount: number, currency: string): number {
  return roundHalfUp(amount * Math.pow(10, currencyDecimals(currency)));
}

/** Integer minor units to "EUR 12.34" / "JPY 1234". */
export function formatMoney(minor: number, currency: string): string {
  const code = currency.toUpperCase();
  const d = currencyDecimals(code);
  const f = Math.pow(10, d);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  if (d === 0) return `${code} ${sign}${abs}`;
  return `${code} ${sign}${Math.floor(abs / f)}.${String(abs % f).padStart(d, "0")}`;
}

/** Bare number for a spreadsheet cell: 1234 minor EUR -> 12.34. */
export function toMajor(minor: number, currency: string): number {
  const d = currencyDecimals(currency);
  return d === 0 ? minor : Number((minor / Math.pow(10, d)).toFixed(d));
}

export interface VatSplit { gross_minor: number; net_minor: number; vat_minor: number; rate: number }

/**
 * Split a VAT-inclusive gross amount. rate 0 or undefined leaves the whole amount as net.
 * net + vat === gross by construction.
 */
export function vatSplit(grossMinor: number, rate: number | undefined): VatSplit {
  const r = typeof rate === "number" && Number.isFinite(rate) ? rate : 0;
  if (r === 0) return { gross_minor: grossMinor, net_minor: grossMinor, vat_minor: 0, rate: 0 };
  const net = roundHalfUp((grossMinor * 100) / (100 + r));
  return { gross_minor: grossMinor, net_minor: net, vat_minor: grossMinor - net, rate: r };
}

export interface MileageRate { region: string; unit: "km" | "mile"; rate: number; currency: string }

/**
 * Default mileage rates. Sources are the user's own jurisdiction defaults, not a tax ruling:
 * override any of them with rate_per_km on the call.
 */
export const MILEAGE_RATES: Record<string, MileageRate> = {
  PL: { region: "PL", unit: "km", rate: 1.15, currency: "PLN" },
  UK: { region: "UK", unit: "mile", rate: 0.45, currency: "GBP" },
  US: { region: "US", unit: "mile", rate: 0.70, currency: "USD" },
  EU: { region: "EU", unit: "km", rate: 0.30, currency: "EUR" },
};

/** Region defaults when none is given: miles -> US, km -> EU. */
export function defaultRegion(unit: "km" | "mile"): string {
  return unit === "mile" ? "US" : "EU";
}

export function mileageAmount(distance: number, rate: number, currency: string): number {
  return roundHalfUp(distance * rate * Math.pow(10, currencyDecimals(currency)));
}

export function isoToday(): string { return new Date().toISOString().slice(0, 10); }

/** True only for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** ISO date N days before today, UTC. */
export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
