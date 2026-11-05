import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker, { PRODUCTS, SERVICES, SERVER_COUNT, isService, catalogEntry, fulfillmentAllowed,
  serviceCheckoutParams, serviceCustomText, serviceOwnerAlert, serviceBuyerEmail, crosssellHtml,
  servicePaidPage, SERVICE_REDIRECTS } from "../src/index.js";
import { paidSessionEntitlementIssue, entitlementRecordKey } from "../src/scheduled-monitor.js";

const ctx = { waitUntil() {} };
const browser = { accept: "text/html,application/xhtml+xml", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130 Safari/537.36" };

const EXPECTED = { "svc-audit": 490, "svc-launch": 4900, "svc-launch-one": 1900, "svc-launch-deposit": 1500,
  "svc-custom-simple": 2900, "svc-custom-deposit": 1500, "svc-care-quarter": 1470 };
// Paid upfront in full: everything except the legacy launch deposit (kept for old links) and the custom spec fee.
const UPFRONT = ["svc-audit", "svc-launch", "svc-launch-one", "svc-custom-simple", "svc-care-quarter"];

function kv() {
  const store = new Map();
  return { store, get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); },
    list: async () => ({ keys: [] }) };
}

function paidSession(product, extra = {}) {
  const cents = SERVICES[product].usd * 100;
  return {
    id: `cs_live_svc_${product.replace(/-/g, "")}`, created: 1788352878, mode: "payment", status: "complete",
    payment_status: "paid", currency: "usd", amount_total: cents, livemode: true,
    payment_intent: "pi_123", customer_details: { email: "buyer@example.com", name: "Buyer" },
    custom_fields: [{ key: "mcpserver", type: "text", text: { value: "https://example.com/mcp" } }],
    metadata: { product, site: "mcp.zovo.one", source: "test" },
    line_items: { data: [{ quantity: 1, currency: "usd", price: { id: "price_inline", type: "one_time", unit_amount: cents } }] },
    ...extra,
  };
}

test("the seven services exist at their prices and stay out of the license catalogue", () => {
  for (const [id, usd] of Object.entries(EXPECTED)) {
    assert.equal(SERVICES[id].usd, usd);
    assert.ok(isService(id));
    assert.equal(catalogEntry(id), SERVICES[id]);
    assert.ok(!Object.hasOwn(PRODUCTS, id), `${id} must not be a PRODUCTS row`);
    assert.equal(SERVICES[id].price, undefined, "services are priced inline");
  }
  assert.ok(!isService("bundle"));
  assert.ok(!SERVER_COUNT.toString().includes("."));
});

test("service checkout params collect the server field and never carry license wording", () => {
  for (const id of Object.keys(SERVICES)) {
    const p = serviceCheckoutParams(id);
    assert.equal(p["custom_fields[0][key]"], "mcpserver");
    assert.match(p["custom_fields[0][key]"], /^[a-z0-9]+$/i);
    assert.equal(p["custom_fields[0][type]"], "text");
    assert.equal(p["custom_fields[0][optional]"], "true");
    assert.equal(p["custom_fields[0][label][custom]"], "MCP server URL or repo (optional)");
    assert.ok(p["custom_fields[0][label][custom]"].length <= 50);
    const ct = serviceCustomText(id);
    assert.doesNotMatch(ct.submit + ct.after_submit, /licen[cs]e|key/i);
  }
});

test("GET /buy/svc-* serves a service intent page and never calls Stripe", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("GET must not call any API"); };
  try {
    for (const [id, usd] of Object.entries(EXPECTED)) {
      if (Object.hasOwn(SERVICE_REDIRECTS, id)) continue;
      const r = await worker.fetch(new Request(`https://mcp.zovo.one/buy/${id}?src=test`, { headers: browser }), {}, ctx);
      const html = await r.text();
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("x-mcp-buy"), "checkout-intent-required");
      assert.match(html, /<form\b[^>]*method="post"/);
      assert.match(html, /name="intent" value="checkout"/);
      assert.match(html, new RegExp(`\\$${usd.toLocaleString("en-US")}`));
      assert.match(html, /notified as soon as you pay/);
      assert.match(html, /Work starts the next business day\. I email you from support@zovo\.one/);
      assert.match(html, /Everything happens by email, no calls/);
      const body = html.slice(html.indexOf("<h1>"), html.indexOf("</form>"));
      assert.doesNotMatch(body, /&mdash;|\u2014/, "service copy has no em dash");
      assert.match(body, new RegExp(`Continue to Stripe, pay \\$${usd.toLocaleString("en-US")}`));
      assert.doesNotMatch(html, /lifetime licen[cs]e|Pro key|license_activate/i);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("POST /buy/svc-audit sends custom field, service metadata and no tenant to Stripe", async () => {
  const originalFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /checkout\/sessions$/);
    sent = new URLSearchParams(init.body);
    return Response.json({ id: "cs_live_x", url: "https://checkout.stripe.com/c/pay/cs_live_x",
      line_items: { data: [{ description: "McpStamp Readiness Audit", amount_total: 49000, price: { unit_amount: 49000 } }] } });
  };
  try {
    const page = await worker.fetch(new Request("https://mcp.zovo.one/buy/svc-audit?src=test", { headers: browser }), {}, ctx);
    const token = (await page.text()).match(/name="order_token" value="([^"]+)"/)[1];
    const r = await worker.fetch(new Request(`https://mcp.zovo.one/buy/svc-audit?src=test&tenant=anon_${"a".repeat(32)}`, {
      method: "POST", body: `intent=checkout&order_token=${encodeURIComponent(token)}`,
      headers: { ...browser, origin: "https://mcp.zovo.one", "content-type": "application/x-www-form-urlencoded" },
    }), { REMOTE_DATA: kv(), LICENSES: kv() }, ctx);
    assert.equal(r.status, 303);
    assert.equal(sent.get("line_items[0][price_data][unit_amount]"), "49000");
    assert.equal(sent.get("line_items[0][price_data][product_data][name]"), "McpStamp Readiness Audit");
    assert.equal(sent.get("metadata[product]"), "svc-audit");
    assert.equal(sent.get("metadata[kind]"), "service");
    assert.equal(sent.get("metadata[site]"), "mcp.zovo.one");
    assert.equal(sent.get("custom_fields[0][key]"), "mcpserver");
    assert.match(sent.get("custom_text[after_submit][message]"), /start work the next business day\. Everything happens by email from support@zovo\.one/);
    assert.equal(sent.get("customer_creation"), "always");
    assert.equal(sent.get("metadata[tenant]"), null);
    assert.equal(sent.get("client_reference_id"), null);
    for (const [k, v] of sent) assert.notEqual(v, "undefined", k);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a paid service: webhook records the order, alerts the owner once, mints nothing", async () => {
  const session = paidSession("svc-launch-deposit");
  assert.deepEqual(fulfillmentAllowed(session, "svc-launch-deposit"), { ok: true, reason: "paid" });
  assert.equal(fulfillmentAllowed({ ...session, amount_total: 100 }, "svc-launch-deposit").ok, false);
  const LICENSES = kv();
  const mails = [];
  const env = { STRIPE_SECRET_KEY: "sk_test_stub", STRIPE_WEBHOOK_SECRET: "whsec_stub", RESEND_API_KEY: "re_stub", LICENSES,
    FULFILLMENT: { getByName: () => { throw new Error("services must not create a fulfillment job"); } } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("https://api.resend.com/")) { mails.push(JSON.parse(init.body)); return Response.json({ id: "m" }); }
    assert.match(String(url), /checkout\/sessions\/cs_live_svc_/);
    return Response.json(session);
  };
  try {
    const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: session.id } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", env.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
    const hook = () => worker.fetch(new Request("https://mcp.zovo.one/webhook", { method: "POST", body,
      headers: { "stripe-signature": `t=${t},v1=${sig}` } }), env, ctx);
    const w = await hook();
    assert.equal(w.status, 200);
    assert.deepEqual(await w.json(), { received: true, fulfilled: true, service: true });
    assert.equal(mails.length, 2);
    const owner = mails.find((m) => m.to[0] === "support@zovo.one");
    assert.match(owner.subject, /PAID \$1500: McpStamp Store Launch/);
    assert.match(owner.text, /buyer@example\.com/);
    assert.match(owner.text, /https:\/\/example\.com\/mcp/);
    assert.equal(owner.reply_to, "buyer@example.com");
    const buyer = mails.find((m) => m.to[0] === "buyer@example.com");
    assert.match(buyer.subject, /Payment received/);
    assert.doesNotMatch(buyer.text, /licen[cs]e key|MCPL1/);
    assert.ok(LICENSES.store.has(`service:${session.id}`));
    assert.ok(![...LICENSES.store.keys()].some((k) => k.startsWith("session:")), "no license key stored");

    await hook();
    assert.equal(mails.length, 2, "a redelivered webhook sends no second alert");

    const success = await worker.fetch(new Request(`https://mcp.zovo.one/success?session_id=${session.id}`), env, ctx);
    const html = await success.text();
    assert.equal(success.status, 200);
    assert.equal(success.headers.get("x-mcp-fulfillment"), "service");
    assert.match(html, /Payment received/);
    assert.match(html, /Payment received\. I've been notified\./);
    assert.match(html, /Work starts the next business day\. I email you from support@zovo\.one at buyer@example\.com/);
    assert.doesNotMatch(html, /<strong>|id="subform"|\/api\/subscribe|Popular guides|tg\.zovo\.one/);
    assert.match(html, /Everything happens by email, no calls/);
    assert.match(html, /https:\/\/example\.com\/mcp/);
    assert.doesNotMatch(html, /Your license key|license_activate|MCPL1/);
    assert.equal(mails.length, 2);

    const recover = await worker.fetch(new Request(`https://mcp.zovo.one/recover?session_id=${session.id}`), env, ctx);
    assert.deepEqual(await recover.json(), { ok: true, product: "svc-launch-deposit", service: true, key: null, support: "support@zovo.one" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("monitors accept a recorded service order and flag a missing one", async () => {
  const session = paidSession("svc-audit");
  assert.equal(entitlementRecordKey(session), `service:${session.id}`);
  assert.equal(entitlementRecordKey({ id: "cs_live_a", metadata: { product: "bundle" } }), "session:cs_live_a");
  assert.equal(await paidSessionEntitlementIssue(session, "{\"product\":\"svc-audit\"}", kv()), null);
  assert.equal(await paidSessionEntitlementIssue(session, null, kv()), "service_order");
});

test("owner alert and buyer email are plain and complete without a server field", () => {
  const s = paidSession("svc-custom-deposit", { custom_fields: [] });
  assert.match(serviceOwnerAlert("svc-custom-deposit", s).text, /MCP server URL or repo: \(not given\)/);
  assert.match(serviceBuyerEmail("svc-custom-deposit", s).text, /Reply to this email with your MCP server URL or repo/);
});

test("landing band and every page footer cross-sell McpStamp with UTM tags", async () => {
  const r = await worker.fetch(new Request("https://mcp.zovo.one/"), {}, ctx);
  const html = await r.text();
  assert.match(html, /<p class="feat" id="mcpstamp">New from us, <a href="https:\/\/www\.mcpstamp\.com\/check\/\?utm_source=mcp\.zovo\.one&amp;utm_medium=crosssell/);
  assert.ok(html.indexOf('id="mcpstamp"') < html.indexOf("<h2"), "band sits above the first section");
  assert.match(crosssellHtml("x"), /Hire the builder of these \d+ servers/);
  const guide = await (await worker.fetch(new Request("https://mcp.zovo.one/guides"), {}, ctx)).text();
  assert.match(guide, /<footer>[\s\S]*mcpstamp\.com\/services\/\?utm_source=mcp\.zovo\.one&amp;utm_medium=crosssell&amp;utm_content=footer/);
});

test("upfront services say paid upfront, never invoice a balance, and the new products charge their full price", () => {
  for (const id of UPFRONT) {
    const p = SERVICES[id];
    assert.match(p.priceLine, /paid upfront/, id);
    assert.doesNotMatch(`${p.desc} ${p.priceLine} ${p.includes.join(" ")} ${p.next}`, /invoiced|balance|deposit|30-minute call/i, id);
    assert.ok(!/\u2014|&mdash;/.test(p.name + p.desc), `${id} has no em dash`);
    const session = paidSession(id);
    assert.deepEqual(fulfillmentAllowed(session, id), { ok: true, reason: "paid" });
    assert.equal(fulfillmentAllowed({ ...session, amount_total: 49000 }, id).ok, id === "svc-audit");
  }
  assert.match(SERVICES["svc-audit"].includes.join(" "), /follow-up questions by email for 14 days/);
  assert.match(SERVICES["svc-care-quarter"].priceLine, /\$490 a month/);
  assert.match(SERVICES["svc-care-quarter"].includes.join(" "), /Nothing is charged automatically/);
  assert.match(SERVICES["svc-custom-deposit"].includes.join(" "), /refunded in full/);
  assert.match(SERVICES["svc-custom-deposit"].includes.join(" "), /paid upfront before the build starts/);
});

test("a paid 4-store launch alerts support@zovo.one with the process and confirms to the buyer", () => {
  const s = paidSession("svc-launch");
  const owner = serviceOwnerAlert("svc-launch", s);
  assert.deepEqual(owner.to, ["support@zovo.one"]);
  assert.match(owner.subject, /^PAID \$4900: McpStamp Store Launch, 4 stores - buyer@example\.com$/);
  assert.match(owner.text, /work starts the next business day/);
  const buyer = serviceBuyerEmail("svc-launch", s);
  assert.equal(buyer.reply_to, "support@zovo.one");
  assert.match(buyer.text, /notified of your payment[\s\S]*Work starts the next business day[\s\S]*no calls/);
});

test("every service email is sent from support@zovo.one, the address the pages promise", () => {
  for (const id of Object.keys(SERVICES)) {
    const s = paidSession(id);
    const buyer = serviceBuyerEmail(id, s);
    assert.equal(buyer.from, "Mike <support@zovo.one>", id);
    assert.equal(buyer.reply_to, "support@zovo.one", id);
    const owner = serviceOwnerAlert(id, s);
    assert.equal(owner.from, "Mike <support@zovo.one>", id);
    assert.equal(owner.reply_to, "buyer@example.com", "the owner replies straight to the buyer");
    const anon = serviceOwnerAlert(id, paidSession(id, { customer_details: {} }));
    assert.equal(anon.reply_to, "support@zovo.one", "no buyer email falls back to the support inbox");
    assert.doesNotMatch(JSON.stringify([buyer, owner]), /mike@zovo\.one/);
  }
});

test("the retired launch deposit 301s to the 4-store launch with its query string, GET and POST", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("a redirect must not call any API"); };
  try {
    const qs = "?src=old.link&utm_source=x&tenant=anon_" + "a".repeat(32);
    for (const init of [{ headers: browser }, { method: "POST", body: "intent=checkout",
      headers: { ...browser, origin: "https://mcp.zovo.one", "content-type": "application/x-www-form-urlencoded" } },
      { headers: { "user-agent": "curl/8" } }]) {
      const r = await worker.fetch(new Request(`https://mcp.zovo.one/buy/svc-launch-deposit${qs}`, init), {}, ctx);
      assert.equal(r.status, 301);
      assert.equal(r.headers.get("location"), `https://mcp.zovo.one/buy/svc-launch${qs}`);
    }
    const bare = await worker.fetch(new Request("https://mcp.zovo.one/buy/svc-launch-deposit", { headers: browser }), {}, ctx);
    assert.equal(bare.headers.get("location"), "https://mcp.zovo.one/buy/svc-launch");
    assert.ok(isService("svc-launch-deposit"), "old paid deposit sessions still fulfil");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("service intent and success pages are lean, with no newsletter form, guide list or free-server links", async () => {
  for (const id of Object.keys(SERVICES)) {
    if (Object.hasOwn(SERVICE_REDIRECTS, id)) continue;
    const r = await worker.fetch(new Request(`https://mcp.zovo.one/buy/${id}?src=test`, { headers: browser }), {}, ctx);
    const pages = [await r.text(), servicePaidPage(id, paidSession(id))];
    for (const html of pages) {
      assert.doesNotMatch(html, /id="subform"|\/api\/subscribe|Get setup tips/, `${id} has no signup form`);
      assert.doesNotMatch(html, /aria-label="Popular guides"|href="\/guides\//, `${id} has no guide list`);
      assert.doesNotMatch(html, /tg\.zovo\.one|Tiny Telegram Tools|class="xsell"|Hire the builder/, `${id} has no free-server clutter`);
      assert.match(html, /mcpstamp\.com\/terms\//);
      assert.match(html, /mcpstamp\.com\/privacy\//);
      assert.match(html, /support@zovo\.one/);
      const body = html.slice(html.indexOf("<body>"));
      assert.doesNotMatch(body, /<strong>|<b>|\u2014|&mdash;|--/, `${id} follows the humanize rules`);
      assert.doesNotMatch(body.match(/<h[12][^>]*>[^<]*<\/h[12]>/g).join(""), /:/, `${id} headings have no colon`);
    }
    assert.match(pages[0], /<form\b[^>]*method="post"/);
  }
  const home = await (await worker.fetch(new Request("https://mcp.zovo.one/"), {}, ctx)).text();
  assert.match(home, /id="subform"/, "free-server pages keep the signup form");
});

test("service copy fixes from QA3", () => {
  const audit = SERVICES["svc-audit"].includes.join(" ");
  assert.match(audit, /refunded to your card if you buy Store Launch or a custom server within 30 days/);
  assert.doesNotMatch(audit, /credited/);
  const one = SERVICES["svc-launch-one"];
  assert.match(one.desc, /Gemini only if your account has access, otherwise a full refund/);
  assert.match(one.includes.join(" "), /Gemini only if your account has access[\s\S]*full refund/);
});
