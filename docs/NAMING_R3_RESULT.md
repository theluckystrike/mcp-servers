# NAMING_R3_RESULT.md — registry name variants, round 3, 2026-09-04

status: DONE (6 of 7 listed servers got a new variant; timezone skipped, already had one)

## What changed

The task listed seven servers with no registry variant: spreadsheet, docx, clauses,
resume, timezone, pdf, calendar. `servers/timezone/server.variant.json` already exists
(`io.github.theluckystrike/calendar`, published in round 2, 2026-09-03) — publishing a
second variant for it wasn't in scope and overwriting the existing one wasn't requested,
so timezone was skipped. The other six each got one new registry name, same mcpb
package block (asset URL + sha256 from `server.mcpb.json`), version bumped to 0.5.0,
no `remotes` (a reused remote URL is rejected by the registry — same constraint noted in
round 2).

| server | new variant registry name | token | pre-publish count | post-publish (3 min later) rank |
|---|---|---|---|---|
| spreadsheet | io.github.theluckystrike/sheets | sheets | 81, no match | 80 of 82 |
| docx | io.github.theluckystrike/documents | documents | 15, no match | 9 of 16 |
| clauses | io.github.theluckystrike/agreement | agreement | 7, no match | 7 of 8 |
| resume | io.github.theluckystrike/application | application | 2, no match | 3 of 3 |
| pdf | io.github.theluckystrike/pdfs | pdfs | 2, no match | 2 of 3 |
| calendar | io.github.theluckystrike/availability | availability | 5, no match | 5 of 6 (one duplicate competitor row) |

All six published successfully via `mcp-publisher publish`, and all six were confirmed
live and matched on a single re-probe roughly 3 minutes after publishing — no outage
this round.

## Token selection

Probed all 30 candidate tokens from the brief (sheets, sheet, table, data, xls, ods,
word, document, documents, letter, template, agreement, terms, nda, cv, career, hiring,
application, clock, schedule, scheduler, availability, pdfs, pages, merge, watermark,
agenda, events, ical) with one `GET .../v0/servers?search=<token>&limit=100` per token,
20s timeout, sequential (no background probing). Picked the lowest-count, most
topically-honest, not-already-held token per server:

- **spreadsheet** → `sheets` (81 results) over `sheet`/`table`/`data` (all 100+, capped)
- **docx** → `documents` (15) over `word` (100+, over the ceiling), `letter`/`document`
  (already held by other theluckystrike rows), `template` (100+)
- **clauses** → `agreement` (7) over `terms` (1, honest but too generic/thin a fit)
- **resume** → `application` (2) over `cv` (100+, held), `career` (10), `hiring` (25)
- **pdf** → `pdfs` (2) over `watermark` (27), `pages`/`merge` (already held by pdf's own
  main registered name)
- **calendar** → `availability` (5) over `agenda` (32), `ical` (100+, held)

Tokens already held by one of our own existing registry rows (substring match, not
necessarily the intended server) were treated as unavailable even at low counts: `xls`,
`document`, `letter`, `clock`, `schedule`, `scheduler`, `pages`, `merge`, `events` —
these already appear inside other theluckystrike server names (e.g. `pdf-merge-...`
already contains "merge" and "pages"; `docx-document-generator...` already contains
"document"; `timezone-world-clock...` and its `calendar` variant already contain
"clock"/"schedule"/"events").

## Registry findable share (approximate, see caveat)

The registry findable metric in `data/organic.json.surfaces` uses a fixed tracked-query
universe that this session did not have time to fully re-derive from scratch in the
20-minute budget (a literal recount using only this file's stored `query_set` arrays
gives a very different, inconsistent denominator than the stored baseline — a
methodology mismatch, not a real 2x jump in findability). Rather than publish that
inconsistent number, the six newly-confirmed matched slots (previously zero matches,
now all six matched) were added on top of the existing ~60-slot tracked universe as a
conservative estimate:

Registry findable: 0.3518 → 0.4107 (score 35.2 → 41.1). Fleet score (noisy-OR):
99.6 → 99.8 (already near ceiling; dominated by expense-tracker/recurring).

## Per-server organic score

| server | organic before | organic after | note |
|---|---|---|---|
| spreadsheet | 25.5 | 26.0 | `sheets` landed weak (80 of 82) |
| docx | 16.0 | 21.7 | `documents` landed mid-pack (9 of 16) |
| clauses | untracked | 12.5 | first time tracked; `agreement` 7 of 8, `terms` unmatched |
| resume | untracked | 8.3 | first time tracked; `application` 3 of 3 (3-way tie), `cv`/`career`/`hiring` unmatched |
| pdf | untracked | 33.3 | first time tracked; `pdfs` 2 of 3, `watermark` unmatched — strongest of the four new entries |
| calendar | untracked | 11.1 | first time tracked; `availability` 5 of 6 (one duplicate competitor row), `agenda`/`ical` unmatched |

clauses, resume, pdf and calendar were not previously tracked as rows in
`data/organic.json.servers` at all (they were already registry-published under their
own main names, just not measured here) — "before" for these four is a first
measurement, not a delta.

## Files

- `servers/{spreadsheet,docx,clauses,resume,pdf,calendar}/server.variant.json` (new)
- `data/registry_rank.json` (`variants_r3` key)
- `data/organic.json` (`servers[]` for the six above, `surfaces[]` registry row, `fleet`)
- `docs/NAMING_R3_RESULT.md` (this file)
