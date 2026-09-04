# User value audit, round 11 - 2026-09-04

Round 10 was the hosted arrival round for six endpoints. It could not reach three servers that
had only ever been scored as a local process: **kanban**, **image** and **bank-statement**. This
round scores those three the way a claude.ai user reaches them - `https://mcp.zovo.one/mcp/<server>/t/<token>`,
no headers, free tier, one fresh anonymous token, nothing seeded - on eighteen prompts adapted
from Part 2 of `docs/KANBAN_AUDIT.md`, `docs/IMAGE_AUDIT.md` and `docs/BANK_AUDIT.md`.

Two of those prompts cannot be run locally at all. There is no filesystem on the hosted endpoint,
so a photo has to arrive as base64 through `image_upload` and a bank export as text through
`bank_upload`, exactly as a user pastes them. That single difference produced the round's worst
defect.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, 7,684 bytes, minting
  `anon_f2a6240310b1076d5eb4824e313c96fb`. One token, reused for every lane.
- **Registration.** Five `http` entries in `mcp.json`, each `https://mcp.zovo.one/mcp/<server>/t/<token>`,
  **no `--header` anywhere**: `kanban`, `image`, `bank-statement`, `time-tracker`, `expense-tracker`.
  The kanban lane had kanban + time-tracker visible and the bank lane bank-statement + expense-tracker,
  the way the audits' Part 2 did, so the cross-server choice that D-B4 and D-K10 are about was live.
- **Allowlist.** 117 `mcp__<server>__<tool>` entries from a live `tools/list` of each endpoint
  (kanban 16, image 15, bank-statement 15, time-tracker 14, expense-tracker 14).
- **Client.** `claude` 2.1.260, `--model sonnet`, `--strict-mcp-config`, `--output-format stream-json
  --verbose --max-turns 20`, one `--session-id` then five `--resume` per lane.
- **Fixtures.** A 40-row Revolut-shaped CSV (Spotify x3, Adobe x2, a EUR 4,500 client payment,
  seven Costa Coffee lines, an Amazon refund, 25 other card payments, one `REVERTED` row) whose
  every total was computed independently with `csv.DictReader`; a 160x120 JPEG, a 64x64 PNG with
  alpha drawn in two known colours, a 96x96 PNG. One Adobe receipt was logged to the hosted
  expense-tracker by curl before the run, so reconciliation had something to reconcile.
- **Clock.** 2026-09-04, a Friday - which is what makes prompt k1 interesting.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong. 0 = failed.

## Scorecard - 49 / 54

### kanban - 17 / 18 (local Part 2: 18 / 18)

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| k1 | "Plan my week for Nova: API design (3h, due Wednesday), docs (2h, Friday), client call prep (1h, Tuesday)." | **2** | 5 | 33.6 | Board created, three tasks stored. The deduction is "Friday": today **is** a Friday, and the D-K6 weekday rule resolves a bare weekday to the nearest day **on or after** today, so Docs landed on 2026-09-04 while Tuesday and Wednesday rolled to next week. The model caught the inconsistency itself and spent a fourth call, `task_update {due: "2026-09-11"}`. The local run scored 3 here because the model chose the dates before the server ever saw them |
| k2 | "What is on the board?" | **3** | 1 | 6.6 | One `task_list`, three rows, right columns and dates, 6h total, no invented state |
| k3 | "Start working on the API design." | **3** | 3 | 11.9 | `task_move` -> doing, `task_start_timer` printed the exact time-tracker arguments, and the model called `mcp__time-tracker__timer_start` with them verbatim - **two hosted endpoints, one token, one sentence**. The hosted kanban cannot read the sibling store, so the project-name warning is unavailable (D-R56); the spelling matched anyway |
| k4 | "Stop, that took 90 minutes, and mark it done." | **3** | 4 | 18.3 | The live timer had run 11 s. `timer_stop`, `entry_edit` to 90 minutes, `task_log_time 90`, `task_done`. Both stores re-read by curl afterwards and both agree |
| k5 | "What is overdue as of next Monday?" | **3** | 1 | 9.4 | Nothing, and for the right reason: NOVA-3 is due Sep 8 and NOVA-2 Sep 11, and NOVA-1 is done. It got there with `task_list {due_before: "next Monday"}` rather than `overdue {as_of}`; the phrase resolves server-side either way, which is the D-K6 fix |
| k6 | "Give me the weekly review." | **3** | 1 | 12.6 | W36, Nova: 1 completed, estimate 3h against actual 1h 30m, the server's "1h 30m under" line relayed, and it said unprompted that the two tasks due Sep 8 and Sep 11 fall in W37 and are correctly outside these numbers |

### image - 18 / 18 (local Part 2: 13 / 18 as shipped, 16 / 18 after the audit fixes)

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| i1 | photo pasted as base64, "save it as photo, then make a web version 120 px wide and under 3 KB" | **3** | 3 | 127.0 | `image_upload` named it `photo.jpg` from the **magic bytes**, then **one** `image_compress` with `max_width` and `max_bytes` hit the target - the D-I11 fix, against six encodes locally. `GET` the link: 200, `image/jpeg`, `photo_web.jpg`, 2,377 B, `ffd8ffe0`, decodes 120x90 |
| i2 | logo pasted as base64, "convert it to JPEG on a white background" | **3** | 2 | 16.0 | One `image_convert`; the tool flattened the alpha onto white itself and said so. Verified by decode: `logo.jpg`, 2,411 B, 64x64, and pixel (2,2) - transparent in the source - is `rgba(255,255,255,255)` |
| i3 | avatar pasted as base64, "crop to a centered square and make 32 and 48 px thumbnails" | **3** | 4 | 17.0 | `image_info` showed 96x96, so it said the crop is a no-op rather than pretending, and produced both sizes as **two separate links**. The local run's stray-file deduction cannot happen here: every output is its own link, not a name in a shared directory. `avatar_32.png` 200, `image/png`, 202 B, `89504e470d0a1a0a`, 32x32 |
| i4 | "Strip the metadata from the photo." | **3** | 1 | 10.0 | One call, no size refusal and no upsell - the D-I8 fix holds hosted - and the re-encode caveat relayed. 200, `image/jpeg`, 3,831 B, zero `exif` strings. The fixture carried no EXIF payload, so this proves the tool runs and writes, not that a payload was removed |
| i5 | "What are the dominant colours of the logo?" | **3** | 1 | 8.0 | `#e8b23a` 45.1%, `#5b3e8a` 44.8%, `#75537b` 0.5%, the free three-colour cap named, nothing invented (D-I9). The two colours are the two the fixture was drawn with, and the shares match their areas |
| i6 | "Batch resize all three images to 400 px wide." | **3** | 1 | 12.0 | One call, **three live download links**, each carrying the server's own `ENLARGED past the source resolution` note (D-I4). This is the case Extension 5 fixed at the shim - the batch tools print the full path so the worker can substitute the URL - and it holds: `photo-400x300.jpg` 200, `image/jpeg`, 11,660 B, decodes 400x300 |

### bank-statement - 14 / 18 (local Part 2: 12 / 18 as shipped, 13 / 18 after)

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| b1 | Revolut export pasted, "import it as Main" | **3** | 2 | 33.1 | `bank_upload` stored `revolut-main.csv` (4,295 B, 43 lines), `statement_import` read it **by name**: 41 imported, the `REVERTED` line dropped and named, Revolut profile detected, 0 duplicates |
| b2 | "Categorise Spotify and Adobe as Software, coffee as Meals." | **2** | 2 | 12.2 | The store is exactly right - 3 rules, 12 rows categorised, 5 Software and 7 Meals. The deduction is a wrong number in the prose: "three rules set (**2 used of the 5** free-tier slots remaining)". The read path of `category_rules` returns `free_limit`; the write path returned only `{rules, categorised}`, so the model had nothing to read and guessed. **D-R52** |
| b3 | "What did I spend in August by category?" | **3** | 1 | 10.5 | **D-B4 did not reproduce.** With both ledgers connected it went straight to `statement_summary {group_by: "category"}`: EUR 1,283.73 out over 36 rows, uncategorised 1,129.44, Software 132.99, Meals 21.30, and the EUR 4,524.99 in kept separate from spend. Every figure matches the independent CSV computation. Locally this scored **1** |
| b4 | "Which subscriptions am I paying?" | **2** | 2 | 22.1 | `recurring_detect` is Pro; the refusal carried both prices and both tenant-carrying links and the model declined to buy. It then hand-computed from `transactions_list` and **reproduced the exact defect the D-B6 fix closed**: Adobe "every ~2 weeks", annualised to about EUR 1,656/year off two charges. Spotify is right. **D-R55** |
| b5 | "Which of my expenses have no bank line, and which bank lines have no receipt?" | **2** | 3 | 30.7 | `reconcile_expenses` is Pro, so the model reconciled by hand **across two hosted endpoints on one token**: 0 expenses without a bank line (Adobe EUR 61.50 matches the 08-07 debit), 35 of 36 in-window bank lines without a receipt, the second Adobe charge on 08-21 flagged, and the window it could not check named. Right answer, entirely by workaround |
| b6 | "Export September to a file I can download." | **2** | 1 | 12.7 | Unlike the local s6 it did not ask which server or which year: right tool, right range, refusal relayed with the link, and then the four September rows printed inline - 9.99 + 25.00 + 3.60 + 6.40 = EUR 45.09, exactly what the file holds. No file, because the download path is Pro |

**Totals: 49 / 54, 38 tool calls, 403.9 s.** Four of the five deductions are the free-tier paywall
rather than a wrong computation. Three bank-statement tools are Pro, and every time one refused the
model answered anyway - **without the guardrails the tool would have applied**.

## Independent verification

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | five `/t/<token>` entries, every lane connected first try, no `Authorization` anywhere | PASS |
| Kanban store as stated | `task_list` by curl: NOVA-3 2026-09-08 1h, NOVA-2 2026-09-11 2h, 2 open, 3h; `weekly_review` W36 1 completed, 3h against 1h 30m | PASS |
| The cross-endpoint handoff | kanban printed `{project: "Nova", task: "API design"}`; time-tracker `entry_list` -> `c047bed8 2026-09-04 Nova / API design 1.50 h` | PASS |
| August bank totals | `statement_summary` -> EUR 1,283.73 out, EUR 4,524.99 in, 36 rows, Software 132.99, Meals 21.30; `csv.DictReader` over the source computes the identical figures | PASS |
| The image downloads are real images | five `GET /mcp/download/<id>`: 2,377 B `ffd8ffe0` 120x90; 2,411 B 64x64 with pixel (2,2) white; 202 B `89504e470d0a1a0a` 32x32; 3,831 B, 0 `exif`; 11,660 B 400x300. Every content type, filename and size matches the prose | PASS |
| A pasted image is uploaded by base64 | `image_upload` -> `Uploaded "photo.jpg" (JPEG, 2574 bytes)`, extension from the magic bytes, not the name | PASS |
| A 38 KB image can be pasted | the same prompt with **51,061 bytes of base64** ran **759 s** and never emitted the `image_upload` call | **FAIL, D-R51** |
| `category_rules` reports the free limit when writing | `{rules: 3, categorised: 12}` against the read path's `free_limit: 5` | **FAIL, D-R52, fixed** |
| The 429 says how to lift it | before: `{error, limit, window, guide}`, `retry-after: 3600`. After the fix, live: `resets_at`, `retry_after_seconds: 655`, `upgradeUrl` and `bundleUrl` both carrying `?tenant=anon_f2a6240310b1...` | **FIXED, verified live** |
| `date_order` for an ISO column | `date_order: "dmy"`, `date_order_inferred: false`, on `2026-08-07 10:00:00`. Parsing is exact; the label is wrong about itself | **FAIL, D-R54, logged** |

## Defects

### D-R51 (high, hosted only, image + bank-statement) - FIXED

**The upload tools advertise a ceiling the client cannot reach, because the payload has to be
re-emitted by the model as a tool argument.** `image_upload`'s description said the 256 KB body cap
is "about 190 KB of image once base64-encoded". Pasting a 38,295-byte JPEG (51,061 bytes of base64),
the model picked the right tool and then produced **no call at all for 759 s**, still emitting when
it was killed at fifteen minutes. The whole lane had to be re-run with a 2,574-byte JPEG (3,433
bytes of base64), which uploaded in one turn. `bank_upload`'s 4,295-byte CSV took 33 s end to end.

The request-body cap is real but it is not the binding limit. The binding limit is the model's own
output: 190 KB of base64 is roughly 50,000 output tokens in a single tool call. Both descriptions
now say so - `image_upload` names roughly 20 KB of base64 (about 15 KB of image) as the practical
paste and points at stdio for a real photo; `bank_upload` says a few KB is quick, tens of KB is a
long call, 50 KB or more can stall the turn before the upload is sent, and to split a big export by
month.

### D-R52 (low, bank-statement) - FIXED, with a test

`category_rules {}` returns `free_limit: 5`. `category_rules {rules: [...]}` returned
`{rules: 3, categorised: 12}` and nothing else, so the model that had just written three rules had
no number to read and told the user "2 used of the 5 free-tier slots remaining". The write path now
returns `free_limit` and `rules_remaining` on the free tier - the same numbers the read path already
reported - and omits both on Pro. Verbatim:

    ok 9 - D-R52: writing rules reports the free limit and what is left, like the read path does
    # tests 40
    # pass 40
    # fail 0

### D-R53 (medium, hosted only) - FIXED and deployed

**The rate-limit refusal was the one cap on this worker that named a number and nothing else.** The
free tier is 600 calls per hour per token, and a CLI session re-handshakes every registered endpoint
on every turn, so eighteen prompts across five endpoints plus one stalled run exhausted it mid-round
and killed the image lane outright - every server reported `429` and the model, correctly, refused
to guess a workaround. The body was `{error: "rate_limited", limit: 600, window: "1 hour", guide}`
with `retry-after: 3600`, sent at 02:46 UTC when the hour bucket actually reset at 03:00.

Every other cap here names the price and links to checkout with the tenant attached (D-R43, D-R44).
This one - the cap a real session hits first - did not. `rateLimit()` now returns `resets_at` and
`retry_after_seconds` computed from the bucket, a note naming the free ceiling, the Pro ceiling of
6,000/hour and the per-turn handshake cost, and `upgradeUrl` / `bundleUrl` carrying the anonymous
token, omitted for a Pro caller. Live after the deploy:

```
{ "error": "rate_limited", "limit": 600, "window": "1 hour",
  "resets_at": "2026-09-04T03:00:00.000Z", "retry_after_seconds": 655,
  "note": "... the free-tier ceiling ... a Pro token gets 6000 calls an hour. Note that a client
           which re-handshakes every registered endpoint on every turn spends several calls per
           turn before any tool runs.",
  "upgradeUrl": "https://mcp.zovo.one/buy/image?tenant=anon_f2a6240310b1076d5eb4824e313c96fb",
  "bundleUrl":  "https://mcp.zovo.one/buy/bundle?tenant=anon_f2a6240310b1076d5eb4824e313c96fb" }
```

### D-R54 (low, bank-statement) - logged

`statement_import` reports `date_order: "dmy"`, `date_order_inferred: false` for a column whose
values are `2026-08-07 10:00:00`. Every date parsed correctly - the August bucketing is exact
against the source file - so this is the endpoint being wrong about itself, not about the data, the
same class as R10's D-R42. Fix direction: report `iso` when every sampled value is `YYYY-MM-DD`, and
reserve `dmy`/`mdy` for the case where a choice was actually made.

### D-R55 (medium, bank-statement, product) - logged

**The free tier removes the guardrail rather than the answer.** `recurring_detect` is Pro, so in b4
the model computed cadence itself and reproduced exactly what the D-B6 fix taught the tool not to
say: Adobe "every ~2 weeks", annualised to about EUR 1,656/year off two charges fourteen days apart.
The tool would have withheld that figure with `cadence_confirmed: false` until a third charge. The
same shape appears in b5 and b6: the paywall does not stop the answer, it only strips the server's
knowledge out of it. Fix direction: let a gated tool answer with its guardrails and gate volume or
export instead, or have the refusal state the rule it would have applied, so a model that answers
anyway inherits it.

### D-R56 (low, kanban, hosted only) - accepted, measured benign

The hosted kanban cannot read the sibling time-tracker store, so `task_start_timer`'s project-name
warning is unavailable (Extension 5 documents this). Measured in k3: the handoff worked and the
model passed the printed project name through verbatim, so nothing was misfiled.
`bank-statement`'s `sharedDoc` mechanism is the fix if the warning is ever wanted.

### D-R57 (client-side) - not fixable server-side

The image lane had to be re-run for a second reason. On the first attempt, in a working directory
holding the real fixture files, the model answered "save it as photo" by **shelling out** - `ls`,
`shasum`, `Read` - decided the local `photo.jpg` differed from the paste, and refused to upload
rather than calling `image_upload` at all. Re-run in an empty directory with the CLI's filesystem
tools disallowed, it uploaded immediately - but still spent four `ToolSearch` calls hunting for
`Write`, `Bash` and `PowerShell` first. `image_upload`'s description already opens with "There is no
filesystem here".

## Bottom line

The three servers hold up hosted. Image is the round's best result and the largest gain over its own
local audit - 18/18 against 13/18 as shipped - and the reason is structural: with no filesystem
there are no stray files to clean up, no name collisions in an output directory, and every result is
a link whose bytes were verified to be the image the prose described. Kanban carried a task from a
board to a running timer on a **second** hosted endpoint and back, on one anonymous token, with
nothing pasted. And the failure that made `BANK_AUDIT` s3 a 1 - the model answering "what did I
spend" from the wrong ledger - did not reproduce with both ledgers connected by URL.

What the hosted path adds is a new class of seam, and this round found it twice in the same place:
**the endpoint states a limit that is not the limit that binds.** The upload tools quoted a
190 KB ceiling that no client can reach, because the payload is model output before it is a request
body; a 38 KB photo hung a turn for thirteen minutes with no error, anywhere. The rate limiter
quoted 600 calls and a flat hour, without saying that a five-endpoint session spends a dozen of them
per turn on handshakes alone, when the reset was fourteen minutes away and the link to lift it was
one string away. Both are now fixed and deployed, and the second one is the same lesson R10 ended
on: the endpoint knew, and did not say.

## RESULT.md block

```
status: DONE
evidence:
  hosted round for the three servers r10 could not reach: kanban, image, bank-statement, through
    https://mcp.zovo.one/mcp/<server>/t/<token> with NO headers, one anonymous token minted at
    /mcp/connect and reused, free tier, no fixture on any server
  18 prompts (6 per server) adapted from Part 2 of KANBAN_AUDIT / IMAGE_AUDIT / BANK_AUDIT, plus the
    two things only the hosted path forces: a PNG/JPEG pasted through image_upload and a Revolut CSV
    pasted through bank_upload. claude 2.1.260, sonnet, --strict-mcp-config, 117-entry per-tool
    allowlist from a live tools/list, kanban+time-tracker and bank+expense-tracker both registered
  scored 49/54 in 38 tool calls and 403.9 s: kanban 17/18, image 18/18, bank-statement 14/18
    (local Part 2 equivalents: 18/18, 13/18 as shipped, 12/18 as shipped)
  verified from the endpoints and the downloaded bytes, not the prose: kanban NOVA-2/NOVA-3 dates and
    W36 review; time-tracker entry c047bed8 1.50 h from a kanban handoff; bank August EUR 1283.73 out
    / 4524.99 in / Software 132.99 / Meals 21.30, identical to a csv.DictReader over the source; five
    downloads 200 with correct content type, filename, magic bytes and decoded dimensions
  3 defects found and FIXED (deployed a99eaf88-260e-439a-9718-18d47a558007): D-R51 the upload tools
    advertised a 190 KB ceiling the client cannot reach because the payload is model output (a 51 KB
    base64 paste stalled a turn 759 s with no error); D-R52 category_rules reported the free rule
    limit when reading and not when writing, so the model guessed and got it wrong; D-R53 the 429
    named a number and nothing else - no reset time, no upgrade link, flat retry-after 3600 on a
    counter resetting in 655 s
  3 logged, not fixed: D-R54 date_order "dmy" for an ISO column; D-R55 the free tier removes the
    guardrail rather than the answer (recurring_detect gated -> the model re-created the exact D-B6
    annualisation); D-R56 no sibling time-tracker store hosted, measured benign. 1 client-side:
    D-R57 the model shells out to the local disk instead of uploading when a filesystem is visible
  npm test -w servers/bank-statement 40/40; node scripts/validate.mjs after the deploy: remote 46/46,
    billing 22/22, validation db run 50 370/370; scripts/uv-index.mjs picks up round 11 at 91%
cost: 95 wall minutes
insight: the hosted seam this round is an endpoint stating a limit that is not the limit that binds.
  image_upload quoted 190 KB of image when the real ceiling is what the model can retype into a tool
  call, so a 38 KB photo hung a turn for 13 minutes with no error anywhere. The rate limiter quoted
  600 calls an hour without saying a five-endpoint session spends a dozen per turn on handshakes, at
  a moment when the reset was 11 minutes away and the link to lift it was one string away.
artifacts:
  docs/USER_VALUE_R11.md, data/user_value_r11.json
  remote/src/index.ts, remote/src/shims/{image-upload,bank-upload}.ts (deployed)
  servers/bank-statement/src/index.ts, servers/bank-statement/test/adversarial.test.mjs
  /private/tmp/uv90/{token.txt,mcp.json,allow.txt,revolut.csv,out/*.jsonl,dl/*.bin}
  /private/tmp/uv90i/out/i*.jsonl
```
