/**
 * The consent page that Gemini, ChatGPT and Claude users (and store reviewers) see at
 * /oauth/authorize. Extracted from the TS source as text, like test/oauth.test.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const start = src.indexOf("export function oauthConsentPage(");
assert.ok(start > 0, "oauthConsentPage must be exported");
const end = src.indexOf("\n}\n", start) + 3;
const js = src.slice(start, end)
  .replace("export function oauthConsentPage(base: string, params: URLSearchParams, clientName = \"\"): string {", "function oauthConsentPage(base, params, clientName = \"\") {")
  .replace("const esc = (x: unknown) =>", "const esc = (x) =>");
const oauthConsentPage = new Function(`${js}; return oauthConsentPage;`)();

const params = new URLSearchParams({ client_id: "abc", redirect_uri: "https://oauth-redirect.googleusercontent.com/r/x", code_challenge: "c".repeat(43), state: "S\"<x>" });

test("consent page names the client, the brand, Terms and Privacy", () => {
  const html = oauthConsentPage("https://mcp.zovo.one", params, "Google");
  assert.match(html, /<title>Connect McpStamp<\/title>/);
  assert.match(html, /Google wants to use McpStamp tools for you/);
  assert.ok(html.includes("https://www.mcpstamp.com/terms/") && html.includes("https://www.mcpstamp.com/privacy/"));
  assert.ok(html.includes("autom8 LLC"));
});

test("consent page escapes client_name and every hidden field", () => {
  const html = oauthConsentPage("https://mcp.zovo.one", params, "<script>alert(1)</script>");
  assert.ok(!html.includes("<script>alert(1)"), "client_name is escaped");
  assert.ok(html.includes('value="S&quot;&lt;x&gt;"'), "state is escaped in the hidden field");
  for (const k of ["client_id", "redirect_uri", "code_challenge", "state"]) assert.ok(html.includes(`name="${k}"`), k);
});

test("consent page falls back to a neutral name and offers Allow and Cancel", () => {
  const html = oauthConsentPage("https://mcp.zovo.one", params);
  assert.match(html, /An AI app wants to use McpStamp tools/);
  assert.match(html, /name="decision" value="allow"/);
  assert.match(html, /name="decision" value="deny"/);
});

test("route contract: Cancel returns access_denied and mints nothing", () => {
  const i = src.indexOf('path === "/oauth/authorize/consent"');
  const block = src.slice(i, src.indexOf('path === "/oauth/token"', i));
  const deny = block.indexOf('decision") === "deny"');
  assert.ok(deny > 0, "consent handles decision=deny");
  assert.ok(deny < block.indexOf("await mintAnonToken(req, env, ctx)"), "deny is checked before a token is minted");
  assert.ok(block.includes('"access_denied"'));
});
