import test from "node:test";
import assert from "node:assert/strict";
import { checkRedirect, pathSegments, productToken } from "../dist/redirect.js";

const PROD = "https://www.ikea.com/us/en/p/billy-bookcase-white-00522047/";

test("no redirect is always ok, whatever the title says", () => {
  assert.equal(checkRedirect(PROD, PROD, "Products").ok, true);
  assert.equal(checkRedirect(PROD, PROD + "", null).ok, true);
  // trailing slash and fragment differences are not redirects
  assert.equal(checkRedirect(PROD, PROD.slice(0, -1), "Anything").ok, true);
});

test("redirect to a category listing is refused with the final URL named", () => {
  const v = checkRedirect(PROD, "https://www.ikea.com/us/en/cat/products-products/", "Products");
  assert.equal(v.ok, false);
  assert.match(v.reason, /the shop redirected to https:\/\/www\.ikea\.com\/us\/en\/cat\/products-products\//);
  assert.match(v.reason, /which is not a product page/);
  assert.match(v.reason, /price_add_manual/);
});

test("redirect to the home page is refused", () => {
  const v = checkRedirect(PROD, "https://www.ikea.com/", "IKEA");
  assert.equal(v.ok, false);
  assert.match(v.reason, /home page/);
});

test("same depth but a category segment is refused", () => {
  const v = checkRedirect("https://shop.example.com/us/en/p/widget-123", "https://shop.example.com/us/en/category/widgets", "Widgets");
  assert.equal(v.ok, false);
  assert.match(v.reason, /"category" listing page/);
});

test("generic and not-found titles are refused at equal depth", () => {
  for (const title of ["Products", "Home", "Page not found", "404", "Search results"]) {
    const v = checkRedirect("https://shop.example.com/p/widget-123", "https://shop.example.com/p/widget-456", title);
    assert.equal(v.ok, false, `expected refusal for title ${title}`);
    assert.match(v.reason, /which is not a product page/);
  }
});

test("a title that is only the shop name is refused", () => {
  const v = checkRedirect("https://shop.example.com/p/widget-123", "https://shop.example.com/p/widget-456", "Example");
  assert.equal(v.ok, false);
  assert.match(v.reason, /only the shop name/);
});

test("a real redirect to another product page is allowed", () => {
  const v = checkRedirect("https://shop.example.com/p/widget-123", "https://shop.example.com/p/widget-123-v2", "Acme Widget Pro, oak");
  assert.equal(v.ok, true);
});

test("pathSegments ignores empty segments", () => {
  assert.deepEqual(pathSegments("https://a.example.com/us/en/p/x/"), ["us", "en", "p", "x"]);
  assert.deepEqual(pathSegments("https://a.example.com/"), []);
});

/* D-9: slug-canonicalisation redirects keep the product identity and must be accepted. */

test("D-9: newegg /p/<id> keeps its id when tracking params are appended", () => {
  const v = checkRedirect(
    "https://www.newegg.com/p/N82E16819113877",
    "https://www.newegg.com/p/N82E16819113877?Item=N82E16819113877&cm_sp=x",
    "AMD Ryzen 7 9800X3D - Newegg.com",
  );
  assert.equal(v.ok, true, v.reason);
});

test("D-9: newegg /p/<id> expanding to a slug URL is accepted", () => {
  const v = checkRedirect(
    "https://www.newegg.com/p/N82E16819113877",
    "https://www.newegg.com/amd-ryzen-7-9800x3d-processor/p/N82E16819113877",
    "AMD Ryzen 7 9800X3D - Newegg.com",
  );
  assert.equal(v.ok, true, v.reason);
});

test("D-9: amazon /dp/<asin> expanding to /Product-Name/dp/<asin> is accepted", () => {
  const v = checkRedirect(
    "https://www.amazon.com/dp/B0XXXX1234",
    "https://www.amazon.com/Acme-Widget-Pro-Oak/dp/B0XXXX1234/ref=sr_1_1",
    "Amazon.com: Acme Widget Pro, oak",
  );
  assert.equal(v.ok, true, v.reason);
});

test("D-9: an ikea product page redirected to a category listing is still refused", () => {
  const v = checkRedirect(
    "https://www.ikea.com/us/en/p/billy-bookcase-white-00522047/",
    "https://www.ikea.com/us/en/cat/billy-bookcases-58288/",
    "BILLY Bookcases - IKEA",
  );
  assert.equal(v.ok, false);
  assert.match(v.reason, /"cat" listing page/);
});

test("D-9: an item page redirected to the home page is still refused", () => {
  const v = checkRedirect("https://shop.example.com/item/123", "https://shop.example.com/", "Example Shop");
  assert.equal(v.ok, false);
  assert.match(v.reason, /home page/);
});

test("D-9: productToken picks the identifier, not the slug or a marker", () => {
  assert.equal(productToken("https://www.newegg.com/p/N82E16819113877"), "N82E16819113877");
  assert.equal(productToken("https://www.amazon.com/dp/B0XXXX1234"), "B0XXXX1234");
  assert.equal(productToken("https://www.ikea.com/us/en/p/billy-bookcase-white-00522047/"), null);
  assert.equal(productToken("https://shop.example.com/p/widget-123"), null);
});

/* Codex v3 item 35: a product route is not a listing when the identity survives. */

test("v3-35: /item/<sku> canonicalised to /products/<slug>?sku=<sku> is accepted", () => {
  const v = checkRedirect(
    "https://shop.example.com/item/12345",
    "https://shop.example.com/products/widget?sku=12345",
    "Acme Widget, oak",
  );
  assert.equal(v.ok, true, v.reason);
});

test("v3-35: the same redirect with a generic title is still refused", () => {
  const v = checkRedirect(
    "https://shop.example.com/item/12345",
    "https://shop.example.com/products/widget?sku=12345",
    "Products",
  );
  assert.equal(v.ok, false);
});

test("v3-35: a /products/ redirect that drops the identity is still a listing", () => {
  const v = checkRedirect(
    "https://shop.example.com/item/12345",
    "https://shop.example.com/products/widgets",
    "Widgets, all of them",
  );
  assert.equal(v.ok, false);
  assert.match(v.reason, /"products" listing page/);
});

test("v3-35: ikea /p/ to /cat/ stays refused", () => {
  const v = checkRedirect(
    "https://www.ikea.com/us/en/p/billy-bookcase-white-00522047/",
    "https://www.ikea.com/us/en/cat/billy-bookcases-58288/",
    "BILLY Bookcases - IKEA",
  );
  assert.equal(v.ok, false);
  assert.match(v.reason, /"cat" listing page/);
});
