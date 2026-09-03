#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, isAbsolute, resolve as pathResolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createLicenseGate, withFileLock } from "@theluckystrike/mcp-license";
import { readJsonFile } from "./jsonstore.js";
import {
  DROPPED_PLACES, PLACE_COUNT, UnknownZoneError, businessDays, dateKey, describe, dstChanges,
  findSlots, hhmmToMinutes, icsCreate, offsetLabel, offsetMinutes, overlapOnDate, parseTimeIn,
  resolveZone, timeKey, wallIn, weekdayIn, zoneAbbrev,
} from "./tz.js";
import type { Participant } from "./tz.js";

const PRODUCT = "timezone";
const FREE_MAX_PARTICIPANTS = 3;
const FREE_MAX_DAYS = 5;
const FREE_MAX_CONTACTS = 5;
const FREE_ICS_PER_MONTH = 3;

const gate = createLicenseGate({ product: PRODUCT });

/* ---------------------------------------------------------------- storage */

interface Contact { name: string; zone: string; workStart: string; workEnd: string; updated: string }
interface DB {
  version: 1;
  contacts: Record<string, Contact>;      // key: lowercased name
  ics: Record<string, number>;            // "YYYY-MM" -> count written
}
const EMPTY: DB = { version: 1, contacts: {}, ics: {} };

function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", PRODUCT);
}
function dbPath(): string { return join(dataDir(), "data.json"); }
const LOCK = join(dataDir(), ".lock");

/** Only a missing file is an empty database (jsonstore quarantines a corrupt one). */
function load(): DB {
  const raw = readJsonFile<Partial<DB>>(dbPath(), { ...EMPTY });
  return {
    version: 1,
    contacts: raw.contacts && typeof raw.contacts === "object" ? raw.contacts : {},
    ics: raw.ics && typeof raw.ics === "object" ? raw.ics : {},
  };
}
function save(db: DB): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = dbPath();
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, p);
}

/* ------------------------------------------------------------- primitives */

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const err = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true });
/** A gated feature is not an error: the user must see the upgrade path. */
const gated = (feature: string) => ok(gate.upgradeText(feature));

function guard<A>(fn: (a: A) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>) {
  return async (a: A) => {
    try { return await fn(a); }
    catch (e) { return err(e instanceof Error ? e.message : String(e)); }
  };
}

function zoneOf(input: string): string { return resolveZone(input).zone; }

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function outPathOf(p: string): string {
  const abs = isAbsolute(p) ? p : pathResolve(process.cwd(), p);
  const dir = dirname(abs);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return abs;
}

/* ---------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-timezone", version: "0.3.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);
gate.registerTools(server as unknown as { registerTool: Function });

/* ------------------------------------------------------------------- now */

server.registerTool("now", {
  title: "Current time in zones",
  description: "The current time in one or more places. Accepts IANA zones (Europe/Warsaw), city names (Warsaw), country names (Poland) or abbreviations (PST, IST). With no zones it reports this machine's local zone and UTC.",
  inputSchema: {
    zones: z.array(z.string()).optional().describe("Places or IANA zones, e.g. ['Warsaw','New York','India']"),
  },
}, guard(async ({ zones }: { zones?: string[] }) => {
  const list = zones && zones.length
    ? zones
    : [Intl.DateTimeFormat().resolvedOptions().timeZone, "UTC"];
  const at = new Date();
  const rows = list.map(input => {
    const zone = zoneOf(input);
    return `${input} -> ${zone}: ${describe(at, zone)}`;
  });
  return ok(`Now (${at.toISOString()} UTC)\n${rows.join("\n")}`);
}));

/* ---------------------------------------------------------- convert_time */

server.registerTool("convert_time", {
  title: "Convert a time between zones",
  description: "Convert a time from one place to others. The input time is read as wall-clock time in from_zone unless it carries an offset or a trailing Z. Accepts '2026-09-10 15:00', an ISO timestamp, or a phrase like '3pm tomorrow'.",
  inputSchema: {
    time: z.string().describe("'2026-09-10 15:00', '2026-09-10T15:00:00Z', '3pm tomorrow', 'now'"),
    from_zone: z.string().describe("Place the time is given in, e.g. 'Warsaw' or 'Europe/Warsaw'"),
    to_zones: z.array(z.string()).min(1).describe("Places to convert into"),
  },
}, guard(async ({ time, from_zone, to_zones }: { time: string; from_zone: string; to_zones: string[] }) => {
  const from = zoneOf(from_zone);
  const at = parseTimeIn(time, from);
  const lines = [`${from_zone} -> ${from}: ${describe(at, from)}`];
  for (const t of to_zones) {
    const z = zoneOf(t);
    const dayDelta = Number(dateKey(wallIn(at, z)).replace(/-/g, "")) - Number(dateKey(wallIn(at, from)).replace(/-/g, ""));
    const note = dayDelta === 0 ? "" : dayDelta > 0 ? "  (next day)" : "  (previous day)";
    lines.push(`${t} -> ${z}: ${describe(at, z)}${note}`);
  }
  lines.push(`UTC instant: ${at.toISOString()}`);
  return ok(lines.join("\n"));
}));

/* --------------------------------------------------------------- overlap */

function windowsFor(zones: string[], ws: string, we: string) {
  const startMin = hhmmToMinutes(ws, "work_start");
  const endMin = hhmmToMinutes(we, "work_end");
  if (endMin <= startMin) throw new Error(`work_end (${we}) must be after work_start (${ws})`);
  return zones.map(z => ({ zone: zoneOf(z), label: z, startMin, endMin }));
}

server.registerTool("overlap", {
  title: "Daily working-hours overlap",
  description: "The window each day when every listed place is inside working hours. Computed on a real date, so a DST week that widens or narrows the overlap is reflected.",
  inputSchema: {
    zones: z.array(z.string()).min(2).describe("Places, e.g. ['Warsaw','New York','Bangalore']"),
    work_start: z.string().optional().describe("Local working day start, default 09:00"),
    work_end: z.string().optional().describe("Local working day end, default 17:00"),
    date: z.string().optional().describe("Date to compute on, YYYY-MM-DD, default today"),
  },
}, guard(async ({ zones, work_start = "09:00", work_end = "17:00", date }: { zones: string[]; work_start?: string; work_end?: string; date?: string }) => {
  const ws = windowsFor(zones, work_start, work_end);
  const day = date ? parseTimeIn(date, ws[0].zone) : new Date();
  const o = overlapOnDate(ws, day);
  const head = `Working hours ${work_start}-${work_end} local, on ${dateKey(wallIn(day, ws[0].zone))} (${ws[0].zone})`;
  if (!o) {
    const offs = ws.map(w => `  ${w.label} (${w.zone}): ${offsetLabel(offsetMinutes(day, w.zone))}`).join("\n");
    return ok(`${head}\nNo overlap: the working days do not intersect.\n${offs}\nWiden work_start/work_end, or plan an asynchronous handoff.`);
  }
  const base = Date.UTC(wallIn(day, "UTC").y, wallIn(day, "UTC").m - 1, wallIn(day, "UTC").d);
  const startUtc = new Date(base + o.startMin * 60000);
  const endUtc = new Date(base + o.endMin * 60000);
  const rows = ws.map(w =>
    `  ${w.label} (${w.zone}): ${timeKey(wallIn(startUtc, w.zone))} - ${timeKey(wallIn(endUtc, w.zone))} ${zoneAbbrev(startUtc, w.zone)}`);
  const mins = o.endMin - o.startMin;
  return ok(
    `${head}\nOverlap: ${Math.floor(mins / 60)}h ${mins % 60}m\n` +
    `  UTC: ${timeKey(wallIn(startUtc, "UTC"))} - ${timeKey(wallIn(endUtc, "UTC"))}\n${rows.join("\n")}`,
  );
}));

/* ----------------------------------------------------- find_meeting_slots */

const participantSchema = z.object({
  name: z.string().min(1).describe("Person or client name"),
  zone: z.string().min(1).describe("Their place or IANA zone"),
  work_start: z.string().optional().describe("Their local day start, default 09:00"),
  work_end: z.string().optional().describe("Their local day end, default 17:00"),
});

function toParticipants(list: { name: string; zone: string; work_start?: string; work_end?: string }[]): Participant[] {
  return list.map(p => {
    const startMin = hhmmToMinutes(p.work_start ?? "09:00", `${p.name} work_start`);
    const endMin = hhmmToMinutes(p.work_end ?? "17:00", `${p.name} work_end`);
    if (endMin <= startMin) throw new Error(`${p.name}: work_end must be after work_start`);
    return { name: p.name, zone: zoneOf(p.zone), startMin, endMin };
  });
}

server.registerTool("find_meeting_slots", {
  title: "Find meeting slots",
  description: "Rank the times when every participant is inside their own working hours. Ranked by fairness: the score is the WORST participant's distance from 13:00 local, so a slot that is 07:00 for one person never outranks one that suits everybody. Weekends in the first participant's zone are skipped.",
  inputSchema: {
    participants: z.array(participantSchema).min(1).describe("Who has to attend, with their zone and optional working hours"),
    duration_minutes: z.number().int().positive().optional().describe("Meeting length, default 60"),
    days: z.number().int().positive().optional().describe("How many days ahead to search, default 5"),
    earliest_date: z.string().optional().describe("First date to consider, YYYY-MM-DD, default today"),
    limit: z.number().int().positive().optional().describe("How many slots to return, default 8"),
    recurring: z.boolean().optional().describe("Pro: also report the weekly recurring times that work on every searched weekday"),
  },
}, guard(async (a: { participants: { name: string; zone: string; work_start?: string; work_end?: string }[]; duration_minutes?: number; days?: number; earliest_date?: string; limit?: number; recurring?: boolean }) => {
  const pro = gate.isPro();
  const duration = a.duration_minutes ?? 60;
  const days = a.days ?? 5;
  if (!pro && a.participants.length > FREE_MAX_PARTICIPANTS) {
    return gated(`a meeting with ${a.participants.length} participants (the free tier plans up to ${FREE_MAX_PARTICIPANTS})`);
  }
  if (!pro && days > FREE_MAX_DAYS) {
    return gated(`a ${days}-day search (the free tier searches up to ${FREE_MAX_DAYS} days)`);
  }
  if (!pro && a.recurring) return gated("recurring-slot search");

  const parts = toParticipants(a.participants);
  const first = a.earliest_date ? parseTimeIn(a.earliest_date, parts[0].zone) : new Date();
  const all = findSlots(parts, duration, days, first);
  if (!all.length) {
    const rows = parts.map(p => `  ${p.name} (${p.zone}): ${timeKey({ y: 0, m: 0, d: 0, h: Math.floor(p.startMin / 60), mi: p.startMin % 60, s: 0 })} - ${timeKey({ y: 0, m: 0, d: 0, h: Math.floor(p.endMin / 60), mi: p.endMin % 60, s: 0 })}`).join("\n");
    return ok(
      `No slot fits everyone's working hours in the next ${days} day(s) for ${duration} minutes.\n${rows}\n` +
      `Try a shorter duration, widen someone's work_start/work_end, or use overlap to see how far apart the days are.`,
    );
  }
  const limit = Math.max(1, Math.min(a.limit ?? 8, pro ? 50 : 10));
  const lines = all.slice(0, limit).map((s, i) => {
    const per = s.local.map(l => `${l.name} ${l.start}-${l.end} ${l.date}`).join(" | ");
    return `${i + 1}. ${s.startUtc.toISOString()} UTC  fairness ${s.fairness.toFixed(2)}h\n   ${per}`;
  });
  let extra = "";
  if (a.recurring && pro) {
    const byClock = new Map<string, number>();
    for (const s of all) {
      const k = timeKey(wallIn(s.startUtc, parts[0].zone));
      byClock.set(k, (byClock.get(k) ?? 0) + 1);
    }
    const daysSearched = new Set(all.map(s => dateKey(wallIn(s.startUtc, parts[0].zone)))).size;
    const every = [...byClock.entries()].filter(([, n]) => n >= daysSearched).map(([k]) => k).sort();
    extra = `\n\nRecurring (works on all ${daysSearched} searched weekdays, ${parts[0].zone} local): ` +
      (every.length ? every.join(", ") : "none");
  }
  const note = pro ? "" : `\n\n${gate.upgradeText("more participants, longer searches and recurring slots")}`;
  return ok(
    `${all.length} slot(s) fit all ${parts.length} participants (${duration} min, ${days} day(s)). Best first:\n` +
    lines.join("\n") + extra + note,
  );
}));

/* ----------------------------------------------------------- dst_changes */

server.registerTool("dst_changes", {
  title: "Daylight-saving changes",
  description: "The clock changes in a place for a year, with the exact UTC instant and the offset before and after. Use it to check whether a recurring call moves for one of you in March or October.",
  inputSchema: {
    zone: z.string().describe("Place or IANA zone"),
    year: z.number().int().optional().describe("Calendar year, default this year"),
  },
}, guard(async ({ zone, year }: { zone: string; year?: number }) => {
  const z = zoneOf(zone);
  const y = year ?? new Date().getUTCFullYear();
  const changes = dstChanges(z, y);
  if (!changes.length) return ok(`${zone} -> ${z}: no clock changes in ${y}; the offset stays ${offsetLabel(offsetMinutes(new Date(Date.UTC(y, 5, 1)), z))} all year.`);
  const rows = changes.map(c => {
    const localBefore = describe(new Date(c.atUtc.getTime() - 60000), z);
    const localAfter = describe(c.atUtc, z);
    const delta = c.toOffset - c.fromOffset;
    return `  ${c.atUtc.toISOString()} UTC: ${offsetLabel(c.fromOffset)} -> ${offsetLabel(c.toOffset)} (${delta > 0 ? "+" : ""}${delta} min)\n` +
      `    local ${localBefore} becomes ${localAfter}`;
  });
  return ok(`${zone} -> ${z}, clock changes in ${y}:\n${rows.join("\n")}`);
}));

/* --------------------------------------------------------- business_days */

server.registerTool("business_days", {
  title: "Count business days",
  description: "Business days between two dates in a place, excluding weekends and any holidays you pass. Use it for delivery dates and payment terms across a client's calendar.",
  inputSchema: {
    from: z.string().describe("Start date, YYYY-MM-DD (inclusive)"),
    to: z.string().describe("End date, YYYY-MM-DD (inclusive)"),
    zone: z.string().describe("Place whose calendar to use"),
    holidays: z.array(z.string()).optional().describe("Dates to exclude, YYYY-MM-DD"),
  },
}, guard(async ({ from, to, zone, holidays }: { from: string; to: string; zone: string; holidays?: string[] }) => {
  const z = zoneOf(zone);
  const r = businessDays(from, to, z, holidays ?? []);
  const listed = r.days.length <= 20 ? `\nDays: ${r.days.join(", ")}` : "";
  return ok(
    `${from} to ${to} in ${z}: ${r.days.length} business day(s) of ${r.total} calendar day(s) ` +
    `(${r.weekendCount} weekend, ${r.holidayCount} holiday).${listed}`,
  );
}));

/* -------------------------------------------------------------- contacts */

server.registerTool("contacts_set", {
  title: "Save a contact's zone",
  description: "Remember a client or teammate's time zone and working hours so you can say 'find a slot with Maria and Raj' later.",
  inputSchema: {
    name: z.string().min(1).describe("Their name"),
    zone: z.string().min(1).describe("Their place or IANA zone"),
    work_start: z.string().optional().describe("Local day start, default 09:00"),
    work_end: z.string().optional().describe("Local day end, default 17:00"),
  },
}, guard(async ({ name, zone, work_start = "09:00", work_end = "17:00" }: { name: string; zone: string; work_start?: string; work_end?: string }) => {
  const z = zoneOf(zone);
  hhmmToMinutes(work_start, "work_start");
  hhmmToMinutes(work_end, "work_end");
  return withFileLock(LOCK, async () => {
    const db = load();
    const key = name.trim().toLowerCase();
    const isNew = !db.contacts[key];
    if (isNew && !gate.isPro() && Object.keys(db.contacts).length >= FREE_MAX_CONTACTS) {
      return gated(`a ${FREE_MAX_CONTACTS + 1}th saved contact (the free tier keeps ${FREE_MAX_CONTACTS})`);
    }
    db.contacts[key] = { name: name.trim(), zone: z, workStart: work_start, workEnd: work_end, updated: new Date().toISOString() };
    save(db);
    return ok(`Saved ${name.trim()}: ${z}, ${work_start}-${work_end} local. Local time there now: ${describe(new Date(), z)}`);
  });
}));

server.registerTool("contacts_list", {
  title: "List saved contacts",
  description: "Everyone you have saved, with their current local time and whether they are inside working hours right now.",
  inputSchema: {},
}, guard(async () => {
  const db = load();
  const cs = Object.values(db.contacts).sort((a, b) => a.name.localeCompare(b.name));
  if (!cs.length) return ok("No contacts saved yet. Use contacts_set with a name and a place.");
  const at = new Date();
  const rows = cs.map(c => {
    const w = wallIn(at, c.zone);
    const nowMin = w.h * 60 + w.mi;
    const inHours = nowMin >= hhmmToMinutes(c.workStart) && nowMin < hhmmToMinutes(c.workEnd)
      && weekdayIn(at, c.zone) !== "Sat" && weekdayIn(at, c.zone) !== "Sun";
    return `  ${c.name}: ${c.zone}, ${describe(at, c.zone)}, works ${c.workStart}-${c.workEnd} - ${inHours ? "available now" : "outside working hours"}`;
  });
  return ok(`${cs.length} contact(s):\n${rows.join("\n")}`);
}));

/* ------------------------------------------------------------- ics_create */

server.registerTool("ics_create", {
  title: "Write a calendar invite",
  description: "Write a .ics calendar file for one meeting. Times are stored in UTC, so the invite lands at the right local time in every attendee's calendar with no time zone block to go stale.",
  inputSchema: {
    title: z.string().min(1).describe("Event title"),
    start: z.string().describe("Start time, read in `zone` unless it carries an offset"),
    zone: z.string().describe("Place the start time is given in"),
    duration_minutes: z.number().int().positive().describe("Length in minutes"),
    attendees: z.array(z.string()).optional().describe("Email addresses, or names"),
    description: z.string().optional().describe("Body text"),
    location: z.string().optional().describe("Where, or a meeting link"),
    out_path: z.string().optional().describe("Where to write the file; default meeting.ics in the data dir"),
  },
}, guard(async (a: { title: string; start: string; zone: string; duration_minutes: number; attendees?: string[]; description?: string; location?: string; out_path?: string }) => {
  const z = zoneOf(a.zone);
  const startUtc = parseTimeIn(a.start, z);
  return withFileLock(LOCK, async () => {
    const db = load();
    const mk = monthKey();
    const used = db.ics[mk] ?? 0;
    if (!gate.isPro() && used >= FREE_ICS_PER_MONTH) {
      return gated(`a ${FREE_ICS_PER_MONTH + 1}th calendar file this month (the free tier writes ${FREE_ICS_PER_MONTH})`);
    }
    const text = icsCreate({
      title: a.title, startUtc, durationMinutes: a.duration_minutes,
      attendees: a.attendees, description: a.description, location: a.location,
    });
    const dir = dataDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const path = outPathOf(a.out_path ?? join(dir, "meeting.ics"));
    writeFileSync(path, text, "utf8");
    db.ics[mk] = used + 1;
    save(db);
    const rest = gate.isPro() ? "" : ` (${FREE_ICS_PER_MONTH - used - 1} left this month on the free tier)`;
    return ok(
      `Wrote ${path}${rest}\n${a.title}: ${describe(startUtc, z)} for ${a.duration_minutes} min\n` +
      `DTSTART ${startUtc.toISOString()} (UTC)`,
    );
  });
}));

/* -------------------------------------------------------- resource, prompt */

server.registerResource("contacts", "tz://contacts", {
  title: "Saved contacts and their local time",
  description: "Every saved contact with their zone, working hours and current local time.",
  mimeType: "text/plain",
}, async (uri: URL) => {
  const db = load();
  const at = new Date();
  const cs = Object.values(db.contacts).sort((a, b) => a.name.localeCompare(b.name));
  const text = cs.length
    ? cs.map(c => `${c.name}\t${c.zone}\t${describe(at, c.zone)}\t${c.workStart}-${c.workEnd}`).join("\n")
    : "(no contacts saved)";
  return { contents: [{ uri: uri.href, mimeType: "text/plain", text }] };
});

server.registerPrompt("schedule_with", {
  title: "Schedule with saved contacts",
  description: "Propose meeting times with saved contacts, using their stored zones and working hours.",
  argsSchema: {
    names: z.string().describe("Comma-separated contact names, or 'all'"),
    duration_minutes: z.string().optional().describe("Meeting length in minutes, default 60"),
  },
}, ({ names, duration_minutes }: { names: string; duration_minutes?: string }) => {
  const db = load();
  const all = Object.values(db.contacts);
  const wanted = String(names).trim().toLowerCase() === "all"
    ? all
    : String(names).split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
        .map(n => db.contacts[n]).filter(Boolean);
  const missing = String(names).trim().toLowerCase() === "all"
    ? []
    : String(names).split(",").map(s => s.trim()).filter(s => s && !db.contacts[s.toLowerCase()]);
  const roster = wanted.length
    ? wanted.map(c => `- ${c.name}: zone ${c.zone}, works ${c.workStart}-${c.workEnd}`).join("\n")
    : "(no matching saved contacts)";
  const text =
    `Propose meeting times with these people. My own zone is ${Intl.DateTimeFormat().resolvedOptions().timeZone}.\n\n` +
    `PARTICIPANTS\n${roster}\n` +
    (missing.length ? `\nNOT SAVED (ask me for their zone): ${missing.join(", ")}\n` : "") +
    `\nCall find_meeting_slots with exactly these participants, duration_minutes ${duration_minutes ?? "60"}, ` +
    `and their stored work_start/work_end. Then give me the top three options as plain sentences with each ` +
    `person's local time, say which one is fairest and why, and offer to write the .ics for the one I pick.`;
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
});

/* ------------------------------------------------------------------ boot */

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  if (DROPPED_PLACES.length) {
    process.stderr.write(`mcp-timezone: dropped ${DROPPED_PLACES.length} place entries this Node build cannot resolve: ${DROPPED_PLACES.join(", ")}\n`);
  }
  process.stderr.write(
    `mcp-timezone ready (${gate.isPro() ? "pro" : "free"}), ${PLACE_COUNT} places, data in ${dataDir()}\n`,
  );
}

main().catch(e => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});

export { UnknownZoneError };
