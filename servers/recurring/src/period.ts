/**
 * Period arithmetic for recurring schedules.
 *
 * Every date here is a LOCAL ISO calendar date, YYYY-MM-DD, the same basis the invoice
 * server stores issue dates on. Nothing in this file uses a clock; all functions are
 * pure, so the tests in test/period.test.mjs pin the whole contract.
 *
 * Documented rules:
 *  1. An occurrence is the k-th step from start_date, k = 0, 1, 2, ...  Occurrence 0 is
 *     start_date itself (after anchoring, see 4), so a schedule starting today is due
 *     today.
 *  2. weekly = +7k days. {days:n} = +n*k days. monthly = +k months, quarterly = +3k
 *     months, yearly = +12k months.
 *  3. MONTH ENDS: the month step keeps the ANCHOR day-of-month of start_date and clamps
 *     it to the length of the target month; it never carries the clamp forward. From
 *     2026-01-31 the monthly series is 01-31, 02-28, 03-31, 04-30, 05-31 -- February
 *     does not turn the schedule into a 28th-of-the-month schedule. The same rule makes
 *     a yearly schedule starting 2028-02-29 fall on 02-28 in common years and back on
 *     02-29 in the next leap year.
 *  4. anchor_day (Pro) replaces the day-of-month before clamping: anchor_day 1 bills on
 *     the 1st, anchor_day 31 bills on the last day of every month. end_of_month (Pro)
 *     forces the last day of the target month. Both are ignored for weekly and {days:n},
 *     which have no month to anchor to.
 *  5. end_date is INCLUSIVE: an occurrence that lands exactly on end_date is generated.
 *     Occurrences strictly before start_date (possible only when anchoring moves the
 *     first one back) are dropped.
 */

export type EveryFixed = "weekly" | "monthly" | "quarterly" | "yearly";
export type Every = EveryFixed | { days: number };

export interface PeriodRule {
  every: Every;
  start_date: string;
  end_date?: string;
  anchor_day?: number;
  end_of_month?: boolean;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

/** Days in month `m` (1-12) of year `y`, proleptic Gregorian. */
export function daysInMonth(y: number, m: number): number {
  return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

function parts(iso: string): [number, number, number] {
  const m = ISO.exec(iso);
  if (!m) throw new Error(`not an ISO date: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function fmt(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Add whole days to an ISO date. UTC arithmetic, so no DST hour can shift the day. */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  const dt = new Date(t);
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * Add whole months, keeping `anchorDay` and clamping to the target month's length
 * (rule 3). `endOfMonth` overrides the anchor with the last day of the target month.
 */
export function addMonthsIso(iso: string, months: number, anchorDay?: number, endOfMonth?: boolean): string {
  const [y, m, d] = parts(iso);
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12 + 12) % 12 + 1;
  const len = daysInMonth(ny, nm);
  const want = endOfMonth ? len : (anchorDay ?? d);
  return fmt(ny, nm, Math.min(want, len));
}

function stepMonths(every: Every): number | null {
  if (every === "monthly") return 1;
  if (every === "quarterly") return 3;
  if (every === "yearly") return 12;
  return null;
}

/** The k-th occurrence of a rule, k = 0, 1, 2, ... */
export function occurrence(rule: PeriodRule, k: number): string {
  const months = stepMonths(rule.every);
  if (months !== null) {
    return addMonthsIso(rule.start_date, months * k, rule.anchor_day, rule.end_of_month);
  }
  const days = rule.every === "weekly" ? 7 : (rule.every as { days: number }).days;
  return addDaysIso(rule.start_date, days * k);
}

/** Hard stop so a malformed rule can never spin forever. */
export const MAX_OCCURRENCES = 5000;

/**
 * A k that is at or a little before the k whose occurrence date reaches `target`, so a
 * bounded forward scan from here (instead of from k=0) reaches `target` in a handful of
 * steps no matter how long the schedule has been running. Day-stepped rules (`weekly`,
 * `{days:n}`) are exactly linear in k, so the estimate is exact minus a 1-step safety
 * margin. Month-stepped rules (`monthly`/`quarterly`/`yearly`) are linear in *months*
 * but the day-of-month clamp (rule 3) can shift a given k's date by less than one full
 * step, so the estimate uses a 2-step safety margin instead of 1.
 */
function estimateStartK(rule: PeriodRule, target: string): number {
  const months = stepMonths(rule.every);
  if (months !== null) {
    const [sy, sm] = parts(rule.start_date);
    const [ty, tm] = parts(target);
    const startTotal = sy * 12 + (sm - 1);
    const targetTotal = ty * 12 + (tm - 1);
    const kFloor = Math.floor((targetTotal - startTotal) / months);
    return Math.max(0, kFloor - 2);
  }
  const days = rule.every === "weekly" ? 7 : (rule.every as { days: number }).days;
  const [sy, smo, sd] = parts(rule.start_date);
  const [ty, tmo, td] = parts(target);
  const diffDays = (Date.UTC(ty, tmo - 1, td) - Date.UTC(sy, smo - 1, sd)) / 86400000;
  const kFloor = Math.floor(diffDays / days);
  return Math.max(0, kFloor - 1);
}

/**
 * Every occurrence in [from, to], both inclusive, clipped by start_date and end_date
 * (end_date inclusive, rule 5). `from` defaults to start_date.
 *
 * The scan starts at `estimateStartK(rule, lower)` rather than k=0: a schedule that has
 * been running for decades can have far more than MAX_OCCURRENCES occurrences before
 * `lower`, and scanning from the beginning would exhaust the per-run cap before ever
 * reaching the requested window. The per-run cap on occurrences examined is unchanged.
 */
export function occurrencesBetween(rule: PeriodRule, to: string, from?: string): string[] {
  const lower = from && from > rule.start_date ? from : rule.start_date;
  const upper = rule.end_date && rule.end_date < to ? rule.end_date : to;
  const out: string[] = [];
  if (upper < lower) return out;
  const startK = estimateStartK(rule, lower);
  let scanned = 0;
  for (let k = startK; scanned < MAX_OCCURRENCES; k++, scanned++) {
    const d = occurrence(rule, k);
    if (d > upper) break;
    if (d < rule.start_date) continue;   // anchoring moved the first one back
    if (d >= lower) out.push(d);
  }
  return out;
}

/**
 * The first occurrence strictly after `after`, or null once the schedule has ended.
 * Like occurrencesBetween, the scan starts near `after` (via estimateStartK) instead of
 * at k=0 so a long-lived schedule still resolves within the per-run cap.
 */
export function nextOccurrence(rule: PeriodRule, after: string): string | null {
  const startK = estimateStartK(rule, after);
  let scanned = 0;
  for (let k = startK; scanned < MAX_OCCURRENCES; k++, scanned++) {
    const d = occurrence(rule, k);
    if (d < rule.start_date) continue;
    if (d > after) return rule.end_date && d > rule.end_date ? null : d;
  }
  return null;
}

/** Human label for a cadence, used in tables and in the schedule record. */
export function everyLabel(every: Every): string {
  return typeof every === "string" ? every : `every ${every.days} day${every.days === 1 ? "" : "s"}`;
}
