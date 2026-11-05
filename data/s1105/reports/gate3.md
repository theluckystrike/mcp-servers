# S1105 wave 3 truth gate (15 answer pages + 8 title/meta changes)

Score: 95 / 100

Scope. Rendered dist ~/mcp-site-2026-10-30/build-out/s1105b/site/dist (built from s1105b at fac10e7). 15 new /can-claude/ pages from content/W2-live.json (identical to the 15 entries in repo data/content/can-claude-live.json), and the title and meta of the 8 paths in content/ctr.json. Run 2026-11-05.

## What passed
- Secrets. Every token string in calls/W2 (the anon_ form, the bare 32-hex tenant form, download ids) was searched in every file under dist. 0 hits. Connector URLs show `<token>`, download links show `<download link>`.
- Example results. All 28 examples (15 pages, 13 with a second example) traced to a raw call in calls/W2 with identical args and isError unset. 24 are JSON subsets of the raw first content block with every shown value identical. 4 text results (deposit_statement_text, supplier_export, price_list_text, packing_slip) equal the raw text with only the one-hour download URL normalised.
- Math checked by hand. Ledger debits 3,708.29 = 2,400 + 1,200 + 59.99 + 48.30, cash 1,091.71 = 1,200 minus 108.29. Volumetric 60x40x40 / 5000 = 19.2 kg, / 6000 = 16.0 kg, totals 24.0 and 20.0 kg. Deposit held 1,000 minus 650 = 350. Maintenance 84.50 + 139.00 = 223.50, next due 12 Aug + 90 days = 10 Nov.
- Free vs Pro. Every free and Pro claim matches the hosted tools/list descriptions in calls/W2/*.tools.json, and the source constants where the description is silent (deposits FREE_DEPOSITS_PER_MONTH = 5, bank-statement FREE_WINDOW_MONTHS = 12, FREE_RULES = 5, FREE_RECONCILE_DAYS = 31, backlink FREE_URL_LIMIT = 3). Every Pro item in needs is labelled (Pro). Tool counts on the pages ("All N tools") match the hosted list minus licence tools, except bank-statement (10 shown, 13 hosted including the 3 upload tools), which is not a false claim.
- Native capability. Every page credits code execution on by default (Free, Pro, Max), Projects and memory, web search, and Claude Code curl or routines where they apply. No "in most apps", "never remembers" or "text only" pattern.
- Bookkeeping, month-end and reconcile. None says or implies the tool replaces an accountant, gives tax advice or files taxes. They describe a ledger derived from saved records, a trial balance and a debit-to-expense match.
- Style. 0 em/en dashes, 0 emoji, 0 exclamation marks in copy (the one "!" is the "[!]" fail mark inside the raw run_report output), 0 hype words, 0 colons or semicolons in prose fields.
- Lengths. Titles 53 to 62 chars, metas 121 to 160 chars on the 15 pages. Part (b) titles 50 to 60, metas 125 to 156.
- Part (b) truth. supplier-statement-check matches by exact entity, supplier, currency, type and reference and flags missing and differing items (src/index.ts, README). stripe_balance returns Available and Pending with STRIPE_SECRET_KEY. loan-calculator has loan_payment (payment, total interest) and loan_amortize (year by year). work-order completion_report_text is free, the PDF is Pro, so "a completion report to sign" holds on the free tier. supplier-list free tier is 10, and the meta names "Free tier, $19 Pro once". dist has 30 use-case pages. The calculators category lists Loan, Payroll, Tax Calc, Currency, Budget and Hourly Rate, and 14 of 15 are fully free. merge-pdf-in-claude body agrees with the new meta (code execution default, server for files on disk and Cursor). The repo calculators meta drops "Most are free." from the ctr.json draft, which is fine.

## Defects

0 BLOCK. 3 FIX rows on 6 pages.

| # | Sev | Page | Quote | Why | Exact fix text | File + field |
|---|-----|------|-------|-----|----------------|--------------|
| 1 | FIX | /can-claude/do-bookkeeping/, /can-claude/do-month-end-close/ | "free and unlimited" (needs[2], FAQ) | The same page says a free token allows 600 calls an hour. "Unlimited" reads as a contradiction. The real meaning is no monthly cap. | needs[2] "A trial balance proved to the cent, free with no monthly cap." FAQ "the trial balance and ledger lines are free with no monthly cap" and "trial_balance and ledger_lines are free with no monthly cap" | data/content/can-claude-live.json do-bookkeeping needs[2] + faq[2].a, do-month-end-close faq[0].a |
| 2 | FIX | /can-claude/check-backlinks/, /can-claude/check-if-a-link-is-nofollow/, /can-claude/check-if-a-page-is-noindexed/ | "Single-URL link checks and robots checks are free and unlimited" | Same as #1, and the backlink tool descriptions do not say unlimited. Only the hourly rate limit applies. | "Single-URL link checks and robots checks are free with no monthly cap" | data/content/can-claude-live.json each page faq[1].a |
| 3 | FIX | /can-claude/track-project-deliverables/ | "A report for a past date gives the same answer every time" | statusAsOf reads moves dated on or before as_of, so a move recorded later with an earlier date changes a past report. | "The as_of date on the call. A report for a past date counts only the status moves dated on or before it, and a deliverable due on that date is not late yet." | data/content/can-claude-live.json track-project-deliverables faq[0].a |

No changes needed in site/src/data/pages.json or data/content/b.json.

## Notes, not defects
- check-if-a-link-is-nofollow FAQ says "mw extlink marker" while the example shows rel="mw:extlink nofollow". The colon was dropped to keep prose colon-free, so it is left as is.
- content/W2-live.json in ~/mcp-servers still carries the pre-fix text. Regenerate from the repo or apply the same 7 edits if the generator runs again.

## Fixes applied
Commit "Wave 3 truth gate fixes" on s1105b in ~/mcp-site-2026-10-30/repo. Not pushed or deployed, no build run. 7 string edits in data/content/can-claude-live.json, indent=1, ensure_ascii=False, formatting round-trips byte for byte.

| # | Done | Where |
|---|------|-------|
| 1 | "free with no monthly cap" in 3 places | can-claude-live.json do-bookkeeping, do-month-end-close |
| 2 | "free with no monthly cap" in 3 FAQs | can-claude-live.json check-backlinks, check-if-a-link-is-nofollow, check-if-a-page-is-noindexed |
| 3 | FAQ answer as given | can-claude-live.json track-project-deliverables |
