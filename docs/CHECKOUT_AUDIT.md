# Checkout audit: what a customer actually reads before paying

Date: 2026-09-05. Live Stripe account `acct_1MmUPwJKCamubEm1`, live worker
`mcp-billing` on `mcp.zovo.one`.

Everything below was measured against the live endpoints, not read off the source. Four
real Checkout Sessions were created through `GET /buy/<product>` with a Chrome
`User-Agent`, so the `/buy` route treated them as human clicks rather than probes. They
are tagged `?src=audit` and therefore appear on `GET /stats/clicks` as
`audit -> {total: 4}`; two before the fix and two after. They are attributable and can be
subtracted from any funnel read of that window.

## 1. Before

### Sessions created (2026-09-05, pre-deploy)

| product | session id | amount |
| --- | --- | --- |
| bundle | `cs_live_b18m7aJdhEAvRv40XlyLLK69FOBeyrSuD7SkTG0I8lOpKklEkTrzW2188I` | $39.00 |
| invoice | `cs_live_b1pAflV24kqfuDd6F77S7qugZpzxthG4MchdTE8FMXuu6pdL7sZ20dymRH` | $19.00 |

### What the session objects held

Identical for both except product and amount:

- `mode: payment`, `status: open`, `currency: usd`, one line item, `quantity: 1`.
- `success_url: https://mcp.zovo.one/success?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url: https://mcp.zovo.one/` (the storefront index, not a "you did not buy"
  page - a cancelling buyer lands back on the price table, which is the right place)
- `allow_promotion_codes: true`
- `customer_creation: if_required`, `customer_email: null`, `customer_details: null`
- `automatic_tax: {enabled: false}`, `tax_id_collection: null`
- `custom_text: {after_submit: null, submit: null, shipping_address: null,
  terms_of_service_acceptance: null}` - **every customer-visible message slot empty**
- `consent_collection: null`, `submit_type: null`, `locale: null`
- `metadata: {product: "<id>"}`
- `payment_intent_data[statement_descriptor_suffix]: MCP PRO`

### What the line item and product said

| | line item `description` | Product `description` (the line Stripe renders under the name) |
| --- | --- | --- |
| bundle | `MCP Servers Bundle (all servers, lifetime)` | `Pro license for every MCP server by theluckystrike. One-time, lifetime.` |
| invoice | `MCP Invoice Pro` | `Pro license for the MCP Invoice server. One-time, lifetime.` |

Price `price_1UBDU9JKCamubEm1dWgRjtoW` = $39 USD (bundle, `prod_VBafU5C9o9d0f3`);
`price_1UBDU8JKCamubEm1Ybcp5IUs` = $19 USD (invoice, `prod_VBaftxRo2s4HVY`).

**The two findings that matter.**

1. **The bundle saving and the server count appear nowhere the customer sees.** Not in
   the product name, not in the description, not in `custom_text`. "$322" and "nineteen"
   existed only in `PRODUCTS.bundle.desc` in the worker source, which is rendered on the
   storefront and never reaches Stripe. A buyer who arrived on `/buy/invoice` from a cap
   message inside Claude - the majority path, per docs/CONVERSION_INSTRUMENT.md - saw a
   $19 page with no indication that a $39 option existed at all.
2. **How the key arrives was undiscoverable before paying.** No email is ever sent; the
   key is rendered once on `/success`. Nothing on the Stripe page said so, and nothing
   said that a hosted `mcp.zovo.one` tenant is bound to Pro automatically. Both facts
   were first shown on the page *after* the money moved.

### Tax

`automatic_tax.enabled: false` and `tax_id_collection: null`. **No tax is collected or
calculated.** The $19 and $39 are what is charged, everywhere, to everyone.

### The hosted checkout page's own metadata

Fetching the `checkout.stripe.com` URL with a browser `User-Agent` returns a JS shell.
Its entire head is:

```
<title>Stripe Checkout</title>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="google" content="notranslate">
```

There is **no `og:title` and no `og:description`**, and the title is the generic
"Stripe Checkout" for every product. Stripe controls this shell; it is not settable per
session. A pasted checkout link therefore unfurls with no product name anywhere.

### The success page, with a fake session id

`GET /success?session_id=cs_live_FAKE123` -> **HTTP 404**, `cache-control: no-store`,
title "Session not found":

> **We could not load that checkout session**
> The link may be mistyped or expired. If you have paid, email support@zovo.one with your
> Stripe receipt and your key will be sent back.
> Back to products

Correct behaviour: it fails closed, names the recovery path, and does not leak whether
the id ever existed. Left unchanged.

## 2. After

### Changed in `billing/src/index.js`

Three new pure exports, all covered by `billing/test/checkout.test.mjs`:

- `SERVER_COUNT` and `BUNDLE_SAVING_USD` are **computed** from `PRODUCTS`
  (19 servers; 19 x $19 - $39 = $322), so a twentieth server cannot leave the prose
  stale while the number stays $322.
- `checkoutDescription(productId)` - the customer-visible product line.
- `checkoutCustomText(productId)` - `{submit, after_submit}`.

Session builder (`createCheckout`) now sends `custom_text[submit][message]`,
`custom_text[after_submit][message]`, `allow_promotion_codes: "false"` and
`customer_creation: "always"`. `metadata` is byte-for-byte unchanged (`product`, plus
`probe` and `tenant` where they already applied), so `fulfillmentAllowed` and the
`bind:` path are untouched. Success and cancel URLs unchanged.

**Promotion codes off.** A discount field on a $19 one-time page invites the buyer to
leave and hunt for a code that does not exist. `fulfillmentAllowed` keeps its
100%-discount branch, so any code issued from the Dashboard against an older session
still fulfils.

**Email collection on.** Stripe's hosted page always shows the email field in `payment`
mode; the settable knob is `customer_creation`, now `always`. The address is persisted
on a Customer object rather than living only inside the Session, so a support lookup
after a lost key has something to search.

### Cross-sell: what the API actually supports

- `cross_sells` on a Product: **not a Stripe parameter.** Probed live:
  `{"code":"parameter_unknown","message":"Received unknown parameter: cross_sells"}`.
- `optional_items` on a Session: **accepted** (probe session
  `cs_live_a1olZ8096kRBSXsr6DzNEp3CppWCTNFrrxOg0NrJTtL4On7v7QIR5CtPT9`, created and
  immediately expired so it never entered the funnel). **Deliberately not used.** An
  accepted optional item makes the Session carry two line items, and
  `fulfillmentAllowed` rejects any session that is not exactly one - the buyer would be
  charged $58 and minted nothing. That failure is asserted as a test, not assumed.

So the cross-sell is `custom_text.submit`, as the fallback allowed for. It carries its
own `src=checkout.crosssell.<product>` tag, so clicks from inside Stripe land in the
existing `/stats/clicks` instrument as a distinct row.

### Stripe Product descriptions rewritten via the API

All 20 Products updated with `POST /v1/products/<id>` (`description`). Verified by
re-reading each. The bundle:

- before: `Pro license for every MCP server by theluckystrike. One-time, lifetime.`
- after: `Nineteen MCP servers for Claude, one lifetime key, saves $322 against buying singly`

Every single server, e.g. invoice (`prod_VBaftxRo2s4HVY`):

- before: `Pro license for the MCP Invoice server. One-time, lifetime.`
- after: `Lifetime key for MCP Invoice Pro. The nineteen-server bundle is $39`

Nine of the nineteen had drifted into a different pre-existing style ("Pro license for
the currency converter MCP server: full ECB history back to 1999, ..."); all now match
one rule.

Product ids touched: `prod_VBaes22x8ep6dy` `prod_VBaf0G0s9cXwUA` `prod_VBafhH6MyyTg6X`
`prod_VBaftxRo2s4HVY` `prod_VBc2BK0DpkMjY1` `prod_VBnXWCZw5JkXo3` `prod_VBnXUOfncmuGRj`
`prod_VBnY3j4hjqbaAw` `prod_VBqFiD4h8BQQId` `prod_VBqQaTPyG0MWjP` `prod_VBqQnbiMOGUcFJ`
`prod_VC1Tw0VGBIZZwa` `prod_VC1TQ28Nov4BDs` `prod_VC9jq3PiYVOeVh` `prod_VC9jfclRZ7sNFK`
`prod_VC9lLKtbyJ68tW` `prod_VCBGVUGLGdAb4R` `prod_VCCmWpuLVxSHLJ` `prod_VCEkLRBS9T98pQ`
`prod_VBafU5C9o9d0f3`.

### Verification: two fresh sessions after `wrangler deploy`

Worker version `1897b3cf-e300-427e-9c4b-9e31711c9a9b`. `npm test` in `billing`: 45/45.

| product | session id |
| --- | --- |
| bundle | `cs_live_a1j2wFFrt9uGHXUjUAf0vGg7B9pD5KEYPEVTMqYIOB5QKpHfZt8LdG9Du9` |
| invoice | `cs_live_a19pMYqssvUuw1wT19Rqf6Qaqb6GhAAqiLUHPZHvGy4Y3GU0v9tiD1Guo8` |

Both: `allow_promotion_codes: false`, `customer_creation: "always"`,
`metadata: {product: "<id>"}`, `cancel_url: https://mcp.zovo.one/`,
`automatic_tax.enabled: false`.

**The customer-visible text on the bundle page**, quoted from the live session:

> **MCP Servers Bundle (all servers, lifetime)** - $39.00
> Nineteen MCP servers for Claude, one lifetime key, saves $322 against buying singly
>
> *(above the pay button)* One payment, one lifetime key for all 19 servers. Saves $322
> against buying them singly.
>
> *(after the pay button)* Your license key is shown on the confirmation page immediately
> after payment. It is not emailed, so copy it from that page; the same URL always shows
> the same key. If you started from a hosted mcp.zovo.one endpoint, that endpoint is
> upgraded to Pro automatically, with nothing to paste.

**The customer-visible text on the invoice page:**

> **MCP Invoice Pro** - $19.00
> Lifetime key for MCP Invoice Pro. The nineteen-server bundle is $39
>
> *(above the pay button)* Buying more than one? All 19 servers are $39 together, a $322
> saving: https://mcp.zovo.one/buy/bundle?src=checkout.crosssell.invoice
>
> *(after the pay button)* Your license key is shown on the confirmation page immediately
> after payment. It is not emailed, so copy it from that page; the same URL always shows
> the same key. If you started from a hosted mcp.zovo.one endpoint, that endpoint is
> upgraded to Pro automatically, with nothing to paste.

## 3. What cannot be changed from here without a human

- **Stripe branding.** The hosted page's logo, icon, brand and accent colours, button
  shape and font are Dashboard settings (Settings -> Branding). There is no API for
  them, and the account currently ships Stripe defaults: no logo, no icon, no brand
  colour. Every buyer sees a generic Stripe page with no mcp.zovo.one identity on it.
  This is the largest remaining trust gap on the page and it is a five-minute manual
  fix that only the account owner can make.
- **The `checkout.stripe.com` page title and unfurl.** Fixed at "Stripe Checkout" with
  no Open Graph tags at all. Not settable per session, not settable by branding. A
  checkout link shared in chat or a DM will never preview the product.
- **Tax.** `automatic_tax` cannot simply be switched on: Stripe Tax needs a registration
  per jurisdiction, entered by a human in the Dashboard, plus a decision on whether $19
  is tax-inclusive or tax-exclusive. The seller is in Poland, so EU digital-goods VAT
  (OSS) is the live question, not an optional refinement. Until a registration exists,
  turning `automatic_tax` on would either charge nothing extra or start collecting tax
  with nowhere to remit it. Left off, deliberately.
- **The statement descriptor** stays `MCP PRO` via
  `payment_intent_data[statement_descriptor_suffix]`; the prefix it is appended to is a
  Dashboard setting.
- **Promotion codes.** Now off at the session. Any existing coupon or promotion code in
  the Dashboard is unaffected and still redeemable on a Dashboard-created link.
