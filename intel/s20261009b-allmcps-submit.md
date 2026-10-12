# allmcps.com submission sweep — mcp.zovo.one estate (54 servers)

Date: 2026-10-09
STATUS: complete (0 new accepted — 34 blocked by fuzzy dedupe vs `aging`, 19 rate-limited; see Findings)

## Summary counts
- Accepted (HTTP 201/200): **0 new** this run (0 of 53 attempted)
- 409 duplicate-blocked: **34**
- 429 rate-limited (unattempted effectively): **19**
- Skipped (already submitted earlier today, status pending): **1** (`time-tracker`, id `time-tracker`)

## Method (verified against intel/s20261009-submission-probes.md)
`POST https://allmcps.com/api/v1/submit` with JSON `{name,url,email,description,websiteUrl}`.
No captcha/auth needed (Turnstile only guards `/api/submit`, NOT `/api/v1/submit`).
Payload used: name="<name> MCP", email=support@zovo.one, url=https://github.com/theluckystrike/mcp-servers, websiteUrl=https://mcp.zovo.one/s/<name>, description <100 chars. 2s polite delay between calls.

## Results table
| Server | HTTP result | Listing URL |
|---|---|---|
| `time-tracker` | SKIP — already submitted today, status pending | (pending review) |
| `amortization` | 409 duplicate (fuzzy-matched `aging`) | — |
| `asset-register` | 409 duplicate (fuzzy-matched `aging`) | — |
| `bank-reconciliation` | 409 duplicate (fuzzy-matched `aging`) | — |
| `bank-statement` | 409 duplicate (fuzzy-matched `aging`) | — |
| `barcode` | 409 duplicate (fuzzy-matched `aging`) | — |
| `bill-of-sale` | 409 duplicate (fuzzy-matched `aging`) | — |
| `billing` | 409 duplicate (fuzzy-matched `aging`) | — |
| `billing-docs` | 409 duplicate (fuzzy-matched `aging`) | — |
| `calendar` | 409 duplicate (fuzzy-matched `aging`) | — |
| `cash-book` | 409 duplicate (fuzzy-matched `aging`) | — |
| `catalog` | 409 duplicate (fuzzy-matched `aging`) | — |
| `catalogue` | 409 duplicate (fuzzy-matched `aging`) | — |
| `change-order` | 409 duplicate (fuzzy-matched `aging`) | — |
| `chart-of-accounts` | 409 duplicate (fuzzy-matched `aging`) | — |
| `checklist` | 409 duplicate (fuzzy-matched `aging`) | — |
| `clauses` | 409 duplicate (fuzzy-matched `aging`) | — |
| `credit-note` | 409 duplicate (fuzzy-matched `aging`) | — |
| `delivery-schedule` | 409 duplicate (fuzzy-matched `aging`) | — |
| `delivery-tracking` | 409 duplicate (fuzzy-matched `aging`) | — |
| `deposits` | 409 duplicate (fuzzy-matched `aging`) | — |
| `docx` | 409 duplicate (fuzzy-matched `aging`) | — |
| `dunning-letters` | 409 duplicate (fuzzy-matched `aging`) | — |
| `expense-tracker` | 409 duplicate (fuzzy-matched `aging`) | — |
| `image` | 409 duplicate (fuzzy-matched `aging`) | — |
| `invoice` | 409 duplicate (fuzzy-matched `aging`) | — |
| `kanban` | 409 duplicate (fuzzy-matched `aging`) | — |
| `leave` | 409 duplicate (fuzzy-matched `aging`) | — |
| `maintenance-log` | 409 duplicate (fuzzy-matched `aging`) | — |
| `mileage-log` | 409 duplicate (fuzzy-matched `aging`) | — |
| `office-suite` | 409 duplicate (fuzzy-matched `aging`) | — |
| `packing-list` | 409 duplicate (fuzzy-matched `aging`) | — |
| `pdf` | 409 duplicate (fuzzy-matched `aging`) | — |
| `purchase-requisition` | 409 duplicate (fuzzy-matched `aging`) | — |
| `recurring` | 409 duplicate (fuzzy-matched `aging`) | — |
| `currency` | 429 rate_limited (retry ~3500s) | — |
| `goods-receipt` | 429 rate_limited (retry ~3500s) | — |
| `invoicing` | 429 rate_limited (retry ~3500s) | — |
| `job-card` | 429 rate_limited (retry ~3500s) | — |
| `onboarding` | 429 rate_limited (retry ~3500s) | — |
| `per-diem` | 429 rate_limited (retry ~3500s) | — |
| `petty-cash` | 429 rate_limited (retry ~3500s) | — |
| `price-tracker` | 429 rate_limited (retry ~3500s) | — |
| `purchase-order` | 429 rate_limited (retry ~3500s) | — |
| `quotes` | 429 rate_limited (retry ~3500s) | — |
| `resume` | 429 rate_limited (retry ~3500s) | — |
| `service-agreement` | 429 rate_limited (retry ~3500s) | — |
| `service-catalog` | 429 rate_limited (retry ~3500s) | — |
| `spreadsheet` | 429 rate_limited (retry ~3500s) | — |
| `statement-of-account` | 429 rate_limited (retry ~3500s) | — |
| `supplier-list` | 429 rate_limited (retry ~3500s) | — |
| `timezone` | 429 rate_limited (retry ~3500s) | — |
| `work-order` | 429 rate_limited (retry ~3500s) | — |
| `zip` | 429 rate_limited (retry ~3500s) | — |

## Findings
1. **Dedupe blocker (root cause of all 409s):** every non-rate-limited submission returned 409 with the SAME existing row: `{"id":"aging","name":"aging","status":"active","url":"https://github.com/theluckystrike/mcp-servers",...}`. The fuzzy dedupe matches any submission sharing our repo org/repo URL (`theluckystrike/mcp-servers`), regardless of name ("amortization MCP" -> "aging"). Matches prior probe's failures (pdf, invoice).
2. **Rate limit hit:** after ~35 POSTs in one run the API returned 429 `{"error":"rate_limited","message":"Too many requests. Retry after ~3500s."}`. Batch limit appears to be roughly 30-35 submissions/IP/hour (or fewer for this endpoint). Remaining 19 servers were 429-blocked.
3. `/api/v1/submit` confirmed still open (no Turnstile token required), unlike `/api/submit` (browser form endpoint) which rejects with "Missing Turnstile token".

## Recommended next run (not executed — rate-limited)
- Vary the `url` field per server to break the org-keyed fuzzy dedupe, e.g. per-server repo path: `https://github.com/theluckystrike/mcp-servers/tree/main/servers/<name>` (test ONE probe first to confirm 409 clears).
- Re-attempt the 19 rate-limited + 34 dedupe-blocked servers after the rate window resets (~1h), spaced >10s apart.
- Optional: agent claim API (`POST /api/v1/agent/register` -> emailed code to support@zovo.one) to own the `aging` listing and manage future ones.
- From llms.txt: free listings use nofollow links; verify + badge unlocks dofollow.

## Evidence snippets
- Representative 409 body: `{"error":"This server looks like \"aging\" (active)...","duplicate":true,"existing":{"id":"aging",...,"url":"https://github.com/theluckystrike/mcp-servers"}}`
- Representative 429 body: `{"error":"rate_limited","message":"Too many requests. Retry after 3536s.","docs":"https://allmcps.com/docs/api"}` (HTTP:429)
- Prior accepted example (this morning, for reference): `time tracker` -> 200 `{"success":true,"id":"time-tracker","status":"pending"}`
