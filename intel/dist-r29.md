# DIST R29 — 2026-09-27 (session 98)

## mcpservers.org: 16 → 58 submissions accepted (+42 this round)
Batch submissions, all "Submission Successful!" confirmed via h1 check:
amortization, asset-register, backlink-checker, bank-statement, barcode,
bill-of-sale, billing-docs, calendar, cash-book, catalogue, change-order,
checklist, clauses, credit-note, delivery-schedule, deposits, docx,
dunning-letters, goods-receipt, image, job-card, kanban, leave,
maintenance-log, mileage-log, office-suite, onboarding, packing-list, pdf,
per-diem, petty-cash, price-tracker, purchase-requisition, recurring,
resume, service-agreement, spreadsheet, statement-of-account, supplier-list,
timezone, work-order, zip

Pre-verified all 43 repo URLs via GitHub API before submitting (R28 lesson
applied) — zero dead URLs this round. mcp-invoice redirects to
mcp-invoice-generator (already listed) so skipped.

## 7 R28b servers: mcpb bundles built + packed
- npm install was hanging (network stalls, 20+ min per install) — worked
  around by installing the SDK dep set once in /tmp/npmtest2 (npm
  install with foreground-scripts) and copying node_modules into each
  bundle dir.
- Built bundles/{pomodoro,loan-calculator,receipts,budget,payroll,
  tax-calc,stripe-billing}/ with manifest.json (schema 2025-07-09,
  io.github.theluckystrike/<name>, stdio, entry index.js).
- mcpb validate: all 7 pass. mcpb pack: all 7 packed (~2.5 MB each) in
  bundles/*.mcpb.
- Smoke-tested each packed server over raw stdio JSON-RPC: tools/list
  returns the expected tool names for all 7.
- Installed mcpb CLI globally: `npm install -g @anthropic-ai/mcpb@2.1.2`
  (needed npm_config_cache=~/.npm-cache-local; default cache path was on
  a stalled volume).

## Official registry publish: BLOCKED on human step
- mcp-publisher login github = interactive device flow. Two codes issued
  (D1BF-224E, then 279A-3051) both expired without authorization.
- ~/.npmrc npm token is dead (401 on registry API) so npm-registry-type
  publish is also blocked; mcpb bundles are ready as the package payload
  once login works.
- NEXT SESSION: run `mcp-publisher login github`, user authorizes in
  browser, then `mcp-publisher publish servers/<name>/server.json` for
  the 7 new + verify old 47.

## Pitfalls
- macOS bash 5.3 `set -u`: bare `[key]=` in `declare -A` literal breaks
  ("unbound variable") — quote keys as ["key"]=.
- npx mcpb times out silently downloading the package — install it
  globally with a sane npm cache first.
- browser_console can leave the tab on about:blank after a submit;
  re-navigate before the next submission (h1 check catches this).
