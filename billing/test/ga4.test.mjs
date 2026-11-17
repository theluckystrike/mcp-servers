import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { GA4_ID, ga4PageLocation, PRODUCTS, SERVICES } from "../src/index.js";

const ctx = { waitUntil() {} };
const browser = { accept: "text/html,application/xhtml+xml", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130 Safari/537.36" };
const get = (path) => worker.fetch(new Request(`https://mcp.zovo.one${path}`, { headers: browser }), {}, ctx);
const GTAG = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;

// Any CSP that is ever added must still let the tag load and report.
function cspAllowsGa4(res) {
  const csp = res.headers.get("content-security-policy");
  if (!csp) return true;
  const dir = (name) => (csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(name + " ")) || "");
  const script = dir("script-src") || dir("default-src");
  const connect = dir("connect-src") || dir("default-src");
  const img = dir("img-src") || dir("default-src");
  return script.includes("https://www.googletagmanager.com")
    && /https:\/\/\*\.google-analytics\.com/.test(connect) && /https:\/\/\*\.google-analytics\.com/.test(img);
}

test("GA4 id is the mcpstamp.com property", () => assert.equal(GA4_ID, "G-KDB103CDCZ"));

test("buy pages, /pricing and / carry the GA4 tag with the cross-domain linker, once", async () => {
  for (const path of ["/buy/svc-audit?src=site.services.audit", "/buy/bundle?src=store.pricing.bundle", "/pricing", "/"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.equal(html.split(GTAG).length - 1, 1, `${path}: one gtag loader`);
    assert.ok(html.indexOf(GTAG) < html.indexOf("</head>"), `${path}: tag in head`);
    assert.match(html, /"linker":\{"domains":\["www\.mcpstamp\.com","mcpstamp\.com","mcp\.zovo\.one"\]/, path);
    assert.ok(cspAllowsGa4(res), `${path}: CSP allows GA4`);
  }
});

test("a single-product buy page fires begin_checkout with product, price, USD and src", async () => {
  const id = Object.keys(PRODUCTS).find((k) => k !== "bundle");
  const html = await (await get(`/buy/${id}?src=owner.test`)).text();
  assert.match(html, /gtag\("event","begin_checkout"/);
  assert.match(html, /currency:"USD"/);
  assert.ok(html.includes(`"item_id":"${id}"`));
  assert.ok(html.includes(`"value":${PRODUCTS[id].usd}`));
  assert.ok(html.includes(`"src":"owner.test"`));
});

test("the audit page reports $490 and the checkout form is unchanged", async () => {
  const html = await (await get("/buy/svc-audit?src=site.services.audit")).text();
  assert.ok(html.includes(`"item_id":"svc-audit"`));
  assert.ok(html.includes(`"value":${SERVICES["svc-audit"].usd}`));
  assert.equal(SERVICES["svc-audit"].usd, 490);
  assert.match(html, /<form method="post" action="[^"]+"><input type="hidden" name="intent" value="checkout"><input type="hidden" name="order_token"/);
  assert.doesNotMatch(html, /preventDefault\(\);var c=/);
});

test("an invalid src is reported as none, never echoed", async () => {
  const html = await (await get("/buy/bundle?src=%3Cscript%3E")).text();
  assert.ok(html.includes(`"src":"none"`));
  assert.ok(!html.includes(`"src":"<script>"`));
});

test("page_location drops tenant, session_id, email and unknown params", () => {
  const loc = ga4PageLocation(`https://mcp.zovo.one/buy/bundle?src=a.b&tenant=anon_${"a".repeat(32)}&session_id=cs_live_x&email=a%40b.c&utm_source=x&_gl=1*abc`);
  assert.equal(loc, "https://mcp.zovo.one/buy/bundle?src=a.b&utm_source=x");
  const html = ga4PageLocation("https://mcp.zovo.one/pricing");
  assert.equal(html, "https://mcp.zovo.one/pricing");
});

test("pages that carry keys or session ids get no tag", async () => {
  const res = await get("/success");
  const html = res.status === 200 ? await res.text() : "";
  assert.ok(!html.includes(GTAG));
  const page = await (await get("/guides")).text();
  assert.ok(!page.includes(GTAG), "tag scope is the selling pages only");
});
