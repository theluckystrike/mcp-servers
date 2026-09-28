import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { PRODUCTS, PRODUCT_ALIASES } from "../../billing/src/index.js";
import { activeVersion, assertIntentResponse, healthSignals, probeBuyPages } from "../billing-release-gate.mjs";

const emptyKv = () => ({ get: async () => null, put: async () => {}, list: async () => ({ keys: [] }) });
const env = () => ({ STRIPE_SECRET_KEY: "sk_test_stub", LICENSES: emptyKv(), REMOTE_DATA: emptyKv() });
const ctx = { waitUntil() {} };

test("every production GET /buy shape serves the intent page without any Stripe subrequest", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(String(url)); throw new Error("GET called Stripe"); };
  try {
    const count = await probeBuyPages((url, options) => worker.fetch(new Request(url, options), env(), ctx));
    assert.equal(count, Object.keys(PRODUCTS).length + Object.keys(PRODUCT_ALIASES).length + 2);
    assert.deepEqual(calls, [], "GET must make zero outbound fetches, including Stripe reads and creates");
  } finally {
    globalThis.fetch = original;
  }
});

test("intent response guard rejects a Stripe redirect and a page without an explicit POST", () => {
  const goodHeaders = new Headers({ "content-type": "text/html", "x-mcp-buy": "checkout-intent-required" });
  const goodBody = '<form method="post"><input name="intent" value="checkout"></form>';
  assert.doesNotThrow(() => assertIntentResponse(200, goodHeaders, goodBody, "/buy/bundle"));
  assert.throws(() => assertIntentResponse(303, new Headers({ location: "https://checkout.stripe.com/c/pay/x" }), "", "/buy/bundle"));
  assert.throws(() => assertIntentResponse(200, goodHeaders, "<h1>Buy now</h1>", "/buy/bundle"));
});

test("deployed version parser requires one version serving all traffic", () => {
  const version = "e43cf627-b4df-4be2-bb37-df771bfdd8be";
  const deployment = { created_on: "2026-09-26T07:00:37Z", versions: [{ version_id: version, percentage: 100 }] };
  assert.equal(activeVersion([deployment]), version);
  assert.throws(() => activeVersion([{ ...deployment, versions: [{ version_id: version, percentage: 50 }] }]));
  assert.throws(() => activeVersion([]));
});

test("health signals flag all-expired MCP sweeps and overdue webhook delivery", () => {
  const hour = 500000;
  const sessions = Array.from({ length: 10 }, (_, i) => ({
    created: hour * 3600 + i, status: "expired", metadata: { site: "mcp.zovo.one" },
  }));
  const events = [{ type: "checkout.session.completed", pending_webhooks: 1, created: hour * 3600 }];
  assert.deepEqual(healthSignals(sessions, events, hour * 3600 + 700), {
    sweeps: 1, expiredInSweeps: 10, stuckEvents: 1,
  });
  sessions[0].metadata.probe = "1";
  assert.equal(healthSignals(sessions, [], hour * 3600 + 700).sweeps, 0);
});
