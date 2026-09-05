// Two processes, one data dir. Ids must be unique and the free cap must hold across both.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, registerDir, proKey, ASSET } from "./_client.mjs";

test("two processes racing asset_add allocate 40 unique ids and lose nothing", async (t) => {
  const box = sandbox();
  const key = proKey("asset-register");
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);

  const calls = [];
  for (let i = 0; i < 20; i++) {
    calls.push(a.call("asset_add", { ...ASSET, name: `a${i}` }));
    calls.push(b.call("asset_add", { ...ASSET, name: `b${i}` }));
  }
  const results = await Promise.all(calls);
  assert.deepEqual(results.filter((r) => r.isError).map((r) => r.text), []);

  const assets = JSON.parse(readFileSync(join(registerDir(box.dataHome), "assets.json"), "utf8"));
  assert.equal(assets.length, 40);
  assert.equal(new Set(assets.map((x) => x.id)).size, 40, "an id was reused");
  assert.deepEqual(JSON.parse(readFileSync(join(registerDir(box.dataHome), "counter.json"), "utf8")), { "ASSET-2026": 40 });
});

test("two processes cannot both slip past the tenth free asset", async (t) => {
  const box = sandbox();
  const a = client({ dataHome: box.dataHome });
  const b = client({ dataHome: box.dataHome });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);

  const calls = [];
  for (let i = 0; i < 8; i++) {
    calls.push(a.call("asset_add", { ...ASSET, name: `a${i}` }));
    calls.push(b.call("asset_add", { ...ASSET, name: `b${i}` }));
  }
  const results = await Promise.all(calls);
  const stored = results.filter((r) => !r.isError);
  const refused = results.filter((r) => r.isError);
  assert.equal(stored.length, 10, `expected exactly 10 stored, got ${stored.length}`);
  assert.equal(refused.length, 6);
  for (const r of refused) assert.match(r.text, /holds 10 assets/);
  const assets = JSON.parse(readFileSync(join(registerDir(box.dataHome), "assets.json"), "utf8"));
  assert.equal(assets.length, 10, "the check and the write are one critical section");
});

test("a disposal racing another disposal of the same asset books exactly once", async (t) => {
  const box = sandbox();
  const a = client({ dataHome: box.dataHome });
  const b = client({ dataHome: box.dataHome });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);
  await a.call("asset_add", ASSET);

  const results = await Promise.all([
    a.call("asset_dispose", { asset: "ASSET-2026-0001", date: "2027-01-31", proceeds_minor: 400000 }),
    b.call("asset_dispose", { asset: "ASSET-2026-0001", date: "2027-02-28", proceeds_minor: 300000 }),
  ]);
  assert.equal(results.filter((r) => !r.isError).length, 1, "an asset was disposed of twice");
  assert.match(results.find((r) => r.isError).text, /already disposed of/);
  const assets = JSON.parse(readFileSync(join(registerDir(box.dataHome), "assets.json"), "utf8"));
  assert.equal(assets.filter((x) => x.disposal).length, 1);
});
