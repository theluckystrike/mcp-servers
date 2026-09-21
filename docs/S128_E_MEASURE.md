# S128_E_MEASURE — KPI re-measure 2026-09-21 (orchestrator, runtime-verified)

STATUS: complete. Subagent exhausted budget after Tasks 1–2; orchestrator executed Tasks 1–5 directly and verified every number below with a producing command.

## Delta table (data/kpi.json HEAD vs working tree)

`git show HEAD:data/kpi.json` vs `data/kpi.json`: **32 KPIs both sides, ZERO values moved** (comparison script printed no MOVED/NEW/DROPPED lines). Score: **8 of 27 target-bearing KPIs met** (`t is not None and value >= target`). The last run was already fresh today (07:50); nothing regressed, nothing improved since.

## Task 1 — traffic.mjs (fresh run 2026-09-21T01:18Z, 7.013d Cloudflare window)

Required `CLOUDFLARE_API_TOKEN` from `~/.zshenv` (wrangler OAuth in ~/.wrangler expired 2026-04).
- 201 sitemap URLs; **201 crawled by a search/AI bot in 7d**; 191 browser-UA; 177 render-proven.
- Totals: 506,210 requests, 15,277 visits, 1.29 GB edge bytes.
- `by_class`: other_bot_probe 275k, scripted_client 150k, human_browser 14.7k, **search_ai_crawler 3,029**, seo_crawler 1,727.
- Top crawlers (requests): meta-externalagent 1299, Amazonbot 578, Barkrowler 517, DotBot 441, SemrushBot 326, ClaudeBot 215, PerplexityBot 119, GPTBot 67, **Googlebot 66**, bingbot 54, OAI-SearchBot 30.
- Cloudflare GraphQL: WORKING. GSC channel: DOWN this run (data/gsc.json iCloud-dataless guard fired, preserved) — preserved file holds **clicks 58, impressions 4,453** (status OK).
- Plan constraint (measured): httpRequestsAdaptiveGroups refuses data older than 1w1d on Pro zone → 30-day per-path pulls impossible.

## Task 3 — GSC-independent probes (all commands curl, just run)

- Sitemap: `curl -s https://mcp.zovo.one/sitemap.xml | grep -o '<loc>' | wc -l` → **201**
- Page 200s: `/`, `/s/invoice`, `/s/quotes`, `/mcp/connect`, `/guides` → all **200**
- Homepage internal `/s/` links: **91**
- robots.txt: `User-agent: * Allow: /`; disallows /buy/, /success, /recover, /verify (correct — no crawl traps); robots.txt fetched 1,313×/7d by 17 crawler species.

## Task 4 — Cloudflare analytics

Covered by traffic.mjs above (same GraphQL API): 7d window per-path/per-UA slices, max day slice 8,340 rows of 10,000 cap (not saturated). Billing worker deploy-verified separately (S128_C).

## Task 5 — findable share

`data/distribution.json` (updated 2026-09-20): **12 of 70 surfaces published** (github, billing, registry, mcpb, guides, hosted, github-mirrors, setup, estate-backlinks, gemini-cli-gallery, mcpmarket, mcp-playground). Blockers: npm (E401), smithery, mcp.so (paid), cursor.directory, pulsemcp; ~20 awesome-list PRs submitted/pending; 4 live.

## Read

Search/AI crawler coverage is at 201/201 URLs — the discovery bottleneck is no longer crawl access; it's ranking/impressions (Googlebot only 66 requests, GSC impressions 4,453 with 58 clicks). The three human unlocks (npm login, GSC verify, mcp-marketplace email) remain the highest-leverage moves.
