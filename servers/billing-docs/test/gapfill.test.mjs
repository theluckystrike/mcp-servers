// Part 1 gap-fill: probes not already in docs/BILLING_DOCS_RESULT.md's table.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, seedInvoice, simpleInvoice, proKey, docsDir } from "./_client.mjs";

function open(t, { key } = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, key });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

test("a paid invoice can still be credited: payment and credit are separate facts", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  const inv = simpleInvoice("INV-2026-0001"); // EUR 1107.00
  inv.status = "paid";
  inv.paid_minor = inv.total_minor;
  seedInvoice(box.dataHome, inv);
  await c.init();
  const r = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods", amount_minor: 22140 });
  assert.equal(r.isError, false, r.text);
  const out = JSON.parse(r.text);
  assert.equal(out.created.total, "EUR -221.40");
});

test("credit_note_create has no currency parameter: a credit note can never disagree with its invoice's currency", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001", { currency: "USD" }));
  await c.init();
  const tools = await c.tools();
  const schema = tools.find((x) => x.name === "credit_note_create").inputSchema;
  assert.equal("currency" in (schema.properties ?? {}), false, "credit_note_create must not accept a currency, or a caller could mismatch it");
  const r = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "test", amount_minor: 100 });
  const out = JSON.parse(r.text);
  assert.equal(out.created.currency ?? out.created.total.slice(0, 3), "USD", "the credit note took the invoice's currency, not any caller input");
});

test("amount_minor: 0 is refused at the schema, before any server code runs", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();
  const r = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "nothing", amount_minor: 0 });
  assert.equal(r.isError, true);
  assert.match(r.text, /greater than zero|invalid_type|Expected/i);
  const file = join(docsDir(box.dataHome), "credit-notes.json");
  assert.throws(() => readFileSync(file));
});

test("a purchase order line with a negative quantity is refused at the schema", async (t) => {
  const { box, c } = open(t, {});
  await c.init();
  const r = await c.call("purchase_order_create", { supplier: "Acme", items: [{ description: "Widgets", quantity: -5, unit_price_minor: 100 }] });
  assert.equal(r.isError, true);
  assert.match(r.text, /greater than zero/i);
  const file = join(docsDir(box.dataHome), "purchase-orders.json");
  assert.throws(() => readFileSync(file));
});

test("purchase_order_receive tracks status only, not quantities: a second full receive is refused by name", async (t) => {
  const { box, c } = open(t, {});
  await c.init();
  const created = JSON.parse((await c.call("purchase_order_create", {
    supplier: "Hetzner", items: [{ description: "Server", quantity: 2, unit_price_minor: 4500 }],
  })).text);
  const id = created.created.id;
  const first = await c.call("purchase_order_receive", { id, partial: false, note: "both arrived" });
  assert.equal(first.isError, false, first.text);
  const second = await c.call("purchase_order_receive", { id, partial: false, note: "a third arrived somehow" });
  assert.equal(second.isError, true);
  assert.match(second.text, /already received in full/);
  // The tool has no per-line quantity field, so "receive more than ordered" cannot be
  // expressed as a number; the guard against it is the full/partial status machine above.
});

test("two processes racing the free-tier monthly cap: exactly 5 documents land, never 6", async (t) => {
  const box = sandbox();
  const a = client({ dataHome: box.dataHome });
  const b = client({ dataHome: box.dataHome });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);

  const calls = [];
  for (let i = 0; i < 8; i++) {
    const c = i % 2 ? a : b;
    calls.push(c.call("purchase_order_create", { supplier: `S${i}`, items: [{ description: "X", quantity: 1, unit_price_minor: 100 }] }));
  }
  const out = await Promise.all(calls);
  const ok = out.filter((r) => !r.isError);
  const refused = out.filter((r) => r.isError);
  assert.equal(ok.length, 5, `expected exactly 5 free docs to land: ${out.map((r) => r.text.slice(0, 50)).join(" | ")}`);
  assert.equal(refused.length, 3);
  for (const r of refused) assert.match(r.text, /free tier issues 5 documents/);
  const stored = JSON.parse(readFileSync(join(docsDir(box.dataHome), "purchase-orders.json"), "utf8"));
  assert.equal(stored.length, 5, "the store must never hold more than the cap allows, even from two processes");
});
