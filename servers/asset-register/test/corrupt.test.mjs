// A register that is on disk but unreadable must never read as "no assets": that answer
// depreciates nothing, balances to nothing, and looks exactly like an empty company.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, registerDir, proKey, ASSET } from "./_client.mjs";

test("a corrupt assets.json is quarantined byte for byte and every later call fails", async (t) => {
  const box = sandbox();
  const dir = registerDir(box.dataHome);
  mkdirSync(dir, { recursive: true });
  const bytes = '[{"id":"ASSET-2026-0001", TRUNCATED';
  writeFileSync(join(dir, "assets.json"), bytes);
  const c = client({ dataHome: box.dataHome, key: proKey("asset-register") });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const list = await c.call("asset_list", {});
  assert.equal(list.isError, true, "a corrupt register must not answer 'no assets'");
  assert.match(list.text, /corrupt/);

  const moved = readdirSync(dir).find((f) => f.startsWith("assets.json.corrupt-"));
  assert.ok(moved, `nothing was quarantined: ${readdirSync(dir).join(", ")}`);
  assert.equal(readFileSync(join(dir, moved), "utf8"), bytes, "the quarantined copy must be byte for byte");
  assert.ok(existsSync(join(dir, "assets.json.corrupt")), "a marker must be written");
  assert.ok(!existsSync(join(dir, "assets.json")), "nothing may be written back over the corrupt file");

  for (const [tool, args] of [
    ["asset_list", {}],
    ["asset_add", ASSET],
    ["asset_dispose", { asset: "anything", date: "2026-06-01" }],
    ["asset_journal", { month: "2026-06" }],
    ["asset_report", {}],
  ]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} answered on a corrupt register`);
  }

  // The path that does not read the store still works: a broken register is not a broken
  // rate table, and refusing to quote a published annex rate would be an outage nobody
  // asked for.
  const sched = await c.json("asset_schedule", {
    scheme: "pl", category: "487", cost_minor: 849900, currency: "PLN", purchase_date: "2026-03-12",
  });
  assert.equal(sched.rate_pct, 30);
});

test("a corrupt counter.json blocks the write and leaves the register readable", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, key: proKey("asset-register") });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  await c.json("asset_add", { ...ASSET, name: "first" });
  writeFileSync(join(registerDir(box.dataHome), "counter.json"), "{oops");

  const again = await c.call("asset_add", { ...ASSET, name: "second" });
  assert.equal(again.isError, true);
  const list = await c.json("asset_list", {});
  assert.equal(list.count, 1, "the asset that was already stored is still readable");
  assert.equal(list.assets[0].name, "first");
});
