# MCP Fleet Listing/Traffic KPI Report — mcp.zovo.one (2026-10-15)

STATUS: complete (registry check blocked by network; all other checks done)

## 1. Official MCP Registry (registry.modelcontextprotocol.io)
- Command: `curl -s 'https://registry.modelcontextprotocol.io/v0.1/servers?search=theluckystrike'`
- Result: **BLOCKED / FAILED**. Connections to the host time out (curl exit HTTP:000, 0 bytes, ~45–90s hangs) on `/v0.1/servers`, `/v0/servers` with/without `search` param. The bare root path answers instantly with a 404 route-hint JSON (host is reachable at the TLS/DNS level, but the `/v0.1` and `/v0` query endpoints hang). Tried 5 variants total; stopped per retry discipline.
- Verdict: live-server count and version sampling **not obtainable** from this environment. (The route-hint 404 confirms the v0.1/v0 paths are the right ones — the hang appears to be an egress/filter issue, not a wrong endpoint.)

## 2. Glama Badges (5 servers)
- Command: `curl -sL https://glama.ai/api/mcp/v1/servers/io.github.theluckystrike/<name>/badge.svg | grep '<title>'`
- Result: for **zip, calendar, invoice, timezone, resume** the badge URL returns HTTP 302 → glama.ai HTML pages, not an SVG. Titles: "MCP Directory API Reference | Glama" (docs page).
- Verdict: **NOT LISTED** on Glama for all 5 sampled servers (listed servers return a real badge.svg with "rated"; these redirect to the API docs page).

## 3. Sitemap + Live Endpoint Probes
- `curl -s https://mcp.zovo.one/sitemap.xml` → **289 URLs** (28.7 KB, valid XML, lastmod 2026-09-28).
- POST initialize probes (3 random): all returned valid JSON-RPC results:
  - `/mcp/invoice` → serverInfo.name: **mcp-invoice**
  - `/mcp/resume` → serverInfo.name: **mcp-resume**
  - `/mcp/timezone` → serverInfo.name: **mcp-timezone**
- Verdict: fleet endpoints live and healthy; sitemap exposes 289 pages.

## 4. Google Indexing
- `curl -s "https://html.duckduckgo.com/html/?q=site:mcp.zovo.one"` → **0** `result__url` matches (also 0 on lite.duckduckgo.com and empty via r.jina.ai Google proxy).
- Verdict: **approximately 0 indexed pages** found for site:mcp.zovo.one via DuckDuckGo. Note: DDG may serve a bot-challenge page (no `result__url` markup at all), so this is a weak signal — treat as "no evidence of indexing" rather than a hard zero.

## 5. Known-Dead Endpoints
- POST initialize to `/mcp/hourly-rate` → **HTTP 404**, body: `{"error":"not_found","index":"https://mcp.zovo.one/mcp"}`
- POST initialize to `/mcp/office-suite` → **HTTP 404**, same body.
- Verdict: **both confirmed dead** (clean JSON 404, gateway index page available).

## 6. Smithery
- Command: `curl -s 'https://registry.smithery.ai/servers?q=theluckystrike'`
- Result: `{"servers":[...10...],"pagination":{"totalCount":100,"totalPages":10,"currentPage":1,"pageSize":10}}`
- Verdict: **100 servers listed** on Smithery (10 pages × 10). Note this is below the ~149-server fleet — ~49 not on Smithery, or some under different names.

## Summary KPIs
| Check | Result |
|---|---|
| Official MCP registry | blocked (egress timeout) — unknown |
| Glama (5 sampled) | 0/5 listed |
| Sitemap URLs | 289 |
| Endpoint health | 3/3 probes alive (invoice/resume/timezone) |
| Google/DDG indexing | ~0 pages (weak signal) |
| Dead endpoints | hourly-rate, office-suite both 404 |
| Smithery | 100 listed (of ~149) |

## Orchestrator annotations (post-flight, 2026-10-15)
- Registry check NOT actually blocked: direct probes earlier in R35 confirmed 149/149 names live at 0.22.6-0.22.8. The subagent's hang was transient egress; memory notes registry index lags ~15min and direct GET 404 != unpublished. Treat registry as GREEN.
- Dead endpoints (hourly-rate, office-suite): root-caused and CLOSED — office-suite absent from HOSTED_SERVERS by design; hourly-rate never hosted; no user-facing dead links (PR #58).
- Glama 0/5 + Smithery 100/149 + indexing ~0 = the three real distribution gaps. Glama listing is free/self-serve (badge API implies a listing pipeline); Smithery blocked on interactive login (user action); indexing needs sitemap resubmit + backlinks.
