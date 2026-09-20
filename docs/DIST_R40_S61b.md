# DIST R40 — S61b (2026-09-20)

## Scope: verification-only session — both pending lanes checked, both still pending

## a1: mcpfinder.org — 0/11 listings live
- Method: browser. Site search + search-within filter for "theluckystrike" and "zovo" → "No results".
- Directory currently shows 45 servers total, none ours.
- S60's 11 flagship submissions (invoice, quotes, pdf, expense-tracker, time-tracker, price-tracker, spreadsheet, statement-of-account, service-agreement, bill-of-sale, credit-memo) are accepted-but-unreviewed.
- No JSON API exposed (Next.js RSC app); verification had to go through the rendered search UI.
- Recheck S63 (they claim daily reliability checks; review turnaround unknown).

## a2: mcpservers.org resubmits — still pending
- quotes + pdf listing pages: still "Not Found".
- invoice listing: LIVE, full docs page with tool tables, worked example, official-registry backlink ("In the official MCP Registry (io.github.theluckystrike/invoice-pdf-billing-generator)").
- 2-week review window from S58 (2026-09-19) → recheck ~2026-10-03.

## a3: amplification
- Skipped — no new live listings to amplify. IndexNow/social wave for existing surfaces already done in S60.

## KPI snapshot (unchanged from S61)
- Official MCP registry: 46/46 estate live.
- mcpservers.org: 5 live listings (invoice, time-tracker, price-tracker, spreadsheet, +invoice confirmed this session).
- percall: 10/10 live (cap reached).
- mcpfinder: 11 submitted / 0 live.
- npm: STILL the single biggest organic lever — blocked on user `npm login` (2 min). Every listing page ships an `npx @theluckystrike/mcp-*` block that activates the moment packages publish.

## Ledger
- data/distribution.json → surfaces.mcpfinder_check_s61 + mcpservers_resubmit_check_s61
- Dashboard S112 row
