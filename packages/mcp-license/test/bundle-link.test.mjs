// The bundle sentence on every cap message (docs/CONVERSION_INSTRUMENT.md).
//
// Measured over the 7 days to 2026-09-05: 65 upgrade-link clicks, none of them through
// any bundle source, because no cap message carried a bundle link at all - the $39 offer
// was named in prose with nothing to click. Every cap message now ends with one sentence
// that names the count and the price and links to /buy/bundle, tagged with the same src
// as the single-server link plus ".bundle", so the two offers on one message are counted
// apart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLicenseGate, hostedUpgradeText, bundleLink, bundleSentence,
  SERVER_COUNT, PRICE_BUNDLE_USD,
} from "../dist/index.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * SERVER_COUNT cannot be derived at runtime: the published package has no view of
 * servers/. So it is a constant, and this is the alarm on it. A server sells Pro exactly
 * when it builds a licence gate of its own - that is the same set whose cap messages
 * carry this sentence. servers/office-suite is the one directory with a package.json and
 * no gate: it proxies the others and sells nothing itself.
 */
function sellableServers() {
  const dir = join(REPO, "servers");
  return readdirSync(dir).filter((id) => {
    if (!existsSync(join(dir, id, "package.json"))) return false;
    const src = join(dir, id, "src", "index.ts");
    return existsSync(src) && readFileSync(src, "utf8").includes("createLicenseGate");
  });
}

test("SERVER_COUNT matches the number of servers that actually sell Pro", () => {
  const ids = sellableServers();
  assert.equal(
    SERVER_COUNT, ids.length,
    `SERVER_COUNT is ${SERVER_COUNT} but ${ids.length} servers build a licence gate ` +
    `(${ids.join(", ")}). Update SERVER_COUNT in packages/mcp-license/src/index.ts and ` +
    `remote/src/shims/license.ts together, or every cap message names a stale count.`,
  );
});

test("bundleLink tags the bundle checkout with <product>.<tool>.bundle", () => {
  const u = new URL(bundleLink("pdf.pdf_merge"));
  assert.equal(u.pathname, "/buy/bundle");
  assert.equal(u.searchParams.get("src"), "pdf.pdf_merge.bundle");
  assert.equal(u.searchParams.get("tenant"), null);
});

test("bundleLink carries a tenant when one is given, so the hosted binding survives", () => {
  const tenant = "anon_" + "a".repeat(32);
  const u = new URL(bundleLink("docx.business_set", tenant));
  assert.equal(u.searchParams.get("tenant"), tenant);
  assert.equal(u.searchParams.get("src"), "docx.business_set.bundle");
});

test("bundleSentence names the count and the price", () => {
  const s = bundleSentence("pdf.pdf_merge");
  assert.match(s, new RegExp(`Or all ${SERVER_COUNT} servers for \\$${PRICE_BUNDLE_USD}: `));
});

test("stdio upgradeText ends with the bundle sentence and both links are tagged", () => {
  const gate = createLicenseGate({ product: "pdf" });
  const text = gate.upgradeText("custom stamp text", "pdf_stamp");
  assert.ok(text.includes("https://mcp.zovo.one/buy/pdf?src=pdf.pdf_stamp"),
    `single-server link missing: ${text}`);
  assert.ok(text.endsWith(`Or all ${SERVER_COUNT} servers for $${PRICE_BUNDLE_USD}: ` +
    "https://mcp.zovo.one/buy/bundle?src=pdf.pdf_stamp.bundle"),
    `the message must end with the bundle sentence: ${text}`);
});

test("hostedUpgradeText ends with the bundle sentence, and both links carry the tenant", () => {
  const tenant = "anon_" + "b".repeat(32);
  const text = hostedUpgradeText("custom letterhead colours", "docx", tenant, "business_set");
  assert.ok(text.includes(`https://mcp.zovo.one/buy/docx?tenant=${tenant}&src=docx.business_set`),
    `single-server link missing: ${text}`);
  assert.ok(text.endsWith(`Or all ${SERVER_COUNT} servers for $${PRICE_BUNDLE_USD}: ` +
    `https://mcp.zovo.one/buy/bundle?tenant=${tenant}&src=docx.business_set.bundle`),
    `the message must end with the tenant-carrying bundle sentence: ${text}`);
});

test("the two links on one message never share a src tag", () => {
  const gate = createLicenseGate({ product: "zip" });
  const text = gate.upgradeText("unlimited archives", "zip_create");
  const tags = [...text.matchAll(/[?&]src=([^\s&]+)/g)].map((m) => decodeURIComponent(m[1]));
  assert.deepEqual(tags, ["zip.zip_create", "zip.zip_create.bundle"]);
});
