// Two processes sharing one data directory. The check and the write have to be one
// critical section or the free cap is decorative and lines go missing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, proKey, storeDir, writeProfile, REFERENCE, CLIENT, ORIGINAL_MINOR, CO_DATE } from "./_client.mjs";

function pair(t, opts = {}) {
  const box = sandbox();
  writeProfile(box.dataHome);
  const a = client({ dataHome: box.dataHome, ...opts });
  const b = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  return { box, a, b };
}

const read = (box, file) => JSON.parse(readFileSync(join(storeDir(box.dataHome), file), "utf8"));

test("forty change orders raised from two processes are all stored, with forty distinct ids", async (t) => {
  const { box, a, b } = pair(t, { key: proKey() });
  await Promise.all([a.init(), b.init()]);
  // The first one fixes the original value for the reference; the rest inherit it.
  const first = await a.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Change 0", date: CO_DATE, original_value_minor: ORIGINAL_MINOR });
  assert.equal(first.isError, false, first.text);
  const calls = [];
  for (let i = 1; i <= 20; i++) {
    calls.push(a.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: `Change A${i}`, date: CO_DATE }));
    calls.push(b.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: `Change B${i}`, date: CO_DATE }));
  }
  const results = await Promise.all(calls);
  assert.deepEqual(results.filter((r) => r.isError).map((r) => r.text), [], "a write was refused under contention");
  const list = read(box, "change-orders.json");
  assert.equal(list.length, 41);
  assert.equal(new Set(list.map((o) => o.id)).size, 41, "two change orders got the same id");
  assert.equal(new Set(list.map((o) => o.original_value_minor)).size, 1, "the original value drifted between processes");
});

test("the race on the sixth open change order: exactly five are stored", async (t) => {
  const { box, a, b } = pair(t);
  await Promise.all([a.init(), b.init()]);
  const first = await a.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Change 0", date: CO_DATE, original_value_minor: ORIGINAL_MINOR });
  assert.equal(first.isError, false, first.text);
  const calls = [];
  for (let i = 1; i <= 6; i++) {
    calls.push(a.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: `Change A${i}`, date: CO_DATE }));
    calls.push(b.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: `Change B${i}`, date: CO_DATE }));
  }
  const results = await Promise.all(calls);
  const accepted = results.filter((r) => !r.isError).length;
  const refused = results.filter((r) => r.isError);
  assert.equal(accepted, 4, `${accepted + 1} change orders were accepted against a free cap of 5`);
  assert.equal(refused.length, 8);
  for (const r of refused) assert.match(r.text, /the free tier holds 5 open change orders/);
  assert.equal(read(box, "change-orders.json").length, 5);
});

test("thirty lines added to one change order from two processes are all kept", async (t) => {
  const { box, a, b } = pair(t, { key: proKey() });
  await Promise.all([a.init(), b.init()]);
  const r = await a.json("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Many lines", date: CO_DATE, original_value_minor: ORIGINAL_MINOR });
  const id = r.created.id;
  const calls = [];
  for (let i = 1; i <= 15; i++) {
    calls.push(a.call("change_order_add_line", { change_order: id, kind: "added", description: `Line A${i}`, quantity: i, unit_price_minor: 1000, reason: "Asked for" }));
    calls.push(b.call("change_order_add_line", { change_order: id, kind: "removed", description: `Line B${i}`, quantity: i, unit_price_minor: 500, reason: "Taken out" }));
  }
  const results = await Promise.all(calls);
  assert.deepEqual(results.filter((x) => x.isError).map((x) => x.text), []);
  const o = read(box, "change-orders.json")[0];
  assert.equal(o.lines.length, 30, "a line was lost to a lost update");
  assert.equal(new Set(o.lines.map((l) => l.id)).size, 30, "two lines got the same id");
  // 1000 x (1..15) less 500 x (1..15) is 500 x 120.
  const cv = await a.json("contract_value", { reference: REFERENCE });
  assert.equal(cv.pending_delta_minor, 60000);
});

test("status moves raced from two processes leave one history that reads as a timeline", async (t) => {
  const { box, a, b } = pair(t, { key: proKey() });
  await Promise.all([a.init(), b.init()]);
  const r = await a.json("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Raced", date: CO_DATE, original_value_minor: ORIGINAL_MINOR });
  const id = r.created.id;
  await a.call("change_order_add_line", { change_order: id, kind: "added", description: "Page", quantity: 1, unit_price_minor: 100, reason: "x" });
  await a.call("change_order_status", { change_order: id, status: "sent", date: "2026-03-13" });
  // Both processes try to answer for the client at once. Exactly one lands.
  const results = await Promise.all([
    a.call("change_order_status", { change_order: id, status: "approved", date: "2026-03-15" }),
    b.call("change_order_status", { change_order: id, status: "rejected", date: "2026-03-15" }),
  ]);
  assert.equal(results.filter((x) => !x.isError).length, 1, "both answers were recorded");
  const o = read(box, "change-orders.json")[0];
  assert.equal(o.history.length, 2);
  assert.ok(["approved", "rejected"].includes(o.status));
  assert.match(results.find((x) => x.isError).text, /which is final/);
});
