// D-R83: a URL handed to `out_path` must be refused by name, not resolved as a relative
// filesystem path (which used to leak the server's own cwd in the error text).
import test from "node:test";
import assert from "node:assert/strict";
import { client, cleanup, sandbox } from "./_client.mjs";

test("barcode_create refuses a URL for out_path instead of resolving it against cwd", async () => {
  const s = sandbox();
  const c = client({ dataHome: s.dataHome });
  try {
    await c.init();
    const r = await c.call("barcode_create", { symbology: "code128", value: "ABC123", out_path: "http://127.0.0.1:8794/out.svg" });
    assert.equal(r.isError, true);
    assert.match(r.text, /is a URL, not a file path/);
    // never leaks the server's cwd
    assert.equal(r.text.includes(process.cwd()), false);
  } finally { c.close(); cleanup(s.dir); }
});

test("qr_create refuses a URL for out_path the same way", async () => {
  const s = sandbox();
  const c = client({ dataHome: s.dataHome });
  try {
    await c.init();
    const r = await c.call("qr_create", { text: "https://example.com/valid-payload", out_path: "https://example.com/out.svg" });
    assert.equal(r.isError, true);
    assert.match(r.text, /is a URL, not a file path/);
  } finally { c.close(); cleanup(s.dir); }
});
