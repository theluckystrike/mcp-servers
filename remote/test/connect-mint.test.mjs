/**
 * /mcp/connect must not mint a token for a robot.
 *
 * Minting is a KV read plus two KV writes, one of them a `tok:` key that holds a data space
 * for ANON_TTL (30 days), and it is rate limited to TOKEN_MINTS_PER_IP (10) per IP per hour.
 * Until 2026-09-10 every GET and every HEAD minted unconditionally. That was survivable
 * while nothing linked here. It stopped being survivable in loop 33, when this page became
 * the hero destination of all 30 product pages and of /llms.txt and went into the sitemap
 * (docs/FUNNEL_R1.md), because:
 *
 *   - a crawler left a 30-day tenant nobody owns behind every fetch, and
 *   - the 11th load in an hour from one address returns HTTP 429, so a NAT, a VPN exit or
 *     an office proxy could take the entry point to the whole free tier off the air for
 *     everyone behind it.
 *
 * isBrowserNavigation is pure, so it is extracted from the source rather than imported:
 * src/index.ts pulls in the Workers runtime. Same technique as test/binding.test.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = new URL("../src/index.ts", import.meta.url);
const src = readFileSync(SRC, "utf8");

const start = src.indexOf("export function isBrowserNavigation(");
assert.ok(start > 0, "isBrowserNavigation must be exported from remote/src/index.ts");
const end = src.indexOf("\n}\n", start) + 3;
const uaStart = src.indexOf("const NOT_A_PERSON_UA =");
assert.ok(uaStart > 0, "NOT_A_PERSON_UA must exist in remote/src/index.ts");
const uaLine = src.slice(uaStart, src.indexOf("\n", uaStart));
const fn = src
  .slice(start, end)
  .replace("export function isBrowserNavigation(headers: Headers): boolean {", "function isBrowserNavigation(headers) {");
const isBrowserNavigation = new Function(`${uaLine}\n${fn}; return isBrowserNavigation;`)();

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const NAV = { "user-agent": CHROME, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-site": "none" };
const h = (o) => new Headers(o);

test("a person opening the page in a browser still gets a token with no extra click", () => {
  assert.equal(isBrowserNavigation(h(NAV)), true);
  for (const ua of [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  ]) assert.equal(isBrowserNavigation(h({ ...NAV, "user-agent": ua })), true, ua);
});

test("no crawler mints, wherever the bot token sits in its User-Agent", () => {
  // Every one of these sends `accept: text/html`, which is why an Accept-based test does
  // not separate them from a person. They do not send Fetch Metadata.
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
    "curl/8.4.0",
    "python-requests/2.32.3",
  ]) {
    // Even when it forges the whole navigation fingerprint, the named UA still loses.
    assert.equal(isBrowserNavigation(h({ ...NAV, "user-agent": ua })), false, ua);
  }
});

test("a fetch, an empty UA and a prefetch do not mint", () => {
  assert.equal(isBrowserNavigation(h({ ...NAV, "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" })), false, "an XHR/fetch minted");
  assert.equal(isBrowserNavigation(h({ "user-agent": CHROME, accept: "text/html" })), false, "no Fetch Metadata still minted");
  assert.equal(isBrowserNavigation(h({ ...NAV, "user-agent": "" })), false, "an empty UA minted");
  // A prefetch throws the response away, so a token minted for one is a data space the
  // reader never asked for and will never see.
  assert.equal(isBrowserNavigation(h({ ...NAV, "sec-purpose": "prefetch;anonymous-client-ip" })), false, "a prefetch minted");
});

test("the route mints only on a real navigation or an explicit ?mint=1, and never on HEAD", () => {
  const i = src.indexOf('if (path === "/mcp/connect")');
  assert.ok(i > 0, "the /mcp/connect route moved");
  const route = src.slice(i, src.indexOf('if (path === "/mcp/whoami")', i));
  assert.match(route, /url\.searchParams\.get\("mint"\) === "1" \|\| isBrowserNavigation\(req\.headers\)/, "the mint condition is gone");
  assert.match(route, /req\.method === "GET" &&/, "a HEAD can still mint");
  assert.match(route, /req\.method === "HEAD" \? null : html/, "a HEAD no longer matches the GET it describes");
  // The token that was passed in is still reused: a reload with ?token= must not strand a
  // caller's data space behind a fresh one.
  assert.match(route, /\^anon_\[0-9a-f\]\{32\}\$/, "the ?token= reuse path is gone");
});

test("the page served without a token is still a complete page, with one link that mints", () => {
  const i = src.indexOf("function connectPage(");
  assert.ok(i > 0);
  const page = src.slice(i, src.indexOf("\nconst ", i + 10) > 0 ? src.indexOf("\n/**", i + 10) : src.length);
  assert.ok(page.includes('href="${base}/mcp/connect?mint=1"'), "the tokenless page has no way to mint");
  assert.ok(page.includes("Get my free token"), "the mint link has no label a reader would click");
  assert.ok(page.includes("&lt;token&gt;"), "the tokenless page does not show where the token goes");
});
