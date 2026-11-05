/**
 * RFC 9728 path-specific protected resource metadata and the tokenless unknown-method
 * answer (s1102m dogfood, 2026-11-02).
 *
 * Claude's connector docs (claude.com/docs/connectors/building/authentication.md): "the
 * document's `resource` field must equal the URL as the user enters it in Claude, including
 * any path component". RFC 9728 §3.1 puts that document at
 * /.well-known/oauth-protected-resource<path>, and §3.3 requires its `resource` to be
 * identical to the URL the suffix was inserted into. The root document stays as it was.
 *
 * The router lives in the default export and cannot run under plain Node (see
 * connected-apps.test.mjs), so the pure helpers are extracted from the source and the
 * route wiring is asserted against the source text, the same technique as oauth.test.mjs.
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
function constSource(name) {
  // Not exported: the entry module's named exports must be functions (workerd rejects a
  // non-function export as an entrypoint), so constants are read from the source.
  const start = src.indexOf(`\nconst ${name} =`);
  assert.ok(start > 0, `${name} must be declared in remote/src/index.ts`);
  const end = src.indexOf(";\n", start) + 2;
  return src.slice(start + 1, end);
}

const OAUTH_CONSTS = src.slice(src.indexOf("const GUIDE ="), src.indexOf("interface ", src.indexOf("const OAUTH_RESOURCE ="))).replace(/^const /gm, "var ");
const code = stripTypeScriptTypes([
  OAUTH_CONSTS,
  constSource("RESOURCE_PATH_RE"),
  constSource("MCP_REQUEST_METHODS"),
  fnSource("oauthProtectedResourceDoc"),
  fnSource("oauthProtectedResourceDocFor"),
  fnSource("resourceMetadataUrl"),
].join("\n"));
const h = new Function(`${code}\nreturn { OAUTH_RESOURCE_META, RESOURCE_PATH_RE, MCP_REQUEST_METHODS, oauthProtectedResourceDoc, oauthProtectedResourceDocFor, resourceMetadataUrl };`)();

const BASE = "https://mcp.zovo.one";

test("root protected resource document is unchanged (backward compatibility)", () => {
  const doc = h.oauthProtectedResourceDoc();
  assert.equal(doc.resource, "https://mcp.zovo.one");
  assert.deepEqual(doc.authorization_servers, ["https://mcp.zovo.one"]);
  assert.equal(h.OAUTH_RESOURCE_META, "https://mcp.zovo.one/.well-known/oauth-protected-resource");
});

test("RFC 9728 §3.1: metadata URL is the well-known suffix inserted before the path", () => {
  assert.equal(h.resourceMetadataUrl(BASE, "/mcp/invoice/v1"), "https://mcp.zovo.one/.well-known/oauth-protected-resource/mcp/invoice/v1");
  assert.equal(h.resourceMetadataUrl(BASE, "/mcp/invoice"), "https://mcp.zovo.one/.well-known/oauth-protected-resource/mcp/invoice");
});

test("RFC 9728 §3.3: the path-specific document's resource is the exact server URL", () => {
  for (const p of ["/mcp/invoice/v1", "/mcp/invoice", "/mcp/time-tracker"]) {
    const doc = h.oauthProtectedResourceDocFor(`${BASE}${p}`);
    assert.equal(doc.resource, `${BASE}${p}`);
    // Inserting the suffix into doc.resource must give back the URL the document is served at.
    const u = new URL(doc.resource);
    assert.equal(h.resourceMetadataUrl(u.origin, u.pathname), `${BASE}/.well-known/oauth-protected-resource${p}`);
    // Same authorization server, scopes and docs as the root document.
    const { resource: _r, ...rest } = doc;
    const { resource: _r2, ...rootRest } = h.oauthProtectedResourceDoc();
    assert.deepEqual(rest, rootRest);
  }
});

test("only /mcp/<server> and /mcp/<server>/v1 are resource paths; tokened URLs are not", () => {
  for (const ok of ["/mcp/invoice", "/mcp/invoice/v1", "/mcp/bank-statement"]) assert.ok(h.RESOURCE_PATH_RE.test(ok), ok);
  for (const bad of ["/mcp/invoice/t/anon_0123456789abcdef0123456789abcdef", "/mcp/invoice/v2", "/mcp", "/mcp/Invoice", "/oauth/token", "/mcp/invoice/v1/x"]) {
    assert.ok(!h.RESOURCE_PATH_RE.test(bad), bad);
  }
});

test("route: path-specific metadata is served, checked against real servers, and 404s otherwise", () => {
  const at = src.indexOf('path.startsWith("/.well-known/oauth-protected-resource/")');
  assert.ok(at > 0, "router must serve /.well-known/oauth-protected-resource/<path>");
  const block = src.slice(at, src.indexOf("\n    }\n", at));
  assert.ok(block.includes("RESOURCE_PATH_RE") && block.includes("SERVERS[VARIANT_ALIASES[name] ?? name]"), "only known servers get a document");
  assert.ok(block.includes("oauthProtectedResourceDocFor(`${base}${resourcePath}`)"), "resource = request origin + exact path");
  assert.ok(block.includes(", 404)"), "anything else is a 404");
  assert.ok(src.indexOf('path === "/.well-known/oauth-protected-resource"') < at, "the exact root route still answers first");
});

test("route: the MCP endpoint 401 points at its own path-specific document", () => {
  assert.ok(src.includes("resourceMetadataUrl(base, clean ? `${path}/v1` : path)"),
    "authenticate() on /mcp/<server>[/v1] is given the path-specific resource_metadata URL");
  // whoami is not an MCP server: it keeps the root document.
  assert.ok(src.includes('await authenticate(req, env, "*", urlToken, urlTokenForm);'));
});

test("MCP_REQUEST_METHODS holds the 2025-11-25 client request methods and no notifications", () => {
  for (const m of ["initialize", "ping", "tools/list", "tools/call", "resources/read", "prompts/get", "completion/complete", "logging/setLevel", "tasks/get"]) {
    assert.ok(h.MCP_REQUEST_METHODS.has(m), m);
  }
  assert.ok(!h.MCP_REQUEST_METHODS.has("mcpstamp/unknown-method-probe"));
  assert.ok(![...h.MCP_REQUEST_METHODS].some((m) => m.startsWith("notifications/")));
});

test("route: a tokenless unknown method gets JSON-RPC -32601 (HTTP 200) before authentication", () => {
  const at = src.indexOf("!MCP_REQUEST_METHODS.has(rpc.method)");
  assert.ok(at > 0, "unknown-method short-circuit must exist");
  const line = src.slice(src.lastIndexOf("\n", at), src.indexOf("\n    }\n", at));
  assert.ok(line.includes("!hasCredential"), "only without a credential: a present token is still validated (401 if bad)");
  assert.ok(line.includes("rpc.hasId"), "notifications are not answered");
  assert.ok(line.includes('rpcError(rpc.id, -32601, "Method not found")'));
  assert.ok(at < src.indexOf("const authed = await authenticate(req, env, product"), "runs before authenticate()");
  assert.ok(at > src.indexOf("const hasCredential ="), "uses the same credential test as discovery");
  // rpcError answers with HTTP 200, as the SDK transport does.
  const re = src.slice(src.indexOf("function rpcError("), src.indexOf("\n}\n", src.indexOf("function rpcError(")));
  assert.ok(re.includes("status: 200"));
});
