// The office-suite guide's slug and body carried version-specific facts (nineteen
// servers, 186 tools) that aged out when the count moved to twenty and 198 (docs/
// CONTENT_R17_RESULT.md). The guide was rewritten under a version-free slug and the
// old slug now 301s rather than 404s, so an indexed link or bookmark keeps working.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";
import { GUIDES } from "../src/content.js";

const OLD_SLUG = "one-install-nineteen-servers-office-suite";
const NEW_SLUG = "one-install-office-suite";

const INDEX = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "index.js"), "utf8");

test("the old guide slug is gone from GUIDES and the new one replaces it", () => {
  assert.equal(OLD_SLUG in GUIDES, false, "the old slug should no longer be a live guide");
  assert.equal(NEW_SLUG in GUIDES, true, "the new version-free slug should be a live guide");
});

test("GET /guides/<old slug> 301s to /guides/<new slug>", async () => {
  const req = new Request(`https://mcp.zovo.one/guides/${OLD_SLUG}`);
  const res = await worker.fetch(req, {}, { waitUntil: () => {} });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), `https://mcp.zovo.one/guides/${NEW_SLUG}`);
});

test("GET /guides/<new slug> serves the guide directly", async () => {
  const req = new Request(`https://mcp.zovo.one/guides/${NEW_SLUG}`);
  const res = await worker.fetch(req, {}, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /198 tools/);
});

test("the redirect map is source-level wired for the old slug", () => {
  assert.match(INDEX, /GUIDE_REDIRECTS/);
  assert.match(INDEX, new RegExp(`"${OLD_SLUG}": "${NEW_SLUG}"`));
});

test("/sitemap.xml lists only the new slug, never the old one", async () => {
  const req = new Request("https://mcp.zovo.one/sitemap.xml");
  const res = await worker.fetch(req, {}, { waitUntil: () => {} });
  const xml = await res.text();
  assert.equal(xml.includes(OLD_SLUG), false, "sitemap must not list the retired slug");
  assert.ok(xml.includes(`/guides/${NEW_SLUG}`), "sitemap must list the new slug");
});

test("/llms.txt lists only the new slug, never the old one", async () => {
  const req = new Request("https://mcp.zovo.one/llms.txt");
  const res = await worker.fetch(req, {}, { waitUntil: () => {} });
  const txt = await res.text();
  assert.equal(txt.includes(OLD_SLUG), false, "llms.txt must not list the retired slug");
  assert.ok(txt.includes(`/guides/${NEW_SLUG}`), "llms.txt must list the new slug");
});
