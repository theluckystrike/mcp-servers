// Two processes, one data dir. The check and the write have to be one critical section:
// if they are not, two applications each see room on the same deposit and both take it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, proKey, depositsDir, readInvoices, seedInvoice, simpleInvoice } from "./_client.mjs";

test("40 concurrent deposit_record calls from two processes: 40 rows, 40 unique ids", async (t) => {
  const box = sandbox();
  // Pro on both, so the free cap is not what limits the run.
  const key = proKey();
  const p1 = client({ dataHome: box.dataHome, key });
  const p2 = client({ dataHome: box.dataHome, key });
  t.after(() => { p1.close(); p2.close(); cleanup(box.dir); });
  await p1.init(); await p2.init();

  const calls = [];
  for (let i = 0; i < 40; i++) {
    const c = i % 2 ? p1 : p2;
    calls.push(c.call("deposit_record", { client: `C${i}`, amount_minor: 1000, kind: "security", currency: "EUR", received_date: "2026-09-02" }));
  }
  const results = await Promise.all(calls);
  const bad = results.filter((r) => r.isError);
  assert.equal(bad.length, 0, bad.map((r) => r.text).join("\n").slice(0, 500));

  const rows = JSON.parse(readFileSync(join(depositsDir(box.dataHome), "deposits.json"), "utf8"));
  assert.equal(rows.length, 40);
  assert.equal(new Set(rows.map((r) => r.id)).size, 40, "an id was reused");
  const counters = JSON.parse(readFileSync(join(depositsDir(box.dataHome), "counter.json"), "utf8"));
  assert.deepEqual(counters, { "DEP-2026": 40 });
});

test("ten concurrent EUR 200.00 applications against a EUR 500.00 deposit: exactly two land", async (t) => {
  const box = sandbox();
  const key = proKey();
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001")); // EUR 1107.00 open
  const p1 = client({ dataHome: box.dataHome, key });
  const p2 = client({ dataHome: box.dataHome, key });
  t.after(() => { p1.close(); p2.close(); cleanup(box.dir); });
  await p1.init(); await p2.init();
  const seed = await p1.call("deposit_record", { client: "Acme Ltd", amount_minor: 50000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  assert.equal(seed.isError, false, seed.text);

  const results = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    (i % 2 ? p1 : p2).call("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 20000, date: "2026-09-02" })));
  const took = results.filter((r) => !r.isError).length;
  assert.equal(took, 2, `expected exactly 2 of 10 to land, ${took} did`);

  const rows = JSON.parse(readFileSync(join(depositsDir(box.dataHome), "deposits.json"), "utf8"));
  const applied = rows[0].applications.reduce((a, x) => a + x.amount_minor, 0);
  assert.equal(applied, 40000, "the deposit never paid out more than it held");
  assert.equal(rows[0].applications.length, 2);
  assert.equal(readInvoices(box.dataHome)[0].paid_minor, 40000, "and the invoice carries exactly what was applied");
});
