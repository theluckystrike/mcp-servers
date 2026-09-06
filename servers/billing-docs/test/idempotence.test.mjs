// docs/DIST_R19_RESULT.md finding 3: a create tool that takes a byte-identical record
// twice writes two documents and, on free, spends two of the five monthly slots on one
// order with no way back short of a licence key. These probes assert the refusal, and
// that credit_note_delete / purchase_order_delete give the slot back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, seedInvoice, simpleInvoice, proKey, docsDir } from "./_client.mjs";

function open(t, { key } = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, key });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

const parse = (r) => { assert.equal(r.isError, false, r.text); return JSON.parse(r.text); };
const notes = (box) => JSON.parse(readFileSync(join(docsDir(box.dataHome), "credit-notes.json"), "utf8"));
const orders = (box) => JSON.parse(readFileSync(join(docsDir(box.dataHome), "purchase-orders.json"), "utf8"));

/* ------------------------------------------------------------- duplicates */

test("credit_note_create refuses a byte-identical record and names the credit note already there", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001", { qty: 100 })); // EUR 11070.00
  await c.init();
  const first = parse(await c.call("credit_note_create", {
    invoice: "INV-2026-0001", reason: "Returned Goods", issue_date: "2026-09-02", amount_minor: 12300,
  }));
  const id = first.created.id;

  // The same record, differently typed: extra spacing and a different case on every
  // free-text field, an invoice number in lower case. Normalised, it is the same document.
  const again = await c.call("credit_note_create", {
    invoice: "inv-2026-0001", reason: "  returned   GOODS ", issue_date: "2026-09-02", amount_minor: 12300,
  });
  assert.equal(again.isError, true, again.text);
  assert.match(again.text, new RegExp(`${id} is already this credit note, field for field`), again.text);
  assert.match(again.text, /Nothing was written and no free-tier document slot was used/);
  assert.match(again.text, /credit_note_delete/);
  assert.equal(notes(box).length, 1, "the refused duplicate left no row");
});

test("purchase_order_create refuses a byte-identical record and names the order already there", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  await c.init();
  const args = {
    supplier: "Widget Co", issue_date: "2026-09-01", expected_delivery_date: "2026-09-10",
    items: [{ description: "Cables", quantity: 2, unit_price_minor: 1000 }],
  };
  const first = parse(await c.call("purchase_order_create", args));
  const id = first.created.id;

  const again = await c.call("purchase_order_create", {
    ...args, supplier: "  widget   CO ", items: [{ description: " CABLES ", quantity: 2, unit_price_minor: 1000 }],
  });
  assert.equal(again.isError, true, again.text);
  assert.match(again.text, new RegExp(`${id} is already this purchase order, field for field`), again.text);
  assert.match(again.text, /Nothing was written and no free-tier document slot was used/);
  assert.match(again.text, /purchase_order_delete/);
  assert.equal(orders(box).length, 1, "the refused duplicate left no row");

  // A document that differs in one field is not a duplicate.
  const different = await c.call("purchase_order_create", { ...args, items: [{ description: "Cables", quantity: 3, unit_price_minor: 1000 }] });
  assert.equal(different.isError, false, different.text);
  assert.equal(orders(box).length, 2);
});

test("the duplicate refusal fires under the cap, and burns no document id", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const args = { supplier: "Widget Co", issue_date: "2026-09-01", items: [{ description: "Cables", quantity: 1, unit_price_minor: 1000 }] };
  const first = parse(await c.call("purchase_order_create", args));
  assert.equal(first.created.id, "PO-2026-0001");
  // One of five slots used: nowhere near the cap, and the refusal is still the duplicate one.
  const again = await c.call("purchase_order_create", args);
  assert.equal(again.isError, true, again.text);
  assert.match(again.text, /is already this purchase order/);
  assert.doesNotMatch(again.text, /free tier issues 5 documents/, "a duplicate is not a cap problem");
  // The next real order takes 0002: a refused document must not eat a number either.
  const next = parse(await c.call("purchase_order_create", { ...args, supplier: "Other Co" }));
  assert.equal(next.created.id, "PO-2026-0002");
});

/* ----------------------------------------------------- delete returns a slot */

test("credit_note_delete gives the free monthly slot back: fill the cap, delete one, create again", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001", { qty: 100 })); // EUR 11070.00
  await c.init();
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const r = parse(await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: `slice ${i}`, amount_minor: 1000, issue_date: "2026-09-02" }));
    ids.push(r.created.id);
  }
  const over = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "slice 5", amount_minor: 1000, issue_date: "2026-09-02" });
  assert.equal(over.isError, true, over.text);
  assert.match(over.text, /free tier issues 5 documents/);

  const gone = parse(await c.call("credit_note_delete", { id: ids[0] }));
  assert.equal(gone.deleted.id, ids[0]);
  assert.match(gone.notes.join(" "), /4 of 5 documents used in 2026-09/);
  assert.equal(notes(box).length, 4, "the row is off the store, which is what the cap counts");
  // The money is creditable again.
  assert.equal(gone.invoice.still_creditable_minor, 1107000 - 4000);

  const after = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "slice 5", amount_minor: 1000, issue_date: "2026-09-02" });
  assert.equal(after.isError, false, `the slot must genuinely come back: ${after.text}`);
  assert.equal(notes(box).length, 5);
});

test("purchase_order_delete gives the free monthly slot back", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const r = parse(await c.call("purchase_order_create", { supplier: `S${i}`, issue_date: "2026-09-02", items: [{ description: "X", quantity: 1, unit_price_minor: 100 }] }));
    ids.push(r.created.id);
  }
  const over = await c.call("purchase_order_create", { supplier: "S5", issue_date: "2026-09-02", items: [{ description: "X", quantity: 1, unit_price_minor: 100 }] });
  assert.equal(over.isError, true, over.text);

  const gone = parse(await c.call("purchase_order_delete", { id: ids[0] }));
  assert.equal(gone.deleted.id, ids[0]);
  assert.match(gone.notes.join(" "), /4 of 5 documents used in 2026-09/);
  assert.equal(orders(box).length, 4);

  const after = await c.call("purchase_order_create", { supplier: "S5", issue_date: "2026-09-02", items: [{ description: "X", quantity: 1, unit_price_minor: 100 }] });
  assert.equal(after.isError, false, `the slot must genuinely come back: ${after.text}`);
  assert.equal(orders(box).length, 5);
  // Deleting one document releases a slot the OTHER kind can take too: the cap is shared.
  parse(await c.call("purchase_order_delete", { id: ids[1] }));
  const cross = await c.call("purchase_order_create", { supplier: "S6", issue_date: "2026-09-02", items: [{ description: "X", quantity: 1, unit_price_minor: 100 }] });
  assert.equal(cross.isError, false, cross.text);
});

/* ------------------------------------------------------ dependents refuse it */

test("credit_note_delete refuses a credit note posted to its invoice, naming the invoice", async (t) => {
  const { box, c } = open(t);
  // An invoice record that DOES carry credited_minor: syncInvoiceCredited then posts the
  // credit note onto it, and the note is no longer only a record in this server.
  const inv = simpleInvoice("INV-2026-0001", { qty: 100 });
  inv.credited_minor = 0;
  seedInvoice(box.dataHome, inv);
  await c.init();
  const made = parse(await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods", amount_minor: 12300 }));
  const id = made.created.id;

  const r = await c.call("credit_note_delete", { id });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, new RegExp(`${id} has something depending on it`), r.text);
  assert.match(r.text, /invoice INV-2026-0001 carries credited_minor 12300/, r.text);
  assert.match(r.text, /Nothing was removed/);
  assert.equal(notes(box).length, 1, "the refused delete left the row where it was");
});

test("credit_note_delete refuses a credit note that has been rendered, naming the file", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001", { qty: 100 }));
  await c.init();
  const made = parse(await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods", amount_minor: 12300 }));
  const id = made.created.id;
  const pdfDir = join(docsDir(box.dataHome), "pdf");
  mkdirSync(pdfDir, { recursive: true });
  const file = join(pdfDir, `${id}.pdf`);
  writeFileSync(file, "%PDF-1.4\n");

  const r = await c.call("credit_note_delete", { id });
  assert.equal(r.isError, true, r.text);
  assert.ok(r.text.includes(`${file} was rendered from it`), r.text);
  assert.equal(notes(box).length, 1);
});

test("purchase_order_delete refuses an order with a receipt, naming that receipt", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const made = parse(await c.call("purchase_order_create", {
    supplier: "Hetzner", issue_date: "2026-09-01", items: [{ description: "Server", quantity: 2, unit_price_minor: 4500 }],
  }));
  const id = made.created.id;
  parse(await c.call("purchase_order_receive", { id, partial: true, date: "2026-09-03", note: "1 of 2 arrived" }));

  const r = await c.call("purchase_order_delete", { id });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, new RegExp(`${id} has something depending on it`), r.text);
  assert.match(r.text, /1 receipt recorded against it, the last on 2026-09-03 \("1 of 2 arrived"\)/, r.text);
  assert.match(r.text, /Nothing was removed/);
  assert.equal(orders(box).length, 1, "the refused delete left the row where it was");

  // A full receipt is refused the same way.
  parse(await c.call("purchase_order_receive", { id, date: "2026-09-04", note: "the second one" }));
  const closed = await c.call("purchase_order_delete", { id });
  assert.equal(closed.isError, true, closed.text);
  assert.match(closed.text, /2 receipts recorded against it, the last on 2026-09-04/, closed.text);
});

test("purchase_order_delete refuses an order that has been rendered, naming the file", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const made = parse(await c.call("purchase_order_create", {
    supplier: "Hetzner", issue_date: "2026-09-01", items: [{ description: "Server", quantity: 2, unit_price_minor: 4500 }],
  }));
  const id = made.created.id;
  const pdfDir = join(docsDir(box.dataHome), "pdf");
  mkdirSync(pdfDir, { recursive: true });
  const file = join(pdfDir, `${id}.pdf`);
  writeFileSync(file, "%PDF-1.4\n");

  const r = await c.call("purchase_order_delete", { id });
  assert.equal(r.isError, true, r.text);
  assert.ok(r.text.includes(`${file} was rendered from it`), r.text);
  assert.equal(orders(box).length, 1);
});

test("both delete tools refuse an id that is not there, and say which tool lists the ids", async (t) => {
  const { c } = open(t);
  await c.init();
  const cn = await c.call("credit_note_delete", { id: "CN-2026-0999" });
  assert.equal(cn.isError, true);
  assert.match(cn.text, /no credit note matches "CN-2026-0999". Run credit_note_list/);
  const po = await c.call("purchase_order_delete", { id: "PO-2026-0999" });
  assert.equal(po.isError, true);
  assert.match(po.text, /no purchase order matches "PO-2026-0999". Run purchase_order_list/);
});
