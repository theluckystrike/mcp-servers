// T13: additive social-meta gates for the mcp.zovo.one worker.
//
// Round 13 added Twitter Card tags to the shared page()/og() helpers and Organization +
// WebSite JSON-LD to the home page. These tests lock in that the additions actually render,
// that the OG tags they accompany are still present, and that nothing new carries the banned
// em-dash soft-tell flagged by scan.py.

import test from "node:test";
import assert from "node:assert";
import worker from "../src/index.js";

const CTX = { waitUntil() {} };
const page = async (path) =>
  (await worker.fetch(new Request("https://mcp.zovo.one" + path), {}, CTX)).text();

test("home page renders Organization JSON-LD", async () => {
  const html = await page("/");
  assert.ok(html.includes('"@type":"Organization"'), "home JSON-LD lacks Organization");
  assert.ok(
    html.includes('"url":"https://mcp.zovo.one/"') && html.includes('"sameAs":["https://github.com/theluckystrike"]'),
    "home Organization lacks url/sameAs"
  );
});

test("home page renders WebSite JSON-LD with a publisher", async () => {
  const html = await page("/");
  assert.ok(html.includes('"@type":"WebSite"'), "home JSON-LD lacks WebSite");
  assert.ok(html.includes('"publisher":{"@type":"Organization"'), "WebSite JSON-LD lacks publisher");
});

test("web site has no /search route, so no SearchAction is emitted", async () => {
  const html = await page("/");
  assert.ok(
    !html.includes("SearchAction"),
    "SearchAction emitted even though no /search route exists on the worker"
  );
});

test("every rendered HTML page carries a twitter:card summary tag", async () => {
  const paths = ["/", "/bundle", "/changelog", "/privacy", "/guides", "/s/invoice", "/setup/claude-desktop"];
  for (const p of paths) {
    const res = await worker.fetch(new Request("https://mcp.zovo.one" + p), {}, CTX);
    if (res.status !== 200) continue; // non-indexed route may 404; skip without failing
    const html = await res.text();
    assert.ok(
      html.includes('<meta name="twitter:card" content="summary">'),
      `${p} is missing the twitter:card summary tag`
    );
    assert.ok(html.includes('<meta name="twitter:title"'), `${p} is missing twitter:title`);
  }
});

test("a page with OG still keeps its OG tags (additive only)", async () => {
  const html = await page("/s/invoice");
  assert.ok(html.includes('<meta property="og:title"'), "/s/invoice lost og:title");
  assert.ok(html.includes('<meta property="og:site_name"'), "/s/invoice lost og:site_name");
  assert.ok(
    !html.includes("summary_large_image"),
    "summary_large_image used although the site has no og:image asset"
  );
});

test("no new twitter/og markup uses a banned em-dash", async () => {
  for (const p of ["/", "/guides", "/compare"]) {
    const html = await page(p);
    assert.ok(!html.includes("\u2014"), `${p} contains an em-dash`);
  }
});