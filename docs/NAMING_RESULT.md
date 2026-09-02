# NAMING_RESULT.md — registry name rewrite, 2026-09-02

status: DONE

## What changed

Four servers were republished under descriptive names and the four old names were
deprecated (all versions). Files edited: `servers/*/server.json` (npm variant, for the
eventual npm-backed publish) and `servers/*/server.mcpb.json` (the variant actually
published, packages unchanged: the same v0.1.1 mcpb release assets and sha256).

| old registry name | new registry name | slug chars |
|---|---|---|
| io.github.theluckystrike/time-tracker | io.github.theluckystrike/time-tracker-timesheet-billable-hours | 37 |
| io.github.theluckystrike/price-tracker | io.github.theluckystrike/price-tracker-drop-alert-watch | 30 |
| io.github.theluckystrike/spreadsheet | io.github.theluckystrike/excel-spreadsheet-xlsx-csv | 26 |
| io.github.theluckystrike/invoice | io.github.theluckystrike/invoice-pdf-billing-generator | 29 |

Directory names on disk are unchanged (`servers/time-tracker`, `servers/price-tracker`,
`servers/spreadsheet`, `servers/invoice`), as are npm package names
(`@theluckystrike/mcp-<dir>`), product ids and checkout URLs. Only the registry `name`
field moved. The schema has no free-text comment field, so this table is the mapping of
record.

Every token in each new name is a word the server's own description already uses:
timesheet/billable/hours (time entries and billable reports), drop/alert/watch (target
alerts and a watch list), excel/xlsx/csv (the file formats it reads and writes),
pdf/billing (it renders invoice PDFs). No token describes a capability that is absent.

## Query coverage per new name

Single tokens that now match, with our rank and the total result count (measured after
publish, `?search=<token>&limit=100`, cursor paginated):

- time-tracker-timesheet-billable-hours: billable 1/1, timesheet 1/2, hours 2/2,
  time-tracker 5/5, time 216/296. No match: timer, tracking, "time tracker".
- price-tracker-drop-alert-watch: price-tracker 7/8, alert 35/43, price 100/114,
  watch 128/138, drop 159/164. No match: prices, deal, product, shop, "price tracker".
- excel-spreadsheet-xlsx-csv: spreadsheet 13/15, csv 17/17, xlsx 19/19, sheet 107/113,
  excel 160/163. No match: sheets, table, data.
- invoice-pdf-billing-generator: billing 28/28, invoice 84/93, pdf 258/281.
  No match: invoices, invoicing, receipt, quote, freelance.

## evidence

Search semantics, all measured today against
`https://registry.modelcontextprotocol.io/v0/servers?search=`:

```
TIMESHEET 1 ; Timesheet 1 ; timesheet 1        -> case-insensitive
theluckystrike/time  -> 2 results, both io.github.theluckystrike/time-tracker
luckystrike/invoice  -> 2 results, both io.github.theluckystrike/invoice
"time tracker" 0 ; "price tracker" 0 ; "time tracking" 0   -> any space returns 0
```

Publish and deprecate:

```
$ mcp-publisher login github -token "$(gh auth token)"
Successfully logged in
$ mcp-publisher publish servers/time-tracker/server.mcpb.json
Successfully published
Server io.github.theluckystrike/time-tracker-timesheet-billable-hours version 0.1.1
   (same for price-tracker-drop-alert-watch, excel-spreadsheet-xlsx-csv,
    invoice-pdf-billing-generator)

$ mcp-publisher status --status deprecated --all-versions io.github.theluckystrike/time-tracker
This will update 2 version(s):  0.1.1: active -> deprecated / 0.1.0: active -> deprecated
Continue? [y/N] Error: failed to read response: EOF
$ yes y | mcp-publisher status --status deprecated --all-versions io.github.theluckystrike/time-tracker
Successfully updated 2 version(s)          (same for the other three)
```

Before/after, per token (rank of our best ACTIVE entry / total results):

| token | before | after |
|---|---|---|
| time | 214/295 | 216/296 |
| timer | -/12 | -/12 |
| timesheet | -/1 | 1/2 |
| hours | -/1 | 2/2 |
| billable | -/0 | 1/1 |
| tracking | -/24 | -/24 |
| time-tracker | 3/3 | 5/5 |
| time tracker | -/0 | -/0 |
| price | 98/113 | 100/114 |
| prices | -/21 | -/21 |
| deal | -/99 | -/99 |
| drop | -/163 | 159/164 |
| alert | -/42 | 35/43 |
| watch | -/137 | 128/138 |
| product | -/126 | -/126 |
| shop | -/113 | -/113 |
| price-tracker | 5/6 | 7/8 |
| price tracker | -/0 | -/0 |
| spreadsheet | 13/14 | 13/15 |
| excel | -/162 | 160/163 |
| xlsx | -/18 | 19/19 |
| csv | -/16 | 17/17 |
| sheet | 107/111 | 107/113 |
| sheets | -/80 | -/80 |
| table | -/129 | -/129 |
| data | -/1200 | -/1200 |
| invoice | 82/92 | 84/93 |
| invoices | -/0 | -/0 |
| invoicing | -/68 | -/68 |
| billing | -/27 | 28/28 |
| pdf | -/280 | 258/281 |
| receipt | -/15 | -/15 |
| quote | -/55 | -/55 |
| freelance | -/6 | -/6 |

Matched queries: 7 of 34 before, 18 of 34 after.

Scores, same formula both sides (p = 0 if unmatched else min(1, 10/rank), server score =
100 x mean p over its query set):

| server | organic before | organic after |
|---|---|---|
| time-tracker | 13 | 51 |
| price-tracker | 11 | 15 |
| spreadsheet | 11 | 25 |
| invoice | 2 | 6 |

Registry surface findable 0.092 -> 0.239; surface score 9 -> 24. (The pre-existing 0.3
findable in organic.json was an estimate, not a measurement; it has been replaced with
the measured value on both sides so the comparison holds.)

## artifacts

- /Users/mike/mcp-servers/servers/time-tracker/server.json, server.mcpb.json
- /Users/mike/mcp-servers/servers/price-tracker/server.json, server.mcpb.json
- /Users/mike/mcp-servers/servers/spreadsheet/server.json, server.mcpb.json
- /Users/mike/mcp-servers/servers/invoice/server.json, server.mcpb.json
- /Users/mike/mcp-servers/data/registry_rank.json (search_semantics, before, after)
- /Users/mike/mcp-servers/data/organic.json (measured[], surfaces[], servers[])
- /Users/mike/mcp-servers/docs/NAMING_RESULT.md

## cost

28 wall minutes.

## failures

1. `mcp-publisher status` prompts `Continue? [y/N]` and exits with
   `Error: failed to read response: EOF` under a non-tty. Fixed by piping `yes y`.
2. The first post-publish re-probe missed the new names on `csv` (16 results) and `pdf`
   (280). Not a naming bug: the search index lags a publish by 1 to 3 minutes. A second
   probe found them at 17/17 and 258/281. A single post-publish verification pass would
   have recorded two false negatives.
3. Deprecating the old names did not remove them from search. `search=theluckystrike`
   still returns 12 rows (4 old servers x 2 versions, plus the 4 new ones). The
   duplicate-suppression goal of step 3 is NOT achieved by the status flag; consumers
   that filter on `status` will hide them, consumers that do not will show 12 entries.
   `--status deleted` would remove them but also breaks any existing installs, so it was
   not used.

## insight

The rename cannot buy rank, only coverage. Results are sorted alphabetically by the FULL
name including the `io.github.theluckystrike/` prefix, so our position inside any given
result list is fixed by the namespace, not the slug: on `time` we moved 214 -> 216, on
`price` 98 -> 100, on `sheet` 107 -> 107. Every point of the gain came from appearing at
all in lists short enough that last place is still on the first screen. That makes the
value of a token inversely proportional to its popularity: `billable` (0 prior servers),
`timesheet` (1), `hours` (1), `xlsx` (18) and `csv` (16) are worth more than `pdf` (281),
`excel` (163) or `data` (1200), where being matched at rank 258 is indistinguishable from
not being listed. The four unmatched near-empty tokens left on the table are `invoices`
(0 results), `freelance` (6), `timer` (12) and `receipt` (15) — the first is a plural our
singular name cannot reach, which is the same trap that keeps `invoicing` (68) out of
reach of a name containing `invoice`.
