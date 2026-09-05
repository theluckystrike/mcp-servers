// Two processes, one data dir. Ids must be unique and the free cap must hold across both.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, perDiemDir, proKey, TRIP } from "./_client.mjs";

test("two processes racing trip_record allocate 40 unique ids and lose nothing", async (t) => {
  const box = sandbox();
  const key = proKey();
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);

  const calls = [];
  for (let i = 0; i < 20; i++) {
    calls.push(a.call("trip_record", { ...TRIP, name: `a${i}` }));
    calls.push(b.call("trip_record", { ...TRIP, name: `b${i}` }));
  }
  const results = await Promise.all(calls);
  assert.deepEqual(results.filter((r) => r.isError).map((r) => r.text), []);

  const trips = JSON.parse(readFileSync(join(perDiemDir(box.dataHome), "trips.json"), "utf8"));
  assert.equal(trips.length, 40);
  assert.equal(new Set(trips.map((x) => x.id)).size, 40, "an id was reused");
  assert.deepEqual(JSON.parse(readFileSync(join(perDiemDir(box.dataHome), "counter.json"), "utf8")), { "TRIP-2026": 40 });
});

test("two processes cannot both slip past the last free trip of the month", async (t) => {
  const box = sandbox();
  const a = client({ dataHome: box.dataHome });
  const b = client({ dataHome: box.dataHome });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);

  const calls = [];
  for (let i = 0; i < 4; i++) {
    calls.push(a.call("trip_record", { ...TRIP, name: `a${i}` }));
    calls.push(b.call("trip_record", { ...TRIP, name: `b${i}` }));
  }
  const results = await Promise.all(calls);
  const stored = results.filter((r) => !r.isError);
  const refused = results.filter((r) => r.isError);
  assert.equal(stored.length, 5, `expected exactly 5 stored, got ${stored.length}`);
  assert.equal(refused.length, 3);
  for (const r of refused) assert.match(r.text, /records 5 trips a month/);
  const trips = JSON.parse(readFileSync(join(perDiemDir(box.dataHome), "trips.json"), "utf8"));
  assert.equal(trips.length, 5, "the check and the write are one critical section");
});
