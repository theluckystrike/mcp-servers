import test from "node:test";
import assert from "node:assert/strict";
import { extractPrice, normalizeNumber, currencyFrom, visibleText } from "../dist/extract.js";

const page = (head, body) => `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;

test("1 json-ld Product with Offer", () => {
  const html = page(
    `<title>Acme Widget - Shop</title>
     <script type="application/ld+json">${JSON.stringify({
       "@context": "https://schema.org", "@type": "Product", name: "Acme Widget Pro",
       offers: { "@type": "Offer", price: "129.99", priceCurrency: "USD", availability: "InStock" },
     })}</script>`,
    `<h1>Acme Widget Pro</h1>`
  );
  const r = extractPrice(html, "https://shop.example.com/widget");
  assert.equal(r.price, "129.99");
  assert.equal(r.currency, "USD");
  assert.equal(r.title, "Acme Widget Pro");
  assert.equal(r.source, "json-ld");
});

test("2 open graph price meta tags", () => {
  const html = page(
    `<title>Blue Jacket</title>
     <meta property="og:title" content="Blue Jacket, medium">
     <meta property="og:price:amount" content="79.50">
     <meta property="og:price:currency" content="GBP">`,
    `<div>Buy now</div>`
  );
  const r = extractPrice(html, "https://uk.example.com/jacket");
  assert.equal(r.price, "79.50");
  assert.equal(r.currency, "GBP");
  assert.equal(r.title, "Blue Jacket, medium");
  assert.equal(r.source, "opengraph");
});

test("3 microdata itemprop with content attribute", () => {
  const html = page(
    `<title>Desk Lamp</title>`,
    `<div itemscope itemtype="https://schema.org/Product">
       <span itemprop="name">Desk Lamp</span>
       <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
         <meta itemprop="priceCurrency" content="EUR">
         <span itemprop="price" content="34.90">34,90 EUR</span>
       </div>
     </div>`
  );
  const r = extractPrice(html, "https://de.example.com/lamp");
  assert.equal(r.price, "34.90");
  assert.equal(r.currency, "EUR");
  assert.ok(r.source === "microdata" || r.source === "meta-itemprop");
});

test("4 european thousands and decimal formatting", () => {
  const html = page(
    `<title>Kaffeemaschine</title>`,
    `<div class="product-price">1.299,00 EUR</div>`
  );
  const r = extractPrice(html, "https://shop.example.de/kaffee");
  assert.equal(r.price, "1299.00");
  assert.equal(r.currency, "EUR");
});

test("5 no price on the page returns null", () => {
  const html = page(`<title>About us</title>`, `<p>We have been making things since 1998. Contact us any time.</p>`);
  assert.equal(extractPrice(html, "https://example.com/about"), null);
});

test("6 amazon-like a-price markup", () => {
  const html = page(
    `<title>Amazon.com: Thing</title>`,
    `<div id="corePrice_feature_div">
       <span class="a-price" data-a-size="xl"><span class="a-offscreen">$1,299.00</span>
       <span aria-hidden="true"><span class="a-price-symbol">$</span><span class="a-price-whole">1,299</span></span></span>
     </div>`
  );
  const r = extractPrice(html, "https://www.amazon.com/dp/B000");
  assert.equal(r.price, "1299.00");
  assert.equal(r.currency, "USD");
  assert.equal(r.source, "class:a-offscreen");
});

test("7 json-ld AggregateOffer lowPrice", () => {
  const html = page(
    `<title>Running Shoes</title>
     <script type="application/ld+json">${JSON.stringify({
       "@context": "https://schema.org", "@type": "Product", name: "Running Shoes",
       offers: { "@type": "AggregateOffer", lowPrice: "89.00", highPrice: "119.00", priceCurrency: "CAD", offerCount: 4 },
     })}</script>`,
    `<h1>Running Shoes</h1>`
  );
  const r = extractPrice(html, "https://shop.example.ca/shoes");
  assert.equal(r.price, "89.00");
  assert.equal(r.currency, "CAD");
  assert.equal(r.source, "json-ld");
});

test("8 script-injected price in a data-price attribute", () => {
  const html = page(
    `<title>Headphones</title>`,
    `<div id="app"></div>
     <div class="pdp" data-product-price="249.95" data-currency="AUD"></div>
     <script>window.__STATE__={price:249.95};</script>`
  );
  const r = extractPrice(html, "https://store.example.com.au/headphones");
  assert.equal(r.price, "249.95");
  assert.equal(r.currency, "AUD");
  assert.equal(r.source, "data-attr");
});

test("9 regex fallback picks the largest currency-adjacent number", () => {
  const html = page(
    `<title>Camera body</title>`,
    `<p>Free shipping over $50. Trade-in credit $120. This item: $2 499,00 today.</p>`
  );
  const r = extractPrice(html, "https://example.com/camera");
  assert.equal(r.source, "regex-fallback");
  assert.equal(r.price, "2499.00");
  assert.equal(r.currency, "USD");
});

test("10 malformed json-ld does not throw and falls through", () => {
  const html = page(
    `<title>Broken</title><script type="application/ld+json">{ not json ,,, }</script>`,
    `<span class="price">GBP 12.00</span>`
  );
  const r = extractPrice(html, "https://example.co.uk/x");
  assert.equal(r.price, "12.00");
  assert.equal(r.currency, "GBP");
});

test("11 normalizeNumber separator handling", () => {
  assert.equal(normalizeNumber("1.299,00"), "1299.00");
  assert.equal(normalizeNumber("1,299.00"), "1299.00");
  assert.equal(normalizeNumber("1 299,00"), "1299.00");
  assert.equal(normalizeNumber("1299"), "1299");
  assert.equal(normalizeNumber("12,99"), "12.99");
  assert.equal(normalizeNumber("12.99"), "12.99");
  assert.equal(normalizeNumber("1,299"), "1299");
  assert.equal(normalizeNumber("1.234.567,89"), "1234567.89");
  assert.equal(normalizeNumber("$ 49.00"), "49.00");
  assert.equal(normalizeNumber("free"), null);
  assert.equal(normalizeNumber("0.00"), null);
});

test("12 currency symbol mapping honours country tld for the dollar sign", () => {
  assert.equal(currencyFrom("$", "https://example.com/x"), "USD");
  assert.equal(currencyFrom("$", "https://example.ca/x"), "CAD");
  assert.equal(currencyFrom("eur"), "EUR");
  assert.equal(currencyFrom("€"), "EUR");
  assert.equal(currencyFrom("nonsense"), null);
});

test("13 visibleText strips scripts and styles", () => {
  const t = visibleText(`<style>.a{color:red}</style><p>Hello&nbsp;&amp; welcome</p><script>var p=99;</script>`);
  assert.equal(t, "Hello & welcome");
});
