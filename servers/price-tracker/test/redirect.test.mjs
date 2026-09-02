import test from "node:test";
import assert from "node:assert/strict";
import { checkRedirect, pathSegments } from "../dist/redirect.js";

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
