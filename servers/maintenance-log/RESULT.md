status: DONE

evidence:
  build: |
    $ cd servers/maintenance-log && npm_config_cache=/Users/mike/.npm-cache-local npm run build
    tsc -p tsconfig.json --declaration && node -e "import('node:fs').then(f=>f.chmodSync('dist/index.js',0o755))"
    exit=0, 1.641 total
  tests: |
    $ cd servers/maintenance-log && npm_config_cache=/Users/mike/.npm-cache-local npm test
    # tests 7
    # pass 7
    # fail 0
    # duration_ms 2012.854791
    2.332 total
  stdio smoke (node test/_smoke-once.mjs spawns dist/index.js, sandboxed XDG_DATA_HOME, Pro key from scripts/sign-license.mjs): |
    initialize: mcp-maintenance-log 0.1.0
    tools/list: asset_add, maintenance_log, maintenance_due, asset_history, maintenance_export, asset_remove, license_status, license_activate
    asset_add: AST-2026-0001 Lathe
    maintenance_log: 2020-01-06 Oil and filter change, cost USD 120.00, next_due 2020-04-05
    maintenance_due: today 2026-09-12; overdue_count 1; first overdue AST-2026-0001 (Lathe) next_due 2020-04-05 days_overdue 2351
    stderr: mcp-maintenance-log 0.1.0 ready; store at .../mcp-servers/maintenance-log
  suite coverage: full free-tier flow (add, log, history with hand-recomputed totals, CSV
    export of a range with quoting), the due report refused on free with the upgrade text
    and computed on Pro (overdue, due-soon window, scheduled-later, unscheduled),
    Markdown export gated on free and per-asset on Pro with pipe-escaping, the 3-asset
    cap with removal freeing the slot and Pro lifting it, asset_remove with the confirm
    guard and burned numbers, guards (future work date, unreal date, both schedule forms,
    next_due before the work date, duplicate tag, ambiguous ref, inverted range),
    license_status/license_activate.

artifacts:
  - /Users/mike/mcp-servers/servers/maintenance-log/src/index.ts (server, 6 tools + 2 license tools)
  - /Users/mike/mcp-servers/servers/maintenance-log/src/maintenance.ts (types, ISO date math, integer-cent costs, CSV/Markdown cell escaping)
  - /Users/mike/mcp-servers/servers/maintenance-log/src/store.ts (data dir, atomic writes, corrupt quarantine, AST id series, ref resolution)
  - /Users/mike/mcp-servers/servers/maintenance-log/src/version.ts (0.1.0)
  - /Users/mike/mcp-servers/servers/maintenance-log/test/smoke.test.mjs (7 tests, all over stdio)
  - /Users/mike/mcp-servers/servers/maintenance-log/test/_smoke-once.mjs (RESULT.md transcript harness)
  - /Users/mike/mcp-servers/servers/maintenance-log/package.json, tsconfig.json, README.md, LICENSE, server.json, smithery.yaml, Dockerfile
  - /Users/mike/mcp-servers/servers/maintenance-log/dist/ (tsc output, index.js chmod 755)

cost: 25 wall minutes

failures:
  - First test run failed to parse: the spawn options object in the test client closed with
    `};` instead of `});` (transcription typo). Fixed; harness artifact, not a server defect.
  - Second run: the duplicate-tag guard test hit the 3-asset free cap instead, because seed()
    fills all three slots and asset_add checks the cap before the tag. Fixed in the test by
    removing the empty van first so the duplicate check is reachable. Server guard order
    (cap first, then tag) is deliberate and unchanged.
  - Estate coupling, not fixed (outside servers/maintenance-log/): packages/mcp-license holds
    SERVER_COUNT = 37 and its bundle-link test counts sellable servers on disk. Adding
    servers/maintenance-log makes that 38, so the root suite fails until the orchestrator
    bumps SERVER_COUNT (wave C wires the new endpoints).

insight: Guard order is observable from outside: with three free assets registered,
  asset_add carrying a duplicate tag returns the cap error, not the duplicate-tag error,
  because the cap check runs first. The duplicate check only becomes reachable below the
  cap or on Pro; the suite proves both arms. Also measured: interval-to-date math crosses
  a leap day correctly -- 2020-01-06 + 90 days is 2020-04-05 (Feb 2020 has 29 days) --
  because addDays computes in UTC, so the answer cannot drift with the server's timezone.
