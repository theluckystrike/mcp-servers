# INTEL_R7 -- templates variant publish, GSC URL inspection + IndexNow, registry re-probe

Measured 2026-09-04. Cap: 35 wall minutes, zero paid APIs, no paid submissions.
Waited for the concurrent v0.6.1 release/republish (other agent) before publishing
anything; landed after about 11 minutes of polling `git fetch` + `git log origin/main`
every 3 minutes.

## 1. Registry variant: `io.github.theluckystrike/templates` on docx

R6 part 3 scored `templates` as the emptiest new-token slot found across R1-R6 (1
registry result, empty_slot_score 45.0, top of the ranked list). This round filled it.

- File: `servers/docx/server.templates.json`
- Registry name: `io.github.theluckystrike/templates`
- Description (77 chars): "Reusable docx templates: placeholders for proposals,
  contracts, quotes, SOWs." -- names templates, docx, proposal, contract, placeholders.
- Version: 0.6.1, matching the docx manifest's released version once v0.6.1 landed
  (commits `8a2058f` "v0.6.1: bump 17 servers and mcp-license, regenerate vendored
  worker sources" and `ef09158` "v0.6.1 bundle manifests" on origin/main).
- Package: same GitHub release asset and sha256 as `servers/docx/server.mcpb.json`'s
  mcpb entry -- `https://github.com/theluckystrike/mcp-servers/releases/download/v0.6.1/docx.mcpb`,
  `9a70cfc3c2e429917d24daa0b2794042013b563b4359891a4003d8e86007d941`. stdio-only, no
  `remotes[]` (a reused remote URL is rejected by the registry, same constraint as
  every prior variant round).
- Published via `mcp-publisher login github -token "$(gh auth token)"` then
  `mcp-publisher publish` (server.templates.json copied over server.json for the call,
  restored immediately after) -- succeeded first try, no `yes y |` prompt needed for
  publish itself (login used `yes y |` per the recipe).

**Search API verification (token "templates"):**

| when | count | our match |
|---|---|---|
| before publish | 1 | none (only hit: `io.github.tresor4k/tabletemplates-mcp`) |
| after publish (~75s later) | 2 | rank 1 of 2, `io.github.theluckystrike/templates` |

## 2. Search Console -- URL inspection, Googlebot anchor check, IndexNow

Service account `zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com`,
`sc-domain:zovo.one`, `POST v1/urlInspection/index:inspect`.

| URL | verdict | coverageState | lastCrawlTime |
|---|---|---|---|
| `mcp.zovo.one/` | NEUTRAL | Discovered - currently not indexed | none |
| `mcp.zovo.one/s/invoice` | NEUTRAL | URL is unknown to Google | none |
| `mcp.zovo.one/guides/kanban-board-in-claude-with-time-tracking` | NEUTRAL | Discovered - currently not indexed | none |
| `mcp.zovo.one/setup/claude-web/bank-statement` | NEUTRAL | Discovered - currently not indexed | none |
| `mcp.zovo.one/compare/bank-statement` | NEUTRAL | Discovered - currently not indexed | none |

None of the 5 sampled URLs have ever been crawled -- consistent with R6's finding of
zero measured impressions across the full 28-day GSC history.

**Googlebot anchor check (negative finding):** `curl -A 'Mozilla/5.0 (compatible;
Googlebot/2.1; +http://www.google.com/bot.html)' https://zovo.one/` returned HTTP 200
and 23,427 bytes of raw HTML with **zero** occurrences of the string `mcp.zovo.one`
anywhere in the response. The homepage is a client-rendered React SPA (bundled JS:
react-vendor, router, radix-ui, lucide-react, query, supabase) -- any link to
mcp.zovo.one, if present at all, is injected by client-side JavaScript that Googlebot's
first-pass HTML fetch (and this curl check) never executes. So the premise that the
homepage "serves the mcp.zovo.one anchor to a Googlebot user agent" does **not** hold
for the raw crawlable response; this is recorded as a negative finding, not assumed.

**IndexNow ping:** `POST https://api.indexnow.org/indexnow`, host `mcp.zovo.one`, key
from `data/indexnow.key` (`22fad93b71a88e2e60acae203c4288ae`), keyLocation verified
live (`https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt` returns HTTP 200).
Submitted the same 5 URLs -- **HTTP 200**.

## 3. Registry re-probe -- 19 R6 new-slot tokens + `estimate`

Same method as R6 part 1 (single bounded page-1 GET per token, 20s timeout). 20 tokens
total: the 19 carried over from R6 part 3 (markdown, notes, todo, contacts, crm, email,
templates, quotes, receipts, mileage, payroll, habit, journal, ocr, qr, barcode, epub,
translate, zip) plus `estimate`, the one token named in this round's brief not already
among the 19.

| token | count before | rank before | count after | rank after |
|---|---|---|---|---|
| markdown | 100 (capped) | none | 100 (capped) | none |
| notes | 69 | none | 69 | none |
| todo | 34 | 33 (kanban-todo-tasks-projects-board) | 35 | 33 |
| contacts | 32 | none | 32 | none |
| crm | 75 | none | 75 | none |
| email | 100 (capped) | none | 100 (capped) | none |
| **templates** | 1 | none | 2 | **1** |
| quotes | 21 | none | 21 | none |
| receipts | 18 | 4 (expense-tracker) | 19 | 4 |
| mileage | 14 | 1 (expense-tracker) | 15 | 1 |
| payroll | 8 | none | 8 | none |
| habit | 21 | none | 21 | none |
| journal | 26 | none | 26 | none |
| ocr | 71 | none | 71 | none |
| qr | 77 | none | 77 | none |
| barcode | 9 | none | 9 | none |
| epub | 6 | none | 6 | none |
| translate | 12 | none | 12 | none |
| zip | 14 | none | 14 | none |
| estimate | -- (post-only) | -- | 4 | none |

Findable share (`p = min(1, 10/rank)` if matched on page 1 else 0, mean over the 20
slots -- same formula `data/organic.json` documents):

- **Before: 2 of 19 matched (10.5%), mean p = 0.1053** (mileage rank 1, receipts rank 4)
- **After: 4 of 20 matched (20.0%), mean p = 0.1652** (adds templates rank 1 from this
  session's publish, and todo rank 33 -- kanban's own registration, not this session's
  work but newly confirmed live, closing one of R6's three "not registered at all" gaps)

## Failures / caveats

- The Googlebot-anchor premise did not hold; reported as a negative finding above
  rather than confirmed as instructed to record it either way.
- kanban's registration (matched on `todo`) landed via the concurrent v0.6.1 republish
  by another agent, not this session's publish -- noted so it isn't mistaken for this
  round's own work. bank-statement and image were not re-checked (out of scope: only
  the 20 named tokens plus the docx variant were probed this round).
- `data/organic.json` and `data/registry_rank.json` were left untouched -- fully
  re-deriving that file's tracked-query-set findable number with its own documented
  method was out of the 35-minute budget once the ~11-minute v0.6.1 wait and the GSC +
  registry workstreams were run; only the 20-token new-slot findable share above was
  computed fresh, using the same formula.

## RESULT.md schema block

```
status: DONE
evidence: Part 1 -- polled git fetch/log every 3 min for v0.6.1 (landed ~11 min in),
  published io.github.theluckystrike/templates on docx (v0.6.1 mcpb asset/sha matching
  the released docx manifest, stdio-only, 77-char description), confirmed via search
  API before (count 1, no match) and after (count 2, rank 1). Part 2 -- GSC
  service-account url:index.inspect for 5 URLs (all NEUTRAL/not-indexed), Googlebot-UA
  curl of zovo.one homepage (0 mcp.zovo.one references in raw HTML -- SPA, negative
  finding), IndexNow ping for the same 5 URLs (HTTP 200, key file verified live).
  Part 3 -- registry re-probe of 19 R6 new-slot tokens plus estimate, before/after the
  variant publish, findable share via data/organic.json's formula.
artifacts: docs/INTEL_R7.md, data/intel_r7.json, servers/docx/server.templates.json
cost: under 35 wall minutes (hard cap)
failures: none blocking; two negative findings recorded (SPA homepage carries no
  crawlable link to mcp.zovo.one; all 5 GSC-inspected URLs remain unindexed)
insight: The templates slot filled exactly as R6 scored it -- emptiest new token (1
  result) now ranks 1st of 2 immediately post-publish. The zero-impressions finding
  from R6 likely has a concrete cause: zovo.one's own homepage, the natural internal
  link source into the MCP storefront, renders all its links client-side, so
  Googlebot's first-pass HTML fetch finds zero path from the flagship domain to
  mcp.zovo.one -- consistent with 179 live pages and zero measured impressions.
```
