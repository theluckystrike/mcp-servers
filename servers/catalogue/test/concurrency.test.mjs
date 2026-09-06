// Two processes sharing one data directory. The check and the write have to be one
// critical section or the free cap is decorative and price rows go missing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, proKey, storeDir, writeProfile, seed, LINES, RESOLVE_DATE } from "./_client.mjs";

function pair(t, opts = {}) {
  const box = sandbox();
  writeProfile(box.dataHome);
  const a = client({ dataHome: box.dataHome, ...opts });
  const b = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  return { box, a, b };
}

const read = (box, file) => JSON.parse(readFileSync(join(storeDir(box.dataHome), file), "utf8"));

test("forty SKUs set from two processes are all stored, with forty distinct codes", async (t) => {
  const { box, a, b } = pair(t, { key: proKey() });
  await Promise.all([a.init(), b.init()]);
  const calls = [];
  for (let i = 0; i < 20; i++) {
    calls.push(a.call("sku_set", { sku: `A-${String(i).padStart(3, "0")}`, name: `Product A${i}`, unit: "each", price_minor: 1000 + i, valid_from: "2026-01-01" }));
    calls.push(b.call("sku_set", { sku: `B-${String(i).padStart(3, "0")}`, name: `Product B${i}`, unit: "each", price_minor: 2000 + i, valid_from: "2026-01-01" }));
  }
  const results = await Promise.all(calls);
  assert.deepEqual(results.filter((r) => r.isError).map((r) => r.text), [], "a write was refused under contention");
  const list = read(box, "skus.json");
  assert.equal(list.length, 40);
  assert.equal(new Set(list.map((s) => s.sku)).size, 40, "two SKUs got the same code");
});

test("the race on the 26th free SKU: exactly twenty-five are stored", async (t) => {
  const { box, a, b } = pair(t);
  await Promise.all([a.init(), b.init()]);
  const calls = [];
  for (let i = 0; i < 15; i++) {
    calls.push(a.call("sku_set", { sku: `A-${String(i).padStart(3, "0")}`, name: `Product A${i}`, unit: "each", price_minor: 1000 + i, valid_from: "2026-01-01" }));
    calls.push(b.call("sku_set", { sku: `B-${String(i).padStart(3, "0")}`, name: `Product B${i}`, unit: "each", price_minor: 2000 + i, valid_from: "2026-01-01" }));
  }
  const results = await Promise.all(calls);
  const accepted = results.filter((r) => !r.isError).length;
  const refused = results.filter((r) => r.isError);
  assert.equal(accepted, 25, `${accepted} SKUs were accepted against a free cap of 25`);
  assert.equal(refused.length, 5);
  for (const r of refused) assert.match(r.text, /the free tier holds 25 SKUs/);
  assert.equal(read(box, "skus.json").length, 25);
});

test("thirty price rows added to one SKU from two processes are all kept", async (t) => {
  const { box, a, b } = pair(t, { key: proKey() });
  await Promise.all([a.init(), b.init()]);
  await a.call("sku_set", { sku: "WEB-AUDIT", name: "Website audit", unit: "each", price_minor: 45000, valid_from: "2026-01-01" });
  const calls = [];
  for (let i = 1; i <= 15; i++) {
    const d1 = `2026-02-${String(i).padStart(2, "0")}`;
    const d2 = `2026-03-${String(i).padStart(2, "0")}`;
    calls.push(a.call("sku_set", { sku: "WEB-AUDIT", name: "Website audit", price_minor: 45000 + i, valid_from: d1 }));
    calls.push(b.call("sku_set", { sku: "WEB-AUDIT", name: "Website audit", price_minor: 46000 + i, valid_from: d2 }));
  }
  const results = await Promise.all(calls);
  assert.deepEqual(results.filter((r) => r.isError).map((r) => r.text), []);
  const s = read(box, "skus.json")[0];
  assert.equal(s.prices.length, 31, "a price row was lost to a lost update");
  assert.equal(new Set(s.prices.map((p) => `${p.currency}|${p.tier}|${p.valid_from}`)).size, 31, "two rows got the same key");
});

test("resolutions raced from two processes get distinct ids and one register row per ref", async (t) => {
  const { box, a, b } = pair(t, { key: proKey() });
  await Promise.all([a.init(), b.init()]);
  await seed(a);
  const calls = [];
  for (let i = 0; i < 10; i++) {
    calls.push(a.call("lines_resolve", { lines: LINES, date: RESOLVE_DATE }));
    calls.push(b.call("lines_resolve", { lines: LINES, date: RESOLVE_DATE }));
  }
  const results = await Promise.all(calls);
  assert.deepEqual(results.filter((r) => r.isError).map((r) => r.text), []);
  const ids = results.map((r) => JSON.parse(r.text).resolution);
  assert.equal(new Set(ids).size, 20, "two resolutions got the same id");
  const reg = read(box, "register.json");
  assert.equal(reg.length, 4, "the register grew per resolution instead of per priced ref");
  for (const u of reg) assert.equal(u.times, 20, `${u.ref} counted ${u.times} of 20 resolutions`);
});
