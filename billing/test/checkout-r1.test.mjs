// Loop 29, round 1: every product reaches a real Stripe checkout with no human step.
//
// Before this round three products (work-order, catalogue, change-order) carried the
// literal price id "PENDING_HUMAN" and served a 503 with `x-mcp-buy: price-pending-human`,
// because minting a Stripe Price needs `product_write` and the key that had it lost it.
// office-suite, the aggregator every directory submission in docs/HUMAN_GATED_PACK.md
// links to, was a bare 404.
//
// The fix is that a Checkout Session can carry its price INLINE (`price_data`), which needs
// only `checkout_session_write`. These tests hold the two properties that makes possible:
//   1. a product with no Price id still produces a complete, correctly-priced line item,
//      and a session created that way can still be fulfilled after payment;
//   2. a product added tomorrow, with no Stripe object of any kind, routes to checkout.
// (2) is asserted against the real request handler with Stripe stubbed, so it is the route
// that is proved and not a description of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker, {
  PRODUCTS, PRODUCT_ALIASES, SINGLE_PRODUCT_IDS, resolveProductId,
  checkoutLineItem, firstSentences, fulfillmentAllowed, checkoutCustomText, SITE_KEY_FILES, probeHeaders,
  VALIDATION, BILLING_TEST_COUNT, successPage, countWord,
} from "../src/index.js";

const INDEX = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "index.js"), "utf8");
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const STUB_URL = "https://checkout.stripe.com/c/pay/cs_test_stub";

/** A request that looks like a person clicking a Buy link in a browser. */
const buy = (path, headers = {}) =>
  new Request(`https://mcp.zovo.one${path}`, { headers: { "user-agent": BROWSER_UA, accept: "text/html,application/xhtml+xml", ...headers } });

/** env + ctx enough for the /buy route: KV that answers nothing, waitUntil that runs nothing. */
const emptyKv = () => ({ get: async () => null, put: async () => {}, list: async () => ({ keys: [] }) });
const testEnv = () => ({ STRIPE_SECRET_KEY: "sk_test_stub", REMOTE_DATA: emptyKv(), LICENSES: emptyKv() });
const ctx = { waitUntil: () => {} };

/** Run `fn` with global fetch replaced by a Stripe stub; returns the captured form bodies. */
async function withStripeStub(fn) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init) => {
    calls.push({ url: String(u), params: Object.fromEntries(new URLSearchParams(init?.body || "")) });
    return new Response(JSON.stringify({ id: "cs_test_stub", url: STUB_URL }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    return { result: await fn(), calls };
  } finally {
    globalThis.fetch = real;
  }
}

test("no product is waiting on a human, and the 503 that said so is gone", () => {
  for (const [id, p] of Object.entries(PRODUCTS)) {
    assert.notEqual(p.price, "PENDING_HUMAN", `${id} still carries the PENDING_HUMAN placeholder`);
    assert.ok(Number.isInteger(p.usd) && p.usd > 0, `${id} has no usable price in dollars`);
  }
  assert.ok(!INDEX.includes('"price-pending-human" } }'), "the price-pending-human 503 branch is still live");
  assert.ok(!INDEX.includes("status: 503"), "some /buy path still answers 503");
});

test("every product produces one complete, correctly-priced line item", () => {
  for (const [id, p] of Object.entries(PRODUCTS)) {
    const item = checkoutLineItem(p);
    assert.equal(item["line_items[0][quantity]"], "1", `${id} does not buy exactly one`);
    if (item["line_items[0][price]"]) {
      // Configured Price: keep using it, so past receipts keep pointing at a live object.
      assert.match(item["line_items[0][price]"], /^price_/, `${id} has a malformed price id`);
      assert.equal(Object.keys(item).length, 2, `${id} mixes a price id with inline price data`);
    } else {
      // Inline: Stripe creates the Product and the Price as the Session is created.
      assert.equal(item["line_items[0][price_data][currency]"], "usd");
      assert.equal(item["line_items[0][price_data][unit_amount]"], String(p.usd * 100), `${id} would charge an amount the storefront does not print`);
      assert.equal(item["line_items[0][price_data][product_data][name]"], p.name, `${id} would show a name that is not its own`);
      const desc = item["line_items[0][price_data][product_data][description]"];
      assert.ok(typeof desc === "string" && desc.length > 0 && desc.length <= 300, `${id} inline description is empty or over 300 chars`);
    }
  }
});

test("the three formerly human-gated products are now priced inline, at $19, under their own names", () => {
  for (const id of ["work-order", "catalogue", "change-order"]) {
    const item = checkoutLineItem(PRODUCTS[id]);
    assert.equal(item["line_items[0][price]"], undefined, `${id} unexpectedly has a Price id`);
    assert.equal(item["line_items[0][price_data][unit_amount]"], "1900");
    assert.equal(item["line_items[0][price_data][product_data][name]"], PRODUCTS[id].name);
  }
});

test("firstSentences never cuts a word and never returns more than asked", () => {
  assert.equal(firstSentences("short", 300), "short");
  // A sentence break is used only when it leaves a description worth reading (>60 chars).
  const two = "This first sentence is deliberately longer than sixty characters long. The second one overflows the budget by a distance.";
  assert.equal(firstSentences(two, 100), "This first sentence is deliberately longer than sixty characters long.");
  // No usable sentence break: fall back to a word boundary, ellipsis inside the budget.
  const oneLong = "This single sentence has no full stop in it anywhere at all and simply keeps going well past the budget it was given";
  const cut = firstSentences(oneLong, 60);
  assert.ok(cut.length <= 60, `got ${cut.length} chars for a 60-char budget: ${cut}`);
  assert.ok(cut.endsWith("..."));
  assert.ok(oneLong.startsWith(cut.slice(0, -3)), "the ellipsis branch cut mid-word");
  // Every real description must fit its budget.
  for (const p of Object.values(PRODUCTS)) {
    if (!p.desc) continue;
    assert.ok(firstSentences(p.desc, 300).length <= 300, `${p.name} description exceeds 300 chars`);
  }
});

test("a payment for an inline-priced product is fulfillable, and the amount is still checked", () => {
  const session = (over = {}) => ({
    mode: "payment", status: "complete", currency: "usd",
    metadata: { product: "work-order" }, payment_status: "paid", amount_total: 1900,
    line_items: { data: [{ quantity: 1, price: { id: "price_adhoc123", type: "one_time", unit_amount: 1900 } }] },
    ...over,
  });
  assert.deepEqual(fulfillmentAllowed(session(), "work-order"), { ok: true, reason: "paid" });

  // Before this round the same session was refused with "price undefined is not the price
  // for work-order": the money would have been taken and the key withheld.
  const wrongAmount = session();
  wrongAmount.line_items.data[0].price.unit_amount = 100;
  assert.equal(fulfillmentAllowed(wrongAmount, "work-order").ok, false);

  const subscription = session();
  subscription.line_items.data[0].price.type = "recurring";
  assert.equal(fulfillmentAllowed(subscription, "work-order").ok, false);

  const noPrice = session();
  noPrice.line_items.data[0].price = null;
  assert.equal(fulfillmentAllowed(noPrice, "work-order").ok, false);

  // A product that does have a configured Price id keeps the strict identity check.
  const bundle = session({ metadata: { product: "bundle" }, amount_total: 3900 });
  bundle.line_items.data[0].price = { id: "price_adhoc123", type: "one_time", unit_amount: 3900 };
  assert.equal(fulfillmentAllowed(bundle, "bundle").ok, false, "a bundle sale on an ad-hoc price must not fulfil");
  bundle.line_items.data[0].price.id = PRODUCTS.bundle.price;
  assert.equal(fulfillmentAllowed(bundle, "bundle").ok, true);
});

test("office-suite sells the bundle, because only the bundle key can activate it", () => {
  assert.equal(PRODUCT_ALIASES["office-suite"], "bundle");
  assert.equal(resolveProductId("office-suite"), "bundle");
  // An alias must never be counted as a server: SERVER_COUNT and BUNDLE_SAVING_USD, and
  // every sentence derived from them, read PRODUCTS.
  assert.ok(!SINGLE_PRODUCT_IDS.includes("office-suite"));
  assert.equal(PRODUCTS["office-suite"], undefined);
  // The buyer is told on the payment page why the name changed.
  const ct = checkoutCustomText("bundle", "office-suite");
  assert.match(ct.submit, /^You clicked office-suite\./);
  assert.ok(!checkoutCustomText("bundle").submit.startsWith("You clicked"));
});

test("/buy/office-suite reaches a Stripe checkout for the bundle, priced at $39", async () => {
  const { result: res, calls } = await withStripeStub(() =>
    worker.fetch(buy("/buy/office-suite?src=store.office-suite"), testEnv(), ctx));
  assert.equal(res.status, 303);
  assert.ok(res.headers.get("location").startsWith("https://checkout.stripe.com/"), res.headers.get("location"));
  assert.equal(res.headers.get("x-mcp-buy"), null, "an alias must not be tagged as an error");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params["metadata[product]"], "bundle");
  assert.equal(calls[0].params["metadata[asked]"], "office-suite");
  assert.equal(calls[0].params["line_items[0][price]"], PRODUCTS.bundle.price);
});

test("each formerly 503 product now reaches Stripe with its own inline price", async () => {
  for (const id of ["work-order", "catalogue", "change-order"]) {
    const { result: res, calls } = await withStripeStub(() =>
      worker.fetch(buy(`/buy/${id}?src=store.home.table.${id}`), testEnv(), ctx));
    assert.equal(res.status, 303, `${id} did not redirect`);
    assert.ok(res.headers.get("location").startsWith("https://checkout.stripe.com/"));
    assert.equal(calls[0].params["line_items[0][price_data][unit_amount]"], "1900");
    assert.equal(calls[0].params["line_items[0][price_data][product_data][name]"], PRODUCTS[id].name);
    assert.equal(calls[0].params["metadata[product]"], id);
  }
});

test("a server added tomorrow gets a checkout on deploy, with no Stripe dashboard step", async () => {
  // The whole point of inline pricing. `synthetic-server` exists nowhere in Stripe: no
  // Product, no Price, nothing anyone clicked in a dashboard to create.
  const id = "synthetic-server-r1";
  assert.equal(PRODUCTS[id], undefined, "the synthetic id must not be a real product");
  PRODUCTS[id] = {
    desc: "A server that was added to the catalogue one minute ago and has no Stripe objects at all.",
    free: "Free: something.", pro: "Pro: everything.",
    name: "MCP Synthetic Server Pro", usd: 19,
    pkg: "@theluckystrike/mcp-synthetic-server", bin: "mcp-synthetic-server", payload: id,
  };
  try {
    assert.equal(resolveProductId(id), id);
    const { result: res, calls } = await withStripeStub(() =>
      worker.fetch(buy(`/buy/${id}?src=store.home.table.synthetic`), testEnv(), ctx));
    assert.equal(res.status, 303, "a brand-new product did not reach checkout");
    assert.ok(res.headers.get("location").startsWith("https://checkout.stripe.com/"));
    assert.equal(calls[0].params["line_items[0][price_data][product_data][name]"], "MCP Synthetic Server Pro");
    assert.equal(calls[0].params["line_items[0][price_data][unit_amount]"], "1900");
    // and the sale it would make is fulfillable
    const session = {
      mode: "payment", status: "complete", currency: "usd", metadata: { product: id },
      payment_status: "paid", amount_total: 1900,
      line_items: { data: [{ quantity: 1, price: { id: "price_created_at_session", type: "one_time", unit_amount: 1900 } }] },
    };
    assert.equal(fulfillmentAllowed(session, id).ok, true);
  } finally {
    delete PRODUCTS[id];
  }
});

test("a browser that sends no User-Agent still reaches checkout", async () => {
  // A UA-stripping extension or proxy used to be classed as a script and bounced to the
  // product page, whose Buy link led straight back here: a loop no buyer could break.
  const req = new Request("https://mcp.zovo.one/buy/invoice?src=store.home.table.invoice", {
    headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "sec-fetch-mode": "navigate" },
  });
  const { result: res } = await withStripeStub(() => worker.fetch(req, testEnv(), ctx));
  assert.equal(res.status, 303);
  assert.ok(res.headers.get("location").startsWith("https://checkout.stripe.com/"));
});

test("a crawler with no User-Agent still creates no Stripe session", async () => {
  const req = new Request("https://mcp.zovo.one/buy/invoice", { headers: { accept: "*/*" } });
  const { result: res, calls } = await withStripeStub(() => worker.fetch(req, testEnv(), ctx));
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("x-mcp-buy"), "scripted-ua-no-session");
  assert.equal(res.headers.get("location"), "https://mcp.zovo.one/s/invoice");
  assert.equal(calls.length, 0, "a crawler created a Stripe object");
});

test("a crawler on an alias is sent to a page that exists", async () => {
  // Rewritten 2026-09-09. This asserted the literal /s/bundle, on the comment "/s/office-suite
  // is not in PAGES". It is in PAGES now, and the route already prefers the alias's own page
  // when one exists, so the assertion was failing on the better behaviour: a crawler that
  // followed a /buy/office-suite link (every directory submission in docs/HUMAN_GATED_PACK.md
  // ships that URL) now lands on the office-suite page rather than on the bundle page.
  // The title is the property, so the property is what is asserted: fetch wherever it was
  // sent and require a real page. A pinned path is exactly what went stale here.
  for (const alias of Object.keys(PRODUCT_ALIASES)) {
    const req = new Request(`https://mcp.zovo.one/buy/${alias}`, { headers: { "user-agent": "curl/8.4.0" } });
    const { result: res, calls } = await withStripeStub(() => worker.fetch(req, testEnv(), ctx));
    assert.equal(res.status, 303, `${alias}: not redirected`);
    assert.equal(calls.length, 0, `${alias}: a crawler created a Stripe object`);
    const location = res.headers.get("location");
    assert.match(location, /^https:\/\/mcp\.zovo\.one\/s\//, `${alias}: sent somewhere that is not a product page: ${location}`);
    const landed = await worker.fetch(new Request(location), testEnv(), ctx);
    assert.equal(landed.status, 200, `${alias}: sent to ${location}, which answers ${landed.status}`);
    const html = await landed.text();
    assert.ok(!html.includes("Unknown server"), `${alias}: sent to ${location}, which is the not-found page`);
  }
});

test("an unknown product is a dead end no longer: it names the bundle and charges nothing", async () => {
  const { result: res, calls } = await withStripeStub(() => worker.fetch(buy("/buy/not-a-real-server"), testEnv(), ctx));
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("x-mcp-buy"), "unknown-product");
  const html = await res.text();
  assert.match(html, /\/buy\/bundle\?src=store\.notfound/);
  assert.equal(calls.length, 0);
  // The id is echoed back into the page, so it must be escaped.
  const nasty = await worker.fetch(buy("/buy/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E"), testEnv(), ctx);
  const nastyHtml = await nasty.text();
  assert.equal(nasty.status, 404);
  assert.ok(!nastyHtml.includes("<img"), "the 404 page reflected raw HTML");
  assert.ok(nastyHtml.includes("&lt;img"), "the id was dropped rather than escaped");
});

test("a real click is recorded before the redirect, and a probe is not", async () => {
  const written = [];
  const env = testEnv();
  env.REMOTE_DATA = { get: async () => null, put: async (k, v) => { written.push(k); }, list: async () => ({ keys: [] }) };
  const run = [];
  const ctxCollect = { waitUntil: (p) => run.push(p) };
  await withStripeStub(() => worker.fetch(buy("/buy/work-order?src=store.home.table.work-order"), env, ctxCollect));
  await Promise.all(run);
  assert.ok(written.some((k) => k.startsWith("click:store.home.table.work-order:")), `no click recorded, wrote ${written}`);

  const written2 = [];
  const env2 = testEnv();
  env2.REMOTE_DATA = { get: async () => null, put: async (k) => { written2.push(k); }, list: async () => ({ keys: [] }) };
  const run2 = [];
  await withStripeStub(() => worker.fetch(buy("/buy/work-order?src=probe.loop29", { "x-mcp-probe": "1" }), env2, { waitUntil: (p) => run2.push(p) }));
  await Promise.all(run2);
  assert.ok(!written2.some((k) => k.startsWith("click:")), `a probe recorded a conversion click: ${written2}`);
});

test("the IndexNow key file serves its key and nothing else", async () => {
  // data/indexnow.json records the key; the file at /<key>.txt must be byte-identical to
  // it or Bing, Yandex, Seznam and Naver reject every URL submitted with it.
  const recorded = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "indexnow.json"), "utf8"));
  assert.ok(SITE_KEY_FILES.has(recorded.key), "the recorded IndexNow key is not served");
  assert.equal(recorded.key_location, `https://mcp.zovo.one/${recorded.key}.txt`);
  const res = await worker.fetch(new Request(recorded.key_location), testEnv(), ctx);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/plain/);
  assert.equal(await res.text(), recorded.key, "the key file body is not exactly the key");

  // A key nobody registered must not be served: otherwise the domain would verify for
  // anyone who guessed a 32-hex path.
  const bogus = await worker.fetch(new Request("https://mcp.zovo.one/0123456789abcdef0123456789abcdef.txt"), testEnv(), ctx);
  assert.notEqual(bogus.status, 200);
});

test("robots.txt keeps every crawler allowed", async () => {
  const res = await worker.fetch(new Request("https://mcp.zovo.one/robots.txt"), testEnv(), ctx);
  const txt = await res.text();
  assert.match(txt, /^User-agent: \*\nAllow: \//);
  // Only the private, per-buyer paths are closed, and none of them is content.
  const disallowed = [...txt.matchAll(/^Disallow: (.*)$/gm)].map((m) => m[1]);
  assert.deepEqual(disallowed, ["/buy/", "/success", "/recover", "/verify", "/bound"]);
  for (const bot of ["Googlebot", "ClaudeBot", "GPTBot", "bingbot"]) {
    assert.ok(!txt.includes(bot), `robots.txt names ${bot}: no crawler may be singled out`);
  }
  assert.match(txt, /Sitemap: https:\/\/mcp\.zovo\.one\/sitemap\.xml/);
});

test("llms.txt lists every product with a URL and a description", async () => {
  const res = await worker.fetch(new Request("https://mcp.zovo.one/llms.txt"), testEnv(), ctx);
  const txt = await res.text();
  for (const id of SINGLE_PRODUCT_IDS) {
    assert.ok(txt.includes(`(https://mcp.zovo.one/s/${id})`), `llms.txt does not link /s/${id}`);
  }
  assert.ok(txt.includes("(https://mcp.zovo.one/bundle)"), "llms.txt does not link the bundle");
  // Rewritten 2026-09-09. This required the string "servers/office-suite)", the tail of the
  // GitHub source URL the aggregator line used to carry. The line now points at
  // https://mcp.zovo.one/s/office-suite, a page that did not exist when the assertion was
  // written and does now, so the regex was failing on an improvement. What has to be true is
  // that the aggregator is listed, at a URL that resolves, and that it says the thing no
  // generated tagline says: there is no $19 office-suite key, its unlock is the bundle key.
  const officeLines = txt.split("\n").filter((l) => /^- \[[^\]]*\]\(https:\/\/mcp\.zovo\.one\/s\/office-suite\)/.test(l));
  assert.equal(officeLines.length, 1, `llms.txt lists the office-suite aggregator ${officeLines.length} times, not once`);
  assert.match(officeLines[0], new RegExp(`\\$${PRODUCTS.bundle.usd} bundle key`), "the office-suite line does not say its Pro unlock is the bundle key");
  assert.equal((await worker.fetch(new Request("https://mcp.zovo.one/s/office-suite"), testEnv(), ctx)).status, 200,
    "llms.txt links /s/office-suite but that page does not answer 200");
  // Every product line is "- [name](url): description", never a bare link. Index links
  // ("All guides", "All comparisons") are navigation, not products, and carry none.
  const productLines = txt.split("\n").filter((l) => /^- \[.*\]\(https:\/\/mcp\.zovo\.one\/(s\/|bundle)/.test(l));
  // A count was the old assertion and it could not say which way it was wrong. The
  // catalogue is exactly: every single product, every alias with a page of its own, and the
  // bundle; each listed once. That catches a product dropped, a stray added, and the
  // duplicate office-suite line this file carried until 2026-09-09, by name.
  const expected = [...SINGLE_PRODUCT_IDS.map((id) => `https://mcp.zovo.one/s/${id}`),
    ...Object.keys(PRODUCT_ALIASES).map((a) => `https://mcp.zovo.one/s/${a}`),
    "https://mcp.zovo.one/bundle"].sort();
  const listed = productLines.map((l) => l.match(/\((https:[^)]+)\)/)[1]).sort();
  assert.deepEqual(listed, expected, "llms.txt product lines do not match the catalogue");
  for (const line of productLines) {
    assert.match(line, /^- \[[^\]]+\]\([^)]+\): \S/, `llms.txt line has no description: ${line}`);
  }
});

test("a probe reads back what Stripe stored, and a buyer sees none of it", async () => {
  // The evidence table in docs/CHECKOUT_R1.md is only worth reading if the probe asserts
  // the item Stripe actually created. probeHeaders takes its values from the Session
  // reply, so a wrong name or a wrong amount shows up instead of being echoed back.
  const stripeSession = {
    id: "cs_live_x", url: STUB_URL, amount_total: 1900, currency: "usd", livemode: true,
    line_items: { data: [{ description: "MCP Work Order Pro", price: { id: "price_adhoc", unit_amount: 1900 } }] },
  };
  const h = probeHeaders(stripeSession);
  assert.equal(h["x-mcp-probe-amount"], "1900");
  assert.equal(h["x-mcp-probe-item"], "MCP Work Order Pro");
  assert.equal(h["x-mcp-probe-livemode"], "true");
  // A name can never inject a header.
  assert.equal(probeHeaders({ line_items: { data: [{ description: "a\r\nx-evil: 1" }] } })["x-mcp-probe-item"], "a  x-evil: 1");

  // A real buyer's redirect carries the location and nothing else.
  const { result: res } = await withStripeStub(() =>
    worker.fetch(buy("/buy/work-order?src=store.home.table.work-order"), testEnv(), ctx));
  for (const k of Object.keys(h)) assert.equal(res.headers.get(k), null, `${k} leaked to a buyer`);

  // A tagged probe carries them.
  const { result: probe } = await withStripeStub(() =>
    worker.fetch(buy("/buy/work-order?src=probe.loop29", { "x-mcp-probe": "1" }), testEnv(), ctx));
  assert.notEqual(probe.headers.get("x-mcp-probe-amount"), null);

  // The session is created with line_items expanded, or there is nothing to read back.
  const { calls } = await withStripeStub(() =>
    worker.fetch(buy("/buy/work-order?src=probe.loop29", { "x-mcp-probe": "1" }), testEnv(), ctx));
  assert.equal(calls[0].params["expand[]"], "line_items");
});

// ---------------------------------------------------------------------------
// Conversion defects (docs/CONVERSION_R1.md). Each of these was live copy that
// was either untrue or stale, on the pages where being wrong costs the most.
// ---------------------------------------------------------------------------

test("no page links a pinned release tag: v0.1.1 carried 4 bundles, the current release carries 31", () => {
  assert.ok(!INDEX.includes("releases/tag/"), "a pinned release tag is back; use /releases/latest");
  assert.ok(INDEX.includes("releases/latest"));
});

test("VALIDATION and BILLING_TEST_COUNT match the files they claim to report", () => {
  // The home page said "399 of 399 automated checks" and "25 unit tests". Both were stale
  // and both were visible. data/validation.json is 9.2 MB so it cannot be bundled into a
  // Worker; this test is what keeps the restated numbers honest instead.
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const runs = JSON.parse(readFileSync(join(root, "data", "validation.json"), "utf8")).runs;
  const last = runs[runs.length - 1];
  const pass = last.results.reduce((n, r) => n + r.pass, 0);
  const total = last.results.reduce((n, r) => n + r.total, 0);
  const ms = last.results.map((r) => r.ms).sort((a, b) => a - b);
  assert.equal(VALIDATION.at, last.at.slice(0, 10), "VALIDATION.at is not the last run in data/validation.json");
  assert.equal(VALIDATION.pass, pass);
  assert.equal(VALIDATION.total, total);
  assert.equal(VALIDATION.servers, last.results.length);
  assert.equal(VALIDATION.medianMs, ms[Math.floor(ms.length / 2)]);

  const dir = join(dirname(fileURLToPath(import.meta.url)));
  const files = readdirSync(dir).filter((f) => f.endsWith(".test.mjs"));
  const declared = files.reduce((n, f) => n + (readFileSync(join(dir, f), "utf8").match(/^test\(/gm) || []).length, 0);
  assert.equal(BILLING_TEST_COUNT, declared, `the page says ${BILLING_TEST_COUNT} unit tests, ${declared} are declared`);
});

test("the home page and /bundle no longer state the npx line without the disclosure", async () => {
  for (const path of ["/", "/bundle"]) {
    const res = await worker.fetch(new Request(`https://mcp.zovo.one${path}`), testEnv(), ctx);
    const html = await res.text();
    assert.ok(html.includes("npx -y"), `${path} lost its npx line entirely`);
    assert.ok(html.includes("npm publish of these packages is pending"), `${path} states npx with no disclosure`);
    assert.ok(!html.includes("releases/tag/"), `${path} links a pinned release tag`);
    // The numbers on the page are the derived ones, not the stale literals.
    assert.ok(!/Seventeen|seventeen/.test(html), `${path} still says seventeen servers`);
    assert.ok(!html.includes("399 of 399"), `${path} still claims 399 of 399 checks`);
  }
  const home = await (await worker.fetch(new Request("https://mcp.zovo.one/"), testEnv(), ctx)).text();
  assert.ok(home.includes(`${VALIDATION.pass} of ${VALIDATION.total} automated checks`), "the home page does not state the measured check count");
  assert.ok(home.includes(`${countWord()} local-first MCP servers`), "the home page H1 is not derived from the catalogue");
});

test("the success page leads with an install path that works, not with a command that 404s", () => {
  // The worst place in the funnel to print a broken command is the page a customer reads
  // seconds after paying.
  for (const id of ["work-order", "bundle"]) {
    const html = successPage("MCPL1.test.key", id, { id: "cs_x", customer_details: { email: "a@b.c" } });
    const install = html.slice(html.indexOf("<h2>Install</h2>"));
    const npxAt = install.indexOf("npx -y");
    const mcpbAt = install.indexOf(".mcpb");
    const connectAt = install.indexOf("/mcp/connect");
    assert.ok(mcpbAt >= 0 && mcpbAt < npxAt, `${id}: npx is offered before the .mcpb bundle`);
    assert.ok(connectAt >= 0 && connectAt < npxAt, `${id}: npx is offered before the hosted endpoint`);
    assert.ok(install.includes("npm publish of these packages is pending"), `${id}: npx with no disclosure after payment`);
  }
});

test("a click on a dead /buy/ link is counted, so the leak is measurable", async () => {
  const written = [];
  const env = testEnv();
  env.REMOTE_DATA = { get: async () => null, put: async (k) => { written.push(k); }, list: async () => ({ keys: [] }) };
  const run = [];
  const res = await worker.fetch(buy("/buy/gone-server?src=store.home.table.gone-server"), env, { waitUntil: (pr) => run.push(pr) });
  await Promise.all(run);
  assert.equal(res.status, 404);
  assert.ok(written.some((k) => k.startsWith("click:store.home.table.gone-server:")), `dead click not recorded: ${written}`);

  // A stranger's URL must never become a KV key: an unvalidated src falls back to a fixed tag.
  const w2 = [];
  const env2 = testEnv();
  env2.REMOTE_DATA = { get: async () => null, put: async (k) => { w2.push(k); }, list: async () => ({ keys: [] }) };
  const run2 = [];
  await worker.fetch(buy("/buy/gone?src=" + encodeURIComponent("../../etc/passwd")), env2, { waitUntil: (pr) => run2.push(pr) });
  await Promise.all(run2);
  assert.ok(w2.every((k) => k.startsWith("click:buy.unknown-product:")), `unvalidated src leaked into a key: ${w2}`);

  // A crawler on a dead route still counts for nothing.
  const w3 = [];
  const env3 = testEnv();
  env3.REMOTE_DATA = { get: async () => null, put: async (k) => { w3.push(k); }, list: async () => ({ keys: [] }) };
  const run3 = [];
  await worker.fetch(new Request("https://mcp.zovo.one/buy/gone?src=store.home.table.gone", { headers: { "user-agent": "curl/8.4.0" } }), env3, { waitUntil: (pr) => run3.push(pr) });
  await Promise.all(run3);
  assert.equal(w3.length, 0, `a crawler was counted as a lost buyer: ${w3}`);
});
