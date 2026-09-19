// T15 fix 1: the priority-guide nav must be the first element after <body> on every
// rendered page so crawlers with a shallow budget still see measured high-traffic
// guide links near the top of the DOM.

import test from "node:test";
import assert from "node:assert";
import worker from "../src/index.js";

const CTX = { waitUntil() {} };
const page = async (path) =>
  (await worker.fetch(new Request("https://mcp.zovo.one" + path), {}, CTX)).text();

test("priority guide nav is the first element inside body", async () => {
  const html = await page("/s/invoice");
  const m = html.match(/<body>(.{0,80})/s);
  assert.ok(m, "body tag present");
  assert.ok(
    m[1].startsWith('<nav class="pg" aria-label="Popular guides">'),
    "nav.pg is first in body, got: " + m[1].slice(0, 60)
  );
});

test("priority guide nav on home has 10 unique real guide links", async () => {
  const html = await page("/");
  const nav = html.match(/<nav class="pg"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const hrefs = [...nav.matchAll(/href="\/guides\/([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.equal(hrefs.length, 10, "10 priority guides, got " + hrefs.length);
  assert.equal(new Set(hrefs).size, 10, "no duplicate slugs");
});

test("guide pages carry the priority nav too", async () => {
  const html = await page("/guides/invoice-pdf-from-chat");
  assert.ok(html.includes('<nav class="pg" aria-label="Popular guides">'), "nav missing on guide page");
});
