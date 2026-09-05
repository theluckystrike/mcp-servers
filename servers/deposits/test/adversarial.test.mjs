// What the tools refuse. Every row asserts BOTH the refusal and that nothing was written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, proKey, depositsDir, readInvoices, seedInvoice, simpleInvoice } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}
const parse = (r) => { assert.equal(r.isError, false, r.text); return JSON.parse(r.text); };
const store = (box) => JSON.parse(readFileSync(join(depositsDir(box.dataHome), "deposits.json"), "utf8"));

test("over-apply: more than is held is refused, and so is more than the invoice owes", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001")); // EUR 1107.00
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });

  const over = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 50001, date: "2026-09-02" });
  assert.equal(over.isError, true, over.text);
  assert.match(over.text, /holds EUR 500\.00 and this would apply EUR 500\.01/);
  assert.match(over.text, /Nothing was changed/);
  assert.deepEqual(store(box)[0].applications, [], "the refused application left no row");
  assert.equal(readInvoices(box.dataHome)[0].paid_minor, 0, "and no payment on the invoice");

  // Apply 400.00, then try 200.00 of the 100.00 that is left.
  parse(await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 40000, date: "2026-09-02" }));
  const again = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 20000, date: "2026-09-02" });
  assert.equal(again.isError, true, again.text);
  assert.match(again.text, /holds EUR 100\.00/);
  assert.equal(store(box)[0].applications.length, 1);
  assert.equal(readInvoices(box.dataHome)[0].paid_minor, 40000);
});

test("over-apply against the invoice: more than the open balance is refused", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0002", { qty: 1, unit: 10000, rate: 0 })); // EUR 100.00
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  const r = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0002", amount_minor: 20000, date: "2026-09-02" });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /still owes EUR 100\.00 and this would apply EUR 200\.00/);
  assert.match(r.text, /overpaid/);
  assert.equal(readInvoices(box.dataHome)[0].paid_minor, 0);
});

test("apply on an invoice that is already paid in full is refused", async (t) => {
  const { box, c } = open(t);
  const inv = simpleInvoice("INV-2026-0003", { qty: 1, unit: 10000, rate: 0 });
  inv.paid_minor = inv.total_minor;
  inv.status = "paid";
  inv.paid_date = "2026-09-01";
  seedInvoice(box.dataHome, inv);
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  const r = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0003", amount_minor: 100, date: "2026-09-02" });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /already paid in full/);
  assert.equal(readInvoices(box.dataHome)[0].paid_minor, 10000, "the paid invoice is untouched");
  assert.deepEqual(store(box)[0].applications, []);
});

test("currency mismatch between the deposit and the invoice is refused, never converted", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001", { currency: "USD" }));
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  const r = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 10000, date: "2026-09-02" });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /held in EUR and INV-2026-0001 is in USD/);
  assert.match(r.text, /never converted here/);
  assert.equal(readInvoices(box.dataHome)[0].paid_minor, 0);
  assert.deepEqual(store(box)[0].applications, []);
});

test("over-refund: more than is still held is refused, after an application too", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  const straight = await c.call("deposit_refund", { id: "DEP-2026-0001", amount_minor: 50001, date: "2026-09-02", method: "bank transfer" });
  assert.equal(straight.isError, true, straight.text);
  assert.match(straight.text, /would refund EUR 500\.01/);
  assert.deepEqual(store(box)[0].refunds, []);

  parse(await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 30000, date: "2026-09-02" }));
  const after = await c.call("deposit_refund", { id: "DEP-2026-0001", amount_minor: 25000, date: "2026-09-03", method: "bank transfer" });
  assert.equal(after.isError, true, after.text);
  assert.match(after.text, /holds EUR 200\.00/);
  assert.match(after.text, /already applied to an invoice/);
  assert.equal(store(box)[0].refunds.length, 0);

  parse(await c.call("deposit_refund", { id: "DEP-2026-0001", date: "2026-09-03", method: "bank transfer" }));
  const empty = await c.call("deposit_refund", { id: "DEP-2026-0001", amount_minor: 100, date: "2026-09-04", method: "bank transfer" });
  assert.equal(empty.isError, true, empty.text);
  assert.match(empty.text, /nothing left held/);
  assert.equal(store(box)[0].refunds.length, 1);
});

test("apply from a deposit with nothing left held is refused", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  parse(await c.call("deposit_refund", { id: "DEP-2026-0001", date: "2026-09-02", method: "bank transfer" }));
  const r = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 100, date: "2026-09-03" });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /nothing left held/);
  assert.equal(readInvoices(box.dataHome)[0].paid_minor, 0);
});

test("a decimal, a zero and a negative amount are refused at the schema, before any handler runs", async (t) => {
  const { box, c } = open(t);
  await c.init();
  for (const amount_minor of [90.5, 0, -100]) {
    const r = await c.call("deposit_record", { client: "Acme Ltd", amount_minor, kind: "security", received_date: "2026-09-01" });
    assert.equal(r.isError, true, `${amount_minor} was accepted: ${r.text}`);
  }
  assert.equal(existsSync(join(depositsDir(box.dataHome), "deposits.json")), false, "no store file was created at all");
});

test("an unknown invoice, an unknown deposit and an ambiguous name are refused by name", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  await c.call("deposit_record", { client: "Acme Holdings", amount_minor: 10000, kind: "security", currency: "EUR", received_date: "2026-09-01" });

  const noInv = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-9999", amount_minor: 100, date: "2026-09-02" });
  assert.equal(noInv.isError, true);
  assert.match(noInv.text, /INV-2026-0001/, "the refusal names the invoice numbers that do exist");

  const noDep = await c.call("deposit_refund", { id: "DEP-2026-9999", date: "2026-09-02", method: "cash" });
  assert.equal(noDep.isError, true);
  assert.match(noDep.text, /no deposit matches/);

  const ambiguous = await c.call("deposit_refund", { id: "Acme", date: "2026-09-02", method: "cash" });
  assert.equal(ambiguous.isError, true, ambiguous.text);
  assert.match(ambiguous.text, /matches more than one deposit/);
  assert.equal(store(box).every((d) => d.refunds.length === 0), true);
});

test("a movement dated before the money arrived is refused", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-10" });
  const ap = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 100, date: "2026-09-09" });
  assert.equal(ap.isError, true, ap.text);
  assert.match(ap.text, /before DEP-2026-0001 was received on 2026-09-10/);
  const rf = await c.call("deposit_refund", { id: "DEP-2026-0001", amount_minor: 100, date: "2026-09-09", method: "cash" });
  assert.equal(rf.isError, true, rf.text);
  assert.match(rf.text, /before DEP-2026-0001 was received/);
  const bad = await c.call("deposit_record", { client: "Beta", amount_minor: 100, kind: "security", received_date: "2026-02-30" });
  assert.equal(bad.isError, true, bad.text);
  assert.match(bad.text, /not a real date/);
  assert.equal(store(box).length, 1);
});

test("a statement across two currencies refuses rather than adding them up", async (t) => {
  const { c } = open(t);
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 30000, kind: "retainer", currency: "USD", received_date: "2026-09-02" });
  const r = await c.call("deposit_statement_text", { client: "Acme", as_of: "2026-09-05" });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /deposits in EUR and USD/);
  assert.match(r.text, /pass currency to choose/);
  const eur = await c.call("deposit_statement_text", { client: "Acme", currency: "EUR", as_of: "2026-09-05" });
  assert.equal(eur.isError, false, eur.text);
  assert.match(eur.text, /HELD\s+EUR 500\.00/);
  assert.equal(/USD/.test(eur.text), false, "the USD deposit is not on the EUR statement");
});

test("free tier: five deposits a month, then a refusal that names the checkout link", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  for (let i = 0; i < 5; i++) {
    const r = await c.call("deposit_record", { client: `C${i}`, amount_minor: 1000, kind: "security", currency: "EUR", received_date: "2026-09-02" });
    assert.equal(r.isError, false, r.text);
  }
  const over = await c.call("deposit_record", { client: "C5", amount_minor: 1000, kind: "security", currency: "EUR", received_date: "2026-09-02" });
  assert.equal(over.isError, true, over.text);
  assert.match(over.text, /Nothing was stored/);
  assert.ok(over.text.includes("https://mcp.zovo.one/buy/deposits?src=deposits.deposit_record"), over.text.slice(0, 400));
  assert.equal(store(box).length, 5);

  // Another month is not blocked, and the free tier can still move money it already holds.
  const next = await c.call("deposit_record", { client: "C6", amount_minor: 1000, kind: "security", currency: "EUR", received_date: "2026-10-01" });
  assert.equal(next.isError, false, next.text);
  const applied = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 1000, date: "2026-09-03" });
  assert.equal(applied.isError, false, applied.text);
  const refunded = await c.call("deposit_refund", { id: "DEP-2026-0002", date: "2026-09-03", method: "bank transfer" });
  assert.equal(refunded.isError, false, refunded.text);
  const statement = await c.call("deposit_statement_text", { client: "C2", as_of: "2026-09-05" });
  assert.equal(statement.isError, false, statement.text);

  // The two Pro tools refuse on free and write nothing.
  const pdf = await c.call("deposit_statement_pdf", { client: "C2", out_path: join(box.dir, "no.pdf") });
  assert.equal(pdf.isError, true, pdf.text);
  assert.equal(existsSync(join(box.dir, "no.pdf")), false, "the refused PDF wrote no file");
  const report = await c.call("deposits_report", {});
  assert.equal(report.isError, true, report.text);
  assert.match(report.text, /mcp\.zovo\.one\/buy\/deposits/);
});

test("a key signed for another product does not unlock the Pro tools", async (t) => {
  const { c } = open(t, { key: proKey("not-a-real-product") });
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 1000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  const r = await c.call("deposits_report", {});
  assert.equal(r.isError, true, r.text);
});
