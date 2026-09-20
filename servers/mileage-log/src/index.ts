#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, withFileLock } from "@theluckystrike/mcp-license";
import { z } from "zod";
import { VERSION } from "./version.js";
import {
  CATEGORIES, FREE_TRIPS_PER_MONTH, MAX_RATES, MAX_TRIPS, amountCents, csvAmount,
  distanceToThousandths, effectiveRate, isIsoDate, money, monthOf,
  normalizeCategory, normalizeUnit, rateText, rateToThousandths, today,
  type Category, type Rate, type Trip, type Unit,
} from "./log.js";
import { dataDir, findTrip, getRates, getTrips, lockPath, nextId, setRates, setTrips } from "./store.js";

/**
 * Free tier: TWENTY trips per calendar month, counted on the month of the trip date,
 * so reconstructing last year's log at tax time does not consume this month's
 * allowance. The summary, the list, and a single rate per jurisdiction and category
 * are never metered: a log you cannot read back is a demo. What is metered is volume,
 * the CSV export for the accountant, and multi-rate support (the year-over-year rate
 * series a full deduction history needs).
 */
const MAX_NAME = 200;
const MAX_TEXT = 2000;
const MAX_JURISDICTION = 100;

const gate = createLicenseGate({ product: "mileage-log" });

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

const str = (field: string, max: number) => z.string().max(max, `${field} must be ${max} characters or fewer`);

/** Only this server's own store is written, so there is one lock and it is this one. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(lockPath(), fn, { timeoutMs: 20000 });
}

function checkDate(value: string, field: string): string {
  if (!isIsoDate(value)) throw new Error(`cannot read a date: ${field} "${value}" is not a real date in YYYY-MM-DD form. Nothing was written.`);
  return value;
}

const BASIS =
  "A trip's deductible amount is its distance times the rate in force on the day it was driven, rounded half-up to the cent; every total is the sum of those rounded per-trip amounts, so a total can never drift from its lines and the CSV export reconciles line by line with the summary. " +
  "Distances in miles and in km are kept apart and never added together; amounts are kept per currency and never mixed. When a trip's unit differs from the rate's, the distance is converted first (1 mile = 1.609344 km exactly) and rounded half-up to the thousandth of the rate's unit. " +
  "No rate ships with this server and none of this is tax advice: the rates you set are your own figures to verify.";

const ROUNDING =
  "Rounding rule: distance x rate, rounded half-up to the cent per trip; totals are the sums of the rounded per-trip amounts.";

/* ------------------------------------------------------------- view helpers */

function tripJson(t: Trip) {
  return {
    id: t.id, date: t.date, from: t.from, to: t.to,
    distance: t.distance, unit: t.unit, purpose: t.purpose, category: t.category,
    jurisdiction: t.jurisdiction, note: t.note ?? null, logged: t.logged,
  };
}

/** A trip with its price under the rates on file, or the plain reason it has none. */
function pricedJson(t: Trip, rates: Rate[]) {
  const look = effectiveRate(rates, t);
  if (!look.ok) return { ...tripJson(t), rate: null, amount_cents: null, amount: null, unpriced_reason: look.reason };
  const cents = amountCents(t, look.rate);
  return {
    ...tripJson(t),
    rate: rateText(look.rate), rate_effective_from: look.rate.effective_from,
    currency: look.rate.currency, amount_cents: cents, amount: money(cents, look.rate.currency),
  };
}

function rateJson(r: Rate) {
  return {
    jurisdiction: r.jurisdiction, category: r.category,
    rate: rateText(r), rate_per_unit: r.rate, unit: r.unit,
    currency: r.currency, effective_from: r.effective_from,
  };
}

function freeTierNote(date: string): string | null {
  if (gate.isPro()) return null;
  const month = monthOf(date);
  const n = getTrips().filter((t) => monthOf(t.date) === month).length;
  return `Free tier: ${n} of ${FREE_TRIPS_PER_MONTH} trips dated in ${month}.`;
}

/** Sort oldest trip first, then id, the order an accountant reads a log in. */
function byDateThenId(a: Trip, b: Trip): number {
  return a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? -1 : 1;
}

/**
 * The priced view of a set of trips: per-category lines and totals, plus the trips
 * that could not be priced and why. Personal trips with no rate are listed apart: no
 * jurisdiction prices them, so their absence from the deductible figures is expected,
 * not a defect.
 */
function summarize(trips: Trip[], rates: Rate[]) {
  const priced: { trip: Trip; rate: Rate; cents: number }[] = [];
  const unpriced: { id: string; date: string; category: Category; reason: string }[] = [];
  const personalUnpriced: { id: string; date: string }[] = [];
  for (const t of trips) {
    const look = effectiveRate(rates, t);
    if (look.ok) priced.push({ trip: t, rate: look.rate, cents: amountCents(t, look.rate) });
    else if (t.category === "personal") personalUnpriced.push({ id: t.id, date: t.date });
    else unpriced.push({ id: t.id, date: t.date, category: t.category, reason: look.reason });
  }

  const byCategory = new Map<Category, typeof priced>();
  for (const p of priced) {
    const arr = byCategory.get(p.trip.category) ?? [];
    arr.push(p);
    byCategory.set(p.trip.category, arr);
  }
  const categories = [...byCategory.entries()].map(([category, rows]) => {
    const perUnit = new Map<Unit, number>();
    const perCurrency = new Map<string, number>();
    for (const p of rows) {
      perUnit.set(p.trip.unit, (perUnit.get(p.trip.unit) ?? 0) + Math.round(p.trip.distance * 1000));
      perCurrency.set(p.rate.currency, (perCurrency.get(p.rate.currency) ?? 0) + p.cents);
    }
    return {
      category,
      trips: rows.length,
      distance: [...perUnit.entries()].map(([unit, th]) => ({ unit, distance: th / 1000 })),
      lines: rows.map((p) => ({
        id: p.trip.id, date: p.trip.date, from: p.trip.from, to: p.trip.to,
        distance: p.trip.distance, unit: p.trip.unit,
        rate: rateText(p.rate), rate_effective_from: p.rate.effective_from,
        jurisdiction: p.rate.jurisdiction,
        amount_cents: p.cents, amount: money(p.cents, p.rate.currency),
      })),
      totals: [...perCurrency.entries()].map(([currency, cents]) => ({ currency, amount_cents: cents, amount: money(cents, currency) })),
    };
  });

  const grand = new Map<string, number>();
  for (const p of priced) grand.set(p.rate.currency, (grand.get(p.rate.currency) ?? 0) + p.cents);

  return {
    priced, unpriced, personalUnpriced, categories,
    totals: [...grand.entries()].map(([currency, cents]) => ({ currency, amount_cents: cents, amount: money(cents, currency) })),
  };
}

/* ------------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-mileage-log", version: VERSION },
  { capabilities: { tools: {} } },
);

const unitArg = str("unit", 20).describe("miles or km; spellings like mi and kilometre are accepted");

server.registerTool("trip_add", { annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  title: "Log a trip",
  description: "Log one drive in the mileage log: the date, where from and to, the distance in miles or km, the purpose, and the category (business, medical, moving, charitable, personal). Returns its TR-YYYY-NNNN id. Free tier: 20 trips per calendar month, counted on the month of the trip date.",
  inputSchema: {
    date: str("date", 10).describe("The day the trip was driven, YYYY-MM-DD. A future date is refused: the trip cannot have been driven yet"),
    from: str("from", MAX_NAME).describe("Where the trip started, e.g. Home office, 14 Nowa Street"),
    to: str("to", MAX_NAME).describe("Where it ended, e.g. Client site, 2 Mill Lane"),
    distance: z.number().finite().positive().describe("How far, to the thousandth of the unit, e.g. 12.5"),
    unit: unitArg,
    purpose: str("purpose", MAX_NAME).describe("Why the trip was made, e.g. Site visit for the Kowalski refit"),
    category: str("category", 20).describe(`One of: ${CATEGORIES.join(", ")}. Personal trips are kept for the record and priced only if a rate exists`),
    jurisdiction: str("jurisdiction", MAX_JURISDICTION).optional().describe("Which rate set prices this trip, when more than one jurisdiction has a rate for its category. Omit when only one does"),
    note: str("note", MAX_TEXT).optional(),
  },
}, async (a) => {
  try {
    const date = checkDate(a.date, "date");
    const now = today();
    if (date > now) throw new Error(`the trip is dated ${date}, which is after today (${now}). It cannot have been driven yet. Nothing was written.`);
    const unit = normalizeUnit(a.unit);
    if (!unit) throw new Error(`"${a.unit}" is not a unit this log keeps: miles or km. Nothing was written.`);
    const category = normalizeCategory(a.category);
    if (!category) throw new Error(`"${a.category}" is not a category a trip has. The categories are ${CATEGORIES.join(", ")}. Nothing was written.`);
    const dTh = distanceToThousandths(a.distance);
    if (dTh === null) throw new Error(`distance "${a.distance}" is not a distance to the thousandth of a ${unit === "miles" ? "mile" : "km"} between 0 and 10000. Log 12.5, and split a longer drive over two trips. Nothing was written.`);

    const rec = await locked(() => {
      const list = getTrips();
      if (list.length >= MAX_TRIPS) throw new Error(`the log already holds ${MAX_TRIPS} trips, which is the ceiling. Nothing was written.`);
      if (!gate.isPro()) {
        const month = monthOf(date);
        const n = list.filter((t) => monthOf(t.date) === month).length;
        if (n >= FREE_TRIPS_PER_MONTH) {
          throw new Error(
            `the free tier holds ${FREE_TRIPS_PER_MONTH} trips per calendar month and ${month} already has ${n}. ` +
            `The cap is counted on the month of the trip date, so trips dated in another month still log. Nothing was written. ` +
            gate.upgradeText("unlimited trips", "trip_add"),
          );
        }
      }
      // Fix the pricing jurisdiction at log time when it is unambiguous, so a rate
      // added later under a second jurisdiction cannot silently reprice an old trip.
      let jurisdiction = a.jurisdiction?.trim() ?? null;
      if (!jurisdiction) {
        const covering = [...new Set(getRates().filter((r) => r.category === category).map((r) => r.jurisdiction))];
        if (covering.length === 1) jurisdiction = covering[0];
        else if (covering.length > 1) {
          throw new Error(`more than one jurisdiction has a ${category} rate (${covering.join(", ")}). Pass jurisdiction to say which prices this trip. Nothing was written.`);
        }
      }
      const t: Trip = {
        id: nextId(date.slice(0, 4), list.map((x) => x.id)),
        date, from: a.from.trim(), to: a.to.trim(),
        distance: dTh / 1000, unit,
        purpose: a.purpose.trim(), category, jurisdiction,
        note: a.note, logged: new Date().toISOString(),
      };
      list.push(t);
      setTrips(list);
      return t;
    });
    const notes: string[] = [];
    const free = freeTierNote(date);
    if (free) notes.push(free);
    const look = effectiveRate(getRates(), rec);
    if (!look.ok && rec.category !== "personal") notes.push(`No rate prices this trip yet: ${look.reason}. Set one with rate_set and mileage_summary will price it.`);
    notes.push(ROUNDING);
    return json({ logged: tripJson(rec), notes, basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("trip_list", { annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  title: "List trips",
  description: "List trips in the mileage log, oldest first: date, from, to, distance, category, and the amount each earns under the rate in force on its day (or the plain reason it is unpriced). Filter by date range and category. Reads only.",
  inputSchema: {
    from_date: str("from_date", 10).optional().describe("Only trips dated on or after this, YYYY-MM-DD"),
    to_date: str("to_date", 10).optional().describe("Only trips dated on or before this, YYYY-MM-DD"),
    category: str("category", 20).optional().describe(`Only trips of this category: ${CATEGORIES.join(", ")}`),
  },
}, async (a) => {
  try {
    const from = a.from_date ? checkDate(a.from_date, "from_date") : null;
    const to = a.to_date ? checkDate(a.to_date, "to_date") : null;
    if (from && to && from > to) throw new Error(`from_date ${from} is after to_date ${to}.`);
    let category: Category | null = null;
    if (a.category !== undefined) {
      category = normalizeCategory(a.category);
      if (!category) throw new Error(`"${a.category}" is not a category a trip has. The categories are ${CATEGORIES.join(", ")}.`);
    }
    let list = getTrips();
    if (from) list = list.filter((t) => t.date >= from);
    if (to) list = list.filter((t) => t.date <= to);
    if (category) list = list.filter((t) => t.category === category);
    list = [...list].sort(byDateThenId);
    const rates = getRates();
    return json({
      count: list.length,
      filters: { from_date: from, to_date: to, category },
      trips: list.map((t) => pricedJson(t, rates)),
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("trip_remove", { annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  title: "Remove a trip",
  description: "Remove one trip from the mileage log by its exact TR-YYYY-NNNN id, for entries made by mistake. The id is not reissued: a gap in the TR series is the record that a trip was removed.",
  inputSchema: {
    id: str("id", 20).describe("The exact trip id, e.g. TR-2026-0003"),
  },
}, async (a) => {
  try {
    const out = await locked(() => {
      const list = getTrips();
      const t = findTrip(list, a.id);
      if (!t) throw new Error(`no trip has the id "${a.id}". Known: ${list.map((x) => x.id).join(", ") || "none"}. Nothing was written.`);
      setTrips(list.filter((x) => x.id !== t.id));
      return t;
    });
    return json({
      removed: tripJson(out),
      note: "The id is not reissued. The TR series only ever goes up, so a gap in it is the record that a trip was removed.",
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("rate_set", { annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  title: "Set a mileage rate",
  description: "Set what one mile or km is worth for one category in one jurisdiction from a date forward: the jurisdiction label, the category, the rate per unit, the currency, and the date it takes effect. Rates form a series per jurisdiction and category, and each trip earns the rate in force on the day it was driven. No rate ships with this server; the figures are yours to verify. Free tier: one rate per jurisdiction and category; the year-over-year series is Pro.",
  inputSchema: {
    jurisdiction: str("jurisdiction", MAX_JURISDICTION).describe("A label for the rate set, e.g. US federal or Canada federal. It is a label, not legal advice"),
    category: str("category", 20).describe(`Which category this prices: ${CATEGORIES.join(", ")}`),
    rate: z.number().finite().positive().describe("The rate per unit in currency units, to the thousandth, e.g. 0.70 for 70 cents a mile"),
    unit: unitArg.describe("The distance unit the rate prices"),
    currency: z.string().regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO code such as USD").describe("ISO code the rate is in"),
    effective_from: str("effective_from", 10).describe("The date the rate starts to apply, YYYY-MM-DD. May be in the future: authorities announce next year's rate ahead of time"),
  },
}, async (a) => {
  try {
    const effective = checkDate(a.effective_from, "effective_from");
    const category = normalizeCategory(a.category);
    if (!category) throw new Error(`"${a.category}" is not a category a trip has. The categories are ${CATEGORIES.join(", ")}. Nothing was written.`);
    const unit = normalizeUnit(a.unit);
    if (!unit) throw new Error(`"${a.unit}" is not a unit this log keeps: miles or km. Nothing was written.`);
    const rTh = rateToThousandths(a.rate);
    if (rTh === null) throw new Error(`rate "${a.rate}" is not a rate to the thousandth of a currency unit between 0 and 100. Set 0.70 for 70 cents a mile. Nothing was written.`);
    const jurisdiction = a.jurisdiction.trim();
    const currency = a.currency.toUpperCase();

    const out = await locked(() => {
      const list = getRates();
      const sameSet = (r: Rate) =>
        r.jurisdiction.trim().toLowerCase() === jurisdiction.toLowerCase() && r.category === category;
      const existing = list.filter(sameSet);
      const sameDate = existing.find((r) => r.effective_from === effective);
      if (!sameDate && !gate.isPro() && existing.length >= 1) {
        throw new Error(
          `the free tier holds one ${category} rate for ${jurisdiction} and ${rateText(existing[0])} effective ${existing[0].effective_from} is already set. ` +
          `Setting a second effective-dated rate is the year-over-year series a full deduction history needs. ` +
          `Overwriting the existing rate stays free: call rate_set again with effective_from ${existing[0].effective_from}. Nothing was written. ` +
          gate.upgradeText("multi-rate support", "rate_set"),
        );
      }
      if (!sameDate && list.length >= MAX_RATES) throw new Error(`the rate book already holds ${MAX_RATES} rates, which is the ceiling. Nothing was written.`);
      const rate: Rate = {
        jurisdiction, category, unit, rate: rTh / 1000, currency,
        effective_from: effective, set: new Date().toISOString(),
      };
      let replaced: Rate | null = null;
      if (sameDate) {
        replaced = sameDate;
        setRates(list.map((r) => (r === sameDate ? rate : r)));
      } else {
        list.push(rate);
        setRates(list);
      }
      return { rate, replaced };
    });
    const notes: string[] = [];
    if (out.replaced) {
      notes.push(`Replaced the ${category} rate for ${jurisdiction} effective ${effective}: was ${rateText(out.replaced)}, now ${rateText(out.rate)}. Trips already priced are repriced on the next read: a rate is a series, not a snapshot.`);
    } else {
      notes.push(`Trips dated on or after ${effective} in this category and jurisdiction now earn ${rateText(out.rate)}; earlier dates keep any earlier rate.`);
    }
    notes.push(ROUNDING);
    return json({ rate: rateJson(out.rate), replaced: out.replaced ? rateJson(out.replaced) : null, notes, basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("rate_list", { annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  title: "List the rates on file",
  description: "List every mileage rate on file, grouped by jurisdiction and category with the effective-from dates in order: the series each trip is priced from. Reads only.",
  inputSchema: {},
}, async () => {
  try {
    const list = [...getRates()].sort((x, y) =>
      x.jurisdiction === y.jurisdiction
        ? x.category === y.category
          ? (x.effective_from < y.effective_from ? -1 : 1)
          : x.category.localeCompare(y.category)
        : x.jurisdiction.localeCompare(y.jurisdiction));
    return json({
      count: list.length,
      rates: list.map(rateJson),
      rule: "A trip earns the rate for its category and jurisdiction with the latest effective_from on or before the trip's date.",
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("mileage_summary", { annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  title: "Summarize a date range",
  description: "The deductible mileage for a date range, per category: trips, distance kept per unit, the rate each trip earned (the one in force on its day), and the deductible amount, totalled per currency. Trips with no applicable rate are listed with the reason, not silently dropped. Defaults to the current calendar year. Never metered.",
  inputSchema: {
    from_date: str("from_date", 10).optional().describe("Start of the range, YYYY-MM-DD. Default January 1 of the current year"),
    to_date: str("to_date", 10).optional().describe("End of the range, YYYY-MM-DD. Default December 31 of the current year"),
    category: str("category", 20).optional().describe(`Only this category: ${CATEGORIES.join(", ")}`),
  },
}, async (a) => {
  try {
    const year = today().slice(0, 4);
    const from = a.from_date ? checkDate(a.from_date, "from_date") : `${year}-01-01`;
    const to = a.to_date ? checkDate(a.to_date, "to_date") : `${year}-12-31`;
    if (from > to) throw new Error(`from_date ${from} is after to_date ${to}.`);
    let category: Category | null = null;
    if (a.category !== undefined) {
      category = normalizeCategory(a.category);
      if (!category) throw new Error(`"${a.category}" is not a category a trip has. The categories are ${CATEGORIES.join(", ")}.`);
    }
    let list = getTrips().filter((t) => t.date >= from && t.date <= to);
    if (category) list = list.filter((t) => t.category === category);
    list = [...list].sort(byDateThenId);
    const s = summarize(list, getRates());
    const notes: string[] = [];
    if (s.unpriced.length) notes.push(`${s.unpriced.length} trip(s) in the window have no applicable rate and are excluded from the deductible figures, each with its reason under unpriced. Set the rate with rate_set and they price on the next read.`);
    if (s.personalUnpriced.length) notes.push(`${s.personalUnpriced.length} personal trip(s) are not priced: no jurisdiction prices personal mileage. Their distance is not in the deductible figures.`);
    notes.push(ROUNDING);
    return json({
      from, to, category: category ?? "all",
      trips_in_window: list.length,
      trips_priced: s.priced.length,
      categories: s.categories,
      totals: s.totals,
      unpriced: s.unpriced,
      personal_unpriced: s.personalUnpriced,
      notes, basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("mileage_export", { annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  title: "Export the log as CSV for an accountant",
  description: "The mileage log as CSV, one row per trip, oldest first: date, from, to, distance, unit, category, the rate applied (the one in force on the trip's day), the currency and the amount, plus purpose, jurisdiction, effective_from and id. The amount column is a bare number a spreadsheet reads. Refuses while any non-personal trip in the window is unpriced, so an accountant never receives a log with silent gaps. Pro.",
  inputSchema: {
    from_date: str("from_date", 10).optional().describe("Start of the range, YYYY-MM-DD. Default January 1 of the current year"),
    to_date: str("to_date", 10).optional().describe("End of the range, YYYY-MM-DD. Default December 31 of the current year"),
  },
}, async (a) => {
  try {
    if (!gate.isPro()) {
      throw new Error(gate.upgradeText("CSV export", "mileage_export"));
    }
    const year = today().slice(0, 4);
    const from = a.from_date ? checkDate(a.from_date, "from_date") : `${year}-01-01`;
    const to = a.to_date ? checkDate(a.to_date, "to_date") : `${year}-12-31`;
    if (from > to) throw new Error(`from_date ${from} is after to_date ${to}.`);
    const list = [...getTrips().filter((t) => t.date >= from && t.date <= to)].sort(byDateThenId);
    const s = summarize(list, getRates());
    if (s.unpriced.length) {
      throw new Error(
        `${s.unpriced.length} trip(s) in the window have no applicable rate: ${s.unpriced.map((u) => `${u.id} (${u.date}, ${u.category}: ${u.reason})`).join("; ")}. ` +
        `The export an accountant receives must be complete, so nothing was exported. Set the missing rates with rate_set and export again.`,
      );
    }
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows: string[] = [];
    rows.push("date,from,to,distance,unit,category,rate,rate_unit,currency,amount,purpose,jurisdiction,effective_from,id");
    for (const p of s.priced) {
      rows.push([
        p.trip.date, cell(p.trip.from), cell(p.trip.to), String(p.trip.distance), p.trip.unit, p.trip.category,
        String(p.rate.rate), p.rate.unit, p.rate.currency, csvAmount(p.cents),
        cell(p.trip.purpose), cell(p.rate.jurisdiction), p.rate.effective_from, p.trip.id,
      ].join(","));
    }
    // Pure data rows only: a comment or totals row would land in a spreadsheet as a
    // bogus trip. The totals live in mileage_summary, which reconciles line by line.
    return ok(rows.join("\n") + "\n");
  } catch (e) { return fail((e as Error).message); }
});

gate.registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-mileage-log ${VERSION} ready; store at ${dataDir()}\n`);
