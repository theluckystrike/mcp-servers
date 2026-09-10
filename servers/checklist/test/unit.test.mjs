// The behaviour, against the worked checklist and run in _client.mjs. Every count here was
// worked out by hand in that file's header before the code was written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, writeProfile, cleanup, seed, seedChecklist, seedRun, proKey, ITEMS, CHECKLIST_NAME, RUN_REFERENCE } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

test("a checklist keeps its steps in order, grouped by section, with the required flag", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seedChecklist(c);
  assert.equal(id, "CL-0001");
  const r = await c.json("checklist_show", { checklist: id });
  assert.equal(r.checklist.items, 6);
  assert.equal(r.checklist.required, 4);
  assert.equal(r.checklist.sections, 2);
  assert.equal(r.checklist.category, "pre-delivery");
  assert.deepEqual(r.checklist.sections_detail.map((g) => g.section), ["Exterior", "Load"]);
  assert.deepEqual(r.checklist.sections_detail[0].items.map((i) => i.id), ["I01", "I02", "I03"]);
  assert.deepEqual(r.checklist.sections_detail[1].items.map((i) => i.id), ["I04", "I05", "I06"]);
  // The version starts at 1 and bumps once per item.
  assert.equal(r.checklist.version, 1 + ITEMS.length);
});

test("progress counts na as answered and never as passed", async (t) => {
  const { c } = open(t);
  await c.init();
  const { run } = await seed(c);
  const r = await c.json("run_show", { run });
  assert.equal(r.progress.items, 6);
  assert.equal(r.progress.pass, 3);
  assert.equal(r.progress.fail, 1);
  assert.equal(r.progress.na, 1);
  assert.equal(r.progress.pending, 1);
  assert.equal(r.progress.answered, 5);
  assert.equal(r.progress.percent_answered, 83.3);
  assert.equal(r.progress.required, 4);
  assert.equal(r.progress.required_pending, 0);
  assert.equal(r.progress.required_fail, 1);
});

test("a failed required step and an unanswered optional one both block sign-off, and both are named", async (t) => {
  const { c } = open(t);
  await c.init();
  const { run } = await seed(c);
  const r = await c.json("run_show", { run });
  assert.equal(r.ready_to_sign_off, false);
  assert.equal(r.not_ready_because.length, 2);
  assert.ok(r.not_ready_because.some((x) => /1 required item\(s\) failed/.test(x)), JSON.stringify(r.not_ready_because));
  assert.ok(r.not_ready_because.some((x) => /1 optional item\(s\) not answered/.test(x)), JSON.stringify(r.not_ready_because));
  const refused = await c.call("run_sign_off", { run, by: "Ada" });
  assert.ok(refused.isError, refused.text);
  assert.match(refused.text, /not ready for sign-off/);
});

test("complete is derived: it appears when the last step is answered and goes when one is reopened", async (t) => {
  const { c } = open(t);
  await c.init();
  const { run } = await seed(c);
  let r = await c.json("run_show", { run });
  assert.equal(r.status, "open");
  await c.json("run_check", { run, item: "I06", state: "pass", by: "Ben" });
  r = await c.json("run_show", { run });
  assert.equal(r.status, "complete");
  assert.deepEqual(r.history.map((h) => h.status), ["open", "complete"]);
  await c.json("run_check", { run, item: "I06", state: "pending" });
  r = await c.json("run_show", { run });
  assert.equal(r.status, "open");
  assert.deepEqual(r.history.map((h) => h.status), ["open", "complete", "open"]);
  const item = r.sections_detail[1].items.find((i) => i.id === "I06");
  assert.equal(item.state, "pending");
  assert.equal(item.by, undefined, "setting a step back to pending must clear who answered it");
  assert.equal(item.at, undefined);
});

test("a run snapshots its checklist: editing the checklist afterwards changes nothing", async (t) => {
  const { c } = open(t);
  await c.init();
  const cl = await seedChecklist(c);
  const run = await seedRun(c, cl);
  const before = await c.json("run_show", { run });
  assert.equal(before.checklist_version, 7);
  // Add a step and delete another one, then rename nothing and check the run is untouched.
  await c.json("checklist_item_add", { checklist: cl, text: "Fuel card in cab", section: "Load", required: true });
  await c.json("checklist_item_remove", { checklist: cl, item: "I01" });
  const tmpl = await c.json("checklist_show", { checklist: cl });
  assert.equal(tmpl.checklist.items, 6);
  assert.equal(tmpl.checklist.version, 9);
  const after = await c.json("run_show", { run });
  assert.equal(after.progress.items, 6, "the run gained or lost a step when the checklist changed");
  assert.equal(after.checklist_version, 7, "the run's recorded checklist version moved");
  assert.deepEqual(after.sections_detail.flatMap((g) => g.items.map((i) => i.id)), ["I01", "I02", "I03", "I04", "I05", "I06"]);
  assert.equal(after.progress.pass, 3);
  // A run started NOW does get the new list.
  const fresh = await c.json("run_start", { checklist: cl, title: "Van CX22 LMN" });
  assert.equal(fresh.started.items, 6);
  assert.equal(fresh.started.checklist_version, 9);
  assert.deepEqual(fresh.steps.map((i) => i.text).filter((x) => /Fuel card/.test(x)), ["Fuel card in cab"]);
  assert.equal(fresh.steps.some((i) => /Tyre pressures/.test(i.text)), false);
});

test("deleting a checklist leaves its runs readable and complete", async (t) => {
  const { c } = open(t);
  await c.init();
  const { checklist, run } = await seed(c);
  const d = await c.json("checklist_delete", { checklist, confirm: true });
  assert.equal(d.runs_kept, 1);
  const r = await c.json("run_show", { run });
  assert.equal(r.progress.items, 6);
  assert.equal(r.checklist_name, CHECKLIST_NAME, "the run lost the name of the checklist it came from");
  assert.equal(r.progress.pass, 3);
});

test("sign-off freezes a run, and force keeps the exceptions on the record", async (t) => {
  const { c } = open(t);
  await c.init();
  const { run } = await seed(c);
  await c.json("run_check", { run, item: "I06", state: "pass", by: "Ben" });
  const forced = await c.json("run_sign_off", { run, by: "Cara Nowak", date: "2026-02-15", note: "Overweight accepted, load split", force: true });
  assert.equal(forced.run.status, "signed_off");
  assert.equal(forced.run.signed_by, "Cara Nowak");
  assert.equal(forced.run.signed_date, "2026-02-15");
  assert.equal(forced.signed_with_exceptions.length, 1);
  assert.match(forced.signed_with_exceptions[0], /required item\(s\) failed/);
  for (const [tool, args] of [
    ["run_check", { run, item: "I01", state: "fail" }],
    ["run_status", { run, status: "open" }],
    ["run_delete", { run, confirm: true }],
    ["run_sign_off", { run, by: "Someone else" }],
  ]) {
    const r = await c.call(tool, args);
    assert.ok(r.isError, `${tool} moved a signed-off run`);
  }
  const rep = await c.json("run_report", { run });
  assert.match(rep.report, /Signed off by Cara Nowak on 2026-02-15/);
  assert.match(rep.report, /Signed with exceptions:/);
  assert.match(rep.report, /Overweight accepted, load split/);
});

test("a clean run signs off without force and prints no exceptions", async (t) => {
  const { c } = open(t);
  await c.init();
  const cl = await seedChecklist(c);
  const run = await seedRun(c, cl, [
    { item: "I01", state: "pass", by: "Ada" }, { item: "I02", state: "pass", by: "Ada" },
    { item: "I03", state: "pass", by: "Ada" }, { item: "I04", state: "pass", by: "Ben" },
    { item: "I05", state: "pass", by: "Ben" }, { item: "I06", state: "na", by: "Ben" },
  ]);
  const show = await c.json("run_show", { run });
  assert.equal(show.status, "complete");
  assert.equal(show.ready_to_sign_off, true);
  assert.deepEqual(show.not_ready_because, []);
  const s = await c.json("run_sign_off", { run, by: "Cara Nowak", date: "2026-02-15" });
  assert.deepEqual(s.signed_with_exceptions, []);
  const rep = await c.json("run_report", { run });
  assert.equal(/Signed with exceptions/.test(rep.report), false);
  assert.equal(/Not ready for sign-off/.test(rep.report), false);
});

test("the report marks each state distinctly and carries the notes and the names", async (t) => {
  const { c } = open(t);
  await c.init();
  const { run } = await seed(c);
  const r = await c.json("run_report", { run });
  assert.equal(r.written, false);
  const s = r.report;
  assert.match(s, /Nova Studio/);
  assert.match(s, /CHECKLIST {2}RUN-2026-0001/);
  assert.match(s, /Against {5}: WO-2026-0044/);
  assert.match(s, /\[x\] I01 Tyre pressures checked and recorded {2}Ada 2026-02-14/);
  assert.match(s, /\[!\] I05 Weight within plated limit/);
  assert.match(s, /note: Plated 3500 kg, weighed 3620 kg/);
  assert.match(s, /\[-\] I03 Bodywork photographed {2}\(optional\)/);
  assert.match(s, /\[ \] I06 Spare strap in cab {2}\(optional\)/);
  assert.match(s, /Answered 83\.3 percent\. Not applicable counts as answered and never as passed\./);
  assert.match(s, /Not ready for sign-off:/);
  assert.match(s, /Signed off by \.\.\./);
});

test("run_status reopens a complete run and abandons an open one", async (t) => {
  const { c } = open(t);
  await c.init();
  const { run } = await seed(c);
  const reopened = await c.call("run_status", { run, status: "open" });
  assert.ok(reopened.isError, "an already-open run must refuse a move to open");
  await c.json("run_check", { run, item: "I06", state: "pass" });
  const back = await c.json("run_status", { run, status: "open", date: "2026-02-16", note: "Recheck the strap" });
  assert.equal(back.run.status, "open");
  const gone = await c.json("run_status", { run, status: "abandoned", date: "2026-02-17", note: "Van off the road" });
  assert.equal(gone.run.status, "abandoned");
  assert.equal(gone.run.open, false);
  const edit = await c.call("run_check", { run, item: "I01", state: "fail" });
  assert.ok(edit.isError, edit.text);
});

test("runs are listed newest first and filter by checklist, reference, status and failures", async (t) => {
  const { c } = open(t);
  await c.init();
  const cl = await seedChecklist(c);
  await c.json("run_start", { checklist: cl, title: "Van A", reference: "WO-1", date: "2026-02-01" });
  const b = await c.json("run_start", { checklist: cl, title: "Van B", reference: "WO-2", date: "2026-02-05" });
  await c.json("run_check", { run: b.started.id, item: "I05", state: "fail", by: "Ben", note: "Overweight" });
  const all = await c.json("run_list", {});
  assert.deepEqual(all.runs.map((r) => r.title), ["Van B", "Van A"]);
  assert.equal((await c.json("run_list", { reference: "WO-2" })).runs.length, 1);
  assert.equal((await c.json("run_list", { with_failures: true })).runs.length, 1);
  assert.equal((await c.json("run_list", { status: "open" })).runs.length, 2);
  assert.equal((await c.json("run_list", { checklist: cl })).runs.length, 2);
  assert.equal((await c.json("run_list", { status: "signed_off" })).runs.length, 0);
});

test("a step can be inserted at a position and existing ids do not move", async (t) => {
  const { c } = open(t);
  await c.init();
  const cl = await seedChecklist(c);
  const r = await c.json("checklist_item_add", { checklist: cl, text: "Keys accounted for", section: "Exterior", position: 1 });
  assert.equal(r.added.id, "I07", "inserting must not renumber the steps already there");
  const show = await c.json("checklist_show", { checklist: cl });
  assert.deepEqual(show.checklist.sections_detail[0].items.map((i) => i.id), ["I07", "I01", "I02", "I03"]);
});

test("the free tier holds three checklists and never caps runs", async (t) => {
  const { c } = open(t);
  await c.init();
  const ids = [];
  for (let i = 1; i <= 3; i++) ids.push(await seedChecklist(c, `List ${i}`));
  const fourth = await c.call("checklist_create", { name: "List 4" });
  assert.ok(fourth.isError, fourth.text);
  assert.match(fourth.text, /free tier holds 3 checklists/);
  assert.match(fourth.text, /mcp\.zovo\.one\/buy\/checklist\?src=checklist\.checklist_create/);
  // Runs are not capped: twelve of them on the free tier.
  for (let i = 0; i < 12; i++) {
    const r = await c.call("run_start", { checklist: ids[0], title: `Job ${i}` });
    assert.equal(r.isError, false, r.text);
  }
  assert.equal((await c.json("run_list", {})).total, 12);
  // Deleting a checklist gives the slot back.
  await c.json("checklist_delete", { checklist: ids[2], confirm: true });
  assert.equal((await c.call("checklist_create", { name: "List 4" })).isError, false);
});

test("pro lifts the checklist cap and writes the report to a file", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  await c.init();
  for (let i = 1; i <= 5; i++) {
    const r = await c.call("checklist_create", { name: `List ${i}` });
    assert.ok(!r.isError, r.text);
  }
  const cl = await seedChecklist(c, "Worked list");
  const run = await seedRun(c, cl);
  const out = `${box.dir}/reports/one.txt`;
  const w = await c.json("run_report", { run, out_path: out });
  assert.equal(w.written, true);
  assert.equal(w.path, out);
  const { readFileSync } = await import("node:fs");
  assert.match(readFileSync(out, "utf8"), /CHECKLIST {2}RUN-/);
});

test("a blank printable copy comes back on request and carries a box against every step", async (t) => {
  const { c } = open(t);
  await c.init();
  const cl = await seedChecklist(c);
  const r = await c.json("checklist_show", { checklist: cl, as_text: true });
  assert.match(r.blank_copy, /CHECKLIST {2}Pre-delivery vehicle check {2}\(pre-delivery, v7\)/);
  assert.match(r.blank_copy, /Run before every van leaves the yard\./);
  assert.equal((r.blank_copy.match(/\[ \]/g) ?? []).length, 6);
  assert.match(r.blank_copy, /6 item\(s\), 4 required\./);
});
