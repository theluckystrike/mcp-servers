status: DONE
evidence: |
  cd servers/mileage-log && npm run build (serialized root npm install beforehand:
  `while ! mkdir /tmp/mcp35-npm.lock 2>/dev/null; do sleep 5; done` ... `rmdir`)
    npm notice run @theluckystrike/mcp-mileage-log@0.1.0 build
    npm notice run tsc -p tsconfig.json --declaration && node -e "..."   (1.198s wall)
  npm test (node --test test/*.test.mjs), tail verbatim:
    1..9
    # tests 9
    # suites 0
    # pass 9
    # fail 0
    # cancelled 0
    # skipped 0
    # todo 0
    # duration_ms 1848.328042
  Live ordered smoke over stdio (initialize -> tools/list -> rate_set -> trip_add -> mileage_summary):
    tools/list: trip_add, trip_list, trip_remove, rate_set, rate_list, mileage_summary, mileage_export, license_status, license_activate
    trip_add id: TR-2026-0001
    mileage_summary: trips_priced 1, line rate "USD 0.700/mile" amount_cents 875 amount "USD 8.75", totals [{currency USD, amount_cents 875}]
  Hygiene: /usr/bin/grep for em dash and emoji across src, test, README.md, manifests: no matches.
artifacts:
  servers/mileage-log/src/index.ts (9 tools: 7 domain + license_status/license_activate)
  servers/mileage-log/src/log.ts (domain: trip/rate model, effective-date lookup, integer-cent math)
  servers/mileage-log/src/store.ts (XDG JSON, atomic writes, corruption quarantine, TR-YYYY-NNNN counter)
  servers/mileage-log/src/version.ts, package.json (0.1.0, bin mcp-mileage-log), tsconfig.json
  servers/mileage-log/server.json (io.github.theluckystrike/mileage-log), smithery.yaml, Dockerfile, LICENSE
  servers/mileage-log/README.md ("mcp mileage" and "mileage log" in opening paragraph; EXAMPLE rate set labeled, no defaults claiming current law)
  servers/mileage-log/test/smoke.test.mjs (9 tests)
cost: wall minutes 30
failures: |
  effectiveRate crashed with TypeError (reading effective_from of undefined) when a trip's
  category had no rates at all and the trip carried no jurisdiction: the empty pool fell
  through to the earliest-rate branch. Fixed by returning a plain "no <category> rate is
  set" reason before the effective-date scan. Caught by test 3 on first run.
  First manual smoke piped all requests at once; the SDK answered mileage_summary before
  rate_set/trip_add landed (responses out of order). Client artifact, not a server bug:
  rerun awaiting each response and the summary priced correctly.
insight: |
  The MCP SDK processes piped stdio requests concurrently, so a naive pipe-all-at-once
  smoke sees reads answered before earlier writes land; any manual verification of a
  write-then-read sequence must await each response in order (the test suite already does).
