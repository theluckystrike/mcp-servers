# NEXT-SPRINT — S46 handoff (from S45 close, 2026-09-19)

## Context
S45 closed at 8.5/10. MCP Playground 42/42 double-confirmed. Search fan-in live
(336 new internal links, deploy 588c5be4). KPI 10/32. GSC first impressions (10).
Commits thru 1f813d9c.

## Priority queue (biggest-impact first)
1. **Re-crawl measurement** (agent): re-run scripts/traffic.mjs after 72h+7d window —
   did Googlebot/bingbot pick up the 336 sibling links? Compare crawler_url_coverage
   vs this sprint's snapshot (GB 16, bingbot 3). This is the direct read on whether
   fan-in moves search crawlers.
2. **Glama slug repair** (agent, autonomous): 13 servers listed but invoice/spreadsheet/
   bank-statement 404 on slug probes. Check glama.ai author page for actual slug
   patterns; if listing is auto-ingested from GitHub, check what differs for those 3
   (repo structure? mcp.json? description?).
3. **Outreach posting** (HUMAN-GATED): 5+ drafts held — R1 3, R2 replies w/ S45 proof,
   w2 Reddit/HN value post + registry Discussions post. User green-light = biggest
   distribution unlock available.
4. **GSC + Bing Webmaster verification** (HUMAN-GATED, still #1 unlock): 10 first
   impressions prove Google will surface the domain once indexed properly.
5. **mcp.so recheck** (~1wk): #4227/#4228 ingestion watch; if ingested, file remaining
   per the T9 pipeline.
6. **MCP Playground listing check** (~1wk): review-gated; probe
   mcpplaygroundonline.com/mcp-registry?q=zovo for live listings.
7. **Stripe funnel**: 334 clicks → 29.9% checkout → 0 paid. Leak inside Stripe.
   Consider pre-filled email/test-mode audit (human-gated for Stripe dashboard).
8. **CF Auto Minify off** (HUMAN-GATED, one toggle): restores ETags sitewide.

## Conventions (unchanged)
- Leaf contract: 30 iterations, deliverable first (STATUS: in progress), evidence with
  producing commands, no commit (orchestrator commits), no sleep/poll.
- Leaf edits: node --test + diff review + LIVE handler probe (T7 price bug, T5 missing
  import both passed tests and broke prod).
- kpi.mjs reads data/distribution.json; kpi.json parse via d['kpis'].
- IndexNow: node scripts/indexnow.mjs --all (193 URLs).
- Deploy: cd billing && npx wrangler deploy; run node --test test/ first.
- MCP Playground rate: ~1/2-3min, 429 → 120s backoff, 409 = already submitted (counts).
- docs/submit_w2.mjs is resumable (reads docs/w2_results.log); reuse the pattern for
  future batch submissions.
