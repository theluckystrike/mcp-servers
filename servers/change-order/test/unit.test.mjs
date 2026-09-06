// The worked change order, recomputed by hand and asserted to the minor unit.
//
// Two assertions carry the suite. The first is the running value: original plus APPROVED
// deltas, with the pending delta held apart, across draft, sent and approved. The second
// is the payload: the invoice payload's totals are recomputed from the payload's OWN items
// with servers/invoice's computeTotals, and the quote payload's items fed into the same
// engine as though their minor figure were major, asserted as exactly 100x the correct net.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeTotals } from "@theluckystrike/mcp-invoice/lib";
import {
  client, sandbox, cleanup, proKey, storeDir, writeProfile, seed, approve,
  REFERENCE, CLIENT, ORIGINAL_MINOR, CO_DATE, LINES, LINE_DELTAS, NET_DELTA_MINOR, VAT_DELTA_MINOR,
  GROSS_DELTA_MINOR, ITEM_VALUES, CURRENT_AFTER_APPROVAL,
} from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

test("a change order takes the profile currency, infers the reference kind, and starts as a draft", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("change_order_create", { reference: "q-2026-0003", client: CLIENT, title: "Second page", date: CO_DATE, original_value_minor: ORIGINAL_MINOR });
  assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 300));
  assert.equal(r.created.id, "CO-2026-0001");
  assert.equal(r.created.reference, "Q-2026-0003", "a reference is filed upper case, whatever it was typed as");
  assert.equal(r.created.reference_kind, "quote");
  assert.equal(r.created.currency, "EUR");
  assert.equal(r.created.status, "draft");
  assert.equal(r.created.delta_minor, 0);
  assert.equal(r.created.contract.original_minor, ORIGINAL_MINOR);
  assert.equal(r.created.contract.current_minor, ORIGINAL_MINOR);
  const wo = await c.json("change_order_create", { reference: "WO-2026-0007", client: CLIENT, title: "Extra visit", date: CO_DATE, original_value_minor: 50000 });
  assert.equal(wo.created.reference_kind, "work_order", "a WO- reference is a work order");
  assert.equal(wo.created.id, "CO-2026-0002");
});

test("THE LINES: added, removed and changed each carry the delta recomputed by hand", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const r = await c.json("change_order_get", { change_order: id });
  assert.equal(r.isError, undefined, JSON.stringify(r).slice(0, 300));
  const lines = r.change_order.lines_detail;
  assert.deepEqual(lines.map((l) => l.id), ["L01", "L02", "L03"]);
  assert.deepEqual(lines.map((l) => l.kind), ["added", "removed", "changed"]);
  assert.deepEqual(lines.map((l) => l.delta_minor), LINE_DELTAS);
  assert.equal(lines[0].delta, "+EUR 900.00");
  assert.equal(lines[1].delta, "-EUR 479.88");
  assert.equal(lines[2].delta, "+EUR 750.00", "5 x 42000 less 3 x 45000 is 210,000 less 135,000");
  assert.equal(lines[2].was_quantity, 3);
  assert.equal(lines[2].was_unit_price_minor, 45000);
  assert.deepEqual(lines.map((l) => l.reason), LINES.map((l) => l.reason));
  assert.equal(r.change_order.added_minor, 90000);
  assert.equal(r.change_order.removed_minor, -47988);
  assert.equal(r.change_order.changed_minor, 75000);
  assert.equal(r.change_order.delta_minor, NET_DELTA_MINOR);
  assert.equal(r.change_order.vat_minor, VAT_DELTA_MINOR, "VAT is per item: 20700 - 11037 - 31050 + 48300");
  assert.equal(r.change_order.delta_gross_minor, GROSS_DELTA_MINOR);
});

test("THE RUNNING VALUE: original plus approved deltas, with the pending delta held apart", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);

  // Draft: pending, not part of the contract.
  let cv = await c.json("contract_value", { reference: REFERENCE });
  assert.equal(cv.isError, undefined, JSON.stringify(cv).slice(0, 300));
  assert.equal(cv.original_value_minor, ORIGINAL_MINOR);
  assert.equal(cv.approved_delta_minor, 0);
  assert.equal(cv.current_value_minor, ORIGINAL_MINOR, "a draft must not move the contract value");
  assert.equal(cv.pending_delta_minor, NET_DELTA_MINOR);
  assert.equal(cv.if_all_pending_approved_minor, CURRENT_AFTER_APPROVAL);
  assert.deepEqual(cv.change_orders.map((o) => o.counted_as), ["pending"]);

  // Sent: still pending.
  await c.call("change_order_status", { change_order: id, status: "sent", date: "2026-03-13" });
  cv = await c.json("contract_value", { reference: REFERENCE });
  assert.equal(cv.current_value_minor, ORIGINAL_MINOR, "a sent change order must not move the contract value");
  assert.equal(cv.pending_delta_minor, NET_DELTA_MINOR);

  // Approved: part of the contract, and pending drops to zero.
  const ap = await c.json("change_order_status", { change_order: id, status: "approved", date: "2026-03-15" });
  assert.equal(ap.isError, undefined, JSON.stringify(ap).slice(0, 300));
  assert.equal(ap.contract.current_value_minor, CURRENT_AFTER_APPROVAL);
  assert.match(ap.notes.join(" "), /Q-2026-0003 is now worth EUR 21170\.12: the original EUR 20000\.00 plus \+EUR 1170\.12 approved/);
  cv = await c.json("contract_value", { reference: REFERENCE });
  assert.equal(cv.approved_delta_minor, NET_DELTA_MINOR);
  assert.equal(cv.current_value_minor, CURRENT_AFTER_APPROVAL);
  assert.equal(cv.pending_delta_minor, 0);
  assert.equal(cv.if_all_pending_approved_minor, CURRENT_AFTER_APPROVAL);
  assert.deepEqual(cv.counts, { draft: 0, sent: 0, approved: 1, rejected: 0, void: 0 });
});

test("a second change order inherits the original value, and a rejected one counts for nothing", async (t) => {
  const { c } = open(t);
  await c.init();
  const first = await seed(c);
  await approve(c, first);
  // No original_value_minor on the second: inherited, and the note says so.
  const second = await c.json("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Drop the copywriting", date: "2026-04-01" });
  assert.equal(second.isError, undefined, JSON.stringify(second).slice(0, 300));
  assert.equal(second.created.contract.original_minor, ORIGINAL_MINOR);
  assert.match(second.notes.join(" "), /inherited from the 1 change order\(s\) already on Q-2026-0003/);
  await c.call("change_order_add_line", { change_order: second.created.id, kind: "removed", description: "Copywriting", quantity: 4, unit_price_minor: 12000, reason: "Client writes their own copy" });
  let cv = await c.json("contract_value", { reference: REFERENCE });
  assert.equal(cv.current_value_minor, CURRENT_AFTER_APPROVAL);
  assert.equal(cv.pending_delta_minor, -48000);
  assert.equal(cv.if_all_pending_approved_minor, CURRENT_AFTER_APPROVAL - 48000);
  await c.call("change_order_status", { change_order: second.created.id, status: "sent", date: "2026-04-02" });
  const rj = await c.json("change_order_status", { change_order: second.created.id, status: "rejected", date: "2026-04-05" });
  assert.match(rj.notes.join(" "), /counts for nothing in the running value of Q-2026-0003, which stays EUR 21170\.12/);
  cv = await c.json("contract_value", { reference: REFERENCE });
  assert.equal(cv.current_value_minor, CURRENT_AFTER_APPROVAL, "a rejected change order must not move the contract value");
  assert.equal(cv.pending_delta_minor, 0);
  assert.equal(cv.rejected_delta_minor, -48000);
  assert.deepEqual(cv.change_orders.map((o) => o.counted_as), ["approved", "nothing"]);
});

test("THE PAYLOAD: the invoice payload's totals equal computeTotals over its own items", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const id = await seed(c);
  await approve(c, id);
  const p = await c.json("change_order_invoice_payload", { change_order: id, issue_date: "2026-03-16" });
  assert.equal(p.isError, undefined, JSON.stringify(p).slice(0, 400));
  assert.equal(p.currency, "EUR");
  assert.equal(p.approved_on, "2026-03-15");
  assert.equal(p.invoice_create.tool, "invoice_create");
  assert.equal(p.invoice_create.server, "invoice");
  assert.equal(p.invoice_create.arguments.client, CLIENT);
  assert.equal(p.invoice_create.arguments.issue_date, "2026-03-16");
  assert.equal(p.posted, false);

  // The changed line is TWO items: a reversal and the revised line, never one net item.
  assert.deepEqual(p.items.map((i) => [i.line, i.part]), [["L01", "line"], ["L02", "line"], ["L03", "reversal"], ["L03", "revised"]]);
  assert.deepEqual(p.items.map((i) => i.value_minor), ITEM_VALUES);

  // THE assertion: run the payload through the invoice server's own engine.
  const recomputed = computeTotals(p.invoice_create.arguments.items, "EUR", 0, 0);
  assert.deepEqual(recomputed.lines.map((l) => l.gross_minor), ITEM_VALUES);
  assert.equal(recomputed.net_minor, NET_DELTA_MINOR);
  assert.equal(recomputed.tax_minor, VAT_DELTA_MINOR);
  assert.equal(recomputed.total_minor, GROSS_DELTA_MINOR);
  assert.equal(p.totals.net_minor, recomputed.net_minor);
  assert.equal(p.totals.vat_minor, recomputed.tax_minor);
  assert.equal(p.totals.total_minor, recomputed.total_minor);
  assert.equal(recomputed.rounding_drift_minor, 0, "a delta that drifts under the other rounding basis would bill a figure the change order never showed");
  assert.equal(p.totals.rounding_drift_minor, 0);
  assert.equal(p.totals.net_minor + p.totals.vat_minor, p.totals.total_minor);
});

test("THE SCALES: the same delta is MAJOR in the invoice payload and MINOR in the quote payload, 100x apart", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const id = await seed(c);
  await approve(c, id);
  const p = await c.json("change_order_invoice_payload", { change_order: id });
  const inv = p.invoice_create.arguments.items;
  const quo = p.quote_create.arguments.items;
  assert.equal(p.invoice_create.unit, "MAJOR units, which is what invoice_create's unit_price takes");
  assert.equal(p.quote_create.unit, "MINOR units, which is what quote_create's unit_price_minor takes");
  assert.deepEqual(inv.map((i) => [i.quantity, i.unit_price]), [[2, 450], [-12, 39.99], [-3, 450], [5, 420]]);
  assert.deepEqual(quo.map((i) => [i.quantity, i.unit_price_minor]), [[2, 45000], [-12, 3999], [-3, 45000], [5, 42000]]);
  for (let i = 0; i < inv.length; i++) {
    assert.ok(Number.isInteger(quo[i].unit_price_minor), JSON.stringify(quo[i]));
    assert.equal(Math.round(inv[i].unit_price * 100), quo[i].unit_price_minor);
    assert.equal(inv[i].quantity, quo[i].quantity);
    assert.equal(inv[i].tax_rate, quo[i].tax_rate);
    assert.equal(quo[i].currency, "EUR");
  }
  // Re-derive the net from EACH payload's own items, then take the quotient.
  const fromInvoice = computeTotals(inv, "EUR", 0, 0).net_minor;
  const fromQuote = computeTotals(quo.map((q) => ({ description: q.description, quantity: q.quantity, unit_price: q.unit_price_minor, tax_rate: q.tax_rate })), "EUR", 0, 0).net_minor;
  assert.equal(fromInvoice, NET_DELTA_MINOR);
  assert.equal(fromQuote, NET_DELTA_MINOR * 100);
  assert.equal(fromQuote / fromInvoice, 100, "the mis-scaled payload must be exactly 100x, or this test is not measuring anything");
  // And this delta carries a removal and a reversal, so quote_create would refuse it.
  assert.equal(p.quote_create.ready, false);
  assert.match(p.quote_create.not_ready_because, /quantity that is not greater than zero/);
});

test("a delta with only additions is quote-ready, and both scales still agree", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const r = await c.json("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Two more pages", date: CO_DATE, original_value_minor: ORIGINAL_MINOR });
  await c.call("change_order_add_line", { change_order: r.created.id, kind: "added", description: "Extra landing page", quantity: 2, unit_price_minor: 45000, reason: "Asked for at the kickoff" });
  await c.call("change_order_add_line", { change_order: r.created.id, kind: "changed", description: "Website audit", quantity: 5, unit_price_minor: 42000, was_quantity: 3, was_unit_price_minor: 45000, reason: "Two more sites" });
  await approve(c, r.created.id);
  const withChange = await c.json("change_order_invoice_payload", { change_order: r.created.id });
  assert.equal(withChange.quote_create.ready, false, "a changed line carries a reversal, which quote_create refuses");

  const only = await c.json("change_order_create", { reference: REFERENCE, client: CLIENT, title: "One more page", date: CO_DATE });
  await c.call("change_order_add_line", { change_order: only.created.id, kind: "added", description: "Extra landing page", quantity: 1, unit_price_minor: 45000, reason: "Asked for later" });
  await approve(c, only.created.id);
  const p = await c.json("change_order_invoice_payload", { change_order: only.created.id });
  assert.equal(p.quote_create.ready, true);
  assert.equal(p.quote_create.not_ready_because, null);
  assert.equal(p.totals.net_minor, 45000);
  assert.equal(computeTotals(p.invoice_create.arguments.items, "EUR", 0, 0).net_minor, 45000);
  assert.equal(p.quote_create.arguments.items[0].unit_price_minor, 45000);
});

test("a negative delta is invoiced as negative quantities, and the note says a credit note is the other way", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const r = await c.json("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Drop hosting", date: CO_DATE, original_value_minor: ORIGINAL_MINOR });
  await c.call("change_order_add_line", { change_order: r.created.id, kind: "removed", description: "Managed hosting", quantity: 12, unit_price_minor: 3999, reason: "In-house from April" });
  await approve(c, r.created.id);
  const p = await c.json("change_order_invoice_payload", { change_order: r.created.id });
  assert.equal(p.totals.net_minor, -47988);
  assert.equal(p.totals.vat_minor, -11037, "roundHalfUp(-11037.24) is -11037, symmetric in sign");
  assert.equal(p.totals.total_minor, -59025);
  assert.equal(p.totals.total, "-EUR 590.25");
  assert.deepEqual(p.invoice_create.arguments.items.map((i) => [i.quantity, i.unit_price]), [[-12, 39.99]]);
  assert.equal(computeTotals(p.invoice_create.arguments.items, "EUR", 0, 0).total_minor, -59025);
  assert.match(p.notes.join(" "), /The delta is negative: -EUR 590\.25 gross/);
  assert.match(p.notes.join(" "), /credit note/);
  const cv = await c.json("contract_value", { reference: REFERENCE });
  assert.equal(cv.current_value_minor, ORIGINAL_MINOR - 47988);
});

test("the document names the client, the reference, the lines with reasons, the delta and the value before and after", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const id = await seed(c);
  await c.call("change_order_status", { change_order: id, status: "sent", date: "2026-03-13" });
  const r = await c.call("change_order_document", { change_order: id });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /^CHANGE ORDER\nCO-2026-0001\n\nNova Studio\nul\. Prosta 1, Warsaw/);
  assert.match(r.text, /Client        Harbour Cafe/);
  assert.match(r.text, /Against       Q-2026-0003 \(quote\)/);
  assert.match(r.text, /Sent          2026-03-13/);
  assert.match(r.text, /Status        sent/);
  assert.match(r.text, /2026-03-10  added    Extra landing page  2 x EUR 450\.00  \+EUR 900\.00\n {12}reason: Client asked for a second page after the kickoff/);
  assert.match(r.text, /2026-03-11  removed  Managed hosting  12 x EUR 39\.99  -EUR 479\.88/);
  assert.match(r.text, /2026-03-12  changed  Website audit  was 3 x EUR 450\.00, now 5 x EUR 420\.00  \+EUR 750\.00/);
  assert.match(r.text, /Net delta  \+EUR 1170\.12/);
  assert.match(r.text, /VAT 23% on \+EUR 1170\.12  \+EUR 269\.13/);
  assert.match(r.text, /Delta gross  \+EUR 1439\.25/);
  assert.match(r.text, /Original {20}EUR 20000\.00/);
  assert.match(r.text, /This change order {11}\+EUR 1170\.12  \(pending, not yet part of the contract\)/);
  assert.match(r.text, /Value if approved {11}EUR 21170\.12/);
  assert.match(r.text, /Value today {17}EUR 20000\.00/);
  assert.match(r.text, /APPROVAL\n {2}Approved for the client by/);
  // Once approved the document says so and the two values meet.
  await c.call("change_order_status", { change_order: id, status: "approved", date: "2026-03-15" });
  const after = await c.call("change_order_document", { change_order: id });
  assert.match(after.text, /Status        approved on 2026-03-15/);
  assert.match(after.text, /This change order {11}\+EUR 1170\.12  \(approved\)/);
  assert.match(after.text, /Value today {17}EUR 21170\.12/);
});

test("the document shows earlier approved change orders and other pending ones as separate lines", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const first = await seed(c);
  await approve(c, first);
  const second = await c.json("change_order_create", { reference: REFERENCE, client: CLIENT, title: "One more page", date: "2026-04-01" });
  await c.call("change_order_add_line", { change_order: second.created.id, kind: "added", description: "Extra landing page", quantity: 1, unit_price_minor: 45000, reason: "Asked for in April" });
  const third = await c.json("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Drop copy", date: "2026-04-02" });
  await c.call("change_order_add_line", { change_order: third.created.id, kind: "removed", description: "Copywriting", quantity: 1, unit_price_minor: 12000, reason: "Own copy" });
  const r = await c.call("change_order_document", { change_order: second.created.id });
  assert.match(r.text, /Previously approved \(CO-2026-0001\)  \+EUR 1170\.12/);
  assert.match(r.text, /This change order {11}\+EUR 450\.00  \(pending/);
  assert.match(r.text, /Value if approved {11}EUR 21620\.12/, "original 20000 + 1170.12 approved + 450 this one");
  assert.match(r.text, /Value today {17}EUR 21170\.12/);
  assert.match(r.text, /Other pending change orders -EUR 120\.00  \(not included above\)/);
});

test("change_order_list filters by reference, status and client and totals per currency", async (t) => {
  const { c } = open(t);
  await c.init();
  const first = await seed(c);
  await approve(c, first);
  await c.call("change_order_create", { reference: "WO-2026-0007", client: "Marina Bar", title: "Extra visit", date: "2026-03-20", original_value_minor: 50000, currency: "PLN" });
  const all = await c.json("change_order_list", {});
  assert.equal(all.count, 2);
  assert.deepEqual(all.totals.map((x) => [x.currency, x.change_orders, x.approved_delta_minor, x.pending_delta_minor]), [["EUR", 1, 117012, 0], ["PLN", 1, 0, 0]]);
  assert.equal((await c.json("change_order_list", { reference: REFERENCE })).count, 1);
  assert.equal((await c.json("change_order_list", { status: "open" })).count, 1);
  assert.equal((await c.json("change_order_list", { status: "approved" })).count, 1);
  assert.equal((await c.json("change_order_list", { client: "marina" })).count, 1);
  assert.equal((await c.json("change_order_list", { from: "2026-03-15" })).count, 1);
  assert.equal(all.free_tier_open_limit, 5);
});

test("an empty draft is deleted free on the free tier, and the number is not reissued", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const r = await c.json("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Raised twice", date: CO_DATE, original_value_minor: ORIGINAL_MINOR });
  const d = await c.json("change_order_delete", { change_order: r.created.id });
  assert.equal(d.isError, undefined, JSON.stringify(d).slice(0, 300));
  assert.equal(d.deleted.id, "CO-2026-0001");
  assert.equal(d.open_change_orders, 0);
  assert.equal(d.free_tier_open_limit, 5);
  const again = await c.json("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Raised once", date: CO_DATE, original_value_minor: ORIGINAL_MINOR });
  assert.equal(again.created.id, "CO-2026-0002", "the CO series only ever goes up");
  const stored = JSON.parse(readFileSync(join(storeDir(box.dataHome), "change-orders.json"), "utf8"));
  assert.equal(stored.length, 1);
});
