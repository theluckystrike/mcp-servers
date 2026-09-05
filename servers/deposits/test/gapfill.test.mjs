// Part 1 gap-fill probes not already covered by unit/adversarial/corrupt/concurrency:
// two-invoice apply in one call, cross-currency apply (schema-level confirmation),
// a future received_date, a statement for a client with no deposits, a 200-deposit
// listing, and a corrupt invoice store while the deposits store is fine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, proKey, depositsDir, readInvoices, seedInvoice, simpleInvoice } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}
const parse = (r) => { assert.equal(r.isError, false, r.text); return JSON.parse(r.text); };

test("deposit_apply has no way to name two invoices in one call: the schema takes one string", async (t) => {
  const { c, box } = open(t);
  const tools = await c.tools();
  const apply = tools.find((x) => x.name === "deposit_apply");
  const invoiceProp = apply.inputSchema.properties.invoice;
  assert.equal(invoiceProp.type, "string", "invoice is a single string field, not an array: splitting one deposit across two invoices needs two deposit_apply calls");

  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001", { qty: 1, unit: 20000, rate: 0 })); // EUR 200.00
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0002", { qty: 1, unit: 20000, rate: 0 })); // EUR 200.00
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 40000, kind: "retainer", currency: "EUR", received_date: "2026-09-01" });
  // Comma- or space-joined invoice numbers are treated as one literal string and refused as unknown.
  const both = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001, INV-2026-0002", date: "2026-09-02" });
  assert.equal(both.isError, true, both.text);
  assert.match(both.text, /no invoice numbered/);
  // The supported path is two separate calls, and both succeed against the one deposit.
  parse(await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 20000, date: "2026-09-02" }));
  parse(await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0002", amount_minor: 20000, date: "2026-09-02" }));
  const invs = readInvoices(box.dataHome);
  assert.equal(invs.find((i) => i.number === "INV-2026-0001").paid_minor, 20000);
  assert.equal(invs.find((i) => i.number === "INV-2026-0002").paid_minor, 20000);
});

test("a future received_date is accepted: nothing in the schema or the handler rejects a date after today", async (t) => {
  const { c, box } = open(t);
  await c.init();
  const r = await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 10000, kind: "security", currency: "EUR", received_date: "2099-01-01" });
  assert.equal(r.isError, false, r.text);
  const rec = parse(r).recorded;
  assert.equal(rec.received_date, "2099-01-01");
  // Applying it today is refused because "today" (server clock) is BEFORE the future received_date.
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  const ap = await c.call("deposit_apply", { id: "DEP-2099-0001", invoice: "INV-2026-0001", amount_minor: 100 });
  assert.equal(ap.isError, true, ap.text);
  assert.match(ap.text, /before DEP-2099-0001 was received/);
});

test("a statement for a client with no deposits ever recorded is refused by name, not an empty statement", async (t) => {
  const { c } = open(t);
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 10000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  const r = await c.call("deposit_statement_text", { client: "Nobody Ltd" });
  assert.equal(r.isError, true, r.text);
  assert.match(r.text, /no deposit has ever been recorded for "Nobody Ltd"/);
  const bal = await c.call("deposit_balance", { client: "Nobody Ltd" });
  assert.equal(bal.isError, true, bal.text);
  assert.match(bal.text, /no deposit has ever been recorded/);
});

test("200 deposits on one client all come back from deposit_list, none dropped by the row cap", async (t) => {
  const { c, box } = open(t, { key: proKey() });
  await c.init();
  for (let i = 0; i < 200; i++) {
    const day = `2026-01-${String((i % 28) + 1).padStart(2, "0")}`;
    const r = await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 1000 + i, kind: "retainer", currency: "EUR", received_date: day });
    assert.equal(r.isError, false, r.text);
  }
  const list = parse(await c.call("deposit_list", { client: "Acme Ltd" }));
  assert.equal(list.count, 200);
  assert.equal(list.deposits.length, 200, "MAX_ROWS is 2000, so all 200 rows come back, none silently dropped");
  const bal = parse(await c.call("deposit_balance", { client: "Acme Ltd" }));
  assert.equal(bal.deposits, 200);
});

test("a corrupt invoices.json refuses deposit_apply cleanly while the deposits store stays fully usable", async (t) => {
  const { c, box } = open(t);
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "retainer", currency: "EUR", received_date: "2026-09-01" });
  const invDir = join(box.dataHome, "mcp-servers", "invoice");
  mkdirSync(invDir, { recursive: true });
  writeFileSync(join(invDir, "invoices.json"), '[{"number": "INV-2026-0001", <<< truncated');

  const apply = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 100, date: "2026-09-02" });
  assert.equal(apply.isError, true, "a corrupt invoice store must refuse the apply, not crash or silently write");
  assert.match(apply.text, /corrupt|not valid JSON/i, apply.text.slice(0, 300));

  // The deposits store itself was never touched by the failed apply.
  const dstore = JSON.parse(readFileSync(join(depositsDir(box.dataHome), "deposits.json"), "utf8"));
  assert.deepEqual(dstore[0].applications, [], "the failed apply left no application row");

  // Every deposits-only tool still works: the corruption is confined to the invoice store.
  const list = await c.call("deposit_list", {});
  assert.equal(list.isError, false, list.text);
  assert.equal(JSON.parse(list.text).count, 1);
  const bal = await c.call("deposit_balance", {});
  assert.equal(bal.isError, false, bal.text);
  const stmt = await c.call("deposit_statement_text", { client: "Acme" });
  assert.equal(stmt.isError, false, stmt.text);
  const refund = await c.call("deposit_refund", { id: "DEP-2026-0001", amount_minor: 100, date: "2026-09-02", method: "cash" });
  assert.equal(refund.isError, false, refund.text, "refund never touches the invoice store, so it is unaffected by the corruption");
});
