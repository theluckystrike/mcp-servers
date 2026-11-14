/**
 * OAuth up front for interactive clients (s1114).
 *
 * Claude-User hit /mcp/price-tracker 23 times on 2026-11-14 with no credential; initialize
 * answered 200 through the anonymous discovery path, every tools/call answered 401 and no
 * OAuth request followed. An unauthenticated initialize from a known OAuth-capable client must
 * now answer 401 so the client runs consent before its first call. Probes keep the 200.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const pick = (name) => {
  const m = src.match(new RegExp(`const ${name} = (/.*/i);`));
  assert.ok(m, `${name} must exist`);
  return m[1];
};
const start = src.indexOf("export function wantsOauthUpfront");
const end = src.indexOf("\n}\n", start) + 3;
const body = src.slice(start, end)
  .replace("export function wantsOauthUpfront(method: string | null, userAgent: string, body: string): boolean", "function wantsOauthUpfront(method, userAgent, body)")
  .replace(" as { params?: { clientInfo?: { name?: unknown } } }", "");
const wantsOauthUpfront = new Function(
  `const OAUTH_CLIENT_UA = ${pick("OAUTH_CLIENT_UA")}; const OAUTH_CLIENT_NAME = ${pick("OAUTH_CLIENT_NAME")}; ${body}; return wantsOauthUpfront;`,
)();
const init = (name) => JSON.stringify({ jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name, version: "1" } } });

test("claude.ai initialize without a credential asks for OAuth", () => {
  assert.equal(wantsOauthUpfront("initialize", "Claude-User", init("claude-ai")), true);
  assert.equal(wantsOauthUpfront("initialize", "python-httpx/0.27", init("claude-ai")), true);
  assert.equal(wantsOauthUpfront("initialize", "Claude-User (claude-code/2.1.323; +https://support.anthropic.com/)", "{}"), true);
  assert.equal(wantsOauthUpfront("initialize", "node", init("Visual Studio Code")), true);
  assert.equal(wantsOauthUpfront("initialize", "codex-mcp-client/0.9", "{}"), true);
});

test("probes and unknown clients keep the anonymous discovery path", () => {
  assert.equal(wantsOauthUpfront("initialize", "mcpbeat/1.0", init("mcpbeat")), false);
  assert.equal(wantsOauthUpfront("initialize", "SentinelOracle", init("probe")), false);
  assert.equal(wantsOauthUpfront("initialize", "", "not json"), false);
  assert.equal(wantsOauthUpfront("initialize", "Mozilla/5.0", init("my-claude-ai-wrapper")), false);
});

test("only initialize is gated; tools/list and others are untouched", () => {
  assert.equal(wantsOauthUpfront("tools/list", "Claude-User", "{}"), false);
  assert.equal(wantsOauthUpfront("notifications/initialized", "Claude-User", "{}"), false);
  assert.equal(wantsOauthUpfront(null, "Claude-User", "{}"), false);
});

test("the gate runs before discovery and only without a credential", () => {
  const i = src.indexOf("wantsOauthUpfront(rpc.method");
  assert.ok(i > 0 && i < src.indexOf("const isDiscovery = req.method === \"POST\" && !hasCredential"), "gate must precede the discovery branch");
  assert.match(src.slice(i - 200, i), /!hasCredential/);
  assert.match(src.slice(i, i + 400), /oauth-protected-resource\/mcp\/\$\{product\}/);
});
