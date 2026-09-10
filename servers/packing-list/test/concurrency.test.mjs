// Two server processes on one data dir, packing the same shipment at the same time.
//
// The store is read-modify-write under a file lock. Without the lock the second writer's
// snapshot is stale and its write silently drops the first writer's carton, which reads on
// disk exactly like a carton nobody ever added.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, writeProfile, cleanup, proKey } from "./_client.mjs";

test("two processes, one data dir: every carton and every packed line survives", async (t) => {
  const box = sandbox("mcp-packing-list-conc-");
  writeProfile(box.dataHome);
  const key = proKey();
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await a.init();
  await b.init();

  const created = await a.json("packing_list_create", { reference: "PO-CONC", consignee: "Harbour Cafe", date: "2026-04-02" });
  const id = created.created.id;

  // Ten cartons from two processes at once.
  const adds = [];
  for (let i = 0; i < 10; i++) {
    const who = i % 2 === 0 ? a : b;
    adds.push(who.call("carton_add", { packing_list: id, label: `Box ${i + 1}`, tare_grams: 100 + i, length_cm: 10, width_cm: 10, height_cm: 10 }));
  }
  const results = await Promise.all(adds);
  for (const r of results) assert.equal(r.isError, false, r.text);

  const show = await a.json("packing_list_show", { packing_list: id });
  assert.equal(show.cartons_detail.length, 10, "a carton was lost to a stale snapshot");
  assert.equal(new Set(show.cartons_detail.map((c) => c.id)).size, 10, "two cartons were given the same id");
  assert.equal(show.totals.tare_grams, Array.from({ length: 10 }, (_, i) => 100 + i).reduce((x, y) => x + y, 0));

  // Twenty packed lines from two processes at once, into the cartons that now exist.
  const packs = [];
  for (let i = 0; i < 20; i++) {
    const who = i % 2 === 0 ? b : a;
    packs.push(who.call("pack_item", { packing_list: id, carton: show.cartons_detail[i % 10].id, description: `Item ${i}`, quantity: 1, unit_grams: 1000 }));
  }
  for (const r of await Promise.all(packs)) assert.equal(r.isError, false, r.text);

  const after = await b.json("packing_list_show", { packing_list: id });
  assert.equal(after.totals.lines, 20, "a packed line was lost");
  assert.equal(new Set(after.cartons_detail.flatMap((c) => c.contents.map((l) => l.id))).size, 20, "two packed lines were given the same id");
  assert.equal(after.totals.net_grams, 20000);
});

test("two processes raising packing lists at once never reuse a PL number", async (t) => {
  const box = sandbox("mcp-packing-list-ids-");
  writeProfile(box.dataHome);
  const key = proKey();
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await a.init();
  await b.init();

  const calls = [];
  for (let i = 0; i < 12; i++) {
    const who = i % 2 === 0 ? a : b;
    calls.push(who.call("packing_list_create", { reference: `PO-${i}`, consignee: "Harbour Cafe", date: "2026-04-02" }));
  }
  const ids = (await Promise.all(calls)).map((r) => { assert.equal(r.isError, false, r.text); return JSON.parse(r.text).created.id; });
  assert.equal(new Set(ids).size, 12, `a number was reused: ${ids.sort().join(", ")}`);
  for (const id of ids) assert.match(id, /^PL-2026-\d{4}$/);
});
