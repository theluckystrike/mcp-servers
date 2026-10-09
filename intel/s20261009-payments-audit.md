# Payments Audit — 8 Paid Stripe Sessions, 0 License Keys Minted (2026-10-09)

STATUS: complete

## 1. Root Cause

**The KPI measurement is broken, not the product.** The 8–9 `payment_status: "paid"` live Stripe
sessions on the account were **not created by the mcp.zovo.one storefront**. They belong to other
products on the same Stripe account:

- 8 sessions: `success_url = https://zovo.one/extension-engine/delivery?session_id=...`
  (extension-engine storefront, no product metadata, `checkout.session` mode `payment`)
- 1 session: `success_url = https://backend.belikenative.com/...` (belikenative)

**None** has `success_url` under `mcp.zovo.one` or product metadata `bundle`. The mcp-billing
worker correctly minted nothing for them — they are other products' revenue counted against the
MCP KPI. `scripts/kpi.mjs` line 64 counts *every* paid session on the account:

```js
stripe.paid = d.filter((s) => s.payment_status === "paid").length;
```

— with no filter on `success_url` / `metadata.site` (the KPI's own test fixtures filter by
`metadata: { site: "mcp.zovo.one", product: "bundle" }`; the live KPI script does not).

Secondary finding: **the MCP storefront has zero completed purchases** — every
`mcp.zovo.one/success` session in the last 100 is `expired` (unpaid). So the "Paid sessions: 8"
KPI overstates MCP revenue from 0 to 8, while the true MCP figure is 0.

Secondary observations (not causal today, but latent risk):
- **No live-mode webhook endpoint is registered** for the mcp-billing worker
  — ORCHESTRATOR CORRECTION 2026-10-09: this claim was WRONG. `stripe webhook_endpoints list --live`
  shows two live endpoints at https://mcp.zovo.one/webhook
  (we_1UBDXNJKCamubEm1bVV0lqnX, we_1UBDXCJKCamubEm1usV2qNyE), and the worker handles
  checkout.session.completed + async_payment_succeeded with signature verification
  (billing/src/index.js:2288). Fulfilment does NOT rely solely on /success.
- `stripe_bound_tenants: 2` in kpi.json comes from `bind:` keys in REMOTE_DATA, but the LICENSES
  namespace is empty — those binds were not written by a session-mint path and should be explained
  or they are a second attribution leak.

## 2. Verbatim Evidence

```
$ stripe checkout sessions list --live --limit 100
total: 100, paid: 9
cs_live_a1fwrXq6IhZ8N89QFZZSZeQeWQ8SbLLZlmIKiVx7XwH0X1a8m6iIbL6htp 5000
  | success: https://zovo.one/extension-engine/delivery?session_id={CHECKOUT_SESSION_ID} | created 1791633263
cs_live_a18E2G7UwKZlh6TbhoNBMG01f4nxMOzYUoxv6ELH8QZTF0DZBHl0zyZOF 5000
  | success: https://zovo.one/extension-engine/delivery?session_id={CHECKOUT_SESSION_ID} | created 1791631970
cs_live_a1qgbYcbUCzPNCx5QbEcuXP8Pj0XfSPi8WNqF8k2ApjP9kOQfm9dq8SWu 2000
  | success: https://zovo.one/extension-engine/delivery?session_id={CHECKOUT_SESSION_ID} | created 1791629903
... (5 more extension-engine paid sessions, same success_url pattern)
cs_live_a3nP0zYJ2VslWpZyf1HbUuLC8XQfRIVsOOCiBg3e4sM0X3eYfEq9dXX2W 6000
  | success: https://backend.belikenative.com/ ... | created 1787451777
```

Every session whose `success_url` starts with `https://mcp.zovo.one/success` is unpaid/expired —
no `payment_status: "paid"` session carries an mcp.zovo.one success URL.

```
$ stripe webhook_endpoints list        (livemode flag per endpoint)
we_1UNalAJ... test disabled https://csv-policy-paid-v12-candidate-20261006.lipmichal.workers.dev/webhook
we_1UCWiKJ... test enabled  https://exam-practice-review-kit-test.lipmichal.workers.dev/webhook
... (all 10 endpoints: livemode false)
=> no LIVE webhook endpoint points at mcp.zovo.one/webhook
```

```
$ cd /Users/mike/mcp-servers/billing
$ NID=$(grep -A1 'binding = "LICENSES"' wrangler.toml | grep id | cut -d'"' -f2)
$ wrangler kv key list --remote --namespace-id 75f8bf4872a0433285d11575cece8641 --prefix "bind:"
[]
$ wrangler kv key list --remote --namespace-id 75f8bf4872a0433285d11575cece8641 --prefix "session:"
[]
=> LICENSES KV is empty: 0 minted keys, consistent with 0 MCP purchases
```

`scripts/kpi.mjs` line 64 (root cause of miscount):

```js
stripe.paid = d.filter((s) => s.payment_status === "paid").length;
```

`scripts/kpi.mjs` line 208:

```js
{ cat: "Monetization", name: "Paid sessions", value: stripe.paid, target: 5, unit: "paid",
  how: "stripe checkout sessions list --live payment_status", why: "The number that matters." }
```

Contrast: the monitor test fixture correctly scopes sessions —
`scripts/test/billing-operations-monitor.test.mjs:11`:
`payment_status: "paid", metadata: { site: "mcp.zovo.one", product: "bundle", tenant }`.

Worker fulfilment paths exist and are wired (`billing/src/index.js`):
- `/webhook` POST (line 2288): verifies signature, fulfils, mints, sends email
- `/success` page render (line ~855 comment: "the key is only rendered on the /success page after
  payment") and `/recover`
- Both log to `logVerifiedPayment` / `logFulfillmentOutcome`

## 3. Fix Plan

1. **Fix the KPI (immediate, scripts/kpi.mjs line 64):** scope the paid count to the storefront:
   ```js
   stripe.paid = d.filter((s) => s.payment_status === "paid"
     && String(s.success_url || "").startsWith("https://mcp.zovo.one/")).length;
   ```
   (or filter on `metadata.site === "mcp.zovo.one"` once metadata is set on session creation).
   Regenerate kpi.json — expected result: `stripe.paid: 0`.
2. **Set `metadata.site`/`metadata.product` in the Session builder** (`billing/src/index.js`
   checkout/sessions create, line ~963) so attribution never depends on URL parsing.
3. **Register a live webhook endpoint** for `https://mcp.zovo.one/webhook` with events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded` (plus refund events)
   and set `STRIPE_WEBHOOK_SECRET` in the worker env. Today a buyer who closes the success tab
   before it loads gets paid but never minted/emailed.
4. **Reconcile the 2 REMOTE_DATA `bind:` keys** (kpi `stripe_bound_tenants: 2`) — confirm whether
   they came from another storefront sharing REMOTE_DATA; if so, exclude them from the MCP
   tenant KPI for the same reason as the sessions.
5. **No code fix in the worker is needed** — minting/email paths are intact and correct for
   mcp.zovo.one sessions; there simply have been no completed MCP purchases yet.

## 4. KPI vs Product Verdict

- **KPI measurement: BROKEN.** `scripts/kpi.mjs` counts account-wide paid sessions with no
  storefront filter. 8 of the 9 paid sessions belong to zovo.one/extension-engine, 1 to
  backend.belikenative.com; zero belong to mcp.zovo.one.
- **Product: NOT broken.** No fulfilment defect exists — there are simply zero completed
  mcp.zovo.one purchases (all its sessions are expired/unpaid), so 0 keys minted is the correct
  outcome. The lost-revenue signal is real but it is "no MCP sales yet", not "sales silently
  dropped".
- Latent product risk worth fixing anyway: ~~no live webhook endpoint~~ CORRECTED 2026-10-09: two live webhooks exist at mcp.zovo.one/webhook and are handled by the worker — no action needed.
