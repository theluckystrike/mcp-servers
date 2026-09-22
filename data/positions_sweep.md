# positions_sweep.md — long-tail keyword + positioning sweep (R8)
DATE: 2026-09-22 | STATUS: shipped
Method: web_search SERP inspection per query cluster (who ranks: dedicated SEO pages vs GitHub lists vs directory entries). Agent self-report cross-checked; agent died at iteration cap, orchestrator re-ran searches directly.

## Ranked opportunity table (demand x winnability)
| # | Query cluster | Competition signal | Verdict |
|---|---|---|---|
| 1 | "MCP server for invoices" | mcpservers.org directory rows (QuickBooks etc.) — NO dedicated SEO page targets this phrase | WINNABLE, highest demand |
| 2 | "MCP expense tracker" | GitHub repos + LinkedIn posts only | WINNABLE |
| 3 | "MCP server PDF tools" (merge/split) | 296 servers listed on PulseMCP, but all directory rows — no one owns the phrase with a landing page | WINNABLE, medium-high demand |
| 4 | "MCP time tracking server" | WebWork + TrackingTime have REAL SEO pages (PR'd, 120-tool products). HARDEST cluster — differentiate on free/no-install | CONTESTED — winnable long-tail only |
| 5 | "MCP kanban server" | GitHub repos only (bradrisse, multidimensionalcats), no SEO pages | WINNABLE |
| 6 | "MCP docx / Word document server" | Directory rows only | WINNABLE |
| 7 | "Claude invoice generator" | AI-tool blogs; no MCP-specific page | WINNABLE |
| 8 | "MCP dunning letters / collections" | Near-zero competition (0 dedicated pages) | NICHE WIN, low volume |
| 9 | "free MCP server for freelancers" (suite play) | mcpservers.org category pages only | WINNABLE — unique angle: 47-server business suite, free, no install |

Difficulty shorthand: directory rows (mcpservers.org/pulsemcp listing pages) rank but are thin content — a real per-server page with install snippet + tool table beats them.

## Top-8 page outlines (mapped to estate servers)
1. **/s/invoice** — Title: "MCP Server for Invoices — Generate Invoices from Claude | zovo.one" / H1: "Generate & send invoices from Claude with a free MCP server" / bullets: create line-item invoices in chat, PDF output, payment tracking; free remote endpoint, no install.
2. **/s/invoice** (second angle) — Title: "Claude Invoice Generator — Free MCP Server" / bullets: natural-language invoice creation, reusable client templates, export.
3. **/s/expense-tracker** — Title: "MCP Expense Tracker — Log Expenses from Claude" / bullets: quick entry, categories, CSV export.
4. **/s/pdf** — Title: "MCP PDF Server — Merge, Split, Fill Forms" / bullets: form-preserving merge/split (vs PDF Toolkit MCP), extraction, batch ops.
5. **/s/time-tracker** — Title: "MCP Time Tracking Server — Free, No Install" / bullets: start/stop timers in chat, weekly reports, client billing; differentiator vs WebWork/TrackingTime: free tier + remote http.
6. **/s/kanban** — Title: "MCP Kanban Server — Boards from Claude" / bullets: create/move cards, columns, hosted (vs local-only GitHub repos).
7. **/s/docx** — Title: "MCP Word Document Server — Create .docx from Claude" / bullets: template-based docs, formatting, batch generation.
8. **/s/dunning-letters** — Title: "MCP Dunning Letters Server — Automated Payment Reminders" / bullets: tiered reminder sequences, PDF letters, AR follow-up.

Cross-cutting page (new): /suites/freelancer — "Free MCP Servers for Freelancers — Invoices, Time, Expenses" targeting #9; hub-links all per-server pages.

## Feed into next round
- Per-server SEO pages already exist at /s/<id> (47 live, verified 200). Update the 8 pages above with query-matched title/H1/H2 copy + FAQ blocks using these exact phrases.
- Add /suites/freelancer hub page + sitemap entries, IndexNow re-submit after edits.
- Long-tail batch 2 candidates: "MCP petty cash", "MCP purchase requisition", "MCP delivery schedule", "MCP per diem calculator" (near-zero competition, estate-native).
