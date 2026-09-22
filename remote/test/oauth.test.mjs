/**
 * OAuth 2.1 flow (MCP spec 2025-06-18): discovery documents, dynamic client registration,
 * PKCE (S256) and the token exchange. The route handlers live inside the default export's
 * fetch() and cannot be imported without the Workers runtime, so the pure helpers are
 * extracted from the source as text and evaluated - the same technique as
 * test/connect-mint.test.mjs. The route-level contract (paths, required params, error
 * codes) is asserted against the source so a refactor that breaks the flow fails here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = new URL("../src/index.ts", import.meta.url);
const src = readFileSync(SRC, "utf8");

// Extract the exported pure helpers from the TS source and evaluate them as JS.
function extract(name, signature) {
  const start = src.indexOf(`export function ${signature}`);
  assert.ok(start > 0, `${signature} must be exported from remote/src/index.ts`);
  const end = src.indexOf("\n}\n", start) + 3;
  return src.slice(start, end).replace(`export function ${signature}`, `function ${name}(`);
}

const OAUTH_CONSTS = src.slice(src.indexOf('const GUIDE ='), src.indexOf("interface ", src.indexOf("const OAUTH_RESOURCE ="))).replace(/^const /gm, "var ");
const oauthProtectedResourceDoc = new Function(`${OAUTH_CONSTS}\n${extract("oauthProtectedResourceDoc", "oauthProtectedResourceDoc(")}; return oauthProtectedResourceDoc;`)();
const oauthAuthorizationServerDoc = new Function(`${OAUTH_CONSTS}\n${extract("oauthAuthorizationServerDoc", "oauthAuthorizationServerDoc(")}; return oauthAuthorizationServerDoc;`)();

// oauthClientId is async, so evaluate it separately with an async wrapper.
const cidStart = src.indexOf("export async function oauthClientId(");
assert.ok(cidStart > 0, "oauthClientId must be exported");
const cidEnd = src.indexOf("\n}\n", cidStart) + 3;
const oauthClientId = new Function(
  "return " + src.slice(cidStart + "export ".length, cidEnd).replace(": Record<string, unknown>): Promise<string>", ")") + "; return oauthClientId;",
)();

const s256Start = src.indexOf("export async function s256Challenge(");
assert.ok(s256Start > 0, "s256Challenge must be exported");
const s256End = src.indexOf("\n}\n", s256Start) + 3;
const s256Challenge = new Function(
  "return " + src.slice(s256Start + "export ".length, s256End).replace(": string): Promise<string>", ")") + "; return s256Challenge;",
)();

test("RFC 9728 protected-resource metadata advertises this host as its own AS", () => {
  const doc = oauthProtectedResourceDoc();
  assert.equal(doc.resource, "https://mcp.zovo.one");
  assert.deepEqual(doc.authorization_servers, ["https://mcp.zovo.one"]);
  assert.deepEqual(doc.scopes_supported, ["mcp:connect"]);
  assert.ok(doc.resource_documentation.startsWith("https://"));
});

test("RFC 8414 authorization-server metadata has the endpoints an MCP client needs", () => {
  const doc = oauthAuthorizationServerDoc();
  assert.equal(doc.issuer, "https://mcp.zovo.one");
  assert.equal(doc.authorization_endpoint, "https://mcp.zovo.one/oauth/authorize");
  assert.equal(doc.token_endpoint, "https://mcp.zovo.one/oauth/token");
  assert.equal(doc.registration_endpoint, "https://mcp.zovo.one/oauth/register");
  assert.deepEqual(doc.response_types_supported, ["code"]);
  assert.deepEqual(doc.grant_types_supported, ["authorization_code"]);
  // PKCE S256 is mandatory in OAuth 2.1; plain must never be advertised.
  assert.deepEqual(doc.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(doc.token_endpoint_auth_methods_supported, ["none"]);
});

test("dynamic client registration derives a stable id from the metadata", async () => {
  const meta = { redirect_uris: ["https://claude.ai/api/mcp/auth/callback"], client_name: "test" };
  const id1 = await oauthClientId(meta);
  const id2 = await oauthClientId({ client_name: "test", redirect_uris: ["https://claude.ai/api/mcp/auth/callback"] });
  assert.equal(id1, id2, "same metadata (any key order) must give the same client_id");
  assert.match(id1, /^[0-9a-f]{32}$/, "client_id is 32 hex chars like the other ids in this worker");
  const other = await oauthClientId({ redirect_uris: ["https://example.com/cb"] });
  assert.notEqual(id1, other, "different metadata must give a different client_id");
});

test("S256 challenge matches RFC 7636 appendix B test vector", async () => {
  // Appendix B of RFC 7636: verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
  // -> challenge "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM".
  const challenge = await s256Challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
  assert.equal(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("route contract: all five endpoints are wired into the fetch router", () => {
  for (const route of [
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-authorization-server',
    '"/oauth/register"',
    '"/oauth/authorize"',
    '"/oauth/authorize/consent"',
    '"/oauth/token"',
  ]) {
    assert.ok(src.includes(route), `router must handle ${route}`);
  }
});

test("route contract: the 401 advertises RFC 9728 resource metadata", () => {
  assert.ok(
    src.includes('resource_metadata="${OAUTH_RESOURCE_META}"'),
    "the no-token 401 must carry resource_metadata so clients can discover the AS",
  );
});

test("route contract: authorization codes are single-use and short-lived", () => {
  assert.ok(src.includes("OAUTH_CODE_TTL = 10 * 60"), "code TTL is 10 minutes");
  assert.ok(
    src.includes('await env.REMOTE_DATA.delete(`oauth_code:${code}`)'),
    "token endpoint deletes the code before responding (replay gets invalid_grant)",
  );
});

test("route contract: consent mints an anon token, so authenticate() works unchanged", () => {
  const consentIdx = src.indexOf('path === "/oauth/authorize/consent"');
  assert.ok(consentIdx > 0);
  const block = src.slice(consentIdx, src.indexOf('path === "/oauth/token"', consentIdx));
  assert.ok(block.includes("await mintAnonToken(req, env)"), "consent reuses the existing anon-token minting machinery");
  assert.ok(/oauth_code:/.test(block), "the minted token is bound to an authorization code in KV");
});
