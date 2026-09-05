// Two processes on one data directory. The register is small and the whole
// load-mutate-save cycle sits inside withFileLock, so neither can lose the other's write
// and neither can slip past the free cap by racing it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, proKey, storeDir, WORKED } from "./_client.mjs";

test("twenty loans written by two processes: twenty rows, twenty distinct ids", async (t) => {
  const box = sandbox();
  const key = proKey();
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);

  const calls = [];
  for (let n = 0; n < 10; n++) {
    calls.push(a.call("loan_create", { ...WORKED, name: `A${n}` }));
    calls.push(b.call("loan_create", { ...WORKED, name: `B${n}` }));
  }
  const results = await Promise.all(calls);
  assert.deepEqual(results.filter((r) => r.isError).map((r) => r.text), []);

  const stored = JSON.parse(readFileSync(join(storeDir(box.dataHome), "loans.json"), "utf8"));
  assert.equal(stored.length, 20, "a write was lost");
  assert.equal(new Set(stored.map((x) => x.id)).size, 20, "an id was reissued");
  assert.equal(new Set(stored.map((x) => x.name)).size, 20);
});

test("two processes racing the third free loan cannot both pass the cap", async (t) => {
  const box = sandbox();
  const a = client({ dataHome: box.dataHome });
  const b = client({ dataHome: box.dataHome });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);

  const calls = [];
  for (let n = 0; n < 4; n++) {
    calls.push(a.call("loan_create", { ...WORKED, name: `A${n}` }));
    calls.push(b.call("loan_create", { ...WORKED, name: `B${n}` }));
  }
  const results = await Promise.all(calls);
  const okCount = results.filter((r) => !r.isError).length;
  const refused = results.filter((r) => r.isError);
  assert.equal(okCount, 3, `${okCount} loans passed a cap of 3`);
  assert.equal(refused.length, 5);
  for (const r of refused) assert.match(r.text, /the free tier holds 3 loans/);
  const stored = JSON.parse(readFileSync(join(storeDir(box.dataHome), "loans.json"), "utf8"));
  assert.equal(stored.length, 3, "the check and the write are not one critical section");
});
