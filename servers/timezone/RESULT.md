status: DONE

evidence:
```
$ npm install            # repo root, npm_config_cache=/Users/mike/.npm-cache-local
changed 3 packages in 206ms

$ npm run build -w servers/timezone
> tsc -p tsconfig.json && node -e "import('node:fs').then(f=>f.chmodSync('dist/index.js',0o755))"
(no output, exit 0)

$ npm test -w servers/timezone
1..23
# tests 23
# pass 23
# fail 0
# duration_ms 989.822
```
Test breakdown: test/tz.test.mjs 16 (DST Warsaw vs New York on 2026-03-15 and 2026-11-01,
Asia/Kolkata +330 and Asia/Kathmandu +345, spring-forward gap, overlap math on two dates,
slot ranking, business days, ics validity and folding, place table, unknown-name suggestions,
time parsing), test/smoke.test.mjs 5 (stdio initialize + tools/list of 11 tools, convert_time
known answer, 3-participant slot search verified inside every window, free 4th participant
and 14-day and recurring refused with the upgrade text, Pro allowed, contacts + resource +
prompt, ics file on disk, free 4th ics refused), test/concurrency.test.mjs 2 (two processes,
40 concurrent contacts_set all persist; 10 concurrent ics writes all counted).

```
$ node scripts/validate.mjs
validation db: /Users/mike/mcp-servers/data/validation.json run 45: 146/146
```
(pre-existing suite, unchanged by this unit)

Zone table verification at startup: 510 entries, DROPPED_PLACES.length == 0 on Node v22.23.2.

artifacts:
/Users/mike/mcp-servers/servers/timezone/src/index.ts
/Users/mike/mcp-servers/servers/timezone/src/tz.ts
/Users/mike/mcp-servers/servers/timezone/src/zones.ts
/Users/mike/mcp-servers/servers/timezone/src/jsonstore.ts
/Users/mike/mcp-servers/servers/timezone/test/tz.test.mjs
/Users/mike/mcp-servers/servers/timezone/test/smoke.test.mjs
/Users/mike/mcp-servers/servers/timezone/test/concurrency.test.mjs
/Users/mike/mcp-servers/servers/timezone/README.md
/Users/mike/mcp-servers/servers/timezone/llms-install.md
/Users/mike/mcp-servers/servers/timezone/server.json
/Users/mike/mcp-servers/servers/timezone/server.mcpb.json
/Users/mike/mcp-servers/servers/timezone/smithery.yaml
/Users/mike/mcp-servers/servers/timezone/Dockerfile
/Users/mike/mcp-servers/servers/timezone/glama.json
/Users/mike/mcp-servers/servers/timezone/package.json
/Users/mike/mcp-servers/servers/timezone/tsconfig.json
/Users/mike/mcp-servers/servers/timezone/LICENSE
/Users/mike/mcp-servers/assets/timezone-logo.png

cost: 38 wall minutes

failures:
1. Intl.supportedValuesOf("timeZone") on Node 22 returns 418 CANONICAL ids that exclude
   Asia/Kolkata, Europe/Kyiv, Asia/Yangon and America/Argentina/Buenos_Aires (it lists the
   legacy Asia/Calcutta, Europe/Kiev, Asia/Rangoon, America/Buenos_Aires instead), so the
   first startup verification dropped 36 of 510 entries. Fixed: a zone is valid when
   DateTimeFormat accepts it AND resolvedOptions().timeZone is in the supported set.
2. Etc/GMT+N is absent from supportedValuesOf entirely, which made "UTC+2" unresolvable.
   Fixed with an explicit Etc/ allowance on the DateTimeFormat check alone.
3. resolveZone("poland") returned the string "poland": ICU accepts legacy country aliases
   (Poland, Japan, Turkey, Egypt) as zone ids, so the "is this already a zone" branch
   swallowed them before the place table. Fixed by taking a raw id only when it contains a
   slash, is UTC, or is an exact supportedValuesOf member.
4. The first slot-ranking test used Warsaw + New York + Bangalore and returned 0 slots. Not
   a bug: with 09:00-17:00 days that trio has no overlap at all (Kolkata 03:30-11:30 UTC vs
   New York 13:00-21:00 UTC). Kept as a regression test that an impossible set returns no
   slot rather than a bad one; the positive test uses Warsaw + London + New York.

insight:
The overlap between two 09:00-17:00 days is not a constant. Warsaw and New York share
2h00m on 2026-09-10 but 3h00m on 2026-03-16, because New York enters DST on 8 March and
Warsaw not until 29 March; measured by overlapOnDate, 780-900 vs a 180-minute window. Any
scheduler that computes an overlap from fixed offsets is wrong for roughly three weeks in
March and one in October -- exactly the weeks when a recurring client call silently moves.
