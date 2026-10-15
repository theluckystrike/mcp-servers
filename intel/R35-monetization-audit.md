# R35 monetization audit (2026-10-15, agent fan-out; re-landed after reset)

## Payment rails (verified live)
- Stripe Checkout: LIVE — `billing/src/index.js` (PRODUCTS table, /buy/:product, webhook fulfillment mints MCPL1 Ed25519 key bound to hosted tenant). Pricing $19/server, $39 bundle (all 47).
- Telegram Stars (XTR): wired end-to-end 2026-10-12 (`telegram/src/bot.ts`, `pricing.ts`); needs human-gated bot token.
- Resend license email: coded, guard at billing/src/index.js:1343 — INACTIVE until RESEND_API_KEY secret is set.
- Free tier: 600 calls/hr/token, 30-day retention, per-server caps. Pro: 6000/hr.

## Measurement state
- Dashboard `index.html`: Traffic/Install/Activation/Reliability/Monetization KPIs. 17 human checkout sessions, ~0 paid, 280 free tenants w/ stored data, 1 Pro tenant.
- No client-side analytics (no GA4/Plausible/Posthog); server-side only (CF GraphQL, /stats/clicks v2, GSC).
- Worker tracking: KV rate-limit counters, token mints, tenant docs, click counter. No funnel/unique-user pipeline.

## Ranked levers
1. [DONE in R35] Upsell trailer in every successful tools/call for non-Pro tokens — shipped PR #56, verified live (src-tagged /buy links, tenant pre-bound).
2. Flip Resend email-capture loop: set RESEND_API_KEY (wrangler secret put). Effort S, unblocks license delivery + outreach.
3. Time-boxed Pro trial tokens via existing `exp` license field. Effort M.
4. Prices on dashboard — low impact, already on all commercial pages. Effort S.
5. Fix window-mismatched click→session KPI in dashboard. Effort M.

## Audit of options (a)/(b)/(c)
- (a) paid-tier upsell in tool responses: SHIPPED (PR #56, commit d76f3a30).
- (b) prices on dashboard: exists on /buy pages; dashboard addition is S effort, low impact.
- (c) free-trial tokens: `exp` field already in license schema; S/M effort, worth doing next.
