/**
 * The maintenance register: what an asset is, what a log entry is, and the date math.
 *
 * An asset is one piece of equipment a small operator looks after -- a lathe, a boiler,
 * a van, a camera. Work is logged against it as it happens: the day, what was done, what
 * it cost and who did it, and when the next service falls due. The due date is stored as
 * an ISO date; whether it is overdue is computed at call time from today's date, never
 * stored, so the register cannot silently go stale.
 *
 * Every cost is an integer number of cents in the asset's currency, stored on the entry.
 * Totals are the sums of those stored line values, so a total can never drift from the
 * lines it is made of. Nothing in this module touches the network.
 */

export const MAX_CENTS = 1e14;
export const MAX_ENTRIES = 5000;        // log entries per asset
export const MAX_INTERVAL_DAYS = 36500; // about a century; a longer interval is a typo

export interface LogEntry {
  date: string;                 // YYYY-MM-DD, the day the work was done
  work: string;                 // what was done
  cost_cents: number;           // integer cents in the asset's currency; 0 for in-house work
  technician: string | null;    // who did the work
  next_due: string | null;      // YYYY-MM-DD the next service falls due; null when unscheduled
  interval_days: number | null; // the interval the due date came from, kept for the record
  logged: string;               // ISO timestamp of when the entry was made
}

export interface Asset {
  id: string;                   // AST-YYYY-NNNN
  name: string;
  tag: string | null;           // serial number or asset tag; unique across the register
  location: string | null;      // where the asset lives
  notes: string | null;
  currency: string;             // 3-letter ISO, uppercased; a cent is 1/100 of it
  log: LogEntry[];
  created: string;
  updated: string;
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

/** date + n days, in UTC so the answer does not depend on the timezone the server runs in. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is before `from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/**
 * The schedule an asset currently lives under: the next-due date carried by the entry
 * with the latest work date, ties broken by when the entry was logged. A backfilled
 * older entry never overrides a newer schedule.
 */
export function currentSchedule(a: Asset): { next_due: string; work_date: string; work: string } | null {
  let best: LogEntry | null = null;
  for (const e of a.log) {
    if (!e.next_due) continue;
    if (!best || e.date > best.date || (e.date === best.date && e.logged > best.logged)) best = e;
  }
  return best ? { next_due: best.next_due as string, work_date: best.date, work: best.work } : null;
}

/** The most recent work date on the log, or null when nothing has been logged yet. */
export function lastServiceDate(a: Asset): string | null {
  let last: string | null = null;
  for (const e of a.log) if (last === null || e.date > last) last = e.date;
  return last;
}

export function totalSpentCents(log: LogEntry[]): number {
  return log.reduce((a, e) => a + e.cost_cents, 0);
}

/** "USD 120.00", sign before the digits, no thousand separators. */
export function money(cents: number, currency: string): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${currency} ${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** One CSV field: quoted when it holds a comma, a quote or a newline; quotes doubled. */
export function csvField(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A Markdown table cell: pipes escaped and newlines flattened so a note cannot break the table. */
export function mdCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
