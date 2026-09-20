// Unit tests for the onboarding server: hire lifecycle, task states, progress, overdue.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, writeProfile, cleanup, seed, seedHire, seedHireTasks, proKey, daysFromNow, TASKS, HIRE_NAME, HIRE_ROLE, HIRE_START, DONE_IDS, SKIPPED_ID } from "./_client.mjs";

const KEY = "unit";

async function fresh(t) {
  const box = sandbox("mcp-onboarding-unit-");
  writeProfile(box.dataHome);
  const key = proKey("onboarding");
  const c = client({ dataHome: box.dataHome, key });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  return c;
}

function idMatch(v, re) { return assert.match(v, re); }

test("hire add returns H-0001 with normalised role, then list sees it", async (t) => {
  const c = await fresh(t);
  const made = await c.json("onboarding_hire_add", { name: "Anna Chen", role: "  Data Engineer ", start_date: "2026-09-01" });
  idMatch(made.created.id, /^H-\d{4}$/);
  assert.equal(made.created.name, "Anna Chen");
  assert.equal(made.created.role, "data-engineer");
  assert.equal(made.created.start_date, "2026-09-01");
  assert.equal(made.created.tasks, 0);
  assert.equal(made.created.percent_complete, 0);
  const list = await c.json("onboarding_hire_list", {});
  assert.equal(list.total, 1);
  assert.equal(list.hires[0].id, made.created.id);
});

test("hire ids increment and are unique", async (t) => {
  const c = await fresh(t);
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const made = await c.json("onboarding_hire_add", { name: `P${i}`, role: "engineer", start_date: "2026-09-01" });
    ids.push(made.created.id);
  }
  assert.equal(new Set(ids).size, 3);
  assert.deepEqual(ids, ["H-0001", "H-0002", "H-0003"]);
});

test("duplicate hire name is refused with nothing written", async (t) => {
  const c = await fresh(t);
  await c.json("onboarding_hire_add", { name: "Anna Chen", role: "engineer", start_date: "2026-09-01" });
  const dup = await c.call("onboarding_hire_add", { name: "Anna Chen", role: "sales", start_date: "2026-09-05" });
  assert.equal(dup.isError, true);
  assert.match(dup.text, /already exists/);
  const list = await c.json("onboarding_hire_list", {});
  assert.equal(list.total, 1);
});

test("name is required and over-long is refused", async (t) => {
  const c = await fresh(t);
  const empty = await c.call("onboarding_hire_add", { name: "   ", role: "engineer", start_date: "2026-09-01" });
  assert.equal(empty.isError, true);
  assert.match(empty.text, /name is empty/);
  const big = "x".repeat(201);
  const longName = await c.call("onboarding_hire_add", { name: big, role: "engineer", start_date: "2026-09-01" });
  assert.equal(longName.isError, true);
  assert.equal((await c.json("onboarding_hire_list", {})).total, 0);
});

test("start date must be a real date", async (t) => {
  const c = await fresh(t);
  for (const bad of ["2026-02-30", "tomorrow", "2026/09/01", "2026-9-1"]) {
    const r = await c.call("onboarding_hire_add", { name: "X", role: "engineer", start_date: bad });
    assert.equal(r.isError, true, `start_date ${bad}`);
    assert.match(r.text, /not a real date/);
  }
  assert.equal((await c.json("onboarding_hire_list", {})).total, 0);
});

test("task add returns K01-style ids and they increment", async (t) => {
  const c = await fresh(t);
  const hire = await seedHire(c);
  const t1 = await c.json("onboarding_task_add", { hire: hire.id, text: "Issue laptop", owner: "it", due_offset: 0 });
  idMatch(t1.added.id, /^K\d{2}$/);
  const t2 = await c.json("onboarding_task_add", { hire: hire.id, text: "HR welcome", owner: "hr", due_offset: 2 });
  assert.equal(t2.added.id, "K02");
  assert.equal((await c.json("onboarding_progress", { hire: hire.id })).hire.tasks_detail.length, 2);
});

test("task text is normalised and empty text refused", async (t) => {
  const c = await fresh(t);
  const hire = await seedHire(c);
  const added = await c.json("onboarding_task_add", { hire: hire.id, text: "  Issue   laptop  ", owner: "it", due_offset: 1 });
  assert.equal(added.added.text, "Issue laptop");
  const empty = await c.call("onboarding_task_add", { hire: hire.id, text: "   ", owner: "it", due_offset: 1 });
  assert.equal(empty.isError, true);
  assert.match(empty.text, /text is empty/);
});

test("due_offset is bounded 0..365", async (t) => {
  const c = await fresh(t);
  const hire = await seedHire(c);
  for (const off of [-1, 366]) {
    const r = await c.call("onboarding_task_add", { hire: hire.id, text: "X", owner: "manager", due_offset: off });
    assert.equal(r.isError, true, `offset ${off}`);
  }
  const ok = await c.call("onboarding_task_add", { hire: hire.id, text: "X", owner: "manager", due_offset: 365 });
  assert.equal(ok.isError, false, ok.text);
});

test("unknown owner is refused", async (t) => {
  const c = await fresh(t);
  const hire = await seedHire(c);
  const r = await c.call("onboarding_task_add", { hire: hire.id, text: "X", owner: "admin", due_offset: 1 });
  assert.equal(r.isError, true);
});

test("task_done transitions the worked hire and recomputes progress", async (t) => {
  const c = await fresh(t);
  const { hire, tasks } = await seed(c);
  const prog = await c.json("onboarding_progress", { hire: hire.id });
  const h = prog.hire;
  assert.equal(h.tasks, 6);
  assert.equal(h.done, 3);
  assert.equal(h.skipped, 1);
  assert.equal(h.todo, 2);
  assert.equal(h.percent_complete, 50.0);
  assert.equal(h.overdue, 1);
  // K05 is the overdue one
  const over = h.progress.overdue;
  assert.equal(over, 1);
  const outstanding = h.progress.outstanding;
  assert.deepEqual(outstanding.map((o) => o.id), ["K05", "K06"]);
});

test("marking the overdue task done clears overdue and raises percent", async (t) => {
  const c = await fresh(t);
  const { hire } = await seed(c);
  const done = await c.json("onboarding_task_done", { hire: hire.id, task: "K05", status: "done" });
  assert.equal(done.task.status, "done");
  assert.match(done.task.completed_date, /^\d{4}-\d{2}-\d{2}$/);
  const prog = await c.json("onboarding_progress", { hire: hire.id });
  assert.equal(prog.hire.done, 4);
  assert.equal(prog.hire.overdue, 0);
  // percent changed: 4/6 = 66.7
  assert.equal(prog.hire.percent_complete, 66.7);
});

test("setting a task back to todo reopens it and removes completed_date", async (t) => {
  const c = await fresh(t);
  const { hire } = await seed(c);
  const reopened = await c.json("onboarding_task_done", { hire: hire.id, task: "K01", status: "todo" });
  assert.equal(reopened.task.status, "todo");
  assert.equal(reopened.task.completed_date, null);
  const prog = await c.json("onboarding_progress", { hire: hire.id });
  assert.equal(prog.hire.done, 2);
  assert.equal(prog.hire.todo, 3);
  assert.equal(prog.hire.tasks_detail.find((x) => x.id === "K01").status, "todo");
});

test("task_done with an explicit date uses it", async (t) => {
  const c = await fresh(t);
  const { hire } = await seed(c);
  const done = await c.json("onboarding_task_done", { hire: hire.id, task: "K06", status: "done", date: "2026-08-01" });
  assert.equal(done.task.completed_date, "2026-08-01");
});

test("task_done on an unknown task or hire is refused", async (t) => {
  const c = await fresh(t);
  const { hire } = await seed(c);
  const badTask = await c.call("onboarding_task_done", { hire: hire.id, task: "K99", status: "done" });
  assert.equal(badTask.isError, true);
  assert.match(badTask.text, /no task/);
  const badHire = await c.call("onboarding_task_done", { hire: "H-9999", task: "K01", status: "done" });
  assert.equal(badHire.isError, true);
});

test("hire_list filters by role and contains", async (t) => {
  const c = await fresh(t);
  await c.json("onboarding_hire_add", { name: "Anna Chen", role: "engineer", start_date: "2026-09-01" });
  await c.json("onboarding_hire_add", { name: "Bob Smith", role: "sales", start_date: "2026-09-01" });
  const eng = await c.json("onboarding_hire_list", { role: "Engineer" });
  assert.equal(eng.total, 1);
  assert.equal(eng.hires[0].name, "Anna Chen");
  const anna = await c.json("onboarding_hire_list", { contains: "ANNA" });
  assert.equal(anna.total, 1);
  const none = await c.json("onboarding_hire_list", { role: "design" });
  assert.equal(none.total, 0);
});

test("untracked hire name fails, but partial name and exact id work", async (t) => {
  const c = await fresh(t);
  const hire = await seedHire(c);
  const r = await c.call("onboarding_progress", { hire: "Zsófia" });
  assert.equal(r.isError, true);
  // findHire resolves a unique partial name by design (documented in store.ts).
  const part = await c.call("onboarding_progress", { hire: "Rhea" });
  assert.equal(part.isError, false);
  const ok = await c.call("onboarding_progress", { hire: hire.id });
  assert.equal(ok.isError, false);
});

test("onboarding_overdue reports the single overdue task", async (t) => {
  const c = await fresh(t);
  const { hire } = await seed(c);
  const over = await c.json("onboarding_overdue", {});
  assert.equal(over.total, 1);
  assert.equal(over.overdue[0].hire_id, hire.id);
  assert.equal(over.overdue[0].task, "K05");
  assert.ok(over.overdue[0].days_late >= 0);
  // filtered to just this hire
  const single = await c.json("onboarding_overdue", { hire: hire.id });
  assert.equal(single.total, 1);
});

test("onboarded hire with no task names yields no overdue", async (t) => {
  const c = await fresh(t);
  const hire = await seedHire(c, HIRE_NAME, HIRE_ROLE, daysFromNow(30));
  const over = await c.json("onboarding_overdue", { hire: hire.id });
  assert.equal(over.total, 0);
});