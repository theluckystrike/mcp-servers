import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tz = await import(join(here, "..", "dist", "tz.js"));

const at = (s) => new Date(s);

test("DST: Europe/Warsaw and America/New_York are out of step on 2026-03-15", () => {
  // Warsaw switches 2026-03-29, New York 2026-03-08, so on 15 March Warsaw is still on
  // CET (+01:00) while New York is already on EDT (-04:00): 5 hours apart, not the
  // usual 6.
  const d = at("2026-03-15T12:00:00Z");
  assert.equal(tz.offsetMinutes(d, "Europe/Warsaw"), 60);
  assert.equal(tz.offsetMinutes(d, "America/New_York"), -240);
  assert.equal((60 - -240) / 60, 5);
});

test("DST: on 2026-11-01 the gap is 5 hours again, the other way round", () => {
  // Warsaw went back on 2026-10-25; New York goes back on 2026-11-01 at 06:00 UTC.
  const before = at("2026-11-01T04:00:00Z");
  const after = at("2026-11-01T12:00:00Z");
  assert.equal(tz.offsetMinutes(before, "Europe/Warsaw"), 60);
  assert.equal(tz.offsetMinutes(before, "America/New_York"), -240);
  assert.equal(tz.offsetMinutes(after, "Europe/Warsaw"), 60);
  assert.equal(tz.offsetMinutes(after, "America/New_York"), -300);
});

test("dst_changes finds both transitions to the minute", () => {
  const w = tz.dstChanges("Europe/Warsaw", 2026).map(c => c.atUtc.toISOString());
  assert.deepEqual(w, ["2026-03-29T01:00:00.000Z", "2026-10-25T01:00:00.000Z"]);
  const n = tz.dstChanges("America/New_York", 2026).map(c => c.atUtc.toISOString());
  assert.deepEqual(n, ["2026-03-08T07:00:00.000Z", "2026-11-01T06:00:00.000Z"]);
  const none = tz.dstChanges("Asia/Kolkata", 2026);
  assert.equal(none.length, 0);
});

test("Asia/Kolkata keeps its half-hour offset through conversion", () => {
  assert.equal(tz.offsetMinutes(at("2026-09-10T12:00:00Z"), "Asia/Kolkata"), 330);
  assert.equal(tz.offsetLabel(330), "UTC+05:30");
  const start = tz.parseTimeIn("2026-09-10 15:00", "Europe/Warsaw");
  assert.equal(start.toISOString(), "2026-09-10T13:00:00.000Z");
  const w = tz.wallIn(start, "Asia/Kolkata");
  assert.equal(tz.timeKey(w), "18:30");
  // Kathmandu is +05:45, the quarter-hour case
  assert.equal(tz.offsetMinutes(at("2026-09-10T12:00:00Z"), "Asia/Kathmandu"), 345);
});

test("zonedToUtc round-trips across a spring-forward gap", () => {
  // 02:30 on 2026-03-29 does not exist in Warsaw; the result must be a real instant
  // and must not silently land an hour before the jump.
  const d = tz.zonedToUtc({ y: 2026, m: 3, d: 29, h: 2, mi: 30, s: 0 }, "Europe/Warsaw");
  assert.ok(!Number.isNaN(d.getTime()));
  assert.equal(d.toISOString(), "2026-03-29T01:30:00.000Z");
  assert.equal(tz.timeKey(tz.wallIn(d, "Europe/Warsaw")), "03:30");
  // a normal time round-trips exactly
  const n = tz.zonedToUtc({ y: 2026, m: 7, d: 1, h: 9, mi: 15, s: 0 }, "Europe/Warsaw");
  assert.equal(tz.timeKey(tz.wallIn(n, "Europe/Warsaw")), "09:15");
});

test("overlap math: Warsaw and New York share 2 hours of a 09:00-17:00 day", () => {
  const o = tz.overlapOnDate(
    [{ zone: "Europe/Warsaw", startMin: 540, endMin: 1020 },
     { zone: "America/New_York", startMin: 540, endMin: 1020 }],
    at("2026-09-10T12:00:00Z"),
  );
  assert.deepEqual(o, { startMin: 780, endMin: 900 });   // 13:00-15:00 UTC
  assert.equal((o.endMin - o.startMin) / 60, 2);
});

test("overlap math: on 2026-03-15 the same pair share 3 hours, not 2", () => {
  // the DST gap is one hour narrower that week, so the overlap is one hour wider
  const o = tz.overlapOnDate(
    [{ zone: "Europe/Warsaw", startMin: 540, endMin: 1020 },
     { zone: "America/New_York", startMin: 540, endMin: 1020 }],
    at("2026-03-16T12:00:00Z"),
  );
  assert.equal((o.endMin - o.startMin) / 60, 3);
});

test("overlap is null when the working days cannot meet", () => {
  const o = tz.overlapOnDate(
    [{ zone: "America/Los_Angeles", startMin: 540, endMin: 1020 },
     { zone: "Asia/Tokyo", startMin: 540, endMin: 1020 }],
    at("2026-09-10T12:00:00Z"),
  );
  assert.equal(o, null);
});

test("slot ranking puts the fairest slot first and every slot fits every window", () => {
  const parts = [
    { name: "A", zone: "Europe/Warsaw", startMin: 540, endMin: 1020 },
    { name: "B", zone: "Europe/London", startMin: 540, endMin: 1020 },
    { name: "C", zone: "America/New_York", startMin: 540, endMin: 1020 },
  ];
  const slots = tz.findSlots(parts, 60, 5, at("2026-09-07T00:00:00Z"));
  assert.ok(slots.length > 0, "expected slots for Warsaw/London/New York");
  for (const s of slots) {
    for (const p of parts) {
      const w = tz.wallIn(s.startUtc, p.zone);
      const startMin = w.h * 60 + w.mi;
      assert.ok(startMin >= p.startMin, `${p.name} starts before working hours`);
      assert.ok(startMin + 60 <= p.endMin, `${p.name} ends after working hours`);
    }
    assert.ok(["Sat", "Sun"].indexOf(tz.weekdayIn(s.startUtc, parts[0].zone)) === -1);
  }
  for (let i = 1; i < slots.length; i++) {
    assert.ok(slots[i].fairness >= slots[i - 1].fairness, "slots are not sorted by fairness");
  }
  // fairness is the WORST participant's distance from 13:00 local, not the mean
  const best = slots[0];
  const worstDev = Math.max(...best.local.map(l => {
    const [h, m] = l.start.split(":").map(Number);
    return Math.abs((h * 60 + m + 30) - 780) / 60;
  }));
  assert.equal(best.fairness, Math.round(worstDev * 100) / 100);
});

test("an impossible trio returns no slots rather than a bad one", () => {
  const parts = [
    { name: "A", zone: "America/New_York", startMin: 540, endMin: 1020 },
    { name: "B", zone: "Asia/Kolkata", startMin: 540, endMin: 1020 },
  ];
  assert.equal(tz.findSlots(parts, 60, 5, at("2026-09-07T00:00:00Z")).length, 0);
});

test("business_days excludes weekends and the holidays given", () => {
  const r = tz.businessDays("2026-09-01", "2026-09-30", "Europe/Warsaw", ["2026-09-15"]);
  assert.equal(r.total, 30);
  assert.equal(r.weekendCount, 8);
  assert.equal(r.holidayCount, 1);
  assert.equal(r.days.length, 21);
  assert.ok(!r.days.includes("2026-09-15"));
  const one = tz.businessDays("2026-09-07", "2026-09-07", "UTC");
  assert.deepEqual(one.days, ["2026-09-07"]);
});

test("ics: UTC DTSTART with Z, CRLF endings, UID present, escaping", () => {
  const text = tz.icsCreate({
    title: "Kickoff; with, Acme",
    startUtc: at("2026-09-10T13:00:00Z"),
    durationMinutes: 45,
    attendees: ["maria@acme.com"],
    description: "Line one\nline two",
    now: at("2026-09-01T00:00:00Z"),
  });
  assert.ok(text.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(text.endsWith("END:VCALENDAR\r\n"));
  assert.equal(text.split("\r\n").length - 1, text.split("\n").length - 1, "every LF must be part of a CRLF");
  const lines = text.split("\r\n");
  assert.ok(lines.includes("VERSION:2.0"));
  assert.ok(lines.includes("DTSTART:20260910T130000Z"), text);
  assert.ok(lines.includes("DTEND:20260910T134500Z"), text);
  assert.ok(lines.includes("DTSTAMP:20260901T000000Z"));
  const uid = lines.find(l => l.startsWith("UID:"));
  assert.ok(uid && uid.length > 5, "UID missing");
  assert.ok(lines.some(l => l === "SUMMARY:Kickoff\\; with\\, Acme"), text);
  assert.ok(lines.some(l => l.startsWith("DESCRIPTION:") && l.includes("\\n")));
  assert.ok(lines.some(l => l.includes("mailto:maria@acme.com")));
  assert.equal(lines.filter(l => l === "BEGIN:VEVENT").length, 1);
  assert.equal(lines.filter(l => l === "END:VEVENT").length, 1);
  assert.ok(!text.includes("VTIMEZONE"), "UTC times must need no VTIMEZONE block");
  for (const l of lines) assert.ok(Buffer.byteLength(l, "utf8") <= 75, `line over 75 octets: ${l}`);
});

test("ics folds a long summary at 75 octets with a leading-space continuation", () => {
  const text = tz.icsCreate({
    title: "x".repeat(200), startUtc: at("2026-09-10T13:00:00Z"), durationMinutes: 30,
  });
  const lines = text.split("\r\n");
  const cont = lines.filter(l => l.startsWith(" "));
  assert.ok(cont.length >= 2, "expected folded continuation lines");
  for (const l of lines) assert.ok(Buffer.byteLength(l, "utf8") <= 75);
});

test("place table: every entry resolves, cities and countries both work", () => {
  assert.equal(tz.DROPPED_PLACES.length, 0, `dropped: ${tz.DROPPED_PLACES.join(", ")}`);
  assert.ok(tz.PLACE_COUNT >= 300, `only ${tz.PLACE_COUNT} places`);
  assert.equal(tz.resolveZone("Warsaw").zone, "Europe/Warsaw");
  assert.equal(tz.resolveZone("poland").zone, "Europe/Warsaw");
  assert.equal(tz.resolveZone("New York").zone, "America/New_York");
  assert.equal(tz.resolveZone("india").zone, "Asia/Kolkata");
  assert.equal(tz.resolveZone("Asia/Kolkata").zone, "Asia/Kolkata");
  assert.equal(tz.resolveZone("PST").zone, "America/Los_Angeles");
  assert.equal(tz.resolveZone("UTC+2").zone, "Etc/GMT-2");   // Etc signs are inverted
  assert.equal(tz.offsetMinutes(at("2026-09-10T12:00:00Z"), "Etc/GMT-2"), 120);
});

test("an unknown place returns suggestions, never a silent wrong zone", () => {
  assert.throws(() => tz.resolveZone("Warsawa"), (e) => {
    assert.ok(e instanceof tz.UnknownZoneError);
    assert.match(e.message, /Did you mean/);
    assert.ok(e.suggestions.some(s => s.includes("Europe/Warsaw")));
    return true;
  });
  assert.throws(() => tz.resolveZone("Atlantis"), /unknown time zone or place/);
});

test("parseTimeIn: wall time, ISO with Z, and relative phrases", () => {
  assert.equal(tz.parseTimeIn("2026-09-10 15:00", "Europe/Warsaw").toISOString(), "2026-09-10T13:00:00.000Z");
  assert.equal(tz.parseTimeIn("2026-09-10T15:00", "Europe/Warsaw").toISOString(), "2026-09-10T13:00:00.000Z");
  // an explicit offset wins over from_zone
  assert.equal(tz.parseTimeIn("2026-09-10T15:00:00Z", "Europe/Warsaw").toISOString(), "2026-09-10T15:00:00.000Z");
  assert.equal(tz.parseTimeIn("2026-09-10T15:00:00+05:30", "Europe/Warsaw").toISOString(), "2026-09-10T09:30:00.000Z");
  const now = at("2026-09-10T08:00:00Z");
  assert.equal(tz.parseTimeIn("3pm tomorrow", "Europe/Warsaw", now).toISOString(), "2026-09-11T13:00:00.000Z");
  assert.equal(tz.parseTimeIn("tomorrow 3pm", "Europe/Warsaw", now).toISOString(), "2026-09-11T13:00:00.000Z");
  assert.equal(tz.parseTimeIn("3pm", "Europe/Warsaw", now).toISOString(), "2026-09-10T13:00:00.000Z");
  assert.equal(tz.parseTimeIn("09:30", "Asia/Kolkata", now).toISOString(), "2026-09-10T04:00:00.000Z");
  assert.throws(() => tz.parseTimeIn("sometime soonish", "UTC"), /not a valid time/);
});
