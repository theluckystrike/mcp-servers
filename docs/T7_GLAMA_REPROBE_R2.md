# T7 — Glama Reprobe R2 + new-server discovery

STATUS: complete

Date probed: 2026-09-18 (Glama server count on directory page: **89,015 servers**, updated 2026-09-18 04:00)

## Result block

- **Confirmed still indexed: 12/12** of the previously-indexed repos. No server was dropped.
- **Newly indexed since prior round: 0.** None of the 6 previously-non-indexed repos (invoice, invoice-ocr, expense-tracker, cash-book, asset-register, price-tracker) is indexed. Delta vs 12/42 baseline = **0**.
- **Total theluckystrike listings on Glama: 13** — the 12 our-server listings **plus** one non-ours listing `bln-mcp-grammar-server` ("BeLikeNative Grammar Server") which is not among the 42 server dirs in `servers/`.
- **Method change (important):** the intended probe endpoint `https://glama.ai/api/mcp/v1/servers/theluckystrike/mcp-<name>` is **now auth-gated** — it returns `401 {"error":{"code":"unauthorized"}}` for BOTH positive and negative control, and requires a human-created Glama API key. The previously-public `GET /api/mcp/v0.1/servers?search=...` now 302-redirects to `glama.ai/mcp/reference` (docs). Both public API probing channels are closed since the prior round.
- **Fallback probe used (validated in T1/T6/T9):** public server page `https://glama.ai/mcp/servers/theluckystrike/mcp-<dir>` → `200` = indexed, `404` = not. Page identity confirmed via `<title>mcp-<name> by theluckystrike | Glama</title>`. Total listing count confirmed via the JS-rendered directory search page (`glama.ai/mcp/servers?search=theluckystrike`), which returned 13 theluckystrike server links.

## Server → HTTP code → indexed

Probe: `curl -s -o /dev/null -w "%{http_code}" -m 25 -A "Mozilla/5.0 ... Chrome/126" https://glama.ai/mcp/servers/theluckystrike/mcp-<dir>`

| Server dir | HTTP | Indexed |
|---|---|---|
| bill-of-sale | 200 | ✅ |
| checklist | 200 | ✅ |
| credit-note | 200 | ✅ |
| dunning-letters | 200 | ✅ |
| job-card | 200 | ✅ |
| maintenance-log | 200 | ✅ |
| mileage-log | 200 | ✅ |
| office-suite | 200 | ✅ |
| packing-list | 200 | ✅ |
| service-agreement | 200 | ✅ |
| statement-of-account | 200 | ✅ |
| supplier-list | 200 | ✅ |
| amortization | 404 | ❌ |
| asset-register | 404 | ❌ |
| bank-statement | 404 | ❌ |
| barcode | 404 | ❌ |
| billing-docs | 404 | ❌ |
| calendar | 404 | ❌ |
| cash-book | 404 | ❌ |
| catalogue | 404 | ❌ |
| change-order | 404 | ❌ |
| clauses | 404 | ❌ |
| currency | 404 | ❌ |
| delivery-schedule | 404 | ❌ |
| deposits | 404 | ❌ |
| docx | 404 | ❌ |
| expense-tracker | 404 | ❌ |
| image | 404 | ❌ |
| invoice | 404 | ❌ |
| kanban | 404 | ❌ |
| pdf | 404 | ❌ |
| per-diem | 404 | ❌ |
| petty-cash | 404 | ❌ |
| price-tracker | 404 | ❌ |
| quotes | 404 | ❌ |
| recurring | 404 | ❌ |
| resume | 404 | ❌ |
| spreadsheet | 404 | ❌ |
| time-tracker | 404 | ❌ |
| timezone | 404 | ❌ |
| work-order | 404 | ❌ |
| zip | 404 | ❌ |

Controls: negative control `mcp-doesnotexist` → 404; positive control `mcp-bill-of-sale` → 200 (312456 bytes, matches indexed size).

## Previously-non-indexed 6 (task §2)

| Repo | HTTP | Indexed now? |
|---|---|---|
| invoice | 404 | ❌ no |
| invoice-ocr | (not among 42 server dirs; no `mcp-invoice-ocr` page) | ❌ no |
| expense-tracker | 404 | ❌ no |
| cash-book | 404 | ❌ no |
| asset-register | 404 | ❌ no |
| price-tracker | 404 | ❌ no |

All 6 still not indexed. **0 new indexations.**

## Listing total count (task §3)

`glama.ai/mcp/servers?search=theluckystrike` (JS-rendered; queried via browser console) returned **13 theluckystrike server links**:

1. /mcp/servers/theluckystrike/mcp-supplier-list ✅
2. /mcp/servers/theluckystrike/mcp-bill-of-sale ✅
3. /mcp/servers/theluckystrike/mcp-credit-note ✅
4. /mcp/servers/theluckystrike/mcp-maintenance-log ✅
5. /mcp/servers/theluckystrike/mcp-mileage-log ✅
6. /mcp/servers/theluckystrike/mcp-checklist ✅
7. /mcp/servers/theluckystrike/mcp-job-card ✅
8. /mcp/servers/theluckystrike/mcp-dunning-letters ✅
9. /mcp/servers/theluckystrike/mcp-service-agreement ✅
10. /mcp/servers/theluckystrike/mcp-statement-of-account ✅
11. /mcp/servers/theluckystrike/bln-mcp-grammar-server (⚠ not one of our 42 dirs)
12. /mcp/servers/theluckystrike/mcp-packing-list ✅
13. /mcp/servers/theluckystrike/mcp-office-suite ✅

The `bln-mcp-grammar-server` listing ("BeLikeNative Grammar Server", category Language Translation/Education) is **not** among the 42 repos in `servers/` — it is a distinct project under the same Glama owner. **Delta vs 12/42 baseline: 0.** Our indexed set is unchanged (12), and the listing count of 13 includes 12 of ours + 1 non-ours.

## Secondary observation — "MCP Connectors" surface

The same search page's "Remote server search results" region listed 4 **MCP Connectors** under owner `io.github.theluckystrike`: `per-diem`, `price-tracker-drop-alert-watch`, `service-agreement`, `maintenance-log`. This is a distinct Glama index surface (connectors vs servers); those 4 server pages themselves returned 404 in the direct probe (per-diem, price-tracker are in the 404 table). No action implied; flagged for completeness.

## Evidence commands

- `curl -s -o /dev/null -w "%{http_code}" -m 25 -A "<Chrome UA>" https://glama.ai/mcp/servers/theluckystrike/mcp-<dir>` → per-row code above.
- `curl ... https://glama.ai/api/mcp/v1/servers/theluckystrike/mcp-bill-of-sale` → `401` auth-gated (API key required; human-gated, no public creds).
- `curl ... https://glama.ai/api/mcp/v0.1/servers?search=io.github.theluckystrike&limit=100` → `302` → `glama.ai/mcp/reference` (public API removed).
- `curl ... -o <file> https://glama.ai/mcp/servers/theluckystrike/mcp-bill-of-sale` then grep `<title>` → `mcp-bill-of-sale by theluckystrike | Glama`.
- Browser console on `glama.ai/mcp/servers?search=theluckystrike` → extracted 13 `/mcp/servers/theluckystrike/*` links (JS-rendered; not in static HTML).
