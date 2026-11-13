import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { PRODUCTS, checkoutCustomText, successPage, bindDecision, shortProbeExpiry, probeCacheTtl } from "../src/index.js";
import { BUNDLE_DOWNLOADS } from "../src/downloads.js";
import { LISTED_IDS } from "../src/figures.js";
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MATCHER_DEMO_INPUT_SHA256, MATCHER_DEMO_JAVASCRIPT } from '../src/matcher-demo-bundle.js';

test('buyer guide serves the same engine compiled for the browser with fresh source provenance', async () => {
  const hash = createHash('sha256');
  for (const file of ['servers/three-way-match/src/core.ts', 'billing/browser/matcher-demo.mjs']) {
    hash.update(file); hash.update(readFileSync(new URL('../../' + file, import.meta.url)));
  }
  assert.equal(hash.digest('hex'), MATCHER_DEMO_INPUT_SHA256, 'Rebuild the browser asset after engine or UI changes');
  const ctx = { waitUntil() {} };
  const asset = await worker.fetch(new Request('https://mcp.zovo.one/assets/matcher-demo.js'), {}, ctx);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal(await asset.text(), MATCHER_DEMO_JAVASCRIPT);
  assert.ok(MATCHER_DEMO_JAVASCRIPT.includes('Third-party Zod license:'), 'Keep the bundled dependency notice in the public asset');
  const guide = await worker.fetch(new Request('https://mcp.zovo.one/guides/match-supplier-invoice-purchase-order-delivery-note-in-claude'), {}, ctx);
  assert.match(await guide.text(), /id="matcher-demo-form"/);
  const product = await worker.fetch(new Request('https://mcp.zovo.one/s/three-way-match'), {}, ctx);
  const html = await product.text();
  const position = html.indexOf('#matcher-demo');
  assert.ok(position >= 0 && position < html.indexOf('Install it in one click'), 'Show the editable proof before the install path');
  assert.doesNotMatch(html, /\/setup\/claude-web\/three-way-match/, 'A local stdio server must not link a missing web setup page');
});

test("download catalog covers every listed server with an explicit release asset", async () => {
  // A listed server may sit in BUNDLE_PENDING for a release while its .mcpb is queued;
  // /downloads then prints the source install path rather than a link that 404s.
  const { BUNDLE_PENDING } = await import("../src/downloads-pending.js");
  const covered = [...Object.keys(BUNDLE_DOWNLOADS), ...Object.keys(BUNDLE_PENDING)].sort();
  assert.deepEqual(covered, [...LISTED_IDS].sort());
  assert.deepEqual(Object.keys(BUNDLE_PENDING), ["ingredient-convert"],
    "only the server whose bundle is queued may be pending");
  const response = await worker.fetch(new Request("https://mcp.zovo.one/downloads"), {}, { waitUntil() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /releases\/download\/v0\.22\.0\/invoice\.mcpb/);
  assert.match(html, /releases\/download\/v0\.22\.8\/three-way-match\.mcpb/);
  assert.match(html, /releases\/download\/v0\.25\.0\/office-suite\.mcpb/);
  assert.match(html, /releases\/download\/v0\.25\.0\/supplier-statement-check\.mcpb/);
  assert.match(html, /releases\/download\/v0\.22\.9\/spreadsheet\.mcpb/);
  assert.match(html, /releases\/download\/v0\.22\.9\/expense-tracker\.mcpb/);
  assert.match(html, /releases\/download\/v0\.22\.8\/duplicate-invoice-check\.mcpb/);
  assert.doesNotMatch(html, /releases\/latest/);
});

test("catalogue leads to working setup and labels free-only calculators as free", async () => {
  const response = await worker.fetch(new Request("https://mcp.zovo.one/"), {}, { waitUntil() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.doesNotMatch(html, /Install: <code>npx -y @theluckystrike/);
  assert.ok(html.includes('/setup/claude-desktop/three-way-match'));
  assert.match(html, /href="\/s\/hourly-rate"[\s\S]*?<span class="muted">Free<\/span>/);
});

// Synthetic bearer only: never mint a live tenant or contact a payment API.
const TENANT = `anon_${"a".repeat(32)}`;
const env = { STRIPE_SECRET_KEY: "sk_test_stub", REMOTE_DATA: { get: async () => null, put: async () => {} } };
const ctx = { waitUntil() {} };
const request = (path, method = "GET") => new Request(`https://mcp.zovo.one${path}`, {
  method,
  headers: { "user-agent": "Mozilla/5.0 Chrome/140.0", accept: "text/html", origin: "https://mcp.zovo.one",
    "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "content-type": "application/x-www-form-urlencoded" },
  ...(method === "POST" ? { body: "intent=checkout" } : {}),
});
async function stubStripe(fn, session = {}) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), params: Object.fromEntries(new URLSearchParams(init?.body)) });
    return Response.json({ id: "cs_test_r36", url: "https://checkout.stripe.com/c/pay/cs_test_r36", ...session });
  };
  try { return { value: await fn(), calls }; }
  finally { globalThis.fetch = real; }
}
function bundleHref(html) {
  const link = html.match(/href="([^\"]*\/buy\/bundle\?[^\"]*)"/);
  assert.ok(link, "single-server checkout offers the bundle");
  return link[1].replaceAll("&amp;", "&");
}

test('short operator probes expire consistently across retries and cannot leave stale cache entries', async () => {
  const now = Date.now(), token = `${now}.11111111-1111-4111-8111-111111111111`;
  assert.equal(shortProbeExpiry(token, now), shortProbeExpiry(token, now + 15000));
  assert.throws(() => shortProbeExpiry(token, now + 31000), /Refresh/);
  const unix = Math.floor(now / 1000);
  assert.equal(probeCacheTtl({ expires_at: unix + 1860 }, unix), 1800);
  assert.equal(probeCacheTtl({ expires_at: unix + 30 }, unix), 0);
  assert.equal(probeCacheTtl({ expires_at: unix + 86400 }, unix), 23 * 3600);
  for (const marked of [false, true]) {
    const offer = request(`/buy/invoice?tenant=${TENANT}`);
    offer.headers.set('x-mcp-probe-expiry', 'short');
    if (marked) offer.headers.set('x-mcp-probe', '1');
    const offered = await worker.fetch(offer, env, ctx);
    assert.equal(offered.headers.get('x-mcp-probe-short-expiry'), marked ? '1860' : null);
    const req = request(`/buy/invoice?tenant=${TENANT}`, 'POST');
    req.headers.set('x-mcp-probe-expiry', 'short');
    if (marked) req.headers.set('x-mcp-probe', '1');
    if (marked) {
      // Default: a marked probe makes no Stripe call (2026-11-13 Stripe account guard).
      const guarded = request(`/buy/invoice?tenant=${TENANT}`, 'POST');
      guarded.headers.set('x-mcp-probe-expiry', 'short');
      guarded.headers.set('x-mcp-probe', '1');
      const { value: skipped, calls: none } = await stubStripe(() => worker.fetch(guarded, env, ctx));
      assert.equal(skipped.status, 303);
      assert.equal(skipped.headers.get('x-mcp-buy'), 'probe-no-live-session');
      assert.equal(none.length, 0);
    }
    const runEnv = marked ? { ...env, ALLOW_LIVE_PROBE_SESSIONS: '1' } : env;
    const { value, calls } = await stubStripe(() => worker.fetch(req, runEnv, ctx));
    assert.equal(value.status, 303);
    if (marked) {
      const expiry = Number(calls[0].params.expires_at);
      assert.ok(expiry >= unix + 1800 && expiry <= unix + 1862);
    } else assert.equal(calls[0].params.expires_at, undefined);
  }
});

test("single-to-bundle checkout keeps the hosted connection bound without creating a session on GET", async () => {
  const { value: html, calls: getCalls } = await stubStripe(async () =>
    (await worker.fetch(request(`/buy/invoice?tenant=${TENANT}&src=invoice.success`), env, ctx)).text());
  const href = bundleHref(html);
  assert.equal(new URL(href, "https://mcp.zovo.one").searchParams.get("tenant"), TENANT);
  assert.equal(getCalls.length, 0);
  const { value: res, calls } = await stubStripe(() => worker.fetch(request(href, "POST"), env, ctx));
  assert.equal(res.status, 303);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params["metadata[product]"], "bundle");
  assert.equal(calls[0].params["line_items[0][price]"], PRODUCTS.bundle.price);
  assert.equal(calls[0].params["metadata[tenant]"], TENANT);
  assert.deepEqual(bindDecision({ metadata: { tenant: calls[0].params["metadata[tenant]"] } }, true), { bind: true, tenant: TENANT });
});

test("Stripe's bundle cross-sell carries only a validated hosted token", () => {
  const valid = new URL(checkoutCustomText("invoice", "invoice", TENANT).submit.split(" ").at(-1));
  assert.equal(valid.searchParams.get("tenant"), TENANT);
  for (const bad of ["", "not-a-token", `anon_${"b".repeat(32)}&injected=1`]) {
    const link = new URL(checkoutCustomText("invoice", "invoice", bad).submit.split(" ").at(-1));
    assert.equal(link.searchParams.has("tenant"), false);
    assert.equal(link.searchParams.has("injected"), false);
  }
});

test("cancelling an expired checkout keeps hosted activation when starting a replacement", async () => {
  const { calls } = await stubStripe(() => worker.fetch(request(`/buy/invoice?tenant=${TENANT}`, "POST"), env, ctx));
  const cancel = new URL(calls[0].params.cancel_url.replace("{CHECKOUT_SESSION_ID}", "cs_test_expired"));
  assert.equal(cancel.searchParams.get("tenant"), TENANT);
  const { value: res, calls: retryCalls } = await stubStripe(() => worker.fetch(request(cancel.pathname + cancel.search, "POST"), env, ctx), { status: "expired", payment_status: "unpaid", metadata: { product: "invoice", tenant: TENANT } });
  assert.equal(res.status, 303);
  assert.equal(retryCalls.length, 2, "retrieve the expired session then create its replacement");
  assert.equal(retryCalls[1].params["metadata[tenant]"], TENANT);
});

test("purchase pages consistently describe confirmation-page key delivery and the actual purchase scope", async () => {
  for (const id of ["invoice", "bundle"]) {
    const html = await (await worker.fetch(request(`/buy/${id}`), env, ctx)).text();
    assert.match(html, /key[^<.]*confirmation page/i);
    assert.doesNotMatch(html, /key[^<.]*Stripe receipt|delivered instantly by email|re-sendable|No usage cap/i);
    assert.doesNotMatch(html, /<h2>One key, \d+ servers, yours for good<\/h2>/);
    assert.match(html, /Continue to Stripe/);
    const success = successPage("MCPL1.synthetic.key", id, {});
    assert.doesNotMatch(success, /key[^<.]*Stripe receipt|re-sendable|No usage cap/i);
  }
});

test("pricing presents current prices without an unconfigured price deadline or inferred human demand", async () => {
  const html = await (await worker.fetch(request("/pricing"), env, ctx)).text();
  assert.match(html, /\$19/);
  assert.match(html, /\$39/);
  assert.doesNotMatch(html, /Founding|2026-11-08|hosted tenants|anonymous tokens minted|delivered instantly by email|key[^<.]*Stripe receipt/i);
  assert.match(html, /confirmation page/i);
});


test("the bank guide's legacy PDF URL discloses CSV-only input and Pro export in page and search metadata", async () => {
  const res = await worker.fetch(request("/guides/bank-statement-pdf-to-excel-in-chat"), env, ctx);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<h1>Turn a bank CSV export into Excel rows from chat<\/h1>/);
  assert.match(html, /does not parse PDF statements/);
  assert.match(html, /statement_import/);
  assert.match(html, /statement_export<\/code> is a <strong>Pro feature/);
  assert.match(html, /does not create an Excel workbook/);
  assert.doesNotMatch(html, /It reads text-layer PDFs|running balance cross-checked|does the extraction and the tidying|removes the monthly processing cap/);
  const metadata = [...html.matchAll(/<meta[^>]+(?:name|property)="(?:description|og:description|twitter:description)"[^>]*>/g)].map((m) => m[0]).join(" ");
  assert.match(metadata, /CSV/);
  assert.doesNotMatch(metadata, /How to read a bank statement PDF/);
});
