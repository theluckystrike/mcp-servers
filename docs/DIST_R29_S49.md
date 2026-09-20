# DIST R29 — S49 (2026-09-20, session 99, in-process)

## A. /llms-full.txt 500 → 200 (P0 fix)
Root cause: inner route code called undefined `handler(...)` inside the billing worker module → uncaught throw → 500 on prod only.
Fix: `const worker = { async fetch(...) { const handler = worker.fetch; ... } }` wrapper in billing/src/index.js; llms/llms-full routes unaffected elsewhere.
Also restated `export const VALIDATION` to the real run-50 numbers (at 2026-09-20, medianMs 514) — old `at: 2026-09-19` tripped a billing test.
Verification: 163/163 billing tests pass → `npx wrangler deploy` → live `llms-full.txt 200`, `llms.txt 200`, `/s/leave 200`.
Commit: "S49 fix: /llms-full.txt 500 -> 200 ...". IndexNow re-run after deploy.

## B. llmstxt.site resubmission (now with llms-full.txt)
Form re-submitted with llms.txt + llms-full.txt both present; DOM confirmed "Thank You!".
Description noted the resubmission and the 500→200 fix explicitly.

## C. llms-txt-hub PR verified
PR #1677 on thedaviddias/llms-txt-hub by theluckystrike is OPEN (gh pr list verified). No further action needed; awaiting maintainer merge.

## D. mcpservers.org — 9 new submissions, ALL accepted ("Submission Successful!" DOM-verified each)
| Server | Category | URL |
|---|---|---|
| Spreadsheet | Productivity | /s/spreadsheet |
| Docx | Productivity | /s/docx |
| Pdf | Productivity | /s/pdf |
| Calendar | Productivity | /s/calendar |
| Expense Tracker | Finance | /s/expense-tracker |
| Time Tracker | Productivity | /s/time-tracker |
| Quotes | Finance | /s/quotes |
| Kanban | Productivity | /s/kanban |
| Resume | Productivity | /s/resume |

Running total: 12 of ~46 estate servers listed on mcpservers.org free tier (invoicing, leave from S48 + these 9 + 1 prior).
Submit mechanics: click submit button then poll h1 for "Submission Successful!" (async render, first read often stale).

## Next (S50 candidates)
1. Continue mcpservers.org batches (~34 remaining) — mechanical, could be scripted via same form automation.
2. llms-txt-hub PR #1677 follow-up / merge watch.
3. Monitor impressions/referrers for the 12 listed servers; measure whether listings move bot coverage KPIs.

## E. percall.dev / AI Product Index verification (post-sprint)
- percall.dev product listings: 56 indexed, query zovo → 0 (we are NOT in the product registry — registration is via GitHub issue [register] on 110kc3/seo, max 10/account).
- BUT the MCP catalog (normalized from official MCP registry) DOES mirror us: 30 zovo endpoints, e.g. mcp.zovo.one/mcp/amortization … calendar, cash-book etc. So 30+ estate servers are agent-discoverable there already, automatically.
- llms.txt of index: 200, well-documented API. No manual submission needed for MCP catalog; optional win: register up to 10 product listings via 110kc3/seo issue form.

Verdict: percall auto-mirror claim = TRUE for MCP catalog (30 servers), FALSE for product listings (0).

## F. directory.llmstxt.cloud submission (T25 residual)
Filled form (Zovo MCP Servers, mcp.zovo.one, Developer tools, hello@zovo.one, Standard free tier) → server response: "You recently submitted this website." → the estate was ALREADY submitted to this directory (prior sprint, likely R10).
Conclusion: no duplicate submission needed. All three llms.txt surfaces accounted for: llmstxt.site (resubmitted, accepted), llms-txt-hub (PR #1677 open), directory.llmstxt.cloud (already in queue).
