// GET /bundle (docs/CONTENT_R14_RESULT.md): the whole-estate $39 case on its own page,
// and the "or the N-server bundle" cross-sell every s-page CTA block carries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundlePage, PRODUCTS, SERVER_COUNT, BUNDLE_SAVING_USD, countWord } from "../src/index.js";
import { PAGES } from "../src/pages.js";

const INDEX = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "index.js"), "utf8");

test("/bundle is routed", () => {
  assert.match(INDEX, /path === "\/bundle" && method === "GET"/);
});

test("bundle page title, price math and one CTA", () => {
  const html = bundlePage();
  const singleTotal = SERVER_COUNT * 19;
  assert.equal(html.includes(`<title>${countWord()} MCP servers for Claude, one $39 key</title>`), true, "title does not name the count and the price");
  assert.ok(html.includes(`${SERVER_COUNT} &times; $19 = $${singleTotal}`), `page does not show ${SERVER_COUNT} &times; $19 = $${singleTotal}`);
  assert.match(html, /\$39/);
  assert.ok(html.includes(`saving of $${BUNDLE_SAVING_USD}`), `page does not name the saving $${BUNDLE_SAVING_USD}`);
  assert.equal(BUNDLE_SAVING_USD, singleTotal - PRODUCTS.bundle.usd);
  const ctas = [...html.matchAll(/href="\/buy\/bundle\?src=store\.bundle"/g)];
  assert.ok(ctas.length >= 1, "expected at least one /buy/bundle?src=store.bundle CTA");
});

test("bundle page lists every server, each linking to its /s/<id> page", () => {
  const html = bundlePage();
  const singleIds = Object.keys(PRODUCTS).filter((id) => id !== "bundle");
  assert.equal(singleIds.length, SERVER_COUNT);
  for (const id of singleIds) {
    assert.match(html, new RegExp(`href="/s/${id}"`), `missing /s/${id} row link`);
  }
});

test("bundle page meta description is under 160 chars", () => {
  const html = bundlePage();
  const m = html.match(/<meta name="description" content="([^"]*)">/);
  assert.ok(m, "expected a meta description");
  assert.ok(m[1].length < 160, `description is ${m[1].length} chars: ${m[1]}`);
});

test("bundle page carries a Product/Offer JSON-LD block", () => {
  const html = bundlePage();
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]));
  const product = blocks.find((b) => b["@type"] === "Product");
  assert.ok(product, "expected a Product JSON-LD block");
  assert.equal(product.offers["@type"], "Offer");
  assert.equal(product.offers.price, "39");
  assert.equal(product.offers.priceCurrency, "USD");
});

test("sitemap.xml and llms.txt derivation both cover /bundle", () => {
  assert.match(INDEX, /\["\/", "\/bundle", "\/changelog", "\/guides", "\/compare"/, "sitemap urls array must include /bundle");
  assert.match(INDEX, /https:\/\/mcp\.zovo\.one\/bundle/, "llms.txt line must link https://mcp.zovo.one/bundle");
});

test("every generated server page's CTA block cross-sells the bundle, tagged per server", () => {
  for (const id of Object.keys(PAGES)) {
    const href = `https://mcp.zovo.one/buy/bundle?src=store.s.${id}.bundle`;
    assert.ok(PAGES[id].html.includes(href), `${id} page missing bundle CTA: ${href}`);
  }
});

test("the home hero links to /bundle", () => {
  assert.match(INDEX, /<a href="\/bundle">\/bundle<\/a>/);
});
