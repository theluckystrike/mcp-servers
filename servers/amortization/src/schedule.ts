/**
 * The amortization engine: periodic rates, the level payment, the schedule, and what an
 * early settlement costs and saves.
 *
 * Everything here is integer minor units. A schedule is a chain of subtractions, so a
 * float cent that is half wrong in period 1 is a whole cent wrong by period 40 and the
 * closing balance never reaches zero. The rate arithmetic is the only place floats are
 * used, and every amount that leaves this module has been rounded exactly once.
 *
 * Nothing here touches the network, the filesystem or the licence store.
 */
import { allocate } from "@theluckystrike/mcp-asset-register/lib";

export type Method = "annuity" | "straight-principal";
export type Frequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "semiannual" | "annual";

/** Payments a year, per frequency. The only calendar assumption in the rate arithmetic. */
export const PERIODS_PER_YEAR: Record<Frequency, number> = {
  weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, semiannual: 2, annual: 1,
};
export const FREQUENCIES = Object.keys(PERIODS_PER_YEAR) as Frequency[];
export const METHODS: Method[] = ["annuity", "straight-principal"];

/** Ceilings. A term past these is a data-entry slip, not a loan. */
export const MAX_PERIODS = 600;
export const MAX_MINOR = 1e14;
export const MAX_RATE_BPS = 1_000_000;

export interface LoanTerms {
  principal_minor: number;
  currency: string;
  rate_bps: number;
  compounding: Frequency;
  payment_frequency: Frequency;
  term_periods: number;
  method: Method;
  start_date: string;
  fees_minor: number;
  balloon_minor: number;
  /**
   * Force the level payment instead of deriving it. Set only when the payment is already
   * fixed by an agreement and the TERM is the unknown, which is what an overpayment that
   * keeps the payment does.
   */
  level_payment_minor?: number;
}

export interface Row {
  period: number;
  date: string;
  opening_minor: number;
  payment_minor: number;
  interest_minor: number;
  principal_minor: number;
  closing_minor: number;
}

export interface Schedule {
  rows: Row[];
  payment_minor: number;
  total_payments_minor: number;
  total_interest_minor: number;
  final_payment_minor: number;
  notes: string[];
}

/* ------------------------------------------------------------------- rates */

/** The nominal annual rate as a decimal. 1200 basis points is 0.12. */
export function nominalRate(rate_bps: number): number { return rate_bps / 10000; }

/**
 * The effective annual rate: what a nominal rate actually costs once it is compounded.
 * A nominal 12 percent compounded monthly is 12.68 percent a year, and the 0.68 is the
 * whole reason the two numbers are quoted separately on a credit agreement.
 */
export function effectiveAnnualRate(rate_bps: number, compounding: Frequency): number {
  const m = PERIODS_PER_YEAR[compounding];
  const r = nominalRate(rate_bps);
  if (r === 0) return 0;
  return Math.pow(1 + r / m, m) - 1;
}

/**
 * The rate for ONE payment period, when interest compounds on a different clock from the
 * one the payments are on. The equivalent rate is taken through the effective annual rate
 * rather than by dividing the nominal rate by the number of payments: a quarterly payment
 * on a monthly-compounded loan is (1 + r/12)^3 - 1, not r/4, and the difference is real
 * money the borrower pays.
 */
export function periodicRate(rate_bps: number, compounding: Frequency, payment_frequency: Frequency): number {
  const m = PERIODS_PER_YEAR[compounding];
  const p = PERIODS_PER_YEAR[payment_frequency];
  const r = nominalRate(rate_bps);
  if (r === 0) return 0;
  if (m === p) return r / m;
  return Math.pow(1 + r / m, m / p) - 1;
}

/** Basis points, rounded to the nearest whole point, for reporting a computed rate. */
export function toBps(rate: number): number { return Math.round(rate * 10000); }

/**
 * The level payment of an annuity, in minor units, rounded once.
 * With a balloon B due at the end, only the present value of the principal that is
 * actually amortised is spread: (P - B*v^n) * i / (1 - v^n).
 */
export function annuityPayment(principal_minor: number, balloon_minor: number, i: number, n: number): number {
  if (n <= 0) throw new Error("a loan with no periods has no payment");
  if (i === 0) return Math.round((principal_minor - balloon_minor) / n);
  const v = Math.pow(1 + i, -n);
  return Math.round(((principal_minor - balloon_minor * v) * i) / (1 - v));
}

/* ---------------------------------------------------------------- calendar */

const DAYS: Partial<Record<Frequency, number>> = { weekly: 7, fortnightly: 14 };
const MONTHS: Partial<Record<Frequency, number>> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

/**
 * The date of payment k, counted from the start date.
 *
 * Month arithmetic clamps to the end of the target month, so a loan starting on the 31st
 * pays on the 30th in April and on the 31st again in May. Rolling forward instead would
 * silently move a payment into the next month and shift every date after it.
 */
export function paymentDate(start: string, freq: Frequency, k: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const days = DAYS[freq];
  if (days) return new Date(Date.UTC(y, m - 1, d + days * k)).toISOString().slice(0, 10);
  const step = MONTHS[freq]!;
  const total = (m - 1) + step * k;
  const ty = y + Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return `${String(ty).padStart(4, "0")}-${String(tm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/* --------------------------------------------------------------- schedules */

export function validateTerms(t: LoanTerms): void {
  if (!Number.isInteger(t.principal_minor) || t.principal_minor <= 0) {
    throw new Error(`principal must be a whole number of minor units above zero, got ${t.principal_minor}. A loan of nothing, or of a negative amount, is not a loan. Nothing was written.`);
  }
  if (t.principal_minor > MAX_MINOR) throw new Error(`principal ${t.principal_minor} is over the ${MAX_MINOR} minor unit ceiling. Nothing was written.`);
  if (!Number.isInteger(t.rate_bps) || t.rate_bps < 0) throw new Error(`rate must be whole basis points, zero or more, got ${t.rate_bps}. Nothing was written.`);
  if (t.rate_bps > MAX_RATE_BPS) throw new Error(`rate ${t.rate_bps} basis points is over the ${MAX_RATE_BPS} ceiling. Nothing was written.`);
  if (!Number.isInteger(t.term_periods) || t.term_periods < 1) {
    throw new Error(`term must be at least 1 period, got ${t.term_periods}. A term of zero periods has no payment date to put a payment on. Nothing was written.`);
  }
  if (t.term_periods > MAX_PERIODS) throw new Error(`term ${t.term_periods} is over the ${MAX_PERIODS} period ceiling. Nothing was written.`);
  if (!Number.isInteger(t.balloon_minor) || t.balloon_minor < 0) throw new Error(`balloon must be a whole number of minor units, zero or more, got ${t.balloon_minor}. Nothing was written.`);
  if (t.balloon_minor >= t.principal_minor) {
    throw new Error(`balloon ${t.balloon_minor} is not less than the principal ${t.principal_minor} minor units. A balloon that is the whole principal amortises nothing. Nothing was written.`);
  }
  if (!Number.isInteger(t.fees_minor) || t.fees_minor < 0) throw new Error(`fees must be a whole number of minor units, zero or more, got ${t.fees_minor}. Nothing was written.`);
  if (t.fees_minor >= t.principal_minor) throw new Error(`fees ${t.fees_minor} are not less than the principal ${t.principal_minor} minor units. Nothing was written.`);
}

/**
 * Build the schedule.
 *
 * The rule that decides every figure: THE PAYMENT NEVER VARIES and the LAST PERIOD
 * ABSORBS THE RESIDUAL. Rounding the interest of each period to the cent leaves the
 * closing balance a few minor units away from the balloon (or from zero) after forty
 * periods of chained subtraction, and there are only two places to put that difference:
 * the final payment, or the final period's interest-and-principal split. Putting it in
 * the payment changes the amount the borrower is contractually due to pay; putting it in
 * the split does not. So the final period's principal is exactly what is left to repay,
 * and its interest is the rest of the same level payment. The closing balance reaches the
 * balloon, or zero, EXACTLY, on every input.
 */
export function buildSchedule(t: LoanTerms): Schedule {
  validateTerms(t);
  const i = periodicRate(t.rate_bps, t.compounding, t.payment_frequency);
  const n = t.term_periods;
  const notes: string[] = [];
  const rows: Row[] = [];

  const level = t.method === "annuity" ? (t.level_payment_minor ?? annuityPayment(t.principal_minor, t.balloon_minor, i, n)) : 0;
  // Straight principal: equal principal every period, split so the parts sum to the base
  // EXACTLY (the asset register's own allocator, not a second copy of the rule).
  const parts = t.method === "straight-principal"
    ? allocate(t.principal_minor - t.balloon_minor, new Array(n).fill(1))
    : [];

  let balance = t.principal_minor;
  for (let k = 1; k <= n; k++) {
    const opening = balance;
    let interest: number;
    let principal: number;
    let payment: number;
    if (t.method === "straight-principal") {
      principal = k === n ? opening - t.balloon_minor : parts[k - 1];
      interest = Math.round(opening * i);
      payment = principal + interest;
    } else if (k < n) {
      interest = Math.round(opening * i);
      principal = level - interest;
      payment = level;
      if (principal < 0) {
        throw new Error(`the payment of ${level} minor units does not cover the interest of ${interest} in period ${k}: the balance would grow instead of amortising. Nothing was written.`);
      }
      if (principal === 0 && k === 1) {
        // A term long enough that the level payment IS the interest at the minor unit.
        // The rows are honest (nothing is repaid) and the final period repays the lot.
        notes.push(`At ${n} periods the level payment of ${level} minor units is the interest charge to the minor unit, so the early periods repay nothing and the balance is cleared by the final payment.`);
      }
      if (opening - principal < t.balloon_minor) {
        // The level payment is rounded once, and over a long schedule that half-unit
        // repeats: 360 periods of a payment rounded up clears the loan before the last
        // period falls due. The schedule then STOPS, on the period that clears it, rather
        // than running on into a negative balance charging negative interest. It ends
        // short and says so; it never reports a period the borrower does not owe.
        principal = opening - t.balloon_minor;
        payment = principal + interest;
        balance = t.balloon_minor;
        rows.push({ period: k, date: paymentDate(t.start_date, t.payment_frequency, k), opening_minor: opening, payment_minor: payment, interest_minor: interest, principal_minor: principal, closing_minor: balance });
        notes.push(`The schedule closes at period ${k} of ${n}: the level payment of ${level} minor units is the exact amount rounded to the minor unit, and repeated ${k} times it clears the balance before period ${n} falls due. The last payment is ${payment}.`);
        break;
      }
    } else {
      principal = opening - t.balloon_minor;
      interest = level - principal;
      payment = level;
      const natural = Math.round(opening * i);
      // The residual is absorbed only when it IS a residual: the drift from rounding the
      // interest of each period is at most about one minor unit a period, so anything
      // wider than the term itself is not drift, it is a final period that is genuinely
      // short (the balance clears before the last payment falls due). Then the payment is
      // the one that gives way, and the interest stays the interest actually charged.
      const drift = Math.max(2, n);
      if (interest < 0 || Math.abs(interest - natural) > drift) {
        interest = natural;
        payment = principal + interest;
        notes.push(`The final payment is ${payment} minor units rather than the level ${level}: what is left to repay is smaller than one full payment, so the last one is short. Absorbing the difference in the interest split instead would have made the interest negative.`);
      }
    }
    balance = opening - principal;
    rows.push({ period: k, date: paymentDate(t.start_date, t.payment_frequency, k), opening_minor: opening, payment_minor: payment, interest_minor: interest, principal_minor: principal, closing_minor: balance });
  }

  const total_payments_minor = rows.reduce((a, r) => a + r.payment_minor, 0);
  const total_interest_minor = rows.reduce((a, r) => a + r.interest_minor, 0);
  const last = rows[rows.length - 1];
  if (t.balloon_minor > 0) {
    notes.push(`A balloon of ${t.balloon_minor} minor units is due with the last payment and is NOT inside it: the closing balance of period ${last.period} is the balloon, and the borrower owes that on top of the ${last.payment_minor} shown.`);
  }
  return { rows, payment_minor: t.method === "annuity" ? level : rows[0].payment_minor, total_payments_minor, total_interest_minor, final_payment_minor: last.payment_minor, notes };
}

/** Identity every schedule must satisfy. Cheap enough to assert on every build. */
export function scheduleIsExact(t: LoanTerms, s: Schedule): boolean {
  const principalSum = s.rows.reduce((a, r) => a + r.principal_minor, 0);
  return s.rows[s.rows.length - 1].closing_minor === t.balloon_minor
    && principalSum === t.principal_minor - t.balloon_minor
    && s.rows.every((r) => r.payment_minor === r.interest_minor + r.principal_minor)
    && s.total_payments_minor === s.total_interest_minor + principalSum;
}

/* ------------------------------------------------------- early settlement */

export interface EarlyResult {
  as_of_period: number;
  outstanding_minor: number;
  interest_paid_minor: number;
  penalty_minor: number;
  settle_now_minor: number;
  interest_saved_minor: number;
  interest_saved_net_minor: number;
  remaining: Row[];
  cancelled: Row[];
  new_payment_minor?: number;
  new_term_periods?: number;
}

/**
 * What repaying early costs and saves, as of the END of period `p`.
 *
 * With no `extra_minor`, or with more than is left, this is a full settlement: everything
 * after period `p` is cancelled and the saving is the interest inside it. With a partial
 * `extra_minor` the remaining balance is re-amortised from period p+1, either keeping the
 * term and lowering the payment (the default) or keeping the payment and shortening the
 * term. The saving is stated BOTH gross and net of the penalty, because a penalty larger
 * than the interest saved makes early repayment a loss, and that case has to be visible.
 */
export function repayEarly(t: LoanTerms, s: Schedule, p: number, opts: { extra_minor?: number; penalty_minor?: number; keep_payment?: boolean } = {}): EarlyResult {
  if (!Number.isInteger(p) || p < 1) throw new Error(`as_of_period must be a whole period of 1 or more, got ${p}. Nothing was written.`);
  if (p > s.rows.length) {
    throw new Error(`as_of_period ${p} is past the end of a ${s.rows.length} period loan: there is nothing left to repay early. Nothing was written.`);
  }
  const penalty = opts.penalty_minor ?? 0;
  if (!Number.isInteger(penalty) || penalty < 0) throw new Error(`penalty must be a whole number of minor units, zero or more, got ${penalty}. Nothing was written.`);
  const outstanding = s.rows[p - 1].closing_minor;
  const interest_paid = s.rows.slice(0, p).reduce((a, r) => a + r.interest_minor, 0);
  const cancelled = s.rows.slice(p);
  const futureInterest = cancelled.reduce((a, r) => a + r.interest_minor, 0);

  const extra = opts.extra_minor;
  if (extra === undefined || extra >= outstanding) {
    return {
      as_of_period: p, outstanding_minor: outstanding, interest_paid_minor: interest_paid,
      penalty_minor: penalty, settle_now_minor: outstanding + penalty,
      interest_saved_minor: futureInterest, interest_saved_net_minor: futureInterest - penalty,
      remaining: [], cancelled,
    };
  }
  if (!Number.isInteger(extra) || extra <= 0) throw new Error(`extra must be a whole number of minor units above zero, got ${extra}. Nothing was written.`);
  const left = outstanding - extra;
  const i = periodicRate(t.rate_bps, t.compounding, t.payment_frequency);
  const remainingPeriods = s.rows.length - p;
  // A balloon survives a partial prepayment only if there is still more than the balloon
  // left to amortise; otherwise the prepayment has already covered it.
  const balloon = t.balloon_minor < left ? t.balloon_minor : 0;
  let term = remainingPeriods;
  if (opts.keep_payment && t.method === "annuity" && i > 0) {
    // Same payment, shorter term: n = -ln(1 - i*L/A) / ln(1+i), rounded up so the last
    // period is short rather than leaving a stub nobody billed.
    const a = s.payment_minor;
    const ratio = 1 - (i * (left - balloon)) / a;
    if (ratio <= 0) throw new Error(`the level payment of ${a} minor units does not cover the interest on ${left}: the term cannot be shortened. Nothing was written.`);
    term = Math.max(1, Math.ceil(-Math.log(ratio) / Math.log(1 + i)));
  }
  const sub = buildSchedule({
    ...t, principal_minor: left, term_periods: term, balloon_minor: balloon, fees_minor: 0,
    start_date: s.rows[p - 1].date,
    level_payment_minor: opts.keep_payment ? s.payment_minor : undefined,
  });
  const remaining = sub.rows.map((r) => ({ ...r, period: p + r.period, date: paymentDate(t.start_date, t.payment_frequency, p + r.period) }));
  const saved = futureInterest - sub.total_interest_minor;
  return {
    as_of_period: p, outstanding_minor: outstanding, interest_paid_minor: interest_paid,
    penalty_minor: penalty, settle_now_minor: extra + penalty,
    interest_saved_minor: saved, interest_saved_net_minor: saved - penalty,
    remaining, cancelled, new_payment_minor: sub.payment_minor, new_term_periods: term,
  };
}
