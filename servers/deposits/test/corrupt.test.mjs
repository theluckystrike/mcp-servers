// A store that is not JSON is quarantined byte-for-byte and every later call fails,
// reads included. "Empty database" on a file that is still on disk is how history gets
// overwritten by the next write.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, proKey, depositsDir, seedInvoice, simpleInvoice } from "./_client.mjs";

const GARBAGE = '[{"id":"DEP-2026-0001", <<< truncated by a crash';

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

test("corrupt deposits.json: quarantined byte-for-byte, and the reads fail too", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  const dir = depositsDir(box.dataHome);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "deposits.json"), GARBAGE);
  seedInvoice(box.dataHome, simpleInvoice("INV-2026-0001"));
  await c.init();

  const write = await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 1000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  assert.equal(write.isError, true, `a corrupt store must refuse, not succeed: ${write.text.slice(0, 300)}`);
  assert.match(write.text, /corrupt|not valid JSON/i, write.text.slice(0, 300));

  const moved = readdirSync(dir).filter((f) => f.startsWith("deposits.json.corrupt-"));
  assert.equal(moved.length, 1, `expected one quarantined copy, found ${JSON.stringify(readdirSync(dir))}`);
  assert.equal(readFileSync(join(dir, moved[0]), "utf8"), GARBAGE, "the quarantined copy must be the original bytes");
  assert.equal(readdirSync(dir).includes("deposits.json"), false, "an empty store must not be written over the corrupt one");

  for (const [tool, args] of [
    ["deposit_list", {}],
    ["deposit_balance", {}],
    ["deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 100 }],
    ["deposit_refund", { id: "DEP-2026-0001", amount_minor: 100, method: "cash" }],
    ["deposit_statement_text", { client: "Acme" }],
    ["deposits_report", {}],
  ]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} answered over a corrupt store: ${r.text.slice(0, 200)}`);
  }
});

test("corrupt counter.json blocks the write and leaves the deposits readable", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await c.call("deposit_record", { client: "Acme Ltd", amount_minor: 1000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  writeFileSync(join(depositsDir(box.dataHome), "counter.json"), GARBAGE);

  const write = await c.call("deposit_record", { client: "Beta", amount_minor: 1000, kind: "security", currency: "EUR", received_date: "2026-09-01" });
  assert.equal(write.isError, true, write.text);
  const read = await c.call("deposit_list", {});
  assert.equal(read.isError, false, read.text);
  assert.equal(JSON.parse(read.text).count, 1, "the deposits that were stored are still readable");
});
