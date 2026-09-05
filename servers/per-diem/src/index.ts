#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import { z } from "zod";
import { VERSION } from "./version.js";
import { currencyDecimals, formatMoney, table, type TableId } from "./tables.js";
import { calc, MAX_TRIP_DAYS, MEALS, SCHEMES, type CalcInput, type MealName, type SchemeId } from "./schemes.js";
import { dataDir, findTrip, getTrips, lockPath, nextTripId, setTrips, type Trip } from "./store.js";

/**
 * Free tier: five trips recorded in a calendar month, counted by the start date. Rate
 * lookups and the calculator itself are free and unlimited: a per diem rate is public
 * information published by a tax authority, and metering the reading of a public
 * regulation would be charging for the government's work rather than for this one.
 */
const FREE_TRIPS_PER_MONTH = 5;
const MAX_NAME = 200;
const MAX_TEXT = 2000;
const MAX_ROWS = 2000;
const MAX_NIGHTS = MAX_TRIP_DAYS;

const gate = createLicenseGate({ product: "per-diem" });

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

const str = (field: string, max: number) => z.string().max(max, `${field} must be ${max} characters or fewer`);

/** Every mutation takes this server's lock. Nothing else's store is written, so there is only one. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(lockPath(), fn, { timeoutMs: 20000 });
}

/* -------------------------------------------------------------- the profile */

/**
 * The shared business profile (`packages/mcp-license`, written by `business_set` in the
 * invoice server) has `name`, `address` and `default_currency` but NO country field, so
 * "home country" is not a fact this suite stores. Rather than infer one from the address
 * -- a free-text field where "Warszawa" and "Warsaw, PL" and "ul. Krucza 1" are all
 * normal -- the home SCHEME is derived from `default_currency`, which is a closed set,
 * and the derivation is always reported so the caller can see it was a guess and override
 * it. A profile with no currency yields no default scheme at all.
 */
const CURRENCY_TO_SCHEME: Record<string, SchemeId> = { PLN: "pl", GBP: "uk", USD: "us" };

interface Home { traveller?: string; currency?: string; scheme?: SchemeId; how: string }

function home(): Home {
  const p = readSharedProfile();
  const traveller = (p.name ?? "").trim() || undefined;
  const currency = (p.default_currency ?? "").trim().toUpperCase() || undefined;
  const scheme = currency ? CURRENCY_TO_SCHEME[currency] : undefined;
  const how = !currency
    ? "the shared business profile has no default_currency, so there is no home scheme; pass scheme explicitly"
    : scheme
      ? `home scheme "${scheme}" was derived from the shared profile's default_currency ${currency}. The profile has no country field, so this is a derivation, not a stored fact`
      : `the shared profile's default_currency ${currency} matches no bundled scheme (${SCHEMES.join(", ")}), so there is no home scheme`;
  return { traveller, currency, scheme, how };
}

/* ------------------------------------------------------------------- schema */

const schemeArg = z.enum(["pl", "uk", "us"]);
const mealList = z.array(z.enum(["breakfast", "lunch", "dinner"]));

function tripsInMonth(month: string): number {
  return getTrips().filter((t) => t.calc.start.slice(0, 7) === month).length;
}

function capRefusal(month: string, toolName: string): string {
  return `the free tier records ${FREE_TRIPS_PER_MONTH} trips a month and ${month} already has ${tripsInMonth(month)}. ` +
    `perdiem_rates and perdiem_calc stay free and unlimited, so the numbers are still available; only saving them is capped. ` +
    `Nothing was stored. ` + gate.upgradeText("unlimited trips", toolName);
}

function tripSummary(t: Trip) {
  return {
    id: t.id, name: t.name, traveller: t.traveller, purpose: t.purpose, project: t.project,
    scheme: t.calc.scheme, part: t.calc.part, destination: t.calc.destination,
    start: t.calc.start, end: t.calc.end, days: t.calc.days.length,
    currency: t.calc.currency, total: t.calc.total, total_minor: t.calc.total_minor,
    exported_at: t.exported_at,
  };
}

/* ------------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-per-diem", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

server.registerTool("perdiem_rates", {
  title: "List the bundled per diem rates",
  description: "List a scheme's bundled daily allowance rates with the authority, instrument, source URL and effective date they came from. Filter by country or city. Free and unlimited.",
  inputSchema: {
    scheme: schemeArg.optional().describe('"pl" Polish delegation regulation, "uk" HMRC benchmark scale rates, "us" GSA CONUS standard. Omit for every scheme'),
    country: z.string().optional().describe("Country name or ISO code, e.g. Germany or DE. Matched exactly first, then as a substring"),
    city: z.string().optional().describe("City or locality name, for the schemes that publish per-city rates"),
  },
}, async (a) => {
  try {
    const wanted: TableId[] = [];
    const push = (...ids: TableId[]) => wanted.push(...ids);
    if (!a.scheme || a.scheme === "pl") push("pl-domestic", "pl-foreign");
    if (!a.scheme || a.scheme === "uk") push("uk-domestic", "uk-overseas");
    if (!a.scheme || a.scheme === "us") push("us-gsa");
    const needle = (a.city ?? a.country ?? "").trim().toLowerCase();
    const out = wanted.map((id) => {
      const t = table(id);
      let rows = t.rates;
      if (needle) {
        rows = rows.filter((r) =>
          r.country.toLowerCase() === needle || (r.code ?? "").toLowerCase() === needle ||
          (r.locality ?? "").toLowerCase() === needle ||
          (needle.length >= 4 && (r.country.toLowerCase().startsWith(needle) || (r.locality ?? "").toLowerCase().startsWith(needle))));
      }
      return {
        table: id, header: t.header,
        fiscal_years: t.fiscal_years, current_fiscal_year: t.current_fiscal_year,
        count: rows.length,
        rates: rows.slice(0, MAX_ROWS).map((r) => ({
          ...r,
          diet: r.diet_minor !== undefined ? formatMoney(r.diet_minor, r.currency ?? "EUR") : undefined,
        })),
      };
    });
    const empty = out.filter((o) => o.count === 0);
    const notes = empty.map((o) => `${o.table}: nothing matched. ${o.header.coverage ?? "This table is bundled in full."}`);
    return json({ home: home().how, tables: out, notes: notes.length ? notes : undefined });
  } catch (e) { return fail((e as Error).message); }
});

const calcInput = {
  scheme: schemeArg.describe('"pl" Polish delegation regulation, "uk" HMRC benchmark scale rates, "us" GSA CONUS standard'),
  destination: z.string().min(1, "destination is required").max(MAX_NAME)
    .describe('Country or locality, e.g. "Germany", "Poland", "United Kingdom", "United States"'),
  start: z.string().min(1, "start is required")
    .describe('When the trip began, ISO 8601 WITH a zone: "2026-03-28T22:00:00+01:00", or "2026-03-28T22:00" together with timezone'),
  end: z.string().min(1, "end is required").describe("When it ended, same form as start. It must be after start as an instant"),
  timezone: z.string().optional().describe('IANA id such as "Europe/Warsaw". Required when start or end carries no offset; also the zone the US scheme counts calendar days in'),
  meals_provided: z.array(mealList).optional()
    .describe("Per day, in order: the free meals the traveller was given that day, e.g. [[\"breakfast\"],[\"breakfast\",\"lunch\"]]. Each one reduces that day's allowance by the scheme's own percentage or amount"),
  meals_provided_daily: mealList.optional().describe("The same free meals on every day. Ignored for any day that meals_provided already names"),
  lodging_nights: z.number().int().min(0).max(MAX_NIGHTS).optional().describe("Nights of accommodation. What this pays depends on the scheme and the answer says so"),
  late_evening: z.array(z.boolean()).optional().describe("UK only, per day: the journey was ongoing at 8pm and a meal was bought after it, which adds the 10.00 GBP supplement"),
  fiscal_year: z.string().optional().describe('US only, e.g. "FY2025". Defaults to the current bundled fiscal year'),
};

function toCalcInput(a: Record<string, unknown>): CalcInput {
  return {
    scheme: a.scheme as SchemeId,
    destination: a.destination as string,
    start: a.start as string,
    end: a.end as string,
    timezone: a.timezone as string | undefined,
    meals_provided: a.meals_provided as MealName[][] | undefined,
    meals_provided_daily: a.meals_provided_daily as MealName[] | undefined,
    lodging_nights: a.lodging_nights as number | undefined,
    late_evening: a.late_evening as boolean[] | undefined,
    fiscal_year: a.fiscal_year as string | undefined,
  };
}

server.registerTool("perdiem_calc", {
  title: "Calculate a travel allowance",
  description: "Calculate the daily travel allowance for one trip: the amount per day and the total in the scheme's currency, with the partial-day fraction and the meal deductions the scheme's own rule applies. Free and unlimited.",
  inputSchema: calcInput,
}, async (a) => {
  try { return json(calc(toCalcInput(a))); }
  catch (e) { return fail((e as Error).message); }
});

server.registerTool("trip_record", {
  title: "Save a calculated trip",
  description: "Calculate a trip and save it under a name, with the traveller taken from the shared business profile. Returns the TRIP-YYYY-NNNN id. Free tier: 5 trips a calendar month.",
  inputSchema: {
    name: str("name", MAX_NAME).min(1, "name is required").describe('What to call it, e.g. "Berlin client workshop"'),
    ...calcInput,
    traveller: str("traveller", MAX_NAME).optional().describe("Who travelled. Defaults to the shared business profile's name"),
    purpose: str("purpose", MAX_TEXT).optional().describe("Why the trip happened; kept on the record and carried onto the expense payload"),
    project: str("project", MAX_NAME).optional().describe("Project or client this belongs to; carried onto the expense payload"),
  },
}, async (a) => {
  try {
    const result = calc(toCalcInput(a));
    return await locked(() => {
      const month = result.start.slice(0, 7);
      if (!gate.isPro() && tripsInMonth(month) >= FREE_TRIPS_PER_MONTH) return fail(capRefusal(month, "trip_record"));
      const h = home();
      const traveller = (a.traveller ?? "").trim() || h.traveller;
      const list = getTrips();
      const now = new Date().toISOString();
      const t: Trip = {
        id: nextTripId(result.start.slice(0, 4), list.map((x) => x.id)),
        name: a.name.trim(),
        traveller: traveller ?? "unknown",
        traveller_source: (a.traveller ?? "").trim() ? "call" : traveller ? "shared profile" : "unknown",
        purpose: a.purpose, project: a.project,
        calc: result, created: now, updated: now,
      };
      list.push(t);
      setTrips(list);
      const notes: string[] = [];
      if (t.traveller_source === "unknown") {
        notes.push("No traveller: the shared business profile has no name and none was given. Run business_set {name} in the invoice server once and every later trip carries it.");
      }
      if (!gate.isPro()) {
        notes.push(`Free tier: ${tripsInMonth(month)} of ${FREE_TRIPS_PER_MONTH} trips recorded in ${month}. trip_export and perdiem_report are Pro.`);
      }
      return json({ recorded: { ...tripSummary(t), calc: result }, notes: notes.length ? notes : undefined });
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("trip_list", {
  title: "List saved trips",
  description: "List saved trips with the scheme, destination, dates and total on each, and a total per currency. Filter by scheme, destination, traveller, project and start date range. Free and unlimited.",
  inputSchema: {
    scheme: z.enum(["pl", "uk", "us", "all"]).optional().describe('Default "all"'),
    destination: z.string().optional().describe("Only trips to a destination containing this text"),
    traveller: z.string().optional().describe("Only trips by this traveller"),
    project: z.string().optional().describe("Only trips on this project"),
    from: z.string().optional().describe("YYYY-MM-DD, earliest start date"),
    to: z.string().optional().describe("YYYY-MM-DD, latest start date"),
  },
}, async (a) => {
  try {
    let list = getTrips();
    if (a.scheme && a.scheme !== "all") list = list.filter((t) => t.calc.scheme === a.scheme);
    if (a.destination) list = list.filter((t) => t.calc.destination.toLowerCase().includes(a.destination!.trim().toLowerCase()));
    if (a.traveller) list = list.filter((t) => t.traveller.toLowerCase().includes(a.traveller!.trim().toLowerCase()));
    if (a.project) list = list.filter((t) => (t.project ?? "").toLowerCase().includes(a.project!.trim().toLowerCase()));
    if (a.from) list = list.filter((t) => t.calc.start.slice(0, 10) >= a.from!);
    if (a.to) list = list.filter((t) => t.calc.start.slice(0, 10) <= a.to!);
    list = [...list].sort((x, y) => y.calc.start.localeCompare(x.calc.start) || y.id.localeCompare(x.id));
    const by = new Map<string, number>();
    for (const t of list) by.set(t.calc.currency, (by.get(t.calc.currency) ?? 0) + t.calc.total_minor);
    return json({
      count: list.length,
      totals: [...by.entries()].sort().map(([currency, minor]) => ({ currency, total: formatMoney(minor, currency), total_minor: minor })),
      trips: list.slice(0, MAX_ROWS).map(tripSummary),
    });
  } catch (e) { return fail((e as Error).message); }
});

/**
 * D-P1. `trip_export` builds an `expense_add`-ready payload and does NOT write into the
 * expense ledger.
 *
 * servers/expense-tracker exposes no `./lib` entry point in its package.json (its
 * `exports` map has only `.`), so there is no published store API to call. Its id
 * allocation, its category-rule matching, its VAT split and its currency defaulting all
 * live inside `src/index.ts`, inside the `expense_add` handler, under that server's own
 * lock. Reaching around that and appending a row to `data.json` directly would produce an
 * expense with no rule-matched category, no VAT split and an id allocated outside the
 * counter -- a row that looks native and is not.
 *
 * So the safe path is the one servers/kanban already uses for time-tracker
 * (`timeTrackerProjects` / its `timer_start` argument builder): hand back the exact
 * arguments for the owning server's own tool. One payload per currency, because
 * `expense_add` takes one currency per call and adding a PLN diet to a EUR one would be a
 * made-up number.
 */
server.registerTool("trip_export", {
  title: "Export a trip as expenses",
  description: "Return the exact expense_add arguments for a saved trip, one payload per currency, ready to pass to the expense-tracker server. It writes nothing itself: see the note in the answer. Pro.",
  inputSchema: {
    trip: z.string().min(1, "trip is required").describe("Trip id such as TRIP-2026-0001, or an exact or partial trip name"),
    category: str("category", MAX_NAME).optional().describe('Expense category to put on the payload. Default "travel"'),
    billable: z.boolean().optional().describe("Rebillable to the client. Default: true when the trip has a project, false otherwise"),
    split_lodging: z.boolean().optional().describe("Return lodging as its own expense rather than folded into the subsistence total. Default true"),
    mark_exported: z.boolean().optional().describe("Stamp exported_at on the trip so a later export can see it already went out. Default false"),
  },
}, async (a) => {
  try {
    if (!gate.isPro()) return fail(gate.upgradeText("trip export", "trip_export"));
    const list = getTrips();
    const t = findTrip(list, a.trip);
    if (!t) return fail(`no trip matches "${a.trip}". Run trip_list to see the ids.`);
    const category = (a.category ?? "travel").trim();
    const billable = a.billable ?? Boolean(t.project);
    const split = a.split_lodging !== false;
    const date = t.calc.start.slice(0, 10);
    const major = (minor: number, currency: string) => {
      const d = currencyDecimals(currency);
      return d === 0 ? minor : Number((minor / 10 ** d).toFixed(d));
    };
    const base = {
      currency: t.calc.currency, category, date, billable,
      merchant: t.calc.destination,
      project: t.project,
      note: [`${t.id} ${t.name}`, t.purpose, `${t.calc.scheme.toUpperCase()} per diem, ${t.calc.days.length} day(s), ${t.calc.part}`, t.calc.source.instrument].filter(Boolean).join(" | ").slice(0, 2000),
    };
    const payloads: Record<string, unknown>[] = [];
    if (t.calc.subsistence_minor > 0 || t.calc.lodging_minor === 0) {
      payloads.push({ tool: "expense_add", server: "expense-tracker", arguments: { ...base, amount: major(split ? t.calc.subsistence_minor : t.calc.total_minor, t.calc.currency) } });
    }
    if (split && t.calc.lodging_minor > 0) {
      payloads.push({ tool: "expense_add", server: "expense-tracker", arguments: { ...base, amount: major(t.calc.lodging_minor, t.calc.currency), category: `${category}/lodging`, note: `${base.note} | ${t.calc.lodging_nights} night(s), ${t.calc.lodging_basis}` } });
    }
    if (a.mark_exported) {
      await locked(() => {
        const fresh = getTrips();
        const row = fresh.find((x) => x.id === t.id);
        if (row) { row.exported_at = new Date().toISOString(); row.updated = row.exported_at; setTrips(fresh); }
      });
    }
    return json({
      trip: tripSummary(t),
      by_currency: [{ currency: t.calc.currency, total: t.calc.total, total_minor: t.calc.total_minor }],
      payloads,
      how: "Pass each payload's `arguments` to the expense-tracker server's expense_add tool, one call per payload. `amount` is in MAJOR units because that is what expense_add takes; the minor-unit figures are on the trip record.",
      why_not_written:
        "This server does not write into the expense ledger. servers/expense-tracker publishes no library entry point, and its id counter, category rules, VAT split and currency defaults all live inside its own expense_add handler under its own lock. Appending a row to its data.json directly would create an expense with none of those applied: it would look native and would not be. Handing back the arguments is the same contract servers/kanban uses for time-tracker's timer_start.",
      no_vat: "No vat_rate is set on the payload. A statutory per diem is an allowance, not a purchase, so there is no input VAT to reclaim on it; adding a rate here would invent a deductible amount.",
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("perdiem_report", {
  title: "Totals per scheme and month",
  description: "Total the saved trips per scheme and per calendar month, in each scheme's own currency, with the day count and the trips behind every figure. Pro.",
  inputSchema: {
    from: z.string().optional().describe("YYYY-MM, earliest month by start date"),
    to: z.string().optional().describe("YYYY-MM, latest month by start date"),
    scheme: z.enum(["pl", "uk", "us", "all"]).optional().describe('Default "all"'),
    traveller: z.string().optional().describe("Only this traveller"),
  },
}, async (a) => {
  try {
    if (!gate.isPro()) return fail(gate.upgradeText("the per diem report", "perdiem_report"));
    let list = getTrips();
    if (a.scheme && a.scheme !== "all") list = list.filter((t) => t.calc.scheme === a.scheme);
    if (a.traveller) list = list.filter((t) => t.traveller.toLowerCase().includes(a.traveller!.trim().toLowerCase()));
    if (a.from) list = list.filter((t) => t.calc.start.slice(0, 7) >= a.from!);
    if (a.to) list = list.filter((t) => t.calc.start.slice(0, 7) <= a.to!);
    interface Row { scheme: string; month: string; currency: string; trips: number; days: number; subsistence_minor: number; lodging_minor: number; total_minor: number; ids: string[] }
    const by = new Map<string, Row>();
    for (const t of list) {
      const month = t.calc.start.slice(0, 7);
      const key = `${t.calc.scheme}|${month}|${t.calc.currency}`;
      const r = by.get(key) ?? { scheme: t.calc.scheme, month, currency: t.calc.currency, trips: 0, days: 0, subsistence_minor: 0, lodging_minor: 0, total_minor: 0, ids: [] };
      r.trips += 1; r.days += t.calc.days.length;
      r.subsistence_minor += t.calc.subsistence_minor;
      r.lodging_minor += t.calc.lodging_minor;
      r.total_minor += t.calc.total_minor;
      r.ids.push(t.id);
      by.set(key, r);
    }
    const rows = [...by.values()].sort((x, y) => x.scheme.localeCompare(y.scheme) || x.month.localeCompare(y.month) || x.currency.localeCompare(y.currency));
    const perScheme = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const m = perScheme.get(r.scheme) ?? new Map<string, number>();
      m.set(r.currency, (m.get(r.currency) ?? 0) + r.total_minor);
      perScheme.set(r.scheme, m);
    }
    return json({
      trips: list.length,
      by_scheme_and_month: rows.map((r) => ({
        ...r,
        subsistence: formatMoney(r.subsistence_minor, r.currency),
        lodging: formatMoney(r.lodging_minor, r.currency),
        total: formatMoney(r.total_minor, r.currency),
      })),
      by_scheme: [...perScheme.entries()].sort().map(([scheme, m]) => ({
        scheme,
        totals: [...m.entries()].sort().map(([currency, minor]) => ({ currency, total: formatMoney(minor, currency), total_minor: minor })),
      })),
      basis: "A trip is counted in the month its START falls in, in the scheme's own currency. Currencies are never added together: a PLN diet and a EUR one are two figures, and one number over both would be an exchange rate this server does not have.",
    });
  } catch (e) { return fail((e as Error).message); }
});

gate.registerTools(server as unknown as { registerTool: Function });

/* ------------------------------------------------------ resource and prompt */

server.registerResource("schemes", "perdiem://schemes", {
  title: "Bundled per diem schemes",
  description: "Every bundled table with its authority, source URL, effective date and coverage, as JSON.",
  mimeType: "application/json",
}, async () => {
  const body = {
    schemes: SCHEMES,
    meals: MEALS,
    data_dir: dataDir(),
    tables: (["pl-domestic", "pl-foreign", "uk-domestic", "uk-overseas", "us-gsa"] as TableId[]).map((id) => {
      const t = table(id);
      return { table: id, header: t.header, rate_count: t.rates.length };
    }),
  };
  return { contents: [{ uri: "perdiem://schemes", mimeType: "application/json", text: JSON.stringify(body, null, 2) }] };
});

server.registerPrompt("claim_trip", {
  title: "Turn a trip into a per diem claim",
  description: "Work out the allowance for a trip, save it, and produce the expense lines for it.",
  argsSchema: {},
}, () => ({
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: [
        "1. Ask me the destination, the departure and return datetimes with a timezone, and which meals were provided free on which days.",
        "2. Call perdiem_rates for the scheme so we can both see the rate and where it came from.",
        "3. Call perdiem_calc and show me the per-day breakdown, the partial-day rule that was applied and every meal deduction.",
        "4. Call trip_record to save it under a name I give you.",
        "5. Call trip_export and give me the expense_add arguments to run against the expense-tracker server.",
      ].join("\n"),
    },
  }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("mcp-per-diem ready\n");
