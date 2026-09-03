# mcp-timezone: adversarial audit and user-value run

Date 2026-09-03. Scope: `servers/timezone` only. Zero paid API calls, zero network calls
(`grep -rE "fetch|https?://|node:http|node:net|node:dns" servers/timezone/src/` exits 1 with no
output; the server's only source of zone data is the ICU database inside Node).

Part 1 harness: `/private/tmp/tzaudit/probe.mjs`, which spawns `node dist/index.js` with a fresh
`XDG_DATA_HOME` and `MCP_LICENSE_KEY=""` (free tier), writes JSON-RPC lines to stdin and flags any
stdout line that is not parseable JSON. Probe files `/private/tmp/tzaudit/{a,b,c,e,f,g}.jsonl`,
44 requests across six runs.

Part 2 harness: the real `claude` CLI as an MCP client against `/private/tmp/tzuv/mcp.json`, which
registers `timezone` alone (`--strict-mcp-config`), fresh `XDG_DATA_HOME=/private/tmp/tzuv/data` and
`XDG_CONFIG_HOME=/private/tmp/tzuv/cfg`, free tier, and an explicit per-tool allowlist of the 11
`mcp__timezone__*` tools (the wildcard form `mcp__*` grants nothing; see docs/USER_VALUE_R6.md D-E4).

---

## Part 1 - adversarial probes

| # | Probe | Before | Fixed | After |
| --- | --- | --- | --- | --- |
| 1 | `convert_time` with no arguments | PASS | - | zod: `Required at time / from_zone / to_zones` |
| 2 | `convert_time {time: 123}` (wrong type) | PASS | - | zod: `Expected string, received number at time` |
| 3 | `now {zones: []}` and `now {}` | PASS | - | falls back to this machine's zone plus UTC |
| 4 | unknown zone `Xanadu` | PASS | - | `unknown time zone or place: "Xanadu". Did you mean: canada (America/Toronto)?` |
| 5 | near-miss names `New york`, `warsaw`, `Europe/warsaw`, `poland` | PASS | - | `America/New_York`, `Europe/Warsaw`, `Europe/Warsaw`, `Europe/Warsaw` |
| 6 | abbreviations `PST`, `CET`, `IST` | PASS | - | `America/Los_Angeles`, `Europe/Paris`, `Asia/Kolkata` |
| 7 | fixed offset `GMT+2` | PASS | - | `Etc/GMT-2` (sign inverted per IANA), reads UTC+02:00 |
| 8 | fixed offset with minutes `UTC+5:30` | **FAIL** | yes | was `Did you mean: utc (UTC)?`; now `"UTC+5:30" is a fixed offset with minutes, and IANA has no zone for it. Name the place instead (UTC+05:30 is India...)` |
| 9 | 1 MB string as a zone name | **FAIL** | yes | the 1 MB argument came back inside a **1,000,118-character error message**; now refused at the schema, `a zone must be 100 characters or fewer` |
| 10 | 1 MB string as an `ics_create` title | **FAIL** | yes | wrote a **1,040,820-byte .ics** and returned it in the response text; now `title must be 200 characters or fewer` |
| 11 | 200 participants | PASS (free) / **FAIL (Pro)** | yes | free tier gates at 3 with the upgrade text; under Pro it was unbounded, `findSlots` is O(days x participants x 52). Now `z.array(...).max(100)` |
| 12 | `days: 0` | PASS | - | zod: `Number must be greater than 0 at days` |
| 13 | `days: 10000` | PASS (free) / **FAIL (Pro)** | yes | free tier gates at 5; under Pro this is 10000 x 52 grid steps x an `Intl` call each. Now `.max(366)` |
| 14 | `duration_minutes: 0` | PASS | - | zod: `Number must be greater than 0` |
| 15 | `duration_minutes: 100000` | PASS | - | `No slot fits everyone's working hours...` and advice; now also capped at 1440 |
| 16 | `work_start` after `work_end` | PASS | - | `work_end (09:00) must be after work_start (17:00)` |
| 17 | `work_start: "24:59"` | **FAIL** | yes | accepted as 1499 minutes; now `work_start is out of range` |
| 18 | DST gap `2026-03-29 02:30 Europe/Warsaw` | PASS | - | resolves to `2026-03-29 03:30 (UTC+02:00)`, UTC instant `01:30Z` - the calendar convention of landing after the jump |
| 19 | DST fold `2026-10-25 02:30 Europe/Warsaw` | PASS | - | resolves to the second (post-fold) reading, `UTC+01:00`, `01:30Z` |
| 20 | date in 1900 | PASS | - | `1900-06-15 12:00 (UTC+01:24)` - Warsaw local mean time, which is the correct historical offset |
| 21 | date in 2100 | PASS | - | `2100-06-15 12:00 (UTC+02:00)` -> New York `06:00 EDT`, current rules projected forward |
| 22 | `business_days` 1900-01-01 to 2100-01-01 | **FAIL (silent)** | yes | reported `2858 business day(s) of 4000 calendar day(s)` for a 73,050-day range: the loop guard truncated and the answer looked normal. Now refused: `... is 73050 calendar days; this tool counts at most 3700 ... Split the range.` |
| 23 | `business_days` with `to` before `from` | PASS | - | `"to" (2026-09-01) is before "from" (2026-09-30)` |
| 24 | ics with a newline, a comma and a semicolon in the title | PASS | - | `SUMMARY:Nova\, kickoff\nsecond\; line` - RFC 5545 escaping, CRLF line ends, every line <= 75 octets |
| 25 | ics path traversal `../../../../../../private/tmp/...` | PASS (by design) | - | the path is resolved against cwd and written where the caller asked. `out_path` is a caller-named destination, the same contract as `expense_export`; there is no confinement and the README says so |
| 26 | ics to an unwritable directory | PASS | - | `EACCES: permission denied, open '.../ro/x.ics'`, no partial file, the monthly free counter is not consumed |
| 27 | two contacts with the same name (`Sara`, `" sara "`) | **FAIL (silent)** | yes | the second silently moved Sara from Sydney to Austin. Now: `Replaced the saved Sara (was Australia/Sydney, 09:00-17:00); names are matched case-insensitively.` |
| 28 | corrupt contacts file | PASS | - | `readJsonFile` quarantines to `data.json.corrupt-<ts>`, writes the marker, and every later call fails closed (shared `jsonstore`, covered by the store tests) |
| 29 | two processes, one data dir, 40 concurrent `contacts_set` | PASS | - | 40 stored, 40 unique keys (`withFileLock`), unchanged - `test/concurrency.test.mjs` |
| 30 | stdout carries only JSON-RPC | PASS | - | no `console.*` in `src/`; startup and drop lines go to stderr; the probe flagged no non-JSON line and `test/adversarial.test.mjs` asserts it |
| 31 | no network calls | PASS | - | grep over `src/` returns nothing |

### Environment note, not a server defect

`ics_create {out_path: "/etc/passwd"}` never returns in this sandbox. The cause is below the
server: `node -e 'require("fs").writeFileSync("/etc/passwd","x")'` also hangs (`timeout 8` -> rc
124), while the same write to a `chmod 500` directory returns `EACCES` in 5 ms. A write to a
SIP-protected path blocks in the kernel here. Probe 26 is the meaningful test and it passes.

### Edits made

| File | Change |
| --- | --- |
| `src/index.ts` | `text(max, what)` schema helper; length caps on every free-text field (zones/places 100, title 200, description 5000, location 200, out_path 4096, work_start/work_end 16) |
| `src/index.ts` | array caps: `zones` 50, `to_zones` 50, `participants` 100, `attendees` 100, `holidays` 400 |
| `src/index.ts` | numeric caps: `days` <= 366, `duration_minutes` <= 1440, `limit` <= 100, `year` 1850-2200 |
| `src/index.ts` | `contacts_set` names the contact it replaced when the zone or hours differ |
| `src/tz.ts` | `clip()`; `UnknownZoneError` truncates the echoed input at 80 characters |
| `src/tz.ts` | `hhmmToMinutes` rejects anything past 24:00 |
| `src/tz.ts` | `MAX_BUSINESS_DAY_SPAN = 3700`; `businessDays` throws a named error instead of truncating at the loop guard |
| `src/tz.ts` | a fixed offset carrying minutes gets its own message instead of a bad suggestion |
| `test/adversarial.test.mjs` | new file, 9 tests covering probes 1-2, 4-9, 11-17, 22, 24, 26-27, 30 |

---

## Part 2 - user value through a real MCP client

`claude -p "<prompt>" --mcp-config /private/tmp/tzuv/mcp.json --strict-mcp-config --model sonnet
--output-format json --max-turns 12 --allowedTools "<the 11 mcp__timezone__* tools>"`, six
scenarios in order against one fresh free-tier data dir, so scenario 5 sees the contacts it saves.
Wall clock at run time: 2026-09-03 ~02:20 UTC (04:20 Warsaw, Thursday).

Scoring: 3 = correct, right numbers, no clarification needed. 2 = correct but with a gap the user
has to close. 1 = partially wrong. 0 = failed. `Turns` is the client's own turn count
(`num_turns`), which is one more than the number of tool calls in the single-call scenarios.

### Scorecard - 17 / 18

| # | Scenario | Score | Turns | Sec | Answer | Independently verified |
|---|---|---|---|---|---|---|
| s1 | "What time is it now in Sydney, Austin and Warsaw?" | **3** | 3 | 6.3 | Sydney 12:19 Thu, Austin 21:19 Wed CDT, Warsaw 04:19 Thu | `Intl` at the same minute: Sydney 12:20, Chicago 21:20, Warsaw 04:20. Austin correctly resolved to `America/Chicago` |
| s2 | "If I call at 3pm Warsaw time on Thursday, what is that for a client in Denver?" | **3** | 3 | 7.4 | 7am Denver, same day, 8 hours apart | `2026-09-03T13:00Z` -> Warsaw 15:00, Denver 07:00 MDT. The model resolved "Thursday" to today rather than asking, which is right: it is Thursday in Warsaw |
| s3 | "Find me a one-hour slot next week for me in Warsaw, Sara in Sydney and Tom in Austin, everyone between 9 and 17." | **3** | 6 | 74.9 | No 9-17 solution exists; closest is 13:00-14:00 Warsaw / 06:00-07:00 Austin / 21:00-22:00 Sydney, every weekday Sep 7-11 | Sydney is UTC+10, Chicago UTC-5, so the two 09:00-17:00 days are 15 hours apart and never intersect. The proposed slot is 11:00Z: Warsaw 13:00, Chicago 06:00, Sydney 21:00 - arithmetic exact |
| s4 | "When does the clock change next in New York and in Warsaw?" | **3** | 4 | 9.9 | New York 2026-11-01 (EDT->EST at 02:00 local), Warsaw 2026-10-25 (CEST->CET at 03:00 local); Warsaw first | `dstChanges` and ICU both give `2026-11-01T06:00Z` and `2026-10-25T01:00Z`. The model also volunteered the ordering, which is the part a user acts on |
| s5 | "Save Sara in Sydney and Tom in Austin as contacts, then give me an ics for the best slot with both of them, titled Nova kickoff." | **3** | 11 | 55.4 | Both contacts saved; `/private/tmp/tzuv/nova.ics` written; slot 17:00-18:00 CDT Austin = 08:00-09:00 Sydney, with the compromise stated out loud | File exists, 358 bytes. `DTSTART:20260903T220000Z` / `DTEND:20260903T230000Z` - UTC with the `Z`. `SUMMARY:Nova kickoff`. Two `ATTENDEE` lines. 22:00Z is 17:00 CDT and 08:00 AEST next day, correct. Store holds `sara -> Australia/Sydney` and `tom -> America/Chicago` |
| s6 | "How many business days between 2026-09-01 and 2026-09-30 in Poland?" | **2** | 3 | 8.0 | "22 business days ... 0 public holidays - September has none in Poland" | 22 is right (`Intl`-independent weekday count over the 30 days = 22). But see D-T1: the tool takes holidays as input and the model passed none; the "September has none in Poland" clause is the model's own knowledge, not the tool's, and it happens to be true. In any other month the same phrasing would be a confident wrong answer |

Total wall time 162 s for six scenarios. Every scenario reached the server: no scenario failed on
the allowlist, and no scenario fell back to `WebFetch` or `Bash`.

### What the model did with the holidays argument (s6)

The prompt says "in Poland" and `business_days` has an optional `holidays: string[]`. The model
called it with the date range and the zone and **no holidays**, then asserted in prose that Poland
has no September public holidays. That is correct for September 2026 and would be wrong for, say,
November (11 November, Independence Day) or May. Direct probe confirms the tool is doing exactly
what it was asked:

```
business_days {from 2026-09-01, to 2026-09-30, zone "Poland"}                -> 22 business days, 0 holiday
business_days {..., holidays: ["2026-09-15"]}                                -> 21 business days, 1 holiday
```

The number is the tool's; the "no holidays in September" is the model's. The tool never claims a
holiday calendar it does not have, which is the right failure mode, but the description does not
push the model to say so.

### Defects

| id | Defect | Repro | Where | Status |
|---|---|---|---|---|
| D-T1 | `business_days` returns a holiday-free count that a model then narrates as if the tool had checked a national calendar | s6 above; ask for November 2026 in Poland and the same shape of answer omits 1 and 11 November | server (description) | **fixed**: the tool now says in its output which holidays it excluded and that it knows no national calendar unless one is passed |
| D-T2 | `find_meeting_slots` returns only a text refusal when no slot fits, so the model burns turns re-calling it with guessed working hours (s3: 6 turns, 75 s; s5: 11 turns, 55 s) | s3 | server | **open**: the fix is to return the least-bad near-miss (the slot minimising total minutes outside anyone's window) alongside the refusal. Recorded, not built - it is a feature, not a bug fix |
| D-T3 | A named (non-email) attendee is written as `ATTENDEE;CN=Tom:invalid:nomail` | s5 `nova.ics` | server | **open by design**: RFC 5545 requires a CAL-ADDRESS URI, and `invalid:nomail` is the conventional placeholder. Google Calendar and Apple Calendar both import the file; noted so it is not rediscovered |

### Fix for D-T1

`business_days` now names what it excluded and what it did not know:

```
2026-09-01 to 2026-09-30 in Europe/Warsaw: 22 business day(s) of 30 calendar day(s)
(8 weekend, 0 holiday). No holidays were passed, so only weekends were excluded;
this tool has no national holiday calendar - pass holidays to exclude them.
```

Re-run of s6 against the fixed build (`turns 3, 9.2 s`): *"22 business days ... (30 calendar days,
minus 8 weekend days). September has no Polish public holidays, so weekends are the only
exclusion."* The tool no longer implies a holiday calendar it does not have, but the model still
adds the September claim from its own knowledge, so s6 stays at **2**. Making the model stop would
need the answer to carry the caveat verbatim, which is a prompt problem, not a server one.

---

## Final test summary

```
$ npm run build -w servers/timezone
> tsc -p tsconfig.json && node -e "import('node:fs').then(f=>f.chmodSync('dist/index.js',0o755))"
(no output, exit 0)

$ npm test -w servers/timezone
# tests 33
# pass 33
# fail 0
# duration_ms 1791.738042
```

33 = 16 `test/tz.test.mjs` + 5 `test/smoke.test.mjs` + 2 `test/concurrency.test.mjs` (all
pre-existing, unchanged) + 10 new `test/adversarial.test.mjs`.

## RESULT.md block

```
status: DONE
evidence: 31 adversarial probes over 6 stdio runs; 6 user-value scenarios through the claude CLI;
  npm test -w servers/timezone -> 33 pass, 0 fail
artifacts: docs/TIMEZONE_AUDIT.md, servers/timezone/src/{index,tz}.ts,
  servers/timezone/test/adversarial.test.mjs, servers/timezone/README.md
cost: 55 wall minutes
failures: 7 probes failed and were fixed (1 MB argument echoed back; 1 MB ics title; unbounded
  days/participants under Pro; 24:59 accepted as a working-hour bound; business_days silently
  truncated a 73,050-day range at the loop guard and reported 4000 days as if it were the whole
  range; a duplicate contact name silently moved a person to another continent; a fixed offset
  with minutes suggested UTC). One probe hangs for an environment reason (a write to a
  SIP-protected path blocks in the kernel, reproducible without the server).
insight: the silent business_days truncation is the dangerous class, not the crash class. Every
  other failure announced itself - a 1 MB response, a validation error, an upgrade wall. That one
  returned a well-formed sentence with a plausible number ("2858 business days of 4000 calendar
  days") for a question about 200 years, and a caller has nothing in the response to check it
  against. A loop guard that caps work without changing the answer's shape is worse than no guard.
```

## One documentation defect

`servers/timezone/README.md` claimed *"Ambiguous times in the autumn fold resolve to the first
(pre-change) occurrence."* Probe 19 measures the opposite: `2026-10-25 02:30 Europe/Warsaw` returns
`01:30Z`, which is the second (CET) reading, not the first (CEST, `00:30Z`). The behaviour is the
right one - `zonedToUtc` iterates twice and lands after the change - so the README was corrected to
match the measurement rather than the code changed to match the README.
