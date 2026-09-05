#!/usr/bin/env node
/**
 * mcp-calendar: read the .ics files your calendar already exports, then answer the
 * questions a calendar app answers badly -- what is on next week, when am I actually
 * free, what is double-booked, and how do I get this meeting into my timesheet.
 *
 * Nothing is synced and no account is connected. A file (or, on Pro, a URL you paste)
 * is imported once, kept as plain .ics on this machine, and read locally.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve as pathResolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createLicenseGate, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import {
  UnknownZoneError, describe, hhmmToMinutes, icsCreateDetailed, isValidZone,
  offsetLabel, offsetMinutes, parseIsoDateStrict, resolveZone, timeKey, wallIn, zonedToUtc,
} from "@theluckystrike/mcp-timezone/lib";
import type { Wall } from "@theluckystrike/mcp-timezone/lib";
import {
  decodeIcs, expandAll, findConflicts, hashHex, mergeBlocks, occurrenceFromKey, occurrenceId,
  parseIcs, parseOccurrenceId, zoneOfEvent,
} from "./ics.js";
import type { CalEvent, Occurrence } from "./ics.js";
import { fetchIcs } from "./fetch.js";
import {
  PRODUCT, dataDir, icsFilePath, load, lockPath, orphanIcsFiles, readIcsText,
  removeIcs, save, slugify, writeIcsText,
} from "./store.js";
import type { CalendarRecord, DB } from "./store.js";
import { VERSION } from "./version.js";


/* --------------------------------------------------------------- free tier */

const FREE_MAX_CALENDARS = 2;
const FREE_MAX_WINDOW_DAYS = 31;
const FREE_MAX_EXPORT_EVENTS = 50;

/* ------------------------------------------------------------------ bounds */

const MAX_NAME = 80;
const MAX_PATH = 4096;
const MAX_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_QUERY = 200;
const MAX_WINDOW_DAYS = 1830;          // five years; the expansion cap does the rest
const MAX_IDS = 500;
const MAX_LIST_ROWS = 500;
const INTERNAL_LOOKAHEAD_DAYS = 366;   // next_event and calendar://today

const text = (max: number, what: string) =>
  z.string().max(max, `${what} must be ${max} characters or fewer`);

const gate = createLicenseGate({ product: PRODUCT });
const LOCK = lockPath();

/* -------------------------------------------------------------- primitives */

const ok = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const err = (t: string) => ({ content: [{ type: "text" as const, text: `Error: ${t}` }], isError: true });
/** A gated feature is not an error: the user must see the upgrade path. */
const gated = (feature: string, toolName?: string) => ok(gate.upgradeText(feature, toolName));

function guard<A>(fn: (a: A) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>) {
  return async (a: A) => {
    try { return await fn(a); }
    catch (e) { return err(e instanceof Error ? e.message : String(e)); }
  };
}

/** A leading `<scheme>://` means the caller has a URL, not a local path. Checked BEFORE
 * any resolution, so a URL is never joined against the server's cwd and the refusal
 * never has a path in it, let alone one that leaks the cwd. */
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

// D-R83: a URL handed to a path argument used to be silently resolved as a relative
// filesystem path, producing an error that leaked the server's own cwd. Refused by
// name instead.
function outPathOf(p: string): string {
  if (URL_SCHEME_RE.test(p)) {
    throw new Error(`"${p}" is a URL, not a file path; this tool writes local files. Give a local path to write to.`);
  }
  const abs = isAbsolute(p) ? p : pathResolve(process.cwd(), p);
  const dir = dirname(abs);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return abs;
}

/* ---------------------------------------------------------------- the zone */

/**
 * Every local time this server prints is in one zone: the one on the shared business
 * profile, which the user set once in the invoice or docx server. Without it, the
 * machine's own zone. A `zone` argument overrides both for a single call.
 */
function defaultZone(): string {
  const tz = readSharedProfile().timezone;
  if (tz && isValidZone(tz)) return tz;
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return local && isValidZone(local) ? local : "UTC";
}

function zoneArg(input?: string, notes?: string[]): string {
  if (!input || !input.trim()) return defaultZone();
  const hit = resolveZone(input);
  if (hit.note && notes && !notes.includes(hit.note)) notes.push(hit.note);
  return hit.zone;
}

/* ------------------------------------------------------------- the window */

export interface Window { fromUtc: Date; toUtc: Date; fromDate: string; toDate: string; days: number; zone: string }

const P2 = (n: number) => String(n).padStart(2, "0");
const isoDate = (w: Wall) => `${w.y}-${P2(w.m)}-${P2(w.d)}`;

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * A window is whole local days: `from` starts at 00:00 and `to` ends at 24:00, so
 * "2026-03-09 to 2026-03-09" is one day and includes an event at 23:30. Building it
 * from the zone rather than from UTC is what makes a Warsaw day 23 hours long on the
 * DST Sunday instead of silently 24.
 */
function windowOf(from: string, to: string, zone: string): Window {
  const a = parseIsoDateStrict(String(from).slice(0, 10), "from");
  const b = parseIsoDateStrict(String(to).slice(0, 10), "to");
  const fromDate = isoDate(a);
  const toDate = isoDate(b);
  if (toDate < fromDate) throw new Error(`"to" (${toDate}) is before "from" (${fromDate}).`);
  const fromUtc = zonedToUtc({ ...a, h: 0, mi: 0, s: 0 }, zone, { gap: "forward" });
  const nextDay = parseIsoDateStrict(addDaysIso(toDate, 1), "to");
  const toUtc = zonedToUtc({ ...nextDay, h: 0, mi: 0, s: 0 }, zone, { gap: "forward" });
  const days = Math.round((new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / 86_400_000) + 1;
  if (days > MAX_WINDOW_DAYS) throw new Error(`that window is ${days} days; ${MAX_WINDOW_DAYS} is the most this server will expand at once.`);
  return { fromUtc, toUtc, fromDate, toDate, days, zone };
}

/** The free tier reads a month at a time; Pro reads any window. Returns the gate text when it applies. */
function windowGate(w: Window): string | null {
  if (gate.isPro() || w.days <= FREE_MAX_WINDOW_DAYS) return null;
  return `a ${w.days}-day window (the free tier reads up to ${FREE_MAX_WINDOW_DAYS} days at a time)`;
}

/**
 * D-R55: a double booking is a check the caller otherwise makes by eye and gets wrong, so
 * the conflict scan is never refused. Over the free window it is SHRUNK to the first
 * FREE_MAX_WINDOW_DAYS days and the answer names the cap and the Pro extension.
 */
function clampWindow(w: Window, zone: string, feature: string): { w: Window; note?: string } {
  if (gate.isPro() || w.days <= FREE_MAX_WINDOW_DAYS) return { w };
  const cappedTo = addDaysIso(w.fromDate, FREE_MAX_WINDOW_DAYS - 1);
  return {
    w: windowOf(w.fromDate, cappedTo, zone),
    note: `Free tier checks ${FREE_MAX_WINDOW_DAYS} days at a time, so this covers ${w.fromDate} to ${cappedTo} of the ${w.fromDate} to ${w.toDate} you asked for. ${gate.upgradeText(feature)}`,
  };
}

function todayIn(zone: string): string {
  return isoDate(wallIn(new Date(), zone));
}

/* ------------------------------------------------------------- calendars */

function pickCalendars(db: DB, name?: string | string[]): CalendarRecord[] {
  const all = Object.values(db.calendars).sort((a, b) => a.name.localeCompare(b.name));
  if (!name || (Array.isArray(name) && !name.length)) return all;
  const wanted = (Array.isArray(name) ? name : [name]).map(s => String(s).trim()).filter(Boolean);
  const out: CalendarRecord[] = [];
  for (const w of wanted) {
    const slug = slugify(w);
    const hit = db.calendars[slug]
      ?? all.find(c => c.name.toLowerCase() === w.toLowerCase())
      ?? all.find(c => c.name.toLowerCase().includes(w.toLowerCase()));
    if (!hit) {
      throw new Error(all.length
        ? `no calendar called "${w}". Imported: ${all.map(c => c.name).join(", ")}.`
        : `no calendars are imported yet. Run ics_import {path: "/path/to/calendar.ics", name: "work"} first.`);
    }
    if (!out.includes(hit)) out.push(hit);
  }
  return out;
}

interface Loaded { rec: CalendarRecord; events: CalEvent[]; warnings: string[] }

/**
 * One tool call used to re-read and re-parse the whole .ics. On a 5 MB, 20,000-event
 * export that was 1.5 s of parsing on every call, so four questions in a row cost
 * 18 s. The parse is cached per process on the file's identity (path, size, mtime),
 * which an external edit or a re-import invalidates on its own.
 */
const parseCache = new Map<string, { size: number; mtimeMs: number; events: CalEvent[]; warnings: string[] }>();
const PARSE_CACHE_MAX = 8;

function parseCached(rec: CalendarRecord, raw: () => string): { events: CalEvent[]; warnings: string[] } {
  let key: string, size = -1, mtimeMs = -1;
  try {
    const st = statSync(rec.file);
    size = st.size; mtimeMs = st.mtimeMs; key = rec.file;
  } catch { key = ""; }
  if (key) {
    const hit = parseCache.get(key);
    if (hit && hit.size === size && hit.mtimeMs === mtimeMs) return { events: hit.events, warnings: hit.warnings };
  }
  const parsed = parseIcs(raw());
  if (key) {
    if (parseCache.size >= PARSE_CACHE_MAX) parseCache.delete(parseCache.keys().next().value as string);
    parseCache.set(key, { size, mtimeMs, events: parsed.events, warnings: parsed.warnings });
  }
  return { events: parsed.events, warnings: parsed.warnings };
}

function loadEvents(recs: CalendarRecord[]): Loaded[] {
  const out: Loaded[] = [];
  for (const rec of recs) {
    const raw = () => {
      try { return readIcsText(rec); }
      catch (e) {
        throw new Error(
          `the stored copy of "${rec.name}" is missing or unreadable (${rec.file}: ${(e as Error).message}). ` +
          `Re-import it with ics_import, or drop it with ics_forget {name: "${rec.name}"}.`,
        );
      }
    };
    const parsed = parseCached(rec, raw);
    out.push({ rec, events: parsed.events, warnings: parsed.warnings });
  }
  return out;
}

/* ---------------------------------------------------------------- display */

function fmtLocal(d: Date, zone: string): string {
  const w = wallIn(d, zone);
  return `${isoDate(w)} ${timeKey(w)}`;
}
function fmtTime(d: Date, zone: string): string {
  return timeKey(wallIn(d, zone));
}
function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}
function hm(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

interface Row { id: string; occ: Occurrence; cal: string }

function rowsFor(loaded: Loaded[], w: Window, limit = MAX_LIST_ROWS): { rows: Row[]; truncated: boolean; warnings: string[] } {
  const rows: Row[] = [];
  const warnings: string[] = [];
  for (const l of loaded) {
    for (const wn of l.warnings) if (!warnings.includes(wn)) warnings.push(wn);
    const occs = expandAll(l.events, { fromUtc: w.fromUtc, toUtc: w.toUtc, defaultZone: w.zone });
    for (const occ of occs) rows.push({ id: occurrenceId(l.rec.slug, occ), occ, cal: l.rec.name });
  }
  rows.sort((a, b) => a.occ.startUtc.getTime() - b.occ.startUtc.getTime() || a.cal.localeCompare(b.cal) || a.occ.event.summary.localeCompare(b.occ.event.summary));
  const truncated = rows.length > limit;
  return { rows: truncated ? rows.slice(0, limit) : rows, truncated, warnings };
}

function renderRows(rows: Row[], zone: string, showCal: boolean): string {
  const byDay = new Map<string, Row[]>();
  for (const r of rows) {
    const k = isoDate(wallIn(r.occ.startUtc, zone));
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(r);
  }
  const out: string[] = [];
  for (const [day, list] of byDay) {
    const wd = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
    out.push(`${day} ${wd}`);
    for (const r of list) {
      const endDay = isoDate(wallIn(r.occ.endUtc, zone));
      const when = r.occ.allDay
        ? "all day"
        : endDay === day
          ? `${fmtTime(r.occ.startUtc, zone)}-${fmtTime(r.occ.endUtc, zone)}`
          // An event that ends on another day reads as a wrong one-line time range
          // unless the end date is spelled out: "05:00-05:00" for a three-year block.
          : `${fmtTime(r.occ.startUtc, zone)} to ${endDay} ${fmtTime(r.occ.endUtc, zone)}`;
      const att = r.occ.event.attendees;
      const bits = [
        `  ${when.padEnd(13)} ${r.occ.event.summary}`,
        r.occ.event.location ? ` @ ${r.occ.event.location}` : "",
        att.length ? ` with ${att.slice(0, 6).join(", ")}${att.length > 6 ? ` and ${att.length - 6} more` : ""}` : "",
        showCal ? ` [${r.cal}]` : "",
        `  id ${r.id}`,
      ];
      out.push(bits.join(""));
    }
  }
  return out.join("\n");
}

function withNotes(body: string, notes: string[]): string {
  return notes.length ? `${body}\n\n${notes.map(n => `Note: ${n}`).join("\n")}` : body;
}

/* ----------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-calendar", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);
gate.registerTools(server as unknown as { registerTool: Function });

/* -------------------------------------------------------------- ics_import */

server.registerTool("ics_import", {
  title: "Import a calendar (.ics)",
  description:
    "Call this tool to read a calendar export and keep it under a name. Give path (.ics file), text (contents), or url (public .ics/webcal feed; Pro). Google, Apple, Outlook exports read. Re-importing a name replaces it.",
  inputSchema: {
    path: text(MAX_PATH, "path").optional().describe("Path to a .ics file on this machine"),
    url: text(MAX_PATH, "url").optional().describe("Public https:// or webcal:// .ics feed. Fetched once, only because you asked; Pro feature"),
    text: z.string().max(MAX_TEXT_BYTES, "text is larger than 5 MB").optional().describe("The .ics file contents, pasted"),
    name: text(MAX_NAME, "name").describe('What to call this calendar, e.g. "work" or "family"'),
  },
}, guard(async (a: { path?: string; url?: string; text?: string; name: string }) => {
  const given = [a.path, a.url, a.text].filter(v => v !== undefined && String(v).trim() !== "");
  if (given.length === 0) throw new Error('give one of path, text or url, plus a name. Example: ics_import {path: "~/Downloads/basic.ics", name: "work"}');
  if (given.length > 1) throw new Error("give exactly one of path, text or url, not several.");
  const name = a.name.trim();
  if (!name) throw new Error("name cannot be empty.");
  const slug = slugify(name);

  let raw: string;
  let source: CalendarRecord["source"];
  let ref: string | undefined;
  if (a.url && a.url.trim()) {
    // The refusal has to name the free path that does the same thing, or a caller reads
    // "Pro feature" and stops: url only adds fetching the feed, and text stores the same
    // events for nothing (D-R58).
    if (!gate.isPro())
      return ok(
        gate.upgradeText("importing a calendar from a URL", "ics_import") +
          `\n\nFree alternative, same result: open the feed in a browser or download the .ics, then paste the ` +
          `file contents - ics_import {name: "${name}", text: "<the .ics contents>"}. url only adds fetching the ` +
          `feed for you; the events, the parser and the free-tier calendar allowance are identical.`,
      );
    const got = await fetchIcs(a.url.trim());
    raw = got.text; source = "url"; ref = got.finalUrl;
  } else if (a.path && a.path.trim()) {
    const p = a.path.trim().replace(/^~(?=\/|$)/, process.env.HOME ?? "~");
    if (URL_SCHEME_RE.test(p)) {
      throw new Error(
        `"${p}" is a URL, not a file path; this tool reads local files. Use the url argument of this ` +
        `same tool (ics_import {url: ..., name: ...}) instead of path.`,
      );
    }
    const abs = isAbsolute(p) ? p : pathResolve(process.cwd(), p);
    if (!existsSync(abs)) throw new Error(`no file at ${abs}.`);
    const st = statSync(abs);
    if (st.isDirectory()) throw new Error(`${abs} is a directory; point at the .ics file itself.`);
    if (st.size > MAX_TEXT_BYTES) throw new Error(`${abs} is ${(st.size / 1048576).toFixed(1)} MB; the limit is 5 MB. Export a narrower date range.`);
    raw = decodeIcs(readFileSync(abs));
    source = "file"; ref = abs;
  } else {
    raw = String(a.text);
    source = "text";
  }

  const parsed = parseIcs(raw);
  return withFileLock(LOCK, async () => {
    const db = load();
    const replacing = Boolean(db.calendars[slug]);
    if (!replacing && !gate.isPro() && Object.keys(db.calendars).length >= FREE_MAX_CALENDARS) {
      return gated(`a ${FREE_MAX_CALENDARS + 1}th calendar (the free tier keeps ${FREE_MAX_CALENDARS})`, "ics_import");
    }
    const file = writeIcsText(slug, raw);
    db.calendars[slug] = {
      name, slug, source, ref,
      imported: new Date().toISOString(),
      events: parsed.events.length,
      bytes: Buffer.byteLength(raw, "utf8"),
      file,
    };
    save(db);
    const recurring = parsed.events.filter(e => e.rrule).length;
    const notes = [...parsed.warnings];
    if (!gate.isPro()) {
      const left = FREE_MAX_CALENDARS - Object.keys(db.calendars).length;
      notes.push(`Free tier: ${Object.keys(db.calendars).length} of ${FREE_MAX_CALENDARS} calendars used${left > 0 ? `, ${left} left` : ""}.`);
    }
    return ok(withNotes(
      `${replacing ? "Replaced" : "Imported"} calendar "${name}" (${parsed.events.length} event definition(s), ${recurring} recurring)` +
      `${parsed.calendarName ? `, named "${parsed.calendarName}" in the file` : ""}.\n` +
      `Source: ${source}${ref ? ` ${ref}` : ""}\nStored: ${file}\n` +
      `Next: events_list {calendar: "${name}", from: "${todayIn(defaultZone())}", to: "${addDaysIso(todayIn(defaultZone()), 7)}"}`,
      notes,
    ));
  });
}));

/* ------------------------------------------------------------ calendars_list */

server.registerTool("calendars_list", {
  title: "List imported calendars",
  description: "Every calendar imported into this server: its name, where it came from, how many event definitions it holds and when it was imported.",
  inputSchema: {},
}, guard(async () => {
  const db = load();
  const list = Object.values(db.calendars).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) {
    return ok(
      "No calendars imported yet.\n" +
      "Export one from your calendar app and import it:\n" +
      "  Google Calendar: Settings -> Import & export -> Export, then ics_import {path: \"<the .ics inside the zip>\", name: \"work\"}\n" +
      "  Apple Calendar: File -> Export -> Export...\n" +
      "  Outlook: File -> Save Calendar as .ics",
    );
  }
  const lines = list.map(c =>
    `${c.name} (${c.events} event definition(s), ${(c.bytes / 1024).toFixed(0)} KB, ${c.source}${c.ref ? ` ${c.ref}` : ""}, imported ${c.imported.slice(0, 16).replace("T", " ")})`);
  const orphans = orphanIcsFiles(db);
  const notes: string[] = [];
  if (orphans.length) notes.push(`${orphans.length} stored .ics file(s) in ${dataDir()} have no calendar row and are ignored: ${orphans.join(", ")}.`);
  if (!gate.isPro()) notes.push(`Free tier: ${list.length} of ${FREE_MAX_CALENDARS} calendars.`);
  return ok(withNotes(`${list.length} calendar(s), local times in ${defaultZone()}:\n${lines.join("\n")}`, notes));
}));

/* --------------------------------------------------------------- events_list */

server.registerTool("events_list", {
  title: "List events in a window",
  description:
    "Every event between two dates, recurring expanded to occurrences, sorted by start. Times shown in your zone (profile's, else this machine's) unless zone passed. Each id works for event_export or event_to_time_entry.",
  inputSchema: {
    calendar: text(MAX_NAME, "calendar").optional().describe("One calendar name; default every imported calendar"),
    from: text(20, "from").describe("First day, YYYY-MM-DD"),
    to: text(20, "to").describe("Last day, YYYY-MM-DD, included"),
    zone: text(100, "zone").optional().describe("Show local times in this zone or city instead of your own"),
  },
}, guard(async (a: { calendar?: string; from: string; to: string; zone?: string }) => {
  const notes: string[] = [];
  const zone = zoneArg(a.zone, notes);
  const w = windowOf(a.from, a.to, zone);
  const g = windowGate(w);
  if (g) return gated(g, "events_list");
  const db = load();
  const recs = pickCalendars(db, a.calendar);
  if (!recs.length) return ok("No calendars imported yet. Run ics_import first.");
  const { rows, truncated, warnings } = rowsFor(loadEvents(recs), w);
  notes.push(...warnings);
  if (truncated) notes.push(`only the first ${MAX_LIST_ROWS} occurrences are shown; narrow the window.`);
  if (!rows.length) {
    return ok(withNotes(`No events between ${w.fromDate} and ${w.toDate} in ${recs.map(r => r.name).join(", ")} (times in ${zone}).`, notes));
  }
  const head = `${rows.length} event(s) ${w.fromDate} to ${w.toDate}, times in ${zone} (${offsetLabel(offsetMinutes(w.fromUtc, zone))}):`;
  return ok(withNotes(`${head}\n${renderRows(rows, zone, recs.length > 1)}`, notes));
}));

/* ------------------------------------------------------------- events_search */

server.registerTool("events_search", {
  title: "Search events",
  description:
    "Find events whose title, description, location or attendees contain a phrase. Searches every imported calendar. " +
    "Without from/to it looks a year back and a year forward on Pro, and the free window either side of today.",
  inputSchema: {
    query: text(MAX_QUERY, "query").describe("Words to look for, case-insensitive"),
    from: text(20, "from").optional().describe("First day, YYYY-MM-DD"),
    to: text(20, "to").optional().describe("Last day, YYYY-MM-DD, included"),
  },
}, guard(async (a: { query: string; from?: string; to?: string }) => {
  const q = a.query.trim().toLowerCase();
  if (!q) throw new Error("query cannot be empty.");
  const notes: string[] = [];
  const zone = defaultZone();
  const today = todayIn(zone);
  const span = gate.isPro() ? 365 : Math.floor(FREE_MAX_WINDOW_DAYS / 2);
  const from = a.from?.trim() || addDaysIso(today, -span);
  const to = a.to?.trim() || addDaysIso(today, span);
  const w = windowOf(from, to, zone);
  const g = windowGate(w);
  if (g) return gated(g, "events_search");
  const db = load();
  const recs = pickCalendars(db);
  if (!recs.length) return ok("No calendars imported yet. Run ics_import first.");
  const { rows, warnings } = rowsFor(loadEvents(recs), w, MAX_LIST_ROWS);
  notes.push(...warnings);
  const hits = rows.filter(r => {
    const e = r.occ.event;
    return [e.summary, e.description ?? "", e.location ?? "", e.attendees.join(" "), e.organizer ?? ""]
      .join("\n").toLowerCase().includes(q);
  });
  if (!hits.length) {
    return ok(withNotes(`Nothing matching "${a.query}" between ${w.fromDate} and ${w.toDate}.`, notes));
  }
  return ok(withNotes(
    `${hits.length} match(es) for "${a.query}" ${w.fromDate} to ${w.toDate}, times in ${zone}:\n${renderRows(hits, zone, recs.length > 1)}`,
    notes,
  ));
}));

/* ----------------------------------------------------------------- free_busy */

server.registerTool("free_busy", {
  title: "Busy blocks and free windows",
  description:
    "Where the time actually went: merged busy blocks from the calendars named, and the gaps in your working hours where nothing is booked. Free/transparent events do not count as busy; whole-day events block the day.",
  inputSchema: {
    calendars: z.array(text(MAX_NAME, "calendar")).max(20).optional().describe("Calendar names; default all of them"),
    from: text(20, "from").describe("First day, YYYY-MM-DD"),
    to: text(20, "to").describe("Last day, YYYY-MM-DD, included"),
    work_start: text(10, "work_start").optional().describe("Start of your working day, HH:MM, default 09:00"),
    work_end: text(10, "work_end").optional().describe("End of your working day, HH:MM, default 17:00"),
    zone: text(100, "zone").optional().describe("Zone the working hours and the output are in; default your own"),
  },
}, guard(async (a: { calendars?: string[]; from: string; to: string; work_start?: string; work_end?: string; zone?: string }) => {
  const notes: string[] = [];
  const zone = zoneArg(a.zone, notes);
  const w = windowOf(a.from, a.to, zone);
  const g = windowGate(w);
  if (g) return gated(g, "free_busy");
  const startMin = hhmmToMinutes(a.work_start ?? "09:00", "work_start");
  const endMin = hhmmToMinutes(a.work_end ?? "17:00", "work_end");
  if (endMin <= startMin) throw new Error(`work_end (${a.work_end ?? "17:00"}) must be after work_start (${a.work_start ?? "09:00"}).`);
  const db = load();
  const recs = pickCalendars(db, a.calendars);
  if (!recs.length) return ok("No calendars imported yet. Run ics_import first.");
  const { rows, warnings } = rowsFor(loadEvents(recs), w, MAX_LIST_ROWS);
  notes.push(...warnings);

  const busySrc = rows
    .filter(r => !r.occ.event.transparent)
    .map(r => ({ startUtc: r.occ.startUtc, endUtc: r.occ.endUtc, label: r.occ.event.summary }));
  const blocks = mergeBlocks(busySrc);

  const out: string[] = [];
  let freeMin = 0, busyMin = 0;
  for (let day = w.fromDate; day <= w.toDate; day = addDaysIso(day, 1)) {
    const dayWall = parseIsoDateStrict(day, "day");
    const dayStart = zonedToUtc({ ...dayWall, h: Math.floor(startMin / 60), mi: startMin % 60, s: 0 }, zone, { gap: "forward" });
    const dayEnd = endMin >= 1440
      ? zonedToUtc({ ...parseIsoDateStrict(addDaysIso(day, 1), "day"), h: 0, mi: 0, s: 0 }, zone, { gap: "forward" })
      : zonedToUtc({ ...dayWall, h: Math.floor(endMin / 60), mi: endMin % 60, s: 0 }, zone, { gap: "forward" });
    const wd = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
    const dayBlocks = blocks
      .filter(b => b.endUtc > dayStart && b.startUtc < dayEnd)
      .map(b => ({
        startUtc: new Date(Math.max(b.startUtc.getTime(), dayStart.getTime())),
        endUtc: new Date(Math.min(b.endUtc.getTime(), dayEnd.getTime())),
        labels: b.labels,
      }));
    const lines: string[] = [`${day} ${wd} (${fmtTime(dayStart, zone)}-${fmtTime(dayEnd, zone)})`];
    if (!dayBlocks.length) {
      lines.push(`  free  ${fmtTime(dayStart, zone)}-${fmtTime(dayEnd, zone)}  ${hm(minutesBetween(dayStart, dayEnd))}`);
      freeMin += minutesBetween(dayStart, dayEnd);
    } else {
      let cursor = dayStart;
      for (const b of dayBlocks) {
        if (b.startUtc > cursor) {
          const m = minutesBetween(cursor, b.startUtc);
          lines.push(`  free  ${fmtTime(cursor, zone)}-${fmtTime(b.startUtc, zone)}  ${hm(m)}`);
          freeMin += m;
        }
        const bm = minutesBetween(b.startUtc, b.endUtc);
        lines.push(`  busy  ${fmtTime(b.startUtc, zone)}-${fmtTime(b.endUtc, zone)}  ${hm(bm)}  ${b.labels.join(", ")}`);
        busyMin += bm;
        if (b.endUtc > cursor) cursor = b.endUtc;
      }
      if (cursor < dayEnd) {
        const m = minutesBetween(cursor, dayEnd);
        lines.push(`  free  ${fmtTime(cursor, zone)}-${fmtTime(dayEnd, zone)}  ${hm(m)}`);
        freeMin += m;
      }
    }
    out.push(lines.join("\n"));
  }
  return ok(withNotes(
    `${w.fromDate} to ${w.toDate}, working hours ${a.work_start ?? "09:00"}-${a.work_end ?? "17:00"} in ${zone}. ` +
    `${hm(busyMin)} booked inside working hours, ${hm(freeMin)} free, from ${blocks.length} busy block(s) across ${recs.map(r => r.name).join(", ")}.\n\n` +
    out.join("\n"),
    notes,
  ));
}));

/* ----------------------------------------------------------------- conflicts */

server.registerTool("conflicts", {
  title: "Find double bookings",
  description:
    "Every pair of events overlapping in time, with minutes they collide. Across all calendars unless one named, so a clashing work/family event is caught. Whole-day events reported separately. Free: 31 days; Pro: any window.",
  inputSchema: {
    calendar: text(MAX_NAME, "calendar").optional().describe("One calendar name; default every imported calendar"),
    from: text(20, "from").describe("First day, YYYY-MM-DD"),
    to: text(20, "to").describe("Last day, YYYY-MM-DD, included"),
  },
}, guard(async (a: { calendar?: string; from: string; to: string }) => {
  const notes: string[] = [];
  const zone = defaultZone();
  const asked = windowOf(a.from, a.to, zone);
  const clamped = clampWindow(asked, zone, "conflict checks over any window");
  const w = clamped.w;
  if (clamped.note) notes.push(clamped.note);
  const db = load();
  const recs = pickCalendars(db, a.calendar);
  if (!recs.length) return ok("No calendars imported yet. Run ics_import first.");
  const loaded = loadEvents(recs);
  const { rows, warnings } = rowsFor(loaded, w, MAX_LIST_ROWS);
  notes.push(...warnings);
  const calOf = new Map<Occurrence, string>();
  for (const r of rows) calOf.set(r.occ, r.cal);
  const timed = rows.filter(r => !r.occ.allDay).map(r => r.occ);
  const pairs = findConflicts(timed);
  if (!pairs.length) {
    return ok(withNotes(`No overlapping events between ${w.fromDate} and ${w.toDate} across ${recs.map(r => r.name).join(", ")}.`, notes));
  }
  const lines = pairs.map(p => {
    const day = isoDate(wallIn(p.a.startUtc, zone));
    return `${day}  ${p.overlapMinutes} min overlap\n` +
      `  ${fmtTime(p.a.startUtc, zone)}-${fmtTime(p.a.endUtc, zone)}  ${p.a.event.summary} [${calOf.get(p.a) ?? "?"}]\n` +
      `  ${fmtTime(p.b.startUtc, zone)}-${fmtTime(p.b.endUtc, zone)}  ${p.b.event.summary} [${calOf.get(p.b) ?? "?"}]`;
  });
  return ok(withNotes(`${pairs.length} overlapping pair(s) ${w.fromDate} to ${w.toDate}, times in ${zone}:\n${lines.join("\n")}`, notes));
}));

/* ---------------------------------------------------------------- next_event */

server.registerTool("next_event", {
  title: "Next event",
  description: "The next event that has not started yet, with how long until it begins. Looks ahead up to a year.",
  inputSchema: {
    calendar: text(MAX_NAME, "calendar").optional().describe("One calendar name; default every imported calendar"),
  },
}, guard(async (a: { calendar?: string }) => {
  const zone = defaultZone();
  const db = load();
  const recs = pickCalendars(db, a.calendar);
  if (!recs.length) return ok("No calendars imported yet. Run ics_import first.");
  const now = new Date();
  const fromUtc = now;
  const toUtc = new Date(now.getTime() + INTERNAL_LOOKAHEAD_DAYS * 86_400_000);
  const rows: Row[] = [];
  const notes: string[] = [];
  for (const l of loadEvents(recs)) {
    for (const wn of l.warnings) if (!notes.includes(wn)) notes.push(wn);
    for (const occ of expandAll(l.events, { fromUtc, toUtc, defaultZone: zone, limit: 2000 })) {
      if (occ.startUtc >= now) rows.push({ id: occurrenceId(l.rec.slug, occ), occ, cal: l.rec.name });
    }
  }
  rows.sort((x, y) => x.occ.startUtc.getTime() - y.occ.startUtc.getTime());
  const next = rows[0];
  if (!next) return ok(withNotes(`Nothing scheduled in the next ${INTERNAL_LOOKAHEAD_DAYS} days in ${recs.map(r => r.name).join(", ")}.`, notes));
  const mins = minutesBetween(now, next.occ.startUtc);
  const e = next.occ.event;
  return ok(withNotes([
    `${e.summary} [${next.cal}]`,
    next.occ.allDay
      ? `${isoDate(wallIn(next.occ.startUtc, zone))}, all day`
      : `${describe(next.occ.startUtc, zone)} to ${fmtTime(next.occ.endUtc, zone)} (${hm(minutesBetween(next.occ.startUtc, next.occ.endUtc))})`,
    `Starts in ${hm(mins)}`,
    e.location ? `Where: ${e.location}` : "",
    e.attendees.length ? `With: ${e.attendees.slice(0, 10).join(", ")}${e.attendees.length > 10 ? ` and ${e.attendees.length - 10} more` : ""}` : "",
    `id ${next.id}`,
  ].filter(Boolean).join("\n"), notes));
}));

/* -------------------------------------------------------------- event_export */

/**
 * The .ics is written with the timezone server's writer -- the same escaping, folding
 * and UTC DTSTART used by its own invites -- and the VEVENT blocks are then merged
 * into one VCALENDAR, so a multi-event export is byte-for-byte the shape a client
 * already accepts from this suite.
 */
/** RFC 5545 3.3.11 TEXT escaping, for the VEVENT this server writes itself. */
function icsText(v: string): string {
  return String(v).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function foldIcsLine(l: string): string {
  const b = Buffer.from(l, "utf8");
  if (b.length <= 75) return l;
  const out: string[] = [];
  let i = 0;
  while (i < b.length) {
    let take = Math.min(out.length ? 74 : 75, b.length - i);
    // never split a UTF-8 sequence: back off to the start of the last whole character
    while (take > 1 && (b[i + take] & 0xc0) === 0x80) take--;
    out.push(b.subarray(i, i + take).toString("utf8"));
    i += take;
  }
  return out.join("\r\n ");
}

/**
 * A whole-day event has to leave as DATE values. Routing it through the timed
 * ics writer turned "2026-09-10 all day" into 2026-09-09T17:00Z-2026-09-10T17:00Z
 * on a UTC+7 machine: the wrong day, and no longer all-day in the receiving client.
 */
function allDayVevent(occ: Occurrence, zone: string, uid: string, now: Date): string {
  const startW = wallIn(occ.startUtc, zone);
  const endW = wallIn(new Date(occ.endUtc.getTime() - 1), zone);
  const d = (w: Wall) => `${w.y}${P2(w.m)}${P2(w.d)}`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const e = occ.event;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d(startW)}`,
    `DTEND;VALUE=DATE:${d(addDaysWallLocal(endW, 1))}`,
    `SUMMARY:${icsText(e.summary || "(no title)")}`,
  ];
  if (e.location) lines.push(`LOCATION:${icsText(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${icsText(e.description.slice(0, 5000))}`);
  lines.push(...attendeeOrganizerLines(e));
  lines.push("END:VEVENT");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/**
 * ORGANIZER and ATTENDEE lines carried through exactly as parsed from the source
 * .ics -- never re-derived from the display strings, and never invented -- so the
 * export round-trips CN, ROLE, PARTSTAT, RSVP and the mailto value byte-for-byte.
 * Folded at export time same as any other line; the source's own fold points do
 * not need to match, only the unfolded content.
 */
function attendeeOrganizerLines(e: CalEvent): string[] {
  const lines: string[] = [];
  if (e.organizerLine) lines.push(e.organizerLine);
  lines.push(...e.attendeeLines);
  return lines;
}

function addDaysWallLocal(w: Wall, n: number): Wall {
  const t = new Date(Date.UTC(w.y, w.m - 1, w.d));
  t.setUTCDate(t.getUTCDate() + n);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: 0, mi: 0, s: 0 };
}

/**
 * Splice extra lines (already folded) into a VEVENT block written by the timezone
 * server's writer, just before END:VEVENT. Used to add ORGANIZER/ATTENDEE without
 * touching that shared writer, which knows nothing about either property.
 */
function insertBeforeEndVevent(text: string, extra: string[]): string {
  if (!extra.length) return text;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const idx = text.lastIndexOf(`END:VEVENT`);
  if (idx < 0) return text;
  return text.slice(0, idx) + extra.join(eol) + eol + text.slice(idx);
}

function mergeVevents(parts: string[], count: number): string {
  const head = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//theluckystrike//mcp-calendar//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  ];
  const body: string[] = [];
  for (const p of parts) {
    const lines = p.split("\r\n");
    let inside = false;
    for (const l of lines) {
      if (l === "BEGIN:VEVENT") { inside = true; body.push(l); continue; }
      if (l === "END:VEVENT") { body.push(l); inside = false; continue; }
      if (inside) body.push(l);
    }
  }
  if (!body.length) throw new Error(`nothing to export (${count} event(s) matched but none produced a VEVENT).`);
  return [...head, ...body, "END:VCALENDAR"].join("\r\n") + "\r\n";
}

server.registerTool("event_export", {
  title: "Export events to a .ics file",
  description:
    "Call this tool to write chosen events to a new .ics file you can send or import elsewhere. Pass either ids (from events_list) or a from/to window. Times are written in UTC so the file lands correctly in any client.",
  inputSchema: {
    ids: z.array(text(200, "id")).max(MAX_IDS).optional().describe("Event ids from events_list, events_search or next_event"),
    from: text(20, "from").optional().describe("First day, YYYY-MM-DD (alternative to ids)"),
    to: text(20, "to").optional().describe("Last day, YYYY-MM-DD, included"),
    calendar: text(MAX_NAME, "calendar").optional().describe("With from/to: limit to one calendar"),
    out_path: text(MAX_PATH, "out_path").describe("Where to write the .ics file"),
  },
}, guard(async (a: { ids?: string[]; from?: string; to?: string; calendar?: string; out_path: string }) => {
  const zone = defaultZone();
  const db = load();
  const notes: string[] = [];
  const chosen: { occ: Occurrence; cal: string }[] = [];

  if (a.ids?.length) {
    const bySlug = new Map<string, Loaded>();
    for (const id of a.ids) {
      const p = parseOccurrenceId(id);
      if (!p) throw new Error(`"${String(id).slice(0, 60)}" is not an event id. Ids look like work.1a2b3c4d.20260310T093000 and come from events_list.`);
      const rec = db.calendars[p.calSlug];
      if (!rec) throw new Error(`the id ${id} belongs to a calendar (${p.calSlug}) that is not imported.`);
      if (!bySlug.has(p.calSlug)) bySlug.set(p.calSlug, loadEvents([rec])[0]);
      const l = bySlug.get(p.calSlug)!;
      const ev = l.events.find(e => hashHex(e.uid) === p.uidHash);
      if (!ev) { notes.push(`the id ${id} is no longer in "${rec.name}"; it was skipped.`); continue; }
      const occ = occurrenceFromKey(ev, p.key, zone);
      if (!occ) { notes.push(`the id ${id} has an unreadable date and was skipped.`); continue; }
      chosen.push({ occ, cal: rec.name });
    }
  } else if (a.from && a.to) {
    const w = windowOf(a.from, a.to, zone);
    const g = windowGate(w);
    if (g) return gated(g, "event_export");
    const recs = pickCalendars(db, a.calendar);
    if (!recs.length) return ok("No calendars imported yet. Run ics_import first.");
    const { rows, warnings } = rowsFor(loadEvents(recs), w, MAX_IDS);
    notes.push(...warnings);
    for (const r of rows) chosen.push({ occ: r.occ, cal: r.cal });
  } else {
    throw new Error('give either ids, or from and to. Example: event_export {from: "2026-09-01", to: "2026-09-07", out_path: "week.ics"}');
  }

  if (!chosen.length) return ok(withNotes("Nothing matched, so no file was written.", notes));
  if (!gate.isPro() && chosen.length > FREE_MAX_EXPORT_EVENTS) {
    return gated(`exporting ${chosen.length} events at once (the free tier exports up to ${FREE_MAX_EXPORT_EVENTS})`, "event_export");
  }

  const exportedAt = new Date();
  const parts = chosen.map(({ occ }) => {
    const e = occ.event;
    if (occ.allDay) {
      return allDayVevent(occ, zone, `${hashHex(e.uid)}-${occ.key}@mcp-calendar`, exportedAt);
    }
    const minutes = Math.max(1, Math.round((occ.endUtc.getTime() - occ.startUtc.getTime()) / 60000));
    const text = icsCreateDetailed({
      title: e.summary || "(no title)",
      startUtc: occ.startUtc,
      durationMinutes: minutes,
      description: e.description ? e.description.slice(0, 5000) : undefined,
      location: e.location,
      // The occurrence key keeps a recurring export addressable per instance rather
      // than 12 VEVENTs sharing one UID, which clients collapse into a single row.
      uid: `${hashHex(e.uid)}-${occ.key}@mcp-calendar`,
      now: new Date(),
    }).text;
    return insertBeforeEndVevent(text, attendeeOrganizerLines(e).map(foldIcsLine));
  });
  const path = outPathOf(a.out_path);
  writeFileSync(path, mergeVevents(parts, chosen.length), "utf8");
  const first = chosen[0], last = chosen[chosen.length - 1];
  if (!gate.isPro()) notes.push(`Free tier: up to ${FREE_MAX_EXPORT_EVENTS} events per export.`);
  return ok(withNotes(
    `Wrote ${chosen.length} event(s) to ${path}\n` +
    `First: ${first.occ.event.summary} ${fmtLocal(first.occ.startUtc, zone)} (${zone})\n` +
    `Last:  ${last.occ.event.summary} ${fmtLocal(last.occ.startUtc, zone)} (${zone})`,
    notes,
  ));
}));

/* ------------------------------------------------------ event_to_time_entry */

server.registerTool("event_to_time_entry", {
  title: "Turn a meeting into a time entry",
  description:
    "Take one event and return the exact arguments for the time-tracker's entry_add, so a meeting that already happened becomes billable time without retyping it. Writes nothing: pass the JSON straight to entry_add.",
  inputSchema: {
    event_id: text(200, "event_id").describe("Event id from events_list, events_search or next_event"),
    project: text(MAX_NAME, "project").describe("Project or client the meeting is billed to"),
    rate: z.union([z.number().nonnegative(), text(60, "rate")]).optional().describe("Hourly rate for this entry; a number (120) or the words the user said ('120 euros an hour')"),
    currency: text(20, "currency").optional().describe("Currency of the rate: EUR, USD, GBP, PLN, or the word the user said ('euros'). Without it the time-tracker falls back to USD."),
  },
}, guard(async (a: { event_id: string; project: string; rate?: number | string; currency?: string }) => {
  const zone = defaultZone();
  const db = load();
  const p = parseOccurrenceId(a.event_id);
  if (!p) throw new Error(`"${String(a.event_id).slice(0, 60)}" is not an event id. Ids look like work.1a2b3c4d.20260310T093000 and come from events_list.`);
  const rec = db.calendars[p.calSlug];
  if (!rec) throw new Error(`that id belongs to a calendar (${p.calSlug}) that is not imported.`);
  const l = loadEvents([rec])[0];
  const ev = l.events.find(e => hashHex(e.uid) === p.uidHash);
  if (!ev) throw new Error(`that event is no longer in "${rec.name}". Re-import the calendar and list it again.`);
  const occ = occurrenceFromKey(ev, p.key, zone);
  if (!occ) throw new Error("that id has an unreadable date.");
  const project = a.project.trim();
  if (!project) throw new Error("project cannot be empty.");
  if (occ.allDay) throw new Error(`"${ev.summary}" is a whole-day event, so it has no start and end to bill. Log it with entry_add and the hours you actually spent.`);
  const minutes = Math.max(1, Math.round((occ.endUtc.getTime() - occ.startUtc.getTime()) / 60000));
  const note = [ev.summary, ev.location ? `at ${ev.location}` : "", ev.attendees.length ? `with ${ev.attendees.slice(0, 6).join(", ")}` : ""]
    .filter(Boolean).join(" - ").slice(0, 300);
  const args: Record<string, unknown> = {
    project,
    start: occ.startUtc.toISOString(),
    end: occ.endUtc.toISOString(),
    note,
    task: ev.summary.slice(0, 200),
    billable: true,
  };
  if (a.rate !== undefined) args.rate = a.rate;
  // Without this the time-tracker defaults to USD, so "90 EUR" became USD 90.00/h
  // with no warning anywhere in the chain.
  const cur = a.currency?.trim() || (typeof a.rate === "string" ? a.rate : "");
  if (cur) args.currency = cur;
  return ok(
    `${ev.summary}: ${fmtLocal(occ.startUtc, zone)} to ${fmtTime(occ.endUtc, zone)} ${zone} (${hm(minutes)}).\n` +
    `Pass this to the time-tracker server's entry_add:\n${JSON.stringify(args, null, 2)}`,
  );
}));

/* ---------------------------------------------------------------- ics_forget */

server.registerTool("ics_forget", {
  title: "Forget a calendar",
  description: "Remove one imported calendar and the local copy of its .ics file. Nothing else is touched.",
  inputSchema: {
    name: text(MAX_NAME, "name").describe("The calendar name from calendars_list"),
  },
}, guard(async (a: { name: string }) => {
  return withFileLock(LOCK, async () => {
    const db = load();
    const recs = pickCalendars(db, a.name);
    const rec = recs[0];
    if (!rec) throw new Error(`no calendar called "${a.name}".`);
    delete db.calendars[rec.slug];
    save(db);
    removeIcs(rec.slug);
    const left = Object.keys(db.calendars).length;
    return ok(`Forgot "${rec.name}" and deleted ${icsFilePath(rec.slug)}. ${left} calendar(s) left.`);
  });
}));

/* -------------------------------------------------------- resource, prompt */

server.registerResource("today", "calendar://today", {
  title: "Today's schedule",
  description: "Every event today across all imported calendars, in your own time zone.",
  mimeType: "text/plain",
}, async (uri: URL) => {
  const zone = defaultZone();
  let body: string;
  try {
    const db = load();
    const recs = pickCalendars(db);
    if (!recs.length) {
      body = "No calendars imported. Run ics_import {path, name} first.";
    } else {
      const day = todayIn(zone);
      const w = windowOf(day, day, zone);
      const { rows } = rowsFor(loadEvents(recs), w, 200);
      body = rows.length
        ? `${day} (${zone}), ${rows.length} event(s):\n${renderRows(rows, zone, recs.length > 1)}`
        : `${day} (${zone}): nothing scheduled.`;
    }
  } catch (e) {
    body = `Error: ${(e as Error).message}`;
  }
  return { contents: [{ uri: uri.href, mimeType: "text/plain", text: body }] };
});

server.registerPrompt("plan_my_day", {
  title: "Plan my day",
  description: "Read today's calendar, find the free stretches, and turn the meetings that already happened into billable time.",
  argsSchema: {
    date: z.string().optional().describe("YYYY-MM-DD, default today"),
    project: z.string().optional().describe("Project to bill today's meetings to"),
  },
}, ({ date, project }: { date?: string; project?: string }) => {
  const zone = defaultZone();
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIn(zone);
  const t = [
    `Plan my day for ${day} (my zone is ${zone}) using the calendar tools, and answer in short sentences, not a table:`,
    `1. events_list {from: "${day}", to: "${day}"} - list what is on, with the local start and end of each item.`,
    `2. conflicts {from: "${day}", to: "${day}"} - name anything double-booked and say which one I should move.`,
    `3. free_busy {from: "${day}", to: "${day}"} - give me every free stretch of 45 minutes or more inside working hours, and the longest one.`,
    `4. next_event {} - say what is next and how long I have before it.`,
    project
      ? `5. For each meeting today that has already finished, call event_to_time_entry {event_id: "<the id from step 1>", project: ${JSON.stringify(project)}} and give me the entry_add calls to run in the time-tracker server. Ask before logging anything.`
      : `5. Ask me which project today's meetings should be billed to, then use event_to_time_entry to prepare the time entries.`,
  ].join("\n");
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text: t } }] };
});

/* ------------------------------------------------------------------- boot */

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  let count = 0;
  try { count = Object.keys(load().calendars).length; } catch { count = -1; }
  process.stderr.write(
    `mcp-calendar ${VERSION} ready (${gate.isPro() ? "pro" : "free"}), ` +
    `${count < 0 ? "calendar index unreadable" : `${count} calendar(s)`}, zone ${defaultZone()}, data in ${dataDir()}\n`,
  );
}

main().catch(e => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});

export { UnknownZoneError };
