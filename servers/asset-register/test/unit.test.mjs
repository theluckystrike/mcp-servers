// Worked examples, one per method and one per bundled table, checked against the
// published figures rather than against whatever the code happens to produce.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, cleanup, proKey, seedProfile, ASSET } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

const sum = (rows) => rows.reduce((a, r) => a + r.amount_minor, 0);

test("PL straight-line, KST 487 at 30 percent: the month-following rule prorates year one and the periods sum to cost", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("asset_schedule", {
    scheme: "pl", category: "487", cost_minor: 849900, currency: "PLN",
    purchase_date: "2026-03-12", in_service_date: "2026-03-15", method: "straight-line",
  });
  assert.equal(r.rate_pct, 30);
  assert.equal(r.convention, "pl-month-following");
  // Entered the register in March, so the first charge is April: nine months of the first year.
  assert.equal(r.first_charge_month, "2026-04");
  assert.deepEqual(r.periods.map((p) => p.amount_minor), [191228, 254970, 254970, 148732]);
  // 849900 * 0.30 = 254970 a full year; 9/12 of that is 191227.50, and the half cent goes
  // into the first period by the cumulative rule, not into the last.
  assert.equal(sum(r.periods), 849900);
  assert.equal(r.depreciable_base_minor, 849900);
  assert.match(r.check, /sum to the depreciable base exactly/);
  assert.match(r.life_source, /100 divided by the annex rate of 30 percent/);
  assert.equal(r.source.authority, "Sejm Rzeczypospolitej Polskiej");
});

test("PL declining-balance, KST 742 at 20 percent times 2: it switches to straight line the year the declining amount falls below it", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("asset_schedule", {
    scheme: "pl", category: "742", cost_minor: 1000000, currency: "PLN",
    purchase_date: "2025-12-20", in_service_date: "2025-12-20", method: "declining-balance",
  });
  assert.equal(r.declining_coefficient, 2);
  assert.equal(r.first_charge_month, "2026-01");
  // 40 percent of 1,000,000 then of 600,000; the third year's declining amount would be
  // 144,000, below the 200,000 straight-line amount, so art. 16k switches for the rest.
  assert.deepEqual(r.periods.map((p) => p.amount_minor), [400000, 240000, 200000, 160000]);
  assert.match(r.periods[2].basis, /art\. 16k/);
  assert.match(r.periods[0].basis, /20 percent times 2/);
  assert.equal(sum(r.periods), 1000000);
});

test("US MACRS 5-year half-year: the schedule is the published Table A-1 row to the cent", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("asset_schedule", {
    scheme: "us", category: "5-year", cost_minor: 1000000, currency: "USD",
    purchase_date: "2026-01-05", method: "declining-balance",
  });
  assert.deepEqual(r.periods.map((p) => p.amount_minor), [200000, 320000, 192000, 115200, 115200, 57600]);
  assert.equal(sum(r.periods), 1000000);
  assert.equal(r.convention, "us-half-year");
  assert.match(r.periods[0].basis, /Table A-1/);
  assert.equal(r.periods.length, 6, "the half-year convention runs one year past the 5-year class");
});

test("US MACRS 3-year and 7-year rows are the published percentages and both sum to cost", async (t) => {
  const { c } = open(t);
  await c.init();
  const three = await c.json("asset_schedule", { scheme: "us", category: "3-year", cost_minor: 300000, currency: "USD", purchase_date: "2026-02-01", method: "declining-balance" });
  assert.deepEqual(three.periods.map((p) => p.amount_minor), [99990, 133350, 44430, 22230]);
  assert.equal(sum(three.periods), 300000);
  const seven = await c.json("asset_schedule", { scheme: "us", category: "7-year", cost_minor: 1000000, currency: "USD", purchase_date: "2026-02-01", method: "declining-balance" });
  assert.deepEqual(seven.periods.map((p) => p.amount_minor), [142900, 244900, 174900, 124900, 89300, 89200, 89300, 44600]);
  assert.equal(sum(seven.periods), 1000000);
  assert.equal(seven.periods.length, 8);
});

test("UK main pool at 18 percent reducing balance: the pool never closes, so the schedule says how it was closed", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("asset_schedule", {
    scheme: "uk", category: "main", cost_minor: 1000000, currency: "GBP",
    purchase_date: "2026-04-06", method: "declining-balance",
  });
  assert.deepEqual(r.periods.slice(0, 3).map((p) => p.amount_minor), [180000, 147600, 121032]);
  assert.equal(r.periods.length, 25);
  assert.equal(sum(r.periods), 1000000);
  assert.match(r.periods[24].basis, /final period/);
  assert.match(r.life_source, /no statutory useful life/);
  assert.match(r.notes.join(" "), /pool/);
  const special = await c.json("asset_schedule", { scheme: "uk", category: "special", cost_minor: 1000000, currency: "GBP", purchase_date: "2026-04-06", method: "declining-balance" });
  assert.equal(special.periods[0].amount_minor, 60000, "the special rate pool is 6 percent");
  const aia = await c.json("asset_schedule", { scheme: "uk", category: "aia", cost_minor: 1000000, currency: "GBP", purchase_date: "2026-04-06", method: "straight-line" });
  assert.deepEqual(aia.periods.map((p) => p.amount_minor), [1000000], "AIA is a 100 percent first-year deduction");
});

test("a residual is deducted and the schedule sums to cost minus residual, not to cost", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("asset_schedule", {
    scheme: "pl", category: "741", cost_minor: 12000000, currency: "PLN", residual_minor: 2000000,
    purchase_date: "2026-01-10", method: "straight-line",
  });
  assert.equal(r.depreciable_base_minor, 10000000);
  assert.equal(sum(r.periods), 10000000);
  assert.equal(r.periods.at(-1).closing_minor, 2000000, "the last period closes at the residual, not at zero");
});

test("a cost that does not divide evenly still sums to the base exactly: the rounding goes somewhere and is visible", async (t) => {
  const { c } = open(t);
  await c.init();
  // 1000001 minor over 7 periods at 14 percent is 142857.28... a period. Every naive
  // per-period rounding leaves a residue here; the cumulative rule cannot.
  const r = await c.json("asset_schedule", {
    scheme: "pl", category: "5", cost_minor: 1000001, currency: "PLN", residual_minor: 1,
    purchase_date: "2026-01-10", method: "straight-line",
  });
  assert.equal(r.depreciable_base_minor, 1000000);
  assert.equal(sum(r.periods), 1000000);
  assert.ok(new Set(r.periods.map((p) => p.amount_minor)).size > 1, "at least one period differs, which is where the remainder went");
});

test("the monthly view sums to the yearly one and to the base", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("asset_schedule", {
    scheme: "pl", category: "487", cost_minor: 849900, currency: "PLN",
    purchase_date: "2026-03-12", in_service_date: "2026-03-15", granularity: "month",
  });
  assert.equal(r.months.length, 9 + 12 + 12 + 12);
  assert.equal(r.months[0].month, "2026-04");
  assert.equal(sum(r.months), 849900);
  for (const p of r.periods) {
    assert.equal(sum(r.months.filter((m) => m.period === p.index)), p.amount_minor, `period ${p.index} months`);
  }
});

test("asset_add stores the asset, derives the life from the table and reports the convention", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("asset_add", { ...ASSET, project: "Studio" });
  assert.equal(r.added.id, "ASSET-2026-0001");
  assert.equal(r.added.category, "487");
  assert.equal(r.rate_pct, 30);
  assert.equal(r.useful_life_years, 3.3333);
  assert.equal(r.first_charge_month, "2026-04");
  assert.equal(r.convention, "pl-month-following");
  const list = await c.json("asset_list", { as_of: "2026-12" });
  assert.equal(list.count, 1);
  assert.equal(list.assets[0].accumulated_minor, 191228);
  assert.equal(list.assets[0].nbv_minor, 849900 - 191228);
  const sched = await c.json("asset_schedule", { asset: "ASSET-2026-0001" });
  assert.equal(sum(sched.periods), 849900);
});

test("a life override replaces the table life and says so; a rate override replaces the rate", async (t) => {
  const { c } = open(t);
  await c.init();
  const life = await c.json("asset_schedule", { scheme: "pl", category: "487", cost_minor: 1200000, currency: "PLN", purchase_date: "2026-01-05", method: "straight-line", life_years: 4 });
  assert.equal(life.rate_pct, 25);
  assert.equal(life.useful_life_years, 4);
  assert.match(life.life_source, /passed on the call and overrides the table/);
  // Entered the register in January, so the first charge is February: 11 of 12 months in
  // year one, and the missing month falls out at the far end of the schedule.
  assert.deepEqual(life.periods.map((p) => p.amount_minor), [275000, 300000, 300000, 300000, 25000]);
  const rate = await c.json("asset_schedule", { scheme: "pl", category: "487", cost_minor: 1200000, currency: "PLN", purchase_date: "2026-01-05", method: "straight-line", rate_pct: 10 });
  assert.equal(rate.rate_pct, 10);
  assert.equal(rate.periods.length, 11);
});

test("MACRS ignores a residual and says it ignored it, rather than applying it in silence", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("asset_schedule", {
    scheme: "us", category: "5-year", cost_minor: 1000000, residual_minor: 100000, currency: "USD",
    purchase_date: "2026-01-05", method: "declining-balance",
  });
  assert.equal(r.residual_applied_minor, 0);
  assert.equal(sum(r.periods), 1000000);
  assert.match(r.notes.join(" "), /MACRS ignores salvage value/);
});

test("asset_dispose computes the result against net book value at the disposal month", async (t) => {
  const { c } = open(t);
  await c.init();
  await c.call("asset_add", ASSET);
  const d = await c.json("asset_dispose", { asset: "MacBook Pro", date: "2027-06-30", proceeds_minor: 500000 });
  // April to December 2026 is 191,228; January to June 2027 is six months of 254,970.
  const monthly = await c.json("asset_schedule", { asset: "ASSET-2026-0001", granularity: "month" });
  const expected = sum(monthly.months.filter((m) => m.month <= "2027-06"));
  assert.equal(d.accumulated_minor, expected);
  assert.equal(d.nbv_minor, 849900 - expected);
  assert.equal(d.result_minor, 500000 - (849900 - expected));
  assert.equal(d.result, d.result_minor > 0 ? "gain" : "loss");
  const jr = d.journal.reduce((a, l) => a + (l.debit_minor ?? 0) - (l.credit_minor ?? 0), 0);
  assert.equal(jr, 0, "the disposal journal balances");
  const open2 = await c.json("asset_list", {});
  assert.equal(open2.count, 0, "a disposed asset is off the open register by default");
});

test("asset_journal is Pro, balances, stops at disposal and hands back an expense_add payload", async (t) => {
  const { c: free } = open(t);
  await free.init();
  assert.equal((await free.call("asset_journal", { month: "2026-05" })).isError, true);

  const { c } = open(t, { key: proKey("asset-register") });
  await c.init();
  await c.call("asset_add", ASSET);
  const j = await c.json("asset_journal", { month: "2026-05" });
  assert.equal(j.lines.length, 1);
  assert.equal(j.lines[0].debit_account, "Depreciation expense");
  assert.equal(j.lines[0].credit_account, "Accumulated depreciation");
  assert.equal(j.lines[0].debit_minor, j.lines[0].credit_minor);
  assert.equal(j.balanced, true);
  assert.equal(j.totals_by_currency[0].debit_minor, j.lines[0].debit_minor);
  assert.equal(j.payloads[0].tool, "expense_add");
  assert.equal(j.payloads[0].server, "expense-tracker");
  assert.equal(j.payloads[0].arguments.currency, "PLN");
  assert.equal(j.payloads[0].arguments.date, "2026-05-31");
  assert.equal(j.payloads[0].arguments.amount, j.lines[0].debit_minor / 100);
  assert.equal(j.payloads[0].arguments.vat_rate, undefined, "depreciation is not a VAT-bearing purchase");
  assert.equal(j.payloads[0].arguments.billable, false);
  // Nothing before the first charge month, and nothing after disposal.
  assert.equal((await c.json("asset_journal", { month: "2026-03" })).lines.length, 0);
  await c.call("asset_dispose", { asset: "ASSET-2026-0001", date: "2026-08-10" });
  assert.equal((await c.json("asset_journal", { month: "2026-08" })).lines.length, 1, "the month of disposal is still charged");
  assert.equal((await c.json("asset_journal", { month: "2026-09" })).lines.length, 0, "and the month after is not");
});

test("asset_report is Pro, totals net book value per category and currency, and lists the year's disposals", async (t) => {
  const { c: free } = open(t);
  await free.init();
  const refusal = await free.call("asset_report", {});
  assert.equal(refusal.isError, true);
  assert.match(refusal.text, /Pro/);
  assert.match(refusal.text, /license_activate/);

  const { c } = open(t, { key: proKey("asset-register") });
  await c.init();
  await c.call("asset_add", ASSET);
  await c.call("asset_add", { name: "Server rack", scheme: "pl", category: "487", cost_minor: 2000000, currency: "PLN", purchase_date: "2026-01-05" });
  await c.call("asset_add", { name: "Ford Transit", scheme: "us", category: "5-year", cost_minor: 3000000, currency: "USD", purchase_date: "2026-01-05", method: "declining-balance" });
  await c.call("asset_dispose", { asset: "Server rack", date: "2026-11-30", proceeds_minor: 1900000 });

  const r = await c.json("asset_report", { year: 2026, as_of: "2026-12" });
  assert.deepEqual(r.nbv_by_currency.map((x) => x.currency).sort(), ["PLN", "USD"]);
  const pln = r.nbv_by_currency.find((x) => x.currency === "PLN");
  assert.equal(pln.cost_minor, 849900, "the disposed rack is out of the net book value table");
  assert.equal(r.disposals.length, 1);
  assert.equal(r.disposals[0].asset, "ASSET-2026-0002");
  assert.equal(r.disposals[0].result_minor, 1900000 - r.disposals[0].nbv_minor);
  assert.match(r.note, /Currencies are never added together/);
  const cats = r.by_category.map((x) => `${x.currency}:${x.category}`);
  assert.deepEqual(cats.sort(), ["PLN:487", "USD:5-year"]);
});

test("the scheme is derived from the shared business profile currency and reported as a derivation", async (t) => {
  const box = sandbox();
  seedProfile(box.dataHome, { name: "Nova Studio", default_currency: "PLN", default_tax_rate: 23 });
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const r = await c.json("asset_add", { name: "Desk", category: "808", cost_minor: 150000, purchase_date: "2026-02-01" });
  assert.equal(r.added.scheme, "pl");
  assert.equal(r.added.currency, "PLN");
  assert.equal(r.rate_pct, 20);
  assert.match(r.notes.join(" "), /derivation, not a stored fact/);
});

test("the free tier holds ten assets, schedules stay free, and the refusal names the cap", async (t) => {
  const { c } = open(t);
  await c.init();
  for (let i = 0; i < 10; i++) {
    assert.equal((await c.call("asset_add", { ...ASSET, name: `A${i}` })).isError, false, `asset ${i}`);
  }
  const over = await c.call("asset_add", { ...ASSET, name: "A10" });
  assert.equal(over.isError, true);
  assert.match(over.text, /holds 10 assets/);
  assert.match(over.text, /Nothing was stored/);
  assert.equal((await c.call("asset_schedule", { asset: "A0" })).isError, false);
  assert.equal((await c.json("asset_list", {})).count, 10);
});

test("200 assets: the register scales, ids stay unique, and list/report totals still add up to the cent", async (t) => {
  const { c } = open(t, { key: proKey("asset-register") });
  await c.init();
  const n = 200;
  for (let i = 0; i < 150; i++) {
    assert.equal((await c.call("asset_add", { ...ASSET, name: `PL-${i}`, purchase_date: "2026-01-05" })).isError, false, `pl asset ${i}`);
  }
  for (let i = 0; i < 50; i++) {
    const r = await c.call("asset_add", {
      name: `US-${i}`, scheme: "us", category: "5-year", cost_minor: 100000, currency: "USD",
      purchase_date: "2026-01-05", method: "declining-balance",
    });
    assert.equal(r.isError, false, `us asset ${i}`);
  }

  const list = await c.json("asset_list", { limit: 2000 });
  assert.equal(list.count, n);
  assert.equal(list.returned, n);
  assert.equal(new Set(list.assets.map((a) => a.id)).size, n, "an id was reused across the 200 assets");

  const pln = list.totals_by_currency.find((t) => t.currency === "PLN");
  const usd = list.totals_by_currency.find((t) => t.currency === "USD");
  assert.equal(pln.cost_minor, 150 * ASSET.cost_minor);
  assert.equal(usd.cost_minor, 50 * 100000);
  // Currencies are never added together: each total is exactly its own group's cost, no cross-contamination.
  assert.equal(pln.accumulated_minor + pln.nbv_minor, pln.cost_minor);
  assert.equal(usd.accumulated_minor + usd.nbv_minor, usd.cost_minor);

  const report = await c.json("asset_report", { year: 2026, as_of: "2026-12" });
  assert.equal(report.assets, n);
  const totalCount = report.by_category.reduce((a, r) => a + r.count, 0);
  assert.equal(totalCount, n);
  const plRow = report.by_category.find((r) => r.scheme === "pl");
  const usRow = report.by_category.find((r) => r.scheme === "us");
  assert.equal(plRow.count, 150);
  assert.equal(usRow.count, 50);
  assert.equal(plRow.nbv_minor + plRow.accumulated_minor, plRow.cost_minor);
  assert.equal(usRow.nbv_minor + usRow.accumulated_minor, usRow.cost_minor);
});
