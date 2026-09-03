// Task 2 (docs/PLAN_V3.md): tenant-token validation, the bind-write decision, and
// the success-page wording, all pure and testable without Stripe or KV.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validTenant, bindDecision, successPage, PRODUCTS } from "../src/index.js";

const GOOD = "anon_" + "a".repeat(32);

test("validTenant accepts only anon_ + 32 lowercase hex", () => {
  assert.equal(validTenant(GOOD), true);
  assert.equal(validTenant("anon_" + "A".repeat(32)), false); // uppercase hex rejected
  assert.equal(validTenant("anon_" + "a".repeat(31)), false); // too short
  assert.equal(validTenant("anon_" + "a".repeat(33)), false); // too long
  assert.equal(validTenant("anon_" + "g".repeat(32)), false); // not hex
  assert.equal(validTenant("lic:abcdef"), false);
  assert.equal(validTenant(""), false);
  assert.equal(validTenant(undefined), false);
  assert.equal(validTenant(null), false);
  assert.equal(validTenant(123), false);
});

test("bindDecision only binds a valid tenant on an already-fulfilled session", () => {
  const session = { metadata: { product: "invoice", tenant: GOOD } };
  assert.deepEqual(bindDecision(session, true), { bind: true, tenant: GOOD });
});

test("bindDecision refuses when fulfilment itself was not ok, regardless of tenant", () => {
  const session = { metadata: { product: "invoice", tenant: GOOD } };
  const r = bindDecision(session, false);
  assert.equal(r.bind, false);
});

test("bindDecision refuses a missing or malformed tenant", () => {
  assert.equal(bindDecision({ metadata: { product: "invoice" } }, true).bind, false);
  assert.equal(bindDecision({ metadata: { product: "invoice", tenant: "" } }, true).bind, false);
  assert.equal(bindDecision({ metadata: { product: "invoice", tenant: "not-a-token" } }, true).bind, false);
  assert.equal(bindDecision({ metadata: {} }, true).bind, false);
  assert.equal(bindDecision({}, true).bind, false);
});

test("bindDecision never binds a spoofed tenant carried outside metadata", () => {
  // A client_reference_id at the top level is not trusted; only session.metadata.tenant is.
  const session = { client_reference_id: GOOD, metadata: { product: "invoice" } };
  assert.equal(bindDecision(session, true).bind, false);
});

test("success page shows the hosted-bound note only when a tenant was actually bound", () => {
  const withBind = successPage("MCPL1.x.y", "invoice", {}, GOOD);
  assert.match(withBind, /already Pro/);
  assert.match(withBind, new RegExp(GOOD));
  assert.match(withBind, new RegExp(PRODUCTS.invoice.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const withoutBind = successPage("MCPL1.x.y", "invoice", {}, "");
  assert.doesNotMatch(withoutBind, /already Pro/);
});

test("success page always shows the key regardless of binding", () => {
  const page = successPage("MCPL1.abc.def", "invoice", {}, GOOD);
  assert.match(page, /MCPL1\.abc\.def/);
});
