// Conversion instrument (docs/CONVERSION_INSTRUMENT.md): every upgrade link a cap
// message produces must carry src=<product>.<tool-or-slugified-feature> so the billing
// worker's /buy route can attribute a checkout click back to the message that sent it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLicenseGate, hostedUpgradeText, slugifySrc } from "../dist/index.js";

test("slugifySrc lowercases, collapses non-alnum runs, trims edges", () => {
  assert.equal(slugifySrc("Custom Stamp Text!"), "custom_stamp_text");
  assert.equal(slugifySrc("  weird__ -- spacing  "), "weird_spacing");
  assert.equal(slugifySrc(""), "unknown");
});

test("stdio upgradeText tags the buy link with src=<product>.<slug of feature>", () => {
  const gate = createLicenseGate({ product: "pdf" });
  const text = gate.upgradeText("custom stamp text");
  const m = text.match(/https:\/\/mcp\.zovo\.one\/buy\/pdf\?src=([^\s,]+)/);
  assert.ok(m, `no tagged link in: ${text}`);
  assert.equal(decodeURIComponent(m[1]), "pdf.custom_stamp_text");
});

test("stdio upgradeText prefers an explicit tool name over the feature text", () => {
  const gate = createLicenseGate({ product: "pdf" });
  const text = gate.upgradeText("stamping your business name and VAT id in the footer", "pdf_watermark_business");
  assert.match(text, /src=pdf\.pdf_watermark_business/);
});

test("hostedUpgradeText tags the buy link and keeps the tenant param", () => {
  const text = hostedUpgradeText("custom letterhead colours", "docx", "anon_" + "a".repeat(32), "business_set");
  const url = text.match(/https:\/\/mcp\.zovo\.one\/buy\/docx\?[^\s,]+/)[0];
  assert.match(url, /tenant=anon_a+/);
  assert.match(url, /src=docx\.business_set/);
});
