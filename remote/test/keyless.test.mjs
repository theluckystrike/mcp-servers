/**
 * Keyless free tier and the no-credential challenge (remote/src/keyless.ts, s1117).
 *
 * A real Claude-User connector called /mcp/price-tracker 105+ times from 2026-11-14 to 11-16
 * with no credential and every tools/call answered 401 with error="invalid_token" and the
 * root metadata URL. It never fetched a discovery document, so it does not run OAuth. Two
 * changes: the remaining no-credential 401s follow RFC 6750 section 3.1 (no error code, the
 * path-scoped RFC 9728 metadata URL), and a tools/call with no credential at all runs on the
 * free tier over an unsaved document under a per-address daily cap.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  KEYLESS_DAILY_CAP, KEYLESS_FLUSH_EVERY, appendResultText, createKeylessCounter, isKeylessToolCall,
  keylessCapBody, keylessCapText, keylessTrailer, noCredentialChallenge,
} from "../src/keyless.ts";

const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const license = readFileSync(new URL("../src/shims/license.ts", import.meta.url), "utf8");
const OFFER = { priceUsd: 19, bundleUsd: 39, serverCount: 46 };
const DAY = 86_400_000;
const T0 = Date.parse("2026-11-17T08:00:00.000Z");

function fakeKv() {
  const store = new Map();
  const kv = {
    store, reads: 0, writes: 0, fail: false,
    async get(k) { kv.reads++; if (kv.fail) throw new Error("kv down"); return store.has(k) ? store.get(k) : null; },
    async put(k, v) { kv.writes++; if (kv.fail) throw new Error("kv down"); store.set(k, v); },
  };
  return kv;
}
function waiter() {
  const pending = [];
  return { pending, waitUntil: (p) => { pending.push(p); }, drain: () => Promise.all(pending.splice(0)) };
}

/* ------------------------------------------- RFC 6750 3.1 challenge */

test("no-credential challenge: no error code, path-scoped resource_metadata", () => {
  const h = noCredentialChallenge("price-tracker");
  assert.equal(h, 'Bearer realm="mcp.zovo.one", resource_metadata="https://mcp.zovo.one/.well-known/oauth-protected-resource/mcp/price-tracker"');
  assert.doesNotMatch(h, /error=/, "RFC 6750 3.1: a request with no authentication information gets no error code");
  assert.match(noCredentialChallenge("time-tracker"), /oauth-protected-resource\/mcp\/time-tracker"$/);
});

test("no-credential challenge for /mcp/whoami (product *) names the root metadata", () => {
  assert.equal(noCredentialChallenge("*"), 'Bearer realm="mcp.zovo.one", resource_metadata="https://mcp.zovo.one/.well-known/oauth-protected-resource"');
});

test("authenticate() answers a missing token with that challenge, and only a missing one", () => {
  const start = src.indexOf("async function authenticate(");
  const fn = src.slice(start, src.indexOf("\n}\n", start));
  const noToken = fn.slice(fn.indexOf("if (!token) {"), fn.indexOf('if (token.startsWith("MCPL1."))'));
  assert.ok(noToken.includes('"www-authenticate": noCredentialChallenge(product)'));
  assert.doesNotMatch(noToken, /error=\\?"invalid_token\\?"/, "the no-token branch must not claim an invalid token");
  assert.doesNotMatch(src, /"www-authenticate": `Bearer realm="mcp\.zovo\.one", error="invalid_token"/, "no remaining challenge with error=invalid_token for a missing credential");
});

test("initialize challenge and tools/call challenge name the same metadata URL", () => {
  const i = src.indexOf("wantsOauthUpfront(rpc.method,");
  const block = src.slice(i, src.indexOf("});", i));
  const path = "https://mcp.zovo.one/.well-known/oauth-protected-resource/mcp/${product}";
  assert.ok(block.includes(`resource_metadata="${path}"`));
  assert.ok(noCredentialChallenge("x").includes("/.well-known/oauth-protected-resource/mcp/x"));
});

/* ------------------------------------------- who is keyless */

test("only a POST tools/call with an id, no credential, outside /v1 is keyless", () => {
  assert.equal(isKeylessToolCall("POST", "tools/call", true, false, false), true);
  assert.equal(isKeylessToolCall("POST", "tools/call", true, true, false), false, "any credential, valid or not, keeps its path");
  assert.equal(isKeylessToolCall("POST", "tools/call", true, false, true), false, "clean /v1 keeps its 401");
  assert.equal(isKeylessToolCall("POST", "tools/call", false, false, false), false, "a notification is not a call");
  assert.equal(isKeylessToolCall("POST", "initialize", true, false, false), false, "initialize keeps the OAuth-upfront path");
  assert.equal(isKeylessToolCall("POST", "resources/read", true, false, false), false);
  assert.equal(isKeylessToolCall("GET", "tools/call", true, false, false), false);
});

test("handler wiring: credentials and OAuth come first, keyless never touches stored data", () => {
  const h = src.slice(src.indexOf("const hasCredential = "));
  const oauth = h.indexOf("wantsOauthUpfront(rpc.method,");
  const kl = h.indexOf("const keyless = isKeylessToolCall(req.method, rpc.method, rpc.hasId, hasCredential, clean);");
  const authn = h.indexOf("await authenticate(req, env, product, urlToken, urlTokenForm, authOpts)");
  assert.ok(oauth > 0 && kl > oauth && authn > kl, "OAuth-upfront initialize, then keyless, then authenticate");
  assert.ok(h.includes('auth = { tenant: "keyless", isPro: false, kind: "anon", limit: keylessDecision.cap, via: "none (keyless free tier)" };'),
    "keyless is never Pro and carries no anonToken, so no purchase can bind to it");
  assert.ok(h.includes("const limited = keyless ? null : await rateLimit(env, auth, ctx, product);"), "no hourly KV counter per keyless call");
  assert.ok(h.includes("const stored = !dataless && !keyless;"));
  assert.ok(h.includes("const files = stored ? await hydrate(env, auth.tenant, product) : new Map<string, string>();"), "nothing is read");
  assert.equal((h.match(/if \(stored\) \{/g) ?? []).length, 3, "shares, profile and flush are all behind stored");
  assert.ok(h.includes("        if (stored) {\n          await flush(env, auth.tenant, product,"), "nothing is written back");
  assert.ok(h.includes("if (successfulBusinessCall && !keyless) {"), "no funnel Durable Object call per keyless call");
  assert.ok(h.includes("out = appendResultText(out, keylessTrailer(product, keylessDecision, wrote, KEYLESS_OFFER, unrecognized, carriesOffer(out))).body;"));
  assert.ok(h.includes("if (rctx.bindKey && auth.kind === \"anon\" && auth.anonToken) {"), "binding still needs a real token");
});

test("license_activate on a keyless call names the free token instead of claiming a licence key", () => {
  const i = license.indexOf("if (c.keyless) {");
  assert.ok(i > 0 && i < license.indexOf("if (!c.anonToken) {"), "keyless is checked before the licence-key branch");
  const block = license.slice(i, license.indexOf("if (!c.anonToken) {"));
  // The text lives in offer-text.js (s1116 L2); offer-text.test.mjs asserts it names /mcp/connect.
  assert.ok(block.includes("/mcp/connect") || block.includes("keylessActivateText(product)"));
  assert.ok(!block.includes("c.bindKey"), "a keyless call binds nothing");
});

/* ------------------------------------------- the daily cap */

test("cap: allows exactly the cap per address and day, then refuses", async () => {
  const kv = fakeKv(); const w = waiter();
  const c = createKeylessCounter(5, 100);
  for (let i = 1; i <= 5; i++) {
    const d = await c.allow(kv, w.waitUntil, "203.0.113.7", T0 + i);
    assert.equal(d.ok, true); assert.equal(d.used, i); assert.equal(d.cap, 5);
  }
  const over = await c.allow(kv, w.waitUntil, "203.0.113.7", T0 + 10);
  assert.equal(over.ok, false);
  assert.equal(over.resetsAt, "2026-11-18T00:00:00.000Z");
  assert.equal((await c.allow(kv, w.waitUntil, "198.51.100.1", T0 + 11)).ok, true, "another address has its own count");
  assert.equal((await c.allow(kv, w.waitUntil, "203.0.113.7", T0 + DAY)).ok, true, "the next UTC day starts again");
});

test("cap: KV is written once per KEYLESS_FLUSH_EVERY calls, never per request, and never names the address", async () => {
  const kv = fakeKv(); const w = waiter();
  const c = createKeylessCounter(1000);
  const n = KEYLESS_FLUSH_EVERY * 3 + 7;
  for (let i = 0; i < n; i++) await c.allow(kv, w.waitUntil, "203.0.113.7", T0 + i * 60_000);
  await w.drain();
  assert.equal(kv.writes, 3, `${n} calls, ${kv.writes} writes`);
  assert.equal(kv.reads, 1 + 3, "one read when the isolate first sees the address, one per batch");
  for (const k of kv.store.keys()) {
    assert.ok(!k.includes("203.0.113.7"), "the KV key carries a hash, not the address");
    assert.match(k, /^kl:[0-9a-f]{32}:\d+$/);
  }
  assert.equal([...kv.store.values()][0], String(KEYLESS_FLUSH_EVERY * 3));
});

test("cap: a sparse caller writes nothing at all", async () => {
  const kv = fakeKv(); const w = waiter();
  const c = createKeylessCounter();
  for (let i = 0; i < 10; i++) await c.allow(kv, w.waitUntil, "203.0.113.9", T0 + i * 3_600_000 / 2);
  await w.drain();
  assert.equal(kv.writes, 0);
});

test("cap: another isolate's flushed count is honoured", async () => {
  const kv = fakeKv(); const w = waiter();
  const a = createKeylessCounter(30, 10);
  for (let i = 0; i < 20; i++) await a.allow(kv, w.waitUntil, "203.0.113.7", T0 + i);
  await w.drain();
  const b = createKeylessCounter(30, 10);
  const d = await b.allow(kv, w.waitUntil, "203.0.113.7", T0 + 100);
  assert.equal(d.used, 21);
  for (let i = 0; i < 9; i++) await b.allow(kv, w.waitUntil, "203.0.113.7", T0 + 200 + i);
  assert.equal((await b.allow(kv, w.waitUntil, "203.0.113.7", T0 + 300)).ok, false);
});

test("cap: KV failure still caps in memory and never throws", async () => {
  const kv = fakeKv(); kv.fail = true; const w = waiter();
  const c = createKeylessCounter(3, 2);
  for (let i = 0; i < 3; i++) assert.equal((await c.allow(kv, w.waitUntil, "203.0.113.7", T0 + i)).ok, true);
  assert.equal((await c.allow(kv, w.waitUntil, "203.0.113.7", T0 + 9)).ok, false);
  await w.drain();
});

test("default cap is a day's worth of real use, not a probe budget", () => {
  assert.ok(KEYLESS_DAILY_CAP >= 100 && KEYLESS_DAILY_CAP <= 1000);
});

/* ------------------------------------------- what the user is told */

test("cap result tells the user where the free token is, that Pro exists, with the /buy link", () => {
  const d = { ok: false, used: 300, cap: 300, resetsAt: "2026-11-18T00:00:00.000Z" };
  const text = keylessCapText("price-tracker", d, OFFER);
  assert.ok(text.includes("https://mcp.zovo.one/mcp/connect"));
  assert.ok(text.includes("https://mcp.zovo.one/mcp/price-tracker/t/<token>"));
  assert.ok(text.includes("https://mcp.zovo.one/buy/price-tracker?src=price-tracker.keyless_cap"));
  assert.ok(text.includes("https://mcp.zovo.one/buy/bundle?src=price-tracker.keyless_cap.bundle"));
  assert.ok(text.includes("$19") && text.includes("$39") && text.includes("2026-11-18T00:00:00.000Z"));
  const body = JSON.parse(keylessCapBody(7, text));
  assert.deepEqual(body, { jsonrpc: "2.0", id: 7, result: { content: [{ type: "text", text }], isError: true } });
});

test("trailer: free token, Pro, /buy link, and an honest note when data was recorded", () => {
  const d = { ok: true, used: 4, cap: 300, resetsAt: "x" };
  const plain = keylessTrailer("time-tracker", d, false, OFFER);
  assert.ok(plain.includes("https://mcp.zovo.one/mcp/connect"));
  assert.ok(plain.includes("https://mcp.zovo.one/buy/time-tracker?src=time-tracker.keyless"));
  assert.ok(plain.includes("4 of 300"));
  assert.ok(!plain.includes("already gone"));
  assert.ok(keylessTrailer("time-tracker", d, true, OFFER).includes("what this call recorded is already gone"));
});

test("appendResultText: adds to success and isError results, leaves errors and non-JSON alone", () => {
  const ok = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "Price: 10" }], structuredContent: { a: 1 } } });
  const r1 = appendResultText(ok, "T");
  assert.equal(r1.appended, true);
  const o1 = JSON.parse(r1.body);
  assert.deepEqual(o1.result.content.at(-1), { type: "text", text: "T" });
  assert.deepEqual(o1.result.structuredContent, { a: 1 });
  const refused = JSON.stringify({ jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: '"full history" is a Pro feature.' }], isError: true } });
  const r2 = JSON.parse(appendResultText(refused, "T").body);
  assert.equal(r2.result.isError, true);
  assert.equal(r2.result.content.length, 2);
  const rpcErr = JSON.stringify({ jsonrpc: "2.0", id: 3, error: { code: -32602, message: "x" } });
  assert.deepEqual(appendResultText(rpcErr, "T"), { body: rpcErr, appended: false });
  assert.deepEqual(appendResultText("event: message", "T"), { body: "event: message", appended: false });
});
