/**
 * Money is handled in integer minor units here, exactly as in servers/expense-tracker
 * and servers/invoice: the three servers exchange amounts, so a currency that is
 * 3-decimal in one and 2-decimal in another silently rescales money by 10x.
 *
 * The MINOR_UNITS table below is kept byte-identical with
 * servers/expense-tracker/src/money.ts and servers/invoice/src/money.ts.
 */

// A Map, not an object literal: a currency string of "constructor" must miss, not return a function.
const MINOR_UNITS = new Map<string, number>(Object.entries({
  // 0 decimals
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, MGA: 0,
  PYG: 0, RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  // 3 decimals
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  // 4 decimals
  CLF: 4, UYW: 4,
}));

export function currencyDecimals(currency: string): number {
  const d = MINOR_UNITS.get(currency.toUpperCase());
  return d === undefined ? 2 : d;
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

/** Integer minor units to a bare number: 1234 minor EUR -> 12.34. */
export function toMajor(minor: number, currency: string): number {
  const d = currencyDecimals(currency);
  return d === 0 ? minor : Number((minor / Math.pow(10, d)).toFixed(d));
}

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isoToday(): string { return new Date().toISOString().slice(0, 10); }

export function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * The cross rate at full double precision: toPerEur / fromPerEur, no intermediate
 * rounding. This is the number every conversion multiplies by. Rounding the rate
 * first and multiplying afterwards loses the small currencies: at 6 decimals
 * 0.35 KWD / 30000 VND per EUR becomes 0.000012, and 1,000,000 VND then converts to
 * KWD 12.000 instead of KWD 11.667 - a 2.9% error on real money.
 */
export function exactCrossRate(fromPerEur: number, toPerEur: number): number {
  return toPerEur / fromPerEur;
}

/**
 * The same rate rounded to 6 decimals, for display only. It is never used to compute
 * a result, so the answer reports it next to the exact rate and says which one the
 * arithmetic used; a rate quoted to 6 decimals that does not reproduce the printed
 * result is stated as a display value rather than passed off as the multiplier.
 */
export function crossRate(fromPerEur: number, toPerEur: number): number {
  return Number(exactCrossRate(fromPerEur, toPerEur).toFixed(6));
}
