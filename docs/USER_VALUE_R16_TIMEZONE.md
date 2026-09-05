# User value audit, round 16 (timezone re-run) — 2026-09-05

Round 16 is a single-lane re-run of round 15's four timezone prompts, after D-R82 (own zone never
asked for) and D-R84 (`find_meeting_slots` reports its search window) shipped. Same server, same
four prompts, same hosted arrival — the only question is whether the two fixes hold live and what,
if anything, is still missing.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, minting
  `anon_89c4bbc1946adc374bbae2a142d31c1c`. One token, reused for the lane.
- **Registration.** One `mcp.json`, two `http` entries, both `https://mcp.zovo.one/mcp/<server>/t/<token>`,
  no `--header` anywhere: `timezone` and `invoice` (the invoice server is registered only to seed
  the shared business profile the timezone prompts are entitled to assume).
- **Seed.** One curl `tools/call business_set` on `/mcp/invoice` under the token before any prompt
  ran: `{"name": "Nova Studio", "timezone": "Europe/Warsaw"}`. Reply: `default_currency EUR,
  default_tax_rate 0, payment_terms_days 14, invoice_prefix INV, timezone Europe/Warsaw`.
- **Allowlist.** 23 `mcp__<server>__<tool>` entries read from a live `tools/list` of each endpoint
  (timezone 11, invoice 12) — no `mcp__*` wildcard.
- **Client.** `claude` `-p`, `--model sonnet`, `--strict-mcp-config`, `--mcp-config` pointing at the
  two-entry file above, `--output-format stream-json --verbose --max-turns 12`, one `--session-id`
  then three `--resume`, `timeout 240` per prompt. Each prompt's stream-json was written to its own
  file (`out/s1.jsonl` .. `out/s4.jsonl`) before the next prompt started.
- **D-R57 honoured.** The lane ran in an **empty** working directory
  (`/private/tmp/uv-r16tz/wd`) with the CLI's own filesystem tools disallowed
  (`Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, NotebookEdit, Task`). Nothing shelled
  out. Fresh scratch directory local to this run, no reuse of any prior round's state.
- **Clock.** 2026-09-05, a Saturday.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong, or asked for something the tool could
infer. 0 = failed.

## Scorecard — 11 / 12 (round 15: 9 / 12)

| # | Prompt | R15 | R16 | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| tz1 | "Save two contacts for me: Ann in New York and Kenji in Tokyo." | 3 | **3** | 2 | 15.5 | Two `contacts_set` with bare place names. `America/New_York` and `Asia/Tokyo` resolved, default 09:00-17:00 hours named, each reply gave the current local time there. Unchanged from round 15 |
| tz2 | "Find me a 60 minute meeting slot with Ann and Kenji in the next week that works for all three of us." | 1 | **2** | 1 | 22.3 | `find_meeting_slots` ran on the **first turn**, no question asked. `Me` resolved to `Europe/Warsaw` from the shared business profile, `Ann`/`Kenji` from their saved contacts — the payload's own "Zones you did not pass" block named all three sources. **D-R82 holds.** No slot fits standard 9-5 hours for all three (a real constraint: Warsaw/New York/Tokyo do not overlap on a 9-5 day), correctly reported, three ranked compromises given. The payload also carried the D-R84 fix — `Searched 2026-09-05 to 2026-09-09 ... weekends skipped` plus a rollover sentence naming that the window runs past this calendar week's end on a Saturday run day — but the model's final answer **dropped that sentence**, relaying only the free-tier 5-day cap |
| tz3 | "What time is 2026-11-05 09:00 Warsaw for Ann in New York? I want to be sure the daylight saving changes are handled." | 3 | **3** | 1 | 14.4 | One `convert_time`. `09:00 Warsaw (GMT+1)` -> `03:00 New York (EST, UTC-05:00)`, UTC instant `2026-11-05T08:00:00.000Z`. Both DST transitions named (EU 2026-10-25, US 2026-11-01), steady 6-hour gap stated. Unchanged from round 15 |
| tz4 | "Book that November 5th call as a 60 minute meeting and give me an .ics file I can download." | 2 | **3** | 1 | 17.7 | One `ics_create` on the **first turn** (round 15 needed a second turn after the model stopped to ask permission). Download served: 200, `text/calendar; charset=utf-8`, 415 bytes, `filename="call-with-ann-kenji-2026-11-05.ics"`; parses to `DTSTART:20261105T080000Z` / `DTEND:20261105T090000Z` (09:00-10:00 Warsaw, the exact requested slot), `SUMMARY:Call with Ann and Kenji`, Ann and Kenji named in `DESCRIPTION` since neither has a stored email. The model still flagged that 03:00 is the middle of Ann's night, but as an offer to redo it, after already booking and handing over the link |

**Totals: 11/12, 5 tool calls, 69.9 s. Round 15 was 9/12, 4 tool calls (including the wasted second
turn on tz4), 67 s.**

## Independent verification

Every number below was re-read from the endpoint by `curl tools/call` or decoded from the
downloaded bytes, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | one lane, two `/t/<token>` entries, connected first try, no `Authorization` anywhere | PASS |
| D-R82 holds: own zone never asked for | `find_meeting_slots` ran on tz2's first turn with no clarifying question; `contacts_list` by curl ends `You: Europe/Warsaw ... from your shared business profile, so you never need to pass your own zone to find_meeting_slots` | PASS |
| D-R84 holds: the search window is reported | tz2 payload: `Searched 2026-09-05 to 2026-09-09 (5 calendar day(s) forward from today, Europe/Warsaw local; weekends skipped)` plus a sentence naming that the window is past this calendar week's end on a Saturday run day | PASS, server-side |
| The rollover sentence reaches the user | tz2's final assistant text names only the 5-of-7-day free-tier cap; the "this week has already run out" sentence the tool appended is never relayed | **FAIL, client-side, residual** |
| The `.ics` is a real calendar file | `GET` -> 200, `text/calendar; charset=utf-8`, 415 bytes, `filename="call-with-ann-kenji-2026-11-05.ics"`; `BEGIN:VCALENDAR` / `VERSION:2.0` / `BEGIN:VEVENT` / `DTSTART:20261105T080000Z` / `DTEND:20261105T090000Z` / `SUMMARY:Call with Ann and Kenji` / `END:VEVENT` | PASS |
| tz4 books on the first turn | one `ics_create` call, no prior turn asking permission, link handed over in the same reply | PASS |
| `contacts_list` carries the `You:` row live | curl `contacts_list` on the same token: `You: Europe/Warsaw, 2026-09-05 05:04 Sat (GMT+2, UTC+02:00) - from your shared business profile ...` | PASS |

## Residual defect (client-side, not scored against D-R82/D-R84)

**The D-R84 rollover sentence is in the payload and never reaches the user.** `find_meeting_slots`
now correctly appends, after the 5-day free-tier note: *"This search runs from 2026-09-05 (Sat)
through 2026-09-09 (Wed) in Europe/Warsaw local, which is past this calendar week's end - 'this
week' asked for 1 day(s) left may have already run out."* That sentence exists precisely because
the run day was a Saturday and "the next week" is ambiguous on one. The model's actual answer to
the user was:

> "No slot exists in the next week where all three of you are within standard 9:00-17:00 working
> hours -- Warsaw, New York, and Tokyo span too wide a range (Tokyo is ~7h ahead of Warsaw, which is
> ~6h ahead of New York) for a 9-5 overlap to exist for all three simultaneously.
>
> Best compromise options found (Mon, Sep 7):
> 1. **09:00-10:00 Warsaw / 03:00-04:00 New York / 16:00-17:00 Tokyo** -- fits you and Kenji, very
> early for Ann (3am)
> 2. **09:30-10:30 Warsaw / 03:30-04:30 New York / 16:30-17:30 Tokyo** -- similar, Kenji slightly
> over
> 3. **10:00-11:00 Warsaw / 04:00-05:00 New York / 17:00-18:00 Tokyo** -- Ann still very early,
> Kenji slightly over
>
> None of these are reasonable for Ann. Practical alternatives:
> - Ask Ann or Kenji to stretch their hours slightly (e.g., Ann starting at 7am or Kenji staying
> until 19:00) -- that could open a slot around Ann's morning/Kenji's evening.
> - Note: the search only covered 5 of the 7 days (Sep 5-9) since the tool's free tier caps
> lookahead at 5 days; the remaining days (through Sep 12) weren't checked.
>
> Want me to check specific extended hours for Ann or Kenji to find a real fit?"

The model correctly relayed the free-tier day cap (a true and useful fact) but silently dropped the
calendar-week framing the tool had already worked out for it: the caller said "next week" on a
Saturday, and the server had done the work of saying that phrase had almost nothing left to mean.
This is a client-side gap, not a server defect — the fact was available and unused — so it is
logged as a residual, not filed as a new D-R number, and it is why tz2 scores 2 rather than 3.

## Bottom line

11/12, up from 9/12 in round 15. Both round-15 defects that were scored against timezone are gone
live: D-R82 (asking the caller their own timezone) never fires — the tool resolves Warsaw from the
shared profile and states its source unprompted — and tz4 no longer needs a second turn to book,
which was the round-15 shape of D-R64/D-R63 (a model stopping to ask permission the caller had
already given by saying "book it"). D-R84's own fix is confirmed live in the raw payload. The one
point still on the table is not a repeat of either fixed defect: it is the model, not the server,
leaving a true and available fact — "the week you asked for has basically ended" — on the floor
while it answered the narrower question with the tool's own compromise slots instead.
