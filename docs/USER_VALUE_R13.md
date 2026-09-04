# User value audit, round 13 - 2026-09-04

Round 11 scored kanban hosted, round 12 the three newest servers. This round takes the newest
endpoint of all - **barcode** (Extension 8) - plus the two servers whose value only exists when
they talk to each other, **kanban** and **time-tracker**, and scores all three the way a claude.ai
user arrives: `https://mcp.zovo.one/mcp/<server>/t/<token>`, no headers, free tier, one anonymous
token minted at `/mcp/connect` and reused, eighteen prompts.

Two of the three lanes are re-runs on purpose. kanban was measured hosted in r11 and the interesting
half of it - kanban telling the caller the exact `time-tracker` call to make, on a second endpoint,
on the same token - is the only cross-endpoint handoff in the suite. time-tracker had never been
scored on its own, only as kanban's sibling.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, 7,916 bytes, minting
  `anon_99d439c70625548432cd7f127d9b7793`. One token, reused for all three lanes.
- **Registration, per lane only.** The free tier is 600 calls per hour per token and a CLI session
  re-handshakes **every registered endpoint on every turn** (D-R53), so no lane carried an endpoint
  it did not need: barcode alone, kanban + time-tracker, time-tracker alone. Every entry is
  `{"type":"http","url":"https://mcp.zovo.one/mcp/<server>/t/<token>"}` with **no `--header`
  anywhere**. 32 tool calls over 18 turns, nowhere near the cap.
- **Allowlist.** 40 `mcp__<server>__<tool>` entries from a live `tools/list` of each endpoint
  (barcode 10, kanban 16, time-tracker 14).
- **Client.** `claude` 2.1.260, `--model sonnet`, `--strict-mcp-config`, `--output-format
  stream-json --verbose --max-turns 20`, one `--session-id` then five `--resume` per lane.
- **D-R57 honoured.** Every lane ran in an **empty** working directory with the CLI's own
  filesystem tools disallowed (`Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,NotebookEdit`).
  Nothing shelled out.
- **Lane order.** The kanban lane and the time-tracker lane write the same store, so they ran
  sequentially; barcode ran alongside.
- **One seed, by curl, before the run.** `business_set` on `/mcp/invoice`: Nova Studio,
  `PL61109010140000071219812874`, EUR, 23%, 14-day terms, `Europe/Warsaw`. That is the whole setup
  the SEPA prompt is entitled to assume, and it is what BARCODE_AUDIT's Part 2 prompt 2 was about.
- **Clock.** 2026-09-04, a Friday, on a UTC+07 machine - which is what makes k1 and the timesheet
  clock interesting.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong. 0 = failed.

## Scorecard - 50 / 54

### barcode - 16 / 18 (local Part 2, docs/BARCODE_AUDIT.md: 16 / 18)

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| b1 | "Make a QR code for https://mcp.zovo.one and give me the SVG." | **3** | 1 | 14.8 | One `qr_create {format: "svg"}`. Version 2, 25x25 modules, ECC M, 20 bytes of payload, `viewBox="0 0 33 33"` - 25 modules plus the 4-module quiet zone each side. The SVG came back **inline**, no link and no `out_path`, which is the free path working as designed |
| b2 | "Payment QR for EUR 1,230.00 to my IBAN with reference INV-2026-0001." | **1** | 0 | 6.0 | **No tool ran.** The model asked the user for the IBAN and the beneficiary name - both already in the shared profile it could read - and drew nothing. This is BARCODE_AUDIT prompt 2 reproduced exactly, hosted, after the fix that round made was only a description change. **D-R64, fixed with code, not prose** |
| b3 | "EAN-13 barcode for 590123412345." (12 digits) | **3** | 1 | 12.7 | One `barcode_create`. `5901234123457`, `Check digit 7 was computed and added`, 95 modules plus an 11-module quiet zone, inline SVG. The model said the check digit would be computed before it called, and the server agreed |
| b4 | "WiFi QR for my guest network Studio Guest, password letmein2026, WPA2." | **3** | 1 | 17.7 | One `qr_wifi {auth: "WPA"}`. Version 3, 29x29, `Network "Studio Guest"`. Register row payload `WIFI:T:WPA;S:Studio Guest;P:letmein2026;;` - the space in the SSID is carried, not escaped away |
| b5 | "How many codes have I made this month and how many are left free?" | **3** | 1 | 7.8 | One `code_list`. "3 of 20 free codes used in 2026-09", all three named with their kinds and dates. `code_list` by curl afterwards: exactly those three rows |
| b6 | "Give me that EAN-13 as a PNG 600 px wide." | **3** | 1 | 11.8 | Refused by name: PNG is Pro, the free SVG scales to any size, both prices, both tenant-carrying links. The model relayed the free alternative and did not buy. The deduction it did **not** earn is what the refusal did not say - see D-R65 |

### kanban + time-tracker - 17 / 18 (r11 hosted: 17 / 18)

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| k1 | "Plan my week for Nova: API design (3h, due Wednesday), docs (2h, Friday), client call prep (1h, Tuesday)." | **2** | 5 | 39.9 | Board created, three tasks stored - and the same D-K6 weekday behaviour r11 measured: today **is** a Friday, a bare weekday resolves to the nearest day on or after today, so Docs landed on 2026-09-04 while Tuesday and Wednesday rolled to next week. The model caught it itself and spent a fourth call, `task_update {due: "2026-09-11"}`. Identical to r11, deliberately not "fixed": the rule is documented and the alternative is worse |
| k2 | "What is on the board?" | **3** | 1 | 6.8 | One `board`: five columns, 3 tasks in backlog, 6h estimate, nothing overdue. The per-task table the model printed came from the k1 transcript, not from `board`, and every row matched `task_list` by curl |
| k3 | "Start working on the API design." | **3** | 3 | 16.6 | `task_move` -> doing, then `task_start_timer`, which printed the exact `time-tracker` arguments, and the model called `mcp__time-tracker__timer_start` with them **verbatim** - two hosted endpoints, one token, one sentence. `Started timer for "Nova" - API design` |
| k4 | "Stop, that took 90 minutes, and mark it done." | **3** | 4 | 26.1 | The live timer had run 19 s. `timer_stop`, `entry_edit {minutes: 90}`, `task_log_time 90`, `task_done`. Both stores re-read by curl and both agree: NOVA-2 done, estimate 3h against actual 1h 30m; entry 85ccedd8 1.50 h. The `timer_stop` text told the caller to fix the rate with **`entry_update`**, a tool this server does not have - **D-R66, fixed** |
| k5 | "What is overdue as of next Monday?" | **3** | 1 | 11.0 | One `overdue {as_of: "next Monday"}` - the phrase resolved server-side to 2026-09-07 (the D-K6 fix), nothing overdue, and the model named why: NOVA-1 is due the Tuesday after |
| k6 | "Give me the weekly review." | **3** | 1 | 11.4 | W36, Nova: 1 completed, estimate 3h against actual 1h 30m, "1h 30m under" relayed, and it said unprompted that the two tasks due 09-08 and 09-11 fall in W37 and are correctly outside these numbers |

### time-tracker alone - 17 / 18 (never scored alone before)

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| t1 | "Start a timer for the Acme project, task: landing page copy." | **3** | 1 | 6.4 | One `timer_start`. New project created implicitly, no clarifying question |
| t2 | "Stop the timer." | **3** | 1 | 6.9 | One `timer_stop`, 10 s, entry `3ef6e3ba`, and the no-rate note relayed to the user. The note named a nonexistent tool (D-R66); the model paraphrased rather than repeating it, which is the only reason this is not a 2 |
| t3 | "I also worked 2 hours on Acme yesterday morning on the spec - log it at EUR 90 an hour." | **3** | 1 | 8.6 | One `entry_add {start: "2026-09-03T09:00:00", minutes: 120, rate: 90, currency: "EUR"}`. EUR 90.00/h, EUR 180.00. "Yesterday morning" became 09:00 **Warsaw** - stored `07:00Z` - because the profile's home zone is read on input (D-R35) |
| t4 | "How many hours did I track today?" | **3** | 1 | 12.4 | One `report {from, to}` over the local day: 1.50 h. Correct across both projects (the 90-minute Nova entry plus a 10-second Acme one), and the day boundary is the Warsaw one, not the UTC+07 machine's |
| t5 | "Give me this week's timesheet as a CSV I can download." | **3** | 1 | 17.3 | The model resolved the week to Mon 08-31..Sun 09-06 itself, one `export_csv`. `GET` the link: 200, `text/csv; charset=utf-8`, 378 B, `filename="time-entries-2026-09-04T06-11-09-445Z.csv"`, 13 columns, exactly the 3 entries, `2.00/7200`, `1.50/5400`, `0.00/10`, and `90.00,EUR,180.00` on the rated row |
| t6 | "Show me everything I logged last month." | **2** | 1 | 10.9 | `entry_list {from: 2026-08-01, to: 2026-08-31}` -> "No entries found" plus the free-window note, both prices, both tenant-carrying links. Right, and the model refused to push the upsell. The gap is that "No entries found" and "the free tier shows the last 7 days" are two sentences that a caller has to combine to learn that **nothing about August was read at all** - the window was not empty, it was never opened |

**Totals: 50 / 54, 32 tool calls, 235.7 s.**

## Independent verification

Every number below was re-read from the endpoints by `curl tools/call` or from the downloaded
bytes, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | three lanes, four `/t/<token>` entries, every lane connected first try, no `Authorization` anywhere | PASS |
| The code register | `code_list` by curl: 3 rows, `3 of 20 free codes used in 2026-09`, wifi/qr + barcode/ean13 + text/qr, all `svg`, payloads matching the three prompts | PASS |
| The EAN check digit | register row `5901234123457` for the 12 digits given; the response named the digit it added | PASS |
| The kanban board after the run | `task_list` by curl: NOVA-1 due 2026-09-08 1h, NOVA-3 due 2026-09-11 2h, NOVA-2 gone from the open list because it is done; `2 task(s), estimate 3h` | PASS |
| The cross-endpoint handoff really crossed | `task_start_timer` on `/mcp/kanban` printed `{project: "Nova", task: "API design"}`; `timer_start` on `/mcp/time-tracker` accepted exactly that; `entry_list` on the second endpoint holds entry 85ccedd8 "Nova" / "API design" | PASS |
| The CSV is a real CSV | `GET /mcp/download/5ff84a4e...` -> 200, `text/csv; charset=utf-8`, 378 B, header row of 13 columns, 3 data rows, `c41dda10,Acme,spec,...,2.00,7200,true,90.00,EUR,180.00` | PASS |
| The SEPA prompt | no tool call at all; the register stayed at 3 rows | **FAIL, D-R64, fixed** |
| A hosted PNG barcode carries its digits | `remote/build-vendor.mjs` drops `jimp/fonts` and `linearPng` draws bars only; the $19 gate never said so | **FAIL, D-R65, fixed** |
| Every tool name a response cites exists | `entry_update {rate, currency}` in `timer_stop`'s rate note; this server registers `entry_edit` | **FAIL, D-R66, fixed** |
| A timesheet row's day and clock are the same zone | `entry_list` printed `2026-09-03  07:00` for work logged at 09:00 Warsaw: `dayKey` is zone-aware (D-R35), the clock beside it was `toTimeString()` on the host | **FAIL, D-R67, fixed** |

## Defects

### D-R64 (high, barcode) - FIXED, with tests

**`qr_payment_sepa` required `iban` and `name`, so a model asked the user for their own IBAN
instead of drawing the code.** BARCODE_AUDIT measured this locally and answered it with prose: it
rewrote `invoice_payment_qr`'s description to say the IBAN and name are read from the shared
profile. Hosted, with the profile set, the same prompt produced the same miss - the model never
looked at `invoice_payment_qr`, because for "payment QR" the tool named `qr_payment_sepa` is the
obvious one, and its schema said the beneficiary was required input.

The beneficiary is business identity, not per-call input. `servers/barcode/src/index.ts` now makes
both fields optional on `qr_payment_sepa` and resolves them the way `invoice_payment_qr` already
did, through `readSharedProfile()`, with the same refusal naming `business_set` when neither exists,
and an explicit argument still winning. The response says where the beneficiary came from.

Live after the deploy, `qr_payment_sepa {amount: 1230, remittance: "INV-2026-0001"}` with no
beneficiary at all:

    sepa QR code b5731caa: version 5, 37x37 modules, error correction M, 82 bytes of payload.
    Pay Nova Studio at PL61109010140000071219812874, EUR 1230.00. Beneficiary taken from the
    shared business profile.

Two new tests in `servers/barcode/test/smoke.test.mjs` (fallback used and annotated; an explicit
beneficiary wins and is not annotated; nothing anywhere names `business_set` and refuses).

### D-R65 (medium, barcode, hosted only) - FIXED

**The hosted PNG gate asks for $19 and never says the PNG it sells has no digits under the bars.**
`remote/build-vendor.mjs` drops the `jimp/fonts` import because it resolves a `.fnt` directory at
module load and fails worker validation, so `linearPng` draws bars only - a documented,
deliberate hosted limitation, stated in the `GET /mcp` entry and nowhere a paying caller looks. A
free caller reads "PNG output is a Pro feature", pays, and gets a barcode a human cannot read.

The hosted build now names it in both places: in the refusal a free caller reads, and in the
success line a Pro caller gets. Live:

    PNG output is a Pro feature; the free tier returns SVG inline, which scans and prints at any
    size because it has no resolution. On this endpoint SVG is also the only format that prints the
    human-readable digits under the bars: a PNG barcode here is bars only, Pro or not. Ask for
    format: "svg" and this is free.

The qr tools are untouched by the extra sentence: it keys off the `barcode_` feature name, because
a QR code has no human-readable line to lose.

### D-R66 (medium, time-tracker) - FIXED, with a test

**`timer_stop` told the caller to call `entry_update`, a tool that does not exist.** Verbatim from
the hosted run: `No rate: this entry carries no currency and no amount. Set one with
project_set_rate, or entry_update {rate, currency}.` The tool is `entry_edit`, and it needs `id`.
A model relays that name, the caller pastes it, and there is nothing on the other end. Now
`entry_edit {id, rate, currency}`.

The test is the general form, not the instance: `servers/time-tracker/test/round13.test.mjs` parses
every registered tool name out of `src/`, then scans every string literal for the `name {`
citation shape these servers use for a follow-up call, and fails on any citation that is not a
registered tool (with an explicit allowlist for deliberate cross-server calls). It also asserts
non-vacuity in both directions, so it cannot pass by finding nothing.

### D-R67 (medium, time-tracker) - FIXED, with a test

**A timesheet row printed its day in one timezone and its clock in another.** `dayKey()` has been
zone-aware since D-R35; the clock beside it in `entry_list` was
`new Date(e.start).toTimeString().slice(0, 5)`, the **host process** zone. On the worker that is
UTC, so work the caller logged at 09:00 Warsaw - stored correctly as `07:00Z`, on the correct
Warsaw day - came back as `2026-09-03  07:00`. The one field the user can check against their own
memory was the one that was wrong.

`hhmm()` in `servers/time-tracker/src/day.ts` formats in the same home zone `dayKey` uses. Live
after the deploy, the same three rows that read 07:00 / 06:08 / 06:10 before:

    c41dda10  2026-09-03  09:00  Acme  spec  2.00

The test asserts both halves of a row agree, including across a UTC-day boundary (22:30Z is
00:30 on the next Warsaw day, and `dayKey` and `hhmm` must both say so).

### D-R68 (low, time-tracker) - logged

t6's answer is two sentences a caller has to combine: "No entries found" and "the free tier shows
the last 7 days". An empty month and an unread month read identically. Fix direction: when the
whole requested window falls outside the free window, say that nothing in it was read, the way
`calendar.conflicts` and `currency.rate_history` shorten and say what they covered
(docs/GUARDRAILS_RESULT.md's rule).

### D-K6 (kanban) - unchanged, by decision

k1 reproduced r11's weekday behaviour exactly: on a Friday, "Friday" is today. The rule is
documented, the model noticed and corrected itself in one extra call, and the alternative (a bare
weekday always meaning next week) is wrong more often. Left alone, scored 2 again.

## Bottom line

50/54, and every artifact was fetched or re-read rather than believed: the code register, both
stores across the two endpoints of the handoff, and 378 bytes of CSV.

The seam this round is one species, three times over: **the server knows something the caller is
never told**. It knew the beneficiary and asked for it anyway (D-R64). It knew a hosted PNG has no
digits and sold it silently (D-R65). It knew the entry's zone and printed another one (D-R67). And
it named a tool it does not have (D-R66). Only the first cost a point, because in the other three
the model papered over the server: it paraphrased the bad tool name, relayed the free alternative,
and repeated the hours rather than the clock. That is the r12 lesson again - the defects that do not
show up as wrong answers are the ones a scorecard alone will never find, and the reason this round
re-read the bytes.

The cross-endpoint handoff is the thing that held: `task_start_timer` on one hosted endpoint
printing arguments that `timer_start` on another hosted endpoint accepts verbatim, on one anonymous
token, with the model never told the two share anything.

## RESULT.md block

```
status: DONE
evidence:
  hosted round for barcode (Extension 8), kanban and time-tracker through
    https://mcp.zovo.one/mcp/<server>/t/<token> with NO headers, one anonymous token
    (anon_99d439c70625548432cd7f127d9b7793) minted at /mcp/connect and reused, free tier
  18 prompts (6 per lane): barcode from docs/BARCODE_AUDIT.md Part 2 (QR SVG, SEPA QR from amount
    and reference with the profile set on /mcp/invoice first, EAN-13 from 12 digits, WiFi, the
    monthly count, a PNG hitting the Pro gate); kanban with time-tracker registered, checking the
    cross-endpoint handoff; time-tracker alone (start, stop, a manual entry yesterday, a day report,
    a week CSV download, the 7-day free window). claude 2.1.260, sonnet, --strict-mcp-config,
    40-entry per-tool allowlist from a live tools/list, registered PER LANE only (D-R53), every lane
    in an empty dir with the CLI filesystem tools disallowed (D-R57)
  scored 50/54 in 32 tool calls and 235.7 s: barcode 16/18, kanban+time-tracker 17/18,
    time-tracker 17/18
  verified from the endpoints and the bytes, not the prose: code_list holds exactly the 3 codes
    (3 of 20 free used); task_list and entry_list on TWO endpoints on one token agree on the
    handoff (NOVA-2 done, estimate 3h vs actual 1h 30m, entry 85ccedd8 1.50 h); the CSV download is
    text/csv 378 B with 13 columns and 3 rows including 90.00,EUR,180.00
  4 defects found and FIXED (deployed 96a565e4-fb78-4b7a-b09c-b94829fde3e8): D-R64 qr_payment_sepa
    required the IBAN and name the shared profile already held, so the model asked the user and drew
    nothing (BARCODE_AUDIT prompt 2, reproduced hosted after a description-only fix - now code);
    D-R65 the hosted $19 PNG gate never said a hosted PNG barcode has no human-readable digits;
    D-R66 timer_stop cited entry_update, a tool that does not exist; D-R67 entry_list printed the
    day in the profile zone and the clock in the host zone (09:00 Warsaw shown as 07:00)
  1 logged: D-R68 an unread month and an empty month read identically on the free tier
  npm test: barcode 44/44 (2 new), time-tracker 28 tests 27 pass 1 skipped (2 new), kanban 19/19;
    node remote/build-vendor.mjs zero DRIFT; node scripts/validate.mjs after the deploy: remote
    55/55, billing 24/24, validation db run 50 431/431
cost: 55 wall minutes
insight: one species of defect, three times: the server knows something the caller is never told.
  It knew the beneficiary and asked for it anyway, knew a hosted PNG has no digits and sold it
  silently, knew the entry's timezone and printed another one. Only the first cost a point, because
  the model papered over the other two - it paraphrased the bad tool name and repeated the hours
  rather than the clock. A description-only fix is also what let D-R64 survive from BARCODE_AUDIT
  to here: the model never read the description that was fixed, because it never picked that tool.
artifacts:
  docs/USER_VALUE_R13.md, data/user_value_r13.json
  servers/barcode/src/index.ts, servers/barcode/test/smoke.test.mjs
  servers/time-tracker/src/index.ts, servers/time-tracker/src/day.ts,
    servers/time-tracker/test/round13.test.mjs
  remote/build-vendor.mjs, remote/src/vendor/** (deployed 96a565e4-fb78-4b7a-b09c-b94829fde3e8)
  /private/tmp/uv13/{token.txt,mcp-*.json,allow-*.txt,out/*.jsonl,dl/week.csv}
```

Built by theluckystrike. https://github.com/theluckystrike
