# User value audit, round 14 - 2026-09-04

Round 13 scored barcode and the kanban/time-tracker handoff. This round takes the five servers whose
value is a **file crossing the wire**: price-tracker (a page it fetches), spreadsheet (a CSV in, an
xlsx out), currency (nothing but numbers, and the free window), docx (a template in, a filled
document out) and resume (pasted text in, a Word file out). All five scored the way a claude.ai user
arrives: `https://mcp.zovo.one/mcp/<server>/t/<token>`, no headers, free tier, one anonymous token
minted at `/mcp/connect` and reused, twenty prompts, four per server.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, 8,025 bytes, minting
  `anon_47af12da7aa03aa9f5c5e5cd60f118fd`. One token, reused for all five lanes.
- **Registration, per lane only.** The free tier is 600 calls per hour per token and a CLI session
  re-handshakes **every registered endpoint on every turn** (D-R53), so each lane carried exactly
  one entry, `{"type":"http","url":"https://mcp.zovo.one/mcp/<server>/t/<token>"}`, with **no
  `--header` anywhere**. 25 tool calls over 20 turns.
- **Allowlist.** 59 `mcp__<server>__<tool>` entries from a live `tools/list` of each endpoint
  (price-tracker 10, spreadsheet 13, currency 10, docx 14, resume 13).
- **Client.** `claude` 2.1.260, `--model sonnet`, `--strict-mcp-config`, `--output-format
  stream-json --verbose --max-turns 12`, one `--session-id` then three `--resume` per lane.
- **D-R57 honoured.** Every lane ran in an **empty** working directory with the CLI's own
  filesystem tools disallowed (`Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,NotebookEdit,
  Task`). Nothing shelled out, and dx4 proves it: with no web fetch available the model could not
  open its own download link.
- **Fixtures.** A 357-byte CSV of 7 August sales rows; a 1,036-byte `.docx` (**1,384 characters of
  base64**) carrying five `{{placeholders}}`; a resume and a job posting pasted as text; and a
  product page this project owns, `remote/fixtures/sample-product.html`, with the price in JSON-LD.
- **The product page is ours, and getting there took a defect.** The page is served by the worker at
  `https://mcp.zovo.one/mcp/sample/product`, but the hosted price-tracker **cannot fetch it**:
  Cloudflare refuses a worker's loopback to its own zone (D-R73). The copy the hosted endpoint reads
  is the same file on `raw.githubusercontent.com`. Both are pages nobody else owns.
- **Clock.** 2026-09-04, on a UTC+07 machine.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong. 0 = failed.

## Scorecard - 57 / 60

### price-tracker - 12 / 12

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| pt1 | "Check the price on `<the fixture URL>`" | **3** | 1 | 15.0 | One `price_check`. `Title: Zovo Sample Desk Lamp`, `49.00 EUR`, `Confidence: high (source json-ld)`, and it said plainly there is no earlier observation to compare against rather than inventing a change |
| pt2 | "Watch that page for me and alert me when it drops below EUR 40." | **3** | 1 | 11.6 | One `watch_add {target_price: 40}`. Watch `e945c30b`, and the response says the thing a caller most needs to know: **nothing polls this page**, checks run when you ask. It also ended with `Stored in /home/mcp/.local/share/mcp-servers/price-tracker/watches.json`, a path in a Worker with no disk - **D-R69, fixed** |
| pt3 | "I just saw it on sale at 38.50 - record that and show me the price history." | **3** | 2 | 13.1 | `price_add_manual` then `price_history`. Both observations stored, min/max right. The line read `min 38.50 / max 49 EUR` and the alert said `"current": "38.5 EUR"` - three scales of one currency in one watch, **D-R70, fixed** |
| pt4 | "Any price alerts waiting for me?" | **3** | 1 | 9.4 | One `alerts_pending`: `-21.43%`, `target hit and dropped 21.43%`, confidence and source carried through, and the note that this reads stored observations only |

### spreadsheet - 12 / 12

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| ss1 | the CSV pasted, "Load it as sales." | **3** | 1 | 16.0 | One `sheet_load {name, csv}` through the shim. `Loaded "sales" (csv, 356 bytes, 8 lines including the header)`, the name to pass back, and `0.4 KB of 2 MB` used. No path anywhere |
| ss2 | "Describe that sheet: columns, row count, types." | **3** | 1 | 9.0 | One `sheet_info`: `8 rows x 6 cols`, 7 data rows, six typed columns (date / text / number) with samples and an empty-cell count each |
| ss3 | "Show me only the rows where the amount is over 500, highest first." | **3** | 1 | 11.2 | One `sheet_query {where: "[amount] > 500", sort: {col: "amount", dir: "desc"}}`, `3 of 7 rows match`, and the three rows are the right three in the right order |
| ss4 | "Convert the sheet to xlsx and give me a download link." | **3** | 1 | 13.8 | One `sheet_convert {to: "xlsx"}`. `GET` the link: 200, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `filename="sales.xlsx"`, **17,496 bytes opening `50 4b 03 04`**, a 10-entry zip whose `xl/worksheets/sheet1.xml` holds 8 `<row>` elements |

### currency - 11 / 12

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| cu1 | "Convert 2,450 USD to PLN." | **3** | 1 | 12.5 | One `convert`. `PLN 9126.07`, rate 3.724925 with the unrounded `rate_exact` beside it, the rounding rule named, `rate_date 2026-09-03` and why that is not today |
| cu2 | "What was the EUR to USD rate 91 days ago?" | **2** | 1 | 18.5 | `rate_on {date: "2026-06-05"}` -> **"Nothing was looked up"** plus an upgrade pitch. `rate_history` shortens a too-wide window (D-R55); one date beyond the same window refused. The model relayed it and offered to ask again for 2026-06-06, which is a second turn the user should not have needed. **D-R71, fixed** |
| cu3 | "Show me the GBP to EUR rate over the last 91 days." | **3** | 1 | 20.4 | One `rate_history {days: 91}`, shortened to the free 90 and **said so in the payload**: `Free tier reads 90 days back, so this covers 2026-06-07 to 2026-09-04 instead of 2026-06-05`. 64 business days, min 1.154028 on 06-19, max 1.178231 on 07-16, change +0.35% |
| cu4 | "Three invoice lines: 1,200 USD, 850 GBP, 430 CHF. Convert each to EUR and total them." | **3** | 3 | 11.8 | Three `convert` calls, all on the 2026-09-03 rate: 1,033.15 + 987.74 + 457.93 = **2,478.82 EUR**, and the model printed the rate it used per line. `convert_many` would have done it in one call and was in the allowlist; the answer is right either way (D-R75) |

### docx - 11 / 12

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| dx1 | the template pasted as base64, "Upload it as agreement-template." | **3** | 1 | 46.9 | One `doc_upload {name, docx_base64}` through the shim. `Uploaded "agreement-template.docx" (1036 bytes)` - exactly the fixture size - and the name to pass back. 1,384 characters of base64 cost 46.9 s (D-R74) |
| dx2 | "What placeholders does that template have?" | **3** | 1 | 11.2 | One `doc_read {format: "text"}`: 6 blocks, 164 characters, all five `{{...}}` visible in the text, and the model listed them. No tool names a placeholder set of its own, so the model read them out of the body |
| dx3 | "Fill it in: Nova Ltd / Website rebuild / EUR 12,000 / 2026-09-15 / Mike L. Give me the finished file." | **3** | 1 | 11.6 | One `doc_fill_template`. `Replaced 5`, each named. `GET` the link: 200, the Word content type, `filename="agreement-template-filled.docx"`, 1,053 bytes, `50 4b 03 04`; unzipped, `word/document.xml` carries **Nova Ltd, Website rebuild, EUR 12,000, 2026-09-15 and Mike L. once each, and zero `{{`** |
| dx4 | "Read the filled document back so I can check nothing was left unreplaced." | **2** | 2 | 34.5 | `doc_files` (only the template), then `doc_read` on the output name -> `nothing is uploaded under the name "agreement-template-filled.docx". Upload it with doc_upload...` - advice the caller cannot follow, because they hold a URL, not bytes. The model said it could not read the file, then **printed the document from the transcript anyway**. Right content, never read. **D-R72, fixed** |

### resume - 11 / 12

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| rs1 | a resume pasted as text, "paste it into my profile" | **3** | 2 | 20.9 | `profile_get` (empty, and the error named the tool to run) then one `profile_set` that mapped free prose into name, email, location, links, summary, 8 skills, 3 roles with bullets and 1 education entry. `3 roles, 5 bullets, 8 skills` - and then `Stored under /home/mcp/.local/share/mcp-servers/resume; **nothing leaves this machine**`, which hosted is false twice over. **D-R69, fixed** |
| rs2 | the job posting pasted, "Tailor my resume to this job." | **3** | 1 | 20.5 | One `tailor_to_job`. Coverage 37%, matched and missing keywords split by where they were found, and a note that matters: **"Missing keywords were not added anywhere. Add them with profile_set only if they are true."** The model relayed exactly that and offered to add the true ones. `GET`: 10,219 bytes, `PK`, `filename="mike-lipinski-resume.docx"`, and the decoded text carries the real profile, no invented claims |
| rs3 | "Write me a cover letter for that job." | **3** | 1 | 13.9 | One `cover_letter_create`. 122 words, `highlights_not_in_profile: []`, `number_check: every figure in the letter traces to your profile; no figure from the posting was restated as yours`, `fills_required: []`, and `1 of 3 free letters used in 2026-09`. `GET`: 10,194 bytes, `PK`, `filename="helio-cloud-staff-platform-engineer-cover-letter.docx"` |
| rs4 | "Give me the tailored resume as a Word file I can download." | **2** | 0 | 7.3 | **No tool ran.** The model restated rs2's link and warned it may have expired. Correct, and traceable - but the file it points at was written two turns earlier under a one-hour clock, and one `resume_create` costs one call. Client-side, the same shape as r12's D-R63 |

**Totals: 57 / 60, 25 tool calls, 329.1 s.**

## Independent verification

Every number below was re-read from the endpoints by `curl tools/call` or decoded from the
downloaded bytes, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | five lanes, five `/t/<token>` entries, every lane connected first try, no `Authorization` anywhere | PASS |
| The watch store | `price_history` by curl on a second token: two observations, `49.00` json-ld and `38.5` manual, `-21.43%`, target hit | PASS |
| The xlsx is a real xlsx | `GET` -> 200, spreadsheetml content type, `sales.xlsx`, 17,496 B, magic `50 4b 03 04`, 10 zip entries, 8 `<row>` in `sheet1.xml`, `1800` present | PASS |
| The filled .docx really carries the values | 1,053 B, `PK`, unzipped `word/document.xml`: each of the five values exactly once, `{{` count **0** | PASS |
| The resume and letter are real .docx | 10,219 B and 10,194 B, both `PK`, both the Word content type, filenames derived from the name and the posting; decoded text matches the stored profile | PASS |
| The cover letter invents nothing | `highlights_not_in_profile: []`, `fills_required: []`, and every figure in the decoded text (9 years, 20 servers, 40%, 4-person team) is in the pasted resume | PASS |
| A hosted response never names a disk | `watch_add` -> `Stored in ${dbPath()}`; `profile_set` -> `Stored under ${dataDir()}; nothing leaves this machine` | **FAIL, D-R69, fixed** |
| One currency, one scale | `min 38.50 / max 49 EUR`, `"current": "38.5 EUR"`, `"target": "40 EUR"` in one watch | **FAIL, D-R70, fixed** |
| The free window shortens rather than refuses | `rate_history {days: 91}` shortened and said so; `rate_on {date}` one day past the window looked nothing up | **FAIL, D-R71, fixed** |
| A generated document can be read back | `doc_read` on the filled file: "nothing is uploaded under the name ..., upload it with doc_upload" | **FAIL, D-R72, fixed** |
| The hosted tracker can watch our own page | `price_check https://mcp.zovo.one/mcp/sample/product` -> HTTP 522; `https://zovo.one/` -> 526 | **FAIL, D-R73, documented** |
| After the fixes, live | see below | PASS |

Live on the deployed worker after the fixes (version `d8a33886`), on a fresh anonymous token:

```
watch_add        Target: 40.00 EUR ... Kept for your token on this endpoint, not on a disk you
                 can open: watch_list shows it again, and the data is held for 30 days ...
price_add_manual Recorded 38.50 EUR for Lamp (14b7d34a) ... 2 observation(s) stored.
price_history    min 38.50 / max 49.00 EUR
alerts_pending   "current": "38.50 EUR", "previous": "49.00 EUR", "target": "40.00 EUR"
rate_on 2026-06-05  "rate_date": "2026-06-08", "shortened_from": "2026-06-05", "exact": true,
                 "rate": 1.154, note: "... this is the rate on 2026-06-08, NOT 2026-06-05 ..."
docx business_set   Business profile saved for your token on this endpoint and to the shared profile
resume profile_set  Stored for your token on this hosted endpoint (mcp.zovo.one), not on your own
                 machine, and kept for 30 days ... Run the resume server locally over stdio if you
                 would rather it never left your machine.
docx doc_read    ... A document this endpoint GENERATED is not one of these: generated files are
                 served as a one-hour download link and are never kept under your token ...
```

## Defects

### D-R69 (medium, price-tracker + resume + docx) - FIXED, with a test that found a third instance

**Hosted responses told the caller where their data is on a disk that does not exist.**
`watch_add` ended `Stored in /home/mcp/.local/share/mcp-servers/price-tracker/watches.json`;
`profile_set` ended `Stored under /home/mcp/.local/share/mcp-servers/resume; nothing leaves this
machine.` The path is a Worker's in-memory root. The second sentence is worse than wrong: on the
most personal document this estate stores, it tells the user their resume never left their machine
when it is in Cloudflare KV. Both are the r12 D-R59/D-R60 species again.

Fixed in `remote/build-vendor.mjs`, per server, because the stdio sentence is true for stdio:
price-tracker now says the watch is kept for the token on this endpoint with the retention rule,
and resume says it is on the hosted endpoint, **not** on the caller's machine, and names the stdio
package for anyone who wants it to stay local.

The test is the class, not the instances. `remote/test/vendor-paths.test.mjs` scans the **generated**
vendor tree for `${dataDir()}`, `${dbPath()}`, `${outDir()}`, `${storeDir()}` or
`${invoiceDataDir()}` interpolated inside prose, asserts non-vacuity in both directions (the two
known lines must match the pattern, a plain `join(dataDir(), ...)` must not), and fails the build
before a deploy. On its first run it failed on a **third** line nobody had looked at:
`docx business_set` -> `Business profile saved to /home/mcp/.local/share/...`. That one is fixed too.

### D-R70 (medium, price-tracker) - FIXED, with tests

**One watch, one currency, three scales.** Prices are stored as decimal strings exactly as read, so
a page's `49.00`, a caller's `38.5` and a target typed as `40` printed as themselves:
`min 38.50 / max 49 EUR`, `"current": "38.5 EUR"`, `"target": "40 EUR"`. Nothing was wrong - every
comparison is numeric - which is exactly why the scorecard gave the turn a 3 and only re-reading
the bytes caught it. In a server whose entire job is comparing prices, a column of prices that do
not line up is the one thing a human eye is used to trusting.

`displayPrice(price, currency)` in `servers/price-tracker/src/index.ts` is now the single display
path: a currency with minor units is padded (never rounded) to two decimals, a zero-decimal
currency (JPY, KRW, VND, CLP, ISK, the CFA francs and the rest of the ISO 4217 list) stays whole,
an unknown currency keeps the scale it arrived with. `stats()` returns the min and max
**observations' own strings** instead of numbers, because `fmt()` turned `"49.00"` into `"49"`.
Storage and arithmetic are untouched.

`servers/price-tracker/test/round14.test.mjs` drives the real stdio server against a local shop:
page at 49.00, manual 38.5, target 40, then asserts every printed price in `price_history`,
`alerts_pending` and `watch_list` carries one scale, that a JPY page stays whole, and - as
non-vacuity - that the pre-fix `money`/`fmt` pair fails those same assertions. One existing smoke
assertion (`"min": "149"`) was updated to `"149.00"`: that was the defect, asserted.

### D-R71 (medium, currency) - FIXED, with a test

**`rate_history` shortens a too-wide window; `rate_on` refused one date beyond the same window.**
`rate_on {date: 91 days ago}` answered `Nothing was looked up` and a $19 pitch. The caller asked
for a rate and got a price. The estate's own rule (GUARDRAILS_RESULT: shorten and say what you
covered) was applied to the range tool and not to the point tool.

`ratesForDate()` in `servers/currency/src/index.ts` now clamps instead of refusing, and `convert
{date}` inherits it. Two details matter and the first one only showed up live:

1. **The clamp has to move forward.** Clamping to the cutoff and letting `resolveDate` fall back to
   the nearest *previous* published day landed **back before the window** - the deployed first cut
   answered `2026-06-05` for a request for `2026-06-05` while claiming it had been shortened. The
   clamp now takes the first day the ECB published **on or after** the cutoff, so the answer is
   exact by construction.
2. **Every field that could be mistaken for the requested date says otherwise**: `requested_date`,
   `shortened_from`, `rate_date_is_not_requested_date` and a note that opens `this is the rate on
   2026-06-08, NOT 2026-06-05: that date was not read and is not what any number here describes`.

`servers/currency/test/guards.test.mjs` drives it against a 120-day fixture history: a 95-day-old
date comes back with a real rate on a date inside the window, every naming field set; a date inside
the window is untouched (so the test cannot pass by clamping everything); `convert` shortens the
same way. The old smoke assertion that `rate_on` refuses was rewritten to assert the refusal is
gone.

### D-R72 (medium, docx and resume) - FIXED

**A document this endpoint generated cannot be read back, and the error told the caller to upload
it.** Generated files are published as one-hour downloads and deliberately not persisted, so
`doc_read {path: "<the file I just wrote>"}` says `nothing is uploaded under the name ...; upload it
with doc_upload {name, docx_base64}` - advice a caller cannot take, because what they hold is a URL.
dx4 shows the cost: the model tried, failed, and then printed the document out of its own transcript
as though it had read it. The server knew the reason and did not say it.

Both read paths (docx `doc_read`, resume `resume_read`) now end the error with: a document this
endpoint **generated** is not one of these, it is served as a one-hour download link and never kept
under your token, so download it and send it back as `docx_base64`, or ask for the content in the
same call that writes the file.

### D-R73 (medium, hosted, documented not fixed) - a worker cannot fetch its own zone

The natural fixture for price-tracker is a product page on `mcp.zovo.one`, and one is now served at
`GET /mcp/sample/product` (JSON-LD Product, `?price=` to change the asking price). The hosted
price-tracker **cannot read it**: `price_check` on it returns HTTP 522, and `https://zovo.one/`
returns 526. Cloudflare refuses a worker's loopback to its own zone. `mcp-remote.lipmichal.workers.dev`
is refused the same way. So the fixture ships twice - `remote/fixtures/sample-product.html` on
`raw.githubusercontent.com` is the copy the hosted endpoint reads, and the worker route is for stdio
callers and for anyone reading the page in a browser. Not a bug in this estate, but a limit that
belongs in writing: any documentation that tells a hosted caller to point a fetching tool at
`mcp.zovo.one` is telling them to do something that cannot work.

### D-R74 (low, method) - the base64 ceiling is a time ceiling, not a size ceiling

r11's D-R51 established that the binding limit on an upload is what the model can retype, not the
190 KB request body. Round 14 measured where that stops being practical. The first docx lane used a
9,749-byte template - **13,000 characters of base64, comfortably under every documented cap** - and
the upload turn was killed after **16 minutes** having emitted no tool call. Re-run with a 1,036-byte
template (1,384 characters), the same turn took 46.9 s. Between about 1.4 KB and 13 KB of base64 the
hosted upload path goes from usable to unusable, and nothing in any description says so. The
`docx` endpoint's own note ("larger templates need the stdio server") is right for a different
reason than the one it gives.

### D-R75 (low, currency and resume) - logged

Two small things, neither costing a point. `convert_many` exists and is exactly the invoice-lines
tool, and the model used three `convert` calls instead - the description does not say "several
lines at once" in the words a caller uses. And `tailor_to_job` counts non-keywords ("similar",
"record", "reducing", "helio") in the target set, which deflates the coverage figure it reports:
37% against a keyword list a third of which is not a skill.

## Bottom line

57/60, and every artifact was fetched and decoded rather than believed: 17,496 bytes of xlsx opened
as a zip and counted by row, 1,053 bytes of docx unzipped and grepped for five values and zero
remaining placeholders, two 10 KB Word files, and a watch store re-read on a second token.

r13's seam was "the server knows something the caller is never told". r14's is narrower and worse:
**the server tells the caller something that used to be true.** Every one of D-R69 through D-R72 is
a sentence that was correct in the stdio server and became false when the same code was vendored
onto a Worker - a data directory that no longer exists, a promise that nothing leaves your machine,
a free window enforced by refusing rather than shortening, an instruction to upload a file the
caller never had. None of them produced a wrong answer, and the models papered over three of the
four. That is why the fix this round is not four edits but a **scanner**: the vendored tree is now
tested for the shape of the lie, and it caught a third instance in `docx` on its first run.
