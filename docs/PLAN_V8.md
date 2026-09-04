# Plan v8 (2026-09-04, loop 11): traffic before conversion

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 1,039 | Catalog channel keeps growing without any web traffic |
| Human checkout sessions, last 100 | 2, both today, both unpaid, no email | Both match agent curls without the probe header; there is no human conversion data yet |
| GSC | 199 submitted, 0 indexed | Google has not crawled the storefront; zovo.one footer link live since 09:20 |
| Registry | 44 entries, findable 50% | Remainder is capped tokens; more names return little |
| Hosted rounds | 49/54, 51/54 | Value is measured; distribution is the gap |

## Top 5, ranked by impact x autonomy
1. Estate backlinks: one crawlable anchor to mcp.zovo.one from every indexed site the operator deploys from this machine (ukmoneycalc and statewage already link; add dscrradar, lakelevelnow, ml0x, worthmyclaim, ingredientcalculator, kickllm, toolsthatrank, heytensor, deepvalueradar, boldtake, aiwebsitepipeline, earlythunder where a deploy path is known and safe). Pass: anchor served to curl on each, no page broken, deploy notes recorded.
2. Free directory listings that accept a GitHub PR or a form without login or fee (Glama, PulseMCP, mcpservers.org, mcp-get, LobeHub, Cursor directory PR if it is a repo, MCP Hub lists). No paid slots. Pass: list of submissions with URLs and status.
3. Build `zip`: create and extract archives safely (zip bomb guard, path traversal guard, size caps), bundle a month of invoices and exports, list contents, pure TypeScript. Pass: tests, audit, wired, hosted, content, catalogs.
4. Round 13 through the hosted path on barcode, kanban and time-tracker with the new free caps. Pass: scored scenarios, seam fixes.
5. Instrumentation honesty: every script and agent curl to /buy must carry x-mcp-probe; kpi.mjs human-session row excludes sessions with no customer email and a curl user agent; record what remains.
Release v0.9.0 (zip) only if sources change; validation, measure, KPIs, sprint log, dashboard, memory, sound at the end.
