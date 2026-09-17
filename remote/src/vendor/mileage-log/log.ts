/**
 * The mileage log itself: what a trip is, what a rate is, and the money.
 *
 * A trip is one drive: the day, where from and to, how far, why, and the category the
 * deduction rules give it (business, medical, moving, charitable, or personal for the
 * record). A rate is what one unit of distance is worth for one category in one
 * jurisdiction from one date forward. Rates change - a tax authority announces a new
 * figure most years - so a rate is never one global number: it is a series per
 * (jurisdiction, category) keyed by the date it takes effect, and the rate a trip earns
 * is the one in force ON THE DAY THE TRIP WAS DRIVEN.
 *
 * The money rule, in one place: a trip's deductible amount is its distance times the
 * effective rate, rounded HALF-UP to the cent, and every total is the sum of those
 * rounded per-trip amounts. A total can therefore never drift from the lines it is made
 * of, and the CSV export reconciles line by line with the summary. There is no float in
 * the computation: distance is integer thousandths of its unit, the rate is integer
 * thousandths of a currency unit, and the one division is the final rounding.
 *
 * Nothing in this module touches the network. Nothing here is tax advice; the rates a
 * user enters are their own figures, and this server ships no rates of its own.
 */

export const MAX_DISTANCE = 10000; // one trip, in its own unit; split a longer drive
export const MAX_RATE = 100;       // currency units per distance unit
export const MAX_TRIPS = 50000;    // safety ceiling on the whole log
export const MAX_RATES = 500;
export const FREE_TRIPS_PER_MONTH = 20;

export const CATEGORIES = ["business", "medical", "moving", "charitable", "personal"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Unit = "miles" | "km";

export interface Trip {
  id: string;                  // TR-YYYY-NNNN, the year being the year of the trip date
  date: string;                // YYYY-MM-DD, the day the trip was driven
  from: string;
  to: string;
  distance: number;            // validated to a whole number of thousandths of unit
  unit: Unit;
  purpose: string;
  category: Category;
  jurisdiction: string | null; // the rate set that prices this trip; null = resolve at read time
  note?: string;
  logged: string;              // ISO timestamp of when the entry was made
}

export interface Rate {
  jurisdiction: string;        // a label, e.g. "US federal" or the user's own; never assumed law
  category: Category;
  unit: Unit;                  // the distance unit the rate prices
  rate: number;                // validated to a whole number of thousandths of a currency unit
  currency: string;            // 3-letter ISO, uppercased
  effective_from: string;      // YYYY-MM-DD the rate starts to apply
  set: string;                 // ISO timestamp of the rate_set call
}

/** n / d rounded half-up, for non-negative integers, without a float in sight. */
export function halfUpDiv(n: number, d: number): number {
  return Math.floor((2 * n + d) / (2 * d));
}

/**
 * Distances are carried as a whole number of thousandths of the unit (12.5 miles is
 * 12,500) so every multiplication below is integer arithmetic.
 */
export function distanceToThousandths(distance: number): number | null {
  if (!Number.isFinite(distance) || distance <= 0 || distance > MAX_DISTANCE) return null;
  const d = distance * 1000;
  if (Math.abs(d - Math.round(d)) > 1e-9) return null;
  return Math.round(d);
}

/** Rates the same way, to a whole number of thousandths of a currency unit (0.70 is 700). */
export function rateToThousandths(rate: number): number | null {
  if (!Number.isFinite(rate) || rate <= 0 || rate > MAX_RATE) return null;
  const r = rate * 1000;
  if (Math.abs(r - Math.round(r)) > 1e-9) return null;
  return Math.round(r);
}

/** Buyer spellings of the two units this log keeps apart and never adds together. */
export function normalizeUnit(s: string): Unit | null {
  const t = s.trim().toLowerCase();
  if (["mile", "miles", "mi"].includes(t)) return "miles";
  if (["km", "kilometer", "kilometers", "kilometre", "kilometres"].includes(t)) return "km";
  return null;
}

export function normalizeCategory(s: string): Category | null {
  const t = s.trim().toLowerCase();
  return (CATEGORIES as readonly string[]).includes(t) ? (t as Category) : null;
}

/** 1 mile is exactly 1.609344 km by international agreement; that is a definition, not a measurement. */
const METERS_PER_MILE = 1609.344;

/**
 * The deductible amount of one trip under one rate, in integer cents.
 *
 * distance-thousandths times rate-thousandths is 1e-6 of a currency unit, so the amount
 * in cents is (d * r) / 10,000, rounded half-up exactly once. When the trip's unit and
 * the rate's unit differ, the distance is first converted with the exact mile/km factor
 * and rounded half-up to the thousandth of the rate's unit, then multiplied; that double
 * rounding moves the figure by less than a tenth of a cent and is stated here rather
 * than hidden.
 */
export function amountCents(trip: Trip, rate: Rate): number {
  const dTh = Math.round(trip.distance * 1000);
  const rTh = Math.round(rate.rate * 1000);
  if (trip.unit === rate.unit) return halfUpDiv(dTh * rTh, 10000);
  const conv = trip.unit === "miles"
    ? halfUpDiv(dTh * Math.round(METERS_PER_MILE * 1000), 1000000) // miles -> thousandths of a km
    : halfUpDiv(dTh * 1000000, Math.round(METERS_PER_MILE * 1000)); // km -> thousandths of a mile
  return halfUpDiv(conv * rTh, 10000);
}

export type RateLookup = { ok: true; rate: Rate } | { ok: false; reason: string };

/**
 * The rate in force on the day a trip was driven: among the rates for the trip's
 * category (and its jurisdiction, when the trip carries one), the one with the latest
 * effective_from on or before the trip date. A trip with no jurisdiction is priced by
 * the one jurisdiction that covers its category; if two do, that is the caller's
 * ambiguity to fix, stated plainly rather than guessed.
 */
export function effectiveRate(rates: Rate[], trip: Trip): RateLookup {
  const norm = (s: string) => s.trim().toLowerCase();
  let pool = rates.filter((r) => r.category === trip.category);
  if (trip.jurisdiction) {
    pool = pool.filter((r) => norm(r.jurisdiction) === norm(trip.jurisdiction!));
    if (!pool.length) {
      return { ok: false, reason: `no ${trip.category} rate is set for ${trip.jurisdiction}` };
    }
  } else {
    if (!pool.length) {
      return { ok: false, reason: `no ${trip.category} rate is set` };
    }
    const jurisdictions = [...new Set(pool.map((r) => norm(r.jurisdiction)))];
    if (jurisdictions.length > 1) {
      return {
        ok: false,
        reason: `more than one jurisdiction has a ${trip.category} rate (${[...new Set(pool.map((r) => r.jurisdiction))].join(", ")}); the trip needs a jurisdiction to know which applies`,
      };
    }
  }
  const eligible = pool.filter((r) => r.effective_from <= trip.date);
  if (!eligible.length) {
    const earliest = [...pool].sort((a, b) => (a.effective_from < b.effective_from ? -1 : 1))[0];
    return { ok: false, reason: `the earliest ${trip.category} rate takes effect ${earliest.effective_from}, after this trip's date` };
  }
  return { ok: true, rate: [...eligible].sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0] };
}

/** "USD 8.75", sign before the digits, no thousand separators. */
export function money(cents: number, currency: string): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${currency} ${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "USD 0.700/mile" - the rate as stored, thousandths of a currency unit per unit. */
export function rateText(rate: Rate): string {
  const rTh = Math.round(rate.rate * 1000);
  const unit = rate.unit === "miles" ? "mile" : "km";
  return `${rate.currency} ${Math.floor(rTh / 1000)}.${String(rTh % 1000).padStart(3, "0")}/${unit}`;
}

/** A bare 2-decimal amount for CSV cells, so a spreadsheet reads it as a number. */
export function csvAmount(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
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

/** The calendar month a date falls in, YYYY-MM. The free-tier cap is counted on this. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}
