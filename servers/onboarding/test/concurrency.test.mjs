// Two server processes on one data dir, answering the same run at the same time.
//
// The store is read-modify-write under a file lock. Without the lock the second writer's
// snapshot is stale and its write silently drops the first writer's answer, which reads on
// disk exactly like a task nobody ever added.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, writeProfile, cleanup, proKey, seedHire } from "./_client.mjs";

test("two processes, one hire: every task add survives", async (t) => {
  const box = sandbox("mcp-onboarding-conc-");
  writeProfile(box.dataHome);
  const key = proKey("onboarding");
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await a.init();
  await b.init();

  const hire = await seedHire(a);
  const calls = [];
  for (let i = 0; i < 6; i++) {
    const who = i % 2 === 0 ? a : b;
    calls.push(who.call("onboarding_task_add", { hire: hire.id, text: `Task ${i + 1}`, owner: i % 2 === 0 ? "it" : "hr", due_offset: i }));
  }
  for (const r of await Promise.all(calls)) assert.equal(r.isError, false, r.text);

  const after = await b.json("onboarding_progress", { hire: hire.id });
  assert.equal(after.hire.tasks, 6, "a task add was lost to a stale snapshot");
  assert.equal(after.hire.todo, 6);
});

test("two processes creating hires at once never reuse an id", async (t) => {
  const box = sandbox("mcp-onboarding-ids-");
  writeProfile(box.dataHome);
  const key = proKey("onboarding");
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await a.init();
  await b.init();

  const made = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    (i % 2 === 0 ? a : b).call("onboarding_hire_add", { name: `Hire ${i}`, role: "engineer", start_date: "2026-09-01" })));
  const ids = made.map((r) => { assert.equal(r.isError, false, r.text); return JSON.parse(r.text).created.id; });
  assert.equal(new Set(ids).size, 10, `a hire id was reused: ${ids.sort().join(", ")}`);
  for (const id of ids) assert.match(id, /^H-\d{4}$/);
});