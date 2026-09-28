import assert from "node:assert/strict";
import test from "node:test";
import { paidSessionFindings, webhookFindings, stripeWebhookHttpFindings } from "../billing-operations-monitor.mjs";

const now = 1_800_000_000;
const key = "MCPL1.payload.signature";
const tenant = `anon_${"a".repeat(32)}`;
const paid = {
  id: "cs_live_paid", livemode: true, created: now - 3600, status: "complete",
  payment_status: "paid", metadata: { site: "mcp.zovo.one", product: "bundle", tenant },
};

test("paid Session with missing license or hosted binding is an alert", () => {
  let result = paidSessionFindings([paid], () => null, now);
  assert.deepEqual(result.findings.map((f) => f.issue), ["issued key missing"]);
  result = paidSessionFindings([paid], (binding) => binding === "LICENSES" ? key : null, now);
  assert.deepEqual(result.findings.map((f) => f.issue), ["hosted binding missing"]);
  result = paidSessionFindings([paid], (binding) => binding === "LICENSES" ? key : "MCPL1.other.signature", now);
  assert.deepEqual(result.findings.map((f) => f.issue), ["hosted binding differs from issued key"]);
});

test("paid Session with matching records clears; recent payment gets settlement time", () => {
  assert.equal(paidSessionFindings([paid], () => key, now).findings.length, 0);
  const recent = { ...paid, created: now - 100 };
  const result = paidSessionFindings([recent], () => { throw new Error("read during grace period"); }, now);
  assert.equal(result.pending, 1);
  assert.equal(result.checked, 0);
});

test("webhook check detects duplicate destination and overdue MCP event", () => {
  const endpoint = { url: "https://mcp.zovo.one/webhook", status: "enabled",
    enabled_events: ["checkout.session.completed", "checkout.session.async_payment_succeeded"] };
  const event = { type: "checkout.session.completed", created: now - 3600,
    pending_webhooks: 1, data: { object: { metadata: { site: "mcp.zovo.one" } } } };
  const result = webhookFindings([endpoint, endpoint], [event], now);
  assert.equal(result.findings.length, 2);
  assert.equal(webhookFindings([endpoint], [], now).findings.length, 0);
});

test("Cloudflare rows flag observed Stripe HTTP 4xx/5xx and ignore unrelated traffic", () => {
  const rows = [
    { count: 2, dimensions: { edgeResponseStatus: 400, userAgent: "Stripe/1.0 (+https://stripe.com/docs/webhooks)" } },
    { count: 3, dimensions: { edgeResponseStatus: 503, userAgent: "Stripe/1.0 (+https://stripe.com/docs/webhooks)" } },
    { count: 10, dimensions: { edgeResponseStatus: 404, userAgent: "curl/8" } },
    { count: 5, dimensions: { edgeResponseStatus: 200, userAgent: "Stripe/1.0 (+https://stripe.com/docs/webhooks)" } },
  ];
  assert.deepEqual(stripeWebhookHttpFindings(rows), { failures: 5, statuses: [400, 503] });
  assert.throws(() => stripeWebhookHttpFindings(undefined), /missing/);
});
