# User value audit, round 12 - 2026-09-04

Round 10 scored six hosted endpoints, round 11 the three servers r10 could not reach. This round
takes the three newest ones - **quotes** (Extension 7), **calendar** and **pdf** (Extension 4) - and
scores them the way a claude.ai user arrives: `https://mcp.zovo.one/mcp/<server>/t/<token>`, no
headers, free tier, one anonymous token minted at `/mcp/connect` and reused, on eighteen prompts
adapted from Part 2 of `docs/QUOTES_AUDIT.md`, `docs/CALENDAR_AUDIT.md` and `docs/PDF_AUDIT.md`.

Two of those prompts only exist hosted. There is no filesystem on the worker, so the PDFs arrive as
base64 through `pdf_upload` and the calendar as pasted `.ics` text - `ics_import {path}` is refused
by design and `ics_import {url}` is Pro, so **the free hosted path for a calendar is paste, and
nothing else**. Whether the endpoint says so turned out to be this round's first defect.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, 7,799 bytes, minting
  `anon_9018420e8c11890e1671d0ea5ca1887e`. One token, reused for all three lanes.
- **Registration, per lane only.** The free tier is 600 calls per hour per token and a CLI session
  re-handshakes **every registered endpoint on every turn** (D-R53), so no lane carried an endpoint
  it did not need: quotes + invoice, calendar + timezone, pdf alone. Every entry is
  `{"type":"http","url":"https://mcp.zovo.one/mcp/<server>/t/<token>"}` with **no `--header`
  anywhere**. No lane came near the cap: 21 tool calls over 18 turns.
- **Allowlist.** 61 `mcp__<server>__<tool>` entries from a live `tools/list` of each endpoint
  (quotes 11, invoice 12, calendar 12, timezone 11, pdf 15).
- **Client.** `claude` 2.1.260, `--model sonnet`, `--strict-mcp-config`, `--output-format
  stream-json --verbose --max-turns 20`, one `--session-id` then five `--resume` per lane.
- **D-R57 honoured.** Every lane ran in an **empty** working directory with the CLI's own
  filesystem tools disallowed (`Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,NotebookEdit`),
  because r11 measured the model shelling out to the local disk instead of uploading when a
  filesystem was visible. Nothing shelled out this round.
- **The base64 ceiling.** r11's D-R51 fixed the descriptions: the binding limit is what the model
  can retype into a tool call, not the 190 KB request body. Both fixtures were built to sit far
  under it - two 1-page pdf-lib PDFs of 1,009 and 1,011 bytes, **1,348 characters of base64 each**.
  Both uploaded in one turn; the turn still cost 76.4 s.
- **Fixtures.** The two PDFs above, carrying known text (`Total EUR 1000.00` / `Total EUR 2500.00`,
  both `Status: UNPAID`); a 1,272-byte `.ics` with 8 events in `Europe/Warsaw` for the week of
  2026-09-07 - a weekly Monday standup (`RRULE`), a Tuesday call with an attendee, a Wednesday
  10:00-12:00 block deliberately overlapping an 11:00-12:00 review, a Thursday all-day holiday
  (`VALUE=DATE`) and four others. One seed, by curl, before the run: `invoice business_set` for
  Lucky Strike Software, EUR, 23%, 14-day terms, `Europe/Warsaw`, so the quotes lane had a business
  identity the way the local Part 2 did.
- **Clock.** 2026-09-04.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong. 0 = failed.

## Scorecard - 51 / 54

### quotes - 17 / 18 (local Part 2: 18 / 18)

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| q1 | "Quote Nova Ltd for 12 hours of design at EUR 90 an hour and a EUR 300 logo, valid two weeks." | **3** | 1 | 14.5 | One `quote_create` with `validity_days: 14`. Q-2026-0001, `valid_until 2026-09-18`, EUR 1080.00 + EUR 300.00, 23% on EUR 1380.00 = EUR 317.40, `total_minor 169740`. The 23% came from the profile and the model said so; it also said Nova Ltd is not a stored client rather than inventing an address |
| q2 | "What quotes are open and when do they expire?" | **3** | 1 | 5.5 | One `quote_list {state: "open"}`, one row, EUR 1,697.40, 2026-09-18, 14 days left, nothing invented |
| q3 | "Give me the text I can email to Nova for that quote." | **3** | 1 | 10.0 | One `quote_send_text`. The totals column lines up, "valid until 2026-09-18", signed with the profile name. `GET` the link: 200, `text/plain; charset=utf-8`, `filename="Q-2026-0001.txt"`, 465 B, body opens `Hello Nova Ltd,` |
| q4 | "Nova accepted. Invoice it, and then show me every invoice I have." | **3** | 2 | 13.2 | `quote_accept` -> INV-2026-0001, due 2026-09-18, `totals_check` EUR 1697.40 both sides, and the note now names the endpoint rather than a directory. Then `invoice_list` on **the other hosted endpoint, same token**: the invoice is there, EUR 1,697.40, unpaid. The shared invoice store works read-write over the URL path |
| q5 | "Acme wanted 3 days of consulting at PLN 1200 a day, so quote them too - and they have just declined it." | **3** | 2 | 15.6 | `quote_create` inferred **PLN** from the price rather than taking the profile's EUR default, 23% on PLN 3600.00 = PLN 828.00, total PLN 4,428.00, default 30-day validity because this prompt did not ask for two weeks. Then `quote_decline`, `open_quotes_now: 0` |
| q6 | "What is my win rate this quarter?" | **2** | 2 | 14.6 | `quote_report` is Pro; the refusal carried both prices and both tenant-carrying links and the model did not buy. It then computed from `quote_list {from, to}`: 1 accepted of 2 decided = **50%**, which is right, and it named the tool it would have used. Same shape as r11's D-R55: the paywall removes the server's arithmetic, not the answer |

### calendar - 17 / 18 (local Part 2: 17 / 18 after fixes, 13 / 18 as shipped)

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| c1 | the `.ics` pasted, "Here is my work calendar. Import it as Work." | **3** | 1 | 13.3 | One `ics_import {text, name}`. 8 definitions, 1 recurring, `Source: text`, "Kept for your token (1 KB)", the free counter ("1 of 2 calendars used") and a ready `events_list` next step. No path anywhere. The model volunteered the Wednesday overlap unprompted |
| c2 | "What is on my calendar next week?" | **3** | 1 | 14.8 | Resolved "next week" to 2026-09-07..13 itself. All 8 rows, times in `Europe/Warsaw` from the profile, the standup **occurrence** expanded from the `RRULE`, the all-day holiday as `all day`. It flagged both the overlap and the vendor sync landing on the holiday |
| c3 | "Where do I have a free two-hour block next week between 9 and 17 Warsaw time?" | **3** | 1 | 11.1 | One `free_busy` with `zone: "Europe/Warsaw"` passed through. 13h 45m booked, 26h 15m free, six busy blocks; the two overlapping Wednesday events collapse into one 10:00-12:00 busy block, which is right |
| c4 | "Do I have any conflicts next week?" | **3** | 1 | 7.8 | Exactly one pair: 2026-09-09, 60 min, deep-work block against the design review. The all-day holiday against the Thursday vendor sync is correctly **not** a timed clash, and the model said so rather than leaving it silent |
| c5 | "Export next week's events to a calendar file I can download." | **3** | 1 | 9.8 | One `event_export`, 8 events, first and last named. `GET` the link: 200, `text/calendar; charset=utf-8`, `filename="next_week.ics"`, 1,481 B, opens `BEGIN:VCALENDAR`, 8 `VEVENT`s, and the holiday comes back as `DTSTART;VALUE=DATE:20260910` / `DTEND;VALUE=DATE:20260911` - **the CALENDAR_AUDIT all-day fix holds hosted** |
| c6 | "My team publishes its calendar at <url> - can you subscribe to that feed and pull it in?" | **2** | 1 | 27.7 | `ics_import {url}` refused: Pro, both prices, both tenant-carrying links. Correct, and the model neither bought nor invented events. The deduction is what the refusal did **not** say: that pasting the file contents does the identical thing for nothing. The model worked that out and told the user; the endpoint did not. **D-R58, fixed** |

### pdf - 17 / 18 (local Part 2: 17 / 18)

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| p1 | two PDFs pasted as base64, "upload them as invoice-a and invoice-b" | **3** | 2 | 76.4 | Two `pdf_upload` calls, `Uploaded "invoice-a.pdf" (1009 bytes)` and `(1011 bytes)`, both exactly the fixture sizes, each answering with the name to pass back. Right first time and no filesystem call, which is the D-R57 re-run condition holding. 76.4 s for 2,696 characters of base64 is the cost, not a failure |
| p2 | "Merge those two into one file." | **3** | 1 | 8.7 | One `pdf_merge {paths, out_path}`, 2 pages, sources listed with their own page counts. `GET`: 200, `application/pdf`, `filename="invoices-merged.pdf"`, 2,001 B, `%PDF-1.7` |
| p3 | "Stamp the merged file PAID and give me the file." | **3** | 1 | 8.5 | One `pdf_stamp`, 2 pages, and it volunteered that the stamp is selectable drawn text and the input is unchanged. `GET`: 3,069 B, `application/pdf`. Independent decode: both pages carry `PAID` **and** still carry `Status: UNPAID`. The response leaked the virtual root, `"source": "/out/invoices-merged.pdf"` - **D-R59, fixed**; it did not cost this answer because the model never repeated it |
| p4 | "How many pages is that?" | **2** | 0 | 2.9 | "2 pages." Correct, and traceable to `pdf_merge`'s own `pages: 2` one turn earlier - but **no tool ran**, so the number was restated from the transcript rather than read from the file that had been rewritten in between. `pdf_count` costs one call. D-R63, client-side |
| p5 | "What does page 2 say the total is?" | **3** | 1 | 8.3 | `pdf_text {path, pages: "2"}` read `Total EUR 2500.00` off the stamped file, and the answer added that the page's own status field still says UNPAID under the stamp - the file/record gap named unprompted, the same thing the local s4 did. The tool printed how it read the page (`node:zlib`, no OCR, drawing order) |
| p6 | "Split the stamped file back into single pages." | **3** | 1 | 9.4 | One `pdf_split`, two parts, two links. `GET` both: 2,031 B and 2,033 B, `application/pdf`, `filename="invoices-merged-paid-page1.pdf"` / `-page2.pdf`, 1 page each, and each carries its own invoice text plus `PAID` |

**Totals: 51 / 54, 21 tool calls, 272.1 s.** Both deductions that are not client-side are a Pro
refusal, and in both the model answered anyway.

## Independent verification

Every number below was re-read from the endpoints by `curl tools/call` or decoded from the
downloaded bytes, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | three lanes, five `/t/<token>` entries, every lane connected first try, no `Authorization` anywhere | PASS |
| The quote store | `quote_list` by curl: Q-2026-0001 Nova Ltd accepted EUR 1697.40 with `invoice_number INV-2026-0001`, Q-2026-0002 Acme declined PLN 4428.00 | PASS |
| The accepted quote really became an invoice on the other endpoint | `invoice_get INV-2026-0001` on `/mcp/invoice`, same token: `gross_minor 108000`, `tax_rate 23`, due 2026-09-18, client Nova Ltd | PASS |
| The quote text download | `GET /mcp/download/95698b93...` -> 200, `text/plain; charset=utf-8`, `Q-2026-0001.txt`, 465 B, opens `Hello Nova Ltd,` | PASS |
| The calendar export is a real calendar | `GET` -> 200, `text/calendar; charset=utf-8`, `next_week.ics`, 1,481 B, `BEGIN:VCALENDAR`, 8 `VEVENT`, holiday as `VALUE=DATE` on 2026-09-10/11 | PASS |
| Attendees survive the export | 0 `ATTENDEE` lines in the exported `.ics` against 1 in the source | **FAIL, D-R61, logged** |
| The PDFs are real PDFs | four `GET /mcp/download/<id>`: 2,001 / 3,069 / 2,031 / 2,033 B, all `application/pdf`, all `%PDF-1.7`, filenames matching the names the caller chose | PASS |
| Page counts and page text, decoded locally | pdf-lib: merged 2 pages, stamped 2, each split part 1. Inflating every content stream and reading the hex `Tj` operands: page 1 `Acme Ltd - Invoice INV-A-001 / Design sprint / Total EUR 1000.00 / Status: UNPAID`, page 2 the INV-B-002 equivalent with `Total EUR 2500.00`, and `PAID` present twice in the stamped file and once in each split part | PASS |
| `pdf_files` shows what the token owns | 2 uploaded (1009, 1011) and 4 generated, every name stripped of the virtual root | PASS |
| The url gate names the free path | before: Pro price and links only. After the fix, live: `Free alternative, same result: ... ics_import {name: "Team", text: "<the .ics contents>"} ...` | **FIXED, verified live** |
| A pdf tool's echoed input path | before: `"source": "/out/invoices-merged.pdf"`. After the fix, live: `"source": "invoices-merged.pdf"` | **FIXED, verified live** |
| `business_set` on the hosted invoice endpoint | reply names `/home/mcp/.local/share/mcp-servers/invoice` and lists seven servers, none of them quotes, pdf or calendar | **FAIL, D-R60, logged** |

## Defects

### D-R58 (medium, calendar) - FIXED, with a test

**The Pro refusal for `ics_import {url}` named the price and not the free path that does the same
thing.** Hosted, `path` is refused by design and `url` is Pro, so paste is the only free way to get
a calendar in - and the refusal a free caller hits first said only "Pro is a one-time $19". A model
that stops there leaves the user believing the hosted calendar needs a payment to be usable at all.
This one did work it out and offer paste, which is why c6 is a 2 and not a 1; the next one might not.

`servers/calendar/src/index.ts` now answers the url gate with the upgrade text **plus** the
alternative, written as a call the caller can run, carrying the name they already asked for:

```
"importing a calendar from a URL" is a Pro feature. Pro is a one-time $19 ... 

Free alternative, same result: open the feed in a browser or download the .ics, then paste the
file contents - ics_import {name: "Team", text: "<the .ics contents>"}. url only adds fetching
the feed for you; the events, the parser and the free-tier calendar allowance are identical.
```

Verbatim from the suite:

    ok 12 - D-R58: the url gate names the free text path that gets the same events
    # tests 51
    # pass 51
    # fail 0

### D-R59 (medium, pdf, hosted only) - FIXED

**Four pdf tools echo the input path back as `source`, and hosted that path is a virtual root the
caller cannot see or pass back.** `pdf_split`, `pdf_rotate`, `pdf_stamp` and `pdf_reorder` all
answer with `{source: f.path, ...}`. The link substitution only rewrites paths that were
**published** in that request - the new output - so the input, which was published by an earlier
request, was printed raw: `"source": "/out/invoices-merged.pdf"`. The caller uploaded
`invoice-a`, merged into `invoices-merged`, and was then shown a root that exists nowhere they can
reach and is not the string any tool accepts.

`remote/src/index.ts` gives the pdf endpoint `strip: ["/uploads/", "/out/"]`, exactly what the image
and bank-statement endpoints already carry; `pdf_files` was already right because it builds names
rather than echoing paths. Live after the deploy: `"source": "invoices-merged.pdf"`.

### D-R60 (low, invoice, hosted only) - logged, outside this round's commit scope

`business_set` on `/mcp/invoice` answers "Business profile saved to
`/home/mcp/.local/share/mcp-servers/invoice` and to the shared profile at
`mcp-servers/profile/business.json`, which docx, expense-tracker, recurring, time-tracker, timezone,
resume and clauses all read." Both halves are wrong for a hosted caller: the directory is the
worker's virtual homedir, and the list of readers omits **quotes**, **pdf** and **calendar**, all
three of which read that profile - quotes signs its emails with the name, `pdf_watermark_business`
reads it, calendar takes its display zone from it. Extension 7 already noted the missing `quotes`.
The string lives in `servers/invoice/src/index.ts`, which another agent holds this session, so it is
logged rather than edited. Fix direction: name the endpoint, not the path, and derive the reader
list from the set of servers that import `readSharedProfile` instead of hard-coding it.

### D-R61 (low, calendar) - logged

`event_export` drops `ATTENDEE` lines. The source event carries
`ATTENDEE;CN=Tom Rivera:mailto:tom@nova.example`; `events_list` shows the attendee and
`event_to_time_entry` puts it in the note, but the exported `.ics` has none, so a round trip through
export loses who was invited. Not hosted-specific. Fix direction: carry `ATTENDEE` and `ORGANIZER`
through `icsText()` the way `LOCATION` already is.

### D-R62 (client-side, measured) - the base64 turn is slow even well under the ceiling

r11's D-R51 fixed what the upload tools **say**; it did not make the paste cheap. Two PDFs at 1,348
characters of base64 each - roughly a seventieth of the 190 KB request-body ceiling - cost **76.4 s**
in one turn, against 8.7 s for the next turn in the same session. The description's advice holds
(a real photo or a real scanned PDF goes over stdio), and the honest number for a hosted paste is
tens of seconds for a couple of KB.

### D-R63 (client-side) - a page count answered without reading the page

p4 answered "2 pages" with **no tool call**, from `pdf_merge`'s `pages: 2` one turn earlier. The
answer is right and the file had not changed page count - but a stamp had rewritten the file in
between, and `pdf_count` exists and costs one call. Nothing server-side to fix; worth noting because
it is the failure mode a scorecard cannot distinguish from a correct read.

## Bottom line

The three newest endpoints hold up hosted: 51/54, and every download this round was fetched and
decoded rather than believed. quotes carried a quote to an accepted invoice that the **invoice**
endpoint then listed for the same token - the read-write shared store Extension 7 built, exercised
by a model that was never told the two endpoints share anything. calendar's all-day export fix, the
thing CALENDAR_AUDIT scored a 1 before, survives the hosted round trip as `VALUE=DATE`. pdf took two
pasted PDFs through merge, stamp, text and split with the bytes matching the prose at every step.

The seam this round is smaller than r11's and the same species. r11 found endpoints stating a limit
that is not the limit that binds. r12 found endpoints stating a **path** and a **price** that are
not the caller's: `pdf_stamp` handed back `/out/invoices-merged.pdf`, a root with no meaning on the
other side of the URL, and `ics_import` answered the one gate a free hosted caller cannot route
around with a price and no mention of the free route that gets the identical result. Both are one
string. Both are fixed and deployed.

## RESULT.md block

```
status: DONE
evidence:
  hosted round for the three newest servers - quotes (Extension 7), calendar and pdf (Extension 4) -
    through https://mcp.zovo.one/mcp/<server>/t/<token> with NO headers, one anonymous token
    (anon_9018420e8c11890e1671d0ea5ca1887e) minted at /mcp/connect and reused, free tier
  18 prompts (6 per server) adapted from Part 2 of QUOTES_AUDIT / CALENDAR_AUDIT / PDF_AUDIT, plus
    the two things only the hosted path forces: two PDFs pasted as base64 through pdf_upload and an
    .ics pasted as text (path is refused by design, url is Pro, so paste is the whole free path).
    claude 2.1.260, sonnet, --strict-mcp-config, 61-entry per-tool allowlist from a live tools/list,
    registered PER LANE only (quotes+invoice, calendar+timezone, pdf alone) because the free tier is
    600 calls/hour/token and a session re-handshakes every registered endpoint every turn (D-R53).
    Every lane ran in an empty dir with the CLI's filesystem tools disallowed, per D-R57
  scored 51/54 in 21 tool calls and 272.1 s: quotes 17/18, calendar 17/18, pdf 17/18
    (local Part 2 equivalents: 18/18, 17/18 after fixes, 17/18)
  verified from the endpoints and the downloaded bytes, not the prose: quote_list and invoice_get on
    TWO endpoints on one token agree on INV-2026-0001 EUR 1697.40; the .txt download is text/plain
    465 B; the .ics export is text/calendar 1481 B with 8 VEVENTs and the all-day holiday as
    DTSTART;VALUE=DATE; four PDF downloads are application/pdf %PDF-1.7 at 2001/3069/2031/2033 B and
    decode to 2/2/1/1 pages carrying exactly the fixture text plus PAID
  2 defects found and FIXED (deployed 24b536d4-ccca-4a19-9da5-2d1f6118b3e4): D-R58 the ics_import
    url Pro gate named the price and never the free paste path that gets the identical events, which
    is the one gate a free hosted caller cannot route around; D-R59 pdf_split/rotate/stamp/reorder
    echoed the input path as "/out/<name>.pdf", a virtual root the caller cannot see or pass back
  4 logged: D-R60 hosted business_set names a homedir path and omits quotes/pdf/calendar from the
    list of profile readers (servers/invoice, held by another agent this session); D-R61 event_export
    drops ATTENDEE; D-R62 a 1.3 KB base64 paste still costs 76 s a turn; D-R63 a page count answered
    with no tool call
  npm test -w servers/calendar 51/51 (new: "D-R58: the url gate names the free text path"); node
    scripts/validate.mjs after the deploy: remote 50/50, billing 23/23, validation db run 50 399/399
cost: 70 wall minutes
insight: r11's seam was an endpoint stating a limit that is not the limit that binds. r12's is the
  same species one step down: an endpoint stating a PATH and a PRICE that are not the caller's.
  pdf_stamp handed back /out/invoices-merged.pdf, a root with no meaning on the other side of a URL
  and not a string any tool accepts; ics_import answered the one gate a free hosted caller cannot
  route around with $19 and no mention of the paste that gets the identical events for nothing. The
  model recovered from both, which is exactly why neither showed up as a wrong answer.
artifacts:
  docs/USER_VALUE_R12.md, data/user_value_r12.json
  servers/calendar/src/index.ts, servers/calendar/test/adversarial.test.mjs
  remote/src/index.ts (deployed 24b536d4-ccca-4a19-9da5-2d1f6118b3e4)
  /private/tmp/uv12/{token.txt,mcp-*.json,allow-*.txt,fx/*,p/*,out/*.jsonl,dl/*.bin,validate.log}
```
