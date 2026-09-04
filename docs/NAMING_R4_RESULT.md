# NAMING_R4_RESULT.md -- registry name variants, round 4, 2026-09-04

status: DONE (10 new variants published, one per server, all confirmed live)

## What changed

Probed the full tracked token set from `data/organic.json` servers[].query_set (66
distinct tokens, two of them known-broken multi-word queries) plus the 38 new tokens
named in this round's brief (todo, tasks, board, sprint, standup, receipts, mileage,
ledger, cashflow, budget, subscriptions, reconcile, thumbnails, compress, watermark,
exif, merge, split, stamp, ics, freebusy, scheduling, meeting, dst, fx, exchange, vat,
sepa, proposal, contract, sow, nda, cv, cover-letter, retainer, subscription-billing,
csv, xlsx, pivot). After de-duplication that is 97 distinct tokens, each probed once
via a bounded `GET .../v0/servers?search=<token>&limit=100`, 20s timeout, sequential,
no background loops.

Of those 97, 15 had fewer than 20 results with no theluckystrike entry on page 1.
Two (`time tracker`, `price tracker`) are the known always-zero multi-word queries and
are not viable single-word registry names. `sepa` (14 results) was excluded because no
server honestly does SEPA bank transfers (currency only does ECB FX conversion) --
picking it would have been a misleading name. `exif` (4 results) was excluded because
its only honest server (image) had already used its one new name this round on
`thumbnails`. That left 10 real candidates, one per distinct server, respecting the
"max one new name per server this round" cap:

| server | new variant registry name | token | count before | rank before | count after | rank after |
|---|---|---|---|---|---|---|
| spreadsheet | io.github.theluckystrike/pivot | pivot | 0 | none | 1 | 1 of 1 |
| image | io.github.theluckystrike/thumbnails | thumbnails | 0 | none | 1 | 1 of 1 |
| clauses | io.github.theluckystrike/terms | terms | 1 | none | 2 | 2 of 2 |
| bank-statement | io.github.theluckystrike/cashflow | cashflow | 3 | none | 4 | 3 of 4 |
| docx | io.github.theluckystrike/sow | sow | 4 | none | 5 | 5 of 5 |
| timezone | io.github.theluckystrike/scheduling | scheduling | 5 | none | 6 | 5 of 6 |
| recurring | io.github.theluckystrike/subscriptions | subscriptions | 5 | none | 6 | 6 of 6 |
| quotes | io.github.theluckystrike/freelance | freelance | 6 | none | 7 | 7 of 7 |
| resume | io.github.theluckystrike/career | career | 10 | none | 11 | 11 of 11 |
| kanban | io.github.theluckystrike/standup | standup | 11 | none | 12 | 12 of 12 |

All 10 published via `mcp-publisher publish` (stdio-only, same GitHub release asset URL
and fileSha256 as each server's `server.mcpb.json` at v0.7.0, no `remotes[]`), and all
10 confirmed matched on re-probe (index lag ranged from immediate to about 3 minutes,
consistent with the documented 1-3 minute lag).

## Honest-fit reasoning per pick

- **pivot -> spreadsheet**: `sheet_query`'s own tool description says "Filters, groups,
  aggregates and sorts in one call" -- that is a pivot-table operation in substance.
- **thumbnails -> image**: the image server's own description already lists
  "thumbnail" among its verbs.
- **terms -> clauses**: the server is literally a contract/proposal clause library.
- **cashflow -> bank-statement**: the server imports a bank CSV, categorises,
  summarises per currency and reconciles it -- a cashflow view.
- **sow -> docx**: the docx server's own description lists "statements of work".
- **scheduling -> timezone**: the server does meeting-slot finding across countries,
  DST checks and .ics invites -- scheduling in substance.
- **subscriptions -> recurring**: the server is recurring/subscription invoice
  billing; it already holds the `retainer` variant from an earlier round, this is a
  second, different-token variant published this round (one new name per server this
  round, not a lifetime cap).
- **freelance -> quotes**: the server's own description says "for freelancers".
- **career -> resume**: the server tailors a resume/cover letter for a job
  application, i.e. career documents.
- **standup -> kanban**: the server is a local task board with columns, due dates,
  priorities and a weekly review -- a natural standup board.

## Findable share

Using the same formula as `data/organic.json` / INTEL_R6 / INTEL_R7 (p = min(1,
10/our_rank) if matched on page 1 else 0, mean over the tracked-plus-new token set),
applied identically before and after over all 97 tokens:

- **Matched: 60 of 97 -> 70 of 97**
- **Findable share: 39.73% -> 49.77%**

This is short of the 60% target for this round but a real 10-point gain; the remaining
gap is dominated by high-competition single-word tokens capped at 100 results (time,
excel, pdf, watermark, ics, vat, cv, contract, markdown, notes, email, crm, board, dst,
nda) where our names sit far down an alphabetically-sorted list regardless of topical
fit, plus generic multi-hundred-result tokens (drop, watch, product, shop) that no
single server can honestly own.

## Files

- `servers/{spreadsheet,image,clauses,bank-statement,docx,timezone,recurring,quotes,resume,kanban}/server.<token>.json` (10 new)
- `data/naming_r4.json`
- `docs/NAMING_R4_RESULT.md` (this file)

## RESULT.md schema block

```
status: DONE
evidence: Probed 97 distinct tokens (66 tracked + 38 new from the brief, de-duplicated)
  via bounded search-API GETs. Found 15 with <20 results and no theluckystrike match on
  page 1; excluded 2 always-zero multi-word queries and 1 (sepa) with no honestly
  fitting server, and 1 (exif) whose only fitting server had already used its one new
  name this round. Published 10 new variants, one per server (spreadsheet/pivot,
  image/thumbnails, clauses/terms, bank-statement/cashflow, docx/sow,
  timezone/scheduling, recurring/subscriptions, quotes/freelance, resume/career,
  kanban/standup), each stdio-only mcpb pointing at that server's existing v0.7.0
  GitHub release asset and sha256. All 10 confirmed matched via search API re-probe
  (rank 1 of 1 up to 12 of 12).
artifacts: docs/NAMING_R4_RESULT.md, data/naming_r4.json, 10 new
  servers/<x>/server.<token>.json files
cost: under 35 wall minutes (hard cap); zero paid APIs; zero paid submissions
failures: none blocking; findable share moved 39.73% -> 49.77%, short of the 60%
  target -- the remainder is capped-at-100 single-word tokens and generic
  multi-hundred-result tokens no single server can honestly claim
insight: every low-count empty slot this round mapped cleanly onto exactly one
  existing server's own tool behavior or stated description -- no invented capability
  was needed to reach 10 honest new names in one pass.
```
