import {
  computeTotals, currencyDecimals, daysBetween, type InputItem, type Totals,
} from "@theluckystrike/mcp-invoice/lib";

/**
 * The delivery schedule engine: the record shapes, the status machine, the lateness
 * arithmetic and the milestone payload the sibling servers take.
 *
 * Nothing here reads a file, a licence or the network, so every figure below is
 * reproducible from its arguments alone and the unit suite recomputes each one by hand.
 *
 * LATE IS NOT A STATUS. It is a reading of a due date against a date the CALLER passes,
 * and it changes as that date moves. A stored "late" flag is a fact about the afternoon
 * somebody last ran the report, and it goes on being reported long after the deliverable
 * lands. So the four stored statuses are planned, in progress, delivered and accepted,
 * and `latenessOf` derives late, due today, not yet due, delivered on time and delivered
 * late from `as_of`. Every comparison is a lexicographic compare of two YYYY-MM-DD
 * strings and every day count is a difference of two UTC midnights, so the answer does
 * not move when the machine's timezone does.
 *
 * NO STATUS AND NO TOTAL IS STORED. A deliverable holds its due date, its value in minor
 * units and its dated status history; the current status, the delivered date, the
 * acceptance note, the lateness and every total are derived on the call. A stored status
 * is a second copy of what the history already decides, and the copy is the one that gets
 * believed after somebody corrects a date.
 *
 * THE TWO SIBLING SERVERS TAKE THE SAME MILESTONE IN DIFFERENT UNITS. `invoice_create`'s
 * item carries `unit_price` in MAJOR units; `quote_create`'s item carries
 * `unit_price_minor` in MINOR units. Neither tool can tell that the number it was handed
 * was scaled for the other one, and a 2-decimal currency is mispriced by exactly 100x
 * when they are swapped. So the store holds MINOR units, the only lossless form, and the
 * two payload builders below are the only place a scale is applied, each with its scale
 * printed against it.
 */

export const MAX_MINOR = 1e12;
export const MAX_DELIVERABLES = 200;
export const MAX_ROWS = 500;
export const MAX_VAT = 1000;

/** Later than any date a schedule can carry, so "as of now" is one call to `statusAsOf`. */
export const FAR_FUTURE = "9999-12-31";

export type Status = "planned" | "in_progress" | "delivered" | "accepted";

/** The four STORED statuses, in the order work moves through them. */
export const STATUSES: Status[] = ["planned", "in_progress", "delivered", "accepted"];

/** Open means the deliverable is still owed: planned and in progress. */
export const OPEN_STATUSES: Status[] = ["planned", "in_progress"];

/** Done means it has been handed over: delivered and accepted. */
export const DONE_STATUSES: Status[] = ["delivered", "accepted"];

/**
 * The legal moves. Work is planned, may be started, is delivered, and is then accepted.
 *
 * A deliverable is NOT accepted straight from planned or in progress: acceptance is the
 * client's answer to a handover, and a deliverable accepted on a day nothing was handed
 * over has no delivered date, so the milestone payload would bill for a delivery that has
 * no date on it. Nothing moves back: a delivery that is rejected is a new deliverable
 * with its own due date, so the record keeps both the miss and the fix.
 */
export const TRANSITIONS: Record<Status, Status[]> = {
  planned: ["in_progress", "delivered"],
  in_progress: ["delivered"],
  delivered: ["accepted"],
  accepted: [],
};

export type ReferenceKind = "quote" | "work_order" | "change_order";
export const REFERENCE_KINDS: ReferenceKind[] = ["quote", "work_order", "change_order"];

/** How a deliverable reads against a date. Derived on the call, never stored. */
export type Lateness = "not_yet_due" | "due_today" | "late" | "delivered_on_time" | "delivered_late";
export const LATENESS: Lateness[] = ["not_yet_due", "due_today", "late", "delivered_on_time", "delivered_late"];

export interface StatusEvent {
  from: Status;
  to: Status;
  date: string;
  note?: string;
  at: string;
}

export interface Deliverable {
  id: string;
  description: string;
  due_date: string;
  /** Net of VAT, in whole minor units. `null` means this deliverable is not separately priced. */
  value_minor: number | null;
  tax_rate: number | null;
  history: StatusEvent[];
  note?: string;
  created: string;
}

export interface Schedule {
  id: string;
  reference: string;
  reference_kind: ReferenceKind;
  /** The date on the quote, work order or change order itself. Nothing may predate it. */
  reference_date: string;
  client: string;
  title: string;
  currency: string;
  deliverables: Deliverable[];
  /**
   * The highest D number ever allocated on this schedule. It only goes up.
   *
   * It is NOT the deliverable count, which is what a first version used and which reissued
   * D04 to a new deliverable the moment the old D04 was deleted (D-DS1). A schedule
   * document, an email or a client's note pointing at "D04" would then have pointed at a
   * different piece of work, and nothing on the record would have said so. A gap in the D
   * series is the record that a deliverable was removed.
   */
  deliverable_counter: number;
  note?: string;
  created: string;
  updated: string;
}

/* ------------------------------------------------------------- normalising */

/** Collapse whitespace so one description is one line, not three. */
export const normaliseText = (s: string): string => String(s).trim().replace(/\s+/g, " ");
export const normaliseCurrency = (s: string): string => String(s).trim().toUpperCase();
/** A reference is an id from a sibling server: upper case, no spaces. */
export const normaliseReference = (s: string): string => String(s).trim().toUpperCase().replace(/\s+/g, "");

/** WO- is a work order, CO- a change order, anything else a quote. */
export function inferReferenceKind(reference: string): ReferenceKind {
  const r = normaliseReference(reference);
  if (/^WO-/.test(r)) return "work_order";
  if (/^CO-/.test(r)) return "change_order";
  return "quote";
}

export const kindLabel = (k: ReferenceKind): string => k.replace("_", " ");
export const statusLabel = (s: Status): string => s.replace("_", " ");

/* ------------------------------------------------------------------ status */

/**
 * The status of a deliverable AS AT a date: the last dated move at or before it, or
 * planned when nothing has happened yet.
 *
 * The history is written in date order (a move dated before the last one is refused), so
 * this reads it straight through. It does not break early, so a store somebody hand-edited
 * out of order still yields the last move that had happened by `asOf` rather than the
 * first one that had not.
 */
export function statusAsOf(d: Deliverable, asOf: string): Status {
  let s: Status = "planned";
  for (const e of d.history) if (e.date <= asOf) s = e.to;
  return s;
}

/** The status now: the same function, read at a date later than any schedule can carry. */
export const currentStatus = (d: Deliverable): Status => statusAsOf(d, FAR_FUTURE);

/** The first move into a status that had happened by `asOf`, or null. */
export function reachedAt(d: Deliverable, s: Status, asOf: string = FAR_FUTURE): StatusEvent | null {
  return d.history.find((e) => e.to === s && e.date <= asOf) ?? null;
}

export const isOpenDeliverable = (d: Deliverable, asOf: string = FAR_FUTURE): boolean =>
  OPEN_STATUSES.includes(statusAsOf(d, asOf));

/** Why a move from `from` to `to` is refused, or null when it is legal. */
export function transitionError(from: Status, to: Status): string | null {
  if (from === to) return `is already ${statusLabel(from)}`;
  if (from === "accepted") {
    return "is accepted, which is final. Acceptance is a fact about what the client signed off; work that has to be done again is a new deliverable with its own due date, so the record keeps both the miss and the fix";
  }
  if (!TRANSITIONS[from].includes(to)) {
    if (to === "accepted") {
      return `is ${statusLabel(from)} and has not been delivered. Acceptance is the client's answer to a handover, so record the delivery first (with the day it was handed over), then the acceptance`;
    }
    if (DONE_STATUSES.includes(from) && OPEN_STATUSES.includes(to)) {
      return `is ${statusLabel(from)}, and work that has been handed over does not go back to ${statusLabel(to)}. A delivery the client sent back is a new deliverable with its own due date`;
    }
    return `is ${statusLabel(from)}, and from there it can only go to ${TRANSITIONS[from].map(statusLabel).join(" or ")}, not ${statusLabel(to)}`;
  }
  return null;
}

/* ---------------------------------------------------------------- lateness */

export interface DeliverableView {
  id: string;
  description: string;
  due_date: string;
  status: Status;
  state: Lateness;
  days_late: number;
  delivered_date: string | null;
  accepted_date: string | null;
  acceptance_note: string | null;
  value_minor: number | null;
  tax_rate: number | null;
  note: string | null;
}

/**
 * How one deliverable reads as at `asOf`.
 *
 * Not yet delivered by that date: late once `asOf` is PAST the due date, due today on the
 * due date itself, not yet due before it. Due today is not late, which is the same rule
 * the statement server ages an invoice by, so a deliverable and an invoice due on one day
 * never disagree about whether that day has run out.
 *
 * Delivered by that date: on time or late by comparing the DELIVERED date with the due
 * date, which is a fact that no longer moves with `asOf`. `days_late` is the size of the
 * miss in both cases, and is zero whenever nothing was missed.
 */
export function latenessOf(d: Deliverable, asOf: string): { state: Lateness; days_late: number } {
  const done = reachedAt(d, "delivered", asOf) ?? reachedAt(d, "accepted", asOf);
  if (done) {
    const late = done.date > d.due_date;
    return { state: late ? "delivered_late" : "delivered_on_time", days_late: late ? daysBetween(d.due_date, done.date) : 0 };
  }
  if (d.due_date < asOf) return { state: "late", days_late: daysBetween(d.due_date, asOf) };
  if (d.due_date === asOf) return { state: "due_today", days_late: 0 };
  return { state: "not_yet_due", days_late: 0 };
}

export function viewOf(d: Deliverable, asOf: string): DeliverableView {
  const { state, days_late } = latenessOf(d, asOf);
  const del = reachedAt(d, "delivered", asOf);
  const acc = reachedAt(d, "accepted", asOf);
  return {
    id: d.id,
    description: d.description,
    due_date: d.due_date,
    status: statusAsOf(d, asOf),
    state,
    days_late,
    delivered_date: del ? del.date : null,
    accepted_date: acc ? acc.date : null,
    acceptance_note: acc ? acc.note ?? null : null,
    value_minor: d.value_minor,
    tax_rate: d.tax_rate,
    note: d.note ?? null,
  };
}

/** True when a deliverable is owed and the day it was owed for has passed. */
export const isLate = (d: Deliverable, asOf: string): boolean => latenessOf(d, asOf).state === "late";

/* -------------------------------------------------------------- completion */

/**
 * A schedule is COMPLETE when it carries at least one deliverable and every one of them
 * has been accepted. An empty schedule is not complete: it is a schedule nobody has
 * filled in yet. Completion is what the free cap counts down, so finishing a job gives a
 * slot back without deleting the record of it.
 */
export function isComplete(s: Schedule, asOf: string = FAR_FUTURE): boolean {
  return s.deliverables.length > 0 && s.deliverables.every((d) => statusAsOf(d, asOf) === "accepted");
}

export const isOpenSchedule = (s: Schedule, asOf: string = FAR_FUTURE): boolean => !isComplete(s, asOf);

export interface Counts {
  deliverables: number;
  planned: number;
  in_progress: number;
  delivered: number;
  accepted: number;
  late: number;
  due_today: number;
  not_yet_due: number;
  delivered_late: number;
  delivered_on_time: number;
}

export function countsOf(list: Deliverable[], asOf: string): Counts {
  const c: Counts = {
    deliverables: list.length,
    planned: 0, in_progress: 0, delivered: 0, accepted: 0,
    late: 0, due_today: 0, not_yet_due: 0, delivered_late: 0, delivered_on_time: 0,
  };
  for (const d of list) {
    c[statusAsOf(d, asOf)] += 1;
    c[latenessOf(d, asOf).state] += 1;
  }
  return c;
}

/* ------------------------------------------------------------------- money */

/** Minor units as a plain major-unit decimal string. The invoice server takes majors. */
export function major(minor: number, currency: string): string {
  const d = currencyDecimals(currency);
  return (minor / 10 ** d).toFixed(d);
}

/**
 * The value of a set of deliverables, in MINOR units, and the ones that carry no price.
 *
 * A deliverable with no `value_minor` is not worth zero: it is a deliverable whose price
 * was never stated here, usually because the job is a lump sum. Adding it in as zero
 * would understate the milestone and nobody would see it happen, so it is counted apart
 * and reported by name wherever a total is printed.
 */
export function valueOf(list: Deliverable[]): { value_minor: number; priced: number; unpriced: number } {
  let value = 0;
  let priced = 0;
  let unpriced = 0;
  for (const d of list) {
    if (typeof d.value_minor === "number") { value += d.value_minor; priced += 1; }
    else unpriced += 1;
  }
  return { value_minor: value, priced, unpriced };
}

export interface MilestoneItem {
  deliverable: string;
  description: string;
  quantity: number;
  unit_price_minor: number;
  tax_rate: number;
  delivered_date: string;
  accepted_date: string;
  value_minor: number;
}

/**
 * The delivered-and-accepted deliverables as billable items, one item each.
 *
 * The description carries the two dates and NOTHING that looks like a price. A minor-unit
 * figure written into a description lands on the customer's invoice beside a unit price
 * printed in MAJOR units, which is the 100x seam written into their own document; every
 * amount this server prints for a human goes through `formatMoney` instead.
 */
export function milestoneItems(list: Deliverable[], asOf: string, fallbackTaxRate: number): MilestoneItem[] {
  const out: MilestoneItem[] = [];
  for (const d of list) {
    const acc = reachedAt(d, "accepted", asOf);
    const del = reachedAt(d, "delivered", asOf);
    if (!acc || !del || typeof d.value_minor !== "number") continue;
    out.push({
      deliverable: d.id,
      description: `${d.description} (delivered ${del.date}, accepted ${acc.date})`,
      quantity: 1,
      unit_price_minor: d.value_minor,
      tax_rate: d.tax_rate ?? fallbackTaxRate,
      delivered_date: del.date,
      accepted_date: acc.date,
      value_minor: d.value_minor,
    });
  }
  return out;
}

/**
 * `invoice_create` items. `unit_price` is in MAJOR units and is the stored minor figure
 * expressed exactly, so `computeTotals` rounds it back to the same integer minor unit.
 */
export function invoiceItems(items: MilestoneItem[], currency: string): InputItem[] {
  return items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unit_price: Number(major(i.unit_price_minor, currency)),
    tax_rate: i.tax_rate,
  }));
}

/** `quote_create` items. The SAME lines, in MINOR units, which is what that tool takes. */
export function quoteItems(items: MilestoneItem[], currency: string): {
  description: string; quantity: number; unit_price_minor: number; tax_rate: number; currency: string;
}[] {
  return items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unit_price_minor: i.unit_price_minor,
    tax_rate: i.tax_rate,
    currency,
  }));
}

/** The totals the invoice server will compute from those items. Same function, no copy. */
export function milestoneTotals(items: MilestoneItem[], currency: string): Totals {
  return computeTotals(invoiceItems(items, currency), currency, 0, 0);
}

/* ------------------------------------------------------------------ report */

export interface LateRow extends DeliverableView {
  schedule: string;
  reference: string;
  reference_kind: ReferenceKind;
  client: string;
  currency: string;
}

export function rowsOf(s: Schedule, asOf: string): LateRow[] {
  return s.deliverables.map((d) => ({
    schedule: s.id,
    reference: s.reference,
    reference_kind: s.reference_kind,
    client: s.client,
    currency: s.currency,
    ...viewOf(d, asOf),
  }));
}

/** Worst first: the longest miss, then the earliest due date, then the id. */
export function byWorst(a: LateRow, b: LateRow): number {
  return b.days_late - a.days_late || a.due_date.localeCompare(b.due_date) || a.schedule.localeCompare(b.schedule) || a.id.localeCompare(b.id);
}

export interface CurrencyTotal {
  currency: string;
  deliverables: number;
  priced: number;
  unpriced: number;
  value_minor: number;
}

/**
 * Value at risk, per currency and never across them. This server holds no exchange rate,
 * so one late deliverable priced in EUR and one in PLN have no common total; a single
 * figure over both would be a number nobody could reproduce.
 */
export function totalsByCurrency(rows: LateRow[]): CurrencyTotal[] {
  const map = new Map<string, CurrencyTotal>();
  for (const r of rows) {
    const t = map.get(r.currency) ?? { currency: r.currency, deliverables: 0, priced: 0, unpriced: 0, value_minor: 0 };
    t.deliverables += 1;
    if (typeof r.value_minor === "number") { t.priced += 1; t.value_minor += r.value_minor; }
    else t.unpriced += 1;
    map.set(r.currency, t);
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/* -------------------------------------------------------------- duplicates */

/**
 * The identity of a deliverable for duplicate refusal: what somebody types when they add
 * one. The same description due on the same day on one schedule is one deliverable
 * entered twice far more often than it is two, and two of them make every late report
 * double-count the miss.
 */
export function deliverableKey(d: { description: string; due_date: string }): string {
  return JSON.stringify([normaliseText(d.description).toLowerCase(), d.due_date]);
}
