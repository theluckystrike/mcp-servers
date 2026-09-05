// D-R83: a URL handed to `path` must be refused by name, not resolved as a relative
// filesystem path (which used to leak the server's own cwd in the error text).
import test from "node:test";
import assert from "node:assert/strict";
import { client, cleanup, sandbox } from "./_client.mjs";

test("statement_import refuses a URL instead of resolving it against cwd", async () => {
  const s = sandbox();
  const c = client({ dataHome: s.dataHome });
  try {
    await c.init();
    const r = await c.call("statement_import", { path: "http://127.0.0.1:8794/bank.csv", account: "biz" });
    assert.equal(r.isError, true);
    assert.match(r.text, /is a URL, not a file path/);
    assert.match(r.text, /bank_upload/);
    assert.doesNotMatch(r.text, /no file at/);
    // never leaks the server's cwd
    assert.equal(r.text.includes(process.cwd()), false);
  } finally { c.close(); cleanup(s.dir); }
});

test("statement_export refuses a URL for out path the same way", async () => {
  const s = sandbox();
  const c = client({ dataHome: s.dataHome, key: (await import("./_client.mjs")).proKey() });
  try {
    await c.init();
    const r = await c.call("statement_export", { from: "2026-01-01", to: "2026-01-31", format: "csv", path: "https://example.com/out.csv" });
    assert.equal(r.isError, true);
    assert.match(r.text, /is a URL, not a file path/);
  } finally { c.close(); cleanup(s.dir); }
});
