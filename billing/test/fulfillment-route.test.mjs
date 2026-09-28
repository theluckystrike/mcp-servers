import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import worker, { PRODUCTS } from "../src/index.js";
import { mintLicense } from "../src/license.js";

test("a hosted bind failure cannot yield a successful webhook or falsely activated page", async () => {
  const pem = readFileSync(new URL("../../keys/license-private.pem", import.meta.url), "utf8");
  const { key } = await mintLicense(pem, { product: "invoice", id: "testsession", iat: 1788352878 });
  const tenant = `anon_${"b".repeat(32)}`;
  const sid = "cs_live_fulfillmenttest";
  const session = {
    id: sid, created: 1788352878, mode: "payment", status: "complete",
    payment_status: "paid", currency: "usd", amount_total: 1900,
    metadata: { product: "invoice", tenant },
    line_items: { data: [{ quantity: 1, currency: "usd",
      price: { id: PRODUCTS.invoice.price, unit_amount: 1900 } }] },
  };
  let complete = false;
  const env = {
    STRIPE_SECRET_KEY: "sk_test_stub", STRIPE_WEBHOOK_SECRET: "whsec_stub",
    LICENSES: { get: async () => key },
    FULFILLMENT: { getByName: (id) => {
      assert.equal(id, sid);
      return { fetch: async () => Response.json({ complete, bound: complete, licenseSaved: true },
        { status: complete ? 200 : 503 }) };
    } },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /checkout\/sessions\/cs_live_fulfillmenttest/);
    return Response.json(session);
  };
  try {
    const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: sid } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", env.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
    const webhook = await worker.fetch(new Request("https://mcp.zovo.one/webhook", {
      method: "POST", body, headers: { "stripe-signature": `t=${t},v1=${sig}` },
    }), env, { waitUntil() {} });
    assert.equal(webhook.status, 503);
    assert.deepEqual(await webhook.json(), { received: true, fulfilled: false, retrying: true });

    const pending = await worker.fetch(new Request(`https://mcp.zovo.one/success?session_id=${sid}`), env,
      { waitUntil() {} });
    assert.equal(pending.status, 202);
    assert.equal(pending.headers.get("x-mcp-fulfillment"), "retrying");
    const pendingHtml = await pending.text();
    assert.match(pendingHtml, /not yet confirmed Pro/);
    assert.doesNotMatch(pendingHtml, /Pro activation was submitted/);

    complete = true;
    const ready = await worker.fetch(new Request(`https://mcp.zovo.one/success?session_id=${sid}`), env,
      { waitUntil() {} });
    assert.equal(ready.status, 200);
    assert.match(await ready.text(), /Pro activation was submitted/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("one paid Session keeps the same key when Stripe later supplies customer email", async () => {
  const pem = readFileSync(new URL("../../keys/license-private.pem", import.meta.url), "utf8");
  const sid = "cs_live_emailarriveslater";
  const session = {
    id: sid, created: 1788352878, mode: "payment", status: "complete",
    payment_status: "paid", currency: "usd", amount_total: 1900,
    metadata: { product: "invoice", source: "store.invoice" },
    line_items: { data: [{ quantity: 1, currency: "usd",
      price: { id: PRODUCTS.invoice.price, unit_amount: 1900 } }] },
  };
  const issued = [];
  const env = {
    STRIPE_SECRET_KEY: "sk_test_stub", LICENSE_PRIVATE_KEY_PEM: pem,
    LICENSES: { get: async () => null },
    FULFILLMENT: { getByName: () => ({ fetch: async (_url, init) => {
      issued.push(JSON.parse(init.body).key);
      return Response.json({ complete: true, bound: true, licenseSaved: true });
    } }) },
  };
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const logs = [];
  globalThis.fetch = async () => Response.json(session);
  console.log = (...args) => logs.push(args.join(" "));
  try {
    const request = () => worker.fetch(new Request(`https://mcp.zovo.one/recover?session_id=${sid}`), env, { waitUntil() {} });
    const first = await request();
    assert.equal(first.status, 200);
    session.customer_details = { email: "buyer@example.com" };
    const second = await request();
    assert.equal(second.status, 200);
    assert.equal(issued.length, 2);
    assert.equal(issued[0], issued[1]);
    const events = logs.map((line) => JSON.parse(line));
    const payments = events.filter((event) => event.event === "checkout_payment_verified");
    const fulfillments = events.filter((event) => event.event === "checkout_fulfillment");
    assert.equal(payments.length, 2);
    assert.equal(fulfillments.length, 2);
    assert.equal(new Set([...payments, ...fulfillments].map((event) => event.session_ref)).size, 1);
    assert.equal(payments[0].amount_total, 1900);
    assert.equal(payments[0].currency, "usd");
    assert.equal(payments[0].product, "invoice");
    assert.equal(payments[0].acquisition_source, "store.invoice");
    assert.equal(fulfillments[0].acquisition_source, "store.invoice");
    assert.ok(logs.every((line) => !line.includes(sid) && !line.includes("buyer@example.com")));
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});
