# s1103 stamp lane (www.mcpstamp.com)

## Phase 1 diagnosis
- "0 indexed of 144" is the sitemap report field, which reads 0 on every property. URL Inspection on 10 pages (/, /free-servers/, 2 free-server pages, zip answer, /developers/, /servers/, 2 use cases, /pricing/): 10/10 PASS "Submitted and indexed", Google canonical = declared canonical (www, trailing slash). Apex = unknown (301 to www, correct). Script: stamp/gsc_diag.py, raw: stamp/gsc_diag.json.
- Search analytics (sc-domain:mcpstamp.com, 10-01..11-02, dataState all): 0 clicks, 200 impressions, first impression 10-30. 48 pages, 34 visible queries.
- Why 0 clicks: the site has been indexed for 4 days. Only /can-claude/read-zip-files/ ranks on page 1 for visible queries (pos 7-9, about 17 impressions on "can claude open/read/unzip zip files"). At position 8 that gives under 1 expected click. Everything else is at pos 25-100. No technical blocker.
- Technical: robots OK, redirects OK, canonicals OK, sitemap single host, homepage links /free-servers/ and all 20 pages, JSON-LD present. Real issues: (a) 9 duplicate pairs /servers/<id>/ vs /free-servers/<id>-mcp/ (same Worker); (b) server titles lack "MCP" (target keyword "<name> mcp"); (c) zip title says "read", queries say "open/unzip"; (d) /readiness/ links 600 /check/?url= URLs that Google crawls; (e) production pages.dev host indexable.

## Phase 2 fixes (ranked by expected impact, all deployed)
1. Zip answer page: title "Can Claude open zip files? Read and unzip them", H1 "Can Claude open zip files?", meta leads with the direct answer.
2. 58 server titles -> "<Name> MCP server for Claude and Cursor".
3. 9 satellite /servers/<id>/ pages: canonical -> /free-servers/<id>-mcp/, out of sitemap (168 -> 159), cards/explorer/chips link to the canonical page.
4. robots.txt: Disallow: /check/? (all agents).
5. _headers: X-Robots-Tag noindex on mcp-showcase-preview.pages.dev.
6. Chase overdue invoices title matches query "chase overdue invoices automatically".

Commit 01f62b9 on theluckystrike/mcp-showcase-site main (1 push). Work copy ~/mcpstamp-work/s1103-stamp/repo.
Deployment 75a40491-31fa-4064-acd1-8b1ee5afbafc. Previous 6d9ba0c3-f40c-4833-a678-66976413e92f.
Rollback: `npx wrangler pages deployment rollback 6d9ba0c3-f40c-4833-a678-66976413e92f --project-name mcp-showcase-preview`
Verified live by curl (titles, canonical, robots, sitemap 159, pages.dev noindex). s1102m/integ4 test-merges cleanly with the new main.
GSC sitemap resubmitted (204, now 159 submitted, 07:34Z). IndexNow 200 for 80 changed URLs.

## Open
- Phase 3: new satellites into data/content/free-servers.json, one redeploy (waiting on orchestrator).
- Re-check zip page CTR and /servers/* positions in 7-14 days.

## Phase 2b + 3 (one deploy)
- 12 new /can-claude/ live-data pages: gold price, lake levels, minimum wage, no tax on overtime, inflation (CPI), per diem (GSC per diem queries), 2026 mileage deduction, business days, 2027 401(k) limits, silver price, river levels, SAT percentiles. Each: direct honest answer first, Claude alone vs with server, a real tools/call result run 2026-11-03 (raw in stamp/calls/), install lines, link to /free-servers/<repo>/. Plus /can-claude/ index (16 answers). Linked from home, /free-servers/, each free-server page and footer.
- /free-servers/ now 25 (added cpi-inflation-calculator, irs-mileage-rate-per-diem, silver-price-per-gram, river-level, sat-score-percentiles). Verified live: 25 links.
- Commit 4452a49. Deployment 4093cc9c-dc8b-46fa-b267-06dd2187a8e9, previous 75a40491-31fa-4064-acd1-8b1ee5afbafc.
  Rollback: `npx wrangler pages deployment rollback 75a40491-31fa-4064-acd1-8b1ee5afbafc --project-name mcp-showcase-preview`
- 18/18 new URLs 200, sitemap 177. IndexNow 200 (21 URLs). GSC sitemap resubmitted (177).
- Humanize strict: all new pages clean; the only fail is the pre-existing /terms/ label (other session's page).
- Issue: CPI server's keyless BLS API is over its daily limit; answers use bundled data through Sep 2026 (owner unlock: BLS key).
