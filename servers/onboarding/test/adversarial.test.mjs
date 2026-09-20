// What a user, or an assistant driving this server, will actually do wrong.
//
// Every case here is a refusal that must leave the store untouched, or a boundary that must
// not silently drop, truncate or reorder something. The rule the whole file tests: a tool
// either does the whole thing or writes nothing and says so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, writeProfile, cleanup, seed, seedHire, seedHireTasks, proKey, storeDir, TASKS, HIRE_NAME } from "./_client.mjs";

async function fresh(t) {
  const box = sandbox("mcp-onboarding-adv-");
  writeProfile(box.dataHome);
  const key = proKey("onboarding");
  const c = client({ dataHome: box.dataHome, key });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  return { c, box };
}

function storeBytes(box) {
  return readFileSync(storeDir(box.dataHome), "utf8");
}

test("a refused hire add leaves the store byte-identical", async (t) => {
  const { c, box } = await fresh(t);
  await c.json("onboarding_hire_add", { name: "Anna Chen", role: "engineer", start_date: "2026-09-01" });
  const before = storeBytes(box);
  const dup = await c.call("onboarding_hire_add", { name: "Anna Chen", role: "sales", start_date: "2026-09-05" });
  assert.equal(dup.isError, true);
  assert.match(dup.text, /already exists/);
  assert.equal(storeBytes(box), before, "a refused add rewrote the store");
});

test("a refused task add leaves the store byte-identical", async (t) => {
  const { c, box } = await fresh(t);
  const hire = await seedHire(c);
  const before = storeBytes(box);
  const bad = await c.call("onboarding_task_add", { hire: hire.id, text: "   ", owner: "it", due_offset: 1 });
  assert.equal(bad.isError, true);
  assert.match(bad.text, /text is empty/);
  assert.equal(storeBytes(box), before, "a refused task add rewrote the store");
});

test("a refused task_done leaves the store byte-identical", async (t) => {
  const { c, box } = await fresh(t);
  const { hire } = await seed(c);
  const before = storeBytes(box);
  const bad = await c.call("onboarding_task_done", { hire: hire.id, task: "K99", status: "done" });
  assert.equal(bad.isError, true);
  assert.match(bad.text, /no task/);
  assert.equal(storeBytes(box), before, "a refused task_done rewrote the store");
});

test("ambiguous hire name is refused with the candidates, nothing written", async (t) => {
  const { c, box } = await fresh(t);
  await c.json("onboarding_hire_add", { name: "Anna Chen", role: "engineer", start_date: "2026-09-01" });
  await c.json("onboarding_hire_add", { name: "Anna Li", role: "sales", start_date: "2026-09-01" });
  const before = storeBytes(box);
  const r = await c.call("onboarding_progress", { hire: "Anna" });
  assert.equal(r.isError, true);
  assert.match(r.text, /matches more than one hire/);
  assert.match(r.text, /H-0001/);
  assert.match(r.text, /H-0002/);
  assert.match(r.text, /Pass the exact id/);
  assert.equal(storeBytes(box), before, "an ambiguous read rewrote the store");
});

test("applying a template whose role already exists reuses it, not a duplicate", async (t) => {
  const { c } = await fresh(t);
  const hire = await seedHire(c);
  const first = await c.json("onboarding_template_apply", { hire: hire.id, role: "engineer", tasks: [{ text: "A", owner: "it", due_offset: 0 }] });
  assert.equal(first.template.id, "T-0001");
  const second = await c.json("onboarding_template_apply", { hire: hire.id, role: "engineer", tasks: [{ text: "B", owner: "hr", due_offset: 1 }] });
  assert.equal(second.template.id, "T-0001", "a second apply with the same role made a duplicate template");
  // give a second role a template that shares the "engine" prefix
  await c.json("onboarding_template_apply", { hire: hire.id, role: "engine room", tasks: [{ text: "C", owner: "it", due_offset: 2 }] });
  // a partial role spanning two templates is refused with the candidates
  const r = await c.call("onboarding_template_apply", { hire: hire.id, role: "engine" });
  assert.equal(r.isError, true);
  assert.match(r.text, /matches more than one template/);
  assert.match(r.text, /T-0001/);
  assert.match(r.text, /T-0002/);
});

test("over-long name and text are refused, not truncated", async (t) => {
  const { c, box } = await fresh(t);
  const longName = "x".repeat(201);
  const r = await c.call("onboarding_hire_add", { name: longName, role: "engineer", start_date: "2026-09-01" });
  assert.equal(r.isError, true);
  assert.match(r.text, /200 characters or fewer/);
  assert.equal((await c.json("onboarding_hire_list", {})).total, 0);

  const hire = await seedHire(c);
  const longText = "y".repeat(2001);
  const rt = await c.call("onboarding_task_add", { hire: hire.id, text: longText, owner: "it", due_offset: 1 });
  assert.equal(rt.isError, true);
  assert.match(rt.text, /2000 characters or fewer/);
  const prog = await c.json("onboarding_progress", { hire: hire.id });
  assert.equal(prog.hire.tasks, 0, "an over-long task was silently stored");
});

test("a corrupt store is quarantined and later calls fail loudly", async (t) => {
  const { c, box } = await fresh(t);
  await c.json("onboarding_hire_add", { name: "Anna Chen", role: "engineer", start_date: "2026-09-01" });
  const p = storeDir(box.dataHome);
  writeFileSync(p, "{ not json", "utf8");
  const r = await c.call("onboarding_hire_list", {});
  assert.equal(r.isError, true);
  assert.match(r.text, /data file is corrupt; moved to/);
  // the corrupt file was renamed aside byte-for-byte, and a marker explains it
  const marker = readFileSync(`${p}.corrupt`, "utf8");
  const moved = JSON.parse(marker).quarantined;
  assert.ok(moved.startsWith(p), "quarantine path does not point at the store");
  assert.equal(readFileSync(moved, "utf8"), "{ not json", "quarantine did not preserve the bytes");
  // a later call still fails loudly instead of reading the file as "no hires"
  const again = await c.call("onboarding_hire_list", {});
  assert.equal(again.isError, true);
  assert.match(again.text, /data file is corrupt/);
});

test("a hire with no tasks reports zero progress, not an error", async (t) => {
  const { c } = await fresh(t);
  const hire = await seedHire(c);
  const prog = await c.json("onboarding_progress", { hire: hire.id });
  assert.equal(prog.hire.tasks, 0);
  assert.equal(prog.hire.percent_complete, 0);
  assert.equal(prog.hire.overdue, 0);
});

test("task_done on a done task is idempotent, not a silent flip", async (t) => {
  const { c } = await fresh(t);
  const { hire } = await seed(c);
  const first = await c.json("onboarding_task_done", { hire: hire.id, task: "K01", status: "done" });
  const second = await c.json("onboarding_task_done", { hire: hire.id, task: "K01", status: "done" });
  assert.equal(second.task.status, "done");
  assert.equal(second.task.completed_date, first.task.completed_date, "re-done changed the completed date");
  const prog = await c.json("onboarding_progress", { hire: hire.id });
  assert.equal(prog.hire.done, 3, "re-done a done task double-counted");
});

test("a task can be reopened to todo and its completed date is dropped", async (t) => {
  const { c } = await fresh(t);
  const { hire } = await seed(c);
  const reopened = await c.json("onboarding_task_done", { hire: hire.id, task: "K01", status: "todo" });
  assert.equal(reopened.task.completed_date, null);
  const prog = await c.json("onboarding_progress", { hire: hire.id });
  assert.equal(prog.hire.todo, 3);
  assert.equal(prog.hire.done, 2);
});

test("template apply with no template and no tasks is refused, nothing written", async (t) => {
  const { c, box } = await fresh(t);
  const hire = await seedHire(c);
  const before = storeBytes(box);
  const r = await c.call("onboarding_template_apply", { hire: hire.id, role: "design" });
  assert.equal(r.isError, true);
  assert.match(r.text, /no template exists for role/);
  assert.equal(storeBytes(box), before, "a refused template apply rewrote the store");
});

test("applying a template to many hires at once is Pro-gated", async (t) => {
  const box = sandbox("mcp-onboarding-adv-");
  writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome }); // no key -> free tier
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const h1 = await seedHire(c, "Anna Chen", "engineer");
  const h2 = await seedHire(c, "Bob Smith", "engineer");
  const r = await c.call("onboarding_template_apply", { hire: `${h1.id},${h2.id}`, role: "engineer", tasks: [{ text: "A", owner: "it", due_offset: 0 }] });
  assert.equal(r.isError, true);
  assert.match(r.text, /is Pro. Nothing was written/);
});

test("as_csv export is Pro-gated", async (t) => {
  const box = sandbox("mcp-onboarding-adv-");
  writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome }); // no key -> free tier
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const { hire } = await seed(c);
  const r = await c.call("onboarding_progress", { hire: hire.id, as_csv: true });
  assert.equal(r.isError, true);
  assert.match(r.text, /is Pro. Nothing was written/);
});

test("a hire with a future start date has no overdue tasks", async (t) => {
  const { c } = await fresh(t);
  const hire = await seedHire(c, HIRE_NAME, "engineer", "2099-01-01");
  const over = await c.json("onboarding_overdue", { hire: hire.id });
  assert.equal(over.total, 0);
});

test("overdue rows are sorted most-overdue first", async (t) => {
  const { c } = await fresh(t);
  const { hire } = await seedHireTasks(c, HIRE_NAME, "engineer", "2020-01-01");
  // all six tasks are long overdue; the earliest due (offset 0) is most overdue
  const over = await c.json("onboarding_overdue", { hire: hire.id });
  assert.equal(over.total, 6);
  const lates = over.overdue.map((o) => o.days_late);
  assert.deepEqual(lates, [...lates].sort((a, b) => b - a), "overdue not sorted by days late");
});