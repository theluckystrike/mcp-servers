/**
 * Confidential OAuth clients (RFC 7591 + RFC 6749 §2.3.1), added for Microsoft 365 Copilot
 * MCP plugins, whose DCR requires the server to issue a client secret. The logic lives in
 * src/oauth-client.ts and src/oauth-refresh.ts and is imported for real (Node strips the
 * types); the wiring inside index.ts's fetch() is asserted against the source text, as in
 * the sibling suites. Public clients ("none") must behave exactly as before.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const oc = await import("../src/oauth-client.ts");
const orf = await import("../src/oauth-refresh.ts");
const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

const MS_REDIRECT = "https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect";
const CLAUDE_REDIRECT = "https://claude.ai/api/mcp/auth/callback";
const TOK = "anon_" + "c".repeat(32);
const TOK_TTL = 2_678_400;

function fakeKv() {
  const m = new Map();
  return {
    m, reads: 0, puts: 0,
    async get(k) { this.reads++; return m.has(k) ? m.get(k).v : null; },
    async put(k, v, o) { this.puts++; m.set(k, { v, ttl: o?.expirationTtl }); },
    async delete(k) { m.delete(k); },
  };
}
const form = (o) => new URLSearchParams(o);
const basic = (id, secret) => "Basic " + Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString("base64");
const sha = (s) => createHash("sha256").update(s).digest("hex");

async function registered(method = "client_secret_basic", extra = {}) {
  const kv = fakeKv();
  const meta = { redirect_uris: [MS_REDIRECT], client_name: "Microsoft 365 Copilot", token_endpoint_auth_method: method, ...extra };
  const body = await oc.registerConfidentialClient(kv, meta, meta.redirect_uris, method);
  return { kv, body, id: body.client_id, secret: body.client_secret };
}

/* ------------------------------------------------------------- registration */

test("registration method: secret methods by name, Microsoft default, everything else public as before", () => {
  const m = oc.registrationAuthMethod;
  assert.equal(m({ token_endpoint_auth_method: "client_secret_basic" }, [CLAUDE_REDIRECT]), "client_secret_basic");
  assert.equal(m({ token_endpoint_auth_method: "client_secret_post" }, [CLAUDE_REDIRECT]), "client_secret_post");
  // Microsoft: "DCR without a client secret isn't supported yet" -> RFC 7591 default.
  assert.equal(m({}, [MS_REDIRECT]), "client_secret_basic");
  assert.equal(m({}, ["https://teams.microsoft.us/api/platform/v1.0/oAuthRedirect"]), "client_secret_basic");
  // Public clients keep "none": omitted, explicit none, unknown/unsupported methods.
  assert.equal(m({}, [CLAUDE_REDIRECT]), "none");
  assert.equal(m({ token_endpoint_auth_method: "none" }, [CLAUDE_REDIRECT]), "none");
  assert.equal(m({ token_endpoint_auth_method: "none" }, [MS_REDIRECT]), "none", "an explicit none is honoured");
  assert.equal(m({ token_endpoint_auth_method: "private_key_jwt" }, [CLAUDE_REDIRECT]), "none");
  // Lookalike hosts are not Microsoft.
  assert.equal(m({}, ["https://teams.microsoft.com.evil.example/api/platform/x"]), "none");
  assert.equal(m({}, ["http://teams.microsoft.com/api/platform/v1.0/oAuthRedirect"]), "none");
});

test("confidential registration returns the secret once and stores only its SHA-256", async () => {
  const { kv, body, id, secret } = await registered("client_secret_post");
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.match(secret, /^cs_[0-9a-f]{64}$/, "256-bit secret");
  assert.equal(body.client_secret_expires_at, 0);
  assert.equal(body.token_endpoint_auth_method, "client_secret_post");
  assert.deepEqual(body.grant_types, ["authorization_code", "refresh_token"]);
  assert.deepEqual(body.redirect_uris, [MS_REDIRECT]);
  assert.ok(Number.isInteger(body.client_id_issued_at));
  const row = kv.m.get(`oauth_client:${id}`);
  assert.equal(row.ttl, oc.OAUTH_CLIENT_TTL);
  assert.ok(!row.v.includes(secret) && !row.v.includes(secret.slice(3)), "plain secret never stored");
  const rec = JSON.parse(row.v);
  assert.equal(rec.secret_sha256, sha(secret));
  assert.equal(rec.token_endpoint_auth_method, "client_secret_post");
  assert.deepEqual(rec.metadata.redirect_uris, [MS_REDIRECT], "authorize reads metadata.redirect_uris as before");
  assert.equal(oc.isConfidentialRecord(row.v), true);
  assert.equal(oc.isConfidentialRecord(JSON.stringify({ metadata: {}, at: 1 })), false, "public record");
  assert.equal(oc.isConfidentialRecord(null), false);
  const again = await registered("client_secret_post");
  assert.notEqual(again.id, id, "same metadata, new confidential client: ids are random, not hashed");
  assert.notEqual(again.secret, secret);
});

/* -------------------------------------------------------- client authentication */

test("client_secret_basic authenticates, with RFC 6749 §2.3.1 form-url-decoding", async () => {
  const { kv, id, secret } = await registered();
  const ok = await oc.authenticateConfidentialClient(kv, id, oc.clientCredentials(basic(id, secret), form({ grant_type: "authorization_code" })));
  assert.equal(ok, null);
  // A secret with reserved characters, sent encoded: "a b" as "a+b", ":" as %3A.
  const kv2 = fakeKv();
  const odd = "s3cr:t a/b+c%";
  await kv2.put("oauth_client:abc", JSON.stringify({ metadata: {}, at: Date.now(), secret_sha256: sha(odd) }));
  const enc = "Basic " + Buffer.from(`abc:${encodeURIComponent(odd).replace(/%20/g, "+")}`).toString("base64");
  const creds = oc.clientCredentials(enc, form({}));
  assert.deepEqual(creds.basic, { id: "abc", secret: odd });
  assert.equal(await oc.authenticateConfidentialClient(kv2, "abc", creds), null);
});

test("client_secret_post authenticates; the registered method does not restrict the scheme", async () => {
  const { kv, id, secret } = await registered("client_secret_basic");
  const creds = oc.clientCredentials(null, form({ client_id: id, client_secret: secret }));
  assert.equal(creds.id, id);
  assert.equal(await oc.authenticateConfidentialClient(kv, id, creds), null);
});

test("wrong secret is invalid_client 401 with WWW-Authenticate: Basic", async () => {
  const { kv, id, secret } = await registered();
  const wrong = secret.slice(0, -1) + (secret.endsWith("0") ? "1" : "0");
  for (const creds of [
    oc.clientCredentials(basic(id, wrong), form({})),
    oc.clientCredentials(null, form({ client_id: id, client_secret: wrong })),
    oc.clientCredentials(basic(id, "short"), form({})),
  ]) {
    const e = await oc.authenticateConfidentialClient(kv, id, creds);
    assert.deepEqual([e.error, e.status], ["invalid_client", 401]);
  }
  const res = oc.clientAuthErrorResponse({ error: "invalid_client", message: "Client authentication failed.", status: 401 });
  assert.equal(res.status, 401);
  assert.match(res.headers.get("www-authenticate"), /^Basic realm="mcp\.zovo\.one"/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal((await res.json()).error, "invalid_client");
});

test("missing secret, someone else's secret, unknown client and malformed Basic are invalid_client", async () => {
  const a = await registered();
  const b = await registered();
  const kv = fakeKv();
  for (const [k, v] of [...a.kv.m, ...b.kv.m]) kv.m.set(k, v);
  const cases = [
    oc.clientCredentials(null, form({ client_id: a.id })),                    // no secret at all
    oc.clientCredentials(null, form({})),                                     // nothing
    oc.clientCredentials(basic(a.id, ""), form({})),                          // empty secret
    oc.clientCredentials(basic(b.id, b.secret), form({})),                    // b's valid creds for a's grant
    oc.clientCredentials(null, form({ client_id: a.id, client_secret: b.secret })),
    oc.clientCredentials("Basic !!!notbase64", form({})),
    oc.clientCredentials("Basic " + Buffer.from("no-colon").toString("base64"), form({})),
    oc.clientCredentials(basic(a.id, a.secret), form({ client_id: b.id })),  // header and body disagree
  ];
  for (const [i, creds] of cases.entries()) {
    const e = await oc.authenticateConfidentialClient(kv, a.id, creds);
    assert.ok(e, `case ${i} must fail`);
    assert.deepEqual([e.error, e.status], ["invalid_client", 401], `case ${i}`);
  }
  const unknown = await oc.authenticateConfidentialClient(fakeKv(), a.id, oc.clientCredentials(basic(a.id, a.secret), form({})));
  assert.equal(unknown.error, "invalid_client");
  // Two methods at once is invalid_request (RFC 6749 §2.3: MUST NOT use more than one).
  const both = await oc.authenticateConfidentialClient(kv, a.id, oc.clientCredentials(basic(a.id, a.secret), form({ client_secret: a.secret })));
  assert.deepEqual([both.error, both.status], ["invalid_request", 400]);
});

test("a client record in use is renewed at most once per 30 days", async () => {
  const { kv, id, secret } = await registered();
  const creds = oc.clientCredentials(basic(id, secret), form({}));
  const puts = kv.puts;
  assert.equal(await oc.authenticateConfidentialClient(kv, id, creds), null);
  assert.equal(kv.puts, puts, "fresh record: no write");
  const rec = JSON.parse(kv.m.get(`oauth_client:${id}`).v);
  kv.m.set(`oauth_client:${id}`, { v: JSON.stringify({ ...rec, at: Date.now() - 31 * 86_400_000 }), ttl: 1 });
  assert.equal(await oc.authenticateConfidentialClient(kv, id, creds), null);
  assert.equal(kv.puts, puts + 1);
  assert.equal(kv.m.get(`oauth_client:${id}`).ttl, oc.OAUTH_CLIENT_TTL);
  assert.equal(JSON.parse(kv.m.get(`oauth_client:${id}`).v).secret_sha256, rec.secret_sha256, "hash kept");
});

/* --------------------------------------------------------------- refresh grant */

test("refresh for a confidential client requires client auth and is not spent on failure", async () => {
  const { kv, id, secret } = await registered();
  const rt = await orf.issueRefreshToken(kv, TOK, id, true);
  assert.equal(JSON.parse(kv.m.get(`oauth_refresh:${rt}`).v).conf, true);
  const check = (creds) => (bound) => oc.authenticateConfidentialClient(kv, bound, creds);

  const noCheck = await orf.redeemRefreshToken(kv, rt, id, TOK_TTL);
  assert.deepEqual([noCheck.ok, noCheck.error], [false, "invalid_client"], "no check given: refused, not redeemed openly");
  const missing = await orf.redeemRefreshToken(kv, rt, id, TOK_TTL, check(oc.clientCredentials(null, form({ client_id: id }))));
  assert.deepEqual([missing.ok, missing.error, missing.status], [false, "invalid_client", 401]);
  const wrong = await orf.redeemRefreshToken(kv, rt, id, TOK_TTL, check(oc.clientCredentials(basic(id, "cs_" + "0".repeat(64)), form({}))));
  assert.deepEqual([wrong.ok, wrong.error], [false, "invalid_client"]);
  assert.ok(kv.m.has(`oauth_refresh:${rt}`), "failed client auth does not consume the refresh token");

  const good = await orf.redeemRefreshToken(kv, rt, id, TOK_TTL, check(oc.clientCredentials(basic(id, secret), form({}))));
  assert.equal(good.ok, true);
  assert.equal(good.token, TOK);
  assert.equal(kv.m.has(`oauth_refresh:${rt}`), false, "single use");
  assert.equal(JSON.parse(kv.m.get(`oauth_refresh:${good.refresh_token}`).v).conf, true, "rotation keeps conf");
  const post = await orf.redeemRefreshToken(kv, good.refresh_token, id, TOK_TTL, check(oc.clientCredentials(null, form({ client_id: id, client_secret: secret }))));
  assert.equal(post.ok, true, "client_secret_post works for refresh too");
});

test("public client refresh is unchanged: same record shape, the check is never called", async () => {
  const kv = fakeKv();
  const rt = await orf.issueRefreshToken(kv, TOK, "pub1");
  assert.deepEqual(Object.keys(JSON.parse(kv.m.get(`oauth_refresh:${rt}`).v)), ["token", "client_id", "at"]);
  let called = 0;
  const r = await orf.redeemRefreshToken(kv, rt, "", TOK_TTL, async () => { called++; return { error: "invalid_client", message: "x", status: 401 }; });
  assert.equal(r.ok, true);
  assert.equal(called, 0);
  assert.equal(JSON.parse(kv.m.get(`oauth_refresh:${r.refresh_token}`).v).conf, undefined);
});

test("public credentials parse as before: body client_id wins, no Basic header needed", () => {
  const c = oc.clientCredentials(null, form({ client_id: "pub1", code: "x" }));
  assert.deepEqual(c, { id: "pub1", basic: null, basicMalformed: false, postId: "pub1", postSecret: "" });
  assert.equal(oc.clientCredentials("Bearer abc", form({})).basicMalformed, false, "a non-Basic header is ignored");
});

/* ----------------------------------------------------------- route contract */

test("route contract: /oauth/register branches to confidential before the public path", () => {
  const i = src.indexOf('path === "/oauth/register"');
  const block = src.slice(i, src.indexOf('path === "/oauth/authorize"', i));
  const branch = block.indexOf("registrationAuthMethod(metadata, redirectUris)");
  assert.ok(branch > 0);
  assert.ok(block.indexOf("registerConfidentialClient(env.REMOTE_DATA") > branch);
  assert.ok(block.includes('return json(body, 201, { "cache-control": "no-store", pragma: "no-cache" });'));
  assert.ok(block.indexOf("await oauthClientId(metadata)") > block.indexOf("registerConfidentialClient("), "public path after the branch");
  assert.ok(block.includes('token_endpoint_auth_method: "none",'), "public response unchanged");
});

test("route contract: consent marks confidential codes; token endpoint authenticates before PKCE and before spending", () => {
  const c = src.indexOf('path === "/oauth/authorize/consent"');
  const consent = src.slice(c, src.indexOf('path === "/oauth/token"', c));
  assert.ok(consent.includes("isConfidentialRecord(client)"));
  assert.ok(consent.includes("challenge, conf: true }"));
  const t = src.indexOf('path === "/oauth/token"');
  const tok = src.slice(t, src.indexOf("const dl = path.match", t));
  assert.ok(tok.includes('clientCredentials(req.headers.get("authorization"), form)'));
  assert.ok(tok.includes("(bound) => authenticateConfidentialClient(env.REMOTE_DATA, bound, creds)"), "refresh grant authenticates");
  const auth = tok.indexOf("authenticateConfidentialClient(env.REMOTE_DATA, grant.client_id, creds)");
  assert.ok(auth > 0 && tok.indexOf("if (grant.conf === true)") < auth);
  assert.ok(auth < tok.indexOf("verifyPkce(verifier, grant.challenge)"), "PKCE still required after client auth");
  assert.ok(auth < tok.indexOf("await env.REMOTE_DATA.delete(`oauth_code:${code}`)"), "failed auth does not spend the code");
  assert.ok(tok.includes("clientAuthErrorResponse(bad)"));
});
