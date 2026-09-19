// T15 fix 4 tests: the featured-servers strip on guide pages.
import test from "node:test";
import assert from "node:assert";
import worker from "../src/index.js";

const CTX = { waitUntil() {} };
const page = async (path) =>
  (await worker.fetch(new Request("https://mcp.zovo.one" + path), {}, CTX)).text();

test("guide pages render the featured-servers strip with unique server links", async () => {
  const html = await page("/guides/invoice-pdf-from-chat");
  const m = html.match(/<p class="feat">Popular servers: ([\s\S]*?)<\/p>/);
  assert.ok(m, "featured strip missing on guide page");
  const hrefs = [...m[1].matchAll(/href="\/s\/([a-z0-9-]+)"/g)].map((x) => x[1]);
  assert.ok(hrefs.length >= 6 && hrefs.length <= 8, "expected 6-8 featured servers, got " + hrefs.length);
  assert.equal(new Set(hrefs).size, hrefs.length, "duplicate featured slugs");
  // A guide's own product link lives in the "Servers used in this guide" cross block,
  // never duplicated inside the featured strip.
  assert.ok(!hrefs.includes("invoice"), "featured strip duplicates the guide's own product link");
});

test("featured strip omits the guide's own product page when it would duplicate the cross block", async () => {
  const html = await page("/guides/invoice-pdf-from-chat");
  const feat = html.match(/<p class="feat">([\s\S]*?)<\/p>/)[1];
  assert.ok(!feat.includes('href="/s/invoice"'), "featured strip duplicates the guide's own product link");
});

test("non-guide pages do not carry the featured strip", async () => {
  const html = await page("/s/invoice");
  assert.ok(!html.includes('class="feat"'), "featured strip leaked onto a product page");
});
