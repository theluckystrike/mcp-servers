// D-K11 / D-K12. A free-tier slot must never be spent by a call that wrote nothing new, and
// a slot spent by mistake must be recoverable without a Pro key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, cleanup } from "./_client.mjs";

test("a byte-identical task_add is refused and names the task already holding the slot", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const args = {
    project: "Nova Site", title: "Write the launch email", column: "todo",
    due: "2026-09-10", estimate_minutes: 90, priority: "high", tags: ["writing", "client"],
    notes: "one paragraph, no filler",
  };
  const first = await c.call("task_add", args);
  assert.equal(first.isError, false, first.text);
  const id = first.text.split(/\s+/)[0];

  const again = await c.call("task_add", args);
  assert.equal(again.isError, true, again.text);
  assert.match(again.text, new RegExp(`already open on Nova Site as ${id}`));
  assert.match(again.text, /Nothing was written and no free-tier slot was used/);
  assert.match(again.text, /task_delete/);

  // and the store really did not grow
  const list = await c.call("task_list", {});
  assert.match(list.text, /1 task\(s\)/);

  // any real edit is still a new task: the guard is not a title lock
  const edited = await c.call("task_add", { ...args, priority: "normal" });
  assert.equal(edited.isError, false, edited.text);
  const tagged = await c.call("task_add", { ...args, tags: ["writing"] });
  assert.equal(tagged.isError, false, tagged.text);
  const later = await c.call("task_add", { ...args, due: "2026-09-11" });
  assert.equal(later.isError, false, later.text);
  const four = await c.call("task_list", {});
  assert.match(four.text, /4 task\(s\)/);

  // once the twin is finished the same card may be raised again
  const done = await c.call("task_done", { id });
  assert.equal(done.isError, false, done.text);
  const repeat = await c.call("task_add", args);
  assert.equal(repeat.isError, false, repeat.text);
});

test("project_delete gives back a free project slot", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  for (const p of ["Nova Site", "Acme App", "Typo Bard"]) {
    const r = await c.call("task_add", { project: p, title: `first on ${p}` });
    assert.equal(r.isError, false, r.text);
  }
  // the fourth board is refused: all three free slots are spent
  const fourth = await c.call("task_add", { project: "Delta Co", title: "fourth board" });
  assert.match(fourth.text, /free tier keeps 3 project boards/);

  // a board with tasks is refused, and the refusal names a task and the count
  const tasks = await c.call("task_list", { project: "Typo Bard" });
  const id = /\bTB-\w+\b/.exec(tasks.text)[0];
  const busy = await c.call("project_delete", { project: "Typo Bard" });
  assert.equal(busy.isError, true, busy.text);
  assert.match(busy.text, new RegExp(`still holds 1 task\\(s\\).*${id}`));
  assert.match(busy.text, /Nothing was deleted/);
  const still = await c.call("project_list", {});
  assert.match(still.text, /Typo Bard/);

  // empty it, then the board itself goes and the slot comes back
  const del = await c.call("task_delete", { id });
  assert.equal(del.isError, false, del.text);
  const gone = await c.call("project_delete", { project: "Typo Bard" });
  assert.equal(gone.isError, false, gone.text);
  assert.match(gone.text, /Deleted the empty board Typo Bard/);
  assert.match(gone.text, /Free tier: 2\/3 projects/);

  const after = await c.call("project_list", {});
  assert.doesNotMatch(after.text, /Typo Bard/);

  const recovered = await c.call("task_add", { project: "Delta Co", title: "fourth board" });
  assert.equal(recovered.isError, false, recovered.text);
  assert.doesNotMatch(recovered.text, /free tier keeps 3 project boards/);
  const boards = await c.call("project_list", {});
  assert.match(boards.text, /Delta Co/);

  // a board that never existed is named back, not invented
  const missing = await c.call("project_delete", { project: "Nowhere Ltd" });
  assert.equal(missing.isError, true, missing.text);
  assert.match(missing.text, /no project board "Nowhere Ltd"/);
});

test("project_delete refuses a board holding only finished tasks", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const add = await c.call("task_add", { project: "Acme App", title: "Ship v2" });
  const id = add.text.split(/\s+/)[0];
  const done = await c.call("task_done", { id });
  assert.equal(done.isError, false, done.text);

  const refused = await c.call("project_delete", { project: "Acme App" });
  assert.equal(refused.isError, true, refused.text);
  assert.match(refused.text, new RegExp(`still holds 1 task\\(s\\), 0 open and 1 done.*${id}`));
  const list = await c.call("project_list", {});
  assert.match(list.text, /Acme App/);
});
