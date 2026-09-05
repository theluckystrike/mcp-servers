// Round 27, docs/USER_VALUE_R27.md, D-R96: deposit_apply computed the open balance from
// total_minor - paid_minor alone, with no idea a credit note existed against the invoice
// in the billing-docs store, so a deposit could be applied past what the client actually
// still owed once a credit note had already reduced it. This mirrors the netting
// statement-of-account already does (ageClient), read read-only and best-effort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, seedInvoice, simpleInvoice } from "./_client.mjs";

/** billing-docs' own credit-notes.json shape (servers/billing-docs/src/store.ts). */
function seedCreditNote(dataHome, note) {
  const dir = join(dataHome, "mcp-servers", "billing-docs");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "credit-notes.json"), JSON.stringify([note]));
}

test("deposit_apply caps at the invoice's open balance NET of a credit note in the billing-docs store", async (t) => {
  const box = sandbox();
  t.after(() => cleanup(box.dir));
  const c = client({ dataHome: box.dataHome });
  await c.init();
  t.after(() => c.close());

  // INV-2026-0001: EUR 1,107.00 (900.00 + 23% VAT), nothing paid yet.
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001", { qty: 1, unit: 90000, rate: 23 }));
  // A EUR 500.00 credit note against it: 1,107.00 - 500.00 = 607.00 actually open.
  seedCreditNote(box.dataHome, {
    id: "CN-2026-0001", invoice_number: "INV-2026-0001", invoice_total_minor: 110700,
    invoice_issue_date: "2026-09-01", basis: "amount", client: { name: "Acme Ltd" },
    issue_date: "2026-09-01", currency: "EUR", decimals: 2, lines: [],
    subtotal_minor: -50000, discount_percent: 0, discount_minor: 0, net_minor: -50000,
    tax_lines: [], tax_minor: 0, total_minor: -50000, reason: "Goodwill",
    created: "2026-09-01T00:00:00.000Z", branded: true,
  });

  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 100000, kind: "retainer", currency: "EUR", received_date: "2026-09-01" });

  // Asking for more than the credit-netted open balance (607.00) is refused, even
  // though it is well within both what is held (1,000.00) and the invoice's raw total
  // (1,107.00).
  const over = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 70000, date: "2026-09-02" });
  assert.ok(over.isError, over.text);
  assert.match(over.text, /still owes EUR 607\.00/, over.text);
  assert.match(over.text, /500\.00 already credited/, over.text);

  // Applying exactly the netted balance succeeds and reports it as fully settled.
  const exact = await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 60700, date: "2026-09-02" });
  assert.ok(!exact.isError, exact.text);
  const applied = JSON.parse(exact.text);
  assert.equal(applied.invoice.credited, "EUR 500.00");
  assert.equal(applied.invoice.balance_due, "EUR 0.00");
  assert.equal(applied.invoice.balance_due_minor, 0);

  // A second deposit_apply on the same (now netted-to-zero) invoice is refused, naming
  // both what was received and what was credited.
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 10000, kind: "retainer", currency: "EUR", received_date: "2026-09-01" });
  const again = await c.call("deposit_apply", { id: "DEP-2026-0002", invoice: "INV-2026-0001", date: "2026-09-03" });
  assert.ok(again.isError, again.text);
  assert.match(again.text, /already partial in full/, again.text);
  assert.match(again.text, /500\.00 credited/, again.text);
});
