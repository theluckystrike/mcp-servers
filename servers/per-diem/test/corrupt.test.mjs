// A store that is on disk but unreadable must never read as "no trips".
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, perDiemDir, proKey, TRIP } from "./_client.mjs";

test("a corrupt trips.json is quarantined byte for byte and every later call fails", async (t) => {
  const box = sandbox();
  const dir = perDiemDir(box.dataHome);
  mkdirSync(dir, { recursive: true });
  const bytes = '[{"id":"TRIP-2026-0001", TRUNCATED';
  writeFileSync(join(dir, "trips.json"), bytes);
  const c = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const list = await c.call("trip_list", {});
  assert.equal(list.isError, true, "a corrupt store must not answer 'no trips'");
  assert.match(list.text, /corrupt/);

  const moved = readdirSync(dir).find((f) => f.startsWith("trips.json.corrupt-"));
  assert.ok(moved, `nothing was quarantined: ${readdirSync(dir).join(", ")}`);
  assert.equal(readFileSync(join(dir, moved), "utf8"), bytes, "the quarantined copy must be byte for byte");
  assert.ok(existsSync(join(dir, "trips.json.corrupt")), "a marker must be written");
  assert.ok(!existsSync(join(dir, "trips.json")), "nothing may be written back over the corrupt file");

  // Every path that touches the store keeps failing, not only the writes.
  for (const [tool, args] of [
    ["trip_list", {}],
    ["trip_record", TRIP],
    ["trip_export", { trip: "anything" }],
    ["perdiem_report", {}],
  ]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} answered on a corrupt store`);
  }

  // The tools that do not read the store still work: a broken trip file is not a broken
  // rate table, and refusing to quote a public rate would be an outage nobody asked for.
  const calc = await c.json("perdiem_calc", { ...TRIP, name: undefined });
  assert.equal(calc.total, "PLN 45.00");
  assert.equal((await c.json("perdiem_rates", { scheme: "us" })).tables.length, 1);
});

test("a corrupt counter.json blocks the write and leaves the trips readable", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  await c.json("trip_record", { ...TRIP, name: "first" });
  writeFileSync(join(perDiemDir(box.dataHome), "counter.json"), "{oops");

  const again = await c.call("trip_record", { ...TRIP, name: "second" });
  assert.equal(again.isError, true);
  const list = await c.json("trip_list", {});
  assert.equal(list.count, 1, "the trip that was already stored is still readable");
  assert.equal(list.trips[0].name, "first");
});
