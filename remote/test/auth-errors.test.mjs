/**
 * 401 challenges on the MCP endpoints and error answers of /oauth/authorize (s1102m QA P2-25,
 * 2026-11-02).
 *
 * RFC 6750 §3: a 401 carries WWW-Authenticate; §3.1: "If the request lacks any
 * authentication information ... the resource server SHOULD NOT include an error code", and a
 * token that is "expired, revoked, malformed, or invalid" gets error="invalid_token".
 * RFC 9728 §5.1 / MCP 2025-11-25 authorization: resource_metadata names the PRM document.
 * RFC 6749 §4.1.2.1: an invalid client_id or redirect_uri is shown to the user and never
 * redirected; any other error is redirected to the client with error= and state.
 *
 * The router cannot run under plain Node (see connected-apps.test.mjs), so the pure helpers
 * are extracted from the source and the route wiring is asserted against the source text.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

function fnSource(name) {
  const start = src.indexOf(`export function ${name}(`);
  assert.ok(start > 0, `${name} must be exported from remote/src/index.ts`);
  const end = src.indexOf("\n}\n", start) + 3;
  return src.slice(start + "export ".length, end);
}
const code = stripTypeScriptTypes([
  fnSource("bearerChallenge"),
  fnSource("oauthErrorRedirect"),
  fnSource("authorizeParamsError"),
].join("\n"));
const h = new Function(`${code}\nreturn { bearerChallenge, oauthErrorRedirect, authorizeParamsError };`)();

const PRM = "https://mcp.zovo.one/.well-known/oauth-protected-resource/mcp/invoice/v1";

test("no token: challenge has resource_metadata and no error code (RFC 6750 §3.1)", () => {
  const v = h.bearerChallenge(PRM);
  assert.equal(v, `Bearer realm="mcp.zovo.one", resource_metadata="${PRM}"`);
  assert.ok(!v.includes("error="));
});

test("present but invalid token: error=\"invalid_token\" plus the path-specific resource_metadata", () => {
  const v = h.bearerChallenge(PRM, "invalid_token", "Unknown or expired token");
  assert.equal(v, `Bearer realm="mcp.zovo.one", error="invalid_token", error_description="Unknown or expired token", resource_metadata="${PRM}"`);
});

test("error_description cannot break out of its quoted string", () => {
  const v = h.bearerChallenge(PRM, "invalid_token", 'a"b\\c\nd');
  assert.ok(v.includes('error_description="abcd"'), v);
});

test("authenticate(): the tokenless 401 has no error code, every token-present 401 has invalid_token", () => {
  const start = src.indexOf("async function authenticate(");
  const body = src.slice(start, src.indexOf("\n}\n", start));
  const [noToken, rest] = body.split("const invalid = ");
  assert.ok(noToken.includes('"www-authenticate": bearerChallenge(resourceMeta) }'), "tokenless 401 uses the plain challenge");
  assert.ok(rest.startsWith("(body: Record<string, unknown>, why: string) =>\n    json(body, 401, { \"www-authenticate\": bearerChallenge(resourceMeta, \"invalid_token\", why) })"));
  assert.ok(!/json\([^)]*, 401\)/.test(rest.slice(rest.indexOf(";"))), "no token-present 401 is sent without the challenge");
  assert.equal((rest.match(/return invalid\(/g) || []).length, 5, "licence, licence id, malformed, unknown, unrecognised");
  assert.ok(!src.includes('error="invalid_token", resource_metadata'), "no hard-coded invalid_token challenge is left");
});

test("authorize params: S256 challenge with code/S256 or missing response_type/method passes", () => {
  const c = "a".repeat(43);
  assert.equal(h.authorizeParamsError(new URLSearchParams({ response_type: "code", code_challenge: c, code_challenge_method: "S256" })), null);
  assert.equal(h.authorizeParamsError(new URLSearchParams({ code_challenge: c })), null, "the consent form sends no response_type or method");
});

test("authorize params: wrong response_type, method or challenge is an RFC 6749 error code", () => {
  const c = "a".repeat(43);
  assert.equal(h.authorizeParamsError(new URLSearchParams({ response_type: "token", code_challenge: c })).error, "unsupported_response_type");
  assert.equal(h.authorizeParamsError(new URLSearchParams({ code_challenge: c, code_challenge_method: "plain" })).error, "invalid_request");
  assert.equal(h.authorizeParamsError(new URLSearchParams({})).error, "invalid_request");
  assert.equal(h.authorizeParamsError(new URLSearchParams({ code_challenge: "short" })).error, "invalid_request");
});

test("error redirect keeps the client's query and adds error, error_description and state", () => {
  const u = new URL(h.oauthErrorRedirect("https://claude.ai/api/mcp/auth_callback?x=1", "invalid_request", "bad", "st&1"));
  assert.equal(u.origin + u.pathname, "https://claude.ai/api/mcp/auth_callback");
  assert.equal(u.searchParams.get("x"), "1");
  assert.equal(u.searchParams.get("error"), "invalid_request");
  assert.equal(u.searchParams.get("error_description"), "bad");
  assert.equal(u.searchParams.get("state"), "st&1");
  assert.equal(new URL(h.oauthErrorRedirect("https://a.example/cb", "invalid_request", "", "")).search, "?error=invalid_request");
});

for (const route of ['path === "/oauth/authorize" && req.method === "GET"', 'path === "/oauth/authorize/consent" && req.method === "GET"']) {
  test(`route ${route.split('"')[1]}: 400 page for client and redirect_uri, redirect for the rest`, () => {
    const i = src.indexOf(route);
    assert.ok(i > 0);
    const block = src.slice(i, src.indexOf("\n    }\n", i));
    assert.ok(/if \(!client\) return htmlPage\(oauthAuthorizeErrorPage\([^)]*\), 400\);/.test(block), "unknown client is a 400 page");
    assert.ok(/if \(!registered\.includes\(redirectUri\)\) return htmlPage\(oauthAuthorizeErrorPage\([^)]*\), 400\);/.test(block), "unregistered redirect_uri is a 400 page");
    const bad = block.indexOf("authorizeParamsError(url.searchParams)");
    assert.ok(bad > block.indexOf("registered.includes(redirectUri)"), "params are judged only after redirect_uri is verified");
    assert.ok(block.includes("Response.redirect(oauthErrorRedirect(redirectUri, bad.error, bad.description,"), "other errors go back to the client");
    assert.ok(!/htmlPage\(oauthAuthorizeErrorPage\([^)]*\)\)/.test(block), "no error page is sent with HTTP 200");
  });
}

test("htmlPage takes a status; the consent page itself is still 200 and branded", () => {
  assert.ok(src.includes("function htmlPage(html: string, status = 200): Response {"));
  const i = src.indexOf('path === "/oauth/authorize" && req.method === "GET"');
  const block = src.slice(i, src.indexOf("\n    }\n", i));
  assert.ok(block.includes("oauthConsentPage(base, url.searchParams, clientName)"));
  assert.ok(block.indexOf("authorizeParamsError") < block.indexOf("oauthConsentPage("), "the consent page is shown only for a valid request");
});
