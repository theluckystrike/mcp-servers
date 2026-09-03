/**
 * Local calendar-day helpers. Extracted from index.ts so the other servers can be tested
 * against the same definition of "today" (D-R15): invoice's isoDate(), expense-tracker's
 * localDay() and this must all return the same string for the same process TZ.
 */

/** Local-timezone day key, YYYY-MM-DD. */
export function dayKey(isoStr: string): string {
  const d = new Date(isoStr);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Today on the local calendar, YYYY-MM-DD. */
export function localToday(): string {
  return dayKey(new Date().toISOString());
}

/** Start of local day N days back, as a Date. */
export function localDayStart(daysBack = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d;
}
