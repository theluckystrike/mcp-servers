status: DONE

evidence:
  build: |
    $ /Users/mike/mcp-servers/node_modules/.bin/tsc -p tsconfig.json
    exit=0, 0.767 total
  tests: |
    $ node --test test/*.test.mjs
    # tests 7
    # pass 7
    # fail 0
    # duration_ms 1101.805875
  stdio smoke (node harness spawns dist/index.js, sandboxed XDG_DATA_HOME): |
    initialize: mcp-job-card 0.1.0
    tools/list: job_card_create, job_card_log_labor, job_card_log_material, job_card_update_status, job_card_list, job_card_get, job_card_print, job_card_delete, job_card_summary, license_status, license_activate
    create: JC-2026-0001
    log_labor 2.5h @ 4999: value_cents = 12498 | card grand_total = EUR 124.98
    stderr: mcp-job-card 0.1.0 ready; store at .../mcp-servers/job-card
  suite coverage: full free-tier flow with hand-recomputed totals (labor 60873, materials 2798,
    grand 63671 cents), status flow refusals (skipped, backwards, backdated), print in markdown
    and self-contained HTML with signature line, day and Monday-Sunday week summary per worker
    and per currency, free-tier cap at 10 active cards with archive freeing the slot, Pro via
    scripts/sign-license.mjs lifting the cap, license_status/license_activate.

artifacts:
  - /Users/mike/mcp-servers/servers/job-card/src/index.ts (server, 9 tools + 2 license tools)
  - /Users/mike/mcp-servers/servers/job-card/src/card.ts (types, status flow, integer-cent math)
  - /Users/mike/mcp-servers/servers/job-card/src/store.ts (data dir, atomic writes, corrupt quarantine, JC id series)
  - /Users/mike/mcp-servers/servers/job-card/src/version.ts
  - /Users/mike/mcp-servers/servers/job-card/test/smoke.test.mjs (7 tests, all over stdio)
  - /Users/mike/mcp-servers/servers/job-card/package.json, tsconfig.json, README.md, LICENSE, server.json, smithery.yaml, Dockerfile
  - /Users/mike/mcp-servers/servers/job-card/dist/ (tsc output, index.js chmod 755)

cost: 35 wall minutes

failures:
  - First manual stdio smoke piped through `head -c` ended with an EPIPE trace on stderr: the
    truncation closed the pipe while the server was still writing. Harness artifact, not a
    server defect; re-ran through a full-read node harness and the transcript was clean.
  - Estate coupling, not fixed (outside servers/job-card/): packages/mcp-license/src/index.ts
    holds SERVER_COUNT = 33 and packages/mcp-license/test/bundle-link.test.mjs compares it to
    the number of sellable servers on disk. Adding servers/job-card makes that 34, so the root
    suite fails until the orchestrator bumps SERVER_COUNT to 34.

insight: Half-up rounding of a labor line is not safe in doubles. Measured by brute force
  (node, h in hundredths, rate in cents): 0.29 h at 50 cents is exactly 14.5 cents of value,
  but the float path computes 14.499999999999998224 and Math.round returns 14, underpaying the
  line by a cent; the integer path (29 x 50 = 1450 hundredth-cents, floored half-up division by
  100) returns 15. The server therefore carries hours as integer hundredths and quantities as
  integer thousandths and never divides before the final rounding step.
