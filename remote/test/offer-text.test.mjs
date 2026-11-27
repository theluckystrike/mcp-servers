/**
 * Offer text a free hosted caller reads (remote/src/offer-text.js), s1116 funnel audit,
 * data/s1116/FUNNEL.md leaks L1, L2 and L3.
 *
 * L1: the line under every successful free call linked the $39 bundle, named a rate limit
 *     and retention nobody meets, and was added even when the result already carried the
 *     cap note's $19 link, so one answer held two different offers.
 * L2: a caller with no token was told to send the key as an Authorization header after
 *     paying. claude.ai and Claude Desktop custom connectors take a URL only.
 * L3: initialize instructions said "all 58 others" (49 servers are sold) and their bundle
 *     link carried no tenant, so a purchase through it did not upgrade the connection.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carriesOffer, instructionsFor, keylessActivateText, noTokenBuyStep, successTrailer } from "../src/offer-text.js";

const TENANT = `anon_${"b".repeat(32)}`;
const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const license = readFileSync(new URL("../src/shims/license.ts", import.meta.url), "utf8");
const instructions = JSON.parse(readFileSync(new URL("../src/server-instructions.json", import.meta.url), "utf8"));
const base = { single: 19, bundle: 39, count: 49 };

test("L1 success trailer names this server's free limits and links its own $19 checkout first", () => {
  const t = successTrailer({ ...base, product: "time-tracker", freeLimits: "reports cover the last 7 days, 2 rated projects", tenant: TENANT });
  assert.match(t, /^Free tier on time-tracker: reports cover the last 7 days, 2 rated projects\./);
  const single = t.indexOf(`https://mcp.zovo.one/buy/time-tracker?tenant=${TENANT}&src=time-tracker.success`);
  const bundle = t.indexOf(`https://mcp.zovo.one/buy/bundle?tenant=${TENANT}&src=time-tracker.success.bundle`);
  assert.ok(single > 0, "single checkout link with tenant");
  assert.ok(bundle > single, "bundle link comes second");
  assert.match(t, /one-time \$19, lifetime/);
  assert.doesNotMatch(t, /600 calls\/hour|30-day retention/);
});

test("L1 success trailer without a tenant or free-limit text stays well formed", () => {
  const t = successTrailer({ ...base, product: "image", freeLimits: "", tenant: undefined });
  assert.match(t, /^This is the free tier of image\./);
  assert.ok(t.includes("https://mcp.zovo.one/buy/image?src=image.success "));
  assert.ok(!t.includes("tenant="));
});

test("L1 one offer per answer: a result that already carries a checkout link gets no trailer", () => {
  const capNote = JSON.stringify({ result: { content: [{ type: "text", text: `Note: "full history" is a Pro feature. Buy at https://mcp.zovo.one/buy/time-tracker?tenant=${TENANT}&src=time-tracker.full_history` }] } });
  assert.equal(carriesOffer(capNote), true);
  assert.equal(carriesOffer(JSON.stringify({ result: { content: [{ type: "text", text: "No timer running." }] } })), false);
  assert.equal(carriesOffer(undefined), false);
});

test("L1 index.ts uses the new trailer and checks for an existing offer first", () => {
  assert.ok(!index.includes("Free tier: 600 calls/hour, 30-day retention."), "old generic trailer removed");
  const call = index.indexOf("carriesOffer(out) ? \"\" : successTrailer(");
  assert.ok(call > 0, "trailer is skipped when the body already carries an offer");
  for (const p of ["time-tracker", "price-tracker", "image", "invoice"]) {
    const at = index.indexOf(`name: "${p}", url: \`\${base}/mcp/${p}\``);
    const entry = index.slice(at, index.indexOf("name: \"", at + 8));
    assert.ok(at > 0 && /free_limits: "[^"]+"/.test(entry), `${p} has free_limits in the index doc`);
  }
});

test("L2 no-token cap refusal names the URL form a connector can use", () => {
  const s = noTokenBuyStep("price-tracker", "https://mcp.zovo.one/buy/price-tracker?src=price-tracker.unlimited_watches");
  assert.ok(s.startsWith("Buy at https://mcp.zovo.one/buy/price-tracker?src=price-tracker.unlimited_watches . After payment"));
  const url = s.indexOf("https://mcp.zovo.one/mcp/price-tracker/t/<key>");
  const header = s.indexOf("Authorization: Bearer <key>");
  assert.ok(url > 0 && header > url, "URL form first, header only as the alternative");
  assert.ok(!license.includes('then send the key as "Authorization: Bearer <key>" to this endpoint'), "old header-only text removed");
  assert.ok(license.includes(": noTokenBuyStep(product, url)"));
});

test("L2 keyless license_activate says where the key goes", () => {
  const s = keylessActivateText("price-tracker");
  assert.match(s, /no connection to turn Pro on for/);
  assert.ok(s.indexOf("/mcp/price-tracker/t/<key>") < s.indexOf("Authorization: Bearer <key>"));
  assert.ok(s.includes("https://mcp.zovo.one/mcp/connect"));
  assert.ok(license.includes("keylessActivateText(product)"));
});

test("L3 instructions: server count corrected and the bundle link carries the tenant", () => {
  const raw = instructions["time-tracker"];
  assert.match(raw, /all 58 others/, "positive control: the stored text is still wrong");
  const out = instructionsFor(raw, { product: "time-tracker", tenant: TENANT, count: 49 });
  assert.match(out, /this server and the other 48:/);
  assert.ok(out.includes(`https://mcp.zovo.one/buy/bundle?tenant=${TENANT}&src=instr.time-tracker`));
  const anon = instructionsFor(raw, { product: "time-tracker", tenant: undefined, count: 49 });
  assert.ok(anon.includes("https://mcp.zovo.one/buy/bundle?src=instr.time-tracker") && !anon.includes("tenant="));
  assert.equal(instructionsFor(undefined, { product: "x", tenant: TENANT, count: 49 }), undefined);
  for (const [p, text] of Object.entries(instructions)) {
    if (typeof text !== "string" || !text) continue;
    assert.doesNotMatch(instructionsFor(text, { product: p, tenant: TENANT, count: 49 }), /all \d+ others/, p);
  }
  assert.ok(index.includes("instructionsFor("), "index.ts serves instructions through instructionsFor");
});
