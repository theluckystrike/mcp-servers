// D-R83: a URL handed to `path` must be refused by name, not resolved as a relative
// filesystem path (which used to leak the server's own cwd in the error text).
import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { client, sandbox } from "./_client.mjs";

const cleanup = (dir) => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } };

async function callTool(c, name, args) {
  const r = await c.call(name, args);
  assert.ok(r.result, `tools/call ${name} returned ${JSON.stringify(r.error)}`);
  return { text: r.result.content.map((x) => x.text).join("\n"), isError: !!r.result.isError };
}

test("pdf_info refuses a URL instead of resolving it against cwd", async () => {
  const s = sandbox();
  const c = client({ dataHome: s.dataHome });
  try {
    await c.init();
    const r = await callTool(c, "pdf_info", { path: "http://127.0.0.1:8794/doc.pdf" });
    assert.equal(r.isError, true);
    assert.match(r.text, /is a URL, not a file path/);
    assert.match(r.text, /pdf_upload/);
    assert.doesNotMatch(r.text, /does not exist/);
    // never leaks the server's cwd
    assert.equal(r.text.includes(process.cwd()), false);
  } finally { c.close(); cleanup(s.dir); }
});

test("pdf_merge refuses a URL the same way", async () => {
  const s = sandbox();
  const c = client({ dataHome: s.dataHome });
  try {
    await c.init();
    const r = await callTool(c, "pdf_merge", { paths: ["https://example.com/a.pdf", "https://example.com/b.pdf"], out_path: "out.pdf" });
    assert.equal(r.isError, true);
    assert.match(r.text, /is a URL, not a file path/);
  } finally { c.close(); cleanup(s.dir); }
});
