# Funnel R1 (loop 35): 65 checkout sessions, 0 paid — broken funnel or zero demand?

status: DONE

Forensic only. Nothing deployed, nothing purchased, no production KV write.
Machine-readable companion: `data/funnel_r1.json`. Prior round (loop 33, agent A3,
discovery-to-money walk) was overwritten per loop-35 ownership; its two load-bearing
facts are carried forward in section 6.

## Verdict

The purchase path is mechanically sound end to end (verified live, everything
short of entering a card). The "65 humans reached checkout" numerator is measurement
contamination, proven three independent ways below. Verified in-product human demand in
instrument v2 is **0 clicks**. Zero paid is exactly what a healthy funnel at zero verified
demand produces. What is broken is instrumentation (session-creation guard hole, KPI
sample pollution, KPI window truncation) plus a weak cancel landing. Not broken: checkout
creation, price parity, fulfillment, key verification, error paths, webhook registration.

## evidence

### 1. Billing test suite

```sh
cd /Users/mike/mcp-servers/billing && npm_config_cache=/Users/mike/.npm-cache-local npm test
# pass 134, fail 0 (node --test test/*.test.mjs; 16 files incl checkout-r1, funnel-r1,
# fulfillment, mint, clicks, store-src)
```

### 2. Live checkout creation (real session, probe-tagged)

```sh
curl -sS -i https://mcp.zovo.one/buy/time-tracker
# -> 303, x-mcp-buy: scripted-ua-no-session  (bare curl never reaches Stripe; guard works)

curl -sS -i 'https://mcp.zovo.one/buy/time-tracker?src=funnel.r1.probe' \
  -H 'user-agent: <Chrome 140 UA>' -H 'accept: text/html' \
  -H 'sec-fetch-mode: navigate' -H 'sec-fetch-dest: document' -H 'x-mcp-probe: 1'
# -> 303 location checkout.stripe.com/g/pay/cs_live_a1v8ClQOJjNoRNEEpfmzMu2r5RdPNtHPSkyAnclh6xLiKL29HIc0DE6hKl
#    headers read back from Stripe's own reply (not the request):
#    x-mcp-probe-amount: 1900 | x-mcp-probe-currency: usd
#    x-mcp-probe-item: MCP Time Tracker Pro | x-mcp-probe-livemode: true
#    x-mcp-probe-price: price_1UBDU5JKCamubEm1wPMZI8Zf  (matches PRODUCTS)

# bundle: same probe -> cs_live_a1xD2HRQ4TA1UN7mHzO9BoJca7bpY7BWnBWArHNsHw3zMHsq8oaLORK5BS,
# 3900 usd, "MCP Servers Bundle (all servers, lifetime)", livemode true, price_1UBDU9JKCamubEm1dWgRjtoW

curl -sS -L <session url> -H 'user-agent: <Chrome UA>'
# -> http 200, 43,620 bytes; JS app shell (data-checkout-variant="guacamole").
#    Payment-method blocks are JS-rendered and not enumerable by curl; the Stripe session
#    object (stripe CLI) lists payment_method_types ["card","link"] and the worker sends
#    no payment_method_types restriction, so Dashboard defaults render. Dashboard check is
#    human-gated (section 5).
```

### 3. Price parity (advertised vs charged)

```sh
curl -sS https://mcp.zovo.one/s/time-tracker | /usr/bin/grep -o '\$19\|Buy Pro[^<]*'
# "Buy Pro $19" (1x), JSON-LD offers: Free tier price "0", Pro lifetime price "19" USD.
# Stripe line item from probe: 1900 usd. No mismatch. Bundle page $39 == 3900 usd probe.
```

### 4. Error paths (bogus input)

```sh
curl -sS -i 'https://mcp.zovo.one/success?session_id=cs_live_bogus'   # -> 404, clean human HTML ("We could not load that checkout session", support@zovo.one); no stack trace
curl -sS -i 'https://mcp.zovo.one/recover?session_id=cs_live_bogus'   # -> 404, {"ok":false,"reason":"session not found"}
curl -sS -i -X POST https://mcp.zovo.one/webhook --data '{"type":"checkout.session.completed",...}'  # -> 400 "bad signature"
curl -sS https://mcp.zovo.one/health  # -> ok true, signer ok, stripe_mode live, 37 products
```

### 5. Fulfillment, walked offline (no real mint into production KV)

Path after a real payment: webhook `checkout.session.completed` /
`checkout.session.async_payment_succeeded` -> `retrieveSession` (line_items expanded) ->
`fulfillmentAllowed` (mode, status complete, metadata.product, exactly one line item,
configured price id or inline one_time, unit_amount, currency) -> `keyForSession`
(Ed25519 mint, **self-verified against the embedded public key before storing**,
KV `session:<sid>`, store-if-absent) -> optional `bind:<tenant>`. `/success` performs the
same mint synchronously, so buyer delivery does not depend on webhook timing; `/recover`
re-derives from the session id.

- Key consistency: `/usr/bin/grep -rn PUBLIC_KEY_B64` — identical
  `VZXpvTpJn2XzaEn9ijFXk1vjPjtZvzAHZazC0Z+0pHU=` at `billing/src/license.js:2`,
  `packages/mcp-license/src/index.ts:10`, `remote/src/index.ts:53`. A minted key verifies
  in the worker, in every local server, and on hosted endpoints. **No latent dispute bomb.**
- Webhook registration: `stripe webhook_endpoints list --live` shows
  `https://mcp.zovo.one/webhook` **enabled twice** (one with completed +
  async_payment_succeeded, one with completed only). Double delivery is idempotent
  (store-if-absent). Cleanup is human-gated (Dashboard).
- Local probe minter: `scripts/sign-license.mjs` reads `keys/license-private.pem` and
  prints MCPL1 keys offline (origin of the 269 probe lic: ids noted in kpi.json). Used
  read-only here.
- Latent risk (documented design, not a defect): nothing is emailed; a buyer who loses
  the /success URL must email support@zovo.one. `customer_creation: "always"` means
  support can find them by email in the Dashboard.

### 6. The "65 humans" numerator is contamination — three independent proofs

The KPI query (`scripts/kpi.mjs:64`): `stripe checkout sessions list --live --limit 100`,
counted when `metadata.probe !== "1"` and `created >= 2026-09-03T08:55Z`.

Same command re-run 2026-09-12T12:50Z, fields aggregated with
node (no PII printed): 100 sessions returned, `has_more: true`, and the window covers only
— "last 100" is a ~10-hour window. Of the 100:
89 untagged post-9/3, 11 probe-tagged, 0 pre-tagging. All 89 are `payment_status: unpaid`,
`status: open`, created **today** at a sustained 8–13 per hour around the clock
(per-hour histogram 02:10, 03:9, 04:8, 05:12, 06:13, 07:5, 08:11, 09:9, 10:8, 11:10,
12:2). CLAUDE.md measures the audience at ~10 humans per fortnight and Google impressions
at 0 in 99+ days. By product: bundle 41, then a 24-product long tail (time-tracker 5,
expense-tracker 6, timezone 4, ...). Amounts: 1900 x45, 3900 x41, plus 499 x1 and 9900 x2
the worker cannot create.

3 of the 89 carry **no `metadata.product`** — impossible
from `mcp-billing`, which always sets it. Field dump: `cs_live_a1DC...` amount 499,
subscription, success_url `zovo.one/extension-engine/delivery`; `cs_live_a1co...` 9900,
utm_source `zvonight`, same success_url; `cs_live_b1ot...` 9900, success_url
`backend.belikenative.com`. Other zovo properties sell on this account and land in the
KPI sample. Another 3 of the 89 are invoice sessions with tenant `anon_0000000...` —
this repo's own validation fixture minting untagged sessions via `?tenant=`.

`billing/src/index.js:1368` treats a request
as a buyer when it sends a browser UA and `accept: text/html` — the sec-fetch pair is
required only for the *click counter* (`isHumanNavigation`), not for session creation:

```sh
curl -sS -i 'https://mcp.zovo.one/buy/invoice?src=funnel.r1.guardproof' \
  -H 'user-agent: <Chrome 140 UA>' -H 'accept: text/html'
# (no sec-fetch headers, no x-mcp-probe)
# -> 303 location checkout.stripe.com/c/pay/cs_live_a1ix4pBclYNUwOCqH8ZjqW0Fmm1DLrf5N5wO97uAIXjnNYnwvndVRyOEyf
#    with NO x-mcp-probe-* headers: a fresh UNTAGGED session the KPI counts as human.
```

So any script with a browser UA and an html accept header mints a "human" session.
(This proof cost one Stripe object; it expires unpaid within 24h.)

Click side agrees: `curl -sS https://mcp.zovo.one/stats/clicks` — instrument v2 totals
**737 clicks, all within its ~2-day life**; `store.setup.*` alone 432, with per-client
counts 57–66 (near-uniform sweep; CLAUDE.md trap 5: human demand is a power law, machine
sweeps are uniform); `checkout.crosssell.*` 0; legacy v1 counter 1,690. The loop-33 round
measured the same sweep on v1 (522 of 1,685 on `store.setup.*`).

### 7. Demand signal

```sh
curl -sS https://mcp.zovo.one/stats/clicks | node -e '<prefix aggregation>'
# in-product cap-message srcs (<product>.<tool>, i.e. a person running a server who hit
# a cap and clicked the upgrade link): 0 srcs, 0 clicks in instrument v2.
# All 737 v2 clicks are storefront srcs. (v1 lifetime: 3 such clicks of 1,685 = 0.18%,
# per the loop-33 reading of the legacy counter.)
```

Positive controls before believing the zeros: (1) `stripe charges list --live --limit 20`
returns 20 real charges from other properties on this account (Subscription update x19,
Subscription creation x1) — the CLI and account surface real payments, so mcp's `paid=0`
in the window is a real zero, not a query failure. (2) Probe sessions returned
`x-mcp-buy: probe-session-reused` and carry `metadata.probe=1` — the tagging side of the
KPI filter works.

### 8. Cancel recovery

Live sessions carry `cancel_url: https://mcp.zovo.one/` (verified on the Stripe session
object). A cancel lands on the storefront home — every product's Buy link is there, but
the product context is lost. Per-product cancel (`/s/<id>`) is a one-line worker change;
the pin at `billing/test/checkout.test.mjs:141` must move with it.

## artifacts

- `data/funnel_r1.json` — structured findings (this file's machine-readable half)
- `/tmp/funnel35_sessions.json`, `/tmp/funnel35_clicks.json`, `/tmp/funnel35_checkout.html` — raw probe captures (ephemeral)

## cost

~12 wall minutes (2026-09-12T12:48–13:00Z). One untagged Stripe session created for the
guard-hole proof (expires unpaid); two probe-tagged sessions reused from the 23h cache.

## failures

- Stripe checkout HTML is a JS shell; payment-method blocks could not be enumerated by
  curl. Mitigated by reading `payment_method_types` off the Stripe session object
  (["card","link"]); full wallet confirmation is human-gated (Dashboard).
- `docs/FUNNEL_R1.md` and `data/funnel_r1.json` from loop 33 were overwritten per
  loop-35 ownership; their load-bearing facts (hosted-URL prerequisite trap, 3 lifetime
  in-product clicks, store.setup sweep on v1) are preserved in sections 6–7 and in
  CLAUDE.md trap 1.

## insight

The funnel's measured leak (65 -> 0) is an artifact of who creates sessions, not of what
happens after one is created: every verified mechanical step — create, price, redirect,
fulfill, verify, recover — works live, while the "human" numerator is reachable by any
script holding a browser UA and `accept: text/html`. The honest numerator today is
indistinguishable from zero (0 in-product cap clicks in v2), so zero paid is the expected
output of a healthy funnel, and the binding constraint remains audience, not checkout.

## Ranked fixes

Autonomously fixable (source only; wave C deploys):

1. **Tag navigation-verified sessions.** In `billing/src/index.js` /buy handler, pass
   `isHumanNavigation(request.headers)` into `createCheckout` and write
   `metadata[nav]="1"|"0"`. Keeps the deliberate buyer-safety trade-off (accept-html
   requests still reach Stripe) while giving the KPI an honest filter. Handoff:
   `scripts/kpi.mjs:64` counts probe-absent AND `nav="1"` (orchestrator-owned).
2. **KPI sample hygiene.** Exclude sessions with no `metadata.product` (shared account)
   and paginate / use a created-gte window — `has_more: true` makes "last 100" a 10-hour
   burst window. Handoff: `scripts/kpi.mjs:64` (orchestrator-owned).
3. **Per-product cancel_url.** `createCheckout` sends `cancel_url: https://<host>/s/<id>`;
   update the pin in `billing/test/checkout.test.mjs:141`.
4. **Tag the tenant-fixture probes.** The validation path minting `anon_0000000...`
   tenant sessions must send `x-mcp-probe: 1`. Handoff: probe caller in
   `scripts/validate.mjs` or equivalent (hosted/orchestrator-owned).

Human-gated (exact URLs):

1. Delete the duplicate `mcp.zovo.one/webhook` endpoint (the one carrying only
   `checkout.session.completed`): https://dashboard.stripe.com/webhooks
2. Confirm the payment-method configuration; live sessions render [card, link] only —
   wallets are a Dashboard toggle if wanted:
   https://dashboard.stripe.com/settings/payment_methods
3. Demand, not checkout, is the binding constraint (0 in-product cap clicks v2; ~10
   humans/fortnight per CLAUDE.md). No funnel edit fixes that; distribution is the lever.
