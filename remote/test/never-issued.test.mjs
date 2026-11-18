/**
 * Never-issued credentials are no credential (remote/src/keyless.ts classifyAuthorization, s1118b).
 *
 * Measured 2026-11-17 16:02 and 16:25 UTC (data/s1116/wall/pt_tail.jsonl): after mcp-remote
 * 6ed934fa, Claude-User from ASN "Anthropic, PBC" sent 8 POSTs to /mcp/price-tracker WITH an
 * Authorization header and all answered 401. No non-owner OAuth token exchange has ever happened
 * here, so that value was never issued by this worker and the keyless free tier never applied.
 *
 * index.ts cannot be imported under plain Node (see connected-apps.test.mjs), so authenticate()
 * and wantsOauthUpfront() are extracted from the source and run through stripTypeScriptTypes,
 * the request routing is reproduced from the same expressions the source is asserted to use,
 * and keyless.ts is imported for real.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";
import {
  appendResultText, classifyAuthorization, invalidTokenChallenge, isKeylessToolCall, keylessCapText,
  keylessTrailer, noCredentialChallenge, unrecognizedTokenLine,
} from "../src/keyless.ts";

const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const OFFER = { priceUsd: 19, bundleUsd: 39, serverCount: 46 };
const LIVE = "anon_" + "a".repeat(32);
const EXPIRED = "anon_" + "b".repeat(32);
const NEVER_ANON = "anon_" + "c".repeat(32);
const RT_LIVE = "rt_" + "d".repeat(64);
const RT_NEVER = "rt_" + "e".repeat(64);
const FOREIGN_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl";

function fakeKv(entries = {}) {
  const store = new Map(Object.entries(entries));
  const kv = {
    store, reads: [], fail: false,
    async get(k) { kv.reads.push(k); if (kv.fail) throw new Error("kv down"); return store.has(k) ? store.get(k) : null; },
    async put() { throw new Error("classification must never write"); },
  };
  return kv;
}
const issuedStore = () => fakeKv({
  [`tok:${LIVE}`]: "1763400000000",
  [`meta:anon:${"b".repeat(32)}`]: '{"last_seen":1760000000000}',
  [`oauth_refresh:${RT_LIVE}`]: '{"token":"x","client_id":"c"}',
});

/* ------------------------------------------------ classification */

test("no header is no credential and costs no KV read", async () => {
  const kv = issuedStore();
  assert.deepEqual(await classifyAuthorization(kv, null), { kind: "none" });
  assert.deepEqual(await classifyAuthorization(kv, ""), { kind: "none" });
  assert.equal(kv.reads.length, 0);
});

test("a value of a shape this worker never issues is never issued, with no KV read", async () => {
  const kv = issuedStore();
  for (const h of [`Bearer ${FOREIGN_JWT}`, "Bearer sk-ant-something", "bearer 12345", `Bearer anon_${"A".repeat(32)}`, `Bearer anon_${"a".repeat(31)}`]) {
    assert.deepEqual(await classifyAuthorization(kv, h), { kind: "never_issued", reason: "foreign_shape" }, h);
  }
  for (const h of ["Bearer", "Basic dXNlcjpwYXNz", "Token abc", "Bearer    "]) {
    assert.deepEqual(await classifyAuthorization(kv, h), { kind: "never_issued", reason: "not_bearer" }, h);
  }
  assert.equal(kv.reads.length, 0);
});

test("anon_ token: live is issued and hands its tok: read to authenticate()", async () => {
  const kv = issuedStore();
  assert.deepEqual(await classifyAuthorization(kv, `Bearer ${LIVE}`), { kind: "issued", tokSeen: "1763400000000" });
  assert.deepEqual(kv.reads, [`tok:${LIVE}`], "one read for a live token");
});

test("anon_ token: expired but traceable (meta stamp or bound purchase) is issued, so it keeps the 401", async () => {
  assert.deepEqual(await classifyAuthorization(issuedStore(), `Bearer ${EXPIRED}`), { kind: "issued", tokSeen: null });
  const bound = fakeKv({ [`bind:${NEVER_ANON}`]: "MCPL1.x" });
  assert.deepEqual(await classifyAuthorization(bound, `Bearer ${NEVER_ANON}`), { kind: "issued", tokSeen: null });
});

test("anon_ token with no trace in any store is never issued", async () => {
  const kv = issuedStore();
  assert.deepEqual(await classifyAuthorization(kv, `Bearer ${NEVER_ANON}`), { kind: "never_issued", reason: "anon_unknown" });
  assert.deepEqual(kv.reads.sort(), [`bind:${NEVER_ANON}`, `meta:anon:${"c".repeat(32)}`, `tok:${NEVER_ANON}`].sort());
});

test("refresh token sent as a bearer: issued keeps the 401, unknown is never issued", async () => {
  assert.deepEqual(await classifyAuthorization(issuedStore(), `Bearer ${RT_LIVE}`), { kind: "issued" });
  assert.deepEqual(await classifyAuthorization(issuedStore(), `Bearer ${RT_NEVER}`), { kind: "never_issued", reason: "refresh_unknown" });
});

test("licence keys keep their own path; a KV failure fails closed to today's behaviour", async () => {
  const kv = issuedStore();
  assert.deepEqual(await classifyAuthorization(kv, "Bearer MCPL1.abc.def"), { kind: "issued" });
  assert.equal(kv.reads.length, 0);
  kv.fail = true;
  assert.deepEqual(await classifyAuthorization(kv, `Bearer ${NEVER_ANON}`), { kind: "issued" });
  assert.deepEqual(await classifyAuthorization(kv, `Bearer ${RT_NEVER}`), { kind: "issued" });
});

test("invalid_token challenge: RFC 6750 error code plus the path-scoped metadata", () => {
  assert.equal(invalidTokenChallenge("price-tracker"),
    'Bearer realm="mcp.zovo.one", error="invalid_token", resource_metadata="https://mcp.zovo.one/.well-known/oauth-protected-resource/mcp/price-tracker"');
  assert.match(invalidTokenChallenge("*"), /error="invalid_token", resource_metadata="https:\/\/mcp\.zovo\.one\/\.well-known\/oauth-protected-resource"$/);
  assert.doesNotMatch(noCredentialChallenge("price-tracker"), /error=/, "the no-credential challenge is unchanged");
});

/* ------------------------------------------------ authenticate(), run from the source */

function fnText(sig) {
  const start = src.indexOf(sig);
  assert.ok(start >= 0, `${sig} must exist in remote/src/index.ts`);
  return src.slice(start, src.indexOf("\n}\n", start) + 3).replace(/^export /, "");
}
const authenticate = (() => {
  const js = stripTypeScriptTypes(fnText("async function authenticate("));
  const scope = {
    json: (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } }),
    GUIDE: "g", TENANT_ID_RE: /^[A-Za-z0-9_-]{1,64}$/, RATE_LIMIT_PRO: 6000,
    unauthorizedBody: (p) => ({ error: "unauthorized", product: p }),
    noCredentialChallenge, invalidTokenChallenge,
    verifyLicense: async () => ({ ok: false, reason: "bad signature" }),
    readBinding: async () => null,
    decideBinding: () => ({ isPro: false, limit: 600, bound: false }),
  };
  return new Function(...Object.keys(scope), `${js}\nreturn authenticate;`)(...Object.values(scope));
})();
const PATH_FORM = "URL path segment (/mcp/<server>/t/<token>)";
const req = (auth) => new Request("https://mcp.zovo.one/mcp/price-tracker", { method: "POST", headers: auth ? { authorization: auth } : {} });
const envWith = (kv) => ({ REMOTE_DATA: kv });

test("authenticate: valid header token, path token and OAuth access token are unchanged", async () => {
  const kv = issuedStore();
  const header = await authenticate(req(`Bearer ${LIVE}`), envWith(kv), "price-tracker");
  assert.equal(header.tenant, `anon:${"a".repeat(32)}`);
  assert.equal(header.via, "Authorization: Bearer");
  assert.equal(header.isPro, false);
  const path = await authenticate(req(null), envWith(kv), "price-tracker", LIVE, PATH_FORM);
  assert.equal(path.tenant, `anon:${"a".repeat(32)}`);
  assert.equal(path.via, PATH_FORM);
  // An OAuth access token IS an anon token; the handler passes the tok: value it already read.
  const kv2 = issuedStore();
  const pre = await classifyAuthorization(kv2, `Bearer ${LIVE}`);
  const oauth = await authenticate(req(`Bearer ${LIVE}`), envWith(kv2), "price-tracker", "", undefined, { ignoreHeader: false, tokSeen: pre.tokSeen });
  assert.equal(oauth.tenant, `anon:${"a".repeat(32)}`);
  assert.equal(oauth.tokStamp, 1763400000000);
  assert.equal(kv2.reads.filter((k) => k === `tok:${LIVE}`).length, 1, "the tok: read is not repeated");
});

test("authenticate: an issued but expired OAuth token gets 401 invalid_token with the challenge", async () => {
  const kv = issuedStore();
  const pre = await classifyAuthorization(kv, `Bearer ${EXPIRED}`);
  assert.equal(pre.kind, "issued");
  const r = await authenticate(req(`Bearer ${EXPIRED}`), envWith(kv), "price-tracker", "", undefined, { ignoreHeader: false, tokSeen: pre.tokSeen });
  assert.ok(r instanceof Response);
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, "invalid_token");
  assert.equal(r.headers.get("www-authenticate"), invalidTokenChallenge("price-tracker"));
  // Same for an expired path token, which classification never sees.
  const p = await authenticate(req(null), envWith(kv), "price-tracker", EXPIRED, PATH_FORM);
  assert.equal(p.status, 401);
  assert.equal((await p.json()).error, "invalid_token");
});

test("authenticate: an issued refresh token sent as a bearer keeps a 401 invalid_token", async () => {
  const r = await authenticate(req(`Bearer ${RT_LIVE}`), envWith(issuedStore()), "price-tracker");
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, "invalid_token");
  assert.match(r.headers.get("www-authenticate"), /error="invalid_token"/);
});

test("authenticate: an ignored header falls back to the URL token, or to the no-credential 401", async () => {
  const kv = issuedStore();
  const viaPath = await authenticate(req(`Bearer ${FOREIGN_JWT}`), envWith(kv), "price-tracker", LIVE, PATH_FORM, { ignoreHeader: true });
  assert.equal(viaPath.tenant, `anon:${"a".repeat(32)}`);
  assert.equal(viaPath.via, PATH_FORM);
  const none = await authenticate(req(`Bearer ${FOREIGN_JWT}`), envWith(kv), "price-tracker", "", undefined, { ignoreHeader: true });
  assert.equal(none.status, 401);
  assert.equal(none.headers.get("www-authenticate"), noCredentialChallenge("price-tracker"), "exactly the no-credential answer");
});

test("authenticate: a bad licence key is still invalid_license", async () => {
  const r = await authenticate(req("Bearer MCPL1.x.y"), envWith(issuedStore()), "price-tracker");
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, "invalid_license");
});

/* ------------------------------------------------ routing, as the handler composes it */

const wantsOauthUpfront = (() => {
  const consts = ["const OAUTH_CLIENT_UA = ", "const OAUTH_CLIENT_NAME = "].map((c) => {
    const i = src.indexOf(c); return src.slice(i, src.indexOf("\n", i));
  }).join("\n");
  const js = stripTypeScriptTypes(`${consts}\n${fnText("export function wantsOauthUpfront(")}`);
  return new Function(`${js}\nreturn wantsOauthUpfront;`)();
})();
const DATALESS = (() => {
  const i = src.indexOf("const DATALESS_METHODS = new Set(");
  return new Function(`return ${src.slice(src.indexOf("new Set(", i), src.indexOf(");", i) + 1)};`)();
})();

/** The handler's decision for one POST, from the same expressions index.ts is asserted to use. */
async function route(kv, { auth = null, urlToken = "", method, ua = "Claude-User", clean = false }) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: {} });
  const headerCred = await classifyAuthorization(kv, auth);
  const headerCredential = headerCred.kind === "issued";
  const ignoreHeader = headerCred.kind === "never_issued";
  const hasCredential = headerCredential || Boolean(urlToken);
  const unrecognized = ignoreHeader && !urlToken;
  if (!hasCredential && wantsOauthUpfront(method, ua, body)) return { path: "oauth_401", unrecognized };
  if (isKeylessToolCall("POST", method, true, hasCredential, clean)) return { path: "keyless", unrecognized };
  if (!hasCredential && DATALESS.has(method)) return { path: "anonymous", unrecognized };
  return { path: "authenticate", unrecognized, ignoreHeader };
}

test("the measured case: claude.ai with a never-issued bearer initializes anonymously and tools/call is keyless", async () => {
  const kv = issuedStore();
  for (const auth of [`Bearer ${FOREIGN_JWT}`, `Bearer ${NEVER_ANON}`, `Bearer ${RT_NEVER}`, "Bearer"]) {
    assert.deepEqual(await route(kv, { auth, method: "initialize" }), { path: "anonymous", unrecognized: true }, auth);
    assert.deepEqual(await route(kv, { auth, method: "tools/list" }), { path: "anonymous", unrecognized: true }, auth);
    assert.deepEqual(await route(kv, { auth, method: "tools/call" }), { path: "keyless", unrecognized: true }, auth);
  }
  assert.deepEqual(await route(kv, { method: "tools/call" }), { path: "keyless", unrecognized: false }, "no credential: as before, no extra line");
});

test("claude-code initialize stays OAuth up front, with no credential or a never-issued one", async () => {
  const kv = issuedStore();
  assert.equal((await route(kv, { method: "initialize", ua: "claude-code/2.1.0" })).path, "oauth_401");
  assert.equal((await route(kv, { auth: `Bearer ${FOREIGN_JWT}`, method: "initialize", ua: "claude-code/2.1.0" })).path, "oauth_401");
});

test("issued credentials (live, expired, licence, path) still go to authenticate(); /v1 keeps its 401", async () => {
  const kv = issuedStore();
  for (const auth of [`Bearer ${LIVE}`, `Bearer ${EXPIRED}`, `Bearer ${RT_LIVE}`, "Bearer MCPL1.x.y"]) {
    assert.equal((await route(kv, { auth, method: "tools/call" })).path, "authenticate", auth);
    assert.equal((await route(kv, { auth, method: "initialize" })).path, "authenticate", auth);
  }
  assert.deepEqual(await route(kv, { auth: `Bearer ${FOREIGN_JWT}`, urlToken: LIVE, method: "tools/call" }),
    { path: "authenticate", unrecognized: false, ignoreHeader: true }, "a URL token still counts when the header is ignored");
  assert.equal((await route(kv, { auth: `Bearer ${FOREIGN_JWT}`, method: "tools/call", clean: true })).path, "authenticate", "/v1 is never keyless");
});

test("handler source uses exactly those expressions, in that order", () => {
  const cls = src.indexOf('const headerCred = await classifyAuthorization(env.REMOTE_DATA, req.headers.get("authorization"));');
  const get = src.indexOf('if ((req.method === "GET" || req.method === "HEAD") && !headerCredential && !urlToken) {');
  const has = src.indexOf("const hasCredential = headerCredential || Boolean(urlToken);");
  const oauth = src.indexOf("if (req.method === \"POST\" && !hasCredential && wantsOauthUpfront(rpc.method,");
  const disc = src.indexOf('const isDiscovery = req.method === "POST" && !hasCredential');
  const kl = src.indexOf("const keyless = isKeylessToolCall(req.method, rpc.method, rpc.hasId, hasCredential, clean);");
  const authn = src.indexOf("await authenticate(req, env, product, urlToken, urlTokenForm, authOpts)");
  assert.ok(cls > 0 && get > cls && has > get && oauth > has && disc > oauth && kl > disc && authn > kl, `${[cls, get, has, oauth, disc, kl, authn]}`);
  assert.ok(src.includes('const headerCredential = headerCred.kind === "issued";'));
  assert.ok(src.includes('const ignoreHeader = headerCred.kind === "never_issued";'));
  assert.ok(src.includes("const unrecognized = ignoreHeader && !urlToken;"));
  assert.ok(src.includes('const authOpts = { ignoreHeader, tokSeen: headerCred.kind === "issued" ? headerCred.tokSeen : undefined };'));
  assert.ok(!src.includes('Boolean(req.headers.get("authorization"))'), "no raw header presence test is left");
});

test("the fallback is the keyless tier: never Pro, no token, nothing saved", () => {
  // Pro-only actions are refused because the only auth a never-issued request can reach is this one.
  assert.ok(src.includes('auth = { tenant: "keyless", isPro: false, kind: "anon", limit: keylessDecision.cap, via: "none (keyless free tier)" };'));
  assert.ok(src.includes("const stored = !dataless && !keyless;"));
});

test("nothing logs a token value: the never-issued log carries the reason label only", () => {
  const i = src.indexOf('event: "credential_never_issued"');
  const line = src.slice(src.lastIndexOf("\n", i), src.indexOf("\n", i));
  assert.match(line, /reason: headerCred\.reason/);
  assert.doesNotMatch(line, /authorization|req\.headers/i);
  assert.equal(line.replace("Boolean(urlToken)", "").includes("urlToken"), false, "the URL token appears only as a boolean");
});

/* ------------------------------------------------ what the user is told */

test("keyless results for a never-issued token add one short line naming /mcp/connect", () => {
  const line = unrecognizedTokenLine("price-tracker");
  assert.ok(line.includes("not recognized"));
  assert.ok(line.includes("https://mcp.zovo.one/mcp/connect"));
  assert.ok(line.includes("https://mcp.zovo.one/mcp/price-tracker/t/<token>"));
  assert.ok(!line.includes("\n") && line.length < 260, `one short line (${line.length})`);
  const d = { ok: true, used: 2, cap: 300, resetsAt: "x" };
  const t = keylessTrailer("price-tracker", d, false, OFFER, true);
  assert.ok(!t.includes("No token was sent"), "the trailer does not contradict the line");
  assert.ok(t.includes("https://mcp.zovo.one/mcp/connect"));
  assert.ok(keylessTrailer("price-tracker", d, false, OFFER).startsWith("No token was sent"), "no-credential text unchanged");
  assert.ok(keylessCapText("price-tracker", { ...d, ok: false }, OFFER, true).startsWith("This call carried no recognized token"));
  assert.ok(src.includes("if (unrecognized) out = appendResultText(out, unrecognizedTokenLine(product)).body;"));
  // A Pro refusal (isError) gets the line too.
  const refused = JSON.stringify({ jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: "price history is a Pro feature." }], isError: true } });
  const out = JSON.parse(appendResultText(appendResultText(refused, line).body, t).body);
  assert.equal(out.result.isError, true);
  assert.deepEqual(out.result.content.map((c) => c.text), ["price history is a Pro feature.", line, t]);
});
