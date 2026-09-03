# In-product upgrade path (billing <-> hosted endpoints bind) — RESULT

status: DONE

Goal (PLAN_V3.md task 2): when a free cap is hit on a hosted endpoint, the checkout link
is pre-bound to that anonymous tenant token, and on payment the billing worker writes the
minted key into the KV namespace the hosted worker (`mcp-remote`) already reads, so the
hosted tenant becomes Pro with no key paste. Deployed live to `mcp-billing`; no real
payment was made.

## Contract with the hosted worker

KV namespace `REMOTE_DATA` (id `cf848cc5c07d4e0a9c7c65ad1c70055c`, account
`dd3f2a29b7707e21a87f26a622c0bb9d`, same namespace `remote/wrangler.toml` binds) —
key `bind:<anon_token>` = the minted `MCPL1...` key string, no TTL (a purchase is a
lifetime key; only the anonymous token itself expires, on the hosted worker's own
30-day KV TTL, orthogonal to this record).

## What changed

`billing/src/index.js`
- `TENANT_RE` / `validTenant(tenant)`: exported pure check, `/^anon_[0-9a-f]{32}$/`,
  matching the format `remote/src/index.ts` mints (`anon_` + 32 lowercase hex).
- `GET /buy/<product>?tenant=<anon_token>`: an invalid or absent `tenant` query param is
  silently dropped (checkout still proceeds, unbound) rather than failing the purchase.
  A valid one is threaded into `createCheckout` as both Stripe `client_reference_id` and
  `metadata[tenant]`. Probe tagging, price binding (`metadata[product]`, the Price ID,
  `payment_intent_data`) and every existing check are unchanged.
- `bindDecision(session, fulfilled)`: exported pure function. Binds only when
  `fulfilled` is true and `session.metadata.tenant` (never `client_reference_id`,
  which a client can set to anything) passes `validTenant`. This is the function the
  new tests exercise directly, no Stripe or KV needed.
- `bindTenant(env, tenant, key)`: one `REMOTE_DATA.put("bind:<tenant>", key)`, no
  `expirationTtl`.
- Both fulfilment paths — `/success` (after `keyForSession` mints/loads the key) and the
  `/webhook` handler for `checkout.session.completed` / `async_payment_succeeded` (after
  the same price-binding checks and the same `keyForSession`) — call `bindDecision` then
  `bindTenant`. A KV write failure is caught and logged; it does not fail the response,
  since the customer already has their key either way and the bind can be replayed by
  hand from the Stripe session's `metadata.tenant`.
- `successPage(key, productId, session, boundTenant)`: exported for testing. When a bind
  happened, an added "Hosted endpoints" section says the hosted endpoint for that token is
  already Pro and nothing further is needed there; the license key section is unchanged
  and always shown (stdio installs still need it).
- `GET /bound?tenant=<anon_token>`: reads `bind:<tenant>`, and if present, verifies it
  with the worker's own `verifyLicenseKey(key, null)` before answering, so a corrupted or
  hand-edited KV value can never report `bound: true`. Returns
  `{bound: true, product}` / `{bound: false, product: null}` / (bad tenant shape)
  `{bound: false, product: null, reason: "bad tenant"}`. Never returns the key. Added to
  `robots.txt` disallow alongside `/verify`.
- `GET /verify` unchanged.

`billing/wrangler.toml` — added the `REMOTE_DATA` KV binding, same id as
`remote/wrangler.toml`.

`packages/mcp-license/src/index.ts` — added `hostedUpgradeText(feature, product, tenant)`,
exported alongside the existing gate. It builds `<CHECKOUT_BASE>/buy/<product>?tenant=<tenant>`
and says the hosted connection becomes Pro automatically on payment, no key to paste. The
existing `upgradeText` method on the gate (stdio wording: "Buy at ... then run
license_activate") is untouched; this is a second, hosted-specific helper for the remote
shim to call once it has a tenant token in scope — no caller was wired up yet, since the
hosted server code under `remote/` is out of scope for this task.

`billing/test/bind.test.mjs` (new) — 7 tests:
tenant-shape validation (case, length, hex, non-string), `bindDecision` binding only a
valid tenant on a fulfilled session, refusing an unfulfilled session even with a valid
tenant, refusing a missing/malformed tenant, refusing a tenant spoofed via
`client_reference_id` outside `metadata`, and the success-page wording switch (hosted
note present only when a tenant was actually bound; key always shown).

## Test results

```
$ node --test test/*.test.mjs   (billing/)
# tests 25
# pass 25
# fail 0
```
(18 pre-existing fulfilment/mint tests + 7 new.)

```
$ npx tsc --noEmit -p tsconfig.json   (packages/mcp-license/)
(no output — compiles clean)
```

## Live verification

Deployed: `wrangler deploy` in `billing/` — version `0354ad21-ec47-4e93-ac77-0aa78fd23cbd`,
bindings confirmed in the deploy output: `env.LICENSES` and
`env.REMOTE_DATA (cf848cc5c07d4e0a9c7c65ad1c70055c)`.

```
$ curl -sI "https://mcp.zovo.one/buy/invoice?tenant=anon_bc4274f46d2e0fb04afa46a68524fa75"
HTTP/2 303
location: https://checkout.stripe.com/c/pay/cs_live_b1h26jfElvkdDlX8B2EgTE5UYkCSEhzGvmgaHpu3bjgZ0Oo41gFP8wL82Q...
cache-control: no-store

$ stripe checkout sessions list --live --limit 1
"client_reference_id": "anon_bc4274f46d2e0fb04afa46a68524fa75",
"metadata": { "product": "invoice", "tenant": "anon_bc4274f46d2e0fb04afa46a68524fa75" },

$ curl -s "https://mcp.zovo.one/bound?tenant=anon_bc4274f46d2e0fb04afa46a68524fa75"
{"bound":false,"product":null}

$ curl -s "https://mcp.zovo.one/bound?tenant=not-a-token"
{"bound":false,"product":null,"reason":"bad tenant"}
```

No real payment was made against that session (it was left open, not completed), so the
bind write path itself was exercised only by the unit tests, not end-to-end against live
Stripe/KV. The three pieces it composes — price-bound fulfilment (`fulfillmentAllowed`,
pre-existing, tested), the bind decision (new, tested above), and the KV write
(`REMOTE_DATA.put`, same primitive `LICENSES.put` already uses in production) — are each
independently verified; a completed real purchase with `?tenant=` would exercise all
three together and is the one step this report could not perform without spending money.

## Follow-up (not in scope here)

- `remote/src/index.ts` does not yet read `bind:<tenant>` to treat a bound anonymous
  token as Pro, and does not yet call `hostedUpgradeText` when a free cap is hit. That is
  the other half of PLAN_V3 task 2 and was explicitly out of scope for this pass (only
  `billing/`, `packages/mcp-license/src/index.ts` and this doc were to be edited).
- No orphan cleanup was added for `bind:<tenant>` records where the token itself has since
  expired (30-day KV TTL on the token's own auth record); the key stays lifetime-valid by
  design, so this is a support/observability question, not a correctness one.
