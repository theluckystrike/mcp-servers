# PAYMENTS.md — options matrix for the MCP fleet

Scope: how money comes in for the fleet sold at mcp.zovo.one (one server $19, bundle $39,
lifetime licenses signed Ed25519 as `MCPL1.<payload>.<sig>` by `billing/src/license.js`
and `scripts/sign-license.mjs`). Current state of the estate measured 2026-09-17:

- Stripe Checkout is LIVE and wired end to end: `/buy/:product` -> Checkout Session ->
  `/success` mints the key -> KV `session:<id>` -> webhook `checkout.session.completed`
  pre-mints the same key. See `billing/RESULT.md` and `data/checkout_r1.json`.
- A grammY bot with XTR (Stars) invoicing already exists at `/Users/mike/mcp-servers/telegram/`
  (`src/bot.ts`, `src/pricing.ts`: single 1500 Stars, bundle 3000 Stars, `currency: "XTR"`,
  empty `provider_token`). It handles `pre_checkout_query` and `successful_payment` but
  does not yet mint a license on payment success.
- The hosted worker (mcp-remote, `remote/src/index.ts` on mcp.zovo.one/mcp*) verifies the
  same MCPL1 keys with WebCrypto and gates `tools/call`; it also accepts purchase bindings
  via KV `bind:<anonToken>` (`decideBinding`).

## The matrix

| Option | Status | Fees | Agent-wirable? | Settlement |
|---|---|---|---|---|
| Stripe Checkout | LIVE, end to end | 2.9% + $0.30 per card transaction (standard US/international cards, docs.stripe.com/pricing); no platform fee | YES - already wired | Bank payout, Stripe is the processor |
| Telegram Stars (XTR) | Bot exists, fulfillment not wired to licenses | No commission charged by Telegram on Stars a bot earns; effective buyer-side cost is ~$0.013/Star via in-app purchase (core.telegram.org/bots/payments-stars pricing table); withdrawal is via Fragment as TON, where Fragment's own conversion applies | YES - bot code exists; needs a live bot token (human-gated at @BotFather) | Stars balance, withdrawn via Fragment |
| License-key flow | LIVE (Stripe/Telegram feed into it; manual mint via scripts/sign-license.mjs) | None - it is the fulfillment layer, not a payment rail | YES for validation (see billing/src/license-auth.ts); minting already automated by the worker | n/a |
| GitHub Sponsors | Not set up | 0% platform fee on personal accounts; card processing via Stripe Connect applies per docs.github.com (about-github-sponsors); organization accounts are subject to processing fees | NO - requires a signed-in GitHub session to enable Sponsors | Bank payout via Stripe Connect |
| Lemon Squeezy (merchant of record) | Not set up | 5% + $0.50 per transaction (lemonsqueezy.com/pricing), plus taxes handled by LS | NO - store creation, KYC/payout onboarding and store approval require a signed-in human at app.lemonsqueezy.com | Payout from LS, which remits sales tax |

Rule applied (CONVENTIONS / CLAUDE.md): anything needing account creation, sign-in, KYC or
a BotFather token is human-gated, recorded with the exact URL, and stopped at.

## 1. Stripe Checkout (existing, LIVE)

Fees: 2.9% + $0.30 per successful card charge (standard US pricing, docs.stripe.com/pricing).
Agent-wirable: YES. Evidence of wirability measured this session: the worker holds
`STRIPE_SECRET_KEY` as a wrangler secret (billing/src/index.js line 628 uses it for the
REST bearer), `wrangler secret list` on the mcp-billing worker names it, the local keychain
entry `security find-generic-password -s StripeCLI -a default.live_mode_api_key -w` returns
a live restricted key (`rk_live_...`, expires 2026-11-04), and data/checkout_r1.json
proves pricing no longer needs dashboard access: a PRODUCTS row with no Price id gets
priced inline via `line_items[0][price_data]`, which needs only `checkout_session_write`.

Adding a product is therefore a code change, not a dashboard change:

1. Add the product to the PRODUCTS table in billing/src/index.js (id, usd amount, name, desc).
2. `node remote/build-vendor.mjs` still exits cleanly (no description patches touched).
3. `npx wrangler deploy` from billing/.
4. Probe: `curl -sI https://mcp.zovo.one/buy/<new-product>` must 303 to a `cs_live_` URL.
   Positive control first: `curl -s https://mcp.zovo.one/health` -> stripe_mode live.

No further integration steps exist; the rail is done. Remaining Stripe work is conversion,
not wiring.

## 2. Telegram Stars (XTR)

Reference: core.telegram.org/bots/payments-stars. Key facts encoded already in
telegram/src/pricing.ts: digital goods are invoiced with `currency: "XTR"` and an EMPTY
`provider_token`; amounts are integer Stars; Telegram charges the bot no commission on
Stars earned, but the buyer pays roughly $0.013 per Star bought in-app, and Stars are
withdrawn via Fragment (TON conversion at Fragment's rate). Estate pricing: 1500 Stars
single (>= $19 at that rate), 3000 Stars bundle.

Existing code: telegram/src/bot.ts already sends the invoice (`sendInvoice` /
`createInvoiceLink`), approves `pre_checkout_query`, and receives `successful_payment`
with `sp.total_amount` and `sp.invoice_payload` ("mcp-single-1500" / "mcp-bundle-3000").

Exact remaining integration steps (agent-wirable once a bot token exists):

1. HUMAN-GATED: create/claim the bot at https://t.me/BotFather (account creation and
   token issue cannot be automated). Record `TELEGRAM_BOT_TOKEN` as a secret; do not
   commit it.
2. In telegram/src/bot.ts, in the `successful_payment` handler (currently just echoes
   "Payment received"), call the fulfillment path: map `invoice_payload` to a product id
   ("mcp-single-1500" -> chosen product from the preceding callback context or a
   follow-up product picker; "mcp-bundle-3000" -> `p: "*"`), mint
   `MCPL1.<payload>.<sig>` (same shape as scripts/sign-license.mjs), store
   `license:<chat_id>` in KV, and reply with the key plus the activation sentence the
   storefront uses ("run license_activate with this key").
3. For the single-product case add an inline product picker on `buy:single` BEFORE the
   invoice so the payload carries the product: extend the payload to
   `mcp-single-1500:<product>` and parse it in both the picker callback and fulfillment.
4. Host the bot (a long-running process or a Cloudflare Worker with the grammY webhook
   adapter; the repo's workers run on the same account).
5. Test: without a token, `node dist/bot.js` must construct and offline tests must stay
   green (telegram/src/offline-test.ts pattern); with a token, send `/buy` in a private
   chat, pay 1500 Stars, and confirm the reply carries a key that verifies with
   `packages/mcp-license` `verifyLicense` for the chosen product.
6. Marketing-only, no code: Stars invoices cannot be paid by users who have no Stars;
   keep the Stripe route as the fallback link in the same message.

## 3. License-key flow (the fulfillment layer, LIVE)

This is what every rail above feeds into. Two halves, both proven:

Minting (server side, trusted): Ed25519 over `{v:1, p, id, iat, [exp], [h]}` base64url
body, `MCPL1.<body>.<sig>`. Done by the billing worker (WebCrypto, billing/src/license.js)
and by `node scripts/sign-license.mjs <product|*> [email] [expUnix]` (node:crypto,
keys/license-private.pem, mode 600). `/mcp/connect` on mcp.zovo.one mints anonymous
tenant tokens (10 per IP per hour; an exhausted limit returns an EMPTY token that reads
as a spurious 401 - CLAUDE.md trap 1).

Verification (client/worker side, untrusted): offline, public key only
(keys/license-public.raw.b64, `VZXpvTpJn2XzaEn9ijFXk1vjPjtZvzAHZazC0Z+0pHU=`). Three
verifiers already exist and agree: packages/mcp-license (node:crypto), the remote worker
(WebCrypto, remote/src/index.ts), and billing/test/mint.test.mjs cross-checks them. This
session adds a fourth, isolated and injectable: billing/src/license-auth.ts - a
`LicenseAuth.gate(request, url, product)` middleware that extracts the key from any of
the three accepted forms (Bearer header, `/t/<token>` path, `?token=`), verifies offline
(WebCrypto only, Workers-compatible), checks product match, expiry and payload shape
including the KV-tenant-id character restriction, and returns
`{allow, isPro, reason, licenseId}`. The worker's tools/call path should call `gate`
before dispatch and answer 401 with `unauthorizedBody(product)` when `allow` is false.

Exact steps to adopt it in remote/src/index.ts (mechanical, no behavior change):

1. Replace the inline `verifyLicense` + extraction code with
   `new LicenseAuth({ publicKeyB64: PUBLIC_KEY_B64 })` (one instance, module scope).
2. In the `tools/call` dispatch branch, `const d = await auth.gate(request, url, product);`
   `if (!d.allow) return json(unauthorizedBody(product), 401);` and use `d.isPro` for the
   rate-limit tier, `d.licenseId` for the tenant id.
3. Keep `decideBinding` for KV `bind:<anonToken>` purchases; `gate` and binding compose:
   binding passes `verified` to the same decision, no second verifier.
4. Tests: billing/test/license-auth.test.mjs (12 cases) and remote/test must both stay
   green; `npx wrangler deploy` from remote/.

Fees: none (it is code, not a rail). Agent-wirable: YES for validation; minting is
agent-wirable for test keys and human-owned for live keys because the private PEM lives
in keys/ and as a wrangler secret, both outside agent reach by design.

## 4. GitHub Sponsors

Fees: GitHub charges no platform fee for sponsorships of personal accounts; payments run
through Stripe Connect, so card processing fees per docs.github.com
(getting-started-with-github-sponsors/about-github-sponsors) still apply. Agent-wirable:
NO. Enabling Sponsors requires a signed-in GitHub session for @theluckystrike at
https://github.com/sponsors/accounts (eligibility check, Stripe Connect onboarding,
payout setup). Per the repo rules that is recorded here and stopped at.

If it is ever enabled, the wiring is minimal and agent-wirable afterwards:

1. Human: complete the Sponsors profile, add tiers ($19 "one server", $39 "the fleet").
2. Agent: add a "Sponsor" link on the storefront footer and READMEs; a Sponsors payment
   grants NO license automatically (there is no fulfillment webhook with license payload),
   so either treat it as a donation channel or pair it with a manual-key policy documented
   on the profile page. Recommendation: donation/awareness channel only, not the license
   rail - the license-key flow needs a payload that Sponsors does not carry.

## 5. Lemon Squeezy (merchant of record)

Fees: 5% + $0.50 per transaction (lemonsqueezy.com/pricing). Value proposition: LS is the
merchant of record - it handles global sales tax/VAT remittance, which Stripe Checkout
does not. At $19 that is $1.45 + card costs vs Stripe's $0.85; the delta buys tax
compliance. Note: Lemon Squeezy is being folded into Stripe Managed Payments (2026 update
on their own pricing page); evaluate Stripe Tax before committing to a new LS store.
Agent-wirable: NO for setup - store creation, KYC and payout onboarding are signed-in
human steps at https://app.lemonsqueezy.com/register. After setup the rest is API work:

1. Human: create the store, complete onboarding, add the 5 products (or import).
2. Agent: create checkout variants via the LS API, point storefront Buy buttons at
   `https://<store>.lemonsqueezy.com/buy/<variant>` (or embed the checkout overlay).
3. Agent: add a `order_created`/`order_refunded` webhook route in the billing worker; LS
   signs webhooks (X-Signature, HMAC-SHA256 of the raw body with the store's signing
   secret) - verify constant-time, same pattern as the existing Stripe webhook at
   billing/src/index.js line 1013.
4. Agent: on `order_created`, read the custom data (product id) and mint an MCPL1 key
   into KV exactly like the Stripe `/success` path, store
   `ls:<order_id>` -> key (read-before-write so reloads agree), and return the key on an
   LS post-checkout custom-content page.
5. Test: `node --test` the new handler with a synthetic signed payload (pattern:
   billing/test/checkout-r1.test.mjs drives a synthetic id through the real handler).

## Recommendation

Keep Stripe Checkout as the primary rail (live, wired, cheapest at these price points).
Wire Telegram Stars fulfillment (steps in section 2) - the bot is the one distribution
channel where Stars are the native currency and no card is needed. Defer Lemon Squeezy
until there is meaningful EU/UK volume or Stripe Tax is evaluated (its own 2026 notice
says it is converging into Stripe anyway). Use GitHub Sponsors, if at all, as a
donation surface, not a license rail. The license-key flow needs no new rail work; adopt
billing/src/license-auth.ts as the single verifier in the remote worker.
