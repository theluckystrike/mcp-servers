# STRATEGY-42 — Organic Traffic Disruption (opened 2026-09-18)

Baseline: data/kpi.json 2026-09-18T00:35Z. Google impressions 0, Googlebot 2/190, npm downloads 0, paid sessions 0. Checkout funnel healthy (29.9% click->checkout).

Constraint from T4 blind R6 (0/18 named, 0/18 cited): indexing != retrieval. Listings produce listings, not ranks. Winning surfaces are vendor blogs, Reddit, YouTube, and per-server pages with the server name in title/slug. mcp.zovo.one surfaces only at root in site: queries -> no per-server page can rank.

## Tasks (orchestrator fan-out, leaf agents, deepseek-v4-flash)

T1_LANDING_R1 — Per-server landing pages (BIGGEST LEVER).
Create 42 per-server landing pages at /mcp/<slug>/ on mcp.zovo.one (title = "<server name> MCP server", H1, description, install snippet, tool list, links: GitHub mirror, registry entry, Glama page, hosted remote endpoint). Source: billing/src or static content map in the worker. Add all 42 to sitemap.xml. Tests green, deploy, verify 5 sample URLs live 200 with contentHeaders. Add sitemap push + IndexNow submit of 42 URLs.

T2_ETAG_R1 — Worker-wide ETag fix (T5 4b).
Replace static etag in contentHeaders() (billing/src/index.js:409) with content-derived strong ETag (SHA-256 of body, first 16 hex). Keep Last-Modified. Tests, deploy, curl-verify ETag present on /, /bundle, /s/invoice. Confirm not stripped by CF.

T3_GLAMA_REPROBE_R2 — Re-probe the 16 new short-slug registry entries on Glama (published 09-18). For any newly indexed, verify badge SVG >4000B non-"not listed", add badge line to that server README. Commit 'sprint 42 T3'.

T4_BLIND_R7 — Re-run blind recommendation R7 AFTER T1 deploys (per-server pages are the change under test). Same frozen procedure, compare vs R6 (0/18).

T5_SURFACES_R2 — Off-listing channel placement: find 5 unlinked blog posts / tool directories / newsletter archives that review "MCP servers for documents/invoices" and lack any link to a per-server page we now have; draft account-free contact or comment paths. No accounts, no spam.

T6_KPI_R2 — KPI refresh after T1+T2 deploys; delta vs 09-18 baseline; add new KPI rows: /mcp/ landing coverage (42), per-server indexed count (site: probe).

Gate: T4 runs only after T1 is live. All deploys require node --test green first.

## Human-gated (unchanged, escalated)
Search Console/Bing verification; paste 7 outreach drafts (docs/outreach/R1/); Glama OAuth for 29 pages; npm publish; Stars.
