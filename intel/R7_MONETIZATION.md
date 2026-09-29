# R7 — Monetization Funnel Audit & Fixes

STATUS: in progress

## Goal
Trace the 100-sessions → 2-paid leak in the MCP estate purchase path, identify what the 2 payers bought, and implement the top 1-3 highest-ROI funnel fixes (static-site safe only).

## KPIs (from context)
- 100 human checkout sessions, 2 paid
- 0 license keys minted
- 2 upgrade clicks, 2 pro tenants
- $19 / $39 pricing

## Evidence Log
(append commands + outputs as gathered)

## Findings
(placeholder)

## Implemented Fixes
(placeholder)

## Deploy Commands
(placeholder)

## Findings (2026-09-29, orchestrator-run; subagent stalled so direct execution)
- /stats/clicks (authoritative, DO-backed): total_clicks 978, clicks_7d = 1, named srcs
  total 0 (s137.phuman 1 in 7d), unattributed 165 lifetime. Human traffic is ~zero -
  consistent with GSC 0 clicks/19 impr.
- LICENSES KV namespace (75f8bf48...) lists ZERO keys via API (list may be DO-shimmed);
  REMOTE_DATA holds 6,951 anon tenant keys - activation numbers (442 tenants, 135 tokens)
  come from the worker's own stats endpoint, not raw KV.
- Checkout: 97 sessions from last 100 humans, 2 paid (KPI panel), conversion ~2%.
  0 license keys minted since Stripe live => the 2 paid sessions predate or did not mint.
- AE finding: this CF account has ONE Analytics Engine dataset (tgtools_site_hits,
  tg.zovo.one). Storefront human-click counts come from the DO instrument, not AE.
- Pricing: uniform PRO $49 (PRO_STARS analog). With ~zero top-of-funnel, price is not
  the constraint; distribution is.

## Implemented Fixes
(placeholder)

## Deploy Commands
(placeholder)
