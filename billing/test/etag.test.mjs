// T2 (T5 4b): every content page must carry a live, content-derived strong ETag.
// Regression guard for the dead-ETag defect: contentHeaders() previously emitted a
// runtime-static value ('"'+d8(lm)+'-v3"') that Cloudflare's validator classifier
// never put on the wire. The fix hashes the rendered body (SHA-256, first 16 hex
// chars, quoted) so the ETag is a genuine strong validator that changes iff the
// body changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const CTX = { waitUntil: () => {} };

async function get(path) {
  const req = new Request("https://mcp.zovo.one" + path);
  return worker.fetch(req, {}, CTX);
}

test("content pages carry a live strong ETag header", async () => {
  for (const path of ["/", "/bundle", "/changelog", "/s/invoice", "/privacy"]) {
    const res = await get(path);
    assert.equal(res.status, 200, `${path} should be 200`);
    const etag = res.headers.get("etag");
    assert.ok(etag, `${path} must have an etag header`);
    assert.ok(etag.startsWith("W/"), `${path} etag must be weak (W/ prefix, Cloudflare strips strong ETags on compressed HTML): ${etag}`);
    assert.match(etag, /^W\/"[0-9a-f]{16}"$/, `${path} etag must be a weak quoted 16-hex SHA-256 digest: ${etag}`);
    await res.text(); // drain body
  }
});

test("etag is content-derived: it changes when the body changes", async () => {
  const a = await get("/");
  const b = await get("/bundle");
  const etagA = a.headers.get("etag");
  const etagB = b.headers.get("etag");
  await a.text();
  await b.text();
  assert.ok(etagA && etagB, "both pages need etags");
  assert.notEqual(etagA, etagB, "different bodies must produce different etags");
});
