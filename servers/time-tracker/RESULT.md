status: DONE

evidence:
```
$ export npm_config_cache=/Users/mike/.npm-cache-local
$ cd /Users/mike/mcp-servers && npm install --no-audit --no-fund
changed 4 packages in 240ms

$ npm run build -w servers/time-tracker
> tsc -p tsconfig.json && node -e "import('node:fs').then(f=>f.chmodSync('dist/index.js',0o755))"
(no output, exit 0)
npm run build -w servers/time-tracker  1.67s user 0.09s system 235% cpu 0.748 total

$ npm test -w servers/time-tracker
> node --test test/*.test.mjs
ok 1 - free tier: initialize, tools/list, timer, report, gating
ok 2 - pro tier: a signed key unlocks invoice_summary, tag grouping and full history
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 254.846916
```

Test coverage: both tests spawn dist/index.js over stdio JSON-RPC with XDG_DATA_HOME and
XDG_CONFIG_HOME pointed at a fresh mkdtemp sandbox. Test 1 (free): initialize -> tools/list
(13 tools asserted) -> resources/list -> prompts/list -> license_status -> timer_start ->
timer_status -> timer_stop -> project_set_rate -> entry_add -> report(json) -> the four free
gates (invoice_summary, group_by tag, 3rd rated project, 7-day clamp) -> entry_list ->
export_csv (file existence checked on disk). Test 2 (pro): MCP_LICENSE_KEY set to a key minted
by `node scripts/sign-license.mjs time-tracker`; asserts tier pro, 5 rated projects accepted,
group_by tag returns ["dev","meeting"], invoice_summary returns "TOTAL 2.50 h  USD 300.00",
no 7-day note on entry_list or export_csv, resources/read and prompts/get.

artifacts:
/Users/mike/mcp-servers/servers/time-tracker/src/index.ts
/Users/mike/mcp-servers/servers/time-tracker/package.json
/Users/mike/mcp-servers/servers/time-tracker/tsconfig.json
/Users/mike/mcp-servers/servers/time-tracker/README.md
/Users/mike/mcp-servers/servers/time-tracker/LICENSE
/Users/mike/mcp-servers/servers/time-tracker/server.json
/Users/mike/mcp-servers/servers/time-tracker/smithery.yaml
/Users/mike/mcp-servers/servers/time-tracker/Dockerfile
/Users/mike/mcp-servers/servers/time-tracker/test/smoke.test.mjs
/Users/mike/mcp-servers/servers/time-tracker/dist/index.js

cost: 17 wall minutes

failures:
1. First green test run reported duration_ms 10315 against 122 ms and 133 ms subtests. Cause:
   the per-request timeout `setTimeout(..., 10000)` in the stdio client held the event loop open
   after both tests passed. Fixed with `t.unref()`; run time went 10315 ms -> 255 ms.
No build or type errors; `tsc` was clean on the first compile.

insight:
Money must be derived from seconds and an integer cents rate in one rounding step, not by
rounding hours first. `invoice_summary` reverses the aggregate to display a rate
(`rate = round(cents * 3600 / seconds)`) so a task built from several entries with different
per-entry rate overrides still shows a single blended rate whose hours * rate matches the
printed amount exactly; rounding hours to 2 dp first would make the line items fail to sum to
the total on any duration that is not a whole minute.
