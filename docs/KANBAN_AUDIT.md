# mcp-kanban: adversarial audit and user-value run

Date 2026-09-04. Scope: `servers/kanban` only. Zero paid API calls, zero network calls
(`grep -rEn "fetch|https?://|node:http|node:net|node:dns" servers/kanban/src/` returns nothing).

Part 1 harness: `/private/tmp/kbaudit/probe.mjs` spawns `node servers/kanban/dist/index.js` with a fresh
`XDG_DATA_HOME` per run, writes JSON-RPC lines to stdin, times every call, and flags any stdout line that
does not parse as JSON. Four runs, 5,041 requests, free tier (`MCP_LICENSE_KEY=""`) except where a Pro key
from `scripts/sign-license.mjs kanban` is stated. Run 5 spawns kanban and time-tracker against ONE
`XDG_DATA_HOME` to test the timer handoff across the two stores.

Part 2 harness: the real `claude` CLI (2.1.260) as an MCP client, `--model sonnet`, against
`/private/tmp/uv-kb/mcp.json`, which registers `kanban` and `time-tracker` together with
`--strict-mcp-config`, fresh `XDG_DATA_HOME=/private/tmp/uv-kb/data` and
`XDG_CONFIG_HOME=/private/tmp/uv-kb/cfg`, free tier, and an explicit per-tool allowlist of all 30
`mcp__kanban__*` / `mcp__time-tracker__*` tools (the wildcard form `mcp__*` grants nothing;
docs/USER_VALUE_R6.md D-E4, docs/USER_VALUE_R9.md). Every other tool is disallowed, so the model can only
answer through the two servers. Machine day during the run: Friday 2026-09-04.

---

## Part 1 - adversarial probes

| # | Probe | Before | Fixed | After |
| --- | --- | --- | --- | --- |
| 1 | `task_add` with no arguments | PASS | - | zod: `Required at title` |
| 2 | `task_add {title: 123}` (wrong type) | PASS | - | zod: `Expected string, received number at title` |
| 3 | `task_add` with a 1 MB `title` | **FAIL (stored, 15 ms)** | yes | `must be 300 characters or fewer at title` |
| 4 | `task_add` with a 1 MB `notes` | **FAIL (stored)** | yes | `must be 5000 characters or fewer at notes` |
| 5 | `task_add` with a 200,000-char `project` | **FAIL (created a board)** | yes | `must be 100 characters or fewer at project` |
| 6 | `task_add` with 1,000 tags of 1 KB each | **FAIL (stored)** | yes | `Array must contain at most 30 element(s) at tags` |
| 7 | `task_add {project: "   "}` | **FAIL: created a board named `""`** | yes | `project is blank. Give a board name, or leave project out to use your current board.` |
| 8 | any later `task_add` after probe 7 | **FAIL: swallowed by the blank board** | yes | see D-K2 below |
| 9 | `due: "2026-13-45"` | PASS | - | `due is not a valid date: 2026-13-45` |
| 10 | `due: "tomorrow"` | PASS | - | resolved to 2026-09-05 |
| 11 | `due: "next Friday"` | **FAIL (refused)** | yes | resolved to 2026-09-11 (strictly after today) |
| 12 | `due: "friday"` | **FAIL (refused)** | yes | resolved to 2026-09-04 (nearest on or after today) |
| 13 | `due: "sometime soon"` | PASS | - | `not a valid date ... Use YYYY-MM-DD, "today" or "+3d".` |
| 14 | `estimate_minutes: -5` | PASS | - | zod: `must be at least 0 at estimate_minutes` |
| 15 | `estimate_minutes: 1e9` | **FAIL: stored, rendered `16666666h 40m`** | yes | `must be 100000 minutes (about 69 days) or fewer` |
| 16 | `task_log_time {minutes: 1e9}` | **FAIL (same)** | yes | same message; the running total is also checked against the ceiling |
| 17 | `task_log_time {minutes: 1.5}` | PASS | - | zod: `Expected integer, received float` |
| 18 | `priority: "urgent!"` / `"HIGH"` / `"1"` | PASS | - | zod names the four legal values |
| 19 | column `"  To Do  "`, `"дела"`, `"   "` on a default board | PASS | - | each refused by name with the board's real column list |
| 20 | `task_move` to an unknown column | PASS | - | `"nope" is not a column on Nova. Columns: backlog, todo, doing, review, done.` |
| 21 | `task_move` / `task_log_time` with an unknown id | PASS | - | `no task with id ZZZ-9. Run task_list to see the ids.` |
| 22 | a task id from another project | PASS | - | ids are global, columns are per board: `NOVA-1` cannot be moved into Alpha's column, and `task_update {project}` moves the row and re-seats its column |
| 23 | `columns_set ["only", "   "]` (Pro) | **FAIL: silent data loss** | yes | `a board needs at least 2 named columns; 1 of the 2 you gave were blank. Nothing was changed.` |
| 24 | `columns_set` with 500 columns | **FAIL (accepted)** | yes | `Array must contain at most 12 element(s) at columns` |
| 25 | `columns_set` with a 1 MB column name | **FAIL (accepted)** | yes | `must be 40 characters or fewer at columns[1]` |
| 26 | `columns_set ["To Do","В работе","Done"]` | PASS | - | `to do -> в работе -> done`; `task_move {column: "В РАБОТЕ"}` then works. Spaces and non-ASCII are legal, blanks are not |
| 27 | delete a task carrying 90 logged minutes | **FAIL (silent)** | yes | the reply names the minutes lost and says the time-tracker store was not touched |
| 28 | 5,000 tasks across 2 boards: add | PASS | - | 18.9 s, 3.8 ms/add, 1.54 MB `data.json` (every add takes the file lock and rewrites the file) |
| 29 | 5,000 tasks: `task_list` / `board` / `overdue` / `task_search` | **FAIL (output size)** | yes | 13 ms but **430,208 characters** for one `task_list`. Now capped at 200 rows (`limit`, max 2,000) with a truncation line: 17.5 KB, 12 ms |
| 30 | `weekly_review` for a week with no tasks | PASS | - | `Week 2019-W03 (2019-01-14 to 2019-01-20)\nNothing planned and nothing completed.` |
| 31 | `weekly_review {week: "banana"}` | PASS | - | `week must look like 2026-W36, got "banana"` |
| 32 | `overdue {as_of: "2026-13-45"}` / `"next Monday"` | mixed | yes | the bad date is refused; `next Monday` now resolves (probe 11) |
| 33 | kanban board "Nova", time-tracker project "Nova App" | **FAIL: silent misfiling** | yes | see D-K10 below |
| 34 | corrupt `data.json` quarantined, marker blocks later writes | PASS | - | unchanged from the build run: byte-for-byte quarantine, no fresh `data.json`, counter continues |
| 35 | two processes, one data dir, 40 `task_add` on ONE board | PASS | - | 41 tasks, 41 unique ids, counter 41 (`withFileLock`) |
| 36 | stdout carries only JSON-RPC | PASS | - | no `console.*` in `src/`; the probe flagged no non-JSON line across all runs, and `test/adversarial.test.mjs` asserts it |
| 37 | no network | PASS | - | grep over `src/` for `fetch`, `http`, `net`, `dns` returns nothing |

### The three that lost data

**D-K2. A blank project name became a board that swallowed every later project.**
`task_add {project: "   ", title: "pe"}` created a board whose `name` is `""` and whose slug is `TASK`.
`resolveProject` then matched it against everything, because `q.startsWith(k)` is true for every `q` when
`k` is the empty string. The very next probe, a 200,000-character project name, came back
`Used the existing project "" (you said "zzz...")` - every subsequent task in that data dir would have
landed on the blank board. Fix in two places: `task_add` refuses a blank project by name, and
`resolveProject` never near-matches on an empty stored name, so an existing damaged store cannot keep
doing it.

**D-K4. `columns_set` collapsed a board to one column and every task on it silently read as done.**
`columns.min(2)` ran on the raw array; the blanks were dropped afterwards with `.filter(Boolean)`. So
`["only", "   "]` left `columns: ["only"]`. That single column is what `doneColumn()` returns, so
`isDone()` was true for every task on the board: `board` reported `1 task(s), 0 open` and `task_list`
answered `No tasks match`. Nothing was deleted, but the board was empty from the user's side with no error.
The validation now runs on the normalised list and names how many entries were blank.

**D-K9. One `task_list` on a 5,000-task board returned 430 KB.**
Timing was never the problem (13 ms). The problem is that a single tool result of 430,208 characters is
roughly 110,000 tokens: it does not fit in a model's context, and the client that asked "what is on the
board" gets nothing usable. `task_list`, `task_search` and `overdue` now print 200 rows by default, take a
`limit` (max 2,000), and end with `Showing the first 200 of 5000. Narrow it with project/column/tag/due_before,
or raise limit (max 2000).` The totals line still counts all 5,000, so no number changes.

### The cross-server one

**D-K10. The two servers resolve project names by the same rule, and that is what breaks them.**
`task_start_timer` hands `{project: <board name>, task: <title>}` to time-tracker's `timer_start`.
time-tracker resolves an unknown name by unique prefix or containment (the D-7 rule this server also uses).
With a kanban board called `Nova` and a time-tracker project called `Nova App`, the reply was
`Used the existing project "Nova App" (you said "Nova"). Started timer for "Nova App"` - the kanban task
records a `timer_links` entry saying `Nova`, the time-tracker entry says `Nova App`, and any later
`report {project: "Nova"}` misses the hours. Neither store says anything is wrong.
`task_start_timer` now reads the sibling `time-tracker/data.json` under the same XDG data root (read-only,
best effort, a corrupt or missing file is ignored) and warns before the timer is started:

    Warning: the time tracker has no project called "Nova" but it does have "Nova App", and it matches
    partial names, so it will log this time under "Nova App" instead. The two stores would then disagree.
    Rename this board to "Nova App", or tell the user before you continue.

When the sibling store holds two candidates the warning says the call will be refused as ambiguous instead.

### Accepted date forms after the fix

`YYYY-MM-DD` (a real calendar day only), `today`, `tomorrow`, `yesterday`, `+Nd`, a bare weekday
(`friday`, `fri`, `wed`) meaning the nearest one on or after today, and `next <weekday>` / `coming <weekday>`
meaning the nearest one strictly after today. Anything else, including `2026-13-45` and `sometime soon`, is
refused with the list of forms. A full timestamp is still reduced to the day it falls on in the profile's
home zone.

---

## Edits made

| File | Change |
| --- | --- |
| `src/board.ts` | `MAX_TITLE` 300, `MAX_NOTES` 5000, `MAX_PROJECT` 100, `MAX_ID` 64, `MAX_COLUMN_NAME` 40, `MAX_COLUMNS` 12, `MAX_TAGS` 30, `MAX_TAG` 60, `MAX_QUERY` 200, `MAX_MINUTES` 100000, `DEFAULT_ROW_LIMIT` 200, `MAX_ROW_LIMIT` 2000 |
| `src/board.ts` | `resolveProject` never near-matches an empty stored project name (D-K2) |
| `src/index.ts` | `text(max, min)` and `minutes({negative})` schema helpers applied to every caller-set string and number |
| `src/index.ts` | `task_add` refuses a blank `project` by name (D-K2) |
| `src/index.ts` | `parseDay` accepts bare and `next` weekday names (D-K6) |
| `src/index.ts` | `capRows()` + a `limit` argument on `task_list`, `task_search` and `overdue` (D-K9) |
| `src/index.ts` | `columns_set` validates the normalised column list, min 2 named, max 12 (D-K4) |
| `src/index.ts` | `task_log_time` checks the running total against `MAX_MINUTES` |
| `src/index.ts` | `task_delete` reports the logged minutes it is discarding and that the time-tracker store is separate (D-K7) |
| `src/index.ts` | `timeTrackerProjects()` + a collision warning in `task_start_timer` (D-K10) |
| `test/adversarial.test.mjs` | new, 8 tests covering every probe class above |
| `README.md` | free/pro table row for the listing cap; the date forms `task_add` accepts |

---

## Part 2 - user value through the claude CLI

Six prompts, one conversation (`--continue`), sonnet, both servers registered, per-tool allowlist, every
other tool disallowed. Scores are 0-3 and are checked against BOTH stores on disk, not against the model's
prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "Plan my week for Nova: API design (3h, due Wednesday), docs (2h, Friday), client call prep (1h, Tuesday)." | 3 | Three `task_add` calls, one board. Store: `NOVA-1 Client call prep due 2026-09-08 est 60`, `NOVA-2 API design due 2026-09-09 est 180`, `NOVA-3 Docs due 2026-09-11 est 120`, all in `backlog`, board `Nova` slug `NOVA`, counter 3. Today was a Friday, and it said so unprompted rather than dating "Friday" to today: "today (Sep 4) is a Friday, so I scheduled these for *next* week's Tue/Wed/Fri" |
| 2 | "What is on the board?" | 3 | One `board` / `task_list`. Three rows, correct column, correct due dates, 6h total. No invented state |
| 3 | "Start working on the API design." | 3 | `task_move NOVA-2 -> doing`, then `task_start_timer`, then time-tracker `timer_start` with the arguments the handoff printed. Kanban store: `NOVA-2 column doing`, `timer_links [{at: 2026-09-04T01:14:16.035Z, project: "Nova", task: "API design"}]`. time-tracker store: `running {project: "Nova", task: "API design", start: 2026-09-04T01:14:19.351Z}`. Both stores agree on the project name |
| 4 | "Stop, that took 90 minutes, and mark it done." | 3 | time-tracker `timer_stop` then an edit to the stated duration, kanban `task_log_time 90` and `task_done`. time-tracker store: one entry, `seconds 5400`, `running null`. Kanban store: `NOVA-2 column done, estimate_minutes 180, actual_minutes 90, done_at 2026-09-04T01:14:39.010Z` |
| 5 | "What is overdue as of next Monday?" | 3 | `overdue {as_of}` resolving to 2026-09-07. Correct answer: nothing, because NOVA-1 is due Sep 8 and NOVA-3 Sep 11, and NOVA-2 is done. This prompt is the reason D-K6 was fixed: before it, `as_of: "next Monday"` was an error and the model had to guess a date |
| 6 | "Give me the weekly review." | 3 | `weekly_review` for 2026-W36 (2026-08-31 to 2026-09-06). Planned 0, completed 1, estimate 3h, actual 1h 30m - the 180 against 90 the run was built to produce, with the server's own "1h 30m under" line. The two tasks due next week are correctly outside this week's numbers, and the model said so |

Scorecard: **3.00 / 3** (18 of 18) after the Part 1 fixes. No permission refusal, no fallback to a
non-MCP tool, no `--strict-mcp-config` drop-out of the kind docs/CALENDAR_AUDIT.md H-1 recorded.

Two of the six prompts would have scored lower on the shipped build: prompt 5 (`as_of: "next Monday"`
was a hard error) and prompt 1 (`due: "Wednesday"` was a hard error, so the plan depended on the model
converting weekdays to dates itself). Both are Part 1 fixes, so the round-2 score is measured after them.

### Not defects

- The model rendering the weekly review as a Markdown table rather than the server's fixed-width one. The
  server's text is what it was given; reformatting is the client's job.
- Ids stay with their original prefix after `task_update {project}` (`NOVA-1` living on the Alpha board).
  Ids are handed out once and never reused, which is what makes them safe to say out loud.

---

## Final test summary

    npm run build -w servers/kanban   tsc clean, no output
    npm test -w servers/kanban        # tests 19 / # pass 19 / # fail 0 / # duration_ms 21103.6
                                      wall: npm test 21.262 total

19 tests: `board.test.mjs` 5, `smoke.test.mjs` 2, `corrupt.test.mjs` 3, `concurrency.test.mjs` 1,
`adversarial.test.mjs` 8 (oversized and out-of-range arguments; the blank-project board; due-date forms
including 2026-13-45, weekdays and `next Monday`; column names with spaces, non-ASCII, blanks and the
one-column collapse; delete with logged time; 5,000 tasks bounded in time and output size; an empty
`weekly_review` week; the time-tracker project-name collision warning). The 5,000-task test is the whole
21 s: 5,000 locked writes at 3.8 ms each.

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build -w servers/kanban: tsc clean
    - npm test -w servers/kanban: # tests 19 / # pass 19 / # fail 0 / # duration_ms 21103.6 (wall 21.262 s)
    - Part 1: 37 probes over 4 harness runs + 1 cross-server run, 5,041 requests, 0 non-JSON stdout lines,
      0 network calls. 12 probes failed on the shipped build; all 12 fixed and covered by
      test/adversarial.test.mjs
    - Part 2: claude CLI 2.1.260, sonnet, kanban + time-tracker, per-tool allowlist, 6 prompts, 3.00/3,
      both stores verified on disk (kanban NOVA-2 est 180 / actual 90 / done_at set; time-tracker one
      entry seconds 5400, running null)
    artifacts:
    - /Users/mike/mcp-servers/servers/kanban/src/{index.ts,board.ts}
    - /Users/mike/mcp-servers/servers/kanban/test/adversarial.test.mjs
    - /Users/mike/mcp-servers/servers/kanban/README.md
    - /Users/mike/mcp-servers/docs/KANBAN_AUDIT.md
    cost: 30 wall minutes
    failures:
    - Three probes lost user data silently rather than erroring: a blank project name created a board that
      near-matched every later project (D-K2), columns_set with a blank entry collapsed a board to one
      column which is also its done column so every task read as done (D-K4), and a kanban board whose name
      is a prefix of a time-tracker project sent its timer to the other project (D-K10).
    insight:
    - The 5,000-task probe was written to find a slow path and found a context bomb instead: task_list
      answered in 13 ms and returned 430,208 characters, about 110,000 tokens. For an MCP server the
      binding limit on a listing tool is the client's context, not the event loop, and nothing in a timing
      probe measures it. Row caps, not indexes, were the fix.

Built by theluckystrike. https://github.com/theluckystrike
