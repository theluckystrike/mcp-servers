// What the server refuses, and what it says while refusing. Every case asserts the
// refusal NAMES the thing it is about, and that nothing was written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  client, sandbox, cleanup, proKey, storeDir, writeProfile, seed, approve,
  REFERENCE, CLIENT, ORIGINAL_MINOR, CO_DATE, CREATE, LINES,
} from "./_client.mjs";

function open(t, opts = {}, profile = true) {
  const box = sandbox();
  if (profile) writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

const orders = (box) => {
  const p = join(storeDir(box.dataHome), "change-orders.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : [];
};

test("the first change order against a reference needs the original value, and the refusal says why", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const r = await c.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Second page", date: CO_DATE });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /Q-2026-0003 has no change order yet, so original_value_minor is required/);
  assert.match(r.text, /does not open the quotes or work-order store/);
  assert.match(r.text, /Nothing was written/);
  assert.equal(orders(box).length, 0, "a refused create was still written");
  assert.equal(existsSync(join(storeDir(box.dataHome), "counter.json")), false, "a refused create burned a number");
});

test("a second original value on one reference is refused BY NAME with the figure on file", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await seed(c);
  const r = await c.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Another change", date: CO_DATE, original_value_minor: 1999999 });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /original value is on file as EUR 20000\.00 \(2000000 minor, from CO-2026-0001\)/);
  assert.match(r.text, /This call says 1999999/);
  assert.match(r.text, /A contract with two original values has two running values/);
  assert.equal(orders(box).length, 1);
  // The same figure restated is fine, and so is omitting it.
  const same = await c.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Another change", date: CO_DATE, original_value_minor: ORIGINAL_MINOR });
  assert.equal(same.isError, false, same.text);
  // A second currency on one reference is refused rather than converted.
  const pln = await c.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: "In zloty", date: CO_DATE, currency: "PLN" });
  assert.equal(pln.isError, true, pln.text);
  assert.match(pln.text, /Q-2026-0003 is in EUR on CO-2026-0001 and this change order says PLN/);
});

test("contract_value on a reference with nothing on file refuses rather than reporting zero", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.call("contract_value", { reference: "Q-2099-0001" });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /no change order is on file against "Q-2099-0001"/);
  assert.match(r.text, /Nothing was invented/);
});

test("a skipped status step: a draft cannot be approved unsent, and the refusal names the step", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const id = await seed(c);
  for (const status of ["approved", "rejected"]) {
    const r = await c.call("change_order_status", { change_order: id, status, date: "2026-03-13" });
    assert.equal(r.isError, true, r.text);
    assert.match(r.text, /CO-2026-0001 is draft and has not been sent/);
    assert.match(r.text, new RegExp(`move it to sent first \\(with the day it went out\\), then to ${status}`));
  }
  const stored = orders(box)[0];
  assert.equal(stored.status, "draft");
  assert.deepEqual(stored.history, [], "a refused move still wrote history");
});

test("a final status is final, and a backwards step is refused by name", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const id = await seed(c);
  await approve(c, id);
  for (const status of ["draft", "sent", "rejected", "void"]) {
    const r = await c.call("change_order_status", { change_order: id, status, date: "2026-03-20" });
    assert.equal(r.isError, true, `${status}: ${r.text}`);
    assert.match(r.text, /CO-2026-0001 is approved, which is final/);
    assert.match(r.text, /a change of mind is a new change order against the same reference/);
  }
  const same = await c.call("change_order_status", { change_order: id, status: "approved", date: "2026-03-20" });
  assert.match(same.text, /is already approved/);
  // A sent one cannot go back to draft either.
  const second = await c.json("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Back to draft", date: CO_DATE });
  await c.call("change_order_add_line", { change_order: second.created.id, kind: "added", description: "Page", quantity: 1, unit_price_minor: 100, reason: "x" });
  await c.call("change_order_status", { change_order: second.created.id, status: "sent", date: "2026-03-13" });
  const back = await c.call("change_order_status", { change_order: second.created.id, status: "draft", date: "2026-03-14" });
  assert.equal(back.isError, true, back.text);
  assert.match(back.text, /is sent, and from there it can only go to approved or rejected or void, not draft/);
  assert.equal(orders(box).find((o) => o.id === second.created.id).status, "sent");
});

test("a step dated before the change order, or before the last step, is refused; the same day is fine", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const early = await c.call("change_order_status", { change_order: id, status: "sent", date: "2026-03-09" });
  assert.equal(early.isError, true, early.text);
  assert.match(early.text, /was raised on 2026-03-10 and this status change is dated 2026-03-09, before it/);
  assert.equal((await c.call("change_order_status", { change_order: id, status: "sent", date: "2026-03-13" })).isError, false);
  const backwards = await c.call("change_order_status", { change_order: id, status: "approved", date: "2026-03-12" });
  assert.equal(backwards.isError, true, backwards.text);
  assert.match(backwards.text, /reached sent on 2026-03-13 and this change is dated 2026-03-12, before it/);
  assert.match(backwards.text, /cannot be read as a timeline/);
  // Sent in the morning, approved after lunch: the same day is the common case.
  const sameDay = await c.call("change_order_status", { change_order: id, status: "approved", date: "2026-03-13" });
  assert.equal(sameDay.isError, false, sameDay.text);
});

test("a draft with no lines cannot be sent", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("change_order_create", CREATE);
  const s = await c.call("change_order_status", { change_order: r.created.id, status: "sent", date: "2026-03-13" });
  assert.equal(s.isError, true, s.text);
  assert.match(s.text, /CO-2026-0001 has no lines, so there is nothing to send/);
});

test("a line cannot be added once the change order is sent, and the refusal says why", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const id = await seed(c);
  await c.call("change_order_status", { change_order: id, status: "sent", date: "2026-03-13" });
  const r = await c.call("change_order_add_line", { change_order: id, kind: "added", description: "Late line", quantity: 1, unit_price_minor: 100, reason: "Forgot" });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /CO-2026-0001 is sent since 2026-03-13, and a line can only be added to a draft/);
  assert.match(r.text, /makes their approval an approval of something else/);
  assert.equal(orders(box)[0].lines.length, 3, "a refused line was still written");
  await c.call("change_order_status", { change_order: id, status: "approved", date: "2026-03-15" });
  const after = await c.call("change_order_add_line", { change_order: id, kind: "added", description: "Later line", quantity: 1, unit_price_minor: 100, reason: "Forgot" });
  assert.match(after.text, /is approved since 2026-03-15/);
  assert.match(after.text, /Raise a new change order against the same reference/);
});

test("a changed line needs what it was; a changed line that changes nothing, and was_ fields on the wrong kind, are refused", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const r = await c.json("change_order_create", CREATE);
  const id = r.created.id;
  const noWas = await c.call("change_order_add_line", { change_order: id, kind: "changed", description: "Audit", quantity: 5, unit_price_minor: 42000, reason: "More sites" });
  assert.equal(noWas.isError, true, noWas.text);
  assert.match(noWas.text, /a changed line needs was_quantity and was_unit_price_minor/);
  const nothing = await c.call("change_order_add_line", { change_order: id, kind: "changed", description: "Audit", quantity: 3, unit_price_minor: 45000, was_quantity: 3, was_unit_price_minor: 45000, reason: "Typo" });
  assert.equal(nothing.isError, true, nothing.text);
  assert.match(nothing.text, /3 x 45000 before and after changes nothing/);
  const wrongKind = await c.call("change_order_add_line", { change_order: id, kind: "added", description: "Audit", quantity: 3, unit_price_minor: 45000, was_quantity: 1, reason: "Typo" });
  assert.equal(wrongKind.isError, true, wrongKind.text);
  assert.match(wrongKind.text, /belong to a changed line, and this one is added/);
  for (const args of [
    { kind: "added", description: "Neg", quantity: -1, unit_price_minor: 100, reason: "x" },
    { kind: "added", description: "Zero", quantity: 0, unit_price_minor: 100, reason: "x" },
    { kind: "added", description: "Frac", quantity: 1, unit_price_minor: 12.5, reason: "x" },
    { kind: "added", description: "  ", quantity: 1, unit_price_minor: 100, reason: "x" },
    { kind: "added", description: "No reason", quantity: 1, unit_price_minor: 100, reason: "  " },
    { kind: "added", description: "Bad date", quantity: 1, unit_price_minor: 100, reason: "x", date: "2026-02-30" },
    { kind: "added", description: "Early", quantity: 1, unit_price_minor: 100, reason: "x", date: "2026-03-01" },
  ]) {
    const x = await c.call("change_order_add_line", { change_order: id, ...args });
    assert.equal(x.isError, true, `accepted ${JSON.stringify(args)}`);
  }
  assert.equal(orders(box)[0].lines.length, 0, "a refused line was still written");
});

test("a byte-identical change order is refused BEFORE the cap, naming the id, and never sells an upgrade", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await seed(c);
  const twin = await c.call("change_order_create", { ...CREATE, title: "  second landing page, drop hosting,  widen the audit " });
  assert.equal(twin.isError, true, twin.text);
  assert.match(twin.text, /CO-2026-0001 is already this change order: Q-2026-0003/);
  assert.match(twin.text, /It is draft/);
  assert.equal(twin.text.includes("free tier"), false, "the duplicate refusal must not sell an upgrade");
  assert.equal(orders(box).length, 1, "a refused duplicate was still written");
  const forced = await c.json("change_order_create", { ...CREATE, duplicate_ok: true });
  assert.equal(forced.isError, undefined, JSON.stringify(forced).slice(0, 300));
  assert.equal(forced.created.id, "CO-2026-0002");
  assert.match(forced.notes.join(" "), /CO-2026-0001 is an identical change order and was allowed through/);
});

test("a sixth open change order is refused on the free tier, and closing one gives the slot back", async (t) => {
  const { c } = open(t);
  await c.init();
  for (let i = 1; i <= 5; i++) {
    const r = await c.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: `Change ${i}`, date: CO_DATE, ...(i === 1 ? { original_value_minor: ORIGINAL_MINOR } : {}) });
    assert.equal(r.isError, false, `change ${i}: ${r.text}`);
  }
  const over = await c.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Change 6", date: CO_DATE });
  assert.equal(over.isError, true, over.text);
  assert.match(over.text, /the free tier holds 5 open change orders and 5 are open \(CO-2026-0001 draft, CO-2026-0002 draft/);
  assert.match(over.text, /Pro is a one-time \$\d+ for this server/);
  assert.match(over.text, /src=change-order\.change_order_create/);
  // Voiding one is free, and the slot comes back.
  await c.call("change_order_add_line", { change_order: "CO-2026-0001", kind: "added", description: "Page", quantity: 1, unit_price_minor: 100, reason: "x" });
  const closed = await c.json("change_order_status", { change_order: "CO-2026-0001", status: "void", date: CO_DATE });
  assert.equal(closed.isError, undefined, JSON.stringify(closed).slice(0, 300));
  assert.match(closed.notes.join(" "), /Free tier: 4 of 5 open change orders. Closing this one gave a slot back/);
  const now = await c.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: "Change 6", date: CO_DATE });
  assert.equal(now.isError, false, now.text);
  // And with a key the cap is gone.
  const { c: pro } = open(t, { key: proKey() });
  await pro.init();
  for (let i = 1; i <= 7; i++) {
    const r = await pro.call("change_order_create", { reference: REFERENCE, client: CLIENT, title: `Change ${i}`, date: CO_DATE, ...(i === 1 ? { original_value_minor: ORIGINAL_MINOR } : {}) });
    assert.equal(r.isError, false, `pro change ${i}: ${r.text}`);
  }
});

test("a delete with lines, or of anything but a draft, is refused by name", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const id = await seed(c);
  const withLines = await c.call("change_order_delete", { change_order: id });
  assert.equal(withLines.isError, true, withLines.text);
  assert.match(withLines.text, /CO-2026-0001 carries 3 line\(s\) worth \+EUR 1170\.12 \(L01, L02, L03\) and cannot be deleted/);
  assert.match(withLines.text, /move it to void with change_order_status instead/);
  await c.call("change_order_status", { change_order: id, status: "sent", date: "2026-03-13" });
  const sent = await c.call("change_order_delete", { change_order: id });
  assert.equal(sent.isError, true, sent.text);
  assert.match(sent.text, /CO-2026-0001 is sent, not draft, so it cannot be deleted. It reached sent on 2026-03-13/);
  assert.equal(orders(box).length, 1, "a refused delete still removed the change order");
});

test("the invoice payload refuses anything but an approved change order, naming the status and date", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const id = await seed(c);
  const draft = await c.call("change_order_invoice_payload", { change_order: id });
  assert.equal(draft.isError, true, draft.text);
  assert.match(draft.text, /CO-2026-0001 is draft, not approved, so there is no agreed delta to invoice/);
  await c.call("change_order_status", { change_order: id, status: "sent", date: "2026-03-13" });
  const sent = await c.call("change_order_invoice_payload", { change_order: id });
  assert.match(sent.text, /is sent since 2026-03-13, not approved/);
  assert.match(sent.text, /bills for work they may refuse/);
  await c.call("change_order_status", { change_order: id, status: "rejected", date: "2026-03-15" });
  const rejected = await c.call("change_order_invoice_payload", { change_order: id });
  assert.match(rejected.text, /is rejected since 2026-03-15, not approved/);
  assert.match(rejected.text, /A rejected or void change order bills nothing/);
});

test("the Pro tools refuse on free and name the tool that tripped the gate", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  await approve(c, id);
  for (const [tool, args] of [
    ["change_order_document", { change_order: id }],
    ["change_order_invoice_payload", { change_order: id }],
  ]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} answered on the free tier`);
    assert.match(r.text, /Pro is a one-time \$\d+ for this server/, tool);
    assert.match(r.text, new RegExp(`src=change-order\\.${tool}`), `${tool} gate link is untagged`);
    assert.match(r.text, /Or all \d+ servers for \$\d+: https:\/\/mcp\.zovo\.one\/buy\/bundle\?src=change-order\./, `${tool} carries no bundle link`);
  }
});

test("an unreadable store is never read as an empty register", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await seed(c);
  writeFileSync(join(storeDir(box.dataHome), "change-orders.json"), "{ this is not json");
  for (const [tool, args] of [
    ["change_order_create", { reference: REFERENCE, client: CLIENT, title: "Other", date: CO_DATE }],
    ["change_order_add_line", { change_order: "CO-2026-0001", kind: "added", description: "Page", quantity: 1, unit_price_minor: 100, reason: "x" }],
    ["change_order_status", { change_order: "CO-2026-0001", status: "sent" }],
    ["change_order_get", { change_order: "CO-2026-0001" }],
    ["change_order_list", {}],
    ["change_order_delete", { change_order: "CO-2026-0001" }],
    ["contract_value", { reference: REFERENCE }],
  ]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} answered over a corrupt store`);
  }
  const files = readdirSync(storeDir(box.dataHome));
  assert.ok(files.some((f) => f.startsWith("change-orders.json.corrupt-")), `no quarantine copy: ${files.join(", ")}`);
  assert.ok(files.includes("change-orders.json.corrupt"), `no marker: ${files.join(", ")}`);
  const quarantined = files.find((f) => f.startsWith("change-orders.json.corrupt-"));
  assert.equal(readFileSync(join(storeDir(box.dataHome), quarantined), "utf8"), "{ this is not json",
    "the quarantine copy is not byte-for-byte what was on disk");
});

test("with no shared profile the currency falls back to EUR, VAT is zero and the answer says so", async (t) => {
  const { c } = open(t, { key: proKey() }, false);
  await c.init();
  const id = await seed(c);
  await approve(c, id);
  const g = await c.json("change_order_get", { change_order: id });
  assert.equal(g.change_order.currency, "EUR");
  assert.equal(g.change_order.vat_rate_source, "none");
  assert.equal(g.change_order.vat_minor, 0);
  const p = await c.json("change_order_invoice_payload", { change_order: id });
  assert.equal(p.vat_rate_fallback, 0);
  assert.equal(p.vat_rate_source, "none");
  assert.equal(p.totals.total_minor, 117012);
  assert.match(p.notes.join(" "), /carries no default_tax_rate/);
  // An explicit rate overrides and is sourced to the call.
  const explicit = await c.json("change_order_invoice_payload", { change_order: id, tax_rate: 23 });
  assert.equal(explicit.vat_rate_source, "call");
  assert.equal(explicit.totals.vat_minor, 26913);
  const d = await c.call("change_order_document", { change_order: id });
  assert.match(d.text, /^CHANGE ORDER\nCO-2026-0001\n\nYour business\n/);
  assert.match(d.text, /No business profile yet/);
});

test("an unknown change order and an ambiguous title are refused by name", async (t) => {
  const { c } = open(t);
  await c.init();
  const none = await c.call("change_order_get", { change_order: "CO-2026-0001" });
  assert.match(none.text, /there is no change order yet/);
  await c.call("change_order_create", { ...CREATE, title: "Landing page work" });
  await c.call("change_order_create", { ...CREATE, title: "Landing page copy" });
  const missing = await c.call("change_order_get", { change_order: "CO-2026-0009" });
  assert.match(missing.text, /no change order matches "CO-2026-0009"/);
  const ambiguous = await c.call("change_order_get", { change_order: "landing page" });
  assert.equal(ambiguous.isError, true, ambiguous.text);
  assert.match(ambiguous.text, /"landing page" matches more than one change order: CO-2026-0001 \(Landing page work, draft\), CO-2026-0002/);
  const exact = await c.json("change_order_get", { change_order: "Landing page copy" });
  assert.equal(exact.change_order.id, "CO-2026-0002");
  void LINES;
});

test("D-R99: a removal that takes the reference below zero is refused at the line, and again at the approval", async (t) => {
  const { box, c } = open(t);
  await c.init();
  // The original is 12 x 3999. Removing 13 is more hosting than the contract holds.
  const r = await c.json("change_order_create", { reference: "Q-2026-0009", client: CLIENT, title: "Drop hosting", date: CO_DATE, original_value_minor: 47988 });
  const id = r.created.id;
  const over = await c.call("change_order_add_line", { change_order: id, kind: "removed", description: "Managed hosting", quantity: 13, unit_price_minor: 3999, reason: "Client hosts in-house" });
  assert.equal(over.isError, true, over.text);
  assert.match(over.text, /CO-2026-0001 with L01 would take Q-2026-0009 below zero: the original EUR 479\.88 plus this change order's -EUR 519\.87 is -EUR 39\.99/);
  assert.match(over.text, /A contract cannot be worth less than nothing/);
  // D-R102: the refusal names what stays on file, so "nothing was written" cannot be read as "no draft exists".
  assert.match(over.text, /The line was not added; CO-2026-0001 stays a draft with 0 lines and Q-2026-0009 keeps its value/);
  assert.equal(orders(box)[0].lines.length, 0, "a refused line was still written");
  // A reversal on a changed line is bounded the same way.
  const rev = await c.call("change_order_add_line", { change_order: id, kind: "changed", description: "Hosting", quantity: 1, unit_price_minor: 1, was_quantity: 13, was_unit_price_minor: 3999, reason: "Shrunk" });
  assert.equal(rev.isError, true, rev.text);
  assert.match(rev.text, /would take Q-2026-0009 below zero/);
  // Removing exactly what is there lands on zero, which is a cancelled contract, not a negative one.
  const exact = await c.call("change_order_add_line", { change_order: id, kind: "removed", description: "Managed hosting", quantity: 12, unit_price_minor: 3999, reason: "Client hosts in-house" });
  assert.equal(exact.isError, false, exact.text);
  const cv = await c.json("contract_value", { reference: "Q-2026-0009" });
  assert.equal(cv.if_all_pending_approved_minor, 0);
  // D-R101: round 39 invented two different gross figures for one net; the answer says a gross exists nowhere here.
  assert.match(cv.values_are, /^net of VAT\. This server holds no gross contract value/);
  assert.match(cv.values_are, /exists nowhere in these books/);

  // Two pending change orders that are each fine alone: the second approval is what crosses zero.
  await c.json("change_order_create", { reference: "Q-2026-0010", client: CLIENT, title: "Drop everything", date: CO_DATE, original_value_minor: 10000 });
  await c.json("change_order_create", { reference: "Q-2026-0010", client: CLIENT, title: "Drop one more cent", date: CO_DATE });
  const a = await c.call("change_order_add_line", { change_order: "Drop everything", kind: "removed", description: "Everything", quantity: 1, unit_price_minor: 10000, reason: "Cancelled" });
  assert.equal(a.isError, false, a.text);
  const b = await c.call("change_order_add_line", { change_order: "Drop one more cent", kind: "removed", description: "One cent", quantity: 1, unit_price_minor: 1, reason: "Cancelled" });
  assert.equal(b.isError, false, b.text);
  await approve(c, "Drop everything");
  await c.call("change_order_status", { change_order: "Drop one more cent", status: "sent", date: "2026-03-13" });
  const second = await c.call("change_order_status", { change_order: "Drop one more cent", status: "approved", date: "2026-03-16" });
  assert.equal(second.isError, true, second.text);
  assert.match(second.text, /approving CO-2026-0003 would take Q-2026-0010 below zero: the original EUR 100\.00 plus -EUR 100\.00 already approved plus this change order's -EUR 0\.01 is -EUR 0\.01/);
  assert.match(second.text, /Void it and raise the change against the figures on the contract/);
  const stored = orders(box).find((o) => o.id === "CO-2026-0003");
  assert.equal(stored.status, "sent", "a refused approval still moved the status");
  const after = await c.json("contract_value", { reference: "Q-2026-0010" });
  assert.equal(after.current_value_minor, 0);
  assert.equal(after.pending_delta_minor, -1);
});

test("D-R100: an invoice item description never carries a bare minor figure into a major-unit document", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const id = await seed(c);
  await approve(c, id);
  const p = await c.json("change_order_invoice_payload", { change_order: id });
  const l03 = p.invoice_create.arguments.items.filter((i) => /Website audit/.test(i.description));
  assert.equal(l03.length, 2, "a changed line is a reversal and a revised item");
  assert.match(l03[0].description, /^Website audit \(was 3 x EUR 450\.00, reversed: Two more sites in scope, volume price agreed\)$/);
  assert.match(l03[1].description, /^Website audit \(now 5 x EUR 420\.00\)$/);
  for (const i of [...p.invoice_create.arguments.items, ...p.quote_create.arguments.items, ...p.items]) {
    assert.doesNotMatch(i.description, /\b(45000|42000|3999)\b/, `a minor figure reached a description: ${i.description}`);
  }
  // The invoice items are in MAJOR units, and the description now says the same thing the unit price does.
  assert.equal(l03[0].unit_price, 450);
  assert.equal(l03[1].unit_price, 420);
});
