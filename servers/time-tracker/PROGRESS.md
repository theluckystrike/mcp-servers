# time-tracker — spec-tools task progress

STATUS: done

## Situation
servers/time-tracker already existed (v0.22.5, mature 13-tool server from a prior sprint,
previous RESULT.md: DONE). Task spec required 8 tools that did not all exist
(entry_log, summary_day, summary_week, summary_client, target_set, target_check were missing;
entry_list and export_csv already existed).

## Changes
- src/index.ts:
  - DB gained `targetHours` (weekly goal, persisted in data.json, defaulted to 0 on load).
  - Free-tier gate: entry_add and entry_log refuse writes once db.entries >= 100
    (message via gate.upgradeText; Pro unaffected).
  - New tools: entry_log (client, project, minutes, note — logs now-minus-minutes..now,
    resolves client via resolveProject with ambiguity text), summary_day (per-project
    breakdown, local day, hours via dayKey), summary_week (Mon–Sun window),
    summary_client (all-time hours/count/last-day for one project), target_set,
    target_check (percent + remaining).
- test/contract.test.mjs: tool count 14 → 20.
- test/spec-tools.test.mjs (NEW): 7 tests following the smoke-test stdio-JSON-RPC client
  style — tools/list advertises all 8 spec tools; entry_log + entry_list roundtrip;
  summary_day totals (1.75 h across 3 entries, sorted desc, empty-day output);
  summary_week Mon–Sun window; summary_client isolation; target_set/target_check math
  (2.50 h of 10 h = 25%, 7.50 h remaining); free-tier 100-entry gate (seeds sandbox
  data.json with 100 entries, expects upgrade text).

## Evidence
```
$ npm run build -w servers/time-tracker
> tsc -p tsconfig.json && node -e "...chmodSync('dist/index.js',0o755)"   (exit 0)

$ npm test -w servers/time-tracker
# tests 43
# pass 42
# fail 0
# cancelled 0
# skipped 1
# duration_ms 1892.9
```
(1 skip is pre-existing; the 8 new/updated spec tests all pass.)

## Issues
- Root `npm install` in the workspace fails with a 404 (unpublished @theluckystrike
  workspace-internal dep hits the public registry). Not a blocker: node_modules is
  already populated and both `npm run build` and `npm test` pass. Pre-existing, not
  caused by this change.
- Two iteration fixes: resolveFilter kinds are "ok"/"ambiguous" (no "none"), and the
  sandbox DB path is $XDG_DATA_HOME/mcp-servers/time-tracker/data.json.

Not done per instructions: no publish, no git commit.
