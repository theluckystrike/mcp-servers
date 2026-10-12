# s20261009b — /pricing founding-tier conversion pass

STATUS: shipped (deployed + verified + committed)

## What changed
- billing/src/index.js:
  - NEW `/pricing` route (there was no /pricing page before; live URL returned "Not found"). Page contains:
    - Founding-tier callout: "Founding price — locked for early customers", deadline **2026-11-08** (30 days from 2026-10-09).
    - Real usage counters from data/kpi.json: **190 hosted tenants**, **239 hosted downloads**.
    - Proof lines: **1254/1254 live validation checks passing**, **119 anonymous tokens minted**, trust line (14-day refund, key in Stripe receipt, re-sendable at /recover).
    - Prices unchanged: $19 single server / $39 bundle (rendered from PRODUCTS, no number edits).
    - Primary CTA: "Get your license key — delivered instantly by email".
  - Sharpened the buy-page CTA (all /buy/* pages): "Continue to secure Stripe checkout" → "Get your license key — delivered instantly by email".
- billing/test/checkout-r1.test.mjs: updated pinned CTA regex to match the new copy (preflight gate failed on the old expectation first time).

## Deploy
- Command: `PATH=/opt/homebrew/bin:$PATH node scripts/deploy-billing-gated.mjs </dev/null` from /Users/mike/mcp-servers (gated script; npm test preflight, wrangler deploy --strict, postdeploy verify, KV approved-version pin).
- First run failed: gate `npm test` exit 1 — test/checkout-r1.test.mjs:324 expected the old CTA string. Fixed the test, rerun succeeded.
- Output: `Billing release verified: fcf3a840-de8e-499c-9df1-414dbcda55ba`

## Verification (live, post-deploy)
- `curl -s https://mcp.zovo.one/pricing | grep -i founding` →
  - "Founding price locked until 2026-11-08."
  - "Founding price: $19 per server, $39 for the full set. One-time, lifetime, license key delivered instantly by email."
  - "Founding price — locked for early customers."
- Present on page: `190 hosted tenants`, `239 hosted downloads`, `1254/1254`, `119 anonymous tokens`, `Get your license key &mdash; delivered instantly by email`.

## Commit
- `496af74c R-s20261009b: /pricing founding-tier conversion pass (urgency callout 2026-11-08, 190 tenants/239 downloads counters, proof lines 1254/1254 checks + 119 tokens, action CTA), gated deploy fcf3a840`
