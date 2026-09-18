# Sprint 45 — Organic Traffic Disruption + MCP Server Visibility

**Baseline (2026-09-18T12:27Z):** Google impressions 0, Googlebot 2 URLs, npm 0, paid 0.
Funnel: 334 upgrade clicks/7d → 29.9% checkout → 0 paid (leak inside Stripe — pre-checkout trust shipped S44).
Tenants 815 (was 799). GitHub: 3,596 clones/14d, 605 uniques, 0 stars.
32 KPIs, 9 met.

## Thesis
S44 convergence (T1+T2): the crawl gap is a TEMPLATE-REACH problem, not demand.
- bingbot crawls /setup (62%) + /compare (60%) but not /guides (14%) + /s (19%).
- GPTBot misses 51 URLs; those uncovered pages get MORE visits (median 20 vs 13).
- Fix: interlink FROM crawled templates INTO uncovered pages. Internal fan-in is the
  only Google discovery lever until GSC is human-verified.

## Wave 1 (parallel, this dispatch)
- T1: /setup + /compare template interlink fan-in (51 uncovered URLs; 13 /s focus) → deploy+IndexNow
- T2: MCP Playground submission (fully autonomous, free web form)
- T3: sitemap.xml enrichment (lastmod, guide xhtml alternates?) + robots.txt audit
- T4: stars/clone growth loop — GitHub README marketplace links + social proof (read-only research + proposal)
- T5: guide→guide RELATED mesh expansion (clusters by topic; value-first)
- T6: KPI + traffic re-measure pipeline hardening (auto-refresh traffic.json, drift alerts)

## Gates
- All src changes: orchestrator verifies node --test + diff before deploy.
- Deploy + IndexNow owned by orchestrator only.
- Outreach posts: still frozen pending user green-light (drafts ready: kimai/tally/brandrei).
