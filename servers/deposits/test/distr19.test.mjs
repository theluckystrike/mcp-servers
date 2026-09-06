// docs/DIST_R19_RESULT.md finding 3: deposit_record took a byte-identical record twice
// and there was no delete tool, so a mistyped or retried deposit held the same money
// twice on the book and spent one of the five free slots that month has with no way back
// except a Pro key. The fix is a duplicate refusal that names the existing id, plus a
// free deposit_delete that genuinely gives the slot back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, cleanup, seedInvoice, simpleInvoice } from "./_client.mjs";

const parse = (r) => { assert.ok(!r.isError, r.text); return JSON.parse(r.text); };

function open(t, opts = {}) {
  const box = sandbox();
  t.after(() => cleanup(box.dir));
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => c.close());
  return { box, c };
}

test("deposit_record refuses a duplicate, names the existing id and names deposit_delete", async (t) => {
  const { c } = open(t);
  await c.init();

  const first = parse(await c.call("deposit_record", {
    client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR",
    received_date: "2026-09-01", reference: "TRF-8812",
  }));
  assert.equal(first.recorded.id, "DEP-2026-0001");

  // Same deposit again, only normalisation apart: padded and re-cased name, lower-case
  // currency, a different note. Refused even though only 1 of the 5 free slots is used.
  const again = await c.call("deposit_record", {
    client: "  acme   LTD ", amount_minor: 50000, kind: "security", currency: "eur",
    received_date: "2026-09-01", reference: " trf-8812 ", notes: "second entry",
  });
  assert.ok(again.isError, again.text);
  assert.match(again.text, /DEP-2026-0001/, again.text);
  assert.match(again.text, /Nothing was written/, again.text);
  assert.match(again.text, /deposit_delete/, again.text);

  // Nothing was stored: still one deposit, still EUR 500.00 held, not 1,000.00.
  const list = parse(await c.call("deposit_list", {}));
  assert.equal(list.count, 1);
  assert.equal(list.balance[0].held_minor, 50000);

  // A genuine second payment the same day is still accepted once it carries its own
  // reference, so the refusal is not a block on the client paying twice.
  const twice = parse(await c.call("deposit_record", {
    client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR",
    received_date: "2026-09-01", reference: "TRF-8899",
  }));
  assert.equal(twice.recorded.id, "DEP-2026-0002");
});

test("deposit_delete gives the free month's slot back: fill the cap, delete one, record again", async (t) => {
  const { c } = open(t);
  await c.init();

  for (let i = 0; i < 5; i++) {
    const r = await c.call("deposit_record", { client: `C${i}`, amount_minor: 1000 + i, kind: "security", currency: "EUR", received_date: "2026-09-02" });
    assert.ok(!r.isError, r.text);
  }
  const over = await c.call("deposit_record", { client: "C9", amount_minor: 9000, kind: "security", currency: "EUR", received_date: "2026-09-02" });
  assert.ok(over.isError, over.text);
  assert.match(over.text, /already has 5/, over.text);

  const del = parse(await c.call("deposit_delete", { id: "DEP-2026-0003" }));
  assert.equal(del.deleted.id, "DEP-2026-0003");
  assert.match(del.free_tier, /4 of 5/, del.free_tier);

  // The slot really came back: the same call that was refused a moment ago now stores.
  const now = parse(await c.call("deposit_record", { client: "C9", amount_minor: 9000, kind: "security", currency: "EUR", received_date: "2026-09-02" }));
  assert.equal(now.recorded.client, "C9");
  // The id is NOT reused: DEP-2026-0003 was on a receipt, the next number is 0006.
  assert.equal(now.recorded.id, "DEP-2026-0006");

  const list = parse(await c.call("deposit_list", {}));
  assert.equal(list.count, 5);
  assert.ok(!list.deposits.some((d) => d.id === "DEP-2026-0003"));

  // And the cap is closed again at five.
  const shut = await c.call("deposit_record", { client: "C10", amount_minor: 4242, kind: "security", currency: "EUR", received_date: "2026-09-02" });
  assert.ok(shut.isError, shut.text);
  assert.match(shut.text, /already has 5/, shut.text);
});

test("deposit_delete refuses a deposit with a dependent and names it", async (t) => {
  const { box, c } = open(t);
  await c.init();
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001", { qty: 1, unit: 90000, rate: 23 }));

  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  await c.call("deposit_record", { client: "Beta GmbH", amount_minor: 20000, kind: "retainer", currency: "EUR", received_date: "2026-09-01" });

  // Applied to an invoice: the payment is on INV-2026-0001 in the invoice store.
  assert.ok(!(await c.call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 20000, date: "2026-09-02" })).isError);
  const applied = await c.call("deposit_delete", { id: "DEP-2026-0001" });
  assert.ok(applied.isError, applied.text);
  assert.match(applied.text, /DEP-2026-0001 cannot be deleted/, applied.text);
  assert.match(applied.text, /EUR 200\.00 applied to invoice INV-2026-0001 on 2026-09-02/, applied.text);
  assert.match(applied.text, /Nothing was changed/, applied.text);

  // Refunded: the money already went back, so the record has to stay.
  assert.ok(!(await c.call("deposit_refund", { id: "DEP-2026-0002", amount_minor: 5000, date: "2026-09-03", method: "bank transfer" })).isError);
  const refunded = await c.call("deposit_delete", { id: "DEP-2026-0002" });
  assert.ok(refunded.isError, refunded.text);
  assert.match(refunded.text, /EUR 50\.00 refunded on 2026-09-03 \(bank transfer\)/, refunded.text);

  // Both are still on the book.
  assert.equal(parse(await c.call("deposit_list", {})).count, 2);
});
