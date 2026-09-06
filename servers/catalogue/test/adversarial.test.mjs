// What the server refuses, and what it says while refusing. Every case asserts the
// refusal NAMES the thing it is about, and that nothing was written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  client, sandbox, cleanup, proKey, storeDir, writeProfile, seed, LINES, RESOLVE_DATE,
} from "./_client.mjs";

function open(t, opts = {}, profile = true) {
  const box = sandbox();
  if (profile) writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

const skus = (box) => {
  const p = join(storeDir(box.dataHome), "skus.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : [];
};

test("an unknown sku is refused BY NAME and no price is invented for it", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.call("lines_resolve", { lines: [{ sku: "WEB-AUDIT", quantity: 1 }, { sku: "NOT-A-CODE", quantity: 2 }], date: RESOLVE_DATE });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /no SKU matches "NOT-A-CODE"/);
  assert.match(r.text, /no price was invented/);
  // The whole resolution failed, so the register was never touched and no id was burned.
  assert.equal(existsSync(join(storeDir(box.dataHome), "register.json")), false, "a refused resolution wrote a register row");
  const g = await c.call("sku_get", { sku: "NOT-A-CODE" });
  assert.equal(g.isError, true);
  assert.match(g.text, /no SKU matches "NOT-A-CODE"/);
});

test("a date before every row has no price, and the refusal names the earliest row", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.call("sku_get", { sku: "WEB-AUDIT", date: "2024-12-31" });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /WEB-AUDIT has no EUR price at tier standard on 2024-12-31/);
  assert.match(r.text, /earliest EUR standard row starts 2025-01-01/);
  assert.match(r.text, /a price that did not exist yet is not a price/);
  const l = await c.call("lines_resolve", { lines: [{ sku: "WEB-AUDIT", quantity: 1 }], date: "2024-12-31" });
  assert.equal(l.isError, true, l.text);
  assert.match(l.text, /no price was invented for it/);
});

test("two rows cannot share one valid_from: the second replaces the first", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await c.call("sku_set", { sku: "WEB-AUDIT", name: "Website audit", unit: "each", price_minor: 45000, valid_from: "2026-01-01" });
  const again = await c.json("sku_set", { sku: "WEB-AUDIT", name: "Website audit", price_minor: 47000, valid_from: "2026-01-01" });
  assert.equal(again.isError, undefined, JSON.stringify(again).slice(0, 300));
  const stored = skus(box)[0];
  assert.equal(stored.prices.length, 1, "the store holds two rows on one currency, tier and valid_from key");
  assert.equal(stored.prices[0].amount_minor, 47000);
  // And a third call that changes nothing at all is refused by name rather than silently
  // rewriting `updated` and reporting a repricing that did not happen.
  const identical = await c.call("sku_set", { sku: "WEB-AUDIT", name: "Website audit", price_minor: 47000, valid_from: "2026-01-01" });
  assert.equal(identical.isError, true, identical.text);
  assert.match(identical.text, /WEB-AUDIT already says exactly that/);
  assert.match(identical.text, /EUR 470\.00 at tier standard from 2026-01-01/);
  assert.equal(identical.text.includes("free tier"), false, "the duplicate refusal must not sell an upgrade");
});

test("a second code carrying the same product at the same price is refused BEFORE the cap", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await c.call("sku_set", { sku: "WEB-AUDIT", name: "Website audit", unit: "each", price_minor: 45000, valid_from: "2026-01-01" });
  const twin = await c.call("sku_set", { sku: "AUDIT-WEB", name: "website  audit", unit: "Each", price_minor: 45000, valid_from: "2026-01-01" });
  assert.equal(twin.isError, true, twin.text);
  assert.match(twin.text, /WEB-AUDIT is already this product/);
  assert.equal(twin.text.includes("free tier"), false, "the duplicate refusal must not sell an upgrade");
  assert.equal(skus(box).length, 1, "a refused duplicate was still written");
  // duplicate_ok is the way through, for a genuine second product.
  const forced = await c.json("sku_set", { sku: "AUDIT-WEB", name: "Website audit", unit: "each", price_minor: 45000, valid_from: "2026-01-01", duplicate_ok: true });
  assert.equal(forced.isError, undefined, JSON.stringify(forced).slice(0, 300));
  assert.match(forced.notes.join(" "), /WEB-AUDIT carries the same product/);
});

test("a negative price, a negative quantity and a bad code are refused, and nothing is written", async (t) => {
  const { box, c } = open(t);
  await c.init();
  for (const args of [
    { sku: "NEG", name: "Negative", price_minor: -100, valid_from: "2026-01-01" },
    { sku: "FRAC", name: "Fractional", price_minor: 12.5, valid_from: "2026-01-01" },
    { sku: "bad code!", name: "Bad", price_minor: 100, valid_from: "2026-01-01" },
    { sku: "OK", name: "  ", price_minor: 100, valid_from: "2026-01-01" },
    { sku: "OK", name: "Fine", price_minor: 100, valid_from: "not-a-date" },
  ]) {
    const r = await c.call("sku_set", args);
    assert.equal(r.isError, true, `accepted ${JSON.stringify(args)}`);
  }
  assert.equal(skus(box).length, 0, "a refused sku_set was still written");
  await c.call("sku_set", { sku: "OK", name: "Fine", unit: "each", price_minor: 100, valid_from: "2026-01-01" });
  for (const line of [
    { sku: "OK", quantity: -1 },
    { sku: "OK", quantity: 0 },
    { sku: "OK" },
    { sku: "OK", quantity: 1, hours: 1 },
    { sku: "OK", role: "senior developer", quantity: 1 },
    { role: "senior developer", hours: 1 },
    {},
  ]) {
    const r = await c.call("lines_resolve", { lines: [line], date: "2026-03-15" });
    assert.equal(r.isError, true, `accepted ${JSON.stringify(line)}`);
  }
});

test("a 26th SKU is refused on the free tier, and deleting one gives the slot back", async (t) => {
  const { c } = open(t);
  await c.init();
  for (let i = 1; i <= 25; i++) {
    const r = await c.call("sku_set", { sku: `SKU-${String(i).padStart(3, "0")}`, name: `Product ${i}`, unit: "each", price_minor: 1000 + i, valid_from: "2026-01-01" });
    assert.equal(r.isError, false, `SKU ${i}: ${r.text}`);
  }
  const over = await c.call("sku_set", { sku: "SKU-026", name: "Product 26", unit: "each", price_minor: 9999, valid_from: "2026-01-01" });
  assert.equal(over.isError, true, over.text);
  assert.match(over.text, /the free tier holds 25 SKUs and the catalogue already has 25/);
  assert.match(over.text, /sku_delete/);
  assert.match(over.text, /Pro is a one-time \$\d+ for this server/);
  // Deleting one is free, and the slot comes back on the free tier.
  const gone = await c.call("sku_delete", { sku: "SKU-001" });
  assert.equal(gone.isError, false, gone.text);
  const now = await c.call("sku_set", { sku: "SKU-026", name: "Product 26", unit: "each", price_minor: 9999, valid_from: "2026-01-01" });
  assert.equal(now.isError, false, now.text);
});

test("a SKU with a dependent is refused by name: a rate card, then a resolved line", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await seed(c);
  await c.call("rate_set", { role: "senior developer", hourly_minor: 8500, valid_from: "2025-01-01", sku: "COPY-1K" });
  const byCard = await c.call("sku_delete", { sku: "COPY-1K" });
  assert.equal(byCard.isError, true, byCard.text);
  assert.match(byCard.text, /COPY-1K is the SKU on 1 rate card\(s\) \(senior developer\)/);

  await c.call("lines_resolve", { lines: LINES, date: RESOLVE_DATE });
  const byUse = await c.call("sku_delete", { sku: "WEB-AUDIT" });
  assert.equal(byUse.isError, true, byUse.text);
  assert.match(byUse.text, /WEB-AUDIT has priced 1 resolved line\(s\), the last on 2026-03-15 under RES-2026-0001/);
  assert.match(byUse.text, /Nothing was written/);
  assert.ok(skus(box).some((s) => s.sku === "WEB-AUDIT"), "a refused delete still removed the SKU");
});

test("a second tier is Pro, and the refusal names the tier and the tool", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.call("sku_set", { sku: "WEB-AUDIT", name: "Website audit", price_minor: 36000, valid_from: "2026-01-01", tier: "trade" });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /tier "trade" is a second price for the same product/);
  assert.match(r.text, /src=catalogue\.sku_set/);
  const stored = skus(box).find((s) => s.sku === "WEB-AUDIT");
  assert.equal(stored.prices.every((p) => p.tier === "standard"), true, "a Pro tier row was written on the free tier");
  // With a key it lands, and only then does the trade price resolve.
  const { c: pro } = open(t, { key: proKey() });
  await pro.init();
  await seed(pro);
  const okr = await pro.json("sku_set", { sku: "WEB-AUDIT", name: "Website audit", price_minor: 36000, valid_from: "2026-01-01", tier: "trade" });
  assert.equal(okr.isError, undefined, JSON.stringify(okr).slice(0, 300));
  const got = await pro.json("sku_get", { sku: "WEB-AUDIT", date: RESOLVE_DATE, tier: "trade" });
  assert.equal(got.price_minor, 36000);
});

test("the Pro tools refuse on free and name the tool that tripped the gate", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  for (const [tool, args] of [
    ["price_list_pdf", {}],
    ["catalogue_report", {}],
  ]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} answered on the free tier`);
    assert.match(r.text, /Pro is a one-time \$\d+ for this server/, tool);
    assert.match(r.text, new RegExp(`src=catalogue\\.${tool}`), `${tool} gate link is untagged`);
  }
});

test("an unreadable store is never read as an empty catalogue", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await c.call("sku_set", { sku: "WEB-AUDIT", name: "Website audit", unit: "each", price_minor: 45000, valid_from: "2026-01-01" });
  writeFileSync(join(storeDir(box.dataHome), "skus.json"), "{ this is not json");
  for (const [tool, args] of [
    ["sku_set", { sku: "OTHER", name: "Other", price_minor: 100, valid_from: "2026-01-01" }],
    ["sku_get", { sku: "WEB-AUDIT" }],
    ["sku_list", {}],
    ["sku_delete", { sku: "WEB-AUDIT" }],
    ["lines_resolve", { lines: [{ sku: "WEB-AUDIT", quantity: 1 }] }],
    ["price_list_text", {}],
  ]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} answered over a corrupt store`);
  }
  const files = readdirSync(storeDir(box.dataHome));
  assert.ok(files.some((f) => f.startsWith("skus.json.corrupt-")), `no quarantine copy: ${files.join(", ")}`);
  assert.ok(files.includes("skus.json.corrupt"), `no marker: ${files.join(", ")}`);
  const quarantined = files.find((f) => f.startsWith("skus.json.corrupt-"));
  assert.equal(readFileSync(join(storeDir(box.dataHome), quarantined), "utf8"), "{ this is not json",
    "the quarantine copy is not byte-for-byte what was on disk");
});

test("one resolution carries one currency, and a mixed list is refused rather than converted", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.call("lines_resolve", {
    lines: [{ sku: "WEB-AUDIT", quantity: 1 }, { sku: "HOST-MO", quantity: 1, currency: "USD" }],
    date: RESOLVE_DATE,
  });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /is in USD and the resolution is in EUR/);
  assert.match(r.text, /nothing here converts on its own/);
});

test("an unknown role is refused by name and no hourly rate is invented", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.call("lines_resolve", { lines: [{ role: "architect", hours: 2 }], date: RESOLVE_DATE });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /no rate card matches "architect"/);
  assert.match(r.text, /no hourly rate was invented/);
  const g = await c.call("rate_get", { role: "senior developer", currency: "USD" });
  assert.equal(g.isError, true, g.text);
  assert.match(g.text, /no USD rate on/);
  assert.match(g.text, /no rate was invented/);
});

test("with no shared profile the VAT fallback is zero and the answer says so", async (t) => {
  const { c } = open(t, {}, false);
  await c.init();
  await c.call("sku_set", { sku: "WEB-AUDIT", name: "Website audit", unit: "each", price_minor: 45000, valid_from: "2026-01-01" });
  const r = await c.json("lines_resolve", { lines: [{ sku: "WEB-AUDIT", quantity: 2 }], date: RESOLVE_DATE });
  assert.equal(r.currency, "EUR", "with no profile the currency falls back to EUR");
  assert.equal(r.vat_rate_fallback, 0);
  assert.equal(r.vat_rate_source, "none");
  assert.equal(r.totals.vat_minor, 0);
  assert.equal(r.totals.total_minor, 90000);
  assert.match(r.notes.join(" "), /carries no default_tax_rate/);
});
