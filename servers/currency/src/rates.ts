import { crossRate, currencyDecimals, exactCrossRate, formatMoney, roundHalfUp } from "./money.js";
import type { RateMap } from "./store.js";

export const BASE = "EUR";

/** ECB quotes everything against the euro, so EUR is 1 by definition and is never in the file. */
export function perEur(rates: RateMap, code: string): number | undefined {
  const c = code.toUpperCase();
  if (c === BASE) return 1;
  const v = Object.prototype.hasOwnProperty.call(rates, c) ? rates[c] : undefined;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

export function codesOf(rates: RateMap): string[] {
  return [BASE, ...Object.keys(rates)].sort();
}

export interface Conversion {
  from: string;
  to: string;
  rate: number;          // display only, 6 decimals, 1 from = rate to
  rate_exact: number;    // the multiplier actually used, full double precision
  amount: number;        // input, major units
  result_minor: number;  // rounded to the target's ISO 4217 minor units
  result: string;        // "PLN 393.71"
  result_number: number;
}

/**
 * Cross rate through the euro. Both legs come from one ECB day, and the ratio is formed
 * and multiplied at full precision: the only rounding in the whole path is the final one,
 * to the target currency's ISO 4217 minor units. Rounding the rate to 6 decimals first
 * destroys any pair whose rate is far from 1 - 1,000,000 VND is KWD 11.667, not KWD 12.000 -
 * so the 6-decimal rate is reported as a display value alongside the exact one, never used
 * as the multiplier.
 */
export function convertAmount(rates: RateMap, amount: number, from: string, to: string): Conversion | { error: string } {
  const f = from.toUpperCase(), t = to.toUpperCase();
  const fr = perEur(rates, f), tr = perEur(rates, t);
  if (fr === undefined) return { error: unknownCode(f, rates) };
  if (tr === undefined) return { error: unknownCode(t, rates) };
  const rate = exactCrossRate(fr, tr);
  // 1e308 * a rate overflows to Infinity, which formats as "JPY Infinity" and serialises
  // result_number as null. Refuse anything that cannot survive the multiplication as an exact
  // integer number of minor units, and say so, rather than emitting a non-number as money.
  if (!Number.isFinite(amount)) return { error: "amount must be a finite number." };
  const minor = roundHalfUp(amount * rate * Math.pow(10, currencyDecimals(t)));
  if (!Number.isFinite(minor) || Math.abs(minor) > Number.MAX_SAFE_INTEGER) {
    return { error: `that amount is too large to convert exactly (${amount} ${f} in ${t} exceeds what can be represented without losing minor units). The largest amount this handles is about ${Math.floor(Number.MAX_SAFE_INTEGER / (rate * Math.pow(10, currencyDecimals(t))))} ${f}.` };
  }
  return {
    from: f, to: t, rate: crossRate(fr, tr), rate_exact: rate, amount,
    result_minor: minor,
    result: formatMoney(minor, t),
    result_number: minor / Math.pow(10, currencyDecimals(t)),
  };
}

export function unknownCode(code: string, rates: RateMap): string {
  return `"${code}" is not in the ECB reference set. The ECB quotes ${codesOf(rates).length} currencies: ${codesOf(rates).join(", ")}.`;
}

/**
 * ECB publishes on TARGET business days only, so a Saturday, a Sunday, 1 January or
 * Good Friday has no rate at all. The convention every bank and tax authority uses is
 * the last published rate on or before the date asked for, and that is what this
 * returns; the caller is told which date it landed on.
 */
export interface Resolved { date: string; rates: RateMap; exact: boolean; asked: string }

export function resolveDate(days: Record<string, RateMap>, asked: string): Resolved | { error: string } {
  if (Object.prototype.hasOwnProperty.call(days, asked)) return { date: asked, rates: days[asked], exact: true, asked };
  const dates = Object.keys(days).sort();
  if (!dates.length) return { error: "the rate history cache is empty." };
  let lo = 0, hi = dates.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= asked) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  if (best < 0) {
    // Never quote 1999-01-04 as the start when the cache does not actually reach back that far:
    // a partial cache saying "before the first rate (2026-09-01). The series starts on 1999-01-04"
    // contradicts itself and hides the real cause.
    return {
      error: dates[0] === "1999-01-04"
        ? `${asked} is before the first ECB reference rate. The series starts on 1999-01-04.`
        : `${asked} is before the earliest rate in the local cache (${dates[0]}). The ECB series starts on 1999-01-04, so the cache is incomplete; run cache_status, and delete the cache to re-download it.`,
    };
  }
  return { date: dates[best], rates: days[dates[best]], exact: false, asked };
}

export interface SeriesPoint { date: string; rate: number }

export function series(days: Record<string, RateMap>, from: string, to: string, fromDate: string, toDate: string): SeriesPoint[] | { error: string } {
  const out: SeriesPoint[] = [];
  const f = from.toUpperCase(), t = to.toUpperCase();
  for (const d of Object.keys(days).sort()) {
    if (d < fromDate || d > toDate) continue;
    const fr = perEur(days[d], f), tr = perEur(days[d], t);
    if (fr === undefined || tr === undefined) continue;   // currency not quoted that day (a pre-euro legacy code)
    out.push({ date: d, rate: crossRate(fr, tr) });
  }
  if (!out.length) return { error: `no ECB rate for ${f}/${t} between ${fromDate} and ${toDate}.` };
  return out;
}

export function stats(points: SeriesPoint[]): { min: SeriesPoint; max: SeriesPoint; avg: number; first: SeriesPoint; last: SeriesPoint; change_pct: number } {
  let min = points[0], max = points[0], sum = 0;
  for (const p of points) {
    if (p.rate < min.rate) min = p;
    if (p.rate > max.rate) max = p;
    sum += p.rate;
  }
  const first = points[0], last = points[points.length - 1];
  return {
    min, max,
    avg: Number((sum / points.length).toFixed(6)),
    first, last,
    change_pct: Number((((last.rate - first.rate) / first.rate) * 100).toFixed(2)),
  };
}
