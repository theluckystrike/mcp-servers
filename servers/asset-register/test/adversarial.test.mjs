// Inputs that are arithmetically legal and economically nonsense, and inputs the tables
// deliberately do not cover. Every one must be refused by name with nothing written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, cleanup, proKey, ASSET } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

test("a residual at or over cost is refused, and nothing is stored", async (t) => {
  const { c } = open(t);
  await c.init();
  const over = await c.call("asset_add", { ...ASSET, residual_minor: 900000 });
  assert.equal(over.isError, true);
  assert.match(over.text, /residual 900000 is not less than cost 849900/);
  assert.match(over.text, /nothing was written/i);
  const equal = await c.call("asset_add", { ...ASSET, residual_minor: 849900 });
  assert.equal(equal.isError, true, "a residual exactly equal to cost leaves nothing to depreciate");
  assert.equal((await c.json("asset_list", {})).count, 0);
});

test("a negative or zero cost is refused, and so is a fractional one", async (t) => {
  const { c } = open(t);
  await c.init();
  const neg = await c.call("asset_add", { ...ASSET, cost_minor: -849900 });
  assert.equal(neg.isError, true);
  assert.match(neg.text, /cost must be greater than zero/);
  assert.equal((await c.call("asset_add", { ...ASSET, cost_minor: 0 })).isError, true);
  // A decimal in a minor-unit field is a caller who thought the field was major units.
  const frac = await c.call("asset_add", { ...ASSET, cost_minor: 8499.5 });
  assert.equal(frac.isError, true);
  assert.equal((await c.json("asset_list", {})).count, 0);
});

test("a negative residual and negative proceeds are refused", async (t) => {
  const { c } = open(t);
  await c.init();
  assert.equal((await c.call("asset_add", { ...ASSET, residual_minor: -100 })).isError, true);
  await c.call("asset_add", ASSET);
  const d = await c.call("asset_dispose", { asset: "ASSET-2026-0001", date: "2027-01-31", proceeds_minor: -1 });
  assert.equal(d.isError, true);
  assert.match(d.text, /zero or more/);
});

test("a disposal before the in-service date is refused by name and nothing is written", async (t) => {
  const { c } = open(t);
  await c.init();
  await c.call("asset_add", ASSET);
  const r = await c.call("asset_dispose", { asset: "ASSET-2026-0001", date: "2026-01-01", proceeds_minor: 100000 });
  assert.equal(r.isError, true);
  assert.match(r.text, /before ASSET-2026-0001 entered service on 2026-03-15/);
  assert.match(r.text, /Nothing was written/);
  const list = await c.json("asset_list", { include_disposed: true });
  assert.equal(list.assets[0].disposed, undefined, "the asset is still on the register");
  // The same day it entered service is allowed: bought and scrapped the same day happens.
  assert.equal((await c.call("asset_dispose", { asset: "ASSET-2026-0001", date: "2026-03-15" })).isError, false);
  // And it cannot be disposed of twice.
  const again = await c.call("asset_dispose", { asset: "ASSET-2026-0001", date: "2026-04-01" });
  assert.equal(again.isError, true);
  assert.match(again.text, /already disposed of on 2026-03-15/);
});

test("a useful life of zero or a negative one is refused rather than dividing the cost by nothing", async (t) => {
  const { c } = open(t);
  await c.init();
  const zero = await c.call("asset_schedule", { scheme: "pl", category: "487", cost_minor: 100000, currency: "PLN", purchase_date: "2026-01-05", life_years: 0 });
  assert.equal(zero.isError, true);
  assert.match(zero.text, /life_years must be greater than zero/);
  assert.equal((await c.call("asset_schedule", { scheme: "pl", category: "487", cost_minor: 100000, currency: "PLN", purchase_date: "2026-01-05", life_years: -3 })).isError, true);
  const rate = await c.call("asset_schedule", { scheme: "pl", category: "487", cost_minor: 100000, currency: "PLN", purchase_date: "2026-01-05", rate_pct: 0 });
  assert.equal(rate.isError, true);
  assert.equal((await c.call("asset_schedule", { scheme: "pl", category: "487", cost_minor: 100000, currency: "PLN", purchase_date: "2026-01-05", rate_pct: 150 })).isError, true);
});

test("land is in the table at 0 percent and is refused as a schedule, with the reason", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.call("asset_add", { name: "Plot", scheme: "pl", category: "0", cost_minor: 50000000, currency: "PLN", purchase_date: "2026-01-05" });
  assert.equal(r.isError, true);
  assert.match(r.text, /not depreciated/);
  assert.match(r.text, /16c/);
});

test("a category outside the bundled table is refused by name and says the table is partial, not empty", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.call("asset_schedule", { scheme: "pl", category: "goodwill", cost_minor: 100000, currency: "PLN", purchase_date: "2026-01-05" });
  assert.equal(r.isError, true);
  assert.match(r.text, /not a category in the bundled PL table/);
  assert.match(r.text, /18 and 25 percent positions/);
  // The US table is 3, 5 and 7 year only: a 10-year class is refused, not approximated.
  const us = await c.call("asset_schedule", { scheme: "us", category: "10-year", cost_minor: 100000, currency: "USD", purchase_date: "2026-01-05" });
  assert.equal(us.isError, true);
  assert.match(us.text, /NOT bundled/);
});

test("a category is matched exactly or by prefix, never as a substring", async (t) => {
  const { c } = open(t);
  await c.init();
  // "and" is a substring of "Land" and of six other row names. A substring fallback would
  // price a delivery van at the 0 percent land row and say nothing about it.
  assert.equal((await c.call("asset_schedule", { scheme: "pl", category: "and", cost_minor: 100000, currency: "PLN", purchase_date: "2026-01-05" })).isError, true);
  // An ambiguous prefix is refused too: "Computers and computer sets" is the only row
  // starting with "comput", so that one resolves.
  const good = await c.json("asset_schedule", { scheme: "pl", category: "Computers", cost_minor: 100000, currency: "PLN", purchase_date: "2026-01-05" });
  assert.equal(good.category.code, "487");
});

test("declining balance is refused where the scheme does not allow it", async (t) => {
  const { c } = open(t);
  await c.init();
  // Art. 16k excludes passenger cars from the degressive method.
  const car = await c.call("asset_schedule", { scheme: "pl", category: "741", cost_minor: 12000000, currency: "PLN", purchase_date: "2026-01-05", method: "declining-balance" });
  assert.equal(car.isError, true);
  assert.match(car.text, /may not use the declining-balance method/);
  // Buildings are group 1 and are straight line only.
  assert.equal((await c.call("asset_schedule", { scheme: "pl", category: "10", cost_minor: 100000000, currency: "PLN", purchase_date: "2026-01-05", method: "declining-balance" })).isError, true);
  // And a coefficient over the annex maximum is refused rather than clamped in silence.
  const co = await c.call("asset_schedule", { scheme: "pl", category: "742", cost_minor: 1000000, currency: "PLN", purchase_date: "2026-01-05", method: "declining-balance", declining_coefficient: 3 });
  assert.equal(co.isError, true);
  assert.match(co.text, /over the 2 the bundled PL table allows/);
});

test("an in-service date before the purchase date, and a date that is not a date, are both refused", async (t) => {
  const { c } = open(t);
  await c.init();
  const early = await c.call("asset_add", { ...ASSET, purchase_date: "2026-03-12", in_service_date: "2026-01-01" });
  assert.equal(early.isError, true);
  assert.match(early.text, /is before purchase_date/);
  for (const bad of ["12/03/2026", "2026-03", "2026-02-30", "yesterday", "2026-13-01"]) {
    const r = await c.call("asset_add", { ...ASSET, purchase_date: bad });
    assert.equal(r.isError, true, `"${bad}" was accepted as a date`);
  }
  assert.equal((await c.json("asset_list", {})).count, 0);
});

test("an asset reference that matches more than one asset is refused with the list, not resolved to the first", async (t) => {
  const { c } = open(t);
  await c.init();
  await c.call("asset_add", { ...ASSET, name: "Laptop A" });
  await c.call("asset_add", { ...ASSET, name: "Laptop B" });
  const r = await c.call("asset_schedule", { asset: "Laptop" });
  assert.equal(r.isError, true);
  assert.match(r.text, /matches more than one asset/);
  assert.match(r.text, /ASSET-2026-0001/);
  assert.match(r.text, /ASSET-2026-0002/);
});

test("a journal for a month with nothing to charge returns no lines rather than a zero line", async (t) => {
  const { c } = open(t, { key: proKey("asset-register") });
  await c.init();
  await c.call("asset_add", ASSET);
  const before = await c.json("asset_journal", { month: "2020-01" });
  assert.deepEqual(before.lines, []);
  assert.deepEqual(before.payloads, []);
  const after = await c.json("asset_journal", { month: "2099-01" });
  assert.deepEqual(after.lines, []);
  const bad = await c.call("asset_journal", { month: "not-a-month" });
  assert.equal(bad.isError, true);
});

test("two currencies are never added together in a list, a journal or a report", async (t) => {
  const { c } = open(t, { key: proKey("asset-register") });
  await c.init();
  await c.call("asset_add", { name: "PL laptop", scheme: "pl", category: "487", cost_minor: 849900, currency: "PLN", purchase_date: "2026-01-05" });
  await c.call("asset_add", { name: "US laptop", scheme: "us", category: "5-year", cost_minor: 200000, currency: "USD", purchase_date: "2026-01-05", method: "declining-balance" });
  const list = await c.json("asset_list", { as_of: "2026-12" });
  assert.equal(list.totals_by_currency.length, 2);
  const j = await c.json("asset_journal", { month: "2026-06" });
  assert.equal(j.totals_by_currency.length, 2);
  assert.equal(j.payloads.length, 2, "one expense_add payload per currency, never one summed payload");
  const r = await c.json("asset_report", { year: 2026 });
  assert.equal(r.nbv_by_currency.length, 2);
});

test("no tool throws across the transport: every refusal is an isError answer, not a protocol error", async (t) => {
  const { c } = open(t);
  await c.init();
  const calls = [
    ["asset_add", { ...ASSET, cost_minor: -1 }],
    ["asset_schedule", { asset: "nothing here" }],
    ["asset_dispose", { asset: "nothing here", date: "2026-01-01" }],
    ["asset_list", { as_of: "nonsense" }],
    ["asset_journal", { month: "2026-01" }],
    ["asset_report", {}],
  ];
  for (const [tool, args] of calls) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} answered`);
    assert.match(r.text, /^Error: /, `${tool} did not answer as a tool error: ${r.text.slice(0, 120)}`);
  }
});
