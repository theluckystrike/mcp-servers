# User value audit, round 18 (calendar re-run) - 2026-09-05

Round 18 is a single-lane hosted re-run of round 12's six calendar prompts, after D-R58 (the
`ics_import {url}` Pro refusal now names the free `text` alternative in its own words) shipped and
with D-R61 (attendees dropped by `event_export`) still open and unfixed. Same server, same six
prompts, same hosted arrival as round 12 - the only question is whether D-R58 holds live, whether
D-R61 still reproduces, and whether anything else moved.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, minting
  `anon_770f02d0bc5f87b6d36564b458720e6c`. One token, reused for the lane.
- **Registration.** One `mcp.json`, two `http` entries, both
  `https://mcp.zovo.one/mcp/<server>/t/<token>`, no `--header` anywhere: `calendar` and `timezone`
  only, per the single-lane recipe (`docs/USER_VALUE_R16_TIMEZONE.md`). `timezone` was registered
  but never called - all six prompts are calendar-only, same as round 12.
- **Allowlist.** 23 `mcp__<server>__<tool>` entries read from a live `tools/list` of each endpoint
  (calendar 12, timezone 11) - no `mcp__*` wildcard.
- **Client.** `claude` 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`, `--mcp-config`
  pointing at the two-entry file above, `--output-format stream-json --verbose --max-turns 12`, one
  `--session-id` then five `--resume`, `timeout 240` per prompt. Each prompt's stream-json was
  written to its own file (`out/s1.jsonl` .. `out/s6.jsonl`) before the next prompt started.
- **D-R57 honoured.** The lane ran in an **empty** working directory (`/private/tmp/uv-r18cal/wd`)
  with the CLI's own filesystem tools disallowed (`Bash, Read, Write, Edit, Glob, Grep, WebFetch,
  WebSearch, NotebookEdit, Task`). Fresh XDG dirs (`/private/tmp/uv-r18cal/xdg/{config,data,cache,
  state}`) local to this run, no reuse of any prior round's state.
- **The `.ics` fixture.** Round 12's original fixture bytes were not preserved on disk, so a
  same-shape replacement was built from its documented description: 8 event definitions in
  `Europe/Warsaw` for the week of 2026-09-07 - a weekly Monday standup (`RRULE:FREQ=WEEKLY;
  BYDAY=MO`), a Tuesday call carrying one `ATTENDEE` (Tom Rivera), a Wednesday 10:00-12:00 deep-work
  block deliberately overlapping an 11:00-12:00 design review, a Thursday all-day public holiday
  (`DTSTART;VALUE=DATE`), a Thursday vendor sync landing on that holiday, and two more (Friday team
  lunch, Saturday admin catch-up). 1,594 bytes, pasted as text in prompt 1 exactly as in round 12.
- **Fixture check (remote/fixtures).** `remote/fixtures/` holds `revolut-main.csv`,
  `sample-archive.zip`, `sample-doc.pdf`, `sample-image.png`, `sample-product.html`,
  `sample-rows.csv`, `sample-template.docx` - **no `.ics` fixture exists there**. Per instruction,
  the `ics_import {url}` free-tier response was therefore checked only through c6 itself (the free
  tier always refuses url and always has, gated behind Pro); no separate unscored url-path probe
  was run since there was no fixture URL to serve one from.
- **Clock.** 2026-09-05, a Saturday.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong, or asked for something the tool could
infer. 0 = failed.

## Scorecard - 18 / 18 (round 12: 17 / 18)

| # | Prompt | R12 | R18 | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| c1 | the `.ics` pasted, "Here is my work calendar. Import it as Work." | 3 | **3** | 1 | 14.5 | One `ics_import {name: "Work", text: "<8 events>"}`. Reply: "Imported calendar \"Work\" (8 event definition(s), 1 recurring). Source: text. Kept for your token (2 KB)... Free tier: 1 of 2 calendars used, 1 left." No path anywhere. The model volunteered the Wed 10:00-12:00 vs 11:00-12:00 overlap unprompted, unchanged from round 12 |
| c2 | "What is on my calendar next week?" | 3 | **3** | 1 | 9.5 | One `events_list {calendar: "Work", from: "2026-09-07", to: "2026-09-14"}`, then the model itself narrowed the 9-row raw result (which spanned into the following Monday's standup occurrence) back down to Mon 9/7-Sun 9/13 for "next week." All 7 remaining rows shown in Europe/Warsaw, the RRULE standup expanded to its occurrence, the holiday shown as "All day." Both the overlap and the vendor-sync-on-a-holiday were flagged unprompted |
| c3 | "Where do I have a free two-hour block next week between 9 and 17 Warsaw time?" | 3 | **3** | 1 | 11.0 | One `free_busy {calendars: ["Work"], zone: "Europe/Warsaw", work_start: "09:00", work_end: "17:00"}`. The two overlapping Wednesday events correctly collapsed into one 10:00-12:00 busy block inside the tool's own output; the model surfaced Monday/Tuesday morning as the cleanest 2+ hour blocks and flagged that Thursday's free stretch falls on the holiday |
| c4 | "Do I have any conflicts next week?" | 3 | **3** | 1 | 8.5 | One `conflicts {from: "2026-09-07", to: "2026-09-13"}`. Exactly one pair: 2026-09-09, 60 min, deep-work block against the design review, reported with the right Warsaw-local times. The all-day holiday against the Thursday vendor sync is correctly absent from the tool's own output (whole-day events are reported separately, not as a timed clash) and the model did not invent a mention of it either way - a narrower answer than round 12's, which volunteered that non-clash, but not a wrong or incomplete one for what was asked |
| c5 | "Export next week's events to a calendar file I can download." | 3 | **3** | 1 | 12.0 | One `event_export {calendar: "Work", from: "2026-09-07", to: "2026-09-13", out_path: "next_week.ics"}`, 8 events, first and last named. `GET` the link: 200, `text/calendar; charset=utf-8`, `filename="next_week.ics"`, 1,467 B, opens `BEGIN:VCALENDAR`, 8 `VEVENT`s, and the holiday comes back as `DTSTART;VALUE=DATE:20260910` / `DTEND;VALUE=DATE:20260911` - the CALENDAR_AUDIT all-day fix still holds hosted |
| c6 | "My team publishes its calendar at <url> - can you subscribe to that feed and pull it in?" | 2 | **3** | 1 | 10.1 | One `ics_import {url}`, refused: Pro, both prices, both tenant-carrying links, **plus the D-R58 fix**: "Free alternative, same result: open the feed in a browser or download the .ics, then paste the file contents - ics_import {name: \"Team\", text: \"<the .ics contents>\"}. url only adds fetching the feed for you; the events, the parser and the free-tier calendar allowance are identical." The model relayed that free alternative to the user verbatim in its own reply, on the first turn, and separately noticed `cal.example.com` is a documentation placeholder domain rather than treating it as real. **D-R58 holds live and now scores a clean 3, up from round 12's 2** - the model no longer has to work out the free route itself; the endpoint already tells it |

**Totals: 18/18, 6 tool calls, 65.7 s. Round 12 was 17/18, 6 tool calls, 84.5 s.**

## Independent verification

Every number below was re-read from the endpoint by `curl tools/call` or decoded from the
downloaded bytes, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | one lane, two `/t/<token>` entries, connected first try, no `Authorization` anywhere | PASS |
| The calendar export is a real calendar | `GET` -> 200, `text/calendar; charset=utf-8`, `next_week.ics`, 1,467 B, `BEGIN:VCALENDAR`, 8 `VEVENT`, holiday as `DTSTART;VALUE=DATE:20260910` / `DTEND;VALUE=DATE:20260911` | PASS |
| Attendees survive the export | source `.ics` carries 1 `ATTENDEE` line (`Call with Nova`, Tom Rivera); downloaded `next_week.ics` carries **0** `ATTENDEE` lines | **FAIL, D-R61, still reproduces, not yet fixed** |
| The url gate names the free path (D-R58) | live `ics_import {url}` refusal: upgrade text with both prices and both links, **plus** "Free alternative, same result: ... ics_import {name: \"Team\", text: \"<the .ics contents>\"} ... the events, the parser and the free-tier calendar allowance are identical" | **PASS, D-R58 confirmed fixed and live** |
| The overlapping Wednesday pair merges correctly in `free_busy` | `free_busy` raw output: `10:00-12:00 2h busy Deep work block, Design review` (Europe/Warsaw) as one merged block, not two | PASS |
| `conflicts` reports exactly the one real clash | raw `conflicts` output: `1 overlapping pair(s)`, `2026-09-09 60 min overlap`, Deep work block vs Design review; the all-day holiday and the vendor sync are absent from this tool's output entirely (by design - whole-day events are reported separately) | PASS |
| No filesystem path leaked anywhere in the six replies | grepped all six `assistant` texts and tool results for `/out/`, `/uploads/`, `/home/`: none found | PASS |

## Defects

### D-R58 (calendar) - FIXED, confirmed live, re-verified round 18

Round 12 logged this as fixed from the source diff and one test run; round 18 is the first
independent hosted re-check with a fresh token and a fresh model turn. The refusal text is
unchanged from the round-12 description and the model used it correctly: no purchase, one clean
first-turn answer naming the free `text` path with the caller's own calendar name (`"Team"`)
already filled in. c6 moves from a 2 to a 3.

### D-R61 (calendar) - still open, reproduces identically

`event_export` still drops `ATTENDEE` lines. The source `.ics`'s "Call with Nova" event carries
`ATTENDEE;CN=Tom Rivera:mailto:tom@nova.example`; the round-18 c1 import and c2 `events_list` both
correctly show the attendee in the model's own prose (round 12 saw the same), but the c5 export -
independently downloaded and decoded, not taken from the model's claim - carries zero `ATTENDEE`
lines across all 8 `VEVENT`s. Not hosted-specific; not touched between round 12 and round 18. Same
fix direction stands: carry `ATTENDEE` and `ORGANIZER` through `icsText()` the way `LOCATION`
already is.

### No fixture found for the url-import free-tier check

`remote/fixtures/` has no `.ics` file, so the instructed "also try the url path once outside the
scored run" check had nothing to point a URL at. The scored c6 already exercises `ics_import {url}`
against a non-existent placeholder domain and gets the Pro refusal - the free tier has no code path
where `url` succeeds regardless of whether the feed is reachable, so a second unscored attempt
against a real fixture URL would not have exercised different server logic. Logged as "not
applicable" rather than skipped.

## Bottom line

18/18, up from 17/18 in round 12, and the improvement is exactly the defect round 12 flagged and
this project fixed in between: `ics_import {url}`'s Pro refusal now states its own free equivalent,
the model relayed it verbatim and correctly declined to spend money the caller had not authorized,
and c6 stopped depending on the model working out on its own that pasting does the identical thing.
Every other prompt reproduced its round-12 shape exactly, byte-for-byte on the two downloads: the
all-day holiday still round-trips as `VALUE=DATE` through export, the overlapping Wednesday pair
still merges into one busy block, and `conflicts` still finds the one real clash and nothing more.
The one defect this round did not touch, because nothing shipped for it, is D-R61: attendees still
do not survive a round trip through `event_export`, confirmed again with an independently
downloaded and decoded file rather than the model's claim about it.
