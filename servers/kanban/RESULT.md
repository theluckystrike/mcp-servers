status: DONE

evidence:
- `npm install` (root, workspaces): `added 2 packages in 336ms`
- `npm run build -w servers/kanban`: `tsc -p tsconfig.json` clean, no output
- `npm test -w servers/kanban`: `# tests 11 / # pass 11 / # fail 0 / # duration_ms 504.8`, wall `npm test 0.699 total`
  - test/board.test.mjs 5 tests: ids (NOVA-1 / NOVA-Z / NOVA-12 base36, 500 unique), done column on renamed boards,
    overdue day-key boundary (due 2026-03-10 not overdue on 2026-03-10, overdue on 2026-03-11, month and year rollover),
    estimate/actual totals skipping tasks with no number, project resolution exact/prefix/ambiguous
  - test/smoke.test.mjs 2 tests: initialize, tools/list (16 tools), 5 tasks across 2 projects (NS-1..NS-3, AA-1..AA-2),
    move, board counts and estimate totals, overdue, task_start_timer handoff checked against the LIVE time-tracker
    timer_start schema and then actually started there (`Started timer for "Nova Site" - Write the launch email`),
    free 4th project refused with `https://mcp.zovo.one/buy/kanban`, pro key allows 5 projects + columns_set + past weeks
  - test/corrupt.test.mjs 3 tests: truncated data.json quarantined byte-for-byte, marker blocks later writes, no fresh
    data.json appears, malformed board row ignored, counter continues (NOVA-4 -> NOVA-5)
  - test/concurrency.test.mjs 1 test: two processes, 40 task_add on ONE board, 41 tasks, 41 unique ids, counter == 41
- `node scripts/validate.mjs`: existing 13 servers 300/300 (kanban is not in the validator's hardcoded list)

artifacts:
- /Users/mike/mcp-servers/servers/kanban/src/{index.ts,board.ts,day.ts,jsonstore.ts}
- /Users/mike/mcp-servers/servers/kanban/test/{board,smoke,corrupt,concurrency}.test.mjs
- /Users/mike/mcp-servers/servers/kanban/{package.json,tsconfig.json,README.md,LICENSE,server.json,server.mcpb.json,
  smithery.yaml,glama.json,Dockerfile,llms-install.md}
- /Users/mike/mcp-servers/assets/kanban-logo.png (400x400, #12586e ground, white "KB")

cost: 34 wall minutes

failures:
- The smoke test parsed the timer_start arguments out of the tool text with first-`{` to last-`}`, and the trailing
  hint line itself contained `{ id: ..., minutes: N }`, so the slice was two JSON objects and threw. Fixed in the
  server text, not the test: the hint now names the tool and id in prose, so the only braces in the reply are the
  arguments the model must forward.

insight:
- The id counter is the concurrency risk, not the task list. time-tracker's concurrency test writes to two different
  projects, so an unlocked run only loses rows; here both writers had to target ONE board, because the failure mode
  is a REISSUED id (two tasks called NOVA-7) that no later count can detect. 40 adds on one board under withFileLock
  gave 41 unique ids and a counter of exactly 41.
