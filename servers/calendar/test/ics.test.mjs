// The parser and the recurrence expander, against the shapes real exports use.
import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ics = await import(join(here, "..", "dist", "ics.js"));

const CRLF = (lines) => lines.join("\r\n") + "\r\n";
const wrap = (body) => CRLF(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//EN", ...body, "END:VCALENDAR"]);

const win = (from, to, zone = "UTC") => ({
  fromUtc: new Date(`${from}T00:00:00Z`),
  toUtc: new Date(`${to}T00:00:00Z`),
  defaultZone: zone,
});

test("unfolding rejoins a continuation line and keeps a second space", () => {
  const text = "SUMMARY:Quarterly review with\r\n  Maria\r\nLOCATION:Room 4\r\n";
  const lines = ics.unfold(text);
  assert.deepEqual(lines.slice(0, 2), ["SUMMARY:Quarterly review with Maria", "LOCATION:Room 4"]);
});

test("unfolding accepts bare LF (Outlook) and bare CR (old Apple)", () => {
  assert.deepEqual(ics.unfold("A:1\nB:2"), ["A:1", "B:2"]);
  assert.deepEqual(ics.unfold("A:1\rB:2"), ["A:1", "B:2"]);
});

test("TEXT escaping: \\n \\, \; and \\\\ come back as the real characters", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:esc@test", "DTSTART:20260310T090000Z", "DTEND:20260310T100000Z",
    "SUMMARY:Acme\\, Ltd\; kickoff",
    "DESCRIPTION:line one\\nline two\\\\end",
    "END:VEVENT",
  ]));
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].summary, "Acme, Ltd; kickoff");
  assert.equal(parsed.events[0].description, "line one\nline two\\end");
});

test("a quoted parameter value containing a colon does not truncate the property", () => {
  const p = ics.parseProp('DTSTART;TZID="Europe/Warsaw";X-Q="a:b":20260310T093000');
  assert.equal(p.name, "DTSTART");
  assert.equal(p.value, "20260310T093000");
  assert.deepEqual(p.params.TZID, ["Europe/Warsaw"]);
});

test("all-day event: DTSTART;VALUE=DATE, and DTEND is exclusive", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:allday@test", "DTSTART;VALUE=DATE:20260601", "DTEND;VALUE=DATE:20260603",
    "SUMMARY:Offsite", "END:VEVENT",
  ]));
  const e = parsed.events[0];
  assert.equal(e.start.allDay, true);
  const occ = ics.expandEvent(e, win("2026-05-30", "2026-06-10", "Europe/Warsaw"));
  assert.equal(occ.length, 1);
  // 1 and 2 June: two days, so 48 hours, and 3 June is not part of it.
  assert.equal(occ[0].endUtc - occ[0].startUtc, 48 * 3600 * 1000);
  assert.equal(occ[0].startUtc.toISOString(), "2026-05-31T22:00:00.000Z");   // midnight Warsaw, CEST
});

test("a whole-day event with no DTEND and no DURATION lasts exactly one day", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:oneday@test", "DTSTART;VALUE=DATE:20260601", "SUMMARY:Holiday", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-05-30", "2026-06-10", "UTC"));
  assert.equal(occ[0].endUtc - occ[0].startUtc, 86400000);
});

test("TZID is honoured and VTIMEZONE is ignored in favour of ICU", () => {
  const parsed = ics.parseIcs(wrap([
    // A deliberately wrong inline VTIMEZONE: if it were used the event would move.
    "BEGIN:VTIMEZONE", "TZID:Europe/Warsaw",
    "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0900", "TZOFFSETTO:+0900", "TZNAME:WRONG",
    "END:STANDARD", "END:VTIMEZONE",
    "BEGIN:VEVENT", "UID:tzid@test",
    "DTSTART;TZID=Europe/Warsaw:20260115T100000", "DTEND;TZID=Europe/Warsaw:20260115T110000",
    "SUMMARY:Warsaw winter call", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-01-01", "2026-02-01", "UTC"));
  assert.equal(occ[0].startUtc.toISOString(), "2026-01-15T09:00:00.000Z");   // CET, +01:00
  assert.equal(parsed.events[0].start.zone, "Europe/Warsaw");
});

test("DURATION is read when DTEND is absent", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:dur@test", "DTSTART:20260310T090000Z", "DURATION:PT1H30M",
    "SUMMARY:Standup", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-03-01", "2026-04-01"));
  assert.equal(occ[0].endUtc.toISOString(), "2026-03-10T10:30:00.000Z");
  assert.equal(ics.parseDuration("P1W"), 7 * 86400000);
  assert.equal(ics.parseDuration("nonsense"), null);
});

test("RRULE weekly BYDAY=MO,WE with COUNT=5 produces exactly five dates in order", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:weekly@test", "DTSTART:20260302T090000Z", "DTEND:20260302T093000Z",
    "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=5", "SUMMARY:Standup", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-01-01", "2027-01-01"));
  assert.equal(occ.length, 5);
  assert.deepEqual(occ.map(o => o.startUtc.toISOString().slice(0, 10)),
    ["2026-03-02", "2026-03-04", "2026-03-09", "2026-03-11", "2026-03-16"]);
});

test("RRULE weekly INTERVAL=2 skips the odd weeks", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:biweekly@test", "DTSTART:20260302T090000Z", "DTEND:20260302T093000Z",
    "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;COUNT=3", "SUMMARY:Fortnightly", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-01-01", "2027-01-01"));
  assert.deepEqual(occ.map(o => o.startUtc.toISOString().slice(0, 10)),
    ["2026-03-02", "2026-03-16", "2026-03-30"]);
});

test("RRULE monthly on day 31 skips February rather than rolling into March", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:month31@test", "DTSTART:20260131T120000Z", "DTEND:20260131T130000Z",
    "RRULE:FREQ=MONTHLY;COUNT=4", "SUMMARY:Invoice run", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-01-01", "2027-01-01"));
  const days = occ.map(o => o.startUtc.toISOString().slice(0, 10));
  assert.deepEqual(days, ["2026-01-31", "2026-03-31", "2026-05-31", "2026-07-31"]);
  assert.ok(!days.some(d => d.startsWith("2026-02")), "February has no 31st, so it must be skipped");
  assert.ok(!days.some(d => d === "2026-03-03"), "an invalid date must never roll forward");
});

test("RRULE monthly BYMONTHDAY=-1 lands on the last day of a short month", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:last@test", "DTSTART:20260131T120000Z", "DTEND:20260131T130000Z",
    "RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3", "SUMMARY:Month end", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-01-01", "2027-01-01"));
  assert.deepEqual(occ.map(o => o.startUtc.toISOString().slice(0, 10)),
    ["2026-01-31", "2026-02-28", "2026-03-31"]);
});

test("RRULE yearly on 29 February skips the common years", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:leap@test", "DTSTART:20240229T120000Z", "DTEND:20240229T130000Z",
    "RRULE:FREQ=YEARLY;COUNT=2", "SUMMARY:Leap day", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2024-01-01", "2032-01-01"));
  assert.deepEqual(occ.map(o => o.startUtc.toISOString().slice(0, 10)), ["2024-02-29", "2028-02-29"]);
});

test("UNTIL is inclusive: an occurrence exactly at UNTIL is kept", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:until@test", "DTSTART:20260302T090000Z", "DTEND:20260302T093000Z",
    "RRULE:FREQ=DAILY;UNTIL=20260305T090000Z", "SUMMARY:Daily", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-01-01", "2027-01-01"));
  assert.deepEqual(occ.map(o => o.startUtc.toISOString().slice(0, 10)),
    ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"]);
});

test("EXDATE removes exactly the excluded occurrence", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:exd@test", "DTSTART:20260302T090000Z", "DTEND:20260302T093000Z",
    "RRULE:FREQ=DAILY;COUNT=4", "EXDATE:20260303T090000Z,20260304T090000Z",
    "SUMMARY:Daily", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-01-01", "2027-01-01"));
  assert.deepEqual(occ.map(o => o.startUtc.toISOString().slice(0, 10)), ["2026-03-02", "2026-03-05"]);
});

test("a RECURRENCE-ID override does not leave the original instance behind", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:series@test", "DTSTART:20260302T090000Z", "DTEND:20260302T093000Z",
    "RRULE:FREQ=DAILY;COUNT=3", "SUMMARY:Daily", "END:VEVENT",
    "BEGIN:VEVENT", "UID:series@test", "RECURRENCE-ID:20260303T090000Z",
    "DTSTART:20260303T140000Z", "DTEND:20260303T143000Z", "SUMMARY:Daily (moved)", "END:VEVENT",
  ]));
  const occ = ics.expandAll(parsed.events, win("2026-03-01", "2026-03-10"));
  const stamps = occ.map(o => o.startUtc.toISOString());
  assert.equal(stamps.filter(s => s.startsWith("2026-03-03")).length, 1);
  assert.deepEqual(stamps, ["2026-03-02T09:00:00.000Z", "2026-03-03T14:00:00.000Z", "2026-03-04T09:00:00.000Z"]);
});

test("a Europe/Warsaw weekly event keeps 10:00 local across the March DST change", () => {
  // Warsaw moves to CEST on 2026-03-29. A weekly Sunday 10:00 series is 09:00Z before
  // it and 08:00Z after: the wall clock is what recurs, not the instant.
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:dst@test",
    "DTSTART;TZID=Europe/Warsaw:20260322T100000", "DTEND;TZID=Europe/Warsaw:20260322T110000",
    "RRULE:FREQ=WEEKLY;BYDAY=SU;COUNT=3", "SUMMARY:Sunday sync", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-03-01", "2026-04-30", "Europe/Warsaw"));
  assert.deepEqual(occ.map(o => o.startUtc.toISOString()), [
    "2026-03-22T09:00:00.000Z",   // CET
    "2026-03-29T08:00:00.000Z",   // CEST, the changeover day itself
    "2026-04-05T08:00:00.000Z",   // CEST
  ]);
  // and every one of them is still 10:00 on the Warsaw clock
  for (const o of occ) {
    assert.equal(ics.localWall(o.startUtc, "Europe/Warsaw").h, 10);
  }
});

test("an unparseable event is skipped and counted, the rest of the file survives", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:good@test", "DTSTART:20260310T090000Z", "DTEND:20260310T100000Z", "SUMMARY:Good", "END:VEVENT",
    "BEGIN:VEVENT", "UID:bad@test", "DTSTART:not-a-date", "SUMMARY:Bad", "END:VEVENT",
    "BEGIN:VEVENT", "UID:nostart@test", "SUMMARY:No start", "END:VEVENT",
  ]));
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.skipped, 2);
  assert.ok(parsed.warnings.some(w => w.includes("skipped")));
});

test("a Windows TZID is reported and read as local rather than dropping the event", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:win@test",
    'DTSTART;TZID="W. Europe Standard Time":20260310T090000',
    'DTEND;TZID="W. Europe Standard Time":20260310T100000',
    "SUMMARY:Outlook meeting", "END:VEVENT",
  ]));
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].start.zone, null);
  assert.ok(parsed.warnings.some(w => w.includes("W. Europe Standard Time")));
  const occ = ics.expandEvent(parsed.events[0], win("2026-03-01", "2026-04-01", "Europe/Warsaw"));
  assert.equal(occ[0].startUtc.toISOString(), "2026-03-10T08:00:00.000Z");   // floating, read in Warsaw
});

test("VALARM inside a VEVENT does not leak into the event and does not end it early", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:alarm@test", "DTSTART:20260310T090000Z",
    "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "END:VALARM",
    "DTEND:20260310T100000Z", "SUMMARY:With alarm", "END:VEVENT",
  ]));
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].summary, "With alarm");
  assert.equal(parsed.events[0].description, undefined);
});

test("CANCELLED events are not expanded, TRANSPARENT ones are but are not busy", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:c@test", "DTSTART:20260310T090000Z", "DTEND:20260310T100000Z", "STATUS:CANCELLED", "SUMMARY:Off", "END:VEVENT",
    "BEGIN:VEVENT", "UID:t@test", "DTSTART:20260310T110000Z", "DTEND:20260310T120000Z", "TRANSP:TRANSPARENT", "SUMMARY:FYI", "END:VEVENT",
  ]));
  const occ = ics.expandAll(parsed.events, win("2026-03-01", "2026-04-01"));
  assert.equal(occ.length, 1);
  assert.equal(occ[0].event.transparent, true);
});

test("conflicts: overlapping pairs are found, touching events are not a conflict", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:a@test", "DTSTART:20260310T090000Z", "DTEND:20260310T100000Z", "SUMMARY:A", "END:VEVENT",
    "BEGIN:VEVENT", "UID:b@test", "DTSTART:20260310T093000Z", "DTEND:20260310T103000Z", "SUMMARY:B", "END:VEVENT",
    "BEGIN:VEVENT", "UID:c@test", "DTSTART:20260310T103000Z", "DTEND:20260310T110000Z", "SUMMARY:C", "END:VEVENT",
  ]));
  const occ = ics.expandAll(parsed.events, win("2026-03-01", "2026-04-01"));
  const pairs = ics.findConflicts(occ);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].overlapMinutes, 30);
});

test("mergeBlocks merges overlapping and touching intervals", () => {
  const b = ics.mergeBlocks([
    { startUtc: new Date("2026-03-10T09:00:00Z"), endUtc: new Date("2026-03-10T10:00:00Z"), label: "A" },
    { startUtc: new Date("2026-03-10T09:30:00Z"), endUtc: new Date("2026-03-10T11:00:00Z"), label: "B" },
    { startUtc: new Date("2026-03-10T13:00:00Z"), endUtc: new Date("2026-03-10T14:00:00Z"), label: "C" },
  ]);
  assert.equal(b.length, 2);
  assert.deepEqual(b[0].labels, ["A", "B"]);
  assert.equal(b[0].endUtc.toISOString(), "2026-03-10T11:00:00.000Z");
});

test("an occurrence id round-trips back to the same instant", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:round@test", "DTSTART;TZID=Europe/Warsaw:20260322T100000",
    "DTEND;TZID=Europe/Warsaw:20260322T110000", "RRULE:FREQ=WEEKLY;COUNT=3", "SUMMARY:R", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-03-01", "2026-04-30", "Europe/Warsaw"));
  const id = ics.occurrenceId("work", occ[1]);
  const p = ics.parseOccurrenceId(id);
  assert.equal(p.calSlug, "work");
  assert.equal(p.uidHash, ics.hashHex("round@test"));
  const rebuilt = ics.occurrenceFromKey(parsed.events[0], p.key, "Europe/Warsaw");
  assert.equal(rebuilt.startUtc.getTime(), occ[1].startUtc.getTime());
  assert.equal(rebuilt.endUtc.getTime(), occ[1].endUtc.getTime());
});

test("a file that is not a calendar is refused, an empty one too", () => {
  assert.throws(() => ics.parseIcs("hello world"), /not look like a calendar/);
  assert.throws(() => ics.parseIcs("   "), /empty/);
});

test("an unbounded daily rule is bounded by the window, not by memory", () => {
  const parsed = ics.parseIcs(wrap([
    "BEGIN:VEVENT", "UID:forever@test", "DTSTART:20200101T090000Z", "DTEND:20200101T093000Z",
    "RRULE:FREQ=DAILY", "SUMMARY:Forever", "END:VEVENT",
  ]));
  const occ = ics.expandEvent(parsed.events[0], win("2026-03-01", "2026-03-08"));
  assert.equal(occ.length, 7);
});
