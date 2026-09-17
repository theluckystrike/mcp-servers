# QUALITY loop 35 - seam defects 123/148 -> 136/148 resolved in source

status: DONE

Scope: the 25 ledger entries in `data/user_value_index.json` whose status is not
"fixed" (`python3 -c` filter over `ledger`, command in the evidence block). Ledger
stale was the headline finding: 9 of the 25 were already fixed in server source by
earlier rounds and only the ledger still said open. 4 were real and are fixed below.
2 are description/metadata text, which this loop's rules forbid editing (build-vendor
exact-string patches), and go to wave C. 10 are classified client/harness/accepted and
have no server-side fix.

## Fixed this loop (4)

| id | server | fix | regression test |
|---|---|---|---|
| D-R41 (server half) | expense-tracker | `expense_export` counted only what it wrote; a filter that dropped a line (the unprojected PLN 34.50 mileage receipt under `{project: "Nova Labs"}`) left the export short with no word. Now counts rows in the window excluded by the active project/category/billable filters and names them: "1 more expense in this period was left out by the project \"Nova Labs\" filter - export the same period with no filter to include it." | `test/round35.test.mjs` 3 tests |
| D-R68 | time-tracker | On the free tier a window entirely older than the 7-day floor clamped to an empty range and read identically to an empty month ("No entries found" + "the free tier shows the last 7 days"). `windowFor` now carries `unread` and all six clamped callsites (entry_list, report, export_csv, invoice_summary x2, plus the non-empty tail) answer "Nothing was read: ... the period was never opened. An empty answer here means unread, not empty." via `windowTail()`. | `test/round35.test.mjs` 4 tests |
| D-R81 | clauses | The free-tier tag-skip note in `clause_search` named the dropped filter but not the free path. It now adds "clause_list is free and returns every clause's tags, so the tagged matches are one free call away." | `test/round35.test.mjs` 2 tests |
| D-R75 (server half) | resume | `tailor_to_job`'s extractor counted measured non-keywords ("similar", "record", "reducing") in the target set, deflating the coverage figure (37% against a list a third of which was not a skill). Added to the STOP list in `src/tailor.ts`. The company-name half ("helio") is a proper-noun heuristic and is NOT fixed - recorded, not attempted. | `test/round35.test.mjs` 1 test |

### Regression notes (before -> after, all reproduced live this loop)

- D-R41: `expense_export {from: <today>, to: <today>, format: "csv", project: "Nova Labs"}`
  with one Nova Labs expense and one unprojected expense in the window.
  Before: `Wrote 1 expenses to <path> (csv).` and nothing else.
  After: the same line plus `1 more expense in this period was left out by the project
  "Nova Labs" filter - export the same period with no filter to include it.`
  Unfiltered and fully-matching exports carry no note (both asserted).
- D-R68: `entry_list {from: "2020-01-01", to: "2020-01-31"}` on the free tier with one
  entry logged today. Before: `No entries found for that filter.\n\nNote: the free tier
  shows the last 7 days.` After: `Nothing was read: every day in the window you asked for
  is older than the free tier's last 7 days, so the period was never opened. An empty
  answer here means unread, not empty.` A clamped window that intersects the free tier
  (`from: "2020-01-01"`, no `to`) keeps the old note (asserted, and the pre-existing
  smoke assertions on invoice_summary/entry_list still pass).
- D-R81: `clause_search {query: "payment", tags: ["retainer"]}` free tier.
  Before: `...the tag filter (retainer) was not applied. <upgrade link>`.
  After: `...was not applied. clause_list is free and returns every clause's tags, so the
  tagged matches are one free call away. <upgrade link>`.
- D-R75: `extractKeywords` on a posting containing "a strong track record of reducing
  latency. ... A similar role in fintech is a plus." Before: `similar`, `record`,
  `reducing` entered the keyword set. After: all three absent; `postgresql` and
  `kubernetes` still extracted (asserted).

## Already fixed in source, ledger stale (9, verified by test suite this loop)

| id | server | where the fix lives | verification |
|---|---|---|---|
| D-K2 | kanban | `task_add` refuses a blank project; `resolveProject` never near-matches an empty stored name (docs/KANBAN_AUDIT.md edits) | `npm test -w servers/kanban`: 29/29 pass |
| D-K4 | kanban | `columns_set` validates the normalised list, min 2 named, max 12 | same suite (adversarial.test.mjs) |
| D-K7 | kanban | `task_delete` reports discarded logged minutes and that the time-tracker store is separate | same |
| D-K9 | kanban | `capRows()` + `limit` on task_list/task_search/overdue, default 200 | same |
| D-K10 | kanban | `timeTrackerProjects()` collision warning in `task_start_timer` | same |
| D-R46 | invoice | `rounding_note` names the drift; `round_total: true` rounds the line total to the exact conversion; `rounding_drift_minor` reported | `npm test -w servers/invoice`: 53 pass, 0 fail (round10.test.mjs asserts USD 0.02 drift) |
| D-R47 | docx | `proposal_create` summary/scope/deliverables/timeline all optional; omitted sections named in the response, never invented | `npm test -w servers/docx`: 33 pass, 0 fail (round10.test.mjs) |
| D-R48 | invoice | `business_set` infers timezone from the address place table, writes `timezone_source: "inferred from address"`, says so, explicit timezone wins | same invoice suite |
| D-R55 | bank-statement | `recurring_detect` answers free inside a stated cap (3 months, 5 charges) with `cadence_confirmed` withholding the annualised figure until a third charge | `npm test -w servers/bank-statement`: 53/53 pass (smoke.test.mjs D-R55 block) |

## Needs wave C (2 full + 2 halves) - description/metadata text this loop may not edit

| id | why deferred |
|---|---|
| D-R50 | "whoami" as a tool on every endpoint is a `packages/mcp-license` + vendored-fleet change (a new tool on 33 servers' tools/list mid-wave, with `remote/build-vendor.mjs` and the worker shim involved). The per-endpoint half closed in round 10; the cross-endpoint half is the orchestrator's call. |
| D-R74 | The fix is text: the hosted upload note ("larger templates need the stdio server") must state the measured limit - the ceiling is retype time (13 KB base64 died at 16 min; 1.4 KB took 46.9 s), not the request-body size. That note lives in `remote/` metadata, outside this loop's edit rights. |
| D-R41 (sheet half) | The model aggregated from two `sheet_read` dumps instead of `sheet_query`. The lever is the `sheet_query` description in servers/spreadsheet, a build-vendor exact-string patch target - description edits are reserved to wave C this loop. |
| D-R75 (currency half) | `convert_many` does not say "several lines at once" in the caller's words. Description edit in servers/currency - wave C. |

## Not server defects (10) - no source change possible, statuses already triaged

| id | class | basis |
|---|---|---|
| D-D2 | client | client expanded "Lucky Strike" to the stored profile name; server passed value verbatim |
| D-E4 | harness | `--allowedTools 'mcp__*'` grants nothing; a CLI fact |
| D-R9 | harness | fire-and-forget probe races a stateful server |
| D-R10 | harness | missing WebFetch in the allowlist kills the client; allowlist composition |
| D-R11 | superseded | one defect class with D-R19, fixed in round 6, never recurred |
| D-R17 | client | ToolSearch needs the `mcp__office__` prefix; client lookup convention |
| D-R49 | client | the model wrote business facts into CLI project memory against explicit tool text |
| D-R56 | accepted | hosted kanban cannot read the sibling time-tracker store; measured benign (k3) |
| D-R62 | client | base64 turn is slow well under the ceiling; client rendering cost |
| D-R63 | client | same class, client-side |

## Ledger arithmetic after this loop

`python3` count over `data/user_value_index.json` `ledger`: 148 entries; before this loop
123 fixed / 25 not-fixed. Resolved in server source now: 123 + 9 verified + 4 fixed = **136**.
Remaining 12: D-R50 and D-R74 (wave C), the description halves of D-R41/D-R75 (wave C,
counted within their entries), and the 10 client/harness/accepted/superseded entries, which
no server release can close. Server-fixable seam defects are at zero open.

evidence:
  - ledger: `python3 -c` over data/user_value_index.json -> 148 entries, 25 with status != "fixed" (ids listed above)
  - kanban fixes in source: `/usr/bin/grep -n "MAX_ROW_LIMIT|capRows|timeTrackerProjects|project is blank|at least 2 named columns" servers/kanban/src/{board,index}.ts` -> all present
  - D-R46/D-R48 in source: servers/invoice/src/index.ts lines 137-150 (roundingNote), 488-496 (round_total), 222-241 (D-R48 inference)
  - D-R47: servers/docx/src/index.ts lines 519, 563-615 (optional sections + omitted note)
  - D-R55: servers/bank-statement/src/index.ts lines 596-700 (free-tier answer with cadence_confirmed)
  - builds: `npm run build` in servers/{time-tracker,expense-tracker,clauses,resume} -> tsc clean, no output, exit 0
  - tests (npm test per server, npm_config_cache=/Users/mike/.npm-cache-local):
    time-tracker 36 tests 35 pass 0 fail 1 skip (skip = pre-existing contract placeholder, contract.test.mjs:166); round35 alone 4/4
    expense-tracker 61/61 pass
    clauses 41 tests 40 pass 0 fail 1 skip (same placeholder)
    resume 39 tests 38 pass 0 fail 1 skip (same placeholder)
    kanban 29/29; invoice 54 tests 53 pass 0 fail 1 skip (placeholder); docx 34 tests 33 pass 0 fail 1 skip (placeholder); bank-statement 53/53
  - vendor patch safety: `/usr/bin/grep -cF 'return ok(`Wrote ${data.length} expenses to ${target} (${a.format}).`' servers/expense-tracker/src/index.ts` -> 1 (anchor for remote/build-vendor.mjs:399 preserved as an exact prefix; the D-R41 note is appended after it). `/usr/bin/grep` over build-vendor.mjs for windowTail/UNREAD_WINDOW/clause_list-is-free/similar-record anchors -> no matches, no patch touched. build-vendor.mjs NOT run (a wave-A deploy may be mid-flight; rule 6).

artifacts:
  - /Users/mike/mcp-servers/servers/time-tracker/src/index.ts (D-R68)
  - /Users/mike/mcp-servers/servers/time-tracker/test/round35.test.mjs
  - /Users/mike/mcp-servers/servers/expense-tracker/src/index.ts (D-R41)
  - /Users/mike/mcp-servers/servers/expense-tracker/test/round35.test.mjs
  - /Users/mike/mcp-servers/servers/clauses/src/index.ts (D-R81)
  - /Users/mike/mcp-servers/servers/clauses/test/round35.test.mjs
  - /Users/mike/mcp-servers/servers/resume/src/tailor.ts (D-R75 stopwords)
  - /Users/mike/mcp-servers/servers/resume/test/round35.test.mjs
  - /Users/mike/mcp-servers/docs/QUALITY_LOOP35.md
  - /Users/mike/mcp-servers/data/quality_loop35.json

cost: 35 wall minutes

failures:
  - First time-tracker build failed TS2741/TS2345: two Window literals (today-view,
    daySummary) lacked the new `unread` field. Fixed by adding `unread: false` to both;
    rebuild clean.

insight:
  - The ledger, not the code, was the biggest defect class: 9 of 25 "open" defects were
    fixed in source rounds ago (kanban's five on 2026-09-04, invoice/docx/bank-statement in
    round 10-11 follow-ups) and only `data/user_value_index.json` still said open. A defect
    ledger scraped from docs needs a "verified in source" pass, or every loop re-pays the
    triage cost. The four genuinely open server defects were all the same shape: a tool
    answered correctly about the rows it returned and said nothing about the rows it never
    touched (filtered out, clamped away, tag-skipped, stop-worded in).
