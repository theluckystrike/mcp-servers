# ORGANIC_R3 -- organic re-measurement after v0.3.2, 2026-09-03

status: DONE

v0.3.2 shipped three more servers (`currency`, `docx`, `timezone`) with word-rich
registry names and `remotes[]` from day one, and `office-suite` -- previously never
published -- is now live (still stdio-only). This re-measures the fleet's organic
position: 9 registry entries (8 hosted), 56 query slots across all nine servers'
natural query sets, directories, GitHub search, and the 7 (now 9) open submissions.

## 1. Official registry -- per-token results and best rank

Endpoint fully paginated this time (`limit=100`, cursor loop) instead of trusting a
single page. Full raw data: `data/registry_rank.json` -> `after_v3_2026-09-03_v0.3.2`.

| token | results | our best rank (server) |
|---|---|---|
| time | 317 | 223 (time-tracker) |
| timer | 12 | - |
| timesheet | 11 | 1 (time-tracker) |
| hours | 11 | 2 (time-tracker) |
| billable | 10 | 1 (time-tracker) |
| tracking | 24 | - |
| time-tracker | 14 | 3 (time-tracker) |
| time tracker | 0 | - |
| price | 131 | 106 (price-tracker) |
| prices | 21 | - |
| deal | 99 | - |
| drop | 173 | 159 (price-tracker) |
| alert | 53 | 36 (price-tracker) |
| watch | 149 | 130 (price-tracker) |
| product | 126 | - |
| shop | 115 | - |
| price-tracker | 17 | 5 (price-tracker) |
| price tracker | 0 | - |
| spreadsheet | 24 | 13 (spreadsheet) |
| excel | 180 | 160 (spreadsheet) |
| xlsx | 28 | 19 (spreadsheet) |
| csv | 26 | 17 (spreadsheet) |
| sheet | 133 | 109 (spreadsheet) |
| sheets | 80 | - |
| table | 131 | - |
| data | 2897 | - |
| invoice | 110 | 82 (invoice) |
| invoices | 0 | - |
| invoicing | 68 | - |
| billing | 37 | 28 (invoice) |
| pdf | 290 | 258 (invoice) |
| receipt | 24 | 15 (expense-tracker) |
| quote | 63 | - |
| freelance | 6 | - |
| expense | 31 | 15 (expense-tracker) |
| expenses | 0 | - |
| receipts | 13 | 4 (expense-tracker) |
| mileage | 9 | 1 (expense-tracker) |
| office | 40 | 33 (office-suite) |
| suite | 94 | 78 (office-suite) |
| currency | 19 | 14 (currency) |
| exchange | 82 | - |
| ecb | 36 | 34 (currency) |
| fx | 87 | - |
| docx | 23 | 21 (docx) |
| word | 285 | - |
| proposal | 5 | 3 (docx) |
| contract | 97 | 90 (docx) |
| markdown | 116 | 112 (docx) |
| timezone | 15 | 13 (timezone) |
| meeting | 15 | 10 (timezone) |
| slots | 3 | 1 (timezone) |
| overlap | 5 | 3 (timezone) |
| ics | 910 | 857 (timezone) |
| world-clock | 3 | 1 (timezone) |
| resume | 17 | - (no server targets this term; control token) |
| cover-letter | 0 | - (control token) |

36 of 56 slots matched, mean p(seen) = 0.345 (was 22/41, 0.276 before this pass).
`resume`/`cover-letter` are control tokens -- no server's query_set includes them and
none matched, as expected; they widen the registry's own index count but are excluded
from every per-server score.

**Index lag:** none observed this pass beyond the documented 1-3 minutes; all fresh
`/v0/servers?search=` probes returned consistent counts across two calls per token.

**Remotes:** re-derived from the full `theluckystrike` listing (69 rows across all
versions). 8 of 9 servers carry `remotes[]` on their v0.3.2 row -- everything except
`office-suite-time-invoice-expense-excel-price`, which is still stdio-only. This is a
change from ORGANIC_R2: `expense-tracker` and `spreadsheet` were remotes-less at
v0.2.0 and both picked up `remotes[]` by v0.3.2.

## 2. Directories -- mcpservers.org, mcpmarket.com, glama.ai, smithery

| Directory | Result |
|---|---|
| mcpservers.org (`/api/servers?q=theluckystrike`) | HTTP 404 -- no such API endpoint |
| mcpservers.org (`/servers?q=theluckystrike`) | HTTP 301 into a client-rendered Next.js SPA shell; no server-rendered results, no discoverable JSON/algolia endpoint. Unverifiable via curl |
| mcpmarket.com (search and `/submit`) | HTTP 403 on every request, edge-blocked. Unverifiable via curl |
| glama.ai (`?query=theluckystrike`) | 1 real hit, an unrelated pre-existing `bln-mcp-grammar-server`; none of our 9 servers appear. Direct slug probes `glama.ai/mcp/servers/theluckystrike/<currency-converter\|docx-document-generator\|timezone-world-clock\|office-suite>` all 404 |
| registry.smithery.ai (`?q=theluckystrike`) | 200 OK, 0 occurrences of `theluckystrike` in the raw response (grepped) |

Confirmed absent from Glama and Smithery. mcpservers.org and mcpmarket.com stay
unverifiable (403 / client-side render) -- same instrument limitation as ORGANIC_R2.

## 3. GitHub search -- `gh api search/repositories`, top 30

| query | total results | our rank in top 30 |
|---|---|---|
| mcp currency converter | 31 | not present |
| mcp docx | 427 | not present |
| mcp timezone meeting | 7 | **present: theluckystrike/mcp-timezone at rank 4** |
| mcp resume | 790 | not present (control query -- no server targets "resume") |

First time any of the fleet's standalone mirror repos surfaces in a target GitHub
search this pass; `mcp-timezone`'s narrow query ("timezone meeting", only 7 total
results in GitHub's index) is what made it visible, the same mechanism that got
`mcp-price-tracker` to rank 12 in the prior INTEL_R2 pass on a differently-worded query.

## 4. Submissions status

| Submission | State | Labels | Comments | Maintainer request |
|---|---|---|---|---|
| [docker/mcp-registry#4892](https://github.com/docker/mcp-registry/pull/4892) | OPEN | none | 0 | none; now covers 8 servers (currency/timezone/docx/expense-tracker added to the original 4), all repinned to the same source commit |
| [punkpeye/awesome-mcp-servers#13473](https://github.com/punkpeye/awesome-mcp-servers/pull/13473) | OPEN | `missing-glama`, `valid-name`, `missing-emoji` | 2 (both bots) | **see verbatim below -- now a hard CI blocker** |
| cline/mcp-marketplace#2397 (Time Tracker) | OPEN | none | 0 | none |
| cline/mcp-marketplace#2398 (Price Tracker) | OPEN | none | 0 | none |
| cline/mcp-marketplace#2399 (Spreadsheet) | OPEN | none | 0 | none |
| cline/mcp-marketplace#2400 (Invoice) | OPEN | none | 0 | none |
| cline/mcp-marketplace#2401 (Expense Tracker) | OPEN | none | 0 | none |
| cline/mcp-marketplace#2408 (Currency) | OPEN | none | 0 | none |
| cline/mcp-marketplace#2409 (Timezone) | OPEN | none | 0 | none |
| cline/mcp-marketplace#2410 (Docx) | OPEN | none | 0 | none |

9 of 9 open submissions remain unmerged/unreviewed by a human.

**Verbatim bot comments on PR#13473 (both posted, re-confirmed 2026-09-03):**

1. `glama-check` bot: *"To ensure that only working servers are listed, we're updating
   our listing requirements. Please complete: 1) Ensure your server is listed on Glama
   (glama.ai/mcp/servers) and verify it passes all checks (add Dockerfile directly to
   Glama; server must start and respond to introspection). 2) Update your PR by adding
   a Glama score badge after the server description:
   `[![OWNER/REPO MCP server](https://glama.ai/mcp/servers/OWNER/REPO/badges/score.svg)](https://glama.ai/mcp/servers/OWNER/REPO)`."*
2. `emoji-check` bot: *"Your submission is missing a required emoji tag or uses an
   unrecognized one. Each entry must include at least one of the permitted emojis
   after the repository link."* (permitted set includes 🐍 Python, 📇 TS/JS,
   🏠 Local Service, 🍎 macOS, 🪟 Windows, etc.)

New since the prior pass: the PR now carries the `missing-glama`, `valid-name` and
`missing-emoji` **labels**, meaning this is a CI gate, not just an unreviewed queue --
it structurally cannot merge until we are listed on Glama (which is itself blocked:
crawler-only intake, no manual "add server" without a Glama account) and add a badge
plus an emoji per entry.

## 5. Downloads -- `node scripts/measure.mjs`

| Metric | Previous snapshot (2026-09-03T03:03:10Z) | Current (2026-09-03T04:52:35Z) | Delta |
|---|---|---|---|
| Release downloads (all 9 `.mcpb` assets, all tags, cumulative) | 207 | 286 | **+79** |
| GitHub traffic 14d (views/uniques/clones/clone-uniques) | 0/0/0/0 | 0/0/0/0 | flat |
| npm weekly downloads | not published (all sampled packages) | not published | flat |

+79 release downloads in under 2 hours is the largest single-window delta recorded
for this fleet so far, but the source is unconfirmed -- could be genuine third-party
`.mcpb` pulls, or repeated CI/measurement fetches of the same release asset URLs.
Recorded as a measured fact, not attributed to real installs without more evidence.

## 6. Recomputed organic.json -- before / after

Per-server organic (100 x mean(p) over each server's own query set; p = min(1,10/rank)
if matched to THAT server's registry name specifically, else 0 -- fixed a substring
false-credit bug this pass, see below):

| server | organic before (6-server, ORGANIC_R2) | organic after (9-server, this pass) | matched queries |
|---|---|---|---|
| time-tracker | 50.6 | 50.6 | 5 / 8 |
| price-tracker | 15.2 | 15.1 | 5 / 10 |
| spreadsheet | 24.1 | 25.5 | 5 / 8 |
| invoice | 6.3 | 6.5 | 3 / 8 |
| expense-tracker | 66.7 | 66.7 | 4 / 5 |
| office-suite | 0.0 | **21.6** | 2 / 2 (newly published) |
| currency | n/a (did not exist) | 25.2 | 2 / 4 |
| docx | n/a (did not exist) | 33.5 | 4 / 5 |
| timezone | n/a (did not exist) | **79.7** | 6 / 6 |

Registry findable (mean p over all query slots, all servers): 0.276 (22 of 41) ->
0.345 (36 of 56).

Hosted-endpoints findable (share of slots whose matched row carries `remotes[]`):
0.317 (13 of 41, 3 servers) -> **0.607** (34 of 56, 8 of 9 servers) -- expense-tracker
and spreadsheet both picked up `remotes[]` since ORGANIC_R2; office-suite is the only
holdout.

Surface scores that moved because registry findable moved:
- Official registry: 27.6 -> 34.5
- VS Code gallery: 24.8 -> 31.1
- Cursor/Claude Code pickers: 16.0 -> 20.0
- Hosted endpoints: 15.9 -> 30.4
- GitHub search and topics: 4 -> 12.5 (first time a mirror repo ranks in the task's
  own target queries)
- awesome-mcp-servers: 10 -> 6.3 (downgraded `listed` from 0.5 to 0.3: the PR is now
  CI-blocked on our own unmet Glama requirement, not just waiting in a review queue)

Fleet (fleet_score = noisy-OR across the nine per-server organics, same formula as
ORGANIC_R2 for comparability):

| metric | before (6 servers) | after (9 servers) |
|---|---|---|
| max_surface (highest single surface score) | 27.6 | 34.5 |
| mean_live (mean score of "live"-status surfaces) | 13.9 | 20.6 |
| fleet_score (noisy-OR of server organics) | 90.1 | 99.2 |

## RESULT

```
fleet_score:      90.1 -> 99.2   (noisy-OR of 9 server organics; timezone alone is
                                   the single strongest driver, organic 79.7)
max_surface:       27.6 -> 34.5   (official registry, findable 0.276 -> 0.345)
mean_live:         13.9 -> 20.6   (7 live surfaces, +6.7 avg, hosted-endpoints and
                                    GitHub search moved most)
registry findable: 0.276 -> 0.345 (36 of 56 tokens matched, up from 22 of 41)
hosted findable:   0.317 -> 0.607 (34 of 56 slots now resolve to a remotes[] row,
                                    up from 13 of 41 -- 8 of 9 servers hosted)
downloads:         207 -> 286     (+79 release .mcpb downloads in <2 hours, source
                                    unconfirmed)
```

Three biggest movers:

1. **timezone (new server): organic 0 -> 79.7, now the fleet's single strongest
   server.** Landed rank 1 of 3 on both `slots` and `world-clock`, 3 of 5 on
   `overlap`, and 6 of 6 natural queries matched overall -- every token in its query
   set is either near-empty or the server ranks reasonably within a crowded one
   (`ics`, 910 results, still matched at rank 857).
2. **office-suite: went from unpublished (organic 0) to live (organic 21.6), but it
   is the fleet's only server without `remotes[]`.** It now matches both of its query
   tokens (`office` 33 of 40, `suite` 78 of 94) but earns nothing on the new-ish
   Hosted endpoints surface, unlike every other server in the fleet.
3. **awesome-mcp-servers PR#13473 flipped from "queued" to "CI-blocked."** Bot labels
   `missing-glama` and `missing-emoji` mean the PR structurally cannot merge until we
   are listed on Glama (itself blocked -- crawler-only, no manual add without an
   account) and add a score badge plus emoji per entry. This is the fleet's most
   concrete blocked-on-us item, worth fixing before the next re-measurement.

A scoring-methodology fix worth flagging: office-suite's registry name
(`office-suite-time-invoice-expense-excel-price`) contains the substring "price", so
naively picking "the best rank for token X across ANY of our rows" would credit
price-tracker's `price` query with office-suite's much-worse rank. This pass restricts
every per-server match to that server's own registry name(s) before computing p --
the same class of bug ORGANIC_R2 caught and fixed for `invoice`/`expense-tracker`.

Everything else moved by roughly what index growth alone would predict: invoice and
price-tracker shifted by fractions of a point as the index grew a few percent between
measurements, not because of anything the fleet changed for those two servers.

## artifacts

- /Users/mike/mcp-servers/data/organic.json (measured[], surfaces[], servers[], fleet)
- /Users/mike/mcp-servers/data/registry_rank.json (`after_v3_2026-09-03_v0.3.2` block)
- /Users/mike/mcp-servers/data/distribution.json (awesome-mcp-servers note updated with
  CI labels/blocker; all other status fields unchanged this pass)
- /Users/mike/mcp-servers/docs/ORGANIC_R3.md (this file)

## cost

~25 wall minutes (cap).

## failures / instrument notes

1. Re-derived a bug from ORGANIC_R2's own postmortem before it could recur: computing
   "best rank per token across any theluckystrike row" instead of "best rank per token
   restricted to THIS server's registry name" would have silently credited
   price-tracker's `price` query with office-suite's rank (office-suite's full slug
   contains the substring "price"). Fixed before any score was written.
2. mcpservers.org and mcpmarket.com remain unverifiable via curl -- one serves a
   client-rendered SPA shell with no server-side results, the other 403s every
   request including the submit page. Recorded as unverifiable, not assumed absent or
   present.
3. The docker-mcp-catalog and cline-marketplace PR/issue counts grew (4 to 8 entries,
   5 to 8 issues) between passes purely from prior submission work, not from anything
   done in this measurement; verified state/labels/comments verbatim via `gh api`
   rather than trusting the counts in `data/distribution.json` without a fresh check.
4. Release-download delta (+79 in <2 hours) is recorded as a measured fact from
   `node scripts/measure.mjs` snapshots, explicitly not claimed as real third-party
   installs -- no instrument distinguishes organic pulls from repeated automated
   fetches of the same asset URLs.
