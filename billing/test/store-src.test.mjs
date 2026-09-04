// Conversion instrument (docs/CONVERSION_INSTRUMENT.md), storefront half.
//
// The cap messages on the servers tag their /buy links with src=<product>.<tool>. The
// storefront's own links did not, which is where the recurring.unknown and resume.unknown
// rows on /stats/clicks came from: a reader who clicked Buy on a product page was counted
// as an untagged click and could not be told apart from a malformed one.
//
// This suite is a static read of the rendered sources: every /buy href a page can emit
// must carry src=store.<page>. It never spawns a worker, so it costs nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Every href="/buy/..." or href="https://mcp.zovo.one/buy/..." in a source file. */
function buyHrefs(text) {
  return [...text.matchAll(/href="(?:https:\/\/mcp\.zovo\.one)?\/buy\/[^"]*"/g)].map((m) => m[0]);
}

test("every /buy href rendered by the billing worker carries a src=store.<page> tag", () => {
  const offenders = [];
  for (const f of readdirSync(SRC).filter((f) => f.endsWith(".js"))) {
    for (const href of buyHrefs(readFileSync(join(SRC, f), "utf8"))) {
      if (!/[?&]src=(?:store\.|\$\{)/.test(href)) offenders.push(`${f}: ${href}`);
    }
  }
  assert.deepEqual(offenders, [], "untagged /buy links:\n" + offenders.join("\n"));
});

test("the pages generated from the READMEs are tagged with the product page that shows them", () => {
  const text = readFileSync(join(SRC, "pages.js"), "utf8");
  const PAGES = JSON.parse(text.slice(text.indexOf("=") + 1).trim().replace(/;\s*$/, ""));
  const hrefs = buyHrefs(Object.values(PAGES).map((p) => p.html).join("\n"));
  assert.ok(hrefs.length > 0, "expected the product pages to link to /buy at all");
  for (const href of hrefs) {
    assert.match(href, /\?src=store\.s\.[a-z0-9-]+"$/, `untagged product-page link: ${href}`);
  }
});

test("the tags the storefront emits are shapes the /buy route will accept", async () => {
  const { validSrc } = await import("../src/index.js");
  for (const src of ["store.home", "store.s.time-tracker", "store.guide.mcp-invoice-server",
                     "store.compare.pdf", "store.setup.claude-desktop"]) {
    assert.equal(validSrc(src), true, `${src} must survive the /buy route's validSrc filter`);
  }
});
