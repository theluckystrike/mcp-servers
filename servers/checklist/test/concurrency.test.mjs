// Two server processes on one data dir, answering the same run at the same time.
//
// The store is read-modify-write under a file lock. Without the lock the second writer's
// snapshot is stale and its write silently drops the first writer's answer, which reads on
// disk exactly like a step nobody ever ticked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, writeProfile, cleanup, proKey, seedChecklist } from "./_client.mjs";

test("two processes, one run: every answer survives", async (t) => {
  const box = sandbox("mcp-checklist-conc-");
  writeProfile(box.dataHome);
  const key = proKey();
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await a.init();
  await b.init();

  const cl = await seedChecklist(a);
  const started = await a.json("run_start", { checklist: cl, title: "Van Z", date: "2026-02-14" });
  const run = started.started.id;

  const calls = [];
  const states = ["pass", "pass", "na", "pass", "fail", "pass"];
  for (let i = 0; i < 6; i++) {
    const who = i % 2 === 0 ? a : b;
    calls.push(who.call("run_check", { run, item: `I0${i + 1}`, state: states[i], by: i % 2 === 0 ? "Ada" : "Ben" }));
  }
  for (const r of await Promise.all(calls)) assert.equal(r.isError, false, r.text);

  const after = await b.json("run_show", { run });
  assert.equal(after.progress.pending, 0, "an answer was lost to a stale snapshot");
  assert.equal(after.progress.pass, 4);
  assert.equal(after.progress.fail, 1);
  assert.equal(after.progress.na, 1);
  assert.equal(after.status, "complete");
});

test("two processes creating checklists and runs at once never reuse an id", async (t) => {
  const box = sandbox("mcp-checklist-ids-");
  writeProfile(box.dataHome);
  const key = proKey();
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await a.init();
  await b.init();

  const made = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    (i % 2 === 0 ? a : b).call("checklist_create", { name: `List ${i}` })));
  const ids = made.map((r) => { assert.equal(r.isError, false, r.text); return JSON.parse(r.text).created.id; });
  assert.equal(new Set(ids).size, 10, `a checklist id was reused: ${ids.sort().join(", ")}`);
  for (const id of ids) assert.match(id, /^CL-\d{4}$/);

  const cl = await seedChecklist(a, "Worked");
  const runs = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    (i % 2 === 0 ? a : b).call("run_start", { checklist: cl, title: `Job ${i}`, date: "2026-02-14" })));
  const runIds = runs.map((r) => { assert.equal(r.isError, false, r.text); return JSON.parse(r.text).started.id; });
  assert.equal(new Set(runIds).size, 10, `a run id was reused: ${runIds.sort().join(", ")}`);
  for (const id of runIds) assert.match(id, /^RUN-2026-\d{4}$/);
});
