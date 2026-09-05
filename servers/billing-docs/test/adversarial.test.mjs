// Adversarial suite: the refusals. Every row here is a way to take back more money than
// was billed, to bill it twice, or to store a document that does not add up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, seedInvoice, simpleInvoice, proKey, docsDir } from "./_client.mjs";

function open(t, { key } = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, key });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}
const parse = (r) => { assert.equal(r.isError, false, r.text); return JSON.parse(r.text); };
const notes = (box) => {
  const f = join(docsDir(box.dataHome), "credit-notes.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : [];
};

test("credit_note_create refuses to credit more than the invoice, in every mode", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001")); // EUR 1107.00
  await c.init();

  const over = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "too much", amount_minor: 110701 });
  assert.equal(over.isError, true, over.text);
  assert.match(over.text, /at most EUR 1107\.00 can still be credited/);
  assert.match(over.text, /Nothing was stored/);
  assert.equal(notes(box).length, 0, "a refused credit note writes nothing at all");

  const lines = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "more units than were sold", lines: [{ line: 1, quantity: 11 }] });
  assert.equal(lines.isError, true);
  assert.match(lines.text, /quantity of 10, so 11 cannot be credited/);
  assert.equal(notes(box).length, 0);
});

test("double credit: a second full credit note against the same invoice is refused", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  parse(await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods" }));
  const again = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods" });
  assert.equal(again.isError, true, again.text);
  assert.match(again.text, /EUR 1107\.00 of it has already been credited/);
  assert.match(again.text, /at most EUR 0\.00 can still be credited/);
  assert.equal(notes(box).length, 1, "the store still holds exactly one credit note");
});

test("partial credits accumulate: the last one that fits is taken and the next cent is refused", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  for (let i = 0; i < 3; i++) {
    const r = parse(await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: `slice ${i}`, amount_minor: 36900 }));
    assert.equal(r.created.total_minor, -36900);
  }
  const list = parse(await c.call("credit_note_list", { invoice: "INV-2026-0001" }));
  assert.equal(list.credited[0].total_minor, -110700, "three slices sum to the whole invoice");
  const one = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "one cent more", amount_minor: 1 });
  assert.equal(one.isError, true, one.text);
  assert.equal(notes(box).length, 3);
});

test("credit_note_create refuses an invoice that does not exist, and says which do", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  const r = await c.call("credit_note_create", { invoice: "INV-2026-0999", reason: "typo" });
  assert.equal(r.isError, true);
  assert.match(r.text, /no invoice numbered "INV-2026-0999"/);
  assert.match(r.text, /INV-2026-0001/);
  assert.equal(notes(box).length, 0);
});

test("credit_note_create refuses a line that is not on the invoice and a line given twice", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  const missing = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "x", lines: [{ line: 4 }] });
  assert.equal(missing.isError, true);
  assert.match(missing.text, /has 1 line\(s\), so there is no line 4/);
  const twice = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "x", lines: [{ line: 1, quantity: 5 }, { line: 1, quantity: 5 }] });
  assert.equal(twice.isError, true);
  assert.match(twice.text, /line 1 was given twice/);
  assert.equal(notes(box).length, 0);
});

test("amount_minor and lines together are refused rather than one silently winning", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  const r = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "x", amount_minor: 100, lines: [{ line: 1 }] });
  assert.equal(r.isError, true);
  assert.match(r.text, /pass amount_minor or lines, not both/);
  assert.equal(notes(box).length, 0);
});

test("a decimal or negative amount is refused by the schema before any server code runs", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  const dec = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "x", amount_minor: 90.5 });
  assert.equal(dec.isError, true);
  assert.match(dec.text, /whole number of minor units/);
  const neg = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "x", amount_minor: -100 });
  assert.equal(neg.isError, true);
  assert.match(neg.text, /greater than zero/);
  const noReason = await c.call("credit_note_create", { invoice: "INV-2026-0001" });
  assert.equal(noReason.isError, true);
  assert.match(noReason.text, /reason/);
  assert.equal(notes(box).length, 0);
});

test("purchase_order_receive refuses a second full receipt and a receipt before the order", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  await c.init();
  parse(await c.call("purchase_order_create", { supplier: "Widget Co", issue_date: "2026-09-01", items: [{ description: "Cables", quantity: 1, unit_price_minor: 1000 }] }));
  parse(await c.call("purchase_order_receive", { id: "PO-2026-0001", date: "2026-09-03" }));
  const again = await c.call("purchase_order_receive", { id: "PO-2026-0001" });
  assert.equal(again.isError, true, again.text);
  assert.match(again.text, /already received in full on 2026-09-03/);

  parse(await c.call("purchase_order_create", { supplier: "Widget Co", issue_date: "2026-09-01", items: [{ description: "Cables", quantity: 1, unit_price_minor: 1000 }] }));
  const early = await c.call("purchase_order_receive", { id: "PO-2026-0002", date: "2026-08-01" });
  assert.equal(early.isError, true);
  assert.match(early.text, /before the order date 2026-09-01/);
});

test("purchase_order_create refuses a mixed-currency order and a delivery date before the order", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  await c.init();
  const mixed = await c.call("purchase_order_create", {
    supplier: "Widget Co",
    items: [{ description: "A", quantity: 1, unit_price_minor: 100, currency: "EUR" }, { description: "B", quantity: 1, unit_price_minor: 100, currency: "USD" }],
  });
  assert.equal(mixed.isError, true);
  assert.match(mixed.text, /more than one currency \(EUR, USD\)/);
  const back = await c.call("purchase_order_create", {
    supplier: "Widget Co", issue_date: "2026-09-01", expected_delivery_date: "2026-08-01",
    items: [{ description: "A", quantity: 1, unit_price_minor: 100 }],
  });
  assert.equal(back.isError, true);
  assert.match(back.text, /is before the order date/);
  const list = parse(await c.call("purchase_order_list", {}));
  assert.equal(list.count, 0, "neither refused order was stored");
});

test("an ambiguous reference is refused with the candidates rather than acting on the first", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  await c.init();
  await c.call("purchase_order_create", { supplier: "Acme Ltd", items: [{ description: "A", quantity: 1, unit_price_minor: 100 }] });
  await c.call("purchase_order_create", { supplier: "Acme Digital", items: [{ description: "B", quantity: 1, unit_price_minor: 100 }] });
  const r = await c.call("purchase_order_receive", { id: "Acme" });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /matches more than one purchase order/);
  assert.match(r.text, /Pass the exact id/);
});

test("free tier: five documents a month across both kinds, then a refusal naming the cap", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001", { qty: 100 }));
  await c.init();
  for (let i = 0; i < 3; i++) {
    const r = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: `slice ${i}`, amount_minor: 1000, issue_date: "2026-09-02" });
    assert.equal(r.isError, false, r.text);
  }
  for (let i = 0; i < 2; i++) {
    const r = await c.call("purchase_order_create", { supplier: "Widget Co", issue_date: "2026-09-02", items: [{ description: "Cables", quantity: 1, unit_price_minor: 1000 }] });
    assert.equal(r.isError, false, r.text);
  }
  const sixth = await c.call("purchase_order_create", { supplier: "Widget Co", issue_date: "2026-09-02", items: [{ description: "Cables", quantity: 1, unit_price_minor: 1000 }] });
  assert.equal(sixth.isError, true, sixth.text);
  assert.match(sixth.text, /five documents a month|5 documents a month/);
  assert.match(sixth.text, /https:\/\/mcp\.zovo\.one\/buy\/billing-docs\?src=billing-docs\.purchase_order_create/);
  // A document dated in another month is not blocked by this month's five.
  const other = await c.call("purchase_order_create", { supplier: "Widget Co", issue_date: "2026-10-02", items: [{ description: "Cables", quantity: 1, unit_price_minor: 1000 }] });
  assert.equal(other.isError, false, other.text);
});

test("free tier: text export is free, both PDFs and the report are Pro", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  parse(await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods" }));
  assert.equal((await c.call("credit_note_text", { id: "CN-2026-0001" })).isError, false);
  parse(await c.call("purchase_order_create", { supplier: "Widget Co", items: [{ description: "Cables", quantity: 1, unit_price_minor: 1000 }] }));
  assert.equal((await c.call("purchase_order_text", { id: "PO-2026-0001" })).isError, false);
  for (const [tool, args] of [["credit_note_pdf", { id: "CN-2026-0001" }], ["purchase_order_pdf", { id: "PO-2026-0001" }], ["billing_docs_report", {}]]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} must be Pro`);
    assert.match(r.text, new RegExp(`https://mcp\\.zovo\\.one/buy/billing-docs\\?src=billing-docs\\.${tool}`), r.text);
  }
});

test("a key signed for another product does not unlock this one", async (t) => {
  const { box, c } = open(t, { key: proKey("quotes") });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  parse(await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods" }));
  const r = await c.call("credit_note_pdf", { id: "CN-2026-0001" });
  assert.equal(r.isError, true, r.text);
});

test("a zero-decimal currency is credited with no decimal point", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0007", { currency: "JPY", qty: 2, unit: 150000, rate: 0 }));
  await c.init();
  const r = parse(await c.call("credit_note_create", { invoice: "INV-2026-0007", reason: "cancelled" }));
  assert.equal(r.created.total, "JPY -300000");
  assert.equal(r.created.lines[0].unit_price, "JPY -150000");
});

test("stdout carries JSON-RPC only, on the success path and on the error path", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  await c.tools();
  await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods" });
  await c.call("credit_note_create", { invoice: "nope", reason: "x" });
  await new Promise((r) => setTimeout(r, 150));
  const lines = [...c.stdoutLines, c.tail].filter((l) => l.trim() !== "");
  assert.ok(lines.length >= 4);
  for (const line of lines) {
    const m = JSON.parse(line);
    assert.equal(m.jsonrpc, "2.0", line.slice(0, 200));
  }
});
