# R35c — Indexing & directory intelligence (2026-10-15)

## IndexNow resubmission
- POSTed all 289 sitemap URLs to api.indexnow.org (key indexnow.txt). Batch accepted.
- Legacy Google/Bing ping endpoints dead (404/410) — expected; IndexNow is the surviving channel.
- No evidence yet of crawl pickup; Brave probes rate-limited (429) during verification window.

## Search-index presence (ai-index-probe, partial run)
- Brave site:mcp.zovo.one → rate-limited (429), site probe UNMEASURED this run.
- Depth probes: only 3 distinct mcp.zovo.one URLs retrievable from Brave; zovo.one as a whole: 60 URLs. mcp.zovo.one subdomain is nearly invisible to Brave.
- Buyer-intent queries (Brave): "mcp server invoice" ours=0; "mcp server pdf merge" ours=1; "claude mcp expense tracker" ours=0. Organic buyer traffic ≈ 0 from search.
- Prior run (ai_index_r1, 2026-10-12) same story: mcp.zovo.one present only in Brave, 3 URLs, 0 buyer-intent hits over 15 queries/45 measured runs.

## Glama (connector surface alive)
- /mcp/connectors?query=namespace:io.github.theluckystrike returns 200 with 20 rows/page (rotating set — pagination behind API key we don't have).
- Confirmed live connectors include: currency-exchange, exchange-rates, invoice-generator-freelancers, kanban-todo-tasks-projects-board, expense-tracker-receipts-mileage, cv-maker-resume-templates, meeting-notes-transcript-summary, price-drop-alert-tracker, leave, contract-clause-library-proposal-template-docx, …
- Badge probe (/api/mcp/v1/servers/<ns>/<name>/badge.svg) 302-redirects to reference page — badge endpoint is not a reliable listing signal.
- scripts/glama-watch.mjs currently FATALs: positive control mcp-statement-of-account connector page 404s (Glama re-shuffles/paginates the connector namespace). Watch script needs the cumulative-connector fix before next sweep (data/glama_watch.json last good: 2026-09-22, 16 listed / 35 absent).

## mcp.so
- No server-rendered search results for our namespace; homepage HTML contains 0 references to zovo/luckystrike. Listing there not confirmed; mcp.so indexes from GitHub/registry crawls — our registry presence (149/149) is the submission channel.

## Read
- Search-index footprint is the bottleneck for organic traffic: 3 indexable URLs. Sitemap has 289. IndexNow resubmitted; next lever is watching for Brave/Bing pickup after re-index window.
- Glama connector surface is the one directory we KNOW carries our servers with scoring (TDQS); restoring glama-watch lets us track score movement.
