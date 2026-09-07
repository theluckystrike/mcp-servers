// Two processes sharing one data directory. The check and the write have to be one
// critical section or the free cap is decorative and deliverables go missing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, proKey, storeDir, writeProfile, REFERENCE_DATE, CLIENT } from "./_client.mjs";

function pair(t, opts = {}) {
  const box = sandbox();
  writeProfile(box.dataHome);
  const a = client({ dataHome: box.dataHome, ...opts });
  const b = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  return { box, a, b };
}

const read = (box, file) => JSON.parse(readFileSync(join(storeDir(box.dataHome), file), "utf8"));

test("forty schedules opened from two processes are all stored, with forty distinct ids", async (t) => {
  const { box, a, b } = pair(t, { key: proKey() });
  await Promise.all([a.init(), b.init()]);
  const calls = [];
  for (let i = 1; i <= 20; i++) {
    calls.push(a.call("delivery_schedule_create", { reference: `WO-2026-A${i}`, reference_date: REFERENCE_DATE, client: CLIENT, title: `Job A${i}` }));
    calls.push(b.call("delivery_schedule_create", { reference: `WO-2026-B${i}`, reference_date: REFERENCE_DATE, client: CLIENT, title: `Job B${i}` }));
  }
  const results = await Promise.all(calls);
  assert.deepEqual(results.filter((r) => r.isError).map((r) => r.text), [], "a write was refused under contention");
  const list = read(box, "schedules.json");
  assert.equal(list.length, 40);
  assert.equal(new Set(list.map((s) => s.id)).size, 40, "two schedules got the same id");
  assert.equal(new Set(list.map((s) => s.reference)).size, 40);
});

test("the race on the fourth open schedule: exactly three are stored", async (t) => {
  const { box, a, b } = pair(t);
  await Promise.all([a.init(), b.init()]);
  const calls = [];
  for (let i = 1; i <= 4; i++) {
    calls.push(a.call("delivery_schedule_create", { reference: `WO-2026-A${i}`, reference_date: REFERENCE_DATE, client: CLIENT, title: `Job A${i}` }));
    calls.push(b.call("delivery_schedule_create", { reference: `WO-2026-B${i}`, reference_date: REFERENCE_DATE, client: CLIENT, title: `Job B${i}` }));
  }
  const results = await Promise.all(calls);
  const accepted = results.filter((r) => !r.isError).length;
  const refused = results.filter((r) => r.isError);
  assert.equal(accepted, 3, `${accepted} schedules were accepted against a free cap of 3`);
  assert.equal(refused.length, 5);
  for (const r of refused) assert.match(r.text, /the free tier holds 3 open delivery schedules/);
  assert.equal(read(box, "schedules.json").length, 3);
});

test("thirty deliverables added to one schedule from two processes are all kept", async (t) => {
  const { box, a, b } = pair(t, { key: proKey() });
  await Promise.all([a.init(), b.init()]);
  const r = await a.json("delivery_schedule_create", { reference: "WO-2026-0011", reference_date: REFERENCE_DATE, client: CLIENT, title: "Many deliverables" });
  const id = r.created.id;
  const calls = [];
  for (let i = 1; i <= 15; i++) {
    calls.push(a.call("deliverable_add", { schedule: id, description: `Deliverable A${i}`, due_date: "2026-04-10", value_minor: 1000 }));
    calls.push(b.call("deliverable_add", { schedule: id, description: `Deliverable B${i}`, due_date: "2026-04-20", value_minor: 500 }));
  }
  const results = await Promise.all(calls);
  assert.deepEqual(results.filter((x) => x.isError).map((x) => x.text), []);
  const s = read(box, "schedules.json")[0];
  assert.equal(s.deliverables.length, 30, "a deliverable was lost to a lost update");
  assert.equal(new Set(s.deliverables.map((d) => d.id)).size, 30, "two deliverables got the same id");
  assert.equal(s.deliverable_counter, 30, "the counter drifted from the ids it issued");
  // 15 x 1000 + 15 x 500 = 22,500.
  const g = await a.json("delivery_schedule_get", { schedule: id, as_of: "2026-05-05" });
  assert.equal(g.schedule.value_minor, 22500);
});

test("status moves raced from two processes leave one history that reads as a timeline", async (t) => {
  const { box, a, b } = pair(t, { key: proKey() });
  await Promise.all([a.init(), b.init()]);
  const r = await a.json("delivery_schedule_create", { reference: "WO-2026-0011", reference_date: REFERENCE_DATE, client: CLIENT, title: "Raced" });
  const id = r.created.id;
  await a.call("deliverable_add", { schedule: id, description: "Only deliverable", due_date: "2026-04-10", value_minor: 1000 });
  await a.call("deliverable_status", { schedule: id, deliverable: "D01", status: "delivered", date: "2026-04-09" });
  // Both processes accept for the client at once. Exactly one lands.
  const results = await Promise.all([
    a.call("deliverable_status", { schedule: id, deliverable: "D01", status: "accepted", date: "2026-04-11", note: "By phone" }),
    b.call("deliverable_status", { schedule: id, deliverable: "D01", status: "accepted", date: "2026-04-12", note: "By email" }),
  ]);
  assert.equal(results.filter((x) => !x.isError).length, 1, "the deliverable was accepted twice");
  const d = read(box, "schedules.json")[0].deliverables[0];
  assert.equal(d.history.length, 2);
  assert.deepEqual(d.history.map((h) => h.to), ["delivered", "accepted"]);
  assert.match(results.find((x) => x.isError).text, /is already accepted|which is final/);
});
