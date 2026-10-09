# MCP Estate Cold Monetization ROI Map — 2026-10-09

STATUS: complete (orchestrator-written from measured data; payments audit + platform research)

## 1. Where the money actually is (platform comparison)

| Surface | Traffic | Conversion | Verdict |
|---|---|---|---|
| mcp.zovo.one storefront | ~978 clicks/7d, 97 human sessions | 0 paid (KPI bug fixed; was falsely "8 paid") | **Main monetization surface, no revenue yet** |
| mcp.so issues (wave1 45 + wave2 40) | 85 verified GitHub issues | — | Free distribution; no proven referral traffic yet (no UTM/referrer data) |
| allmcps.com | open API; 1 submitted (time-tracker, pending) | — | Cheap, scalable submissions |
| mcpservers.com | Google sign-in gate | — | Human step only |
| Google organic | 20 impressions/0 clicks on MCP host; Googlebot 2 URLs/7d | — | Site barely indexed — this is the #1 bottleneck |

## 2. Top 3 monetization moves (ranked)

1. **Fix distribution before pricing.** Organic traffic is ~zero (20 impr/7d). Every paid-tier change is premature until traffic exists. Biggest lever: mcp.so backlinks + sitemap/IndexNow + h1 quality (shipped today).
2. **Register the live Stripe webhook** (checkout.session.completed → mint+email). Today fulfilment depends on the buyer loading /success — a paid customer can silently never receive their key. One human step in Stripe dashboard; code already supports it.
3. **Founding-tier urgency on /pricing** ($19/$39). 97 human sessions with 0 paid says: traffic is looking, not buying. Add a founding-price deadline + show real usage numbers on /pricing.

## 3. What to kill / deprioritize

- More storefront pages without backlinks (R-rounds of guides have no traffic to feed on).
- AllMCPs agent-token ceremony — optional; open API already works.
- mcpservers.com until a human does the Google sign-in once.

## 4. Pricing recommendation

Keep $19/$39. No evidence yet to price against (n=0 purchases). Revisit after first 10 paid.

## 5. Outreach access (Resend) — for the user

Biggest win available today: give the agent the Resend API key:
```
hermes config set env RESEND_API_KEY "re_xxx"
```
(then it is available to terminal sessions). Use cases ready to fire: license-delivery email already live on the worker; next: outreach drafts in docs/outreach/R4/* can be sent to MCP directory maintainers. Alternative: a Resend domain-verified sender (support@zovo.one) is already assumed by the webhook code.

## Sources
- intel/s20261009-payments-audit.md (agent, verified against live Stripe CLI)
- scripts/kpi.mjs fixed this session: paid now scoped to mcp.zovo.one → 0
- GSC/R7 intel: 20 impr/0 clicks, 978 clicks/7d zovo.one aggregate
