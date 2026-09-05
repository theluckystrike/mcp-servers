// Customer-visible checkout copy (docs/CHECKOUT_AUDIT.md).
//
// The audit found that nothing a buyer reads on the Stripe hosted page mentioned the
// server count, the bundle saving, or how the key is delivered. Those three facts
// now come from checkoutDescription() and checkoutCustomText(), which are pure, so the
// exact strings a customer sees are testable without touching Stripe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCTS, SINGLE_PRODUCT_IDS, SERVER_COUNT, BUNDLE_SAVING_USD, countWord,
  checkoutDescription, checkoutCustomText,
} from "../src/index.js";

const INDEX = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "index.js"), "utf8");

test("the catalogue is the single servers plus the bundle, and the saving is their sum less $39", () => {
  // Pinned as literals until billing-docs made both wrong: nineteen and $322 were typed
  // here and in the copy, so the twentieth server failed the release check rather than the
  // test. Both sides now derive from PRODUCTS, and the arithmetic is asserted instead.
  assert.equal(SERVER_COUNT, SINGLE_PRODUCT_IDS.length);
  assert.ok(SERVER_COUNT >= 20, `expected at least twenty servers, got ${SERVER_COUNT}`);
  assert.ok(!SINGLE_PRODUCT_IDS.includes("bundle"));
  assert.equal(PRODUCTS.bundle.usd, 39);
  const single = SINGLE_PRODUCT_IDS.reduce((n, id) => n + PRODUCTS[id].usd, 0);
  assert.equal(BUNDLE_SAVING_USD, single - PRODUCTS.bundle.usd);
  assert.equal(BUNDLE_SAVING_USD, SERVER_COUNT * 19 - 39);
});

test("the bundle description names the count, the one key and the saving", () => {
  assert.equal(
    checkoutDescription("bundle"),
    `${countWord()} MCP servers for Claude, one lifetime key, saves $${BUNDLE_SAVING_USD} against buying singly`,
  );
  assert.match(checkoutDescription("bundle"), /^Twenty-five MCP servers/);
});

test("every single-server description names the product and prices the bundle", () => {
  for (const id of SINGLE_PRODUCT_IDS) {
    assert.equal(
      checkoutDescription(id),
      `Lifetime key for ${PRODUCTS[id].name}. The ${countWord().toLowerCase()}-server bundle is $${PRODUCTS.bundle.usd}`,
    );
  }
});

test("an unknown product cannot silently produce empty checkout copy", () => {
  assert.throws(() => checkoutDescription("nope"), /unknown product/);
  assert.throws(() => checkoutCustomText("nope"), /unknown product/);
});

test("custom_text.submit cross-sells the bundle on a single-server session, tagged", () => {
  const ct = checkoutCustomText("invoice");
  assert.match(ct.submit, new RegExp(`All ${SERVER_COUNT} servers are \\$39 together, a \\$${BUNDLE_SAVING_USD} saving`));
  assert.match(ct.submit, /https:\/\/mcp\.zovo\.one\/buy\/bundle\?src=checkout\.crosssell\.invoice/);
  // The bundle's own page must not sell the buyer what they are already buying.
  assert.doesNotMatch(checkoutCustomText("bundle").submit, /\/buy\/bundle/);
  assert.match(checkoutCustomText("bundle").submit, new RegExp(`one lifetime key for all ${SERVER_COUNT} servers`));
});

test("the cross-sell tags are shapes the /buy route's validSrc will accept", async () => {
  const { validSrc } = await import("../src/index.js");
  for (const id of SINGLE_PRODUCT_IDS) {
    const src = new URL(checkoutCustomText(id).submit.split(" ").pop()).searchParams.get("src");
    assert.equal(validSrc(src), true, `${src} must survive validSrc`);
  }
});

test("custom_text.after_submit says how the key arrives and that hosted tenants are bound", () => {
  for (const id of ["bundle", "invoice"]) {
    const t = checkoutCustomText(id).after_submit;
    assert.match(t, /confirmation page immediately after payment/);
    assert.match(t, /not emailed/);
    assert.match(t, /upgraded to Pro automatically/);
  }
});

test("Stripe caps a custom_text message at 1200 characters", () => {
  for (const id of Object.keys(PRODUCTS)) {
    const ct = checkoutCustomText(id);
    assert.ok(ct.submit.length <= 1200, `${id} submit is ${ct.submit.length}`);
    assert.ok(ct.after_submit.length <= 1200, `${id} after_submit is ${ct.after_submit.length}`);
  }
});

// --- the Session builder ---------------------------------------------------
// createCheckout is not exported (it needs an env with a live key), so these are static
// reads of the parameters it sends. They are the settings the audit changed; a silent
// revert to the pre-audit values fails here.
test("the session builder sends both custom_text messages", () => {
  assert.match(INDEX, /"custom_text\[submit\]\[message\]": ct\.submit/);
  assert.match(INDEX, /"custom_text\[after_submit\]\[message\]": ct\.after_submit/);
});

test("promotion codes are off and a Customer is always created for the email", () => {
  assert.match(INDEX, /allow_promotion_codes: "false"/);
  assert.doesNotMatch(INDEX, /allow_promotion_codes: "true"/);
  assert.match(INDEX, /customer_creation: "always"/);
});

test("optional_items is never sent: an added item would break the one-line-item rule", () => {
  // fulfillmentAllowed rejects a two-item session, so a Stripe cross-sell the buyer
  // accepted would charge $58 and mint nothing. Proven, not assumed:
  const twoItems = {
    id: "cs_live_test", mode: "payment", status: "complete", payment_status: "paid",
    currency: "usd", amount_total: 5800, metadata: { product: "invoice" },
    total_details: { amount_discount: 0 },
    line_items: { data: [
      { quantity: 1, currency: "usd", price: { id: PRODUCTS.invoice.price, unit_amount: 1900 } },
      { quantity: 1, currency: "usd", price: { id: PRODUCTS.bundle.price, unit_amount: 3900 } },
    ] },
  };
  return import("../src/index.js").then(({ fulfillmentAllowed }) => {
    const r = fulfillmentAllowed(twoItems, "invoice");
    assert.equal(r.ok, false);
    assert.match(r.reason, /exactly one line item/);
    // Mentioned only in the comment that explains the choice, never as a parameter.
    assert.doesNotMatch(INDEX, /"optional_items\[/);
  });
});

test("the success and cancel URLs are unchanged and on our own host", () => {
  assert.match(INDEX, /success_url: `https:\/\/\$\{host\}\/success\?session_id=\{CHECKOUT_SESSION_ID\}`/);
  assert.match(INDEX, /cancel_url: `https:\/\/\$\{host\}\/`/);
});

test("metadata is unchanged: product, the probe tag and the hosted tenant", () => {
  assert.match(INDEX, /"metadata\[product\]": productId/);
  assert.match(INDEX, /"metadata\[probe\]": "1"/);
  assert.match(INDEX, /"metadata\[tenant\]": tenant/);
});
