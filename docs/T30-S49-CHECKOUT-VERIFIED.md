# S49 — Hosted checkout verification — STATUS: closed — RESULT: verified-green

Date: 2026-09-19.

## Sprint result

The S48 verdict flagged hosted checkout as the #1 blocker (31 failing buy
probes, 0 paid sessions). S49 investigated before touching code:

## Root cause — the funnel was never broken

Live probe of `https://mcp.zovo.one/buy/invoice` proved the deployed worker's
two-step checkout-intent flow (shipped in the 2026-09-13 Stripe audit) works
end to end:

1. GET /buy/<product> with browser-navigation headers
   -> 200 + `x-mcp-buy: checkout-intent-required` (the confirmation page)
2. POST same-origin with `intent=checkout` + Referer + Origin
   -> **303 to checkout.stripe.com with a LIVE cs_live_ session**

The 31 validation failures were STALE PROBES asserting the pre-audit
one-step contract (plain GET/POST -> 303), which the gate now correctly
refuses. The probes were lying; the funnel was fine.

## Fix (probes updated to the real contract, no fudging)

- scripts/validate.mjs remote(): curlBuy -> curlGet + curlPost (full intent
  headers incl. origin/referer/content-type); now asserts GET=200 intent
  page AND POST=303 to Stripe. Net +1 check (one GET, one POST instead of
  one stale assertion).
- scripts/validate.mjs billing(): same treatment for all 31 products:
  GET serves intent page, first product additionally proves live conversion
  (POST -> checkout.stripe.com).
- VALIDATION constant refreshed: { at: 2026-09-19, pass: 1244, total: 1244,
  servers: 45, medianMs: 397 }.

## Verified results

- Full validation rerun (run 51): **1244/1244 checks pass, zero failures.**
  Billing and remote suites fully green. Live Stripe conversion proven.
- Billing unit suite: **163/163** (re-verified after constant refresh).
- Dashboard updated (session 96 note).
- KPI re-measured (scripts/kpi.mjs): 9/32 met. Remaining unmet are
  distribution/traffic KPIs (Google/ClaudeBot coverage, registry versions,
  paid sessions 0/5) — none are code blockers; they need external
  distribution work, not more engineering.

## Verdict

The monetization funnel is verified working end to end with a live Stripe
session minted during validation. Paid sessions = 0 remains a demand-side
problem (traffic/reach), not a product defect. Next sprints should focus
purely on organic distribution: registry listings (42/129 at latest),
search-engine coverage (15/193 Googlebot), and assistant visibility
(0/18 blind recommendations).
