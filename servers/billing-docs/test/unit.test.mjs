// Unit suite: the happy paths of both documents, through the real stdio server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, seedInvoice, simpleInvoice, proKey, docsDir } from "./_client.mjs";

function open(t, { key } = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, key });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}
const parse = (r) => { assert.equal(r.isError, false, r.text); return JSON.parse(r.text); };

test("a full credit note copies the invoice's stored lines and totals, negated", async (t) => {
  const { box, c } = open(t);
  const inv = seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  const r = parse(await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods" }));
  assert.equal(r.created.id, "CN-2026-0001");
  assert.equal(r.created.basis, "full");
  assert.equal(r.created.total_minor, -inv.total_minor);
  assert.equal(r.created.total, "EUR -1107.00");
  assert.equal(r.created.lines[0].unit_price_minor, -inv.lines[0].unit_price_minor);
  assert.equal(r.created.lines[0].quantity, inv.lines[0].quantity, "the quantity stays positive; the money is what flips");
  assert.equal(r.created.tax[0], "23% on EUR -900.00 = EUR -207.00");
  assert.equal(r.invoice.still_creditable_minor, 0);

  const stored = JSON.parse(readFileSync(join(docsDir(box.dataHome), "credit-notes.json"), "utf8"));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].total_minor, -110700);
  assert.equal(stored[0].tax_minor, -20700);
  assert.equal(stored[0].invoice_number, "INV-2026-0001");
});

test("a credit note by amount splits the gross across the invoice's VAT rates and reuses each rate", async (t) => {
  const { box, c } = open(t);
  // Two rates: 1000.00 at 23% and 500.00 at 8%.
  const line = (d, unit, rate) => ({
    description: d, quantity: 1, unit_price_minor: unit, tax_rate: rate,
    gross_minor: unit, discount_minor: 0, net_minor: unit, tax_minor: Math.round(unit * rate / 100),
    exact_gross_minor: unit, round_total: false,
  });
  const l1 = line("Consulting", 100000, 23), l2 = line("Print", 50000, 8);
  seedInvoice(box.dataHome, {
    number: "INV-2026-0009", client_id: "c1", client: { name: "Mixed Ltd" },
    issue_date: "2026-09-01", due_date: "2026-09-15", currency: "EUR", decimals: 2,
    lines: [l1, l2], subtotal_minor: 150000, discount_percent: 0, discount_minor: 0, net_minor: 150000,
    tax_lines: [{ rate: 8, base_minor: 50000, tax_minor: 4000 }, { rate: 23, base_minor: 100000, tax_minor: 23000 }],
    tax_minor: 27000, total_minor: 177000, status: "unpaid", paid_minor: 0,
    created: "2026-09-01T00:00:00.000Z", branded: true,
  });
  await c.init();
  const r = parse(await c.call("credit_note_create", { invoice: "INV-2026-0009", reason: "partial goodwill", amount_minor: 17700 }));
  assert.equal(r.created.total_minor, -17700, "the credit lands on the asked gross amount exactly");
  assert.equal(r.created.lines.length, 2, "one credit line per VAT rate on the invoice");
  const rates = r.created.lines.map((l) => l.tax_rate).sort();
  assert.deepEqual(rates, ["23%", "8%"], "both rates on the invoice are carried into the credit note");
  // 10% of the invoice, so 10% of each rate's own share, not all of it at the top rate.
  assert.equal(r.created.tax.length, 2);
});

test("a credit note by line credits only the named lines, at the invoiced unit price", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001", { qty: 10, unit: 9000 }));
  await c.init();
  const r = parse(await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "2 units back", lines: [{ line: 1, quantity: 2 }] }));
  assert.equal(r.created.basis, "lines");
  assert.equal(r.created.lines[0].quantity, 2);
  assert.equal(r.created.lines[0].unit_price_minor, -9000);
  assert.equal(r.created.total_minor, -22140, "2 x 90.00 = 180.00 plus 23% = 221.40");
  assert.equal(r.invoice.still_creditable_minor, 110700 - 22140);
});

test("credit_note_list totals per currency and filters by invoice", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0002", { client: "Beta Oy" }));
  await c.init();
  await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "a", amount_minor: 10000 });
  await c.call("credit_note_create", { invoice: "INV-2026-0002", reason: "b", amount_minor: 20000 });
  const all = parse(await c.call("credit_note_list", {}));
  assert.equal(all.count, 2);
  assert.equal(all.credited[0].total_minor, -30000);
  const one = parse(await c.call("credit_note_list", { invoice: "INV-2026-0002" }));
  assert.equal(one.count, 1);
  assert.equal(one.credit_notes[0].client, "Beta Oy");
});

test("purchase orders: buyer from the shared profile, PO ids per year, receive in part then in full", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const r = parse(await c.call("purchase_order_create", {
    supplier: "Widget Co", currency: "EUR", expected_delivery_date: "2026-09-20",
    items: [{ description: "Cables", quantity: 4, unit_price_minor: 2500, tax_rate: 23 }],
  }));
  assert.equal(r.created.id, "PO-2026-0001");
  assert.equal(r.created.status, "open");
  assert.equal(r.created.total_minor, 12300);
  assert.equal(r.created.buyer.name, "Your business", "no profile on this machine, so the buyer is the placeholder and the answer says so");

  const part = parse(await c.call("purchase_order_receive", { id: "PO-2026-0001", partial: true, note: "2 of 4" }));
  assert.equal(part.received.status, "partially_received");
  assert.equal(part.receipts.length, 1);
  const full = parse(await c.call("purchase_order_receive", { id: "PO-2026-0001", note: "the rest" }));
  assert.equal(full.received.status, "received");
  assert.equal(full.receipts.length, 2, "the partial receipt stays on the record");
  assert.ok(full.received.received_date);
});

test("text export is free and lands the amount column under the line amounts", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods" });
  const r = await c.call("credit_note_text", { id: "CN-2026-0001" });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /against invoice INV-2026-0001/);
  assert.match(r.text, /EUR -1107\.00/);
  const rows = r.text.split("\n").filter((l) => /EUR -/.test(l));
  const ends = new Set(rows.map((l) => l.trimEnd().length));
  assert.equal(ends.size, 1, `every money row must end in the same column:\n${rows.join("\n")}`);
});

test("PDFs are Pro and carry the document title and the invoice number", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods" });
  const out = join(box.dir, "cn.pdf");
  const r = parse(await c.call("credit_note_pdf", { id: "CN-2026-0001", out_path: out }));
  assert.equal(r.path, out);
  assert.ok(existsSync(out) && statSync(out).size > 800, "a real PDF was written");
  const bytes = readFileSync(out, "latin1");
  assert.match(bytes, /^%PDF-/);
  assert.match(bytes, /Credit note CN-2026-0001/, "the PDF metadata names the document");

  const po = parse(await c.call("purchase_order_create", { supplier: "Widget Co", items: [{ description: "Cables", quantity: 1, unit_price_minor: 1000 }] }));
  const out2 = join(box.dir, "po.pdf");
  parse(await c.call("purchase_order_pdf", { id: po.created.id, out_path: out2 }));
  assert.match(readFileSync(out2, "latin1"), /Purchase order PO-2026-0001/);
});

test("billing_docs_report answers credited totals per currency and the open orders", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "goodwill", amount_minor: 12300 });
  await c.call("purchase_order_create", { supplier: "Widget Co", currency: "EUR", items: [{ description: "Cables", quantity: 1, unit_price_minor: 5000 }], issue_date: "2026-08-01", expected_delivery_date: "2026-08-10" });
  const r = parse(await c.call("billing_docs_report", {}));
  assert.equal(r.credit_notes, 1);
  assert.equal(r.credited_by_currency[0].credited_minor, -12300);
  assert.equal(r.credited_by_currency[0].invoices_credited, 1);
  assert.equal(r.open_purchase_orders, 1);
  assert.equal(r.on_order_by_currency[0].on_order_minor, 5000);
  assert.equal(r.overdue_deliveries.length, 1, "a delivery date in the past is reported late");
  assert.ok(r.overdue_deliveries[0].days_late > 0);
});
