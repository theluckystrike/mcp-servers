/**
 * The machine-readable payment descriptor, the pricing resource and the upgrade prompt.
 *
 * Background, from docs/AGENT_PAYMENTS_R1.md: MCP 2026-07-28 defines no payment primitive
 * (SEP-2007 closed unmerged 2026-06-24) and no mainstream client settles an x402 challenge,
 * so this repo cannot offer an agent-settleable rail and must not pretend to. What it CAN
 * do is stop making an assistant parse English to find out what a cap costs. These tests
 * hold that line: the descriptor must be complete, it must be honest about
 * agent_settleable, and the two copies of the builder must not drift.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createLicenseGate, PRICE_SINGLE_USD, PRICE_BUNDLE_USD, SERVER_COUNT, GUIDE_URL } from "../dist/index.js";
import { paymentDescriptor } from "../dist/payment.js";

const PKG_SRC = new URL("../src/payment.ts", import.meta.url);
const REMOTE_SRC = new URL("../../../remote/src/payment.ts", import.meta.url);

test("the stdio and hosted copies of payment.ts are byte-identical", () => {
  const a = readFileSync(fileURLToPath(PKG_SRC));
  const b = readFileSync(fileURLToPath(REMOTE_SRC));
  assert.deepEqual(
    a, b,
    "packages/mcp-license/src/payment.ts and remote/src/payment.ts have drifted. " +
    "They are one file kept in two places because the hosted shim replaces the package; " +
    "copy one over the other rather than editing them separately.",
  );
  // Non-vacuity: an empty or missing file would also compare equal to itself.
  assert.ok(a.length > 2000, "payment.ts looks truncated");
});

const INPUT = {
  product: "invoice",
  reason: "free_tier_cap",
  feature: "PDF export",
  checkoutUrl: "https://mcp.zovo.one/buy/invoice?src=invoice.invoice_pdf",
  bundleUrl: "https://mcp.zovo.one/buy/bundle?src=invoice.invoice_pdf.bundle",
  guideUrl: GUIDE_URL,
  priceUsd: PRICE_SINGLE_USD,
  bundlePriceUsd: PRICE_BUNDLE_USD,
  serverCount: SERVER_COUNT,
  tokenBound: false,
};

test("the descriptor carries every field a client needs to act", () => {
  const d = paymentDescriptor(INPUT);
  assert.equal(d.schema, "zovo.one/mcp-payment-descriptor/1");
  assert.equal(d.status, "payment_required");
  assert.equal(d.product, "invoice");
  assert.equal(d.feature, "PDF export");
  assert.equal(d.price.amount, "19.00");
  assert.equal(d.price.currency, "USD");
  assert.equal(d.price.model, "one_time");
  assert.equal(d.price.url, INPUT.checkoutUrl);
  assert.equal(d.alternative.amount, "39.00");
  assert.equal(d.alternative.url, INPUT.bundleUrl);
  assert.match(d.alternative.grants, new RegExp(`all ${SERVER_COUNT} servers`));
  assert.equal(d.context_url, GUIDE_URL);
  assert.ok(String(d.human_step).length > 20);
});

test("it is honest: no agent-settleable rail is claimed, and x402 is refused explicitly", () => {
  const d = paymentDescriptor(INPUT);
  assert.equal(d.agent_settleable, false, "nothing in this repo can settle a payment for an agent");
  assert.equal(d.rails.x402.supported, false);
  // An x402-capable client must learn not to retry with a payment payload.
  assert.match(d.rails.x402.note, /[Dd]o not retry/);
  // The reason names the two primary-source facts the verdict rests on.
  assert.match(d.agent_settleable_reason, /2026-07-28/);
  assert.match(d.agent_settleable_reason, /SEP-2007/);
});

test("the elicitation block is the verbatim MCP 2026-07-28 url-mode parameter shape", () => {
  const d = paymentDescriptor(INPUT);
  // Per the specification, a url-mode elicitation/create request has exactly these params.
  assert.deepEqual(Object.keys(d.elicitation).sort(), ["message", "mode", "url"]);
  assert.equal(d.elicitation.mode, "url");
  assert.equal(d.elicitation.url, INPUT.checkoutUrl);
  assert.match(d.elicitation.url, /^https:\/\//, "the spec requires HTTPS outside development");
  assert.match(d.elicitation.message, /PDF export/);
  assert.match(d.elicitation.message, /\$19\.00/);
});

test("after_payment tells the truth about the transport it is on", () => {
  const stdio = paymentDescriptor({ ...INPUT, tokenBound: false });
  assert.match(stdio.after_payment, /license_activate/);
  const hosted = paymentDescriptor({ ...INPUT, tokenBound: true });
  assert.match(hosted.after_payment, /same connection/);
  assert.doesNotMatch(hosted.after_payment, /license_activate/, "a bound purchase has no key to paste");
});

test("a paid caller is not shown a payment_required status", () => {
  assert.equal(paymentDescriptor({ ...INPUT, reason: "status", tier: "pro" }).status, "paid");
  assert.equal(paymentDescriptor({ ...INPUT, reason: "status", tier: "free" }).status, "informational");
});

test("the builder is pure: same input, same output, no clock", () => {
  const a = JSON.stringify(paymentDescriptor(INPUT));
  const b = JSON.stringify(paymentDescriptor(INPUT));
  assert.equal(a, b);
  assert.doesNotMatch(a, /\d{4}-\d{2}-\d{2}T/, "no timestamp may leak into a cached descriptor");
});

/* ------------------------------------------------- the gate's resource and prompt */

/** A stand-in McpServer that records what the gate registers on it. */
function recorder() {
  const tools = new Map(), resources = new Map(), prompts = new Map();
  return {
    tools, resources, prompts,
    registerTool: (name, meta, handler) => tools.set(name, { meta, handler }),
    registerResource: (name, uri, meta, handler) => resources.set(name, { uri, meta, handler }),
    registerPrompt: (name, meta, handler) => prompts.set(name, { meta, handler }),
  };
}

test("the stdio gate registers the two licence tools and nothing else", () => {
  // Deliberate: the pricing resource and the upgrade_to_pro prompt live only on the hosted
  // transport (remote/src/shims/license.ts, covered by remote/test/payment-hosted.test.mjs).
  // Registering them here would add one resource and one prompt to all 31 local servers, and
  // 17 suites under servers/*/test assert those lists with deepEqual while
  // scripts/gen-spec.mjs derives docs from them. This test is what keeps that true.
  const gate = createLicenseGate({ product: "invoice" });
  const s = recorder();
  gate.registerTools(s);
  assert.deepEqual([...s.tools.keys()].sort(), ["license_activate", "license_status"], "no tool was added or renamed");
  assert.equal(s.resources.size, 0, "adding a resource here breaks 17 server contract suites; add it to the hosted shim");
  assert.equal(s.prompts.size, 0, "adding a prompt here breaks 17 server contract suites; add it to the hosted shim");
});

test("a host that only implements registerTool still works", () => {
  const gate = createLicenseGate({ product: "invoice" });
  const tools = new Map();
  assert.doesNotThrow(() => gate.registerTools({ registerTool: (n, m, h) => tools.set(n, { m, h }) }));
  assert.equal(tools.size, 2);
});

test("license_status now carries the descriptor alongside the prose", () => {
  const gate = createLicenseGate({ product: "invoice" });
  const st = gate.status();
  assert.equal(st.tier, "free");
  assert.equal(st.payment.agent_settleable, false);
  assert.equal(st.payment.product, "invoice");
  assert.equal(st.payment.status, "informational");
  // The existing fields are untouched: nothing was renamed, only added.
  assert.ok(st.upgradeUrl.includes("/buy/invoice"));
});

test("gate.payment tags a distinct conversion src per reason and tool", () => {
  const gate = createLicenseGate({ product: "invoice" });
  assert.match(gate.payment("free_tier_cap", "PDF export", "invoice_pdf").price.url, /src=invoice\.invoice_pdf$/);
  assert.match(gate.payment("free_tier_cap", "PDF export").price.url, /src=invoice\.pdf_export$/);
  assert.match(gate.payment("rate_limit").price.url, /src=invoice\.rate_limit$/);
  assert.match(gate.payment("status").price.url, /src=invoice\.status$/);
  // The bundle offer is always tagged separately so the two prices never share a click.
  assert.match(gate.payment("free_tier_cap", "PDF export", "invoice_pdf").alternative.url, /src=invoice\.invoice_pdf\.bundle$/);
});
