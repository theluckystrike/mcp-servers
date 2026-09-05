// Two processes, one data dir. The failure this catches is a reissued id and a credit
// note that slips past the invoice's remaining creditable amount while another one is
// being written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, seedInvoice, simpleInvoice, proKey, docsDir } from "./_client.mjs";

test("40 concurrent purchase orders from two processes get 40 unique ids", async (t) => {
  const box = sandbox();
  const key = proKey();
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);

  const calls = [];
  for (let i = 0; i < 40; i++) {
    const c = i % 2 ? a : b;
    calls.push(c.call("purchase_order_create", { supplier: `S${i}`, items: [{ description: "X", quantity: 1, unit_price_minor: 100 }] }));
  }
  const out = await Promise.all(calls);
  const ids = out.map((r) => { assert.equal(r.isError, false, r.text); return JSON.parse(r.text).created.id; });
  assert.equal(new Set(ids).size, 40, "an id was issued twice");
  const stored = JSON.parse(readFileSync(join(docsDir(box.dataHome), "purchase-orders.json"), "utf8"));
  assert.equal(stored.length, 40, "a write was lost");
  assert.deepEqual(JSON.parse(readFileSync(join(docsDir(box.dataHome), "counter.json"), "utf8")), { "PO-2026": 40 });
});

test("concurrent credit notes cannot together exceed the invoice", async (t) => {
  const box = sandbox();
  const key = proKey();
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001")); // EUR 1107.00
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);

  // Ten calls of EUR 200.00 against EUR 1107.00: five fit, five do not.
  const out = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    (i % 2 ? a : b).call("credit_note_create", { invoice: "INV-2026-0001", reason: `slice ${i}`, amount_minor: 20000 })));
  const okd = out.filter((r) => !r.isError);
  const refused = out.filter((r) => r.isError);
  assert.equal(okd.length, 5, `expected 5 to fit: ${out.map((r) => r.text.slice(0, 60)).join(" | ")}`);
  assert.equal(refused.length, 5);
  for (const r of refused) assert.match(r.text, /can still be credited/);
  const stored = JSON.parse(readFileSync(join(docsDir(box.dataHome), "credit-notes.json"), "utf8"));
  assert.equal(stored.length, 5);
  const total = stored.reduce((s, c) => s + c.total_minor, 0);
  assert.equal(total, -100000, "the credited total never passes the invoice total");
});
