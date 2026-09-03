# COMPARE - head-to-head pages for "X vs Y" and "alternatives" queries

Shipped 2026-09-03. Six pages: /compare plus one per server. Every competitor fact below was read
from that project's own public README, its GitHub repository metadata, its npm registry record or its
official MCP registry entry on 2026-09-03. No paid API was called. Where a fact is not published, the
row says so rather than guessing.

## URLs

| URL | Status | Bytes |
|---|---|---|
| https://mcp.zovo.one/compare | 200 | 4,362 |
| https://mcp.zovo.one/compare/time-tracker | 200 | 11,517 |
| https://mcp.zovo.one/compare/price-tracker | 200 | 10,952 |
| https://mcp.zovo.one/compare/spreadsheet | 200 | 11,259 |
| https://mcp.zovo.one/compare/invoice | 200 | 11,307 |
| https://mcp.zovo.one/compare/expense-tracker | 200 | 11,376 |

## Competitor fact table

### time-tracker

| Fact | clockify-mcp | timesheet-mcp |
|---|---|---|
| Source | https://github.com/tracegazer/clockify-mcp | https://github.com/timesheetIO/timesheet-mcp |
| Registry entry | io.github.tracegazer/clockify-mcp | io.github.timesheetIO/timesheet-mcp |
| Tools | 112 across 18 domains; 48 read-only by default, 64 writes behind CLOCKIFY_ACCESS_MODE=full | 18 (6 timer, 3 task enhancement, 4 project, 4 task, 1 auth) |
| Transport | stdio (pip, uvx, Docker, .mcpb bundle) | stdio (npx) |
| Licence | MIT | MIT |
| Pricing | server free; README states time off, holidays, expenses, approvals, custom fields, scheduling, invoice and webhook tools return 402/403/404 on Clockify plans without those add-ons | server free; needs a timesheet.io account and API token |
| Last release | v0.3.2, 2026-06-09 (GitHub); last push 2026-07-20 | npm @timesheet/mcp 1.2.0, 2026-06-13; GitHub v1.1.0 2026-02-07; last push 2026-08-18 |
| Stores data locally | No, Clockify workspace | No, timesheet.io account |
| Key required | CLOCKIFY_API_KEY | TIMESHEET_API_TOKEN |
| Has that we lack | approvals, time off and balances, holidays, scheduling assignments, custom fields, webhooks, shared reports, PDF/CSV/XLSX report export, team users and groups, .mcpb one-click bundle, Docker image | pause and resume a running task, notes and expenses attached to the running task, mobile app parity |
| We have that they lack | no account or key, offline operation, local JSON storage, one-time $19 licence rather than a service subscription | same, plus CSV export to a local file |
| npm/PyPI | pypi clockify-mcp | npm @timesheet/mcp |

### price-tracker

| Fact | keepa-mcp | pricetrack-mcp |
|---|---|---|
| Source | https://github.com/purahmanian/keepa-mcp | https://github.com/PriceTrack-dev/pricetrack-mcp |
| Registry entry | io.github.purahmanian/keepa-mcp | dev.pricetrack/pricetrack |
| Tools | 6 (get_product, get_price_history, get_sales_rank_history, search_products, get_best_sellers, get_deals) | 4 public (search_products, get_product, recent_price_changes, compare_products); more behind OAuth on the hosted endpoint |
| Transport | stdio (npx) | hosted streamable HTTP at https://pricetrack.dev/api/mcp, no auth; stdio via npx @pricetrack/mcp |
| Licence | MIT | MIT |
| Pricing | server free; requires a Keepa API key from keepa.com | server free; public catalogue tools need no account |
| Last release | npm keepa-mcp 0.1.2, 2026-08-09; no GitHub releases | npm @pricetrack/mcp 0.1.0, 2026-08-18; no GitHub releases |
| Stores data locally | No, queries Keepa per call | No, PriceTrack servers |
| Key required | KEEPA_API_KEY | No for public tools |
| Has that we lack | decoded Amazon price time series, sales rank history with demand trend, ASIN keyword search, category best sellers, deals feed filtered by drop percent and rating | catalogue of 33,000+ SaaS products (README claim), verified vendor price-change history, 30-day biggest movers, 2-5 product comparison |
| We have that they lack | arbitrary shop-page URLs outside any catalogue, user-set target price alerts per watch, local history, no third party sees the watch list, works with no account | same |
| Note | README states it is unofficial and not affiliated with Keepa GmbH | README documents that account tools sit behind OAuth |

### spreadsheet

| Fact | agent-spreadsheet | mcp-server-spreadsheet |
|---|---|---|
| Source | https://github.com/PSU3D0/agent-spreadsheet | https://github.com/marekrost/mcp-server-spreadsheet |
| Registry entry | io.github.PSU3D0/agent-spreadsheet and io.github.PSU3D0/spreadsheet-mcp | io.github.marekrost/mcp-server-spreadsheet |
| Tools | 27 operations baseline (17 read/discovery, 10 write/lifecycle); up to 31 with screenshot_sheet, sheetport_manifest, execute_sheetport, inspect_vba | 25 (3 workbook, 5 sheet, 4 read, 7 write, 2 column, 1 search, 3 SQL) |
| Transport | stdio and HTTP (default bind 127.0.0.1:8079, plus a canonical /v1 route) | stdio (uvx) |
| Licence | Apache-2.0 | MIT |
| Pricing | free, open source | free, open source |
| Last release | v0.15.0, 2026-09-02; npm agent-spreadsheet 0.15.0 same day | v0.3.3, 2026-08-11 |
| Stores data locally | Yes, your own workbook files | Yes, your own workbook files |
| Stars | 54 | 2 |
| Has that we lack | formula recalculation (Formualizer or LibreOffice), xlsm/xls/xlsb, sheet screenshots, VBA introspection, revision ids with compare-and-swap, region and table detection, template row cloning, HTTP transport | DuckDB SQL over sheets with JOINs and subqueries, SQL writes back to the file, .ods, cell and range level ops, sheet add/rename/delete/copy, insert and delete rows and columns |
| We have that they lack | no runtime beyond Node and no native dependencies, so npx works on an unprepared machine; a single group-by query tool sized for exports | same |
| Runtime | Rust binary | Python 3.10+ |

### invoice

| Fact | einvoice-mcp | IMW Invoice |
|---|---|---|
| Source | https://github.com/makririch/einvoice-mcp | https://www.independent.management/ai (registry entry only) |
| Registry entry | io.github.makririch/einvoice | management.independent/imw-invoice |
| Tools | 4 (create_xrechnung, validate_invoice, extract_data, get_format_info) | not published in the registry entry |
| Transport | stdio (npm global install einvoice-mcp) | hosted streamable HTTP at https://invoice.independent.management/mcp |
| Licence | MIT per npm record; GitHub reports no licence file | not stated in the registry entry |
| Pricing | free; README states no API keys and no external services | not stated in the registry entry |
| Last release | npm einvoice-mcp 0.1.5, 2026-04-13; last push 2026-04-13 | registry version 1.4.0, published 2026-09-01 (isLatest) |
| Stores data locally | Yes, no external services per README | No, provider's servers |
| Has that we lack | XRechnung UBL 2.1 generation, EN 16931 and XRechnung 3.0.2 conformance, BR-DE business rule validation, UBL and CII extraction, format reference | invoicing, time tracking and billing in one hosted account; nothing to install; no repository published, so tools, licence and pricing are unverifiable |
| We have that they lack | numbered A4 PDF render, never-reused INV-YYYY-NNNN numbering under a file lock, integer minor-unit money, client ledger, overdue report, invoice_from_hours bridge from the time tracker, local storage with no account |  |

### expense-tracker

| Fact | Expense Budget Tracker | Expense (Labnotes) |
|---|---|---|
| Source | https://github.com/kirill-markin/expense-budget-tracker | https://github.com/assaf/expense |
| Registry entry | com.expense-budget-tracker/expense-budget-tracker | not found in the official registry search for "expense" |
| Tools | 4 (list_workspaces, get_schema, sql_query, sql_execute) | not enumerated in the README; five workflows listed (receipt upload, mileage, spending questions, reports, reconciliation) |
| Transport | hosted streamable HTTP at https://mcp.expense-budget-tracker.com/mcp, OAuth 2.1 authorization code + PKCE with Dynamic Client Registration | hosted HTTP at https://expense.labnotes.org/mcp, OAuth 2.1 authorization code + PKCE |
| Licence | MIT | none stated on the repository |
| Pricing | open source, self-hostable with Docker + Postgres; hosted service also offered | hosted service; pricing not stated in the README |
| Last release | v1.3.0, 2026-08-23; last push 2026-09-02 | no GitHub releases; last push 2026-09-02 |
| Stores data locally | Only if you self-host the Postgres deployment | No |
| Stars | 30 | 4 |
| Has that we lack | budgets, balances, transfers between accounts, multi-currency reporting, web UI, restricted SQL surface for agents (sql_query and sql_execute), scope-gated writes, agents parsing screenshots/CSV/PDF bank statements into rows | receipt OCR and extraction, receipts forwarded by email and filed automatically, merchant-history categorisation, mapped mileage routes priced at the IRS rate, report PDFs with receipt images attached, bank statement reconciliation |
| We have that they lack | no account and no database, local JSON storage, offline operation, expense_to_invoice with Pro markup feeding the invoice server, category rules, per-km or per-mile mileage rates, xlsx export | same |

## Our measured numbers used on the pages

| Number | Source |
|---|---|
| Feature tools: time-tracker 11, price-tracker 8, spreadsheet 8, invoice 10, expense-tracker 12, plus license_status and license_activate on each | grep of registerTool over servers/*/src, cross-checked against data/tools.json |
| Tests passing: time-tracker 7, price-tracker 39, spreadsheet 39, invoice 23, expense-tracker 36 (144 total) | node --test output, docs/USER_VALUE_R5.md verbatim summaries plus a fresh `npm test` in servers/price-tracker |
| Probe suite 121 of 121 | scripts/validate.mjs, docs/USER_VALUE_R5.md |
| User value round 5: 26 of 30 over 10 fresh scenarios; time-tracker 9/9, expense-tracker 6/6, price-tracker 3/3, spreadsheet 4/6, invoice 1/3 | data/user_value_r5.json totals |
| Spreadsheet defects published on the page: 245 of 250 VAT cells over 2 decimals, 5 of 250 amount cells written as strings | data/user_value_r5.json verification |
| Invoice arithmetic 12 x 90 EUR + 300 EUR at 23% VAT = 1,697.40 EUR | earlier audit, also stated in the invoice guide |

## Verification after deploy

```
200 /compare                    4,362 B
200 /compare/time-tracker      11,517 B
200 /compare/price-tracker     10,952 B
200 /compare/spreadsheet       11,259 B
200 /compare/invoice           11,307 B
200 /compare/expense-tracker   11,376 B
sitemap.xml: 62 <loc> entries, 6 of them /compare
llms.txt: comparisons section present, 6 compare links
/s/invoice: contains href="/compare/invoice"
quality grep (em dash, en dash, emoji, 13 hype words): 0 files matched
canonical: 1 per page; FAQPage JSON-LD: 1 per server page (index has none by design)
meta description length: 138 to 153 chars, all under 155
IndexNow: HTTP 200, 8 URLs submitted
```

## RESULT.md block

```
status: DONE
evidence:
  wrangler deploy -> Version ID 17963a63-cbd5-40d0-85fb-eb34849c7fce
  curl 6/6 compare URLs -> 200
  curl sitemap.xml -> 62 loc entries, 6 /compare
  curl llms.txt -> comparisons section, 6 links
  curl /s/invoice | grep href="/compare/invoice" -> match
  quality grep over 6 fetched pages -> 0 hits
  IndexNow POST api.indexnow.org/indexnow -> 200
artifacts:
  billing/src/compare.js (new, 5 comparison pages + index metadata)
  billing/src/index.js (routes /compare and /compare/<slug>, sitemap, llms.txt, /s/<id> link)
  docs/COMPARE_RESULT.md
  data/distribution.json (guides note)
cost: 38 wall minutes
failures:
  two meta descriptions came out at 159 and 160 chars on the first draft and were rewritten under 155
  before deploy; junter1989k-ai/poland-invoice-mcp and toggl/toggl-mcp return 404 on the GitHub API
  despite being named in registry entries, so neither was used as a competitor
insight:
  Of the ten closest competitors, seven keep the user's data on someone else's server, and the three
  local ones are all in the spreadsheet category. The registry search axis rewards the hosted product
  shape, so "your data never leaves the machine" is not a differentiator we chose; it is the only
  axis left unoccupied in four of the five categories.
```
