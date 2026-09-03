// The period contract, pinned. Every rule documented at the top of src/period.ts has a
// case here; these are pure functions, so nothing below depends on the clock.
import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysIso, addMonthsIso, daysInMonth, isIsoDate, nextOccurrence,
  occurrence, occurrencesBetween,
} from "../dist/period.js";

const series = (rule, n) => Array.from({ length: n }, (_, k) => occurrence(rule, k));

test("monthly from Jan 31 clamps to the month end and never carries the clamp forward", () => {
  const rule = { every: "monthly", start_date: "2026-01-31" };
  assert.deepEqual(series(rule, 6), [
    "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30",
  ]);
  // 2028 is a leap year: February takes the 29th, March is back on the 31st.
  assert.deepEqual(series({ every: "monthly", start_date: "2028-01-31" }, 3),
    ["2028-01-31", "2028-02-29", "2028-03-31"]);
});

test("monthly from the 30th and from a safe day", () => {
  assert.deepEqual(series({ every: "monthly", start_date: "2026-01-30" }, 4),
    ["2026-01-30", "2026-02-28", "2026-03-30", "2026-04-30"]);
  assert.deepEqual(series({ every: "monthly", start_date: "2026-01-15" }, 3),
    ["2026-01-15", "2026-02-15", "2026-03-15"]);
});

test("quarterly steps three months and clamps the same way", () => {
  assert.deepEqual(series({ every: "quarterly", start_date: "2026-01-31" }, 5),
    ["2026-01-31", "2026-04-30", "2026-07-31", "2026-10-31", "2027-01-31"]);
  assert.deepEqual(series({ every: "quarterly", start_date: "2025-11-30" }, 3),
    ["2025-11-30", "2026-02-28", "2026-05-30"]);
});

test("yearly on Feb 29 falls back to Feb 28 in common years and returns in leap years", () => {
  assert.deepEqual(series({ every: "yearly", start_date: "2028-02-29" }, 5),
    ["2028-02-29", "2029-02-28", "2030-02-28", "2031-02-28", "2032-02-29"]);
});

test("weekly is exactly 7 days and crosses months and years", () => {
  assert.deepEqual(series({ every: "weekly", start_date: "2026-12-20" }, 4),
    ["2026-12-20", "2026-12-27", "2027-01-03", "2027-01-10"]);
});

test("custom {days: n}", () => {
  assert.deepEqual(series({ every: { days: 10 }, start_date: "2026-02-20" }, 4),
    ["2026-02-20", "2026-03-02", "2026-03-12", "2026-03-22"]);
  assert.deepEqual(series({ every: { days: 1 }, start_date: "2026-02-27" }, 3),
    ["2026-02-27", "2026-02-28", "2026-03-01"]);
});

test("end_date is INCLUSIVE and the range low bound is exclusive of earlier periods", () => {
  const rule = { every: "monthly", start_date: "2026-01-15", end_date: "2026-04-15" };
  // The occurrence landing exactly on end_date is generated.
  assert.deepEqual(occurrencesBetween(rule, "2026-12-31"),
    ["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15"]);
  // One day earlier as the end date drops that final occurrence.
  assert.deepEqual(occurrencesBetween({ ...rule, end_date: "2026-04-14" }, "2026-12-31"),
    ["2026-01-15", "2026-02-15", "2026-03-15"]);
  // `to` is inclusive on the same basis.
  assert.deepEqual(occurrencesBetween({ every: "monthly", start_date: "2026-01-15" }, "2026-03-15"),
    ["2026-01-15", "2026-02-15", "2026-03-15"]);
  assert.deepEqual(occurrencesBetween({ every: "monthly", start_date: "2026-01-15" }, "2026-03-14"),
    ["2026-01-15", "2026-02-15"]);
  // `from` filters, and never yields a date before start_date.
  assert.deepEqual(occurrencesBetween(rule, "2026-12-31", "2026-03-01"), ["2026-03-15", "2026-04-15"]);
  assert.deepEqual(occurrencesBetween(rule, "2026-12-31", "2020-01-01"),
    ["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15"]);
});

test("anchor_day and end_of_month rules", () => {
  assert.deepEqual(series({ every: "monthly", start_date: "2026-01-05", anchor_day: 15 }, 3),
    ["2026-01-15", "2026-02-15", "2026-03-15"]);
  assert.deepEqual(series({ every: "monthly", start_date: "2026-01-05", anchor_day: 31 }, 4),
    ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.deepEqual(series({ every: "monthly", start_date: "2026-01-05", end_of_month: true }, 3),
    ["2026-01-31", "2026-02-28", "2026-03-31"]);
  // An anchored first occurrence BEFORE start_date is dropped, not billed early.
  assert.deepEqual(occurrencesBetween({ every: "monthly", start_date: "2026-01-20", anchor_day: 5 }, "2026-04-30"),
    ["2026-02-05", "2026-03-05", "2026-04-05"]);
});

test("nextOccurrence stops at end_date", () => {
  const rule = { every: "monthly", start_date: "2026-01-15", end_date: "2026-03-15" };
  assert.equal(nextOccurrence(rule, "2026-01-15"), "2026-02-15");
  assert.equal(nextOccurrence(rule, "2026-02-15"), "2026-03-15");
  assert.equal(nextOccurrence(rule, "2026-03-15"), null);
});

test("a schedule far older than MAX_OCCURRENCES still reports occurrences and next_due today", () => {
  // Daily since 2010-01-01: by 2026-09 that's ~6100 days, well past MAX_OCCURRENCES=5000,
  // so a k=0 scan would exhaust its cap before ever reaching the present (Review V5 P1).
  const rule = { every: { days: 1 }, start_date: "2010-01-01" };
  assert.deepEqual(occurrencesBetween(rule, "2026-09-05", "2026-09-01"),
    ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"]);
  assert.equal(nextOccurrence(rule, "2026-09-01"), "2026-09-02");

  // Same defect shape for a month-stepped rule started decades ago.
  const monthly = { every: "monthly", start_date: "1990-06-15" };
  assert.deepEqual(occurrencesBetween(monthly, "2026-09-30", "2026-08-01"),
    ["2026-08-15", "2026-09-15"]);
  assert.equal(nextOccurrence(monthly, "2026-09-15"), "2026-10-15");

  // A short-interval rule (weekly) started decades ago, exercising the 7-day step path.
  const weekly = { every: "weekly", start_date: "2005-03-07" };
  assert.equal(nextOccurrence(weekly, "2026-09-01") > "2026-09-01", true);
});

test("date helpers", () => {
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2100, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
  assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysIso("2026-03-01", -1), "2026-02-28");
  assert.equal(addMonthsIso("2026-03-31", -1), "2026-02-28");
  assert.ok(isIsoDate("2026-02-28"));
  assert.ok(!isIsoDate("2026-02-30"));
  assert.ok(!isIsoDate("2026-13-01"));
  assert.ok(!isIsoDate("26-01-01"));
});
