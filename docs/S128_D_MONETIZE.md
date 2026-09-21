# S128_D — Monetization Map & Checkout Hardening

STATUS: complete — executed in orchestrator lane after subagent budget failure.

## Payment-options map

| Option | Status | Route | Stripe linkage |
|---|---|---|---|
| Free hosted tier | live | /mcp/<slug>/ (600 req/day) | none |
| Pro per-server (hosted token upgrade) | live | /buy/<id> -> Stripe Checkout | PRODUCTS[id].price (price_1UBD...) |
| All-access bundle $39 | live | /buy/bundle | PRODUCTS.bundle.price |
| License keys for local installs (mcpb/npm) | live | license_activate tool, minted post-purchase | same PRODUCTS price, payload <id> |

Checkout funnel E2E probe (anonymous, browser-shaped POST to /buy/invoice):
303 -> Stripe, Location contains `cs_live_` — LIVE mode, not test-mode.
Defect list from the delegated brief: no code-level checkout defect found;
0-paid-sessions-in-100 is a traffic/conversion problem, not a broken funnel.

## Fixes applied (this session)

1. backlink-checker (server #47 dir / #46 sellable) was invisible to the
   storefront: no README (build-pages skipped it), no facts.json entry,
   no PRODUCTS row, NUMBER_WORD capped at Forty-five.
   - servers/backlink-checker/README.md written (tools: link_check,
     link_audit (Pro), robots_guard_check; free/pro split; quick start).
   - data/facts.json: servers.backlink-checker added (title/tagline/does/free).
   - billing/src/index.js: PRODUCTS entry (usd 19, no Stripe price yet —
     CLI is test-mode only; live price must be minted in Stripe dashboard,
     then add price: field) + NUMBER_WORD 46 "Forty-six".
   - scripts/build-pages.mjs ids list: backlink-checker inserted.
   - Regenerated: billing/src/pages.js, billing/src/figures.js (47 dirs,
     46 listed, 46 children, 45 hosted, 421 own tools).

## Verification (producing commands)

- cd billing && node --test test/*.test.mjs  ->  # pass 163 / # fail 0
  (was 162/2 at session start, 160/3 mid-flight)
- for s in invoice time-tracker leave onboarding; do curl -o /dev/null -w %{http_code}
  https://mcp.zovo.one/s/$s; done  ->  200 x4
- CTA audit: /s/invoice and /s/leave both carry /buy/<id> and /buy/bundle
  links (src=store.s.<id> tagged) — template CTA intact.
- Token mint E2E: curl https://mcp.zovo.one/mcp/token?server=invoice -> 200 token.

## Known follow-ups (not done here)

- Stripe live price for MCP Backlink Checker Pro (dashboard or live key;
  CLI config is test-mode) then wire price: into PRODUCTS entry.
- wrangler deploy to ship pages/figures/index changes (orchestrator holds deploy).
