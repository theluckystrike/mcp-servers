// A store that is still on disk is never treated as "no documents".
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, seedInvoice, simpleInvoice, proKey, docsDir } from "./_client.mjs";

const GARBAGE = '[{"id":"CN-2026-0001", <<< truncated by a crash';

test("a corrupt credit note store is quarantined byte-for-byte and every later call fails", async (t) => {
  const box = sandbox();
  const dir = docsDir(box.dataHome);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "credit-notes.json"), GARBAGE);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  const c = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const create = await c.call("credit_note_create", { invoice: "INV-2026-0001", reason: "returned goods" });
  assert.equal(create.isError, true, create.text);
  assert.match(create.text, /corrupt|not valid JSON/i);

  const moved = readdirSync(dir).filter((f) => f.startsWith("credit-notes.json.corrupt-"));
  assert.equal(moved.length, 1, JSON.stringify(readdirSync(dir)));
  assert.equal(readFileSync(join(dir, moved[0]), "utf8"), GARBAGE, "the quarantined copy is the original bytes");
  assert.equal(readdirSync(dir).includes("credit-notes.json"), false, "an empty store must not be written over the corrupt one");

  // The reads fail too, not only the writes: a list that answered "none" would be a lie.
  for (const [tool, args] of [["credit_note_list", {}], ["credit_note_get", { id: "CN-2026-0001" }], ["billing_docs_report", {}]]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} answered on a corrupt store: ${r.text.slice(0, 200)}`);
  }
});

test("a corrupt purchase order store blocks the orders and leaves the credit notes readable", async (t) => {
  const box = sandbox();
  const dir = docsDir(box.dataHome);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "purchase-orders.json"), GARBAGE);
  const c = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const create = await c.call("purchase_order_create", { supplier: "Widget Co", items: [{ description: "Cables", quantity: 1, unit_price_minor: 100 }] });
  assert.equal(create.isError, true, create.text);
  assert.equal(readdirSync(dir).filter((f) => f.startsWith("purchase-orders.json.corrupt-")).length, 1);
  const list = await c.call("credit_note_list", {});
  assert.equal(list.isError, false, "the other store is a separate file and is still readable");
});
