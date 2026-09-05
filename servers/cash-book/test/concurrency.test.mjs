// Two processes sharing one data directory. The register is the only file this server
// writes, and the check and the write of the free meter are one critical section.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, proKey, workedMonth, storeDir } from "./_client.mjs";

function pair(t, opts = {}) {
  const box = sandbox();
  workedMonth(box.dataHome);
  const a = client({ dataHome: box.dataHome, ...opts });
  const b = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  return { box, a, b };
}

const register = (box, file) => JSON.parse(readFileSync(join(storeDir(box.dataHome, "cash-book"), file), "utf8"));

test("twenty periods built from two processes leave twenty rows and no lost write", async (t) => {
  const { box, a, b } = pair(t, { key: proKey() });
  await Promise.all([a.init(), b.init()]);
  const jobs = [];
  for (let i = 1; i <= 20; i += 1) {
    const to = `2026-06-${String(i).padStart(2, "0")}`;
    jobs.push((i % 2 ? a : b).call("ledger_build", { from: "2026-06-01", to, currency: "EUR" }));
  }
  const results = await Promise.all(jobs);
  assert.deepEqual(results.filter((r) => r.isError).map((r) => r.text), []);
  const rows = register(box, "periods.json");
  assert.equal(rows.length, 20);
  assert.equal(new Set(rows.map((r) => `${r.from}|${r.to}|${r.currency}`)).size, 20);
});

test("two processes racing the third free period cannot both pass the meter", async (t) => {
  const { box, a, b } = pair(t);
  await Promise.all([a.init(), b.init()]);
  const jobs = [];
  for (let i = 1; i <= 8; i += 1) {
    const to = `2026-06-${String(i).padStart(2, "0")}`;
    jobs.push((i % 2 ? a : b).call("ledger_build", { from: "2026-06-01", to, currency: "EUR" }));
  }
  const results = await Promise.all(jobs);
  const stored = register(box, "periods.json");
  assert.equal(stored.length, 3, `the free cap leaked: ${stored.length} periods stored`);
  assert.equal(results.filter((r) => !r.isError).length, 3);
  assert.equal(results.filter((r) => r.isError).length, 5);
  for (const r of results.filter((x) => x.isError)) assert.match(r.text, /builds 3 periods a calendar month/);
});

test("two processes closing the same month leave one close row", async (t) => {
  const { box, a, b } = pair(t, { key: proKey() });
  await Promise.all([a.init(), b.init()]);
  const results = await Promise.all([
    a.call("month_close", { month: "2026-06", currency: "EUR" }),
    b.call("month_close", { month: "2026-06", currency: "EUR" }),
    a.call("month_close", { month: "2026-06", currency: "EUR" }),
  ]);
  assert.deepEqual(results.filter((r) => r.isError).map((r) => r.text), []);
  const closes = register(box, "closes.json");
  assert.equal(closes.length, 1);
  assert.equal(closes[0].month, "2026-06");
  assert.equal(closes[0].debits_minor, 1638300);
});
