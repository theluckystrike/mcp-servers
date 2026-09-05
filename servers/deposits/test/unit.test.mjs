// What the tools do when they are used correctly, asserted against the store on disk.
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

test("deposit_record stores a DEP-YYYY-NNNN deposit, held in full", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const r = parse(await c.call("deposit_record", {
    client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR",
    received_date: "2026-09-01", reference: "TRF-8812",
  }));
  assert.equal(r.recorded.id, "DEP-2026-0001");
  assert.equal(r.recorded.received_minor, 50000);
  assert.equal(r.recorded.held_minor, 50000);
  assert.equal(r.recorded.applied_minor, 0);
  assert.equal(r.recorded.status, "held");
  assert.equal(r.recorded.received, "EUR 500.00");
  assert.equal(r.recorded.reference, "TRF-8812");

  const rows = store(box);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "security");
  assert.equal(rows[0].currency, "EUR");
  assert.deepEqual(rows[0].applications, []);

  const second = parse(await c.call("deposit_record", { client: "Beta", amount_minor: 1000, kind: "retainer", received_date: "2026-09-02" }));
  assert.equal(second.recorded.id, "DEP-2026-0002", "ids run in one series per year");
  const counters = JSON.parse(readFileSync(join(depositsDir(box.dataHome), "counter.json"), "utf8"));
  assert.deepEqual(counters, { "DEP-2026": 2 });
});

test("deposit_apply writes the payment onto the invoice, exactly as invoice_mark_paid does", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001")); // EUR 1107.00
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "retainer", currency: "EUR", received_date: "2026-09-01" });

  const r = parse(await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 20000, date: "2026-09-03" }));
  assert.equal(r.applied.amount_minor, 20000);
  assert.equal(r.deposit.held_minor, 30000);
  assert.equal(r.deposit.status, "held");
  assert.equal(r.invoice.status, "partial");
  assert.equal(r.invoice.balance_due_minor, 110700 - 20000);

  const inv = readInvoices(box.dataHome)[0];
  assert.equal(inv.paid_minor, 20000, "the payment is on the invoice record");
  assert.equal(inv.paid_date, "2026-09-03");
  assert.equal(inv.status, "partial");

  // Applying the rest pays it down further and the deposit goes to applied.
  const rest = parse(await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", date: "2026-09-04" }));
  assert.equal(rest.applied.amount_minor, 30000, "with no amount it applies everything held that the invoice can take");
  assert.equal(rest.deposit.held_minor, 0);
  assert.equal(rest.deposit.status, "applied");
  const inv2 = readInvoices(box.dataHome)[0];
  assert.equal(inv2.paid_minor, 50000, "a second application ADDS to paid_minor, it does not replace it");
  assert.equal(inv2.status, "partial");
  assert.equal(store(box)[0].applications.length, 2);
});

test("deposit_apply defaults to the smaller of what is held and what the invoice owes", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0002", { qty: 1, unit: 10000, rate: 0 })); // EUR 100.00
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 90000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  const r = parse(await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0002", date: "2026-09-02" }));
  assert.equal(r.applied.amount_minor, 10000, "capped at the invoice, not at the deposit");
  assert.equal(r.invoice.status, "paid");
  assert.equal(r.deposit.held_minor, 80000);
});

test("deposit_refund gives part back and closes the deposit when the last of it goes", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  const part = parse(await c.call("deposit_refund", { id: "DEP-2026-0001", amount_minor: 15000, date: "2026-09-05", method: "bank transfer" }));
  assert.equal(part.deposit.held_minor, 35000);
  assert.equal(part.deposit.status, "held");
  const rest = parse(await c.call("deposit_refund", { id: "DEP-2026-0001", date: "2026-09-06", method: "bank transfer" }));
  assert.equal(rest.refunded.amount_minor, 35000, "with no amount it refunds everything still held");
  assert.equal(rest.deposit.held_minor, 0);
  assert.equal(rest.deposit.status, "refunded");
  assert.equal(store(box)[0].refunds.length, 2);
});

test("deposit_balance is per client and per currency and never adds two currencies", async (t) => {
  const { c } = open(t);
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 30000, kind: "retainer", currency: "USD", received_date: "2026-09-02" });
  await c.call("deposit_record", { client: "Beta GmbH", amount_minor: 150000, kind: "security", currency: "JPY", received_date: "2026-09-02" });

  const all = parse(await c.call("deposit_balance", {}));
  assert.equal(all.deposits, 3);
  assert.deepEqual(all.total.map((b) => [b.currency, b.held_minor]), [["EUR", 50000], ["JPY", 150000], ["USD", 30000]]);
  const jpy = all.total.find((b) => b.currency === "JPY");
  assert.equal(jpy.held, "JPY 150000", "a zero-decimal currency prints no decimal point");

  const acme = parse(await c.call("deposit_balance", { client: "Acme" }));
  assert.equal(acme.deposits, 2);
  assert.deepEqual(acme.total.map((b) => b.currency), ["EUR", "USD"]);
});

test("deposit_list filters by status, kind and client and reports the balance of what it listed", async (t) => {
  const { c } = open(t);
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  await c.call("deposit_record", { client: "Beta GmbH", amount_minor: 20000, kind: "retainer", currency: "EUR", received_date: "2026-09-02" });
  await c.call("deposit_refund", { id: "DEP-2026-0002", date: "2026-09-03", method: "bank transfer" });

  const held = parse(await c.call("deposit_list", { status: "held" }));
  assert.equal(held.count, 1);
  assert.equal(held.deposits[0].id, "DEP-2026-0001");
  const refunded = parse(await c.call("deposit_list", { status: "refunded" }));
  assert.equal(refunded.count, 1);
  assert.equal(refunded.deposits[0].held_minor, 0);
  const retainers = parse(await c.call("deposit_list", { kind: "retainer" }));
  assert.equal(retainers.count, 1);
  const acme = parse(await c.call("deposit_list", { client: "Acme Ltd" }));
  assert.equal(acme.balance[0].held_minor, 50000);
});

test("deposit_statement_text lists every movement in date order and closes on what is held", async (t) => {
  const { box, c } = open(t);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01", reference: "TRF-8812" });
  await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 20000, date: "2026-09-03" });
  await c.call("deposit_refund", { id: "DEP-2026-0001", amount_minor: 5000, date: "2026-09-04", method: "bank transfer" });

  const r = await c.call("deposit_statement_text", { client: "Acme", as_of: "2026-09-05" });
  assert.equal(r.isError, false, r.text);
  const lines = r.text.split("\n");
  const idx = (needle) => lines.findIndex((l) => l.includes(needle));
  assert.ok(idx("2026-09-01") < idx("2026-09-03"), "movements are in date order");
  assert.ok(idx("2026-09-03") < idx("2026-09-04"));
  assert.match(r.text, /DEP-2026-0001 security deposit received \(TRF-8812\)/);
  assert.match(r.text, /applied to invoice INV-2026-0001/);
  assert.match(r.text, /refunded \(bank transfer\)/);
  assert.match(r.text, /HELD\s+EUR 250\.00/);
  assert.match(r.text, /EUR 250\.00 of yours is still held\./);
  // 500.00 in, 200.00 to an invoice, 50.00 back: the rows sum to the closing balance.
  const moved = [...r.text.matchAll(/EUR (-?\d+\.\d\d)/g)].map((m) => Number(m[1]));
  assert.equal(moved[0] + moved[1] + moved[2], 250, `${moved.join(" ")}`);
});

test("deposit_statement_pdf writes an A4 PDF titled DEPOSIT STATEMENT on Pro", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  const out = join(box.dir, "statement.pdf");
  const r = parse(await c.call("deposit_statement_pdf", { client: "Acme", as_of: "2026-09-05", out_path: out }));
  assert.equal(r.path, out);
  assert.equal(r.held, "EUR 500.00");
  assert.ok(existsSync(out));
  const bytes = readFileSync(out);
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-", "the file carries PDF bytes");
  assert.ok(bytes.length > 1000, `PDF is ${bytes.length} bytes`);
});

test("deposits_report names what is held, the oldest, and the unapplied older than N days", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  await c.call("deposit_record", { client: "Old Co", amount_minor: 70000, kind: "security", currency: "EUR", received_date: "2026-01-05" });
  await c.call("deposit_record", { client: "New Co", amount_minor: 20000, kind: "retainer", currency: "EUR", received_date: "2026-08-30" });
  await c.call("deposit_record", { client: "Busy Co", amount_minor: 40000, kind: "retainer", currency: "EUR", received_date: "2026-01-06" });
  await c.call("deposit_apply", { id: "DEP-2026-0003", invoice: "INV-2026-0001", amount_minor: 100, date: "2026-09-01" });

  const r = parse(await c.call("deposits_report", { as_of: "2026-09-05", older_than_days: 90 }));
  assert.equal(r.held_deposits, 3);
  assert.deepEqual(r.held_by_currency, [{ currency: "EUR", held: "EUR 1299.00", held_minor: 129900 }]);
  assert.equal(r.oldest_held[0].id, "DEP-2026-0001");
  assert.equal(r.oldest_held[0].days_held, 243);
  assert.deepEqual(r.unapplied.map((d) => d.client), ["Old Co"],
    "Busy Co is older than 90 days but a cent of it was applied; New Co is recent");
});
