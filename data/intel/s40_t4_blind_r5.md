# Blind Recommendation Test R5

STATUS: complete

Run date: 2026-09-17 · Label: R5 · Method: identical to R4 (10 neutral buyer-intent questions, re-probed with the same primary WebSearch queries; no vendor named in any query; estate visibility via site: probes against mcpservers.org and registry.modelcontextprotocol.io, plus direct browser_navigate inspection of mcpservers.org estate detail pages because curl returns 403).

## Per-question results (all neutral buyer-intent; estate never surfaced)

| # | Question | Confident answer | Recommended server(s) | Estate present |
|---|----------|------------------|------------------------|----------------|
| 1 | Petty cash / cash book ledger | No | mcp-server-ledger (minhyeoky); Light Finance & Accounting | No |
| 2 | Delivery schedule / work order doc | No | Fulcrum MCP (nearest fit, not a doc generator) | No |
| 3 | Use MCP without installing, paste a URL | No (null this run) | None surfaced by primary re-probe (Pipedream/DocsAutomator in R4 came from a 2nd query not reproduced) | No |
| 4 | Where do MCP servers cost money / how to pay | Yes | MCP.so; MCP Marketplace (mcp-marketplace.io) | No |
| 5 | Claude Desktop track expenses & mileage | Yes | Expensify MCP; ExpenseBot MCP; Expense Tracker (mcpmarket) | No |
| 6 | Claude fill a quote/estimate for a customer | Yes | InvoiceCave MCP; Zuper MCP Server | No |
| 7 | Manage a supplier / vendor list | No | None (honest null) | No |
| 8 | Generate a service agreement / contract | Yes | Docusign MCP; Scrive MCP; PandaDoc MCP | No |
| 9 | Maintenance log / equipment service history | No | None (honest null) | No |
| 10 | Mileage logbook / odometer trip log | No | None (honest null) | No |

## Estate-visibility probes (same as R4)

- `site:mcpservers.org theluckystrike` → 5 URLs now (R4 had 4): invoice, time-tracker, price-tracker, **es/price-tracker (new Spanish-locale page)**, spreadsheet.
- `site:mcpservers.org zovo mcp` → returned unrelated/noise results; no mcp.zovo.one host surfaced.
- `site:registry.modelcontextprotocol.io theluckystrike` and `... zovo` → empty for both (Official MCP Registry indexes neither).

## mcpservers.org deep-dive (browser_navigate, per R4 focus)

Direct inspection of the estate server pages that R4 listed confirms the estate HAS gained tool-table and badge presence on mcpservers.org — but as paid listing infrastructure, not organic recommendation:
- **invoice** page: full 13-tool Tools table (business_set, client_*, invoice_create, invoice_list, invoice_pdf, license_activate, etc.), Resources/Prompts, "What you can say" table, **SPONSORED** badge.
- **time-tracker** page: 14-tool Tools table (timer_start, entry_add, report, export_csv, invoice_summary, license_*), "Built by theluckystrike" link, **SPONSORED** badge.
- **spreadsheet** page: 10-tool Tools table (sheet_info, sheet_read, sheet_query, sheet_stats, sheet_find, sheet_write, sheet_add_column, sheet_convert, license_*), Resources/Prompts, **SPONSORED** badge.

## Deltas vs R4

- **Recommendation-level: NO change.** `named_ours_in_answer` = 0 of 10 (unchanged), `host_appeared_count` (mcp.zovo.one) = 0 of 10 (unchanged). The estate appears in none of the 10 neutral questions, exactly as in R4.
- **Listing-infrastructure-level: marginal deepening.** mcpservers.org estate presence grew from 4 to 5 pages (added Spanish `es/price-tracker`), and page inspection confirms each estate page carries a full Tools table + SPONSORED badge (paid catalog position). zovo remains absent from every surface.
- **Honest nulls introduced:** Q3 and Q4's R5 single-query re-probe did not independently reproduce R4's supplemental-query names (Pipedream/DocsAutomator for Q3; MCPBundles for Q4); Q3 is recorded as a true null this run, Q4 records only the two marketplaces that surfaced in the raw R5 result list. Raw candidate_hosts on both questions match R4 exactly.

## KPI

`named_ours_in_answer` = **0 / 10** — the estate (zovo, theluckystrike) is not recommended by any neutral buyer-intent surface. Organic recommendation visibility is unchanged from R4.