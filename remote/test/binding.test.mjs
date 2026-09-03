/**
 * The tenant-binding decision (task 2). A purchase made from a hosted connection is
 * recorded by the billing worker as `bind:<anonToken>` = the minted MCPL1 key; this
 * endpoint only reads it. decideBinding() turns "what did verifying that key say" into
 * "what tier does this anonymous tenant run at", and it is the whole of the policy.
 *
 * The function lives in remote/src/index.ts, which imports the Workers runtime. Only the
 * decision is under test, so the function is extracted from the source instead of
 * importing the module: no Worker, no build step, plain node --test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = new URL("../src/index.ts", import.meta.url);
const src = readFileSync(SRC, "utf8");

const start = src.indexOf("export function decideBinding(");
assert.ok(start > 0, "decideBinding must be exported from remote/src/index.ts");
const end = src.indexOf("\n}\n", start) + 3;
// TypeScript annotations stripped: the body is plain JavaScript.
const body = src
  .slice(start, end)
  .replace("export function decideBinding(", "function decideBinding(")
  .replace(/verified: \{[^}]*\} \| null,/, "verified,")
  .replace(/limits: \{[^}]*\} =/, "limits =")
  .replace(/\): \{[^}]*\} \{/, ") {")
  .replace(/RATE_LIMIT_FREE/g, "600")
  .replace(/RATE_LIMIT_PRO/g, "6000");
const decideBinding = new Function(`${body}; return decideBinding;`)();

test("no binding in KV leaves the tenant free", () => {
  const d = decideBinding(null);
  assert.equal(d.isPro, false);
  assert.equal(d.bound, false);
  assert.equal(d.limit, 600);
});

test("a bound key that verifies makes the tenant Pro", () => {
  const d = decideBinding({ ok: true });
  assert.equal(d.isPro, true);
  assert.equal(d.bound, true);
  assert.equal(d.limit, 6000);
});

test("a bound key with a bad signature is ignored, not an error", () => {
  const d = decideBinding({ ok: false, reason: "signature invalid" });
  assert.equal(d.isPro, false);
  assert.equal(d.bound, false);
  assert.equal(d.limit, 600);
  assert.equal(d.reason, "signature invalid");
});

test("an expired bound key falls back to free", () => {
  const d = decideBinding({ ok: false, reason: "expired" });
  assert.deepEqual({ isPro: d.isPro, bound: d.bound, limit: d.limit }, { isPro: false, bound: false, limit: 600 });
});

test("a bound key signed for another product falls back to free", () => {
  const d = decideBinding({ ok: false, reason: "key is for invoice, not docx" });
  assert.equal(d.isPro, false);
  assert.equal(d.bound, false);
});

test("the limits are parameters, not constants baked into the decision", () => {
  const d = decideBinding({ ok: true }, { free: 1, pro: 2 });
  assert.equal(d.limit, 2);
  assert.equal(decideBinding(null, { free: 1, pro: 2 }).limit, 1);
});
