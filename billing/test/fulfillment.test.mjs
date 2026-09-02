// Price binding (review #3, #8) and Stripe signature parsing (#9, #10).
// fulfillmentAllowed is pure, so the whole decision is testable without Stripe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { fulfillmentAllowed, verifySig, PRODUCTS } from "../src/index.js";

const PRICE = PRODUCTS["time-tracker"].price;

/** A Checkout Session as Stripe returns it with expand[]=line_items. */
function session(over = {}, itemOver = {}) {
  return {
    id: "cs_live_test",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    currency: "usd",
    amount_total: 1900,
    metadata: { product: "time-tracker" },
    total_details: { amount_discount: 0 },
    line_items: { data: [{ quantity: 1, currency: "usd", price: { id: PRICE, unit_amount: 1900 }, ...itemOver }] },
    ...over,
  };
}

test("#3 a correctly paid session for the right price is fulfilled", () => {
  const r = fulfillmentAllowed(session(), "time-tracker");
  assert.equal(r.ok, true, r.reason);
});

test("#3 the cheaper price of another product cannot mint a different entitlement", () => {
  // Session carries metadata.product=bundle but a $19 line item.
  const s = session({ metadata: { product: "bundle" }, amount_total: 1900 });
  const r = fulfillmentAllowed(s, "bundle");
  assert.equal(r.ok, false);
  assert.match(r.reason, /is not the price for bundle/);
});

test("#3 a foreign price id in this Stripe account is rejected", () => {
  const r = fulfillmentAllowed(session({}, { price: { id: "price_someOtherIntegration", unit_amount: 100 } }), "time-tracker");
  assert.equal(r.ok, false);
  assert.match(r.reason, /is not the price for time-tracker/);
});

test("#3 amount_total must equal the expected unit_amount", () => {
  assert.equal(fulfillmentAllowed(session({ amount_total: 100 }), "time-tracker").ok, false);
  assert.equal(fulfillmentAllowed(session({ amount_total: 1899 }), "time-tracker").ok, false);
});

test("#3 mode, status, currency, quantity and item count are all bound", () => {
  assert.match(fulfillmentAllowed(session({ mode: "subscription" }), "time-tracker").reason, /mode is subscription/);
  assert.match(fulfillmentAllowed(session({ status: "open" }), "time-tracker").reason, /status is open/);
  assert.match(fulfillmentAllowed(session({ currency: "eur" }), "time-tracker").reason, /currency/);
  assert.match(fulfillmentAllowed(session({}, { quantity: 2 }), "time-tracker").reason, /quantity is 2/);
  assert.match(fulfillmentAllowed(session({ line_items: { data: [] } }), "time-tracker").reason, /exactly one line item/);
  assert.match(fulfillmentAllowed(session({ line_items: undefined }), "time-tracker").reason, /exactly one line item/);
});

test("#3 metadata product must match the product being minted", () => {
  assert.match(fulfillmentAllowed(session({ metadata: { product: "invoice" } }), "time-tracker").reason, /metadata product mismatch/);
  assert.match(fulfillmentAllowed(session({ metadata: {} }), "time-tracker").reason, /metadata product mismatch/);
  assert.match(fulfillmentAllowed(session(), "nope").reason, /unknown product/);
});

test("#3 an unpaid or unhandled payment_status is not fulfilled", () => {
  assert.match(fulfillmentAllowed(session({ payment_status: "unpaid" }), "time-tracker").reason, /payment_status is unpaid/);
});

test("#8 a 100% promotion code is fulfilled only when the discount covers the full price", () => {
  const free = session({ payment_status: "no_payment_required", amount_total: 0, total_details: { amount_discount: 1900 } });
  assert.equal(fulfillmentAllowed(free, "time-tracker").ok, true);

  const partial = session({ payment_status: "no_payment_required", amount_total: 0, total_details: { amount_discount: 500 } });
  assert.equal(fulfillmentAllowed(partial, "time-tracker").ok, false);

  const noDiscount = session({ payment_status: "no_payment_required", amount_total: 0, total_details: {} });
  assert.equal(fulfillmentAllowed(noDiscount, "time-tracker").ok, false);

  const bogusTotal = session({ payment_status: "no_payment_required", amount_total: 1900, total_details: { amount_discount: 1900 } });
  assert.equal(fulfillmentAllowed(bogusTotal, "time-tracker").ok, false);
});

test("#8 the bundle price binds to 3900", () => {
  const s = session({ metadata: { product: "bundle" }, amount_total: 3900 },
    { price: { id: PRODUCTS.bundle.price, unit_amount: 3900 } });
  assert.equal(fulfillmentAllowed(s, "bundle").ok, true);
  assert.equal(fulfillmentAllowed({ ...s, amount_total: 1900 }, "bundle").ok, false);
});

// --- webhook signature ----------------------------------------------------
const SECRET = "whsec_testsecret";
const env = { STRIPE_WEBHOOK_SECRET: SECRET };
const mac = (t, body, secret = SECRET) => createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");

test("#9 every v1 value is kept and any match is accepted", async () => {
  const body = '{"id":"evt_1"}';
  const t = Math.floor(Date.now() / 1000);
  const good = mac(t, body);
  const old = mac(t, body, "whsec_rotatedaway");
  assert.equal(await verifySig(env, body, `t=${t},v1=${good}`), true);
  // Rotation order: the current secret's signature is second, and must still win.
  assert.equal(await verifySig(env, body, `t=${t},v1=${old},v1=${good}`), true);
  assert.equal(await verifySig(env, body, `t=${t},v1=${good},v1=${old}`), true);
  assert.equal(await verifySig(env, body, `t=${t},v1=${old}`), false);
  assert.equal(await verifySig(env, body, `t=${t}`), false);
  assert.equal(await verifySig(env, body, ""), false);
});

test("#10 a nonnumeric timestamp is rejected instead of passing the replay window", async () => {
  const body = '{"id":"evt_1"}';
  for (const t of ["abc", "", "NaN", "1e9", "12.5", "-1", "99999999999999999999"]) {
    assert.equal(await verifySig(env, body, `t=${t},v1=${mac(t, body)}`), false, `timestamp ${t} accepted`);
  }
});

test("#10 a stale timestamp is outside the 300 s window", async () => {
  const body = '{"id":"evt_1"}';
  const t = Math.floor(Date.now() / 1000) - 3600;
  assert.equal(await verifySig(env, body, `t=${t},v1=${mac(t, body)}`), false);
});
