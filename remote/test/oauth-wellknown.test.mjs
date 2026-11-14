/**
 * OAuth discovery path shapes.
 *
 * RFC 9728 §3.1 and RFC 8414 §3.1 publish metadata for a resource with a path under
 * /.well-known/<doc>/<path>; some clients try /<path>/.well-known/<doc>. Production
 * traffic on 2026-11-13 showed 190k requests to those variants answering 404 while only
 * the bare root path was served, so no client ever reached the consent screen. These
 * tests pin every shape plus the paths that must stay 404 (nothing outside /mcp).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

function extract(signature) {
  const start = src.indexOf(`export function ${signature}`);
  assert.ok(start > 0, `${signature} must be exported from remote/src/index.ts`);
  const end = src.indexOf("\n}\n", start) + 3;
  return src.slice(start, end).replace(`export function ${signature}`, `function ${signature}`);
}

const wellKnownOauth = new Function(
  `${extract("wellKnownOauth(path: string, base: string)")
    .replace("wellKnownOauth(path: string, base: string): { kind: \"pr\" | \"as\"; resource?: string } | null",
      "wellKnownOauth(path, base)")
    .replace("] as const;", "];")}; return wellKnownOauth;`,
)();
const BASE = "https://mcp.zovo.one";

test("bare root paths keep working", () => {
  assert.deepEqual(wellKnownOauth("/.well-known/oauth-protected-resource", BASE), { kind: "pr" });
  assert.deepEqual(wellKnownOauth("/.well-known/oauth-authorization-server", BASE), { kind: "as" });
});

test("suffix form resolves and carries the resource URL", () => {
  assert.deepEqual(
    wellKnownOauth("/.well-known/oauth-protected-resource/mcp/invoice", BASE),
    { kind: "pr", resource: `${BASE}/mcp/invoice` },
  );
  assert.deepEqual(
    wellKnownOauth("/.well-known/oauth-authorization-server/mcp/invoice", BASE),
    { kind: "as", resource: `${BASE}/mcp/invoice` },
  );
});

test("prefix form resolves for clients that put the well-known segment after the path", () => {
  assert.deepEqual(
    wellKnownOauth("/mcp/.well-known/oauth-protected-resource", BASE),
    { kind: "pr", resource: `${BASE}/mcp` },
  );
  assert.deepEqual(
    wellKnownOauth("/mcp/invoice/.well-known/oauth-authorization-server", BASE),
    { kind: "as", resource: `${BASE}/mcp/invoice` },
  );
});

test("trailing slash on the root path still resolves", () => {
  assert.deepEqual(wellKnownOauth("/.well-known/oauth-protected-resource/", BASE), { kind: "pr" });
});

test("paths outside /mcp never resolve", () => {
  assert.equal(wellKnownOauth("/.well-known/oauth-protected-resource/s/barcode", BASE), null);
  assert.equal(wellKnownOauth("/buy/.well-known/oauth-protected-resource", BASE), null);
  assert.equal(wellKnownOauth("/mcp", BASE), null);
  assert.equal(wellKnownOauth("/", BASE), null);
});

test("the protected-resource document reflects the requested path", () => {
  const doc = src.slice(src.indexOf("export function oauthProtectedResourceDoc"), src.indexOf("/** RFC 8414"));
  assert.match(doc, /resource: resource \?\? OAUTH_RESOURCE/);
});
