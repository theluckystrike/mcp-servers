// The worked catalogue, recomputed by hand and asserted to the minor unit.
//
// Two assertions carry the suite. The first is the valid_from ladder: one SKU with three
// rows, asked for on three dates, picks three different rows and says which. The second is
// the worked resolution: the invoice payload's totals are recomputed from the payload's
// OWN items with servers/invoice's computeTotals, so the figures this server reports are
// the figures invoice_create will produce, not a second implementation that agrees today.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeTotals } from "@theluckystrike/mcp-invoice/lib";
import {
  client, sandbox, cleanup, proKey, storeDir, writeProfile, seed,
  LINES, RESOLVE_DATE, NET_MINOR, VAT_MINOR, GROSS_MINOR, LINE_GROSS,
} from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

test("a SKU takes the profile currency, and the price row it was given", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("sku_set", { sku: "web-audit", name: "Website audit", unit: "each", price_minor: 45000, valid_from: "2026-01-01", vat_rate: 23 });
  assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 300));
  assert.equal(r.created.sku, "WEB-AUDIT", "a code is filed upper case, whatever it was typed as");
  assert.equal(r.created.unit, "each");
  assert.equal(r.created.vat_rate, 23);
  assert.deepEqual(r.created.price_rows, [
    { currency: "EUR", tier: "standard", valid_from: "2026-01-01", price: "EUR 450.00", price_minor: 45000 },
  ]);
});

test("THE LADDER: three rows, three dates, three different rows, each one named", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  for (const [date, minor, from] of [
    ["2025-06-30", 39000, "2025-01-01"],
    ["2026-03-15", 45000, "2026-01-01"],
    ["2026-09-01", 49500, "2026-07-01"],
  ]) {
    const r = await c.json("sku_get", { sku: "WEB-AUDIT", date });
    assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 300));
    assert.equal(r.price_minor, minor, `on ${date}`);
    assert.equal(r.from_row.valid_from, from, `on ${date} the row picked must be the one starting ${from}`);
    assert.match(r.why, new RegExp(`latest valid_from at or before ${date} is ${from}`));
  }
  // The row in force in March is already replaced from July, and the answer says so.
  const march = await c.json("sku_get", { sku: "WEB-AUDIT", date: "2026-03-15" });
  assert.deepEqual(march.superseded_by, { valid_from: "2026-07-01", price: "EUR 495.00", price_minor: 49500 });
  const september = await c.json("sku_get", { sku: "WEB-AUDIT", date: "2026-09-01" });
  assert.equal(september.superseded_by, null);
});

test("THE RESOLUTION: the invoice payload's totals equal computeTotals over its own items", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.json("lines_resolve", { lines: LINES, client: "Harbour Cafe", date: RESOLVE_DATE });
  assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 400));
  assert.equal(r.currency, "EUR");
  assert.equal(r.tier, "standard");
  assert.equal(r.invoice_create.tool, "invoice_create");
  assert.equal(r.invoice_create.server, "invoice");
  assert.equal(r.quote_create.tool, "quote_create");
  assert.equal(r.quote_create.server, "quotes");
  assert.equal(r.invoice_create.arguments.client, "Harbour Cafe");
  assert.equal(r.posted, false);

  // The WEB-AUDIT line is priced off the 2026-01-01 row because the date is 2026-03-15.
  assert.deepEqual(r.lines[0].priced_from, { currency: "EUR", tier: "standard", valid_from: "2026-01-01" });
  assert.equal(r.lines[0].unit_price_minor, 45000);
  assert.deepEqual(r.lines.map((l) => l.value_minor), LINE_GROSS);

  // THE assertion: run the payload through the invoice server's own engine.
  const recomputed = computeTotals(r.invoice_create.arguments.items, "EUR", 0, 0);
  assert.deepEqual(recomputed.lines.map((l) => l.gross_minor), LINE_GROSS);
  assert.equal(recomputed.net_minor, NET_MINOR);
  assert.equal(recomputed.tax_minor, VAT_MINOR);
  assert.equal(recomputed.total_minor, GROSS_MINOR);
  assert.equal(r.totals.net_minor, recomputed.net_minor);
  assert.equal(r.totals.vat_minor, recomputed.tax_minor);
  assert.equal(r.totals.total_minor, recomputed.total_minor);
  assert.equal(r.totals.subtotal_minor, recomputed.subtotal_minor);
  assert.equal(recomputed.rounding_drift_minor, 0,
    "a catalogue price that drifts under the other rounding basis would bill a figure the price list never showed");
  assert.equal(r.totals.rounding_drift_minor, 0);
  assert.equal(r.totals.net_minor + r.totals.vat_minor, r.totals.total_minor);
});

test("THE SCALES: the same price is MAJOR in the invoice payload and MINOR in the quote payload", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.json("lines_resolve", { lines: LINES, client: "Harbour Cafe", date: RESOLVE_DATE });
  const inv = r.invoice_create.arguments.items;
  const quo = r.quote_create.arguments.items;
  assert.deepEqual(inv.map((i) => i.unit_price), [450, 39.99, 85, 45]);
  assert.deepEqual(quo.map((i) => i.unit_price_minor), [45000, 3999, 8500, 4500]);
  // Every quote item is a whole number of minor units; every invoice item is its major form.
  for (let i = 0; i < inv.length; i++) {
    assert.ok(Number.isInteger(quo[i].unit_price_minor), JSON.stringify(quo[i]));
    assert.equal(Math.round(inv[i].unit_price * 100), quo[i].unit_price_minor);
    assert.equal(inv[i].quantity, quo[i].quantity);
    assert.equal(inv[i].tax_rate, quo[i].tax_rate);
  }
  // Passing one shape into the other is the 100x error this server exists to prevent.
  const wrong = computeTotals(quo.map((q) => ({ ...q, unit_price: q.unit_price_minor })), "EUR", 0, 0);
  assert.equal(wrong.net_minor, NET_MINOR * 100, "the mis-scaled payload must be exactly 100x, or this test is not measuring anything");
});

test("an update replaces the row for that currency, tier and valid_from", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.json("sku_set", { sku: "HOST-MO", name: "Managed hosting", price_minor: 4299, valid_from: "2025-01-01" });
  assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 300));
  assert.equal(r.updated.price_rows.length, 1, "the row was added beside the old one instead of replacing it");
  assert.equal(r.updated.price_rows[0].price_minor, 4299);
  assert.match(r.notes.join(" "), /EUR 39\.99 became EUR 42\.99/);
  const stored = JSON.parse(readFileSync(join(storeDir(box.dataHome), "skus.json"), "utf8"));
  const host = stored.find((s) => s.sku === "HOST-MO");
  assert.equal(host.prices.length, 1, "two rows on one currency, tier and valid_from key");
});

test("the price list names the currency, the tier, the valid-from dates and the rates", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.call("price_list_text", { date: RESOLVE_DATE });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /^PRICE LIST\nin force 2026-03-15/);
  assert.match(r.text, /Nova Studio/);
  assert.match(r.text, /EUR, tier standard/);
  assert.match(r.text, /WEB-AUDIT\s+Website audit  EUR 450\.00 per each  from 2026-01-01  VAT 23%  \(EUR 495\.00 from 2026-07-01\)/);
  assert.match(r.text, /HOST-MO\s+Managed hosting  EUR 39\.99 per month  from 2025-01-01/);
  assert.match(r.text, /senior developer\s+EUR 85\.00 an hour  from 2025-01-01/);
});

test("the PDF is written and names the currency and tier", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  await c.init();
  await seed(c);
  const r = await c.json("price_list_pdf", { date: RESOLVE_DATE });
  assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 300));
  assert.equal(r.path, join(storeDir(box.dataHome), "pdf", "price-list-EUR-standard-2026-03-15.pdf"));
  assert.equal(r.lines, 3);
  assert.equal(r.sum_of_one_of_each, "EUR 609.99", "450.00 + 39.99 + 120.00 is one of each, and nothing else");
  const bytes = readFileSync(r.path);
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.length > 1000, `the PDF is only ${bytes.length} bytes`);
});

test("the report counts rows in force, rows a later row replaces, and rows missing the default currency", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  await seed(c);
  await c.call("sku_set", { sku: "USD-ONLY", name: "Overseas retainer", unit: "month", currency: "USD", price_minor: 90000, valid_from: "2025-01-01" });
  const r = await c.json("catalogue_report", { date: RESOLVE_DATE });
  assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 300));
  assert.equal(r.skus, 4);
  assert.equal(r.price_rows, 6);
  assert.equal(r.default_currency, "EUR");
  assert.equal(r.rows_in_force, 4, "three EUR rows in force plus the USD one");
  assert.equal(r.rows_expiring, 1);
  assert.deepEqual(r.rows_expiring_detail.map((e) => [e.sku, e.replaced_on, e.new_price]), [["WEB-AUDIT", "2026-07-01", "EUR 495.00"]]);
  assert.equal(r.skus_without_default_currency, 1);
  assert.deepEqual(r.skus_without_default_currency_detail.map((s) => s.sku), ["USD-ONLY"]);
  assert.equal(r.rate_cards, 2);
});

test("the register records what a resolution priced, and the report shows it", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  await seed(c);
  await c.call("lines_resolve", { lines: LINES, date: RESOLVE_DATE });
  await c.call("lines_resolve", { lines: [{ sku: "WEB-AUDIT", quantity: 1 }], date: RESOLVE_DATE });
  const r = await c.json("catalogue_report", { date: RESOLVE_DATE });
  const web = r.register.find((u) => u.ref === "WEB-AUDIT");
  assert.equal(web.times, 2, "a second resolution of one SKU updates its row rather than adding one");
  assert.equal(web.last_resolution, "RES-2026-0002");
  assert.equal(r.register_rows, 4, "one row per SKU and role priced, not one per resolution");
});

test("an unused SKU is deleted free on the free tier", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.json("sku_delete", { sku: "COPY-1K" });
  assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 300));
  assert.equal(r.deleted.sku, "COPY-1K");
  assert.equal(r.skus, 2);
  assert.equal(r.free_tier_sku_limit, 25);
});

test("sku_list filters by prefix and reports a SKU with no price in that currency", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  assert.equal((await c.json("sku_list", {})).count, 3);
  assert.equal((await c.json("sku_list", { prefix: "WEB-" })).count, 1);
  const usd = await c.json("sku_list", { currency: "USD", date: RESOLVE_DATE });
  assert.equal(usd.priced, 0);
  assert.equal(usd.without_price, 3);
  assert.match(usd.skus[0].no_price, /no USD price at tier standard on 2026-03-15/);
});

test("a rate card bound to a SKU gives the resolved hours line the SKU's name and VAT rate", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  await c.call("sku_set", { sku: "LAB-SEN", name: "Senior development", unit: "hour", price_minor: 8500, valid_from: "2025-01-01", vat_rate: 8 });
  await c.call("rate_set", { role: "senior developer", hourly_minor: 8500, valid_from: "2025-01-01", sku: "LAB-SEN" });
  const r = await c.json("lines_resolve", { lines: [{ role: "senior developer", hours: 2 }], date: RESOLVE_DATE });
  assert.equal(r.lines[0].description, "Senior development");
  assert.equal(r.lines[0].tax_rate, 8, "the bound SKU's own VAT rate wins over the profile default");
  assert.equal(r.lines[0].value_minor, 17000);
});
