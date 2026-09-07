// Adversarial suite: the ways a delivery schedule gets a plausible wrong answer.
//
// Each test drives one refusal that has to happen and checks that nothing was written
// when it did. A plausible wrong answer here goes onto an invoice or into an argument
// with a client, so a refusal that names what is wrong is worth more than an answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  client, sandbox, cleanup, proKey, storeDir, writeProfile, seed,
  REFERENCE, REFERENCE_DATE, CLIENT, CREATE, AS_OF_LATE,
} from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

const store = (box) => JSON.parse(readFileSync(join(storeDir(box.dataHome), "schedules.json"), "utf8"));

/* ------------------------------------------------- impossible status moves */

test("accepting a deliverable that was never delivered is refused by name", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const s = await c.json("delivery_schedule_create", CREATE);
  await c.call("deliverable_add", { schedule: s.created.id, description: "Wireframes", due_date: "2026-04-10", value_minor: 90000 });

  const r = await c.call("deliverable_status", { schedule: s.created.id, deliverable: "D01", status: "accepted", date: "2026-04-11" });
  assert.equal(r.isError, true, "a deliverable was accepted without ever being delivered");
  assert.match(r.text, /is planned and has not been delivered/);
  assert.match(r.text, /Acceptance is the client's answer to a handover/);
  assert.match(r.text, /Nothing was written/);
  assert.equal(store(box)[0].deliverables[0].history.length, 0, "a refused move left an event on the record");

  // The same refusal from in progress, which is the one somebody actually hits.
  await c.call("deliverable_status", { schedule: s.created.id, deliverable: "D01", status: "in_progress", date: "2026-04-02" });
  const r2 = await c.call("deliverable_status", { schedule: s.created.id, deliverable: "D01", status: "accepted", date: "2026-04-11" });
  assert.equal(r2.isError, true);
  assert.match(r2.text, /is in progress and has not been delivered/);
  assert.equal(store(box)[0].deliverables[0].history.length, 1);
});

test("a deliverable does not go backwards, and accepted is final", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const id = await seed(c);

  const back = await c.call("deliverable_status", { schedule: id, deliverable: "D01", status: "in_progress", date: "2026-05-01" });
  assert.equal(back.isError, true);
  assert.match(back.text, /is accepted, which is final/);
  assert.match(back.text, /a new deliverable with its own due date/);

  const backD03 = await c.call("deliverable_status", { schedule: id, deliverable: "D03", status: "in_progress", date: "2026-05-02" });
  assert.equal(backD03.isError, true);
  assert.match(backD03.text, /is already in progress/);

  await c.call("deliverable_status", { schedule: id, deliverable: "D03", status: "delivered", date: "2026-05-06" });
  const undo = await c.call("deliverable_status", { schedule: id, deliverable: "D03", status: "in_progress", date: "2026-05-07" });
  assert.equal(undo.isError, true);
  assert.match(undo.text, /work that has been handed over does not go back to in progress/);
  const d03 = store(box)[0].deliverables[2];
  assert.deepEqual(d03.history.map((h) => h.to), ["in_progress", "delivered"]);
});

/* --------------------------------------------------------- the date floors */

test("a delivery dated before the reference document's own date is refused", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const s = await c.json("delivery_schedule_create", CREATE);
  assert.equal(s.created.reference_date, REFERENCE_DATE);
  await c.call("deliverable_add", { schedule: s.created.id, description: "Wireframes", due_date: "2026-04-10", value_minor: 90000 });

  const r = await c.call("deliverable_status", { schedule: s.created.id, deliverable: "D01", status: "delivered", date: "2026-03-28" });
  assert.equal(r.isError, true, "work was delivered four days before the work order that ordered it");
  assert.match(r.text, /WO-2026-0011 dated 2026-04-01, and this move is dated 2026-03-28, before it/);
  assert.match(r.text, /before the document that ordered it exists/);
  assert.equal(store(box)[0].deliverables[0].history.length, 0);

  // The floor is the reference date, so the reference date itself is allowed.
  const onDay = await c.call("deliverable_status", { schedule: s.created.id, deliverable: "D01", status: "delivered", date: REFERENCE_DATE });
  assert.equal(onDay.isError, false, onDay.text);
});

test("a due date before the reference document's own date is refused", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const s = await c.json("delivery_schedule_create", CREATE);
  const r = await c.call("deliverable_add", { schedule: s.created.id, description: "Kickoff notes", due_date: "2026-03-31", value_minor: 1000 });
  assert.equal(r.isError, true);
  assert.match(r.text, /due 2026-03-31, before it/);
  assert.match(r.text, /Nothing can be owed before the document that ordered it exists/);
  assert.equal(store(box)[0].deliverables.length, 0, "a refused deliverable was written anyway");
});

test("a status history that runs backwards is refused, so every late reading stays readable", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const s = await c.json("delivery_schedule_create", CREATE);
  await c.call("deliverable_add", { schedule: s.created.id, description: "Wireframes", due_date: "2026-04-10", value_minor: 90000 });
  await c.call("deliverable_status", { schedule: s.created.id, deliverable: "D01", status: "delivered", date: "2026-04-09" });

  const r = await c.call("deliverable_status", { schedule: s.created.id, deliverable: "D01", status: "accepted", date: "2026-04-08" });
  assert.equal(r.isError, true, "a deliverable was accepted the day before it was delivered");
  assert.match(r.text, /reached delivered on 2026-04-09 and this move is dated 2026-04-08, before it/);
  assert.match(r.text, /cannot be read as a timeline/);
  assert.equal(store(box)[0].deliverables[0].history.length, 1);

  // Accepted on the same day as delivered is a real thing and is allowed.
  const same = await c.call("deliverable_status", { schedule: s.created.id, deliverable: "D01", status: "accepted", date: "2026-04-09" });
  assert.equal(same.isError, false, same.text);
  const g = await c.json("delivery_schedule_get", { schedule: s.created.id, as_of: "2026-04-09" });
  assert.equal(g.schedule.deliverables[0].status, "accepted", "two moves on one day read in the order they were made");
});

test("a date that is not a date is refused before anything is written", async (t) => {
  const { box, c } = open(t);
  await c.init();
  for (const [tool, args] of [
    ["delivery_schedule_create", { ...CREATE, reference_date: "2026-02-30" }],
    ["delivery_schedule_create", { ...CREATE, reference: "Q-1", reference_date: "01/04/2026" }],
  ]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} took ${args.reference_date}`);
    assert.match(r.text, /is not a real date in YYYY-MM-DD form/);
  }
  const s = await c.json("delivery_schedule_create", CREATE);
  const bad = await c.call("deliverable_add", { schedule: s.created.id, description: "X", due_date: "2026-13-01" });
  assert.equal(bad.isError, true);
  assert.match(bad.text, /due_date "2026-13-01" is not a real date/);
  const rep = await c.call("late_report", { as_of: "yesterday" });
  assert.equal(rep.isError, true);
  assert.match(rep.text, /as_of "yesterday" is not a real date/);
  assert.equal(store(box)[0].deliverables.length, 0);
});

/* -------------------------------------------------------- honest lists */

test("a capped list says how many rows it left out, and never presents itself as complete", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const s = await c.json("delivery_schedule_create", CREATE);
  for (let i = 1; i <= 12; i++) {
    const r = await c.call("deliverable_add", { schedule: s.created.id, description: `Milestone ${i}`, due_date: "2026-04-10", value_minor: 1000 * i });
    assert.equal(r.isError, false, r.text);
  }
  const full = await c.json("late_report", { as_of: AS_OF_LATE });
  assert.equal(full.late_count, 12);
  assert.equal(full.late.length, 12);
  assert.equal(full.truncated, false);
  assert.equal(full.rows_not_shown, 0);

  const cut = await c.json("late_report", { as_of: AS_OF_LATE, limit: 5 });
  assert.equal(cut.late_count, 12, "the COUNT stays complete even when the rows are cut");
  assert.equal(cut.late.length, 5);
  assert.equal(cut.truncated, true, "a cut list reported itself as complete");
  assert.equal(cut.rows_not_shown, 7);
  assert.match(cut.notes.join(" "), /7 row\(s\) matched and are NOT in this answer/);
  assert.match(cut.notes.join(" "), /The counts above every section are complete; only the rows are cut/);

  const list = await c.json("delivery_schedule_list", { limit: 1 });
  assert.equal(list.truncated, false, "one schedule and a limit of one is not a truncation");
  assert.equal(list.truncation, null);
});

test("a section left out on purpose is counted and said out loud", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  const off = await c.json("late_report", { as_of: AS_OF_LATE, include_delivered_late: false });
  assert.equal(off.delivered_late_count, 1, "the count must survive the caller switching the section off");
  assert.equal(off.delivered_late.length, 0);
  assert.match(off.notes.join(" "), /1 deliverable\(s\) were handed over after their due date and are not listed/);
});

test("late rows that carry no value say so rather than being summed as zero", async (t) => {
  const { c } = open(t);
  await c.init();
  const s = await c.json("delivery_schedule_create", CREATE);
  await c.call("deliverable_add", { schedule: s.created.id, description: "Priced", due_date: "2026-04-10", value_minor: 90000 });
  await c.call("deliverable_add", { schedule: s.created.id, description: "Unpriced", due_date: "2026-04-10" });
  const r = await c.json("late_report", { as_of: AS_OF_LATE });
  assert.equal(r.late_count, 2);
  assert.deepEqual(r.value_at_risk, [{ currency: "EUR", deliverables: 2, priced: 1, unpriced: 1, value_minor: 90000, value: "EUR 900.00" }]);
  assert.match(r.notes.join(" "), /1 late deliverable\(s\) carry no value and are counted apart rather than added in as zero/);
  assert.match(r.notes.join(" "), /understates what is at stake/);
});

/* --------------------------------------------------------------- the store */

test("one reference carries one schedule, and the refusal names the one on file", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await c.call("delivery_schedule_create", CREATE);
  const again = await c.call("delivery_schedule_create", { ...CREATE, title: "Website rebuild again" });
  assert.equal(again.isError, true);
  assert.match(again.text, /WO-2026-0011 already has a delivery schedule: DS-2026-0001/);
  assert.match(again.text, /two would give two answers to what is late on it/);
  assert.equal(store(box).length, 1);
});

test("the same deliverable due on the same day is refused unless it is really two", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const s = await c.json("delivery_schedule_create", CREATE);
  await c.call("deliverable_add", { schedule: s.created.id, description: "Wireframes", due_date: "2026-04-10", value_minor: 90000 });
  const twin = await c.call("deliverable_add", { schedule: s.created.id, description: "  wireframes ", due_date: "2026-04-10", value_minor: 90000 });
  assert.equal(twin.isError, true);
  assert.match(twin.text, /already carries D01/);
  assert.match(twin.text, /count the same miss twice/);
  assert.equal(store(box)[0].deliverables.length, 1);

  const forced = await c.call("deliverable_add", { schedule: s.created.id, description: "Wireframes", due_date: "2026-04-10", value_minor: 90000, duplicate_ok: true });
  assert.equal(forced.isError, false, forced.text);
  assert.equal(store(box)[0].deliverables.length, 2);
});

test("nothing with a history can be deleted, and the id is not reissued", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const id = await seed(c);
  const kept = await c.call("deliverable_delete", { schedule: id, deliverable: "D01" });
  assert.equal(kept.isError, true);
  assert.match(kept.text, /is accepted since 2026-04-12 and cannot be deleted/);
  assert.match(kept.text, /would take a delivery off the books/);

  const notEmpty = await c.call("delivery_schedule_delete", { schedule: id });
  assert.equal(notEmpty.isError, true);
  assert.match(notEmpty.text, /carries 4 deliverable\(s\)/);

  const gone = await c.call("deliverable_delete", { schedule: id, deliverable: "D04" });
  assert.equal(gone.isError, false, gone.text);
  const next = await c.json("deliverable_add", { schedule: id, description: "Replacement training", due_date: "2026-05-08" });
  assert.equal(next.added.id, "D05", "a deleted id must not come back on the next deliverable");
  assert.equal(store(box)[0].deliverables.length, 4);
});

test("a store that is not JSON is quarantined, not read as an empty schedule list", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await seed(c);
  writeFileSync(join(storeDir(box.dataHome), "schedules.json"), "{ this is not json");
  const r = await c.call("late_report", { as_of: AS_OF_LATE });
  assert.equal(r.isError, true, "a corrupt store answered 'nothing is late'");
  const files = readdirSync(storeDir(box.dataHome));
  assert.ok(files.some((f) => /schedules\.json\.corrupt-/.test(f)), `no quarantine copy: ${files.join(", ")}`);
  assert.ok(files.includes("schedules.json.corrupt"), `no corrupt marker: ${files.join(", ")}`);
});

/* --------------------------------------------------------------- the tier */

test("the free cap counts OPEN schedules and names every way back that is free", async (t) => {
  const { c } = open(t);
  await c.init();
  for (let i = 1; i <= 3; i++) {
    const r = await c.call("delivery_schedule_create", { reference: `WO-2026-000${i}`, reference_date: REFERENCE_DATE, client: CLIENT, title: `Job ${i}` });
    assert.equal(r.isError, false, r.text);
  }
  const fourth = await c.call("delivery_schedule_create", { reference: "WO-2026-0004", reference_date: REFERENCE_DATE, client: CLIENT, title: "Job 4" });
  assert.equal(fourth.isError, true);
  assert.match(fourth.text, /the free tier holds 3 open delivery schedules and 3 are open/);
  assert.match(fourth.text, /DS-2026-0001 WO-2026-0001/);
  assert.match(fourth.text, /stops counting once every deliverable on it is accepted/);
  assert.match(fourth.text, /Both of those stay free/);
  assert.match(fourth.text, /mcp\.zovo\.one\/buy\/delivery-schedule\?src=delivery-schedule\.delivery_schedule_create/);

  // Completing one gives the slot back without a key and without deleting anything.
  await c.call("deliverable_add", { schedule: "DS-2026-0001", description: "Only deliverable", due_date: "2026-04-10", value_minor: 1000 });
  await c.call("deliverable_status", { schedule: "DS-2026-0001", deliverable: "D01", status: "delivered", date: "2026-04-09" });
  await c.call("deliverable_status", { schedule: "DS-2026-0001", deliverable: "D01", status: "accepted", date: "2026-04-11" });
  const now = await c.call("delivery_schedule_create", { reference: "WO-2026-0004", reference_date: REFERENCE_DATE, client: CLIENT, title: "Job 4" });
  assert.equal(now.isError, false, `the way back under the cap does not work: ${now.text}`);
});

test("the duplicate reference is refused BEFORE the cap, so it never sells an upgrade", async (t) => {
  const { c } = open(t);
  await c.init();
  for (let i = 1; i <= 3; i++) {
    await c.call("delivery_schedule_create", { reference: `WO-2026-000${i}`, reference_date: REFERENCE_DATE, client: CLIENT, title: `Job ${i}` });
  }
  const dupe = await c.call("delivery_schedule_create", { reference: "WO-2026-0001", reference_date: REFERENCE_DATE, client: CLIENT, title: "Job 1 again" });
  assert.equal(dupe.isError, true);
  assert.match(dupe.text, /already has a delivery schedule: DS-2026-0001/);
  assert.equal(/free tier holds/.test(dupe.text), false, "the duplicate refusal sold an upgrade instead of naming the id");
});

test("a report scoped to a reference with no schedule refuses rather than answering 'nothing is late'", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.call("late_report", { as_of: AS_OF_LATE, reference: "WO-2026-9999" });
  assert.equal(r.isError, true, "an unknown reference came back clean");
  assert.match(r.text, /no delivery schedule is on file against "WO-2026-9999"/);
  assert.match(r.text, /Nothing was invented/);
});

test("an empty schedule reports as empty rather than as finished", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const s = await c.json("delivery_schedule_create", CREATE);
  assert.equal(s.created.complete, false);
  const p = await c.call("milestone_payload", { schedule: s.created.id });
  assert.equal(p.isError, true);
  assert.match(p.text, /has no deliverables, so there is no milestone to invoice/);
  const doc = await c.call("delivery_schedule_document", { schedule: s.created.id, as_of: AS_OF_LATE });
  assert.equal(doc.isError, false, doc.text);
  assert.match(doc.text, /none recorded/);
  assert.match(doc.text, /has no deliverables, so the document promises nothing/);
});

test("resolving an ambiguous name refuses with the candidates instead of picking one", async (t) => {
  const { c } = open(t);
  await c.init();
  await c.call("delivery_schedule_create", { reference: "WO-2026-0001", reference_date: REFERENCE_DATE, client: CLIENT, title: "Website rebuild phase one" });
  await c.call("delivery_schedule_create", { reference: "WO-2026-0002", reference_date: REFERENCE_DATE, client: CLIENT, title: "Website rebuild phase two" });
  const r = await c.call("delivery_schedule_get", { schedule: "Website rebuild" });
  assert.equal(r.isError, true);
  assert.match(r.text, /matches more than one schedule/);
  assert.match(r.text, /Pass the exact id/);

  // And a schedule answers to the reference it delivers, which is how people ask.
  const byRef = await c.json("delivery_schedule_get", { schedule: "wo-2026-0002" });
  assert.equal(byRef.schedule.id, "DS-2026-0002");
});

test("Pro tools refuse as an answer, write nothing, and carry the tagged upgrade link", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const id = await seed(c);
  const before = readFileSync(join(storeDir(box.dataHome), "schedules.json"), "utf8");
  for (const tool of ["delivery_schedule_document", "milestone_payload"]) {
    const r = await c.call(tool, { schedule: id, as_of: AS_OF_LATE });
    assert.equal(r.isError, true, `${tool} answered on the free tier`);
    assert.match(r.text, /is Pro. Nothing was written/);
    assert.match(r.text, new RegExp(`src=delivery-schedule\\.${tool}`), `${tool} gate link is untagged`);
  }
  assert.equal(readFileSync(join(storeDir(box.dataHome), "schedules.json"), "utf8"), before, "a refused Pro call changed the store");
});
