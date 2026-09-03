# Status round 7 (2026-09-03) -- task 4: registry re-probe, submissions, Search Console, downloads

## Methodology note (read first)

Per-server organic scores below were recomputed with a documented formula -- p(seen) = 1 - (rank-1)/total
per matched query token, 0 for unmatched, server organic = 100 x mean(p) over that server's query_set --
applied uniformly to every server touched by this round's reprobe (and, for consistency, to the fleet-wide
findable/fleet_score aggregates). This matches the direction and rough magnitude of the jumps recorded in
NAMING_R2_RESULT.md (invoice 6.5->19.0, expense-tracker 66.7->86.7 after a single 0-result-to-1-result
match) but is a best-fit reconstruction, not a byte-for-byte replay of whatever exact pipeline produced the
prior numbers -- some deltas below (expense-tracker, currency, docx, timezone) move in ways that look like
regressions purely because this pass counts newly-confirmed weak-ranking variant tokens (mileage total grew
9->12, calendar/exchange/fx/proposal are all real but weak matches) into the average that a prior pass may
not have included yet. Treat the *direction and the underlying rank/total facts* as solid (all live-measured
this round); treat the exact score values as one consistent scoring convention, not a re-verified ground truth.

## 1. Registry re-probe -- all 17 tokens, live, 0 timeouts

Method: one `GET .../v0/servers?search=<token>&limit=100` per token, 20s timeout, up to 3 retries (2 on the
tokens probed once the API proved responsive). Full results in `data/registry_rank.json` key
`variants_r2_reprobe`.

| token | results | our best rank | name that matched |
|---|---|---|---|
| timer | 13 | 12 | io.github.theluckystrike/timer-tracking |
| tracking | 25 | 24 | io.github.theluckystrike/timer-tracking |
| prices | 22 | 19 | io.github.theluckystrike/prices-deal |
| deal | 100+ | 93 | io.github.theluckystrike/prices-deal |
| invoices | 1 | 1 | io.github.theluckystrike/invoices-invoicing |
| invoicing | 69 | 68 | io.github.theluckystrike/invoices-invoicing |
| expenses | 1 | 1 | io.github.theluckystrike/expenses |
| exchange | 84 | 76 | io.github.theluckystrike/exchange-fx |
| fx | 88 | 81 | io.github.theluckystrike/exchange-fx |
| calendar | 92 | 70 | io.github.theluckystrike/calendar |
| retainer | 1 | 1 | io.github.theluckystrike/retainer |
| recurring | 3 | 1 | io.github.theluckystrike/recurring-invoice-scheduler-subscription-billing-due-reminders |
| subscription | 13 | 11 | io.github.theluckystrike/recurring-invoice-scheduler-subscription-billing-due-reminders |
| mileage | 12 | 1 | io.github.theluckystrike/expense-tracker-receipts-mileage |
| clause | 5 | 3 | io.github.theluckystrike/contract-clause-library-proposal-template-docx |
| proposal | 11 | 3 (best across our rows; docx's own row lands 6) | contract-clause-library... (3), docx-document-generator... (6) |
| cover-letter | 3 | 1 | io.github.theluckystrike/resume-cover-letter-docx-generator |

Two findings worth flagging: (1) `invoices`/`expenses` from NAMING_R2 were only inferred (0->1 by
deduction); this round live-confirms both at rank 1 of 1. (2) publishing more of our own names into a
token's result set can cannibalize a sibling server's rank on that same token -- `proposal` now shows our
own `contract-clause-library-proposal-template-docx` (clauses server) outranking `docx-document-generator-
proposal-contract-markdown` (docx server) at position 3 vs 6 of 11.

## 2. Registry/organic score updates (data/organic.json)

| server | organic before | organic after |
|---|---|---|
| time-tracker | 50.6 | 53.7 |
| price-tracker | 15.1 | 17.9 |
| invoice | 19.0 | 21.0 |
| expense-tracker | 86.7 | 74.7 |
| currency | 25.2 | 14.9 |
| docx | 33.5 | 16.0 |
| timezone | 79.7 | 50.1 |
| recurring (new row) | -- | 74.4 |
| spreadsheet, office-suite | unchanged (not reprobed) | unchanged |

Registry surface findable: 0.381 -> 0.352 (score 38.1 -> 35.2), over a denominator that grew from 56 to 60
query slots (timezone's `calendar` token and the new `recurring` row's 3 tokens). Fleet score (noisy-OR):
99.7 -> 99.6 -- still near ceiling; expense-tracker (74.7) and recurring (74.4) are now the two anchor
servers keeping it there.

## 3. Submissions

**Docker MCP catalog -- PR docker/mcp-registry#4892**: state OPEN, mergeable, `statusCheckRollup` empty (no
CI configured on this PR), 0 comments. No maintainer action since last check.

**awesome-mcp-servers -- punkpeye#13473**: state OPEN. Two bot comments, verbatim:
- glama-check: "Hey, To ensure that only working servers are listed, we're updating our listing
  requirements. Please complete the following steps: 1. Ensure your server is listed on Glama... 2. Update
  your PR by adding a Glama score badge..."
- emoji-check: "Your submission is missing a required emoji tag or uses an unrecognized one. Each entry
  must include at least one of the permitted emojis after the repository link..."

Both are automated CI gates, not a human maintainer request. Hard-blocked on a Glama listing that does not
exist yet for any of the 4 submitted servers.

**cline/mcp-marketplace issues 2397-2401, 2408-2413** (11 total: time-tracker, price-tracker, spreadsheet,
invoice, expense-tracker, currency, timezone, docx, resume, recurring, clauses): all 11 re-checked this
round, all state OPEN, labels `[]`, comments `[]`. Zero maintainer engagement on any of them.

No maintainer requests found anywhere except the two automated Glama/emoji CI comments on #13473 above
(already actioned as blockers, not yet resolved).

## 4. Search Console (sc-domain:zovo.one)

`sitemaps.list`: `https://mcp.zovo.one/sitemap.xml` unchanged since round 5 -- submitted 129, indexed 0, 0
warnings, 0 errors, lastSubmitted/lastDownloaded 2026-09-03T08:42Z. Not resubmitted this round (no new URLs
since round 5).

`urlInspection.index.inspect`:

| URL | verdict | coverageState |
|---|---|---|
| https://mcp.zovo.one/ | NEUTRAL | Discovered - currently not indexed |
| https://mcp.zovo.one/mcp/connect | NEUTRAL | URL is unknown to Google |
| https://mcp.zovo.one/guides/connect-mcp-servers-without-installing | NEUTRAL | URL is unknown to Google |
| https://mcp.zovo.one/setup/claude-web/invoice | NEUTRAL | Discovered - currently not indexed |

**Indexed count: 0 of 129 submitted URLs.** All 4 inspected URLs are pre-crawl (no `lastCrawlTime` on any).
Consistent with normal Google indexing latency, not a defect on our side.

## 5. Downloads (`node scripts/measure.mjs`)

Release downloads total: **556** (was 556 in the last recorded metrics.json snapshot before this run --
effectively flat this round; the last snapshot delta of +79 was recorded in an earlier round). Top five
assets by download count (all v0.4.2, the current release):

| asset | downloads |
|---|---|
| price-tracker.mcpb | 10 |
| expense-tracker.mcpb | 9 |
| timezone.mcpb | 9 |
| currency.mcpb | 8 |
| invoice.mcpb | 8 |
| recurring.mcpb | 8 |

GitHub: 0 stars/forks/watchers, 0 views_14d, 54 clones_14d (19 unique cloners). npm: none of the 4 checked
packages published. Billing health check: OK. This snapshot was appended to `data/metrics.json` (not part
of this task's committed file set).

## RESULT.md

```
status: DONE
evidence:
  registry reprobe: all 17 tokens (9 outage-blocked + 8 variant/confirmation) returned live with 0 timeouts;
    invoices and expenses (previously inferred) now live-confirmed rank 1 of 1; found a cannibalization case
    where our own clauses-server row now outranks the docx server on 'proposal' (3 of 11 vs 6 of 11)
  registry findable 0.381 -> 0.352 (denominator grew 56 -> 60 tokens); fleet score 99.7 -> 99.6, still near
    ceiling; recurring added as a 10th tracked server (organic 74.4)
  docker/mcp-registry#4892: OPEN, mergeable, no checks configured, 0 comments -- no maintainer action
  punkpeye/awesome-mcp-servers#13473: OPEN, 2 automated bot comments (Glama listing + score badge required;
    emoji tag required), hard CI-blocked, no human maintainer comment
  cline/mcp-marketplace issues 2397-2401, 2408-2413 (11 total): all OPEN, 0 labels, 0 comments
  Search Console: sitemap unchanged at 129 submitted / 0 indexed / 0 warnings / 0 errors; 4 urlInspection
    calls all NEUTRAL, 0 of 4 indexed, none crawled yet
  measure.mjs: 556 release downloads total (flat this round); top assets price-tracker.mcpb (10),
    expense-tracker.mcpb and timezone.mcpb (9 each), currency/invoice/recurring.mcpb (8 each)
artifacts:
  data/registry_rank.json (variants_r2_reprobe key)
  data/organic.json (servers[] for time-tracker/price-tracker/invoice/expense-tracker/currency/docx/
    timezone recomputed, recurring added, surfaces registry rows, fleet block, measured[] appended)
  data/distribution.json (docker-mcp-catalog, cline-marketplace, awesome-mcp-servers, search-console notes
    extended with round 7 verbatim comment/status checks)
  docs/STATUS_R7.md (this file)
cost: bounded to the 25-minute task cap, 0 paid APIs
failures: none of the 3 submission surfaces (Docker, awesome-mcp-servers, Cline) have moved state since
  the last check -- all still pending maintainer/CI action, not something this task can accelerate.
  Search Console indexed count is still 0 of 129 -- expected latency, re-check in 24-48h.
```
