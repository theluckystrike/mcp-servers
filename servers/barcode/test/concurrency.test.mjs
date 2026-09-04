// Two processes, one data dir. The failure this catches is a lost register row, and a
// free tier that hands out more than its allowance because both processes read the same
// count before either wrote.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, client, proKey, sandbox } from "./_client.mjs";

test("40 concurrent codes from two processes leave 40 rows in one register", async (t) => {
  const box = sandbox();
  const key = proKey();
  const a = client({ dataHome: box.dataHome, key });
  const b = client({ dataHome: box.dataHome, key });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);

  const jobs = [];
  for (let i = 0; i < 20; i++) {
    jobs.push(a.call("qr_create", { text: `a-${i}` }));
    jobs.push(b.call("barcode_create", { symbology: "code128", value: `B-${i}` }));
  }
  const results = await Promise.all(jobs);
  assert.equal(results.filter((r) => r.isError).length, 0, results.find((r) => r.isError)?.text);

  const rows = JSON.parse(readFileSync(join(box.dataHome, "mcp-servers", "barcode", "codes.json"), "utf8"));
  assert.equal(rows.length, 40, `expected 40 register rows, found ${rows.length}`);
  assert.equal(new Set(rows.map((r) => r.id)).size, 40, "every row must have its own id");
  assert.equal(rows.filter((r) => r.symbology === "code128").length, 20);
});

test("the free monthly allowance is not exceeded when two processes race for the last slots", async (t) => {
  const box = sandbox();
  const a = client({ dataHome: box.dataHome });
  const b = client({ dataHome: box.dataHome });
  t.after(() => { a.close(); b.close(); cleanup(box.dir); });
  await Promise.all([a.init(), b.init()]);

  const jobs = [];
  for (let i = 0; i < 15; i++) {
    jobs.push(a.call("qr_create", { text: `a-${i}` }));
    jobs.push(b.call("qr_create", { text: `b-${i}` }));
  }
  const results = await Promise.all(jobs);
  const drawn = results.filter((r) => /QR code [0-9a-f]{8}:/.test(r.text)).length;
  const refused = results.filter((r) => /free tier generates/.test(r.text)).length;
  assert.equal(drawn + refused, 30, "every call must either draw or refuse");
  assert.equal(drawn, 20, `the allowance is 20 a month; ${drawn} codes were drawn`);

  const rows = JSON.parse(readFileSync(join(box.dataHome, "mcp-servers", "barcode", "codes.json"), "utf8"));
  assert.equal(rows.length, 20, `the register must hold exactly the codes that were drawn, found ${rows.length}`);
});
