// The worked schedule, recomputed by hand and asserted to the minor unit and to the day.
//
// Two assertions carry the suite. The first is that lateness is read against the as_of
// the CALLER passes: the same deliverable is late as at 2026-04-22, due today as at its
// own due date, and delivered late as at 2026-05-05, from one unchanged store. The second
// is the payload: the milestone payload's totals are recomputed from the payload's OWN
// items with servers/invoice's computeTotals, and the quote payload's items are fed into
// the same engine as though their MINOR figure were MAJOR, asserted as exactly 100x.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeTotals } from "@theluckystrike/mcp-invoice/lib";
import {
  client, sandbox, cleanup, proKey, storeDir, writeProfile, seed,
  REFERENCE, REFERENCE_DATE, CLIENT, DELIVERABLES, VALUE_MINOR,
  ACCEPTED_NET_MINOR, ACCEPTED_VAT_MINOR, ACCEPTED_TOTAL_MINOR,
  AS_OF_LATE, AS_OF_EARLIER, AS_OF_DUE_TODAY,
} from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

test("a schedule takes the profile currency, infers the reference kind and starts empty", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("delivery_schedule_create", { reference: "wo-2026-0011", reference_date: REFERENCE_DATE, client: CLIENT, title: "Website rebuild" });
  assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 300));
  assert.equal(r.created.id, "DS-2026-0001");
  assert.equal(r.created.reference, "WO-2026-0011", "a reference is filed upper case, whatever it was typed as");
  assert.equal(r.created.reference_kind, "work_order");
  assert.equal(r.created.currency, "EUR");
  assert.equal(r.created.counts.deliverables, 0);
  assert.equal(r.created.complete, false, "an empty schedule is not a finished one");
  assert.equal(r.created.next_due, null);

  const q = await c.json("delivery_schedule_create", { reference: "Q-2026-0003", reference_date: REFERENCE_DATE, client: CLIENT, title: "Brochure" });
  assert.equal(q.created.reference_kind, "quote");
  assert.equal(q.created.id, "DS-2026-0002");
  const co = await c.json("delivery_schedule_create", { reference: "CO-2026-0001", reference_date: REFERENCE_DATE, client: CLIENT, title: "Extra page" });
  assert.equal(co.created.reference_kind, "change_order", "a CO- reference is a change order");
});

test("THE DELIVERABLES: four are stored with their due dates and their values in minor units", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const r = await c.json("delivery_schedule_get", { schedule: id, as_of: AS_OF_LATE });
  assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 300));
  const ds = r.schedule.deliverables;
  assert.deepEqual(ds.map((d) => d.id), ["D01", "D02", "D03", "D04"]);
  assert.deepEqual(ds.map((d) => d.due_date), DELIVERABLES.map((d) => d.due_date));
  assert.deepEqual(ds.map((d) => d.value_minor), [90000, 47988, 210000, null]);
  assert.deepEqual(ds.map((d) => d.value), ["EUR 900.00", "EUR 479.88", "EUR 2100.00", null]);
  assert.equal(r.schedule.value_minor, VALUE_MINOR, "900.00 + 479.88 + 2100.00 is 3479.88");
  assert.equal(r.schedule.value, "EUR 3479.88");
  assert.equal(r.schedule.unpriced_deliverables, 1, "the training session carries no price and is counted apart");
  assert.equal(r.schedule.priced_deliverables, 3);
});

test("LATE IS READ AGAINST as_of: one store, three dates, three different answers", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);

  // As at 2026-04-22, D02 is owed and its day has gone: it is late by two days, and it
  // has no delivered date yet even though the store already holds one dated 04-24.
  const early = await c.json("delivery_schedule_get", { schedule: id, as_of: AS_OF_EARLIER });
  const e = Object.fromEntries(early.schedule.deliverables.map((d) => [d.id, d]));
  assert.equal(early.as_of, AS_OF_EARLIER);
  assert.equal(early.as_of_source, "call");
  assert.equal(e.D01.status, "accepted");
  assert.equal(e.D01.state, "delivered_on_time");
  assert.equal(e.D02.status, "planned", "nothing had happened to D02 by 2026-04-22");
  assert.equal(e.D02.state, "late");
  assert.equal(e.D02.days_late, 2, "due 2026-04-20, read at 2026-04-22");
  assert.equal(e.D02.delivered_date, null, "a delivery dated after as_of has not happened yet");
  assert.equal(e.D03.status, "planned", "the 04-25 start had not happened by 04-22");
  assert.equal(e.D03.state, "not_yet_due");

  // As at its own due date, D03 is due today. Due today is not late.
  const onDay = await c.json("delivery_schedule_get", { schedule: id, as_of: AS_OF_DUE_TODAY });
  const o = Object.fromEntries(onDay.schedule.deliverables.map((d) => [d.id, d]));
  assert.equal(o.D03.state, "due_today");
  assert.equal(o.D03.days_late, 0);
  assert.equal(o.D03.status, "in_progress");
  assert.equal(onDay.schedule.counts.late, 0, "nothing is late on the day it is due");

  // As at 2026-05-05, D03 is four days late and D02 is on the record as delivered late.
  const late = await c.json("delivery_schedule_get", { schedule: id, as_of: AS_OF_LATE });
  const l = Object.fromEntries(late.schedule.deliverables.map((d) => [d.id, d]));
  assert.equal(l.D02.state, "delivered_late");
  assert.equal(l.D02.days_late, 4, "due 2026-04-20, delivered 2026-04-24");
  assert.equal(l.D02.accepted_date, "2026-04-27");
  assert.equal(l.D02.acceptance_note, "Accepted with two typo fixes noted");
  assert.equal(l.D03.state, "late");
  assert.equal(l.D03.days_late, 4, "due 2026-05-01, read at 2026-05-05");
  assert.equal(l.D04.state, "not_yet_due");
  assert.deepEqual(late.schedule.late.map((x) => x.id), ["D03"]);
  assert.equal(late.schedule.counts.late, 1);
  assert.equal(late.schedule.counts.delivered_late, 1);
  assert.equal(late.schedule.counts.accepted, 2);
  assert.equal(late.schedule.next_due, "2026-05-01", "the earliest day still owed");
});

test("late_report answers for the date it was given, worst first, with the value at risk", async (t) => {
  const { c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.json("late_report", { as_of: AS_OF_LATE });
  assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 300));
  assert.equal(r.as_of, AS_OF_LATE);
  assert.equal(r.as_of_source, "call");
  assert.equal(r.late_count, 1);
  assert.equal(r.due_today_count, 0);
  assert.equal(r.delivered_late_count, 1);
  assert.equal(r.not_yet_due_count, 1);
  assert.equal(r.delivered_on_time_count, 1);
  assert.equal(r.late[0].deliverable, "D03");
  assert.equal(r.late[0].days_late, 4);
  assert.equal(r.late[0].value_minor, 210000);
  assert.equal(r.worst.deliverable, "D03");
  assert.deepEqual(r.value_at_risk, [{ currency: "EUR", deliverables: 1, priced: 1, unpriced: 0, value_minor: 210000, value: "EUR 2100.00" }]);
  assert.equal(r.delivered_late[0].deliverable, "D02");
  assert.equal(r.truncated, false);
  assert.equal(r.rows_not_shown, 0);

  const earlier = await c.json("late_report", { as_of: AS_OF_EARLIER });
  assert.equal(earlier.late_count, 1);
  assert.equal(earlier.late[0].deliverable, "D02", "the same store, an earlier date, a different late deliverable");
  assert.equal(earlier.late[0].days_late, 2);
  assert.equal(earlier.delivered_late_count, 0, "nothing had been delivered late by 2026-04-22");

  const onDay = await c.json("late_report", { as_of: AS_OF_DUE_TODAY });
  assert.equal(onDay.late_count, 0);
  assert.equal(onDay.due_today_count, 1);
  assert.equal(onDay.due_today[0].deliverable, "D03");
  assert.match(onDay.notes.join(" "), /Nothing is late as at 2026-05-01/);
});

test("THE PAYLOAD: the accepted milestones in two scales, recomputed with the invoice engine", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const id = await seed(c);
  const p = await c.json("milestone_payload", { schedule: id, as_of: AS_OF_LATE, issue_date: "2026-05-06" });
  assert.equal(p.isError, undefined, JSON.stringify(p).slice(0, 400));

  assert.deepEqual(p.milestones.map((m) => m.deliverable), ["D01", "D02"], "only what was delivered AND accepted by as_of");
  assert.deepEqual(p.milestones.map((m) => m.value_minor), [90000, 47988]);
  assert.deepEqual(p.milestones.map((m) => m.delivered_date), ["2026-04-09", "2026-04-24"]);
  assert.deepEqual(p.milestones.map((m) => m.accepted_date), ["2026-04-12", "2026-04-27"]);
  assert.equal(p.totals.net_minor, ACCEPTED_NET_MINOR);
  assert.equal(p.totals.vat_minor, ACCEPTED_VAT_MINOR, "23% rounded per line: 20700 + 11037");
  assert.equal(p.totals.total_minor, ACCEPTED_TOTAL_MINOR);
  assert.equal(p.totals.rounding_drift_minor, 0, "every unit price is a whole minor unit, so nothing drifts");
  assert.equal(p.totals.net, "EUR 1379.88");
  assert.equal(p.totals.total, "EUR 1697.25");
  assert.equal(p.posted, false);
  assert.equal(p.vat_rate_source, "shared profile");

  // The invoice payload is in MAJOR units and reproduces the totals through the invoice
  // server's OWN engine, run here over the payload exactly as it came back.
  const invoiceItems = p.invoice_create.arguments.items;
  assert.deepEqual(invoiceItems.map((i) => i.unit_price), [900, 479.88]);
  assert.deepEqual(invoiceItems.map((i) => i.quantity), [1, 1]);
  const recomputed = computeTotals(invoiceItems, "EUR", 0, 0);
  assert.equal(recomputed.net_minor, ACCEPTED_NET_MINOR, "the invoice server would not agree with the payload's own totals");
  assert.equal(recomputed.tax_minor, ACCEPTED_VAT_MINOR);
  assert.equal(recomputed.total_minor, ACCEPTED_TOTAL_MINOR);
  assert.equal(recomputed.rounding_drift_minor, 0);

  // The quote payload is the SAME milestones in MINOR units. Feeding it to the tool that
  // takes MAJOR units misprices the job by exactly 100x, which is why the two are built
  // here rather than left to the caller to rescale.
  const quoteItems = p.quote_create.arguments.items;
  assert.deepEqual(quoteItems.map((i) => i.unit_price_minor), [90000, 47988]);
  const misread = computeTotals(quoteItems.map((i) => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price_minor, tax_rate: i.tax_rate })), "EUR", 0, 0);
  assert.equal(misread.net_minor, ACCEPTED_NET_MINOR * 100, "the two scales are not exactly 100x apart");
  assert.equal(p.quote_create.unit, "MINOR units, which is what quote_create's unit_price_minor takes");
  assert.equal(p.invoice_create.unit, "MAJOR units, which is what invoice_create's unit_price takes");
  assert.equal(p.quote_create.ready, true, "every milestone is a quantity of one, so quote_create would take them");
});

test("no description carries a bare minor-unit figure, on any surface", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const id = await seed(c);
  const p = await c.json("milestone_payload", { schedule: id, as_of: AS_OF_LATE });
  for (const m of p.milestones) {
    assert.equal(m.description, `${m.description.split(" (delivered")[0]} (delivered ${m.delivered_date}, accepted ${m.accepted_date})`,
      "a milestone description is the deliverable and its two dates, and nothing else");
    assert.equal(new RegExp(`(^|[^0-9])${m.unit_price_minor}([^0-9]|$)`).test(m.description), false,
      `the minor figure ${m.unit_price_minor} is written into a description that lands beside a MAJOR unit price`);
  }
  for (const i of p.invoice_create.arguments.items) {
    assert.equal(/\d{5,}/.test(i.description), false, `a bare five-digit figure in "${i.description}" reads as a minor-unit amount on the customer's invoice`);
  }
  // The document prints money, and every amount on it goes through formatMoney: it
  // carries the currency code, so no figure on it can be read as a bare minor unit.
  const doc = await c.call("delivery_schedule_document", { schedule: id, as_of: AS_OF_LATE });
  assert.equal(doc.isError, false, doc.text);
  for (const m of doc.text.matchAll(/(^|\s)(\d[\d.]*)(\s|$)/g)) {
    const n = m[2];
    if (/^\d{4}$/.test(n) || n.includes(".")) continue; // a year or an already formatted amount
    assert.ok(Number(n) < 1000, `the document carries the bare figure ${n}, which reads as a minor-unit amount`);
  }
});

test("the payload refuses rather than billing what the client has not accepted", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const id = await seed(c);

  // As at 2026-04-11 D01 had been delivered but not accepted, and nothing else had moved.
  const early = await c.call("milestone_payload", { schedule: id, as_of: "2026-04-11" });
  assert.equal(early.isError, true, early.text);
  assert.match(early.text, /nothing on DS-2026-0001 had been accepted by 2026-04-11/);
  assert.match(early.text, /1 delivered and awaiting sign-off/);
  assert.match(early.text, /bills for work they may still send back/);

  // As at 2026-04-26 exactly one milestone is billable, and the answer says the rest is not.
  const one = await c.json("milestone_payload", { schedule: id, as_of: "2026-04-26" });
  assert.deepEqual(one.milestones.map((m) => m.deliverable), ["D01"]);
  assert.equal(one.totals.net_minor, 90000);
  assert.equal(one.excluded.not_yet_accepted.length, 3);
  assert.match(one.notes.join(" "), /3 deliverable\(s\) on DS-2026-0001 had not been accepted by 2026-04-26/);
});

test("an unpriced deliverable is excluded by name, never billed as zero", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const id = await seed(c);
  // Accept the unpriced training session too, so it is accepted AND carries no value.
  for (const [status, date] of [["delivered", "2026-05-08"], ["accepted", "2026-05-09"]]) {
    const r = await c.call("deliverable_status", { schedule: id, deliverable: "D04", status, date });
    assert.equal(r.isError, false, r.text);
  }
  const p = await c.json("milestone_payload", { schedule: id, as_of: "2026-05-10" });
  assert.deepEqual(p.milestones.map((m) => m.deliverable), ["D01", "D02"], "D04 is accepted but carries no price");
  assert.equal(p.totals.net_minor, ACCEPTED_NET_MINOR, "an unpriced milestone must not shift the total by a cent");
  assert.deepEqual(p.excluded.accepted_but_unpriced.map((d) => d.id), ["D04"]);
  assert.match(p.notes.join(" "), /1 accepted deliverable\(s\) carry no value and are NOT in the items/);
  assert.match(p.notes.join(" "), /They were not billed as zero/);

  // And the same rule in the report: an unpriced late row is counted, not added in as 0.
  const rep = await c.json("late_report", { as_of: "2026-05-10" });
  assert.equal(rep.late_count, 1, "only D03 is still owed");
  assert.deepEqual(rep.value_at_risk, [{ currency: "EUR", deliverables: 1, priced: 1, unpriced: 0, value_minor: 210000, value: "EUR 2100.00" }]);
});

test("value_at_risk is never summed across currencies", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  await seed(c);
  const pln = await c.json("delivery_schedule_create", { reference: "Q-2026-0044", reference_date: "2026-04-01", client: "Bar Mleczny", title: "Menu print run", currency: "PLN" });
  await c.call("deliverable_add", { schedule: pln.created.id, description: "Proof sheets", due_date: "2026-04-15", value_minor: 120000 });
  const r = await c.json("late_report", { as_of: AS_OF_LATE });
  assert.equal(r.late_count, 2);
  assert.deepEqual(r.value_at_risk.map((t) => [t.currency, t.value_minor]), [["EUR", 210000], ["PLN", 120000]]);
  assert.equal(r.value_at_risk.length, 2, "two currencies must stay two rows; this server holds no exchange rate");
});

test("completing a schedule frees the free-tier slot without deleting anything", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const before = await c.json("delivery_schedule_list", {});
  assert.equal(before.open_schedules, 1);
  assert.equal(before.free_tier_open_limit, 3);
  for (const [d, status, date] of [
    ["D03", "delivered", "2026-05-06"], ["D03", "accepted", "2026-05-07"],
    ["D04", "delivered", "2026-05-08"], ["D04", "accepted", "2026-05-09"],
  ]) {
    const r = await c.call("deliverable_status", { schedule: id, deliverable: d, status, date });
    assert.equal(r.isError, false, r.text);
  }
  const after = await c.json("delivery_schedule_list", {});
  assert.equal(after.open_schedules, 0, "every deliverable is accepted, so the job no longer counts");
  assert.equal(after.schedules[0].complete, true);
  assert.equal(after.count, 1, "the record is still there; it just stopped counting");
});

test("the store holds facts and nothing derived from them", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  await c.init();
  const id = await seed(c);
  await c.call("late_report", { as_of: AS_OF_LATE });
  await c.call("milestone_payload", { schedule: id, as_of: AS_OF_LATE });
  const raw = readFileSync(join(storeDir(box.dataHome), "schedules.json"), "utf8");
  for (const key of ["days_late", "state", "net_minor", "total_minor", "vat_minor", "accepted_value_minor", "delivered_date", "accepted_date", "complete", "counts"]) {
    assert.equal(raw.includes(`"${key}"`), false, `${key} was stored; every reading must be derived on the call`);
  }
  assert.equal(raw.includes(`"status"`), false, "the current status is what the history already says; storing it is a second copy");
  const s = JSON.parse(raw)[0];
  assert.deepEqual(Object.keys(s).sort(), [
    "client", "created", "currency", "deliverable_counter", "deliverables", "id", "reference",
    "reference_date", "reference_kind", "title", "updated",
  ]);
  // deliverable_counter is allocation state, not a derived figure: it is the highest D
  // number ever issued on this schedule and it only goes up, so a deleted id is never
  // handed to a different piece of work (D-DS1).
  assert.equal(s.deliverable_counter, 4);
  assert.deepEqual(Object.keys(s.deliverables[0]).sort(), ["created", "description", "due_date", "history", "id", "tax_rate", "value_minor"]);
  assert.equal(s.deliverables[0].history.length, 3, "the three dated moves on D01 must survive on disk");
  assert.deepEqual(s.deliverables[0].history.map((h) => h.to), ["in_progress", "delivered", "accepted"]);
});

test("every amount the server emits is an integer number of minor units", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const id = await seed(c);
  const g = await c.json("delivery_schedule_get", { schedule: id, as_of: AS_OF_LATE });
  for (const d of g.schedule.deliverables) {
    assert.ok(d.value_minor === null || Number.isInteger(d.value_minor), JSON.stringify(d));
    assert.ok(Number.isInteger(d.days_late), JSON.stringify(d));
  }
  for (const k of ["value_minor", "accepted_value_minor"]) {
    assert.ok(Number.isInteger(g.schedule[k]), `${k} is not an integer: ${g.schedule[k]}`);
  }
  const p = await c.json("milestone_payload", { schedule: id, as_of: AS_OF_LATE });
  for (const k of ["subtotal_minor", "net_minor", "vat_minor", "total_minor"]) {
    assert.ok(Number.isInteger(p.totals[k]), `${k} is not an integer: ${p.totals[k]}`);
  }
  assert.equal(p.totals.net_minor + p.totals.vat_minor, p.totals.total_minor, "net plus VAT does not make the total");
  assert.equal(p.milestones.reduce((a, m) => a + m.value_minor, 0), p.totals.net_minor, "the milestones do not add up to the net");
  for (const i of p.quote_create.arguments.items) {
    assert.ok(Number.isInteger(i.unit_price_minor), `quote_create takes MINOR units and got ${i.unit_price_minor}`);
  }
});

test("a zero-decimal currency keeps its scale in both payloads", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const s = await c.json("delivery_schedule_create", { reference: "Q-2026-0099", reference_date: "2026-04-01", client: "Tokyo Press", title: "Print run", currency: "JPY" });
  const id = s.created.id;
  await c.call("deliverable_add", { schedule: id, description: "Proof run", due_date: "2026-04-10", value_minor: 120000 });
  await c.call("deliverable_status", { schedule: id, deliverable: "D01", status: "delivered", date: "2026-04-09" });
  await c.call("deliverable_status", { schedule: id, deliverable: "D01", status: "accepted", date: "2026-04-11" });
  const p = await c.json("milestone_payload", { schedule: id, as_of: "2026-04-12" });
  assert.equal(p.totals.net_minor, 120000);
  assert.equal(p.totals.net, "JPY 120000");
  assert.equal(p.invoice_create.arguments.items[0].unit_price, 120000, "JPY has no minor unit, so major and minor are the same number");
  assert.equal(p.quote_create.arguments.items[0].unit_price_minor, 120000);
  assert.equal(p.totals.rounding_drift_minor, 0);
});
