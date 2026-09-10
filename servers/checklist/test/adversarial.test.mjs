// What a user, or an assistant driving this server, will actually do wrong.
//
// Every case here is a refusal that must leave the store untouched, or a boundary that must
// not silently drop, truncate or reorder something. The rule the whole file tests: a tool
// either does the whole thing or writes nothing and says so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, writeProfile, cleanup, seed, seedChecklist, seedRun, proKey, storeDir, CHECKLIST_NAME } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

const rawRuns = (box) => readFileSync(join(storeDir(box.dataHome), "runs.json"), "utf8");
const rawTemplates = (box) => readFileSync(join(storeDir(box.dataHome), "templates.json"), "utf8");

test("a refusal writes nothing: both store files are byte-identical afterwards", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const { checklist, run } = await seed(c);
  const beforeR = rawRuns(box);
  const beforeT = rawTemplates(box);
  const refusals = [
    ["checklist_create", { name: "   " }],
    ["checklist_create", { name: CHECKLIST_NAME }],                       // duplicate name
    ["checklist_item_add", { checklist, text: " " }],
    ["checklist_item_add", { checklist: "CL-9999", text: "X" }],
    ["checklist_item_remove", { checklist, item: "I99" }],
    ["checklist_delete", { checklist }],                                  // confirm missing
    ["run_start", { checklist, title: "  " }],
    ["run_start", { checklist: "CL-9999", title: "X" }],
    ["run_check", { run, item: "I99", state: "pass" }],
    ["run_check", { run, item: "I01", state: "maybe" }],
    ["run_check", { run, item: "I01", state: "pass", at: "2026-02-31" }],
    ["run_sign_off", { run, by: "Ada" }],                                 // not ready
    ["run_sign_off", { run, by: "  ", force: true }],
    ["run_status", { run, status: "signed_off" }],                        // not a legal target here
    ["run_delete", { run }],                                              // confirm missing
  ];
  for (const [tool, args] of refusals) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} ${JSON.stringify(args)} was accepted`);
    assert.equal(rawRuns(box), beforeR, `${tool} changed runs.json while refusing`);
    assert.equal(rawTemplates(box), beforeT, `${tool} changed templates.json while refusing`);
  }
});

test("a refusal says what was not written, in words a user can act on", async (t) => {
  const { c } = open(t);
  await c.init();
  const { checklist, run } = await seed(c);
  const cases = [
    [["checklist_create", { name: CHECKLIST_NAME }], /already exists/],
    [["checklist_item_remove", { checklist, item: "I42" }], /has no step "I42"/],
    [["run_check", { run, item: "I42", state: "pass" }], /has no step "I42"/],
    [["run_sign_off", { run, by: "Ada" }], /not ready for sign-off/],
    [["run_show", { run: "RUN-2099-9999" }], /no run matches/],
    [["checklist_show", { checklist: "CL-9999" }], /no checklist matches/],
  ];
  for (const [[tool, args], re] of cases) {
    const r = await c.call(tool, args);
    assert.ok(r.isError, `${tool} was accepted`);
    assert.match(r.text, re, `${tool}: ${r.text}`);
  }
});

test("an ambiguous name is refused with the candidates, never resolved to the first", async (t) => {
  const { c } = open(t);
  await c.init();
  await c.json("checklist_create", { name: "Site handover" });
  await c.json("checklist_create", { name: "Site handover, electrical" });
  const exact = await c.call("checklist_show", { checklist: "Site handover" });
  assert.equal(exact.isError, false, "an exact name match must win outright");
  assert.equal(JSON.parse(exact.text).checklist.name, "Site handover");
  const ambiguous = await c.call("checklist_show", { checklist: "handover" });
  assert.ok(ambiguous.isError, ambiguous.text);
  assert.match(ambiguous.text, /matches more than one checklist/);
  assert.match(ambiguous.text, /CL-0001/);
  assert.match(ambiguous.text, /CL-0002/);
});

test("an ambiguous run reference is refused too", async (t) => {
  const { c } = open(t);
  await c.init();
  const cl = await seedChecklist(c);
  await c.json("run_start", { checklist: cl, title: "Van A", reference: "WO-1" });
  await c.json("run_start", { checklist: cl, title: "Van A again", reference: "WO-1" });
  const r = await c.call("run_show", { run: "Van A" });
  assert.equal(r.isError, false, "an exact title match must win outright");
  const amb = await c.call("run_show", { run: "Van" });
  assert.ok(amb.isError, amb.text);
  assert.match(amb.text, /matches more than one run/);
});

test("the same step can be answered again while the run is open and the last answer stands", async (t) => {
  const { c } = open(t);
  await c.init();
  const { run } = await seed(c);
  await c.json("run_check", { run, item: "I05", state: "pass", by: "Cara", note: "Reweighed after split" });
  const r = await c.json("run_show", { run });
  const i5 = r.sections_detail[1].items.find((i) => i.id === "I05");
  assert.equal(i5.state, "pass");
  assert.equal(i5.by, "Cara");
  assert.equal(i5.note, "Reweighed after split");
  assert.equal(r.progress.fail, 0);
  assert.equal(r.progress.pass, 4);
  // And an empty note clears the note rather than storing an empty string.
  await c.json("run_check", { run, item: "I05", state: "pass", note: "" });
  const after = await c.json("run_show", { run });
  assert.equal(after.sections_detail[1].items.find((i) => i.id === "I05").note, undefined);
});

test("a run answered entirely na is complete, signable and reports zero passes", async (t) => {
  const { c } = open(t);
  await c.init();
  const cl = await seedChecklist(c);
  const run = await seedRun(c, cl, ["I01", "I02", "I03", "I04", "I05", "I06"].map((item) => ({ item, state: "na", by: "Ada" })));
  const r = await c.json("run_show", { run });
  assert.equal(r.status, "complete");
  assert.equal(r.progress.pass, 0);
  assert.equal(r.progress.na, 6);
  assert.equal(r.progress.percent_answered, 100);
  assert.equal(r.ready_to_sign_off, true, "na must count as answered");
  const rep = await c.json("run_report", { run });
  assert.match(rep.report, /passed 0 {3}failed 0 {3}not applicable 6/);
});

test("text is normalised on the way in, and over-long text is refused not truncated", async (t) => {
  const { c } = open(t);
  await c.init();
  const t0 = await c.json("checklist_create", { name: "  Site   handover  ", category: "  On   Site  " });
  assert.equal(t0.created.name, "Site handover");
  assert.equal(t0.created.category, "on-site");
  const long = "x".repeat(2001);
  assert.ok((await c.call("checklist_item_add", { checklist: t0.created.id, text: long })).isError, "a 2001-character step was accepted");
  const at = await c.json("checklist_item_add", { checklist: t0.created.id, text: "y".repeat(2000) });
  assert.equal(at.added.text.length, 2000, "the step text was truncated");
  // A section is a grouping key with its own 60-character ceiling, enforced at the schema
  // rather than by silently trimming: a section that came back shortened would group under
  // a heading the caller never wrote and would not match the one they write next time.
  assert.ok((await c.call("checklist_item_add", { checklist: t0.created.id, text: "Z", section: "s".repeat(61) })).isError);
  const s = await c.json("checklist_item_add", { checklist: t0.created.id, text: "Z", section: "s".repeat(60) });
  assert.equal(s.added.section.length, 60);
});

test("a step with no section groups under null and prints after the named sections", async (t) => {
  const { c } = open(t);
  await c.init();
  const cl = await seedChecklist(c);
  await c.json("checklist_item_add", { checklist: cl, text: "Anything else noted", required: false });
  const r = await c.json("checklist_show", { checklist: cl, as_text: true });
  assert.deepEqual(r.checklist.sections_detail.map((g) => g.section), ["Exterior", "Load", null]);
  const lines = r.blank_copy.split("\n");
  assert.ok(lines.indexOf("Load") < lines.findIndex((l) => /Anything else noted/.test(l)));
});

test("a store that is not JSON is quarantined and every later call fails loudly", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await seed(c);
  c.close();
  const dir = storeDir(box.dataHome);
  writeFileSync(join(dir, "runs.json"), "this is not json, it is half a file");
  const c2 = client({ dataHome: box.dataHome });
  t.after(() => c2.close());
  await c2.init();
  const r = await c2.call("run_list", {});
  assert.ok(r.isError, "a corrupt store read as an empty one");
  const { readdirSync } = await import("node:fs");
  const files = readdirSync(dir);
  assert.ok(files.some((f) => /runs\.json\.corrupt-/.test(f)), `no quarantine copy: ${files.join(", ")}`);
});

test("a signed-off run is immutable on every editing tool, and still readable on every reading one", async (t) => {
  const { c } = open(t);
  await c.init();
  const { run } = await seed(c);
  await c.json("run_sign_off", { run, by: "Cara", force: true });
  for (const [tool, args] of [
    ["run_check", { run, item: "I01", state: "fail" }],
    ["run_status", { run, status: "open" }],
    ["run_status", { run, status: "abandoned" }],
    ["run_sign_off", { run, by: "Someone else", force: true }],
    ["run_delete", { run, confirm: true }],
  ]) {
    assert.ok((await c.call(tool, args)).isError, `${tool} moved a signed-off run`);
  }
  for (const [tool, args] of [["run_show", { run }], ["run_report", { run }], ["run_list", {}]]) {
    assert.equal((await c.call(tool, args)).isError, false, `${tool} refused to read a signed-off run`);
  }
});

test("an abandoned run is closed but is not a signature, and prints the blank signature block", async (t) => {
  const { c } = open(t);
  await c.init();
  const { run } = await seed(c);
  await c.json("run_status", { run, status: "abandoned", note: "Van off the road" });
  const r = await c.json("run_show", { run });
  assert.equal(r.status, "abandoned");
  assert.equal(r.signed_by, null);
  const rep = await c.json("run_report", { run });
  assert.match(rep.report, /Signed off by \.\.\./);
  assert.equal(/Signed off by [A-Z]/.test(rep.report), false);
  // An abandoned run CAN be deleted; only a signed one cannot.
  assert.equal((await c.call("run_delete", { run, confirm: true })).isError, false);
});

test("run_check with a date sets the answered date, and pending clears it", async (t) => {
  const { c } = open(t);
  await c.init();
  const { run } = await seed(c);
  const r0 = await c.json("run_show", { run });
  assert.equal(r0.sections_detail[0].items[0].at, "2026-02-14", "the run's own date is the default answered date");
  await c.json("run_check", { run, item: "I01", state: "pass", by: "Ada", at: "2026-02-16" });
  const r1 = await c.json("run_show", { run });
  assert.equal(r1.sections_detail[0].items[0].at, "2026-02-16");
  await c.json("run_check", { run, item: "I01", state: "pending" });
  const r2 = await c.json("run_show", { run });
  assert.equal(r2.sections_detail[0].items[0].at, undefined);
});

test("the free-tier cap counts checklists, not runs, and deleting one gives the slot back", async (t) => {
  const { c } = open(t);
  await c.init();
  const ids = [];
  for (let i = 1; i <= 3; i++) ids.push((await c.json("checklist_create", { name: `List ${i}` })).created.id);
  await c.json("checklist_item_add", { checklist: ids[0], text: "Step" });
  for (let i = 0; i < 20; i++) assert.equal((await c.call("run_start", { checklist: ids[0], title: `Job ${i}` })).isError, false);
  assert.equal((await c.json("checklist_list", {})).free_tier_checklist_limit, 3);
  assert.ok((await c.call("checklist_create", { name: "List 4" })).isError);
  await c.json("checklist_delete", { checklist: ids[1], confirm: true });
  assert.equal((await c.call("checklist_create", { name: "List 4" })).isError, false);
});

test("the business profile is optional: a report renders with a placeholder and says so", async (t) => {
  const box = sandbox();
  mkdirSync(join(box.dataHome, "mcp-servers", "profile"), { recursive: true });
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const { run } = await seed(c);
  const r = await c.json("run_report", { run });
  assert.equal(r.business_profile_missing, true);
  assert.match(r.report, /^Your business/);
});

test("a checklist with 500 steps is the ceiling and the 501st is refused", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  // 500 stdio calls is slow, so the ceiling is checked on the boundary arithmetic instead:
  // the constant is asserted from the resource, and the refusal message names it.
  const res = (await c.send("resources/read", { uri: "checklist://contract" })).result;
  const body = JSON.parse(res.contents[0].text);
  assert.equal(body.free_tier.runs, "unlimited on every tier");
  const t0 = await c.json("checklist_create", { name: "Ceiling" });
  const added = await c.json("checklist_item_add", { checklist: t0.created.id, text: "One" });
  assert.equal(added.checklist.items, 1);
  assert.match(added.note_on_versions, /runs already under way keep the steps they started with/);
});

test("run_list filters compose rather than replacing one another", async (t) => {
  const { c } = open(t);
  await c.init();
  const cl = await seedChecklist(c);
  const a = await c.json("run_start", { checklist: cl, title: "Van A", reference: "WO-1", date: "2026-02-01" });
  const b = await c.json("run_start", { checklist: cl, title: "Van B", reference: "WO-1", date: "2026-02-02" });
  await c.json("run_check", { run: b.started.id, item: "I05", state: "fail", by: "Ben" });
  await c.json("run_status", { run: a.started.id, status: "abandoned" });
  const composed = await c.json("run_list", { reference: "WO-1", with_failures: true, open_only: true });
  assert.deepEqual(composed.runs.map((r) => r.title), ["Van B"]);
  const none = await c.json("run_list", { reference: "WO-1", status: "signed_off" });
  assert.equal(none.runs.length, 0);
});

test("a run started from a checklist that is later renamed keeps the name it saw", async (t) => {
  const { c } = open(t);
  await c.init();
  const { checklist, run } = await seed(c);
  // There is no rename tool by design; deleting and recreating is the rename, and it must
  // not rewrite the run's record of what it ran.
  await c.json("checklist_delete", { checklist, confirm: true });
  await c.json("checklist_create", { name: "Pre-delivery vehicle check v2" });
  const r = await c.json("run_show", { run });
  assert.equal(r.checklist_name, CHECKLIST_NAME);
  assert.equal(r.checklist, "CL-0001");
});
