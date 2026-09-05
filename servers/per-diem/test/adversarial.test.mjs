// The inputs that make a per diem wrong rather than absent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { client, sandbox, cleanup, perDiemDir, proKey, TRIP } from "./_client.mjs";

/** The store files this server owns, or none at all when the data dir was never created. */
function storeFiles(dataHome) {
  const dir = perDiemDir(dataHome);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
}

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

test("end before start is refused as instants, not as text", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const r = await c.call("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-05-06T18:00", end: "2026-05-04T08:00", timezone: "Europe/Warsaw" });
  assert.equal(r.isError, true);
  assert.match(r.text, /is not after start/);
  assert.match(r.text, /compared as instants, not as text/);

  const same = await c.call("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-05-04T08:00", end: "2026-05-04T08:00", timezone: "Europe/Warsaw" });
  assert.equal(same.isError, true, "a zero-length trip is not a trip");

  // The trap this catches: two strings that sort the wrong way round are the same instant.
  // 12:00+02:00 is EARLIER than 11:00+00:00, so a text comparison would refuse a real trip.
  const ok = await c.json("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-05-04T12:00:00+02:00", end: "2026-05-04T23:00:00+00:00" });
  assert.equal(ok.total_hours, 13);

  const rec = await c.call("trip_record", { name: "backwards", scheme: "pl", destination: "Poland", start: "2026-05-06T18:00", end: "2026-05-04T08:00", timezone: "Europe/Warsaw" });
  assert.equal(rec.isError, true);
  assert.equal(storeFiles(box.dataHome).length, 0, "a refused calculation writes no store");
});

test("an unknown country is refused by name and says the table is partial, not empty", async (t) => {
  const { c } = open(t);
  await c.init();
  const pl = await c.call("perdiem_calc", { scheme: "pl", destination: "Wakanda", start: "2026-05-04T08:00", end: "2026-05-05T08:00", timezone: "Europe/Warsaw" });
  assert.equal(pl.isError, true);
  assert.match(pl.text, /not in the bundled Polish table/);
  assert.match(pl.text, /"not verified here", not "no rate exists"/);

  // A country that IS in the annex but was not bundled fails the same way, on purpose.
  const om = await c.call("perdiem_calc", { scheme: "pl", destination: "Oman", start: "2026-05-04T08:00", end: "2026-05-05T08:00", timezone: "Europe/Warsaw" });
  assert.equal(om.isError, true);
  assert.match(om.text, /only the rows that could be stated with|not verified here/);

  const uk = await c.call("perdiem_calc", { scheme: "uk", destination: "Paris", start: "2026-05-04T08:00", end: "2026-05-05T08:00", timezone: "Europe/Paris" });
  assert.equal(uk.isError, true);
  assert.match(uk.text, /overseas scale rates are per city/);
  assert.match(uk.text, /NOT BUNDLED/);

  const us = await c.call("perdiem_calc", { scheme: "us", destination: "New York City", start: "2026-05-04T08:00", end: "2026-05-05T08:00", timezone: "America/New_York" });
  assert.equal(us.isError, true);
  assert.match(us.text, /CONUS STANDARD rate/);
});

test("a 400-day trip is refused and a 366-day one is not", async (t) => {
  const { c } = open(t);
  await c.init();
  const long = await c.call("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-01-01T08:00", end: "2027-02-05T08:00", timezone: "Europe/Warsaw" });
  assert.equal(long.isError, true);
  assert.match(long.text, /400 days/);
  assert.match(long.text, /relocation/);

  const edge = await c.json("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-01-01T08:00", end: "2027-01-02T08:00", timezone: "Europe/Warsaw" });
  assert.equal(edge.days.length, 366);
  assert.equal(edge.subsistence_minor, 366 * 4500);
});

test("a DST crossing is 23 or 25 elapsed hours, and the allowance follows the clock", async (t) => {
  const { c } = open(t);
  await c.init();
  // Europe/Warsaw springs forward on 2026-03-29: 02:00 becomes 03:00. Noon to noon is 23 hours.
  const spring = await c.json("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-03-28T12:00", end: "2026-03-29T12:00", timezone: "Europe/Warsaw" });
  assert.equal(spring.total_hours, 23, "a text diff would say 24");
  assert.equal(spring.days.length, 1);
  assert.equal(spring.total_minor, 4500, "23 hours is one under-24 trip over 12 hours: a whole diet, not two");

  // Autumn: 2026-10-25, 03:00 becomes 02:00, so noon to noon is 25 hours: one whole period
  // plus a 1-hour remainder, which the domestic rule pays at half a diet.
  const autumn = await c.json("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-10-24T12:00", end: "2026-10-25T12:00", timezone: "Europe/Warsaw" });
  assert.equal(autumn.total_hours, 25);
  assert.equal(autumn.days.length, 2);
  assert.deepEqual(autumn.days.map((d) => d.amount_minor), [4500, 2250]);
  assert.equal(autumn.total, "PLN 67.50");

  // The US scheme counts CALENDAR days, so the same 23-hour crossing is two days, not one.
  const us = await c.json("perdiem_calc", { scheme: "us", destination: "United States", start: "2026-03-07T12:00", end: "2026-03-08T12:00", timezone: "America/New_York" });
  assert.equal(us.total_hours, 23, "America/New_York springs forward on 2026-03-08");
  assert.equal(us.days.length, 2);
  assert.equal(us.subsistence_minor, 10200, "two first-or-last days at 51.00");
});

test("a datetime with no zone is refused rather than assumed", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.call("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-05-04T08:00", end: "2026-05-04T21:00" });
  assert.equal(r.isError, true);
  assert.match(r.text, /has no timezone/);
  assert.match(r.text, /counted in elapsed hours/);

  const bad = await c.call("perdiem_calc", { scheme: "pl", destination: "Poland", start: "4 May 2026", end: "2026-05-04T21:00", timezone: "Europe/Warsaw" });
  assert.equal(bad.isError, true);
  assert.match(bad.text, /not an ISO 8601 datetime/);

  const impossible = await c.call("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-02-30T08:00", end: "2026-03-01T08:00", timezone: "Europe/Warsaw" });
  assert.equal(impossible.isError, true, "2026-02-30 is not a real date");

  const zone = await c.call("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-05-04T08:00", end: "2026-05-04T21:00", timezone: "Middle/Earth" });
  assert.equal(zone.isError, true);
});

test("a nonexistent local time inside the spring-forward gap is moved forward, not silently kept", async (t) => {
  const { c } = open(t);
  await c.init();
  // 02:30 on 2026-03-29 does not exist in Europe/Warsaw. It resolves to 03:30, so the trip
  // is 8.5 hours, not 9.5: the allowance is the one the traveller could actually have earned.
  const r = await c.json("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-03-29T02:30", end: "2026-03-29T12:00", timezone: "Europe/Warsaw" });
  assert.equal(r.total_hours, 8.5);
  assert.equal(r.total_minor, 2250, "8 to 12 hours domestic is half a diet");
});

test("meal deductions never take a day below zero", async (t) => {
  const { c } = open(t);
  await c.init();
  // A US day where every meal was provided: 51.00 first day less 16 + 19 + 28 = 63.00 owed
  // back, which is floored at 0 rather than becoming a negative allowance.
  const r = await c.json("perdiem_calc", {
    scheme: "us", destination: "United States",
    start: "2026-05-04T07:00", end: "2026-05-05T20:00", timezone: "America/New_York",
    meals_provided_daily: ["breakfast", "lunch", "dinner"],
  });
  assert.deepEqual(r.days.map((d) => d.amount_minor), [0, 0]);
  assert.equal(r.total_minor, 0);

  // And a duplicated meal is counted once, not twice.
  const dupe = await c.json("perdiem_calc", {
    scheme: "pl", destination: "Poland", start: "2026-05-04T08:00", end: "2026-05-05T08:00", timezone: "Europe/Warsaw",
    meals_provided: [["lunch", "lunch"]],
  });
  assert.equal(dupe.days[0].meal_deduction_minor, 2250);
});

test("an ambiguous trip name is refused with the list rather than exporting the wrong one", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  await c.json("trip_record", { ...TRIP, name: "Berlin March" });
  await c.json("trip_record", { ...TRIP, name: "Berlin April" });
  const r = await c.call("trip_export", { trip: "Berlin" });
  assert.equal(r.isError, true);
  assert.match(r.text, /matches more than one trip/);
  assert.match(r.text, /Pass the exact id/);
  const missing = await c.call("trip_export", { trip: "TRIP-2026-9999" });
  assert.equal(missing.isError, true);
  assert.match(missing.text, /no trip matches/);
});

test("out-of-range arguments are refused at the schema, before any store is created", async (t) => {
  const { box, c } = open(t);
  await c.init();
  for (const bad of [
    { lodging_nights: -1 },
    { lodging_nights: 2.5 },
    { lodging_nights: 100000 },
    { scheme: "fr" },
    { meals_provided: [["brunch"]] },
  ]) {
    const r = await c.call("perdiem_calc", { scheme: "pl", destination: "Poland", start: "2026-05-04T08:00", end: "2026-05-04T21:00", timezone: "Europe/Warsaw", ...bad });
    assert.equal(r.isError, true, JSON.stringify(bad));
  }
  assert.equal(storeFiles(box.dataHome).length, 0);
});
