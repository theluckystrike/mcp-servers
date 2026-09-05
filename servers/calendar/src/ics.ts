/**
 * An RFC 5545 reader, written against the files real calendars actually export.
 *
 * Why hand-written rather than a dependency: the whole repo is pure JS with no native
 * modules, and every .ics library either drags in a moment/luxon-sized date stack or
 * ships its own tz database that goes stale. Time arithmetic here is delegated to the
 * timezone server's engine, which reads the ICU data inside Node, so a Warsaw weekly
 * meeting keeps its 10:00 local start across the March DST change with no rule table
 * of our own to maintain.
 *
 * Deliberately ignored: VTIMEZONE. A file's inline DST rules are only as fresh as the
 * client that wrote it; the TZID is kept and the offset is computed from ICU instead.
 */
import { UnknownZoneError, isValidZone, wallIn, zonedToUtc } from "@theluckystrike/mcp-timezone/lib";
import type { Wall } from "@theluckystrike/mcp-timezone/lib";

/* ------------------------------------------------------------------ limits */

/** A recurrence generator must terminate even on a rule with no COUNT and no UNTIL. */
export const MAX_CANDIDATES = 100_000;
/** Occurrences returned from one expansion. */
export const MAX_OCCURRENCES = 20_000;

/* ------------------------------------------------------------ content lines */

export interface Prop {
  name: string;
  params: Record<string, string[]>;
  value: string;
  /** The unfolded logical source line this property was parsed from, verbatim. */
  raw?: string;
}

/**
 * RFC 5545 3.1: a line is folded by inserting CRLF plus one whitespace character.
 * Unfolding removes exactly one leading space or tab, never more: a continuation
 * of "  indented" legitimately starts with a second space.
 *
 * Outlook folds with a bare LF and Apple sometimes with a bare CR, so all three
 * line endings are accepted.
 */
/**
 * Undo folding on the raw bytes, before any UTF-8 decoding. Exchange and some Outlook
 * exporters fold a line at exactly 75 octets even when that lands inside a multi-byte
 * character, so decoding first turns the split sequence into replacement characters and
 * the summary is corrupted. Unfolding at the byte level puts the two halves back together.
 */
export function decodeIcs(buf: Buffer): string {
  const out = Buffer.allocUnsafe(buf.length);
  let n = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0x0d && buf[i + 1] === 0x0a && (buf[i + 2] === 0x20 || buf[i + 2] === 0x09)) { i += 2; continue; }
    if ((b === 0x0d || b === 0x0a) && (buf[i + 1] === 0x20 || buf[i + 1] === 0x09)) { i += 1; continue; }
    out[n++] = b;
  }
  return out.subarray(0, n).toString("utf8").replace(/^\uFEFF/, "");
}

export function unfold(text: string): string[] {
  const raw = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const out: string[] = [];
  for (const line of raw) {
    if (out.length && (line.startsWith(" ") || line.startsWith("\t"))) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Undo RFC 5545 3.3.11 TEXT escaping. \N and \n are both a line break. */
export function unescapeText(v: string): string {
  let out = "";
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c !== "\\") { out += c; continue; }
    const n = v[++i];
    if (n === undefined) { out += "\\"; break; }
    if (n === "n" || n === "N") out += "\n";
    else if (n === "\\" || n === ";" || n === "," || n === ":" || n === '"') out += n;
    else out += n;                     // unknown escape: keep the character itself
  }
  return out;
}

/** Split a TEXT value on unescaped commas (EXDATE, CATEGORIES, RDATE). */
export function splitList(v: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === "\\") { cur += c + (v[++i] ?? ""); continue; }
    if (c === ",") { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out.filter(s => s.trim() !== "");
}

/**
 * name;PARAM=a,b;OTHER="x:y":value
 *
 * The colon that ends the property is the first one outside a quoted parameter
 * value: "OTHER=\"x:y\"" is the shape a Google export uses for TZID values that
 * contain a colon, and splitting on the first colon breaks it.
 */
export function parseProp(line: string): Prop | null {
  let i = 0;
  let quoted = false;
  let colon = -1;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { quoted = !quoted; continue; }
    if (c === ":" && !quoted) { colon = i; break; }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts: string[] = [];
  let cur = "";
  quoted = false;
  for (const c of head) {
    if (c === '"') { quoted = !quoted; cur += c; continue; }
    if (c === ";" && !quoted) { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  parts.push(cur);
  const name = (parts.shift() ?? "").trim().toUpperCase();
  if (!name) return null;
  const params: Record<string, string[]> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim().toUpperCase();
    const v = p.slice(eq + 1);
    params[k] = splitList(v).map(s => s.trim().replace(/^"(.*)"$/, "$1"));
  }
  return { name, params, value, raw: line };
}

/* ------------------------------------------------------------ date values */

/**
 * A calendar date-time. `zone` is the TZID when the file gave one, "UTC" for a
 * trailing Z, and null for a floating time -- which RFC 5545 defines as "whatever
 * the reader's local zone is", so it is resolved at query time, not here.
 */
export interface DateVal {
  allDay: boolean;
  wall: Wall;
  zone: string | null;
}

const NUM = (s: string) => Number(s);

/** DATE (20260310) or DATE-TIME (20260310T093000, optionally Z). */
export function parseDateValue(prop: Prop, warnings: string[] = []): DateVal | null {
  const raw = prop.value.trim();
  const isDateParam = (prop.params.VALUE ?? []).some(v => v.toUpperCase() === "DATE");
  let tzid: string | undefined = prop.params.TZID?.[0];
  if (tzid && !isValidZone(tzid)) {
    // Outlook writes Windows zone names ("W. Europe Standard Time"); the file is still
    // usable, so the event is kept as floating and the reason is reported once.
    warnings.push(`TZID "${tzid}" is not an IANA time zone this Node build knows; those events are read as local time.`);
    tzid = undefined;
  }
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(raw);
  if (!m) {
    // Some exporters write an ISO value with separators. Accept it rather than drop the event.
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z)?)?$/.exec(raw);
    if (!iso) return null;
    return dateValFrom(iso, isDateParam, tzid);
  }
  return dateValFrom(m, isDateParam, tzid);
}

function dateValFrom(m: RegExpExecArray, isDateParam: boolean, tzid?: string): DateVal {
  const hasTime = m[4] !== undefined;
  const wall: Wall = {
    y: NUM(m[1]), m: NUM(m[2]), d: NUM(m[3]),
    h: hasTime ? NUM(m[4]) : 0, mi: hasTime ? NUM(m[5]) : 0, s: hasTime && m[6] ? NUM(m[6]) : 0,
  };
  const allDay = !hasTime || isDateParam;
  const zone = allDay ? null : (m[7] ? "UTC" : (tzid ?? null));
  return { allDay, wall, zone };
}

/** ISO 8601 duration as RFC 5545 restricts it: P[n]W or P[n]DT[n]H[n]M[n]S. */
export function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim().toUpperCase());
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const weeks = m[2] ? Number(m[2]) : 0;
  const days = m[3] ? Number(m[3]) : 0;
  const h = m[4] ? Number(m[4]) : 0;
  const mi = m[5] ? Number(m[5]) : 0;
  const s = m[6] ? Number(m[6]) : 0;
  if (!m[2] && !m[3] && !m[4] && !m[5] && !m[6]) return null;
  return sign * (((weeks * 7 + days) * 24 + h) * 3600 + mi * 60 + s) * 1000;
}

/* -------------------------------------------------------------- recurrence */

export const DOW = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export interface ByDay { ord: number | null; dow: number }
export interface RRule {
  freq: "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count?: number;
  until?: DateVal;
  byDay?: ByDay[];
  byMonthDay?: number[];
  byMonth?: number[];
  bySetPos?: number[];
  wkst: number;
}

export function parseRRule(prop: Prop, warnings: string[] = []): RRule | null {
  const parts: Record<string, string> = {};
  for (const seg of prop.value.split(";")) {
    const eq = seg.indexOf("=");
    if (eq < 0) continue;
    parts[seg.slice(0, eq).trim().toUpperCase()] = seg.slice(eq + 1).trim();
  }
  const freq = (parts.FREQ ?? "").toUpperCase();
  if (freq !== "HOURLY" && freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") {
    if (freq === "MINUTELY" || freq === "SECONDLY") {
      warnings.push(`FREQ=${freq} is deliberately not expanded: one such rule fills any window with thousands of occurrences. Those events are listed at their first occurrence only.`);
    } else if (freq) {
      warnings.push(`FREQ=${freq} is not expanded; those events are listed at their first occurrence only.`);
    }
    return null;
  }
  const interval = Math.max(1, Math.min(1000, Number(parts.INTERVAL ?? 1) || 1));
  const rule: RRule = { freq, interval, wkst: DOW.indexOf((parts.WKST ?? "MO").toUpperCase()) < 0 ? 1 : DOW.indexOf((parts.WKST ?? "MO").toUpperCase()) };
  const count = Number(parts.COUNT);
  if (Number.isFinite(count) && count > 0) rule.count = Math.min(count, MAX_OCCURRENCES);
  if (parts.UNTIL) {
    const u = parseDateValue({ name: "UNTIL", params: {}, value: parts.UNTIL });
    if (u) rule.until = u;
  }
  if (parts.BYDAY) {
    const byDay: ByDay[] = [];
    for (const t of parts.BYDAY.split(",")) {
      const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(t.trim().toUpperCase());
      if (!m) continue;
      byDay.push({ ord: m[1] ? Number(m[1]) : null, dow: DOW.indexOf(m[2]) });
    }
    if (byDay.length) rule.byDay = byDay;
  }
  if (parts.BYMONTHDAY) {
    const l = parts.BYMONTHDAY.split(",").map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n !== 0 && Math.abs(n) <= 31);
    if (l.length) rule.byMonthDay = l;
  }
  if (parts.BYSETPOS) {
    const l = parts.BYSETPOS.split(",").map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n !== 0 && Math.abs(n) <= 366);
    if (l.length) rule.bySetPos = l;
  }
  if (parts.BYMONTH) {
    const l = parts.BYMONTH.split(",").map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n >= 1 && n <= 12);
    if (l.length) rule.byMonth = l;
  }
  return rule;
}

/* ------------------------------------------------------------------- events */

export interface CalEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  status?: string;
  organizer?: string;
  /** The unfolded ORGANIZER source line, verbatim, for byte-for-byte export. */
  organizerLine?: string;
  attendees: string[];
  /** The unfolded ATTENDEE source lines, verbatim, one per attendee, for byte-for-byte export. */
  attendeeLines: string[];
  start: DateVal;
  /** Exclusive end, as RFC 5545 defines DTEND. */
  end: DateVal;
  durationMs: number;
  rrule?: RRule;
  exdates: DateVal[];
  rdates: DateVal[];
  recurrenceId?: DateVal;
  /** TRANSP:TRANSPARENT -- the event does not make the organiser busy. */
  transparent: boolean;
  sequence: number;
}

export interface ParseResult {
  events: CalEvent[];
  calendarName?: string;
  prodId?: string;
  warnings: string[];
  skipped: number;
}

export class IcsError extends Error {}

/**
 * Parse a whole .ics file. Never throws on a malformed VEVENT: the event is skipped,
 * counted and reported, because one bad row in a 4,000-event Google export must not
 * cost the user the other 3,999.
 */
export function parseIcs(text: string, opts: { maxEvents?: number } = {}): ParseResult {
  if (typeof text !== "string" || !text.trim()) throw new IcsError("the calendar file is empty.");
  const lines = unfold(text);
  const warnings: string[] = [];
  const seenWarn = new Set<string>();
  const warn = (w: string) => { if (!seenWarn.has(w)) { seenWarn.add(w); warnings.push(w); } };
  const maxEvents = opts.maxEvents ?? 50_000;

  let sawCalendar = false;
  let calendarName: string | undefined;
  let prodId: string | undefined;
  const events: CalEvent[] = [];
  let skipped = 0;

  /** Nesting depth of components we are inside but do not read (VTIMEZONE, VALARM). */
  let ignoreDepth = 0;
  let cur: Record<string, Prop[]> | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const p = parseProp(line);
    if (!p) continue;
    if (p.name === "BEGIN") {
      const comp = p.value.trim().toUpperCase();
      if (comp === "VCALENDAR") { sawCalendar = true; continue; }
      if (cur || ignoreDepth > 0) { ignoreDepth++; continue; }   // VALARM inside a VEVENT
      if (comp === "VEVENT") { cur = {}; continue; }
      ignoreDepth++;                                             // VTIMEZONE, VTODO, VJOURNAL, VFREEBUSY
      continue;
    }
    if (p.name === "END") {
      const comp = p.value.trim().toUpperCase();
      if (comp === "VCALENDAR") continue;
      if (ignoreDepth > 0) { ignoreDepth--; continue; }
      if (comp === "VEVENT" && cur) {
        if (events.length < maxEvents) {
          try {
            events.push(buildEvent(cur, warn));
          } catch (e) {
            skipped++;
            warn(`skipped an event: ${(e as Error).message}`);
          }
        } else {
          skipped++;
        }
        cur = null;
      }
      continue;
    }
    if (ignoreDepth > 0) continue;
    if (cur) {
      (cur[p.name] ??= []).push(p);
      continue;
    }
    if (p.name === "X-WR-CALNAME") calendarName = unescapeText(p.value).trim() || undefined;
    if (p.name === "PRODID") prodId = unescapeText(p.value).trim() || undefined;
  }

  if (!sawCalendar && !events.length) {
    throw new IcsError("this does not look like a calendar file: no BEGIN:VCALENDAR and no VEVENT was found.");
  }
  if (skipped) warn(`${skipped} event(s) could not be read and were skipped.`);
  applyOverrides(events);
  return { events, calendarName, prodId, warnings, skipped };
}

function buildEvent(props: Record<string, Prop[]>, warn: (w: string) => void): CalEvent {
  const one = (n: string) => props[n]?.[0];
  const dtstartP = one("DTSTART");
  if (!dtstartP) throw new Error("no DTSTART");
  const localWarn: string[] = [];
  const start = parseDateValue(dtstartP, localWarn);
  if (!start) throw new Error(`DTSTART "${dtstartP.value.slice(0, 40)}" is not a date`);
  for (const w of localWarn) warn(w);

  let end: DateVal | null = null;
  let durationMs = 0;
  const dtendP = one("DTEND");
  const durP = one("DURATION");
  if (dtendP) {
    end = parseDateValue(dtendP, localWarn);
    if (!end) warn(`DTEND "${dtendP.value.slice(0, 40)}" is not a date; that event is treated as ${start.allDay ? "a whole day" : "zero length"}.`);
  }
  if (!end && durP) {
    const ms = parseDuration(durP.value);
    if (ms !== null && ms >= 0) durationMs = ms;
    else warn(`DURATION "${durP.value.slice(0, 40)}" could not be read.`);
  }
  if (!end && !durationMs) {
    // RFC 5545 3.6.1: no DTEND and no DURATION means a whole day for a DATE start and
    // zero length for a DATE-TIME start.
    durationMs = start.allDay ? 86_400_000 : 0;
  }
  if (!end) {
    end = { allDay: start.allDay, wall: start.wall, zone: start.zone };   // resolved with durationMs
  } else {
    durationMs = 0;
  }

  if (end && !durationMs && !start.allDay && wallKey(end.wall, false) < wallKey(start.wall, false)) {
    warn(`DTEND is before DTSTART on "${(one("SUMMARY") ? unescapeText(one("SUMMARY")!.value).trim() : "an event").slice(0, 60)}"; that event is read as zero length.`);
  }

  const uid = one("UID") ? unescapeText(one("UID")!.value).trim() : "";
  const attendees: string[] = [];
  const attendeeLines: string[] = [];
  for (const a of props.ATTENDEE ?? []) {
    const cn = a.params.CN?.[0];
    const addr = a.value.replace(/^mailto:/i, "").trim();
    attendees.push(cn && cn !== addr ? `${cn} <${addr}>` : addr);
    if (a.raw) attendeeLines.push(a.raw);
  }
  const exdates: DateVal[] = [];
  for (const ex of props.EXDATE ?? []) {
    for (const v of splitList(ex.value)) {
      const dv = parseDateValue({ name: "EXDATE", params: ex.params, value: v }, localWarn);
      if (dv) exdates.push(dv);
    }
  }
  const rdates: DateVal[] = [];
  for (const rd of props.RDATE ?? []) {
    if ((rd.params.VALUE ?? []).some(v => v.toUpperCase() === "PERIOD")) continue;   // periods are not expanded
    for (const v of splitList(rd.value)) {
      const dv = parseDateValue({ name: "RDATE", params: rd.params, value: v }, localWarn);
      if (dv) rdates.push(dv);
    }
  }
  const rruleP = one("RRULE");
  const rrule = rruleP ? parseRRule(rruleP, localWarn) ?? undefined : undefined;
  const recP = one("RECURRENCE-ID");
  const recurrenceId = recP ? parseDateValue(recP, localWarn) ?? undefined : undefined;
  for (const w of localWarn) warn(w);

  const seq = Number(one("SEQUENCE")?.value);
  return {
    uid: uid || `no-uid-${start.wall.y}${start.wall.m}${start.wall.d}-${Math.abs(hash32(JSON.stringify(start)))}`,
    summary: one("SUMMARY") ? unescapeText(one("SUMMARY")!.value).trim() : "(no title)",
    description: one("DESCRIPTION") ? unescapeText(one("DESCRIPTION")!.value) : undefined,
    location: one("LOCATION") ? unescapeText(one("LOCATION")!.value).trim() : undefined,
    status: one("STATUS")?.value.trim().toUpperCase(),
    organizer: one("ORGANIZER")?.value.replace(/^mailto:/i, "").trim(),
    organizerLine: one("ORGANIZER")?.raw,
    attendees,
    attendeeLines,
    start, end, durationMs, rrule, exdates, rdates, recurrenceId,
    transparent: (one("TRANSP")?.value.trim().toUpperCase() ?? "OPAQUE") === "TRANSPARENT",
    sequence: Number.isFinite(seq) ? seq : 0,
  };
}

/**
 * A modified single instance of a series arrives as a second VEVENT with the same UID
 * plus RECURRENCE-ID. Without this the series still emits the original instance and
 * the moved one appears too: the user sees the meeting twice.
 */
function applyOverrides(events: CalEvent[]): void {
  const masters = new Map<string, CalEvent>();
  for (const e of events) if (!e.recurrenceId) masters.set(e.uid, e);
  for (const e of events) {
    if (!e.recurrenceId) continue;
    const master = masters.get(e.uid);
    if (master) master.exdates.push(e.recurrenceId);
  }
}

/* ------------------------------------------------------------- expansion */

export interface Occurrence {
  event: CalEvent;
  startUtc: Date;
  endUtc: Date;
  allDay: boolean;
  /** The recurrence key: the start wall clock as 20260310T093000, or 20260310 for a whole day. */
  key: string;
  /** The zone the start wall clock was read in. */
  zone: string;
}

export interface ExpandOptions {
  fromUtc: Date;
  toUtc: Date;
  /** Zone used for floating times and whole-day events. */
  defaultZone: string;
  limit?: number;
}

const P2 = (n: number) => String(n).padStart(2, "0");

export function wallKey(w: Wall, allDay: boolean): string {
  const d = `${w.y}${P2(w.m)}${P2(w.d)}`;
  return allDay ? d : `${d}T${P2(w.h)}${P2(w.mi)}${P2(w.s)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function dowOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addHoursWall(w: Wall, hours: number): Wall {
  const t = new Date(Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s));
  t.setUTCHours(t.getUTCHours() + hours);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), s: t.getUTCSeconds() };
}

function addDaysWall(w: Wall, days: number): Wall {
  const t = new Date(Date.UTC(w.y, w.m - 1, w.d));
  t.setUTCDate(t.getUTCDate() + days);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: w.h, mi: w.mi, s: w.s };
}

function wallLE(a: Wall, b: Wall): boolean {
  return wallKey(a, false) <= wallKey(b, false);
}

/**
 * The instant a wall clock happens at. A floating or whole-day value takes the
 * caller's zone; everything else takes its own TZID, so a Warsaw 10:00 series is
 * 09:00Z in winter and 08:00Z in summer without any rule table here.
 */
export function instantOf(w: Wall, zone: string): Date {
  try {
    return zonedToUtc(w, zone, { gap: "forward", fold: "first" });
  } catch (e) {
    if (e instanceof UnknownZoneError) return zonedToUtc(w, "UTC", { gap: "forward", fold: "first" });
    throw e;
  }
}

export function zoneOfEvent(e: CalEvent, defaultZone: string): string {
  const z = e.start.zone;
  if (!z) return defaultZone;
  return isValidZone(z) ? z : defaultZone;
}

/** RFC 5545 3.3.10 BYSETPOS: keep only the named positions of one period's candidate set. */
function applySetPos<T>(list: T[], pos?: number[]): T[] {
  if (!pos?.length) return list;
  const out: T[] = [];
  for (const p of pos) {
    const i = p > 0 ? p - 1 : list.length + p;
    if (i >= 0 && i < list.length && !out.includes(list[i])) out.push(list[i]);
  }
  return out;
}

/** Every start wall clock the rule produces, in order, starting at DTSTART. */
function* ruleWalls(start: Wall, r: RRule): Generator<Wall> {
  let steps = 0;
  const guard = () => { if (++steps > MAX_CANDIDATES) throw new IcsError("this recurrence rule produces too many dates to expand; narrow the window."); };
  if (r.freq === "HOURLY") {
    for (let n = 0; ; n++) { guard(); yield addHoursWall(start, n * r.interval); }
  }
  if (r.freq === "DAILY") {
    for (let n = 0; ; n++) { guard(); yield addDaysWall(start, n * r.interval); }
  }
  if (r.freq === "WEEKLY") {
    const days = (r.byDay?.length ? r.byDay.map(b => b.dow) : [dowOf(start.y, start.m, start.d)])
      .map(d => (d - r.wkst + 7) % 7)
      .sort((a, b) => a - b);
    const startOffset = (dowOf(start.y, start.m, start.d) - r.wkst + 7) % 7;
    const weekStart = addDaysWall(start, -startOffset);
    for (let w = 0; ; w++) {
      const base = addDaysWall(weekStart, w * r.interval * 7);
      for (const off of applySetPos(days, r.bySetPos)) {
        guard();
        const cand = addDaysWall(base, off);
        if (wallLE(start, cand)) yield cand;
      }
      guard();
    }
  }
  if (r.freq === "MONTHLY") {
    for (let n = 0; ; n++) {
      const total = (start.y * 12 + (start.m - 1)) + n * r.interval;
      const y = Math.floor(total / 12);
      const m = (total % 12) + 1;
      const dim = daysInMonth(y, m);
      const days: number[] = [];
      if (r.byMonthDay?.length) {
        for (const md of r.byMonthDay) {
          const d = md > 0 ? md : dim + md + 1;
          if (d >= 1 && d <= dim) days.push(d);
        }
      } else if (r.byDay?.length) {
        for (const b of r.byDay) {
          if (b.ord === null) {
            for (let d = 1; d <= dim; d++) if (dowOf(y, m, d) === b.dow) days.push(d);
          } else {
            const all: number[] = [];
            for (let d = 1; d <= dim; d++) if (dowOf(y, m, d) === b.dow) all.push(d);
            const pick = b.ord > 0 ? all[b.ord - 1] : all[all.length + b.ord];
            if (pick) days.push(pick);
          }
        }
      } else if (start.d <= dim) {
        // RFC 5545 3.3.10: an invalid date is skipped, never rolled into the next month.
        days.push(start.d);
      }
      days.sort((a, b) => a - b);
      for (const d of applySetPos(days, r.bySetPos)) {
        guard();
        const cand: Wall = { y, m, d, h: start.h, mi: start.mi, s: start.s };
        if (wallLE(start, cand)) yield cand;
      }
      guard();
    }
  }
  // YEARLY
  for (let n = 0; ; n++) {
    const y = start.y + n * r.interval;
    const months = r.byMonth?.length ? [...r.byMonth].sort((a, b) => a - b) : [start.m];
    const yearCands: Wall[] = [];
    for (const m of months) {
      const dim = daysInMonth(y, m);
      const days = r.byMonthDay?.length
        ? r.byMonthDay.map(md => (md > 0 ? md : dim + md + 1)).filter(d => d >= 1 && d <= dim).sort((a, b) => a - b)
        : r.byDay?.length
          ? (() => {
              const acc: number[] = [];
              for (const b of r.byDay!) {
                const all: number[] = [];
                for (let d = 1; d <= dim; d++) if (dowOf(y, m, d) === b.dow) all.push(d);
                if (b.ord === null) acc.push(...all);
                else { const pick = b.ord > 0 ? all[b.ord - 1] : all[all.length + b.ord]; if (pick) acc.push(pick); }
              }
              return acc.sort((a, b) => a - b);
            })()
          : (start.d <= dim ? [start.d] : []);          // 29 February is skipped in a common year
      for (const d of days) yearCands.push({ y, m, d, h: start.h, mi: start.mi, s: start.s });
    }
    for (const cand of applySetPos(yearCands, r.bySetPos)) {
      guard();
      if (wallLE(start, cand)) yield cand;
    }
    guard();
  }
}

/** Occurrences of one event inside a window, sorted by start. */
export function expandEvent(e: CalEvent, o: ExpandOptions): Occurrence[] {
  const zone = zoneOfEvent(e, o.defaultZone);
  const allDay = e.start.allDay;
  const out: Occurrence[] = [];
  const limit = Math.min(o.limit ?? MAX_OCCURRENCES, MAX_OCCURRENCES);

  const span = eventSpanMs(e, zone);
  const excluded = new Set<string>();
  for (const ex of e.exdates) {
    excluded.add(wallKey(ex.wall, ex.allDay));
    excluded.add(wallKey(ex.wall, true));     // an EXDATE written as a DATE kills the whole day
  }

  const emit = (w: Wall): boolean => {
    const key = wallKey(w, allDay);
    if (excluded.has(key) || excluded.has(wallKey(w, true))) return true;
    const startUtc = instantOf(w, zone);
    const endUtc = new Date(startUtc.getTime() + span);
    if (endUtc.getTime() <= o.fromUtc.getTime()) return true;
    if (startUtc.getTime() >= o.toUtc.getTime()) return true;
    out.push({ event: e, startUtc, endUtc, allDay, key, zone });
    return out.length < limit;
  };

  if (!e.rrule) {
    emit(e.start.wall);
  } else {
    const r = e.rrule;
    const untilMs = r.until
      ? instantOf(r.until.wall, r.until.zone && isValidZone(r.until.zone) ? r.until.zone : (r.until.allDay ? zone : "UTC")).getTime()
      : undefined;
    let n = 0;
    for (const w of ruleWalls(e.start.wall, r)) {
      const startUtc = instantOf(w, zone);
      // UNTIL is inclusive (RFC 5545 3.3.10), so an occurrence exactly at UNTIL counts.
      if (untilMs !== undefined && startUtc.getTime() > untilMs) break;
      n++;
      if (r.count !== undefined && n > r.count) break;
      if (startUtc.getTime() >= o.toUtc.getTime() && r.count === undefined) break;
      if (startUtc.getTime() >= o.toUtc.getTime() && r.count !== undefined) {
        // COUNT still has to be honoured, but nothing past the window can be returned.
        if (out.length) break;
        continue;
      }
      if (!emit(w)) break;
    }
  }
  for (const rd of e.rdates) {
    const startUtc = instantOf(rd.wall, rd.zone && isValidZone(rd.zone) ? rd.zone : zone);
    const endUtc = new Date(startUtc.getTime() + span);
    if (endUtc <= o.fromUtc || startUtc >= o.toUtc) continue;
    const key = wallKey(rd.wall, rd.allDay);
    if (excluded.has(key)) continue;
    if (out.some(x => x.startUtc.getTime() === startUtc.getTime())) continue;
    out.push({ event: e, startUtc, endUtc, allDay, key, zone });
  }
  out.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
  return out;
}

/** The length of one occurrence, in ms. */
export function eventSpanMs(e: CalEvent, zone: string): number {
  if (e.durationMs) return e.durationMs;
  const endZone = e.end.zone && isValidZone(e.end.zone) ? e.end.zone : zone;
  const a = instantOf(e.start.wall, e.start.zone && isValidZone(e.start.zone) ? e.start.zone : zone).getTime();
  const b = instantOf(e.end.wall, e.end.allDay ? zone : endZone).getTime();
  const span = b - a;
  if (span > 0) return span;
  return e.start.allDay ? 86_400_000 : 0;
}

export function expandAll(events: CalEvent[], o: ExpandOptions): Occurrence[] {
  const out: Occurrence[] = [];
  const limit = Math.min(o.limit ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  for (const e of events) {
    if (e.status === "CANCELLED") continue;
    for (const occ of expandEvent(e, { ...o, limit: limit - out.length })) {
      out.push(occ);
      if (out.length >= limit) break;
    }
    if (out.length >= limit) break;
  }
  out.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime() || a.event.summary.localeCompare(b.event.summary));
  return out;
}

/* ------------------------------------------------------------------ ids */

/** FNV-1a. Short, stable across processes, and not a security boundary. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function hashHex(s: string): string {
  return hash32(s).toString(16).padStart(8, "0");
}

/**
 * An event id addresses one occurrence: calendar slug, a hash of the UID, and the
 * recurrence key. It is reversible enough to rebuild the occurrence without scanning
 * a window, which is what `event_export` and `event_to_time_entry` need.
 */
export function occurrenceId(calSlug: string, occ: Occurrence): string {
  return `${calSlug}.${hashHex(occ.event.uid)}.${occ.key}`;
}

export interface ParsedId { calSlug: string; uidHash: string; key: string }

export function parseOccurrenceId(id: string): ParsedId | null {
  const m = /^([a-z0-9_-]+)\.([0-9a-f]{8})\.(\d{8}(?:T\d{6})?)$/.exec(String(id ?? "").trim());
  if (!m) return null;
  return { calSlug: m[1], uidHash: m[2], key: m[3] };
}

/** Rebuild one occurrence from an id without expanding a window. */
export function occurrenceFromKey(e: CalEvent, key: string, defaultZone: string): Occurrence | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?$/.exec(key);
  if (!m) return null;
  const zone = zoneOfEvent(e, defaultZone);
  const wall: Wall = {
    y: Number(m[1]), m: Number(m[2]), d: Number(m[3]),
    h: m[4] ? Number(m[4]) : 0, mi: m[5] ? Number(m[5]) : 0, s: m[6] ? Number(m[6]) : 0,
  };
  const startUtc = instantOf(wall, zone);
  const span = eventSpanMs(e, zone);
  return { event: e, startUtc, endUtc: new Date(startUtc.getTime() + span), allDay: e.start.allDay, key, zone };
}

/* ------------------------------------------------------- busy and conflicts */

export interface Block { startUtc: Date; endUtc: Date; labels: string[] }

/** Merge overlapping and touching intervals. */
export function mergeBlocks(occ: { startUtc: Date; endUtc: Date; label: string }[]): Block[] {
  const sorted = [...occ].sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
  const out: Block[] = [];
  for (const o of sorted) {
    const last = out[out.length - 1];
    if (last && o.startUtc.getTime() <= last.endUtc.getTime()) {
      if (o.endUtc > last.endUtc) last.endUtc = o.endUtc;
      if (!last.labels.includes(o.label)) last.labels.push(o.label);
    } else {
      out.push({ startUtc: o.startUtc, endUtc: o.endUtc, labels: [o.label] });
    }
  }
  return out;
}

export interface ConflictPair { a: Occurrence; b: Occurrence; overlapMinutes: number }

/** Every pair of occurrences that overlap in time. O(n log n) on a swept list. */
export function findConflicts(occs: Occurrence[]): ConflictPair[] {
  const sorted = [...occs].sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
  const out: ConflictPair[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      if (b.startUtc.getTime() >= a.endUtc.getTime()) break;
      const overlap = Math.min(a.endUtc.getTime(), b.endUtc.getTime()) - b.startUtc.getTime();
      if (overlap > 0) out.push({ a, b, overlapMinutes: Math.round(overlap / 60000) });
    }
  }
  return out;
}

/** Local wall clock of an instant, for display. */
export function localWall(d: Date, zone: string): Wall {
  return wallIn(d, zone);
}
