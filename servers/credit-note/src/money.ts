/**
 * Money is handled in integer minor units (cents) everywhere inside this server.
 *
 * Rounding contract (asserted in test/unit.test.mjs):
 *  1. The unit price enters as integer minor units, so there is nothing to round on
 *     input. The line gross is quantity x unit price, rounded half-up once:
 *       gross_i = roundHalfUp(quantity_i * unit_price_minor_i)
 *     A whole quantity is exact (6 x 10420 = 62520); a fractional one (2.5 hours)
 *     lands on the nearest minor unit.
 *  2. Tax is computed per line and rounded per line: tax_i = roundHalfUp(gross_i * rate_i / 100).
 *  3. The line total is gross + tax; the note totals are plain integer sums of the
 *     already-rounded line values, so the printed lines always reproduce the total.
 * "Round per line, then sum" means a total can never drift from the printed lines by
 * more than the rounding already visible on those lines.
 */

/**
 * ISO 4217 minor units. Anything not listed uses 2 decimals.
 * HUF and ISK: ISO 4217 gives HUF 2 minor digits (it is only *quoted* without
 * them) and ISK 0, so HUF is deliberately absent from the zero list.
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

/** Half-up rounding that is stable against binary floating point representation error. */
export function roundHalfUp(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  return sign * Math.floor(abs + 0.5 + 1e-9);
}

/** Render integer minor units as "EUR 1080.00" / "JPY 1080". */
export function formatMoney(minor: number, currency: string): string {
  const code = currency.toUpperCase();
  const d = currencyDecimals(code);
  const f = Math.pow(10, d);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  if (d === 0) return `${code} ${sign}${abs}`;
  const whole = Math.floor(abs / f);
  const frac = String(abs % f).padStart(d, "0");
  return `${code} ${sign}${whole}.${frac}`;
}

/** Render minor units without the currency code, for table columns. */
export function formatAmount(minor: number, currency: string): string {
  return formatMoney(minor, currency).slice(currency.length + 1);
}

/** Render a quantity without trailing zeros: 2.5 stays "2.5", 6 becomes "6". */
export function formatQuantity(q: number): string {
  return String(Math.round(q * 1e6) / 1e6);
}

/** Render a tax rate: 23 stays "23%", 7.5 stays "7.5%". */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 1e4) / 1e4}%`;
}
