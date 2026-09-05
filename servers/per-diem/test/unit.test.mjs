// One worked example per scheme, with the exact expected numbers, plus the tier switch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, cleanup, proKey, seedProfile, TRIP } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

test("PL domestic worked example: two and a half days to Krakow, one free breakfast", async (t) => {
  const { c } = open(t);
  await c.init();
  // 2026-05-04 08:00 -> 2026-05-06 18:00 Europe/Warsaw = 58 hours = two 24-hour periods
  // plus a 10-hour remainder. Diet 45.00 PLN.
  //   day 1: full 45.00, less breakfast at 25 percent (11.25) = 33.75
  //   day 2: full 45.00
  //   day 3: 10-hour remainder, over 8 hours, so a whole diet = 45.00
  // total 123.75 PLN, and the ryczalt for 2 nights is 2 x 67.50 = 135.00 on top.
  const r = await c.json("perdiem_calc", {
    scheme: "pl", destination: "Poland",
    start: "2026-05-04T08:00", end: "2026-05-06T18:00", timezone: "Europe/Warsaw",
    meals_provided: [["breakfast"], [], []], lodging_nights: 2,
  });
  assert.equal(r.currency, "PLN");
  assert.equal(r.part, "domestic");
  assert.equal(r.total_hours, 58);
  assert.deepEqual(r.days.map((d) => d.gross_minor), [4500, 4500, 4500]);
  assert.deepEqual(r.days.map((d) => d.meal_deduction_minor), [1125, 0, 0]);
  assert.deepEqual(r.days.map((d) => d.amount_minor), [3375, 4500, 4500]);
  assert.equal(r.subsistence_minor, 12375);
  assert.equal(r.subsistence, "PLN 123.75");
  assert.equal(r.lodging_minor, 13500);
  assert.equal(r.total_minor, 25875);
  assert.equal(r.total, "PLN 258.75");
  assert.match(r.source.instrument, /Dz\.U\. 2022 poz\. 2302/);
});

test("PL foreign worked example: 29 hours in Germany is one whole diet plus a third", async (t) => {
  const { c } = open(t);
  await c.init();
  // 2026-05-04 08:00 -> 2026-05-05 13:00 = 29 hours. Germany 55.00 EUR.
  //   day 1: full 55.00
  //   day 2: 5-hour remainder, up to 8 hours, one third of 55.00 = 18.33 (rounded from 18.3333)
  // total 73.33 EUR. No foreign lodging is bundled, so 2 nights add nothing and say so.
  const r = await c.json("perdiem_calc", {
    scheme: "pl", destination: "Germany",
    start: "2026-05-04T08:00", end: "2026-05-05T13:00", timezone: "Europe/Warsaw", lodging_nights: 2,
  });
  assert.equal(r.part, "foreign");
  assert.equal(r.currency, "EUR");
  assert.deepEqual(r.days.map((d) => d.amount_minor), [5500, 1833]);
  assert.equal(r.subsistence_minor, 7333);
  assert.equal(r.lodging_minor, 0);
  assert.equal(r.total, "EUR 73.33");
  assert.ok(r.notes.some((n) => /no lodging limit/.test(n)), r.notes.join(" "));
});

test("PL foreign meal deductions are 15/30/30 of the day, not the domestic 25/50/25", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("perdiem_calc", {
    scheme: "pl", destination: "Germany",
    start: "2026-05-04T08:00", end: "2026-05-05T08:00", timezone: "Europe/Warsaw",
    meals_provided: [["breakfast", "lunch", "dinner"]],
  });
  // 55.00 less 15 + 30 + 30 percent = less 8.25 + 16.50 + 16.50 = 13.75 EUR left.
  assert.equal(r.days[0].meal_deduction_minor, 4125);
  assert.equal(r.total_minor, 1375);
});

test("UK domestic worked example: the three benchmark bands and the meal pro rata", async (t) => {
  const { c } = open(t);
  await c.init();
  const short = await c.json("perdiem_calc", { scheme: "uk", destination: "United Kingdom", start: "2026-05-04T09:00", end: "2026-05-04T13:00", timezone: "Europe/London" });
  assert.equal(short.total_minor, 0, "4 hours is under the 5-hour minimum");
  assert.match(short.days[0].basis, /under 5 hours/);

  const five = await c.json("perdiem_calc", { scheme: "uk", destination: "United Kingdom", start: "2026-05-04T09:00", end: "2026-05-04T15:00", timezone: "Europe/London" });
  assert.equal(five.total, "GBP 5.00");

  const ten = await c.json("perdiem_calc", { scheme: "uk", destination: "United Kingdom", start: "2026-05-04T07:00", end: "2026-05-04T20:00", timezone: "Europe/London" });
  assert.equal(ten.total, "GBP 10.00");
  assert.match(ten.days[0].basis, /10 hours or more/);

  // 16 hours: the 25.00 band, three meals covered. One free lunch removes a third: 16.67.
  const long = await c.json("perdiem_calc", {
    scheme: "uk", destination: "United Kingdom",
    start: "2026-05-04T06:00", end: "2026-05-04T22:00", timezone: "Europe/London",
    meals_provided: [["lunch"]],
  });
  assert.equal(long.days[0].gross_minor, 2500);
  assert.equal(long.days[0].meal_deduction_minor, 833);
  assert.equal(long.total, "GBP 16.67");

  // The late-evening supplement is opt-in and only rides on the 5 or 10 hour band.
  const late = await c.json("perdiem_calc", { scheme: "uk", destination: "United Kingdom", start: "2026-05-04T07:00", end: "2026-05-04T20:30", timezone: "Europe/London", late_evening: [true] });
  assert.equal(late.total, "GBP 20.00");
});

test("US GSA worked example: FY2026 standard CONUS over three calendar days", async (t) => {
  const { c } = open(t);
  await c.init();
  // 2026-05-04 07:00 -> 2026-05-06 20:00 America/New_York = three calendar days.
  //   first day 75 percent of M&IE = 51.00, middle day 68.00, last day 51.00 = 170.00
  //   lodging 2 nights at the 115.00 cap = 230.00
  const r = await c.json("perdiem_calc", {
    scheme: "us", destination: "United States",
    start: "2026-05-04T07:00", end: "2026-05-06T20:00", timezone: "America/New_York", lodging_nights: 2,
  });
  assert.equal(r.currency, "USD");
  assert.equal(r.part, "conus-standard FY2026");
  assert.equal(r.days.length, 3);
  assert.deepEqual(r.days.map((d) => d.gross_minor), [5100, 6800, 5100]);
  assert.equal(r.subsistence, "USD 170.00");
  assert.equal(r.lodging, "USD 230.00");
  assert.equal(r.total, "USD 400.00");
  assert.ok(r.notes.some((n) => /CAP, not an allowance/.test(n)));

  // A provided meal is deducted at its own published amount, not as a percentage.
  const fed = await c.json("perdiem_calc", {
    scheme: "us", destination: "United States",
    start: "2026-05-04T07:00", end: "2026-05-06T20:00", timezone: "America/New_York",
    meals_provided: [[], ["breakfast", "dinner"], []],
  });
  assert.equal(fed.days[1].meal_deduction_minor, 4400);
  assert.equal(fed.days[1].amount_minor, 2400);
  assert.equal(fed.subsistence, "USD 126.00");

  // An earlier fiscal year is addressable and its lodging cap differs.
  const fy25 = await c.json("perdiem_calc", { scheme: "us", destination: "United States", start: "2026-05-04T07:00", end: "2026-05-04T20:00", timezone: "America/New_York", lodging_nights: 1, fiscal_year: "FY2025" });
  assert.equal(fy25.lodging, "USD 110.00");
});

test("JPY carries no decimal point anywhere in the answer", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("perdiem_calc", { scheme: "pl", destination: "Japan", start: "2026-05-04T08:00", end: "2026-05-05T08:00", timezone: "Asia/Tokyo" });
  assert.equal(r.currency, "JPY");
  assert.equal(r.decimals, 0);
  assert.equal(r.total, "JPY 7,532");
});

test("perdiem_rates carries the provenance and names what it left out", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("perdiem_rates", { scheme: "pl", country: "Germany" });
  const foreign = r.tables.find((x) => x.table === "pl-foreign");
  assert.equal(foreign.count, 1);
  assert.equal(foreign.rates[0].diet, "EUR 55.00");
  assert.match(foreign.header.source_url, /^https:\/\/isap\.sejm\.gov\.pl\//);
  assert.equal(foreign.header.effective_date, "2022-11-29");
  assert.match(foreign.header.coverage, /omitted rather than guessed/);

  const all = await c.json("perdiem_rates", { scheme: "pl" });
  assert.ok(all.tables.find((x) => x.table === "pl-foreign").count >= 30, "the Polish foreign table must carry at least 30 countries");

  const uk = await c.json("perdiem_rates", { scheme: "uk" });
  const overseas = uk.tables.find((x) => x.table === "uk-overseas");
  assert.equal(overseas.count, 0);
  assert.equal(overseas.header.bundled, false);
  assert.ok(uk.notes.some((n) => /uk-overseas/.test(n) && /NOT BUNDLED/.test(n)), JSON.stringify(uk.notes));
});

test("trip_record takes the traveller from the shared profile, and trip_list totals per currency", async (t) => {
  const box = sandbox();
  seedProfile(box.dataHome, { name: "Nova Studio", default_currency: "PLN", timezone: "Europe/Warsaw" });
  const c = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const rec = await c.json("trip_record", { ...TRIP, project: "Acme" });
  assert.equal(rec.recorded.id, "TRIP-2026-0001");
  assert.equal(rec.recorded.traveller, "Nova Studio");
  assert.equal(rec.recorded.total, "PLN 45.00");
  await c.json("trip_record", { ...TRIP, name: "Berlin workshop", destination: "Germany" });
  const list = await c.json("trip_list", {});
  assert.equal(list.count, 2);
  assert.deepEqual(list.totals.map((x) => `${x.currency} ${x.total_minor}`), ["EUR 5500", "PLN 4500"]);

  const rates = await c.json("perdiem_rates", {});
  assert.match(rates.home, /derived from the shared profile's default_currency PLN/);
});

test("trip_export returns expense_add arguments per currency and writes nothing itself", async (t) => {
  const box = sandbox();
  seedProfile(box.dataHome, { name: "Nova Studio", default_currency: "PLN" });
  const c = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  await c.json("trip_record", {
    name: "Krakow", scheme: "pl", destination: "Poland",
    start: "2026-05-04T08:00", end: "2026-05-06T18:00", timezone: "Europe/Warsaw",
    lodging_nights: 2, project: "Acme", meals_provided: [["breakfast"], [], []],
  });
  const ex = await c.json("trip_export", { trip: "Krakow", mark_exported: true });
  assert.equal(ex.payloads.length, 2);
  assert.equal(ex.payloads[0].tool, "expense_add");
  assert.equal(ex.payloads[0].server, "expense-tracker");
  assert.equal(ex.payloads[0].arguments.amount, 123.75);
  assert.equal(ex.payloads[0].arguments.currency, "PLN");
  assert.equal(ex.payloads[0].arguments.billable, true);
  assert.equal(ex.payloads[1].arguments.amount, 135);
  assert.equal(ex.payloads[1].arguments.category, "travel/lodging");
  assert.equal(ex.payloads[0].arguments.vat_rate, undefined);
  assert.match(ex.why_not_written, /publishes no library entry point/);
  const back = await c.json("trip_list", {});
  assert.ok(back.trips[0].exported_at, "mark_exported stamps the trip");
});

test("free tier: five trips a month, then a refusal that leaves the calculator working", async (t) => {
  const { c } = open(t);
  await c.init();
  for (let i = 1; i <= 5; i++) {
    const r = await c.json("trip_record", { ...TRIP, name: `trip ${i}` });
    assert.equal(r.recorded.id, `TRIP-2026-000${i}`);
  }
  const sixth = await c.call("trip_record", { ...TRIP, name: "trip 6" });
  assert.equal(sixth.isError, true);
  assert.match(sixth.text, /records 5 trips a month and 2026-05 already has 5/);
  assert.match(sixth.text, /https:\/\/mcp\.zovo\.one\/buy\/per-diem/);
  assert.equal((await c.json("trip_list", {})).count, 5, "the refusal wrote nothing");

  // A different month is not blocked, and the free tools still answer.
  const june = await c.json("trip_record", { ...TRIP, name: "june", start: "2026-06-01T08:00", end: "2026-06-01T21:00" });
  assert.equal(june.recorded.id, "TRIP-2026-0006");
  assert.equal((await c.json("perdiem_calc", { ...TRIP })).total, "PLN 45.00");
  assert.equal((await c.json("perdiem_rates", { scheme: "us" })).tables.length, 1);

  // The Pro tools refuse by name and write nothing.
  for (const tool of ["trip_export", "perdiem_report"]) {
    const r = await c.call(tool, tool === "trip_export" ? { trip: "trip 1" } : {});
    assert.equal(r.isError, true, tool);
    assert.match(r.text, /https:\/\/mcp\.zovo\.one\/buy\/per-diem/, tool);
  }
});

test("perdiem_report totals per scheme and month and never adds two currencies", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  await c.json("trip_record", { ...TRIP, name: "a" });
  await c.json("trip_record", { ...TRIP, name: "b", destination: "Germany" });
  await c.json("trip_record", { ...TRIP, name: "c", start: "2026-06-02T08:00", end: "2026-06-02T21:00" });
  const rep = await c.json("perdiem_report", {});
  assert.equal(rep.trips, 3);
  assert.deepEqual(rep.by_scheme_and_month.map((r) => `${r.scheme} ${r.month} ${r.currency} ${r.total_minor}`), [
    "pl 2026-05 EUR 5500", "pl 2026-05 PLN 4500", "pl 2026-06 PLN 4500",
  ]);
  assert.deepEqual(rep.by_scheme[0].totals, [
    { currency: "EUR", total: "EUR 55.00", total_minor: 5500 },
    { currency: "PLN", total: "PLN 90.00", total_minor: 9000 },
  ]);
  assert.match(rep.basis, /Currencies are never added together/);
});
