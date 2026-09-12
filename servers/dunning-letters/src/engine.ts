/**
 * The dunning engine: dates, the escalation ladder, the aging buckets and the late fee.
 *
 * Everything here is pure. Dates are YYYY-MM-DD strings compared lexicographically (valid
 * for ISO dates) and differenced through UTC so no local timezone can move a deadline.
 * Amounts are integer minor units throughout; the only rounding is the late fee, which is
 * rounded once, to the minor unit, and says so where it is shown.
 */

export const MAX_MINOR = 1e14;
export const MAX_ROWS = 2000;
export const STAGES = [1, 2, 3] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_NAMES: Record<Stage, string> = {
  1: "reminder 1",
  2: "reminder 2",
  3: "final notice",
};
export const DEFAULT_GAPS: [number, number, number] = [7, 14, 21];

export interface Payment {
  id: string;
  date: string;
  amount_minor: number;
  note?: string;
  recorded: string;
}

export interface LetterSent {
  stage: Stage;
  sent: string;
  recorded: string;
}

export interface ChasedInvoice {
  id: string;
  client: string;
  reference: string;
  amount_minor: number;
  currency: string;
  due: string;
  issued?: string;
  note?: string;
  /** Days after the due date at which reminder 1, reminder 2 and the final notice fall due. */
  gaps: [number, number, number];
  late_fee_percent_per_month?: number;
  payments: Payment[];
  letters: LetterSent[];
  created: string;
  updated: string;
}

/* ------------------------------------------------------------------- dates */

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Today as YYYY-MM-DD in the machine's own timezone: the day the user means by "today". */
export function today(now: Date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function utc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `from` to `to`; positive when `to` is the later date. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/* ----------------------------------------------------------------- invoice */

export function paidMinor(inv: ChasedInvoice): number {
  return inv.payments.reduce((a, p) => a + p.amount_minor, 0);
}

/** What is still owed, in integer minor units. Never negative: an overpayment floors at 0. */
export function outstandingMinor(inv: ChasedInvoice): number {
  return Math.max(0, inv.amount_minor - paidMinor(inv));
}

export function isPaid(inv: ChasedInvoice): boolean {
  return paidMinor(inv) >= inv.amount_minor;
}

/** Days past the due date on `on`; 0 while the invoice is not yet due. */
export function daysLate(inv: ChasedInvoice, on: string): number {
  return Math.max(0, daysBetween(inv.due, on));
}

/** The date each stage falls due: due + gaps[stage - 1]. */
export function stageDates(inv: ChasedInvoice): [string, string, string] {
  return [addDays(inv.due, inv.gaps[0]), addDays(inv.due, inv.gaps[1]), addDays(inv.due, inv.gaps[2])];
}

export function stagesSent(inv: ChasedInvoice): Set<Stage> {
  return new Set(inv.letters.map((l) => l.stage));
}

export interface NextAction {
  stage: Stage;
  stage_name: string;
  /** The date this stage falls due: due + gaps[stage - 1]. */
  date: string;
  /** True when `on` is on or after `date`: the letter should go out now. */
  due: boolean;
  /** Days from `on` until the stage falls due; 0 when it is already due. */
  days_until: number;
  /** Days the letter has been waiting past its due date; 0 when not yet due. */
  days_overdue: number;
}

/**
 * The next letter to send. The ladder is sequential: a later stage can never leapfrog an
 * unsent earlier one, so an invoice 60 days late with no letters sent is still owed
 * reminder 1, not the final notice. Returns null when all three letters have been sent.
 */
export function nextAction(inv: ChasedInvoice, on: string): NextAction | null {
  const sent = stagesSent(inv);
  const dates = stageDates(inv);
  for (const s of STAGES) {
    if (sent.has(s)) continue;
    const date = dates[s - 1];
    return {
      stage: s,
      stage_name: STAGE_NAMES[s],
      date,
      due: on >= date,
      days_until: Math.max(0, daysBetween(on, date)),
      days_overdue: Math.max(0, daysBetween(date, on)),
    };
  }
  return null;
}

/**
 * Late payment interest accrued on the outstanding amount from the due date to `on`,
 * pro-rata on a 30-day month, rounded once to the minor unit. 0 when no rate was
 * registered or the invoice is not yet late. This is simple interest, not compounding.
 */
export function accruedFeeMinor(inv: ChasedInvoice, on: string): number {
  const rate = inv.late_fee_percent_per_month;
  if (!rate || rate <= 0) return 0;
  const late = daysLate(inv, on);
  if (late <= 0) return 0;
  return Math.round(outstandingMinor(inv) * (rate / 100) * (late / 30));
}

/* ------------------------------------------------------------------- aging */

export const BUCKETS = ["current", "1-30", "31-60", "61-90", "91+"] as const;
export type Bucket = (typeof BUCKETS)[number];

export function bucketFor(late: number): Bucket {
  if (late <= 0) return "current";
  if (late <= 30) return "1-30";
  if (late <= 60) return "31-60";
  if (late <= 90) return "61-90";
  return "91+";
}

/** The duplicate key: a byte-identical re-registration of the same invoice. */
export function invoiceKey(d: {
  client: string; reference: string; amount_minor: number; currency: string; due: string;
}): string {
  return [d.client.trim().toLowerCase(), d.reference.trim().toLowerCase(), d.amount_minor, d.currency, d.due].join("|");
}
