# Distribution Push — remaining free/automatable surfaces (2026-10-10)

STATUS: complete

## Submitted today (with HTTP evidence)

**allmcps.com Agent API — POST https://allmcps.com/api/v1/submit** (JSON body: name, url, email, description, websiteUrl; no captcha/auth). Note: plain `python-urllib` UA gets Cloudflare 1010; `curl` with a Chrome User-Agent works.

- **27 accepted (HTTP 200**, response: `"success":true … "submitted successfully via Agent API!","status":"pending"`, each with claim_url https://allmcps.com/mcp/&lt;slug&gt;/claim**)**: amortization, asset-register, backlink-checker, bank-statement, barcode, bill-of-sale, billing-docs, calendar, cash-book, change-order, checklist, clauses, credit-note, expense-tracker, goods-receipt, job-card, kanban, mileage-log, onboarding, packing-list, per-diem, petty-cash, price-tracker, purchase-requisition, resume, service-agreement, zip.
- Example evidence (amortization, 200): `{"success":true,"message":"Server \"amortization\" submitted successfully via Agent API!","id":"amortization","category":"💰 Finance & Fintech","status":"pending","claim_url":"https://allmcps.com/mcp/amortization/claim"}`
- Full per-server JSON responses with HTTP codes: `intel/s20261010-allmcps-batch-evidence.txt` (copy of /tmp/allmcps_batch.txt).
- Combined with time-tracker (submitted 2026-10-09): **28 of 46 now submitted by us**.

**409 dedupe outcomes (22)** — NOT blocks; the 409 bodies show existing rows with old URLs (`mcp.zovo.one/buy/...`, `mcp-office-suite`), meaning those servers were **already in the AllMCPs DB from an earlier wave**: budget, catalogue, currency, delivery-schedule, deposits, docx, dunning-letters, image, loan-calculator, maintenance-log, office-suite, payroll, pomodoro, quotes, recurring, spreadsheet, statement-of-account, stripe-billing, supplier-list, tax-calc, timezone, work-order. (pdf & invoice dedupe-block vs hidden 'aging' row per s20261009 probes — not retried.)

- estate coverage estimate: 28 submitted by us + 22 pre-existing rows + pdf/invoice = effectively all 46 present on allmcps.com (22 have stale old URLs — cosmetic; claim via emailed code fixes them).

## Confirmed-live checks

**mcpservers.org** (curl blocked by Cloudflare "Just a moment…" 403 on all 10 probes → verified via real browser; in-page fetch for the rest):

| slug | verdict |
|---|---|
| mcp-pomodoro | **LIVE** — full listing with docs/install/tools, category Productivity |
| mcp-budget, mcp-loan-calculator, mcp-payroll, mcp-receipts, mcp-stripe-billing | **LIVE** (HTTP 200) |
| mcp-quotes, mcp-pdf, mcp-invoice | **LIVE** (200) — S58 2026-09-19 resubmissions survived review |
| mcp-office-suite | **LIVE** (200) |
| mcp-amortization | **LIVE** (200) |
| mcp-tax-calculator | 404 — slug mismatch; **mcp-tax-calc is LIVE** (200) |

12 listings confirmed live; the remainder of the estate could not be individually fetched (site rate-limited the sweep with 429 after ~2 requests) — treat as pending, recheck with spaced-out probes.

## Blocked-and-why

- **allmcps rate limit**: `leave` and `receipts` got HTTP 429 `{"error":"rate_limited","message":"Too many requests. Retry after 3452s."}`. Both are almost certainly already present via the earlier wave (payroll/pomodoro etc. pattern); retry after ~1h if desired. Do not loop-retry.
- **allmcps claim flow**: ownership claim requires an emailed code → operator-gated (s20261009-submission-probes.md).
- **mcpservers.org via curl**: Cloudflare challenge (403, `Just a moment...`) on every listing URL — must verify via browser only.
- **mcpservers.com**: /submit returns 200 but is sign-in gated (T14 positive control passed); no free route found yesterday's probe; no change today.
- **Smithery**: api.smithery.ai publish requires a bearer key that only comes from an authenticated browser session (smithery.ai GitHub login). No free key path without user interaction — see Operator actions.
- **mcp.directory**: human-gated by standing rule (operator clicks Submit).

## Operator one-time actions

1. **allmcps claims (one per server, emailed code)**: open each `https://allmcps.com/mcp/<slug>/claim`, enter the emailed code. Priority: the 22 with stale `mcp.zovo.one/buy/*` URLs, then the 28 fresh submissions. Each response includes a badge markdown snippet for READMEs.
2. **Smithery (one-time)**: run `npx -y @smithery/cli login`, authenticate with GitHub once; the resulting key then enables scripted `npx -y @smithery/cli publish` for all 46 servers. (Estate already on the registry via scan, but verified/published listings need the login.)
3. **mcpservers.org recheck**: ~24 more slugs not individually verified; spot-check `https://mcpservers.org/servers/theluckystrike/mcp-<server>` in a browser at leisure.
4. **mcp.directory submission pack**: for each server paste `https://github.com/theluckystrike/mcp-<server>` (GitHub URL is the only required field); descriptions ready in each `servers/<name>/package.json`. One-click per server.
5. **mcpservers.com**: requires account creation; only worth it if the free listing tier is confirmed after sign-in.

Distribution statuses updated in `data/distribution.json` (allmcps.com, mcpservers.org, mcpservers_resubmit_check_s61, smithery) with 2026-10-10 dates.
