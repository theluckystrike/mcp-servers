# INTEL_R6 -- registry re-probe, Search Console, next-server ranking, PR/issue status

Measured 2026-09-04. Cap: 30 wall minutes, zero paid APIs, read-only on everything
except this file and `data/intel_r6.json`.

## 1. Registry re-probe

Method: one bounded `GET registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100`
per token, 20s timeout, first page only (same style as R5). `capped` = page full (100) with
`metadata.nextCursor` present.

### 16 servers' primary tokens

| token | count | capped | our rank (page 1) |
|---|---|---|---|
| bank | 100 | yes | none |
| calendar | 94 | no | 71 |
| clause | 6 | no | 3 |
| currency | 23 | no | 14 |
| docx | 35 | no | 21 |
| expense | 39 | no | 15 |
| image | 100 | yes | none |
| invoice | 100 | yes | 82 |
| kanban | 5 | no | none |
| pdf | 100 | yes | none |
| price | 100 | yes | 98 |
| recurring | 4 | no | 1 |
| resume | 21 | no | 16 |
| spreadsheet | 28 | no | 13 |
| time | 100 | yes | none |
| timezone | 19 | no | 13 |

Page-1 match rate: **11 of 16 (68.75%)**. Weighted findable share (p = min(1,10/rank),
0 if unmatched, mean over the 16 slots, same formula `data/organic.json` uses): **0.393
(39.3%)**.

### Registry-existence check on the three unmatched-everywhere servers

`bank`, `image` and `kanban` came back with **zero** page-1 matches not just on their own
primary token but on every related token tried (see table below). A full-name probe
(`search=theluckystrike/<slug>`) plus a two-page listing of `search=theluckystrike`
(135 rows across all versions, 32 unique current names) confirms these three are **not
registered in the registry under any name or version** -- this is not a crowded-token
miss like `pdf` and `time` (both confirmed present elsewhere in the full listing, just
outside the top 100 for their own generic token).

| server | primary token | related tokens tried, all 0 matches | registered at all? |
|---|---|---|---|
| bank-statement | bank (100+, capped) | statement(23), transactions(7), budget(47), reconcile(4) | **NO** |
| image | image (100+, capped) | resize(3), compress(14), watermark(27), thumbnail(2) | **NO** |
| kanban | kanban (5, not capped) | board(100+, capped), tasks(55) | **NO** |

`csv` was the one hit in this new-token batch: rank 18 of 31, credited to the
spreadsheet server (`excel-spreadsheet-xlsx-csv`), not to bank-statement.

Combined match rate across the 16 primary + 11 kanban/image/bank-statement new tokens:
**12 of 27 (44.4%)**.

Interpretation: `servers/bank-statement`, `servers/image`, `servers/kanban` are all at
v0.6.0 locally with complete `server.json` files, but none has reached
`mcp-publisher publish` yet -- consistent with other agents' concurrent v0.6.0
release work visible in `git status` (in-flight `bundles/` changes) at probe time.

## 2. Search Console -- mcp.zovo.one

Service account `zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com`,
`sc-domain:zovo.one`, scope `webmasters.readonly` (same property as `docs/GSC_RESULT.md`).

**Pages indexed vs submitted:** GSC's `sitemaps.list` last recorded a submission on
2026-09-03T08:42:41Z with **129 submitted, 0 indexed**. The live sitemap now serves
**179 URLs** (measured this session) -- 50 pages have been added since the last GSC
submission and have not been resubmitted. Every sitemap on the whole `sc-domain:zovo.one`
property (including the 714-URL zovo.one root index) reports `indexed: 0` in this API
response, so the zero is either a site-wide indexing-pipeline lag or an API-field quirk,
not something specific to mcp.zovo.one.

**Impressions and clicks, last 7 days (2026-08-28 to 2026-09-03):** `searchanalytics().query`
filtered to pages containing `mcp.zovo.one`, dimensions `[page]` and `[query]`, returned
**zero rows for both** -- 0 pages with any impression, 0 queries with any impression, 0
clicks. A 28-day cross-check (2026-08-07 to 2026-09-03) also returned zero rows, so this
is not a short-window artifact: mcp.zovo.one has **no measured Google Search impressions
across the full available recent history** in this property.

**Guides/compare/setup pages with any impression:** **none.** Of the 179 live URLs (20
guides, 16 compare, 143 setup pages under claude-desktop/claude-code/cursor/vscode/
windsurf/cline/claude-web x 17 servers), zero show any impression in the 7-day or 28-day
window.

## 3. Next-server candidates

Method: one bounded registry probe per new token (same style as part 1);
`empty_slot_score = 100/(1+count)`; `fit` (0-1) = pairing with the 16-server suite;
`buildability` (0-1) = pure-TypeScript, no-network feasibility gate;
`score = empty_slot_score x fit x buildability`.

19 new tokens probed (excludes `budget`, reused from part 1): markdown(100+, capped),
notes(69), todo(33), contacts(32), crm(75), email(100+, capped), **templates(1)**,
quotes(21), receipts(17, already held by expense-tracker, rank 4), mileage(13, already
held, rank 1), payroll(8), habit(21), journal(26), ocr(71), qr(77), barcode(9), epub(6),
translate(12), zip(14).

| rank | intent | count | fit | buildability | score |
|---|---|---|---|---|---|
| 1 | templates | 1 | 0.9 | 1.0 | 45.0 |
| 2 | payroll | 8 | 0.8 | 0.6 | 5.3 |
| 3 | epub | 6 | 0.4 | 0.9 | 5.1 |
| 4 | barcode | 9 | 0.5 | 1.0 | 5.0 |
| 5 | zip | 14 | 0.6 | 1.0 | 4.0 |

(quotes/estimate scores 4.1, just under zip; habit 2.3; journal/notes 1.85; translate
0.86 -- gated down hard on buildability since accurate translation without a network call
or a model is not achievable in pure TS.)

**Top 5 specs:**

1. **templates** -- Pure-TS library of parameterized email/proposal/contract merge-field
   templates (no network) plugging into invoice/docx/resume/clauses output; `templates`
   has 1 registry result, the emptiest slot measured across R1-R6.
2. **payroll** -- Simplified US/UK payroll and withholding calculator using bundled
   static tax-bracket tables (no network), pairing time-tracker hours with
   expense-tracker/invoice for a small-business finance bundle.
3. **epub** -- EPUB3 packager: pure-TS zip+XHTML assembly from markdown or docx input, no
   network; thin suite-fit but a very rare slot (6 results).
4. **barcode** -- Barcode/QR generator (pure-JS raster/SVG, Code128 + EAN + QR, no native
   deps) complementing the image server's resize/convert/compress pipeline.
5. **zip** -- Archive/zip/unzip utility (fflate, pure JS, no native deps) for bundling
   outputs produced by the docx/pdf/image servers.

## 4. Docker catalog PR and Cline issue status (gh, read-only)

**Docker MCP catalog PR #4892:** state open, mergeable, 0 comments, 0 review comments,
0 reviews, no labels, `changed_files: 32`, `updated_at: 2026-09-04T01:23:16Z` (today).
The file count (32) is consistent with the 8-server scope `data/organic.json` recorded
on 2026-09-03, but the PR body text still describes only the original four servers
(time-tracker, price-tracker, spreadsheet, invoice) -- the description is stale relative
to the diff. Still zero maintainer engagement.

**Cline marketplace issues (2397-2401, 2408-2410):** all 8 open, 0 comments, no labels on
any, last activity 2026-09-02T13:28 to 2026-09-03T02:39 -- unchanged since the R3 check,
zero human review activity.

## Failures / caveats

- `pdf` and `time` show `our_rank: null` on their own primary-token page-1 probe but ARE
  registered (confirmed in the full theluckystrike listing) -- crowded-token misses, kept
  separate from the genuinely-unregistered `bank-statement`/`image`/`kanban` in both the
  table and the JSON.
- GSC `indexed: 0` is read as-is from the API; it is site-wide across all 9 listed
  sitemaps, so it is reported as a likely pipeline-lag/API-quirk rather than a
  mcp.zovo.one-specific problem, per instruction to report numbers rather than editing
  GSC state (no sitemap resubmission or URL inspection write calls were made this round).
- Fit/buildability scores in part 3 are this round's own qualitative call (0-1), not a
  re-derivation of R1/R4's demand/supply GitHub-based formula; the two are not directly
  comparable, so quotes/estimate's R5 score (fit 12.1) is cited as a note, not merged in.

## RESULT.md schema block

```
status: DONE
evidence: Part 1 -- 16 primary-token + 11 kanban/image/bank-statement-token single-page
  registry probes (20s timeout each), plus 3 full-name existence probes and a 2-page
  theluckystrike listing (135 rows, 32 unique names) proving bank-statement/image/kanban
  are unregistered under any name. Part 2 -- google-auth service-account GSC query:
  sitemaps.list (129 submitted/0 indexed vs 179 live URLs) and searchanalytics.query for
  mcp.zovo.one, 7d and 28d windows, both zero rows. Part 3 -- 19 new-token registry
  probes, scored empty_slot x fit x buildability, top 5 picked. Part 4 -- gh api on PR
  4892 and 8 Cline issues, all read-only.
artifacts: docs/INTEL_R6.md, data/intel_r6.json
cost: under 30 wall minutes (hard cap)
failures: none; all probes returned data on first try, no timeouts
insight: three of the sixteen built servers (bank-statement, image, kanban) are
  completely absent from the MCP registry under any name or version -- not a naming or
  ranking problem but a publish gap, likely because the concurrent v0.6.0 release work
  had not reached mcp-publisher for these three yet. Separately, mcp.zovo.one has zero
  measured Google Search impressions or clicks across the full 28-day history available
  in Search Console, on any of its 179 live pages, while the sitemap itself has drifted
  50 URLs ahead of the last GSC submission.
```
