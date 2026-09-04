/**
 * Money is handled in integer minor units everywhere in this server.
 *
 * A bank line is SIGNED: a debit is negative, a credit is positive. The sign is decided
 * once, at import, and never again, so a summary never has to guess whether "12.30" left
 * the account or arrived in it.
 *
 * The ISO 4217 minor-unit table below is kept byte-identical with
 * servers/expense-tracker/src/money.ts and servers/invoice/src/money.ts. The three servers
 * exchange amounts (reconcile_expenses reads the expense ledger directly), so a currency
 * that is 3-decimal in one and 2-decimal in another silently rescales money by 10x.
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

/** Major units (12.34 EUR) to integer minor units (1234). Sign is preserved. */
export function toMinor(amount: number, currency: string): number {
  return roundHalfUp(amount * Math.pow(10, currencyDecimals(currency)));
}

/** Integer minor units to "EUR 12.34" / "EUR -12.34" / "JPY 1234". */
export function formatMoney(minor: number, currency: string): string {
  const code = currency.toUpperCase();
  const d = currencyDecimals(code);
  const f = Math.pow(10, d);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  if (d === 0) return `${code} ${sign}${abs}`;
  return `${code} ${sign}${Math.floor(abs / f)}.${String(abs % f).padStart(d, "0")}`;
}

/** Bare number for a CSV cell: -1234 minor EUR -> -12.34. */
export function toMajor(minor: number, currency: string): number {
  const d = currencyDecimals(currency);
  return d === 0 ? minor : Number((minor / Math.pow(10, d)).toFixed(d));
}

/**
 * ISO 4217 active alphabetic codes. A three-letter string that is not on this list is a
 * typo or a made-up code; accepting it silently produces a ledger that can never be summed
 * against the real one, so the tools refuse it.
 */
const ISO_4217 = new Set([
  "AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN","BAM","BBD","BDT","BGN","BHD",
  "BIF","BMD","BND","BOB","BOV","BRL","BSD","BTN","BWP","BYN","BZD","CAD","CDF","CHE","CHF",
  "CHW","CLF","CLP","CNY","COP","COU","CRC","CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP",
  "ERN","ETB","EUR","FJD","FKP","GBP","GEL","GHS","GIP","GMD","GNF","GTQ","GYD","HKD","HNL",
  "HTG","HUF","IDR","ILS","INR","IQD","IRR","ISK","JMD","JOD","JPY","KES","KGS","KHR","KMF",
  "KPW","KRW","KWD","KYD","KZT","LAK","LBP","LKR","LRD","LSL","LYD","MAD","MDL","MGA","MKD",
  "MMK","MNT","MOP","MRU","MUR","MVR","MWK","MXN","MXV","MYR","MZN","NAD","NGN","NIO","NOK",
  "NPR","NZD","OMR","PAB","PEN","PGK","PHP","PKR","PLN","PYG","QAR","RON","RSD","RUB","RWF",
  "SAR","SBD","SCR","SDG","SEK","SGD","SHP","SLE","SOS","SRD","SSP","STN","SVC","SYP","SZL",
  "THB","TJS","TMT","TND","TOP","TRY","TTD","TWD","TZS","UAH","UGX","USD","USN","UYI","UYU",
  "UYW","UZS","VED","VES","VND","VUV","WST","XAF","XCD","XCG","XDR","XOF","XPF","XSU","XUA",
  "YER","ZAR","ZMW","ZWG",
]);

export function isKnownCurrency(code: string): boolean {
  return ISO_4217.has(code.toUpperCase());
}

/**
 * A category rule is matched as a regular expression, but an untrusted pattern can
 * backtrack forever: `(a+)+$` against 60 non-matching characters never returns and takes
 * the whole stdio server with it. A pattern is only compiled when it is short and has no
 * quantified group or class that itself contains a quantifier; anything else falls back to
 * a plain substring test, which is what most rules are anyway.
 * Kept in step with servers/expense-tracker/src/money.ts.
 */
const MAX_REGEX_SOURCE = 100;
const QUANTIFIED_GROUP_WITH_QUANTIFIER = /\((?:[^()\\]|\\.)*[*+?][^()]*\)\s*[*+{]/;
const QUANTIFIED_GROUP_WITH_ALTERNATION = /\((?:[^()\\]|\\.)*\|(?:[^()\\]|\\.)*\)\s*[*+{]/;

export function isSafeRegexSource(src: string): boolean {
  if (src.length > MAX_REGEX_SOURCE) return false;
  if (QUANTIFIED_GROUP_WITH_QUANTIFIER.test(src)) return false;
  if (QUANTIFIED_GROUP_WITH_ALTERNATION.test(src)) return false;
  try { new RegExp(src, "i"); return true; } catch { return false; }
}

/** Longest input the rule matcher will look at, so a 1 MB description cannot become the cost driver. */
export const MAX_MATCH_INPUT = 512;

/** A pattern with none of these is a plain substring and never needs the regex engine. */
export function hasRegexMetacharacters(src: string): boolean {
  return /[\\^$.|?*+()[\]{}]/.test(src);
}

/** The LOCAL calendar date, YYYY-MM-DD. Same shape as expense-tracker's localDay(). */
export function localDay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isoToday(): string { return localDay(); }

/** True only for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** ISO date N months before today, on the LOCAL calendar. */
export function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - months);
  return localDay(d);
}

/** Whole days between two ISO dates, a - b. */
export function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

/** ISO date N days after an ISO date. */
export function isoPlusDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
