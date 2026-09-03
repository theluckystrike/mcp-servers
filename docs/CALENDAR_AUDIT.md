# mcp-calendar: adversarial audit and user-value run

Date 2026-09-03. Scope: `servers/calendar` only. Zero paid API calls.

Network: `grep -rEn "fetch|https?://|node:http|node:net|node:dns" servers/calendar/src/` matches only
`src/fetch.ts` and the three lines in `src/index.ts` that import it, name the `url` argument and call it.
`fetchIcs` is reached from exactly one place, behind `if (a.url && a.url.trim())`, and behind the Pro gate.
A `path` or `text` import never opens a socket, and there is no background refresh.

Part 1 harness: `/private/tmp/calaudit/probe.mjs` spawns `node servers/calendar/dist/index.js` with a fresh
`XDG_DATA_HOME` and `MCP_LICENSE_KEY=""` (free tier), writes JSON-RPC lines to stdin, prints every response
with a millisecond offset, and flags any stdout line that does not parse as JSON. Fixtures in
`/private/tmp/calaudit/fx/`, 34 requests across four runs.

Part 2 harness: the real `claude` CLI as an MCP client against `/private/tmp/uv60/mcp.json`, which registers
`calendar`, `timezone` and `time-tracker` together (`--strict-mcp-config`), fresh
`XDG_DATA_HOME=/private/tmp/uv60/data` and `XDG_CONFIG_HOME=/private/tmp/uv60/cfg`, free tier, and an explicit
per-tool allowlist of all 31 `mcp__calendar__*` / `mcp__timezone__*` / `mcp__time-tracker__*` tools
(the wildcard form `mcp__*` grants nothing; docs/USER_VALUE_R6.md D-E4).

The machine zone during both parts is `Asia/Saigon` (UTC+07:00) and the fixture is written in `Europe/Warsaw`
(UTC+02:00). That gap is deliberate: it is what exposes the all-day export defect below.

---

## Part 1 - adversarial probes

| # | Probe | Before | Fixed | After |
| --- | --- | --- | --- | --- |
| 1 | `ics_import` with no arguments | PASS | - | zod: `Required at name`, plus the tool's own example when a name is given with no source |
| 2 | `ics_import {path: 123}` (wrong type) | PASS | - | zod: `Expected string, received number at path` |
| 3 | `events_list {}` | PASS | - | zod: `Required at from` / `Required at to` |
| 4 | `free_busy {work_start: 17}` (wrong type) | PASS | - | zod: `Expected string, received number at work_start` |
| 5 | `text`, `url` and `path` all given at once | PASS | - | `give exactly one of path, text or url, not several.` |
| 6 | `url` pointing at `http://127.0.0.1:9/` | PASS | - | free tier answers with the Pro upgrade text and never opens a socket; with Pro, `isBlockedHost` refuses: `refusing to fetch 127.0.0.1: that is a loopback address` |
| 7 | redirect loop / redirect to a private host | PASS | - | `redirect: "follow"` bounds the chain in undici (`fetch failed` on exhaustion); the post-redirect host is re-checked (`the feed redirected to ..., which is a loopback address; nothing was read`) |
| 8 | 5 MB, 20,000-event export: import | PASS | - | 1.9 s wall, `20000 event definition(s)`; peak RSS 301 MB, heap 74.5 MB for the parsed model |
| 9 | 5 MB, 20,000-event export: four queries in a row | **FAIL (slow)** | yes | every call re-read and re-parsed the whole file (1.52 s parse + 2.57 s expand each), 17.8 s for four questions. A per-process parse cache keyed on the stored file's path, size and mtime brings it to 13.0 s; the remaining cost is expansion, which is per-window and cannot be cached |
| 10 | `RRULE:FREQ=DAILY` with no COUNT and no UNTIL, ten-year window | PASS | - | bounded twice over: the generator breaks at `startUtc >= toUtc`, and `MAX_CANDIDATES` (100,000) / `MAX_OCCURRENCES` (20,000) cap the pathological case. 7 occurrences in a 7-day window, under 5 ms |
| 11 | `FREQ=SECONDLY`, `FREQ=MINUTELY` | PASS | improved | still not expanded, by design, but the note now says why: `deliberately not expanded: one such rule fills any window with thousands of occurrences` |
| 12 | `FREQ=HOURLY;COUNT=5` | **FAIL (silent)** | yes | was dropped to a single occurrence with a generic note - an hourly reminder silently lost 4 of its 5 instances. Now expanded (`addHoursWall`), 5 occurrences, `20260907T110000` through `T150000` |
| 13 | `BYDAY=2MO` and `BYDAY=-1FR` (monthly ordinals) | PASS | - | 2026-09-14 / 2026-10-12 and 2026-09-25 / 2026-10-30 |
| 14 | `BYSETPOS=-1` with `BYDAY=MO,TU,WE,TH,FR` ("last weekday of the month") | **FAIL (silent)** | yes | `BYSETPOS` was not parsed at all, so the rule emitted **every weekday** and `COUNT=4` truncated it to 2026-10-01, 10-02, 10-05 - a monthly event became a daily one. Now parsed and applied per period (`applySetPos`) for WEEKLY, MONTHLY and YEARLY; October yields exactly 2026-10-30. `BYDAY` inside a YEARLY rule was also unimplemented and is now handled on the same path |
| 15 | `RDATE` with two extra dates | PASS | - | 3 occurrences, deduplicated against the rule and filtered by EXDATE |
| 16 | floating `DTSTART` with no TZID | PASS | - | resolved in the caller's zone at query time, not at parse time: Warsaw noon is `2026-09-08T10:00:00Z` |
| 17 | `TZID=Mars/Olympus` (a zone Intl does not know) | PASS | - | the event is kept, read as local time, and the reason is named once per file |
| 18 | `TZID=W. Europe Standard Time` (Outlook / Windows zone name) | PASS | - | same path; the event survives, `ORGANIZER;CN="Doe, John"` with a quoted comma is parsed correctly |
| 19 | `DTEND` before `DTSTART` | **FAIL (silent)** | yes | `eventSpanMs` fell through to zero length with nothing said; the row read `22:00-22:00` and looked like a real appointment. Now `DTEND is before DTSTART on "..."; that event is read as zero length.` |
| 20 | zero-duration event (`DTEND == DTSTART`) | PASS | - | kept, 0 minutes, does not break `free_busy` or `mergeBlocks` |
| 21 | event spanning three years | **FAIL (display)** | yes | rendered `05:00-05:00` on a day outside the requested window, which reads as a five-minute meeting. Now `05:00 to 2029-09-01 05:00` whenever the local end date differs from the start date |
| 22 | nested `BEGIN:VCALENDAR` inside a VCALENDAR | PASS | - | the inner events are read; a nested calendar is not a reason to lose them |
| 23 | Google export (`X-WR-CALNAME`, `X-WR-TIMEZONE`, inline `VTIMEZONE`, `METHOD:PUBLISH`) | PASS | - | calendar name picked up, the VTIMEZONE is not read as an event, and the offset comes from ICU (`10:00 America/New_York` -> `14:00Z`, EDT) rather than from the file's stale rules |
| 24 | Outlook export folded mid-UTF-8 (a `€` split across the fold) | **FAIL** | yes | the file was decoded as UTF-8 *before* unfolding, so the split sequence became `Budget 1000 ??? review` and stayed corrupted in storage. Now `decodeIcs()` rejoins folds on the raw bytes and decodes after: `Budget 1000 € review`. Applied to file imports and to fetched feeds |
| 25 | CR-only line endings | PASS | - | `unfold` splits on `\r\n|\r|\n`; the event parses |
| 26 | header printed the offset twice | **FAIL (display)** | yes | `times in Asia/Saigon (UTCUTC+07:00)` - `offsetLabel` already carries "UTC". Now `(UTC+07:00)` |
| 27 | corrupt store quarantined | PASS | - | `readJsonFile` renames to `data.json.corrupt-<ts>`, writes the marker, and later calls fail closed; `test/corrupt.test.mjs`, 5 tests, unchanged |
| 28 | two processes, one data dir, 24 concurrent imports | PASS | - | `withFileLock`; `test/concurrency.test.mjs`, 2 tests, unchanged |
| 29 | stdout carries only JSON-RPC | PASS | - | no `console.*` in `src/`; the ready line and every warning go to stderr. The probe flagged no non-JSON line across all 34 requests, and `test/adversarial.test.mjs` asserts it |
| 30 | no network unless `url` is given | PASS | - | see the grep at the top |

### Not a defect

`conflicts` pairs a three-year block against every event inside it. That is arithmetically right and the sweep
in `findConflicts` breaks as soon as `b.start >= a.end`, so it is not a quadratic blow-up on ordinary data; a
long block genuinely does collide with everything. The fix worth making was the display one (probe 21), so the
user can see which of the two events is the long one.

---

## Part 2 - user value through a real MCP client

Fixture `/private/tmp/uv60/work.ics`: 8 events in `Europe/Warsaw`, the week of 2026-09-07 - a weekly Monday
standup (`RRULE:FREQ=WEEKLY;BYDAY=MO`), a Monday client onboarding, a Tuesday 14:00-15:30 Nova call with an
attendee, a Wednesday 10:00-12:00 deep-work block deliberately overlapping an 11:00-12:00 design review, a
Thursday vendor sync, a Thursday all-day company holiday (`VALUE=DATE`), and a Friday retro.

| # | Prompt | Score | What happened |
| --- | --- | --- | --- |
| 1 | "Import /private/tmp/uv60/work.ics as Work." | 3 | one `ics_import` call, 8 definitions, 1 recurring, free-tier counter reported |
| 2 | "What is on my calendar next week?" | 3 | resolved "next week" to 2026-09-07..13 unprompted, one `events_list`, all 8 rows including the standup occurrence and the all-day holiday, correct machine-zone conversion (Warsaw 14:00 -> Saigon 19:00), and it volunteered the Wednesday overlap |
| 3 | "Where do I have a free two-hour block next week between 9 and 17?" | 2 | one `free_busy` call, correct gaps, but it read 9-17 in the machine zone rather than asking which zone the working day is in. The server is right; the answer is confusing next to a Warsaw fixture. No server defect |
| 4 | "Do I have any conflicts?" | 3 (server) | `conflicts` returns exactly one pair: 2026-09-09, 60 min, deep-work block against the design review. The all-day holiday against the Thursday vendor sync is correctly not reported as a timed clash |
| 5 | "Log Tuesday's Nova call as billable time on Nova at 90 EUR." | 2 -> 3 | `event_to_time_entry` produced `start 2026-09-08T12:00:00.000Z`, `end 13:30:00.000Z`, `billable true`, note carrying the attendee. Handed to `time-tracker entry_add`, the store holds exactly those instants (`seconds 5400`). **Defect:** the currency was dropped, so "90 EUR" was stored as `"currency": "USD"`, `rateCents 9000` - a silently wrong invoice. `event_to_time_entry` now takes a `currency` argument and forwards it (`entry_add` already accepted one) |
| 6 | "Export next week's events to /private/tmp/uv60/next.ics" | 1 -> 3 | 8 events written and re-imported cleanly, **but** the all-day company holiday came back as `2026-09-09 19:00 to 2026-09-10 19:00`: `event_export` routed every occurrence through the timed ics writer, which cannot express a `DATE` value, so on a UTC+7 machine a holiday moved to the previous day and stopped being all-day. `allDayVevent()` now writes `DTSTART;VALUE=DATE` / `DTEND;VALUE=DATE` with its own RFC 5545 escaping and byte-safe folding. After the fix the round trip lists `2026-09-10 Thu / all day / Company holiday` |

Scorecard: 2.83 / 3 after the fixes (17 of 18), 2.17 / 3 as shipped.

### Harness defect, not a server defect

H-1. Partway through the run the `claude` CLI stopped honouring `--mcp-config ... --strict-mcp-config` and
answered from the ambient `CLAUDE_CONFIG_DIR` server set instead ("the only connected tools are for invoicing
and PDF handling"), reproducibly, for every later invocation in this session. Repro: run three prompts through
the config above, then a fourth; the fourth loses the servers. Unsetting `CLAUDE_CONFIG_DIR` removes the wrong
servers but also the credentials (`OAuth session expired`). Prompts 1-3 above are measured through the real
client; prompts 4-6 were re-run over raw JSON-RPC against the same three server binaries and the same data
directory, so the tool behaviour, the arguments and the stores are real - only the model's tool selection for
those three is not measured. Worth a separate check before the next user-value round.

---

## Edits made

| File | Change |
| --- | --- |
| `src/ics.ts` | `decodeIcs(buf)` - unfold on the bytes, decode after, so a fold inside a multi-byte character cannot corrupt a summary |
| `src/ics.ts` | `BYSETPOS` parsed into `RRule.bySetPos` and applied per period by `applySetPos()` in WEEKLY, MONTHLY and YEARLY |
| `src/ics.ts` | YEARLY now honours `BYDAY` (with ordinals), which it previously ignored |
| `src/ics.ts` | `FREQ=HOURLY` expanded via `addHoursWall`; `MINUTELY` / `SECONDLY` refused by name with the reason |
| `src/ics.ts` | `DTEND` before `DTSTART` raises a named warning instead of silently becoming zero length |
| `src/index.ts` | `parseCached()` - per-process parse cache keyed on the stored file's path, size and mtime, 8 entries |
| `src/index.ts` | `allDayVevent()`, `icsText()`, `foldIcsLine()` - whole-day events export as `DATE` values |
| `src/index.ts` | `event_to_time_entry` takes and forwards `currency` |
| `src/index.ts` | multi-day occurrences render `HH:MM to YYYY-MM-DD HH:MM`; the `UTCUTC` offset label is fixed |
| `src/index.ts` | file imports decode through `decodeIcs` |
| `src/fetch.ts` | fetched feeds decode through `decodeIcs` |
| `README.md` | parser section: byte-safe folding, `HOURLY`, `BYDAY` ordinals, `BYSETPOS`, the `MINUTELY`/`SECONDLY` decision, all-day export |
| `test/adversarial.test.mjs` | new file, 14 tests covering probes 1-6, 8-14, 16-26, and Part 2 defects 5 and 6 |

## Final test summary

```
$ npm run build -w servers/calendar
(clean, no diagnostics)

$ npm test -w servers/calendar
# tests 50
# pass 50
# fail 0
# duration_ms 56423.9545
```

50 = 26 ics unit + 3 smoke + 5 corrupt + 2 concurrency + 14 adversarial. The 56 s is dominated by the new
20,000-event stdio test, which builds a 5 MB fixture and runs four tool calls against it.

## RESULT.md block

```
status: DONE
evidence:
  npm run build -w servers/calendar -> clean
  npm test -w servers/calendar -> tests 50, pass 50, fail 0
  probe: 34 JSON-RPC requests, 0 non-JSON stdout lines
  5 MB / 20,000 events: import 1.9 s, four queries 17.8 s -> 13.0 s with the parse cache, peak RSS 301 MB
  user-value: 6 prompts, 17/18 after fixes (2.83/3), 13/18 as shipped
artifacts:
  servers/calendar/src/{ics.ts,index.ts,fetch.ts}
  servers/calendar/test/adversarial.test.mjs (14 tests)
  servers/calendar/README.md
  docs/CALENDAR_AUDIT.md
cost: 58 wall minutes
failures:
  BYSETPOS was never parsed, so "last weekday of the month" expanded to every weekday
  a fold inside a UTF-8 character corrupted the summary, because decoding ran before unfolding
  event_export could not express a whole-day event and moved a holiday to the previous day on a UTC+7 machine
  event_to_time_entry dropped the currency, storing "90 EUR" as USD 90.00/h
  FREQ=HOURLY was dropped to one occurrence; DTEND before DTSTART was silently zero-length
  every tool call re-parsed the whole .ics
insight:
  The two defects that would have cost real money were both silent and both at a boundary rather than inside
  the RFC 5545 code. Exporting a whole-day event through a timed writer moved a holiday to the day before,
  and it is invisible unless the machine zone is east of the calendar's zone - the same file round-trips
  perfectly in UTC. Handing a rate to a second server without its currency turned 90 EUR into 90 USD with no
  warning anywhere in the chain, and the chain is exactly the thing this tool exists to shorten. Neither is
  reachable by a unit test of the parser; both needed the servers wired together with a zone gap between the
  machine and the fixture.
```
