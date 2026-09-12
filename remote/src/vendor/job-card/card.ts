/**
 * The job card itself: what one is, the status flow, and the money.
 *
 * A job card is the record of work YOUR crew performs on one job: who turned up, the
 * hours they put in at what rate, and the materials that went in. It is not the document
 * issued to a contractor (that is a work order) and it is not the bill (that is an
 * invoice): it is the running account of labor and materials the bill is later raised
 * from, and the thing the client signs.
 *
 * Every amount is an integer number of cents and is computed ONCE, when the entry is
 * logged, and stored on the entry. Totals are the sums of those stored line values, so a
 * total can never drift from the lines it is made of. Nothing in this module touches the
 * network.
 */

export const MAX_CENTS = 1e14;
export const MAX_HOURS = 24;          // one labor entry is one worker's day at most
export const MAX_QTY = 1e6;
export const MAX_ENTRIES = 2000;      // per card, labor and materials each

export const FLOW = ["open", "in_progress", "done", "invoiced", "archived"] as const;
export type Status = (typeof FLOW)[number];

export interface LaborEntry {
  date: string;             // YYYY-MM-DD, the day the work was done
  worker: string;           // who did it
  hours: number;            // validated to a whole number of hundredths
  rate_cents: number;       // the hourly rate, integer cents
  value_cents: number;      // hours x rate, rounded half-up to the cent, fixed at log time
  note?: string;            // what was done
  logged: string;           // ISO timestamp of when the entry was made
}

export interface MaterialEntry {
  date: string;
  item: string;             // what went into the job
  qty: number;              // validated to a whole number of thousandths
  unit_cost_cents: number;  // what one costs, integer cents
  value_cents: number;      // qty x unit cost, rounded half-up to the cent, fixed at log time
  note?: string;
  logged: string;
}

export interface StatusChange {
  status: Status;
  date: string;             // YYYY-MM-DD the step is stamped with
  note?: string;
  at: string;               // ISO timestamp of the call
}

export interface Card {
  id: string;               // JC-YYYY-NNNN
  client: string;
  site: string;             // where the job is
  description: string;      // what the job is
  currency: string;         // 3-letter ISO, uppercased; a cent is 1/100 of it
  scheduled_date: string | null;
  status: Status;
  history: StatusChange[];
  labor: LaborEntry[];
  materials: MaterialEntry[];
  note?: string;
  created: string;
  updated: string;
}

/** Buyer spelling "in-progress" is the same step as in_progress. */
export function normalizeStatus(s: string): Status | null {
  const t = s.trim().toLowerCase().replace(/-/g, "_");
  return (FLOW as readonly string[]).includes(t) ? (t as Status) : null;
}

/** The one step a card is allowed to move, or null at the end of the flow. */
export function nextStatus(s: Status): Status | null {
  const i = FLOW.indexOf(s);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
}

/** Whether labor and materials can still be logged against a card at this status. */
export function acceptsEntries(s: Status): boolean {
  return s === "open" || s === "in_progress";
}

/** n / d rounded half-up, for non-negative integers, without a float in sight. */
export function halfUpDiv(n: number, d: number): number {
  return Math.floor((2 * n + d) / (2 * d));
}

/**
 * Hours are carried as a whole number of hundredths (7.5 is 750) so the line value is
 * integer arithmetic: 250 hundredths at 4,999 cents is 1,249,750 hundredth-cents, which
 * is 12,498 cents rounded half-up, never 12,497.499999 floating-point noise.
 */
export function hoursToHundredths(hours: number): number | null {
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS) return null;
  const h = hours * 100;
  if (Math.abs(h - Math.round(h)) > 1e-9) return null;
  return Math.round(h);
}

/** Quantities the same way, to a whole number of thousandths (0.5 is 500). */
export function qtyToThousandths(qty: number): number | null {
  if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) return null;
  const q = qty * 1000;
  if (Math.abs(q - Math.round(q)) > 1e-9) return null;
  return Math.round(q);
}

export function laborValue(hoursHundredths: number, rateCents: number): number {
  return halfUpDiv(hoursHundredths * rateCents, 100);
}

export function materialValue(qtyThousandths: number, unitCents: number): number {
  return halfUpDiv(qtyThousandths * unitCents, 1000);
}

/** Hours never come out of floats: the hundredths are summed as integers. */
export function totalHoursHundredths(labor: LaborEntry[]): number {
  return labor.reduce((a, e) => a + Math.round(e.hours * 100), 0);
}

export function laborTotalCents(labor: LaborEntry[]): number {
  return labor.reduce((a, e) => a + e.value_cents, 0);
}

export function materialsTotalCents(materials: MaterialEntry[]): number {
  return materials.reduce((a, e) => a + e.value_cents, 0);
}

export function grandTotalCents(c: Card): number {
  return laborTotalCents(c.labor) + materialsTotalCents(c.materials);
}

/** A card counts against the free tier until it is archived. */
export function isActive(c: Card): boolean {
  return c.status !== "archived";
}

/** "EUR 636.71", sign before the digits, no thousand separators. */
export function money(cents: number, currency: string): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${currency} ${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** The local calendar date, YYYY-MM-DD. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The week a date falls in, Monday to Sunday, computed in UTC so the answer does not
 * depend on the timezone the server happens to run in.
 */
export function weekWindow(date: string): { from: string; to: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}
