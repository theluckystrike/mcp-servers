# WHITESPACE_R1 — Whitespace-query content wiring for mcp.zovo.one billing worker

STATUS: complete

## Goal
Write organic-traffic content targeting 6 whitespace buyer queries from docs/BLIND_RECOMMENDATION_R7.md:
- q6 quotes/estimates
- q10 spreadsheet-from-chat
- q14 delivery schedule / work order
- q16 no-install hosted MCP usage
- q17 small-business accounting roundup
- q18 paid MCP discovery

## Deliverables
1. Read billing/src/content.js, identify guide/mention structure (prior example: mcp-server-free-vs-pro table).
2. Append 6 hand-written content blocks in existing style, each naming relevant estate servers with /s/<name> links and hosted endpoints.
3. Add registry/map entry if content.js needs one.
4. Run billing worker tests.
5. Write RESULT in repo schema (status/evidence/artifacts/cost/failures/insight) with file:line refs and test output tail.

## Evidence
- Read billing/src/content.js (9305 lines). Guide schema: `"slug": { title, description, html, faq: [...] }`; `html` is a template literal using `${install(slug)}` (renders local + hosted URL blocks), `${FOOT}`, `${BUNDLE_USD}`, `${SINGLE_USD}`, `${LISTED_CHILD_COUNT}`, `${TOOLS[...]}`. Hosted endpoints render only for ids in HOSTED_IDS (figures.js:113-152); URL form `https://mcp.zovo.one/mcp/<name>/t/<token>` (content.js:74).
- Read docs/BLIND_RECOMMENDATION_R7.md: 6 whitespace queries confirmed (q6, q10, q14, q16, q17, q18). Estate organic appearance was 1/18 this round.
- 6 new guide blocks appended to the GUIDES object (content.js:9289-9487), one per whitespace query, each in the existing buyer-language style with /s/<name> links and `${install(...)}` hosted endpoints.
- Registry fan-in map PRODUCT_GUIDE_LINKS updated (content.js:9135-9174) so the new guides are linked from the relevant product /s pages.
- Cross-cutting guides added to GUIDE_RELATED (content.js:9209, 9273) for related-guide cross-linking.
- Tests: `npm test` (node v25.9.0, PATH=/opt/homebrew/bin, npm_config_cache=/Users/mike/.npm-cache-local) → 164 pass, 0 fail.

## Artifacts
- billing/src/content.js — 6 new guide blocks + registry entries (see file:line refs below).
- docs/WHITESPACE_R1.md — this report.

### Edits (file:line refs, billing/src/content.js)
New guide blocks (appended to GUIDES, before closing `};`):
- `quotes-and-estimates-to-invoices` (q6) — content.js:9289-9319. Links /s/quotes, /s/invoice; install(["quotes","invoice"]).
- `ask-a-spreadsheet-questions-in-chat` (q10) — content.js:9320-9352. Links /s/spreadsheet; install("spreadsheet").
- `delivery-schedule-and-work-order-from-chat` (q14) — content.js:9353-9382. Links /s/work-order, /s/delivery-schedule; install(["work-order","delivery-schedule"]).
- `use-mcp-servers-without-installing-anything` (q16) — content.js:9383-9416. Hosted route, /mcp/connect, install("quotes").
- `small-business-accounting-mcp-roundup` (q17) — content.js:9417-9453. Links /s/invoice, /s/quotes, /s/expense-tracker, /s/mileage-log, /s/petty-cash, /s/bank-statement, /s/cash-book.
- `how-to-find-and-pay-for-mcp-servers` (q18) — content.js:9454-9487. Paid discovery, Stripe, Ed25519 key, install("invoice").

PRODUCT_GUIDE_LINKS additions (fan-in map):
- spreadsheet: + "ask-a-spreadsheet-questions-in-chat" (content.js:9135)
- invoice: + "quotes-and-estimates-to-invoices" (content.js:9136)
- quotes: + "quotes-and-estimates-to-invoices" (content.js:9149)
- work-order: + "delivery-schedule-and-work-order-from-chat" (content.js:9160)
- delivery-schedule: + "delivery-schedule-and-work-order-from-chat" (content.js:9163)
- office-suite: + "small-business-accounting-mcp-roundup" (content.js:9174)

GUIDE_RELATED additions:
- "how-to-find-and-pay-for-mcp-servers" (content.js:9209)
- "use-mcp-servers-without-installing-anything" (content.js:9273)

## Cost
- 30 tool-call budget. Used ~14 calls. No deploys, no git push, no publish. No files touched outside /Users/mike/mcp-servers.

## Failures
- None. docs/BLIND_RECOMMENDATION_R7.md initially read as binary via read_file (UTF-8 text with no trailing newline); read via terminal cat instead. No functional issue.

## Insight
- The 6 whitespace queries already had partial coverage in existing guides (e.g. best-mcp-servers-for-small-business-accounting, delivery-schedule-and-work-order-documents-from-mcp). The new blocks are distinct, buyer-language answer pages that cross-link to those deeper guides and to the estate /s/<name> product pages, so each query now has a dedicated findable answer page plus fan-in from the relevant product pages via PRODUCT_GUIDE_LINKS. Hosted endpoints are rendered automatically by the shared install() helper for HOSTED_IDS, so no-install (q16) and hosted-usage answers stay consistent with the rest of the site.

## Test output tail
```
ℹ tests 164
ℹ suites 0
ℹ pass 164
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 466.594916
```
(node v25.9.0; command: `cd billing && export PATH=/opt/homebrew/bin:$PATH && export npm_config_cache=/Users/mike/.npm-cache-local && npm test`)
