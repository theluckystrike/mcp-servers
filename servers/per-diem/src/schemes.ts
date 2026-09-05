import { isValidZone, offsetMinutes, resolveZone, wallIn, zonedToUtc } from "@theluckystrike/mcp-timezone/lib";
import { currencyDecimals, formatMoney, table, type Band, type FiscalYear, type RateRow, type Table } from "./tables.js";

export type SchemeId = "pl" | "uk" | "us";
export const SCHEMES: SchemeId[] = ["pl", "uk", "us"];

export type MealName = "breakfast" | "lunch" | "dinner";
export const MEALS: MealName[] = ["breakfast", "lunch", "dinner"];

/** A trip longer than this is refused: it is a relocation, not a business trip. */
export const MAX_TRIP_DAYS = 366;

export interface DayLine {
  day: number;
  from: string;
  to: string;
  hours: number;
  basis: string;
  full_rate_minor: number;
  fraction: number | null;
  gross_minor: number;
  meals_provided: MealName[];
  meal_deduction_minor: number;
  amount_minor: number;
}

export interface CalcInput {
  scheme: SchemeId;
  destination: string;
  start: string;
  end: string;
  timezone?: string;
  meals_provided?: MealName[][];
  meals_provided_daily?: MealName[];
  lodging_nights?: number;
  late_evening?: boolean[];
  fiscal_year?: string;
}

export interface CalcResult {
  scheme: SchemeId;
  part: string;
  destination: string;
  currency: string;
  decimals: number;
  timezone: string;
  start: string;
  end: string;
  total_hours: number;
  days: DayLine[];
  subsistence_minor: number;
  subsistence: string;
  lodging_nights: number;
  lodging_minor: number;
  lodging: string;
  lodging_basis: string;
  total_minor: number;
  total: string;
  rule: string;
  source: { authority: string; instrument: string; source_url: string; effective_date: string; retrieved_date: string };
  notes: string[];
}

/* ------------------------------------------------------------- time parsing */

const OFFSET_ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?\s*(Z|[+-]\d{2}:?\d{2})$/i;
const NAIVE_ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * A start or end is an instant, never a wall clock. Two forms are accepted: an ISO 8601
 * string that carries its own offset (`2026-03-28T22:00:00+01:00`, or `Z`), which is
 * already an instant and is taken as given; or a bare local datetime plus a `timezone`,
 * which is resolved through the timezone engine's DST-aware resolver.
 *
 * The reason both exist: a per diem is counted in ELAPSED hours, so a trip that crosses a
 * clock change is 23 or 25 hours long, not 24, and a naive string differenced as text gets
 * that wrong every March and October. Everything below works on epoch milliseconds.
 */
export function parseInstant(value: string, zone: string | undefined, what: string): { at: Date; zone: string; note?: string } {
  const raw = String(value ?? "").trim();
  const withOffset = OFFSET_ISO.exec(raw);
  if (withOffset) {
    const at = new Date(raw.replace(" ", "T"));
    if (Number.isNaN(at.getTime())) throw new Error(`${what} "${raw}" is not a real datetime.`);
    const z = zone ?? "UTC";
    return { at, zone: z };
  }
  const naive = NAIVE_ISO.exec(raw);
  if (!naive) {
    throw new Error(
      `${what} "${raw}" is not an ISO 8601 datetime. Give it either with its own offset ` +
      `("2026-03-28T22:00:00+01:00") or as a plain local datetime ("2026-03-28T22:00") together with timezone ("Europe/Warsaw").`,
    );
  }
  if (!zone) {
    throw new Error(
      `${what} "${raw}" has no timezone. A per diem is counted in elapsed hours, so "22:00" alone is not an instant. ` +
      `Pass timezone (an IANA id such as "Europe/Warsaw"), or write the offset into the datetime itself.`,
    );
  }
  const w = {
    y: Number(naive[1]), m: Number(naive[2]), d: Number(naive[3]),
    h: Number(naive[4]), mi: Number(naive[5]), s: Number(naive[6] ?? 0),
  };
  const at = zonedToUtc(w, zone, { gap: "forward", fold: "first" });
  return { at, zone };
}

export function resolveTimezone(input: string | undefined): string | undefined {
  if (!input) return undefined;
  if (isValidZone(input)) return input;
  return resolveZone(input).zone;
}

const iso = (d: Date) => d.toISOString();

/* ------------------------------------------------------------- destinations */

function norm(s: string): string { return String(s ?? "").trim().toLowerCase(); }

/**
 * D-P2. Exact country name, then ISO code, then exact locality, then -- only then -- a
 * PREFIX match. Never a substring match.
 *
 * `"romania".includes("oman")` is true, so a substring fallback prices a trip to Oman, a
 * country this build deliberately does not bundle, at Romania's 42.00 EUR and says nothing.
 * A prefix cannot do that, and a destination that is genuinely absent has to be refused by
 * name so the caller learns the table is partial rather than being handed a wrong number.
 */
export function findRate(rows: RateRow[], destination: string): RateRow | undefined {
  const n = norm(destination);
  if (!n) return undefined;
  return rows.find((r) => norm(r.country) === n)
    ?? rows.find((r) => (r.code ?? "").toLowerCase() === n)
    ?? rows.find((r) => norm(r.locality ?? "") === n)
    ?? rows.find((r) => n.length >= 4 && norm(r.country).startsWith(n));
}

/* ------------------------------------------------------------ block slicing */

interface Block { from: Date; to: Date; hours: number; full: boolean }

/** 24-hour blocks counted from departure, which is the Polish "doba" and the shape HMRC's hour bands assume. */
function elapsedBlocks(start: Date, end: Date): Block[] {
  const ms = end.getTime() - start.getTime();
  const out: Block[] = [];
  const full = Math.floor(ms / 86400000);
  for (let i = 0; i < full; i++) {
    const a = new Date(start.getTime() + i * 86400000);
    out.push({ from: a, to: new Date(a.getTime() + 86400000), hours: 24, full: true });
  }
  const rest = ms - full * 86400000;
  if (rest > 0) {
    const a = new Date(start.getTime() + full * 86400000);
    out.push({ from: a, to: end, hours: rest / 3600000, full: false });
  }
  return out;
}

/** Calendar days of travel in the destination zone, which is how the US FTR counts them. */
function calendarBlocks(start: Date, end: Date, zone: string): Block[] {
  const out: Block[] = [];
  const key = (d: Date) => { const w = wallIn(d, zone); return `${w.y}-${String(w.m).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`; };
  let cursorKey = key(start);
  let from = start;
  const endKey = key(end);
  let guard = 0;
  while (cursorKey !== endKey) {
    if (++guard > MAX_TRIP_DAYS + 2) break;
    // midnight at the start of the next local day
    const w = wallIn(from, zone);
    const nextLocal = new Date(zonedToUtc({ y: w.y, m: w.m, d: w.d, h: 0, mi: 0, s: 0 }, zone, { gap: "forward" }).getTime() + 86400000);
    const boundary = zonedToUtc({ ...wallIn(nextLocal, zone), h: 0, mi: 0, s: 0 }, zone, { gap: "forward" });
    const to = boundary.getTime() > end.getTime() ? end : boundary;
    out.push({ from, to, hours: (to.getTime() - from.getTime()) / 3600000, full: false });
    from = to;
    cursorKey = key(new Date(from.getTime() + 1000));
    if (from.getTime() >= end.getTime()) break;
  }
  if (from.getTime() < end.getTime() || out.length === 0) {
    out.push({ from, to: end, hours: (end.getTime() - from.getTime()) / 3600000, full: false });
  }
  return out;
}

/* ------------------------------------------------------------------ schemes */

const round = (n: number) => Math.round(n);

function mealsFor(input: CalcInput, index: number): MealName[] {
  const per = input.meals_provided?.[index];
  const list = per ?? input.meals_provided_daily ?? [];
  return [...new Set(list)].filter((m): m is MealName => (MEALS as string[]).includes(m));
}

function fiscalYear(t: Table, wanted: string | undefined): FiscalYear {
  const years = t.fiscal_years ?? [];
  const want = wanted ?? t.current_fiscal_year;
  const hit = years.find((y) => y.fiscal_year.toLowerCase() === String(want).toLowerCase());
  if (!hit) {
    throw new Error(
      `"${wanted}" is not a bundled US fiscal year. Bundled: ${years.map((y) => y.fiscal_year).join(", ")}. ` +
      `The current one is ${t.current_fiscal_year}.`,
    );
  }
  return hit;
}

export function calc(input: CalcInput): CalcResult {
  const zone = resolveTimezone(input.timezone);
  const s = parseInstant(input.start, zone, "start");
  const e = parseInstant(input.end, zone ?? s.zone, "end");
  const start = s.at, end = e.at;
  if (end.getTime() <= start.getTime()) {
    throw new Error(
      `end ${iso(end)} is not after start ${iso(start)}. A trip that ends before it began has no allowance; ` +
      `check the offsets, they are compared as instants, not as text.`,
    );
  }
  const totalHours = (end.getTime() - start.getTime()) / 3600000;
  if (totalHours / 24 > MAX_TRIP_DAYS) {
    throw new Error(
      `that trip is ${Math.round(totalHours / 24)} days. The limit here is ${MAX_TRIP_DAYS}: past a year a posting is a relocation and none of these ` +
      `schemes price it as travel subsistence. Split it, or record it as a secondment outside this server.`,
    );
  }
  const nights = Math.max(0, Math.trunc(input.lodging_nights ?? 0));
  const notes: string[] = [];
  if (s.zone !== e.zone) notes.push(`start and end were read in different zones (${s.zone}, ${e.zone}); the elapsed time is still an instant difference.`);

  if (input.scheme === "pl") return calcPl(input, start, end, zone ?? s.zone, nights, notes);
  if (input.scheme === "uk") return calcUk(input, start, end, zone ?? s.zone, nights, notes);
  return calcUs(input, start, end, zone ?? s.zone, nights, notes);
}

/* --------------------------------------------------------------------- PL */

const PL_DOMESTIC_MEALS: Record<MealName, number> = { breakfast: 0.25, lunch: 0.5, dinner: 0.25 };
const PL_FOREIGN_MEALS: Record<MealName, number> = { breakfast: 0.15, lunch: 0.3, dinner: 0.3 };

function calcPl(input: CalcInput, start: Date, end: Date, zone: string, nights: number, notes: string[]): CalcResult {
  const domesticTable = table("pl-domestic");
  const foreignTable = table("pl-foreign");
  const dom = findRate(domesticTable.rates, input.destination);
  const t = dom ? domesticTable : foreignTable;
  const row = dom ?? findRate(foreignTable.rates, input.destination);
  if (!row) {
    throw new Error(
      `"${input.destination}" is not in the bundled Polish table. Bundled: Poland (domestic) and ` +
      `${foreignTable.rates.length} countries abroad. The annex covers more; only the rows that could be stated with ` +
      `confidence are shipped, so a missing country means "not verified here", not "no rate exists". ` +
      `Run perdiem_rates {scheme:"pl"} for the list.`,
    );
  }
  const domestic = t === domesticTable;
  const currency = row.currency ?? "PLN";
  const diet = row.diet_minor ?? 0;
  const mealPct = domestic ? PL_DOMESTIC_MEALS : PL_FOREIGN_MEALS;

  const blocks = elapsedBlocks(start, end);
  const shortTrip = blocks.length === 1 && !blocks[0].full;
  const days: DayLine[] = [];
  blocks.forEach((b, i) => {
    let fraction: number;
    let basis: string;
    if (b.full) { fraction = 1; basis = "full 24-hour period"; }
    else if (domestic && shortTrip) {
      if (b.hours < 8) { fraction = 0; basis = "under 8 hours, no diet (par. 7(2)(1)(a))"; }
      else if (b.hours <= 12) { fraction = 0.5; basis = "8 to 12 hours, 50 percent (par. 7(2)(1)(b))"; }
      else { fraction = 1; basis = "over 12 hours, full diet (par. 7(2)(1)(c))"; }
    } else if (domestic) {
      if (b.hours <= 8) { fraction = 0.5; basis = "incomplete day up to 8 hours, 50 percent (par. 7(2)(2)(a))"; }
      else { fraction = 1; basis = "incomplete day over 8 hours, full diet (par. 7(2)(2)(b))"; }
    } else {
      if (b.hours <= 8) { fraction = 1 / 3; basis = "up to 8 hours, one third (par. 13(4)(1))"; }
      else if (b.hours <= 12) { fraction = 0.5; basis = "over 8 up to 12 hours, 50 percent (par. 13(4)(2))"; }
      else { fraction = 1; basis = "over 12 hours, full diet (par. 13(4)(3))"; }
    }
    const gross = round(diet * fraction);
    const provided = mealsFor(input, i);
    const deduction = Math.min(gross, provided.reduce((a, m) => a + round(gross * mealPct[m]), 0));
    days.push({
      day: i + 1, from: iso(b.from), to: iso(b.to), hours: Number(b.hours.toFixed(4)), basis,
      full_rate_minor: diet, fraction, gross_minor: gross,
      meals_provided: provided, meal_deduction_minor: deduction, amount_minor: gross - deduction,
    });
  });

  const subsistence = days.reduce((a, d) => a + d.amount_minor, 0);
  const lodgingRate = domestic ? (row.lodging_flat_minor ?? 0) : 0;
  const lodging = nights * lodgingRate;
  if (!domestic && nights > 0) {
    notes.push(
      `${nights} lodging night(s) were given but the foreign table bundles no lodging limit for ${row.country}, so nothing was paid for them. ` +
      `Abroad the regulation pays the actual receipted cost up to a per-country limit, or 25 percent of that limit as a lump sum; neither figure is bundled.`,
    );
  }
  if (domestic && nights > 0) {
    notes.push(`Lodging is the ryczalt (150 percent of the diet, ${formatMoney(lodgingRate, currency)} a night), which is only due when no receipt is presented and no free accommodation was provided.`);
  }
  return {
    scheme: "pl", part: domestic ? "domestic" : "foreign", destination: row.country,
    currency, decimals: currencyDecimals(currency), timezone: zone,
    start: iso(start), end: iso(end), total_hours: Number(((end.getTime() - start.getTime()) / 3600000).toFixed(4)),
    days, subsistence_minor: subsistence, subsistence: formatMoney(subsistence, currency),
    lodging_nights: nights, lodging_minor: lodging, lodging: formatMoney(lodging, currency),
    lodging_basis: domestic ? "ryczalt za nocleg, 150 percent of the diet per night" : "not bundled for foreign travel",
    total_minor: subsistence + lodging, total: formatMoney(subsistence + lodging, currency),
    rule: domestic
      ? "Poland, domestic. Diet 45.00 PLN a day. Under 24 hours: nothing under 8 hours, half from 8 to 12, whole over 12. Over 24 hours: a whole diet per 24-hour period, then half for a remainder up to 8 hours and a whole one above that. Free meals reduce the day's diet by 25 percent for breakfast, 50 percent for lunch and 25 percent for dinner."
      : `Poland, foreign. Diet ${formatMoney(diet, currency)} a day for ${row.country}. A whole diet per 24-hour period; for an incomplete period, one third up to 8 hours, half over 8 and up to 12, a whole one above that. Free meals reduce the day by 15 percent for breakfast, 30 percent for lunch and 30 percent for dinner.`,
    source: {
      authority: t.header.authority, instrument: t.header.instrument, source_url: t.header.source_url,
      effective_date: t.header.effective_date, retrieved_date: t.header.retrieved_date,
    },
    notes,
  };
}

/* --------------------------------------------------------------------- UK */

function bandFor(bands: Band[], hours: number): Band | undefined {
  return [...bands].sort((a, b) => b.min_hours - a.min_hours).find((b) => hours >= b.min_hours);
}

function calcUk(input: CalcInput, start: Date, end: Date, zone: string, nights: number, notes: string[]): CalcResult {
  const t = table("uk-domestic");
  const over = table("uk-overseas");
  const row = findRate(t.rates, input.destination);
  if (!row) {
    const abroad = findRate(over.rates, input.destination);
    throw new Error(
      `"${input.destination}" is not in the bundled HMRC table. Only the UK domestic benchmark scale rates are bundled. ` +
      `The overseas scale rates are per city, in the destination currency, and are NOT bundled in this build: ${over.header.coverage}` +
      (abroad ? "" : " Run perdiem_rates {scheme:\"uk\"} to see what is here."),
    );
  }
  const bands = row.bands ?? [];
  const currency = row.currency ?? "GBP";
  const blocks = elapsedBlocks(start, end);
  const days: DayLine[] = [];
  blocks.forEach((b, i) => {
    const band = bandFor(bands, b.hours);
    const gross = band?.amount_minor ?? 0;
    const covered = band?.meals_covered ?? 0;
    const provided = mealsFor(input, i);
    const deduction = covered === 0 ? 0
      : Math.min(gross, round(gross * Math.min(provided.length, covered) / covered));
    const late = input.late_evening?.[i] === true && band !== undefined && covered < 3
      ? (row.late_evening_supplement_minor ?? 0) : 0;
    if (late) notes.push(`day ${i + 1}: late-evening supplement ${formatMoney(late, currency)} added because late_evening was set for that day.`);
    days.push({
      day: i + 1, from: iso(b.from), to: iso(b.to), hours: Number(b.hours.toFixed(4)),
      basis: band ? band.label : "under 5 hours, no benchmark rate is payable",
      full_rate_minor: gross, fraction: null, gross_minor: gross + late,
      meals_provided: provided, meal_deduction_minor: deduction, amount_minor: gross + late - deduction,
    });
  });
  const subsistence = days.reduce((a, d) => a + d.amount_minor, 0);
  if (nights > 0) {
    notes.push(`${nights} lodging night(s) were given. The benchmark scale rates cover meals only; HMRC accommodation is reimbursed on actual receipted cost, so nothing was paid for the nights here.`);
  }
  return {
    scheme: "uk", part: "domestic", destination: row.country, currency, decimals: currencyDecimals(currency),
    timezone: zone, start: iso(start), end: iso(end),
    total_hours: Number(((end.getTime() - start.getTime()) / 3600000).toFixed(4)),
    days, subsistence_minor: subsistence, subsistence: formatMoney(subsistence, currency),
    lodging_nights: nights, lodging_minor: 0, lodging: formatMoney(0, currency),
    lodging_basis: "not part of the benchmark scale rates; accommodation is receipted",
    total_minor: subsistence, total: formatMoney(subsistence, currency),
    rule: "United Kingdom, HMRC benchmark scale rates. 5.00 GBP from 5 hours away, 10.00 GBP from 10 hours, 25.00 GBP from 15 hours when the journey is ongoing at 8pm. Nothing under 5 hours. A meal provided free removes its share of the band: the 5-hour rate covers one meal, the 10-hour rate two, the 15-hour rate three, and the day is reduced pro rata. That pro-rata split is this server's reading of \"the rate is not payable for a meal that was provided\"; HMRC states the principle, not the arithmetic.",
    source: {
      authority: t.header.authority, instrument: t.header.instrument, source_url: t.header.source_url,
      effective_date: t.header.effective_date, retrieved_date: t.header.retrieved_date,
    },
    notes,
  };
}

/* --------------------------------------------------------------------- US */

function calcUs(input: CalcInput, start: Date, end: Date, zone: string, nights: number, notes: string[]): CalcResult {
  const t = table("us-gsa");
  const row = findRate(t.rates, input.destination);
  if (!row) {
    throw new Error(
      `"${input.destination}" is not a bundled US locality. Only the CONUS STANDARD rate is bundled ` +
      `(destination "United States", "US" or "CONUS standard"). ${t.header.coverage}`,
    );
  }
  const fy = fiscalYear(t, input.fiscal_year);
  const currency = row.currency ?? "USD";
  const blocks = calendarBlocks(start, end, zone);
  const n = blocks.length;
  const days: DayLine[] = [];
  blocks.forEach((b, i) => {
    const first = i === 0, last = i === n - 1;
    const prorated = first || last;
    const gross = prorated ? fy.first_last_day_minor : fy.mie_minor;
    const provided = mealsFor(input, i);
    const deduction = Math.min(gross, provided.reduce((a, m) => a + fy.meals[`${m}_minor` as const], 0));
    days.push({
      day: i + 1, from: iso(b.from), to: iso(b.to), hours: Number(b.hours.toFixed(4)),
      basis: prorated ? "first or last day of travel, 75 percent of M&IE (FTR 301-11.101)" : "full day of travel, 100 percent of M&IE",
      full_rate_minor: fy.mie_minor, fraction: prorated ? 0.75 : 1, gross_minor: gross,
      meals_provided: provided, meal_deduction_minor: deduction, amount_minor: gross - deduction,
    });
  });
  const subsistence = days.reduce((a, d) => a + d.amount_minor, 0);
  const lodging = nights * fy.lodging_cap_minor;
  if (nights > 0) {
    notes.push(`Lodging is a CAP, not an allowance: ${formatMoney(fy.lodging_cap_minor, currency)} a night is the most that may be reimbursed against receipts, and the figure here is that ceiling times ${nights} night(s), not a payment.`);
  }
  if (n === 1) notes.push("A trip inside one calendar day is a single first-and-last day, so it is prorated once at 75 percent, not twice.");
  return {
    scheme: "us", part: `conus-standard ${fy.fiscal_year}`, destination: row.locality ?? row.country,
    currency, decimals: currencyDecimals(currency), timezone: zone,
    start: iso(start), end: iso(end), total_hours: Number(((end.getTime() - start.getTime()) / 3600000).toFixed(4)),
    days, subsistence_minor: subsistence, subsistence: formatMoney(subsistence, currency),
    lodging_nights: nights, lodging_minor: lodging, lodging: formatMoney(lodging, currency),
    lodging_basis: `GSA lodging CAP ${formatMoney(fy.lodging_cap_minor, currency)} per night, receipted`,
    total_minor: subsistence + lodging, total: formatMoney(subsistence + lodging, currency),
    rule: `United States, GSA CONUS standard, ${fy.fiscal_year}. M&IE ${formatMoney(fy.mie_minor, currency)} a day, ${formatMoney(fy.first_last_day_minor, currency)} on the first and last day of travel (75 percent). Days are CALENDAR days in the destination zone, not 24-hour periods. A provided meal is deducted at its own published amount: breakfast ${formatMoney(fy.meals.breakfast_minor, currency)}, lunch ${formatMoney(fy.meals.lunch_minor, currency)}, dinner ${formatMoney(fy.meals.dinner_minor, currency)}; ${formatMoney(fy.meals.incidentals_minor, currency)} of incidentals is never deducted.`,
    source: {
      authority: t.header.authority, instrument: t.header.instrument, source_url: t.header.source_url,
      effective_date: t.header.effective_date, retrieved_date: t.header.retrieved_date,
    },
    notes,
  };
}
