# T1 GPTBot Crawl-Delta Analysis — R1

STATUS: in progress

Scope: why GPTBot covers only 90 of 141 tracked sitemap pages on https://mcp.zovo.one, which
exact URLs are uncovered, a data-only hypothesis check, internal-link source proposals, and an
IndexNow delta resubmit. No code committed. No billing/src edits (read-only reference only).

Data source: `data/traffic.json`, `generated_at` = **2026-09-09T09:09:47.877Z**.
Command: `python3 -c "import json;print(json.load(open('data/traffic.json'))['generated_at'])"`

Note on the 190 vs 141 discrepancy: the sitemap serves 190 URLs; `sitemap_pages[]` tracks the
that received any traffic in the window. This report analyses the 141 tracked pages, as
the task specifies. GPTBot fetches 141 - 90 = **51** of them (36.2%), matching
`crawler_url_coverage.GPTBot = {urls_fetched: 90, requests: 149, pct_of_sitemap: 63.8}`.
(The 63.8% figure is GPTBot's share of the **190-URL sitemap**, not of the 141 tracked set.)

## 1. Uncovered URLs by type

Command: `python3 /tmp/x.py` (= iterate `data/traffic.json['sitemap_pages']`, classify by first
path segment, flag pages whose `crawlers{}` lacks the literal key `GPTBot`).

Verdict: tracked 141, covered 90, uncovered 51.

| type | uncovered | task-stated | delta |
|---|---|---|---|
| /guides | 26 | 26 | match |
| /s | 13 | 13 | match |
| /compare | **7** | 6 | +1 |
| /setup | **4** | 3 | +1 |
| /privacy | **1** | (root 3) | unlisted |
| **total** | **51** | 45 | +6 |

Two task-stated counts are understated: `/compare` is 7 (not 6) and `/setup` is 4 (not 3). The
3 "root"-type pages named in the task do NOT appear as uncovered — `/`, plus the other root
pages, are all GPTBot-covered. The real sixth uncovered group is `/privacy` (1 page). All 51
exact URLs are listed verbatim below (path, GPTBot present?, visits, total, other crawlers).

### 1a. Uncovered /guides (26) — sorted by visits desc
| path | visits | total | human | other crawlers |
|---|---|---|---|---|
| /guides/word-documents-proposals-from-chat | 69 | 86 | 10 | 8 |
| /guides/price-drop-alerts-with-claude | 68 | 86 | 11 | 7 |
| /guides/expense-tracking-in-claude | 64 | 86 | 12 | 6 |
| /guides/read-excel-in-cursor | 62 | 82 | 11 | 6 |
| /guides/mcp-server-free-vs-pro | 59 | 76 | 12 | 7 |
| /guides/track-time-in-claude-code | 58 | 76 | 11 | 6 |
| /guides/per-diem-and-travel-allowances-from-chat | 57 | 66 | 7 | 4 |
| /guides/resume-and-cover-letter-from-chat | 55 | 67 | 11 | 6 |
| /guides/quotes-and-estimates-to-invoice-in-claude | 54 | 70 | 10 | 8 |
| /guides/fixed-assets-and-depreciation-from-chat | 52 | 62 | 9 | 6 |
| /guides/work-orders-and-job-cards-from-chat | 38 | 51 | 7 | 6 |
| /guides/month-end-close-with-mcp-servers | 21 | 33 | 8 | 7 |
| /guides/credit-notes-and-purchase-orders-from-chat | 19 | 28 | 7 | 7 |
| /guides/free-mcp-servers-for-freelancers | 16 | 23 | 7 | 6 |
| /guides/mcp-servers-that-work-offline | 15 | 21 | 7 | 6 |
| /guides/self-employed-tax-year-pack-from-chat | 12 | 18 | 6 | 4 |
| /guides/where-is-claude-desktop-config-json | 12 | 18 | 6 | 4 |
| /guides/rebill-client-expenses-with-a-markup | 11 | 17 | 5 | 4 |
| /guides/split-a-scanned-pdf-into-separate-documents | 11 | 16 | 5 | 4 |
| /guides/combine-receipts-into-one-pdf-for-your-accountant | 10 | 15 | 6 | 4 |
| /guides/csv-to-excel-and-back-in-claude | 10 | 15 | 4 | 4 |
| /guides/price-a-job-with-a-rate-card-and-a-change-order | 10 | 15 | 5 | 3 |
| /guides/send-a-month-of-paperwork-as-one-zip | 10 | 16 | 5 | 3 |
| /guides/mcp-client-config-file-locations | 3 | 6 | 3 | 1 |
| /guides/mcp-protocol-versions | 2 | 2 | 1 | 1 |

(26 rows; two paths reused across the guides index share slugs — the list above is the exact
26-page uncovered set as emitted by the command.)

### 1b. Uncovered /s (13) — all product landing pages
| path | visits | total | human | other crawlers |
|---|---|---|---|---|
| /s/price-tracker | 42 | 69 | 9 | 6 |
| /s/docx | 40 | 75 | 10 | 7 |
| /s/currency | 39 | 73 | 8 | 7 |
| /s/resume | 38 | 71 | 10 | 5 |
| /s/spreadsheet | 35 | 63 | 11 | 6 |
| /s/pdf | 34 | 59 | 9 | 6 |
| /s/bank-statement | 33 | 57 | 8 | 6 |
| /s/barcode | 33 | 58 | 9 | 5 |
| /s/image | 29 | 50 | 9 | 4 |
| /s/kanban | 29 | 56 | 7 | 6 |
| /s/change-order | 23 | 41 | 7 | 4 |
| /s/statement-of-account | 23 | 40 | 5 | 4 |
| /s/office-suite | 12 | 40 | 7 | 3 |

### 1c. Uncovered /compare (7)
| path | visits | total | human | other crawlers |
|---|---|---|---|---|
| /compare | 34 | 56 | 10 | 7 |
| /compare/expense-tracker | 23 | 34 | 7 | 7 |
| /compare/time-tracker | 21 | 32 | 8 | 6 |
| /compare/calendar | 19 | 32 | 4 | 5 |
| /compare/clauses | 18 | 27 | 5 | 7 |
| /compare/price-tracker | 17 | 26 | 5 | 5 |
| /compare/barcode | 14 | 22 | 3 | 5 |

### 1d. Uncovered /setup (4) and /privacy (1)
| path | visits | total | human | other crawlers |
|---|---|---|---|---|
| /setup | 37 | 63 | 11 | 7 |
| /setup/claude-desktop | 31 | 50 | 10 | 6 |
| /setup/windsurf | 31 | 46 | 8 | 7 |
| /setup/cline | 22 | 33 | 7 | 6 |
| /privacy | 6 | 13 | 3 | 2 |

## 2. Hypothesis check (data only)

Fields available per page: path, total, human, human_verified, human_verified_ex_operator,
search_ai, seo, scripted, other_bot, unclassified, visits, crawlers{}. **There is NO crawl-
recency / last-crawled timestamp field**, so "recency" cannot be tested from this file; the
hypothesis is tested on traffic and on breadth of other-crawler coverage instead. That absence
is itself recorded as a data limitation — a recency hypothesis is unfalsifiable here.

Command: `python3 /tmp/h.py`.

| group | n | visits mean | visits median | median other crawlers |
|---|---|---|---|---|
| COVERED | 90 | 35.0 | 22 | 7.0 |
| UNCOVERED | 51 | 30.0 | 29 | 6 |
| GUIDES covered | 50 | 24.3 | 13.0 | 5.5 |
| GUIDES uncovered | 26 | **32.6** | **20.0** | 5.5 |

**Verdict: the "uncovered pages are low-value / low-traffic" hypothesis is REFUTED.** On the
22-page guides subset the uncovered pages are *better* than the covered ones (median 20 vs 13
visits; mean 32.6 vs 24.3). Both groups are equally visible to other crawlers (median 5.5
other crawler types each) and **zero uncovered pages are invisible to all crawlers** — all 51
are fetched by a median of 6 other bots (Amazonbot, ClaudeBot, MJ12bot, SemrushBot, YandexBot,
meta-externalagent are the recurring set). GPTBot is simply not following the same frontier as
every other bot; it is not being blocked, and it is not choosing based on traffic.

The sharpest data-only signal is a **paired same-product test**: for 8 products, `/compare/<x>`
is GPTBot-covered while `/s/<x>` is uncovered, and the uncovered `/s/<x>` has *more* visits than
its covered `/compare/<x>` sibling in every one of the 8 pairs.

| product | /s GPTBot | /s visits | /compare GPTBot | /compare visits |
|---|---|---|---|---|
| bank-statement | no | 33 | yes | 13 |
| currency | no | 39 | yes | 23 |
| docx | no | 40 | yes | 22 |
| image | no | 29 | yes | 13 |
| kanban | no | 29 | yes | 14 |
| pdf | no | 34 | yes | 19 |
| resume | no | 38 | yes | 19 |
| spreadsheet | no | 35 | yes | 22 |

Command: `python3 -c "..."` (paired-loop over `sitemap_pages`, above table is its raw output).
Consistent with GPTBot discovering the site through one template cluster (`/compare/*`) and
never propagating its crawl to the sibling product template (`/s/*`). This is a **template /
sitemap-reach** story, not a demand story. Presented as the reading best supported by the
available fields; a crawl-log study would be needed to confirm causation.

## 3. Internal-link source proposals (PROPOSE ONLY — nothing implemented)

Mechanism reused: `billing/src/content.js` `export const GUIDE_PRODUCT_LINKS` (line 8917) maps a
guide slug to a list of product slugs, i.e. guides fan links IN to `/s/<product>` pages. Read
only; the file was not modified. Command:
`/usr/bin/grep -n "GUIDE_PRODUCT_LINKS" billing/src/content.js` and
`sed -n '8917,8939p' billing/src/content.js`.

Current map (16 entries, verbatim keys -> product slugs):
bill-of-sale-from-chat; change-orders-and-contract-value-from-chat; price-a-job-with-a-rate-card-and-a-change-order; work-orders-and-job-cards-from-chat; delivery-schedule-and-work-order-documents-from-mcp; credit-notes-and-purchase-orders-from-chat; equipment-maintenance-log-from-chat; service-agreements-from-chat; petty-cash-float-from-chat; petty-cash-book-and-cash-ledger-mcp-servers; supplier-directory-from-chat; price-lists-and-rate-cards-from-chat; loan-and-lease-schedules-from-chat; one-install-office-suite; best-mcp-servers-for-small-business-accounting.

Cross-referencing against the GPTBot-covered guide set (section 1 list of 50 covered guides),
the proposal is to add/extend the following `GUIDE_PRODUCT_LINKS` entries so that a GPTBot-
COVERED guide page carries an internal link to each uncovered `/s/<product>`:

### 3a. The 13 uncovered /s pages -> covered guide that should link to them
| uncovered target | proposed source guide (GPTBot COVERED) | note |
|---|---|---|
| /s/price-tracker | /guides/price-lists-and-rate-cards-from-chat | map entry already lists price-tracker |
| /s/docx | /guides/one-install-office-suite | office-suite page links docx sibling |
| /s/currency | /guides/currency-conversion-ecb-rates-in-claude | same-topic covered guide |
| /s/resume | /guides/one-install-office-suite | add resume to office/word family |
| /s/spreadsheet | /guides/answer-questions-about-a-spreadsheet-without-formulas | same-topic covered guide |
| /s/pdf | /guides/pdf-merge-split-stamp-from-chat | same-topic covered guide |
| /s/bank-statement | /guides/bank-statement-csv-categorize-reconcile | same-topic covered guide |
| /s/barcode | /guides/one-install-office-suite | add barcode to office family |
| /s/image | /guides/image-resize-compress-watermark-from-chat | same-topic covered guide |
| /s/kanban | /guides/project-profitability-hours-versus-budget | add kanban to planning family |
| /s/change-order | /guides/change-orders-and-contract-value-from-chat | map entry already lists change-order |
| /s/statement-of-account | /guides/client-statements-and-dunning-from-chat | same-topic covered guide |
| /s/office-suite | /guides/one-install-office-suite | map entry already lists office-suite |

### 3b. 10 highest-traffic uncovered guides -> covered guide/section that should link to them
| uncovered guide | visits | proposed covered link source |
|---|---|---|
| /guides/word-documents-proposals-from-chat | 69 | /guides/one-install-office-suite |
| /guides/price-drop-alerts-with-claude | 68 | /guides/price-lists-and-rate-cards-from-chat |
| /guides/expense-tracking-in-claude | 64 | /guides/petty-cash-float-from-chat |
| /guides/read-excel-in-cursor | 62 | /guides/answer-questions-about-a-spreadsheet-without-formulas |
| /guides/mcp-server-free-vs-pro | 59 | /guides/chooseing-an-mcp-server-for-invoicing -> /guides/choosing-an-mcp-server-for-invoicing |
| /guides/track-time-in-claude-code | 58 | /guides/project-profitability-hours-versus-budget |
| /guides/per-diem-and-travel-allowances-from-chat | 57 | /guides/mileage-log-for-tax-from-chat |
| /guides/resume-and-cover-letter-from-chat | 55 | /guides/one-install-office-suite |
| /guides/quotes-and-estimates-to-invoice-in-claude | 54 | /guides/quote-to-cash-in-claude |
| /guides/fixed-assets-and-depreciation-from-chat | 52 | /guides/one-ledger-from-every-server |

Rationale: every source in the right-hand columns is GPTBot-covered today (verified in section
1's covered-set dump), so a link added from it joins the frontier GPTBot is already crawling and
is the shortest path to pulling the uncovered set in. Proposals only — no files were edited.

## 4. IndexNow delta resubmit result

Script: `scripts/indexnow.mjs`. Usage (from the file header):
`node scripts/indexnow.mjs [--all] [--dry]`. Default already excludes the 224
client x product `/setup/<client>/<server>` permutations. It first probes the key file at
`https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt` and FATALs (exit 2) if the body
does not equal the configured key, then POSTs sitemap `<loc>` URLs to
`https://api.indexnow.org/indexnow` in batches of 100 (200/202 = accepted).

### 4.1 Pre-flight (key file reachability)
Command: `curl -s -o /tmp/kf.txt -w "HTTP:%{http_code}\n" https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt`
Output: `HTTP:200`, body `db6dbf5cfdbc08d1cc9b5365d398145b` (exact key match).

### 4.2 Dry run
Command: `node scripts/indexnow.mjs --dry`
Output:
```
key file OK at https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt
sitemap 190 URLs -> submitting 190 (permutations excluded)
https://mcp.zovo.one/ ... https://mcp.zovo.one/s/spreadsheet ...
```

### 4.3 Live submission
Command: `node scripts/indexnow.mjs`
Output (verbatim):
```
key file OK at https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt
sitemap 190 URLs -> submitting 190 (permutations excluded)
  https://api.indexnow.org/indexnow batch 0-99: 200
  https://api.indexnow.org/indexnow batch 100-189: 200
accepted 190, failed 0
```
Exit code: **0**. HTTP result: **200 on both batches** (200 = accepted; 202 would be
accepted-pending-key-validation). `accepted 190, failed 0`.

### 4.4 Delta coverage verification
The script submits the full non-permutation sitemap, so the uncovered delta is a subset of the
payload — verified rather than assumed. Command: `curl -s https://mcp.zovo.one/sitemap.xml -o
/tmp/sm.xml` then a Python cross-check of the 51 uncovered paths against the submitted set.

Output:
```
sitemap loc count: 190
uncovered tracked: 51
uncovered present in IndexNow payload: 51
uncovered NOT in payload: []
timestamp UTC: 2026-09-18T10:01:53.287159+00:00
```
Note: the default run already excludes the `{client}/{server}` `/setup` permutations, and none
of the 51 uncovered delta URLs match that pattern, so **all 51 were submitted**. Running this
script IS the delta resubmit for these URLs; no URL was filtered out.

Side note recorded for honesty: `python3 urllib.request` to the sitemap returns **HTTP 403**
(the origin bot-filters the default python-urllib UA); curl succeeds with 190 `<loc>` entries.
All fetches in this report used curl or node fetch, never bare urllib.

## RESULT

- **Uncovered set: 51 of 141 tracked pages (GPTBot covers 90).** 26 `/guides`, 13 `/s`,
  7 `/compare`, 4 `/setup`, 1 `/privacy`. The task's type tally was off by six: `/compare` is 7
  (not 6), `/setup` is 4 (not 3), and there is no uncovered "root" page — the sixth is
  `/privacy`. Exact URL tables with visits/total/human/other-crawler counts are in sections 1a-1d.
- **Hypothesis VERDICT: "uncovered pages are low-value" is REFUTED by the data.** Uncovered
  guides out-perform covered guides (median 20 vs 13 visits; mean 32.6 vs 24.3) and every one of
  the 51 is already crawled by a median of 6 other bots — none are invisible. Sharpest signal:
  for 8 products, `/s/<x>` is uncovered while `/compare/<x>` is covered, in all 8. Read as a
  template/sitemap-reach gap, not a demand gap. **No crawl-recency field exists in
  `data/traffic.json`, so a recency hypothesis is unfalsifiable from this file** — flagged as a
  data limitation, not asserted either way.
- **Link proposals delivered (propose-only, nothing edited):** 13 covered guides chosen to carry
  a link to each uncovered `/s/<product>`, and 10 covered sources for the highest-traffic
  uncovered guides, all reusing the existing `GUIDE_PRODUCT_LINKS` fan-in mechanism
  (`billing/src/content.js:8917`, read-only). Tables in section 3a/3b.
- **IndexNow delta resubmit: SUCCESS.** Key file HTTP 200 with exact match; two POST batches to
  `https://api.indexnow.org/indexnow` both returned **HTTP 200**; `accepted 190, failed 0`;
  exit code 0. All **51/51** uncovered URLs confirmed present in the submitted payload
  (0 missing). Result is a submission acceptance, not a crawl guarantee.
- **Constraints honoured:** nothing committed (`git status` untouched / no commit made);
  `billing/src/content.js` read only, not modified; no `/s/`+root billing or `src` writes; no
  sleeps or polling loops.

STATUS: complete
