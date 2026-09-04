# User value audit, round 15 - 2026-09-04

Round 14 took the five servers whose value is a file crossing the wire. This round takes the four
whose value is a **second party**: expense-tracker (the bank ledger the receipts are not), recurring
(the invoice server it writes into), clauses (the 25 starter clauses that are not yours) and timezone
(the two people on the other end, and you). All four scored the way a claude.ai user arrives:
`https://mcp.zovo.one/mcp/<server>/t/<token>`, no headers, free tier, one anonymous token minted at
`/mcp/connect` and reused, sixteen prompts, four per server.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, 8,025 bytes, minting
  `anon_fcafe20560c3d162ea9d4bbbb493081d`. One token, reused for all four lanes.
- **Registration, per lane only.** The free tier is 600 calls per hour per token and a CLI session
  re-handshakes **every registered endpoint on every turn** (D-R53), so each lane carried exactly
  one entry, `{"type":"http","url":"https://mcp.zovo.one/mcp/<server>/t/<token>"}`, with **no
  `--header` anywhere**. 26 tool calls over 17 turns.
- **Allowlist.** 51 `mcp__<server>__<tool>` entries from a live `tools/list` of each endpoint
  (expense-tracker 14, recurring 14, clauses 12, timezone 11).
- **Client.** `claude` 2.1.260, `--model sonnet`, `--strict-mcp-config`, `--output-format
  stream-json --verbose --max-turns 12`, one `--session-id` then three `--resume` per lane.
- **D-R57 honoured.** Every lane ran in an **empty** working directory with the CLI's own
  filesystem tools disallowed (`Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,NotebookEdit,
  Task,TodoWrite`). Nothing shelled out.
- **Two seeds, by curl, before the run.** `business_set` on `/mcp/invoice`: Nova Studio,
  `PL61109010140000071219812874`, EUR, 23%, 14-day terms, `Europe/Warsaw` - the whole setup the
  recurring and timezone prompts are entitled to assume. And a four-row bank statement imported on
  `/mcp/bank-statement` **under the same token**, because "the monthly summary names the bank ledger
  line when present" is only a question worth asking if the ledger is present. It was, with four
  transactions in the month asked about. The summary never mentioned it: D-R76.
- **Clock.** 2026-09-04, a Friday, on a UTC+07 machine.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong, or asked for something the tool could
infer. 0 = failed.

## Scorecard - 39 / 48

### expense-tracker - 10 / 12

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| ex1 | "Log three expenses: 2026-09-01 Figma EUR 45 (software), 2026-09-02 taxi PLN 68 (travel), 2026-09-03 Adobe EUR 22.99 (software)." | **3** | 3 | 21 | Three `expense_add`. Each reply carried net, VAT and the rate with **where the rate came from** (`your shared business profile default_tax_rate, set with business_set`), and said unprompted that a receipt with no project is not billable and will not appear in `expense_to_invoice`. Two currencies, never mixed |
| ex2 | "Give me a summary of September so far, grouped by category." | **2** | 1 | 10 | One `expense_summary`. EUR software 67.99 and PLN travel 68.00, per currency, correct to the cent. And no `bank_ledger` line - with **four bank transactions stored under the same token in the same month**, worth EUR 177.40 out. The D-B4 warning that exists precisely so a receipt-only total is not mistaken for the whole month is dead on every hosted endpoint. **D-R76, fixed** |
| ex3 | "Export those September expenses as a CSV I can download." | **3** | 1 | 10 | One `expense_export {format: "csv"}`. `GET` the link: 200, `text/csv; charset=utf-8`, 389 bytes, `filename="expenses-2026-09-01-to-2026-09-04.csv"`, 16 columns, exactly the three rows, `45,45,36.59,8.41,23` on the Figma row |
| ex4 | "Now show me everything I logged in June 2026." | **2** | 1 | 10 | `expense_list {from: 2026-06-01, to: 2026-06-30}` -> `"from": "2026-08-05", "to": "2026-06-30"` - a window whose start is **six weeks after its end** - and a note reading `so this covers 2026-08-05 onwards instead of 2026-06-01`. Nothing was read and the note described a range that cannot exist. The model saw through it (`silently clamped ... an empty range`) and relayed it correctly, which is the only reason this is not a 1. **D-R77, fixed** |

### recurring - 10 / 12

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| rc1 | "Set up a monthly retainer for Beta Corp: EUR 1500 for the ongoing platform retainer, first invoice 2026-09-01." | **2** | 2 | 32 | `schedule_list` then `schedule_create`, correct in every respect - and the reply's only money figure was `amount: "EUR 1845.00"` against a prompt that said 1500. The model stopped and asked the user whether the server had misunderstood the price or added tax. It had added tax, and **`/mcp/invoice`'s `invoice_list` breaks the identical number into `subtotal EUR 1500.00` + `23% on EUR 1500.00 = EUR 345.00`**. Same estate, same number, one endpoint explains it. **D-R78, fixed** |
| rc2 | "Do a dry run so I can see what would be invoiced right now before anything is created." | **3** | 1 | 10 | One `invoice_generate_due {dry_run: true}`. One occurrence, period 2026-09-01, `still_due_after_this_run: 0`, and the sentence that makes a dry run safe to trust: nothing was created, and the real run is idempotent, keyed by the occurrence date |
| rc3 | "Looks right. Run it for real and give me the invoice." | **3** | 1 | 10 | One `invoice_generate_due`. `INV-2026-0001 Beta Corp period 2026-09-01 EUR 1845.00 due 2026-09-15` plus a link, and it said the invoices land in the store `/mcp/invoice` reads. Verified: `invoice_list` on that second endpoint, same token, returns exactly that invoice, unpaid, `total_minor 184500` |
| rc4 | "What is coming up on that schedule over the next six months?" | **2** | 1 | 14 | One `schedule_upcoming {days: 183}`. `count: 3`, `occurrences_found_in_horizon: 6`, three rows of EUR 1845.00 - and `totals_per_currency: ["EUR 11070.00"]`, which is six of them. A total no visible row adds up to, with nothing saying which set it covers. The model closed the gap the way models do: it printed a six-row table, **three rows of which it had never been sent**. Right by arithmetic, invented as text. **D-R79, fixed** |

### clauses - 10 / 12

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| cl1 | two clauses pasted, "Save these two clauses for me ... Tag both retainer and b2b." | **2** | 6 | 28 | Two `clause_add` -> `a clause titled "Payment Terms" already exists; use clause_update, or give a different title`. Both titles belong to the **starter library** that ships with the server, not to anything the caller wrote, and the error did not say so. The model read it as "you wrote this before", spent two searches looking for clauses that were never there, then renamed to "(Poland)" and saved both. Four wasted calls to learn a fact the server had in hand. **D-R80, fixed** |
| cl2 | "Find my payment clauses that apply in Poland." | **3** | 1 | 9 | One `clause_search {query, category, jurisdiction: "PL"}` - **free**, per GUARDRAILS_RESULT, and the reason it is free is exactly this prompt: citing a clause from the wrong jurisdiction is the error the filter prevents. One result, `payment-terms-poland`, score 98, `starter: false` |
| cl3 | "Assemble a Service Agreement for Beta Corp ... Give me a Word file I can download." | **3** | 2 | 23 | `variables_list` first - and the model relayed its most useful output unprompted: neither clause has a fee placeholder, so **the EUR 1,500 will not appear in the document**. Then one `contract_assemble {format: "docx"}`, `filled: [payment_days, liability_cap]`, `unfilled: []`. `GET` the link: 200, the Word content type, `filename="beta-corp-service-agreement-beta-corp.docx"`, **9,955 bytes opening `50 4b 03 04`**; unzipped, `word/document.xml` carries `within 14 days`, `statutory interest`, `18,000` and `intentionally` once each, and **zero `{{`** |
| cl4 | "Now search my clauses again but only the ones tagged retainer." | **2** | 2 | 22 | `clause_search {tags: ["retainer"]}` -> the search ran, the tag filter was skipped and the payload **said so by name** (`the tag filter (retainer) was not applied`), which is the GUARDRAILS rule working. The gap is what the message does not say: `clause_list` is free and returns the tags of all 27 clauses, so the answer was one free call away. The model found that itself, on a second call. **D-R81, logged** |

### timezone - 9 / 12

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| tz1 | "Save two contacts for me: Ann in New York and Kenji in Tokyo." | **3** | 2 | 13 | Two `contacts_set` with bare place names. `America/New_York` and `Asia/Tokyo` resolved, default hours named, and each reply gave the current local time there - the fact you actually wanted when you saved the contact |
| tz2 | "Find me a 60 minute meeting slot with Ann and Kenji in the next week that works for all three of us." | **1** | 0 | 13 | **No tool ran.** The model asked the user what timezone they are in. `Europe/Warsaw` is on the shared business profile, this same file already reads it for `now` and for the ICS organizer, and `zoneOf("home")` resolves it - but `find_meeting_slots` made `zone` **required per participant** and `contacts_list` held everyone except the caller. The D-R64 species, third server. **D-R82, fixed** |
| tz3 | "What time is 2026-11-05 09:00 Warsaw for Ann in New York? I want to be sure the daylight saving changes are handled." | **3** | 1 | 14 | One `convert_time`. `09:00 Warsaw (GMT+1, UTC+01:00)` -> `03:00 New York (EST, UTC-05:00)`, `UTC instant 2026-11-05T08:00:00.000Z`. Both zones have left DST by 5 November (EU 25 Oct, US 1 Nov), the offsets prove it, and the model named both dates and said the gap is a steady 6 hours |
| tz4 | "Book that November 5th call as a 60 minute meeting and give me an .ics file I can download." | **2** | 0, then 1 | 13 + 14 | **No tool ran on the first turn**: the model warned that 03:00 is the middle of Ann's night and asked whether to book anyway - defensible, and not what was asked. On the second turn one `ics_create`. `GET` the link: 200, `text/calendar; charset=utf-8`, 472 bytes, `filename="meeting.ics"`, and the file parses: `BEGIN:VEVENT`, `DTSTART:20261105T080000Z`, `DTEND:20261105T090000Z`, `SUMMARY:Beta Corp platform review`, `ORGANIZER;CN="Nova Studio"`. Ann and Kenji have no email, so the server put them in `DESCRIPTION` and said why rather than inventing addresses |

**Totals: 39 / 48, 26 tool calls, 266 s.**

## Independent verification

Every number below was re-read from the endpoints by `curl tools/call` or decoded from the
downloaded bytes, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | four lanes, four `/t/<token>` entries, every lane connected first try, no `Authorization` anywhere | PASS |
| The CSV is a real CSV | `GET` -> 200, `text/csv; charset=utf-8`, 389 B, `expenses-2026-09-01-to-2026-09-04.csv`, 16-column header, 3 data rows, `eade809e,2026-09-01,EUR,45,45,36.59,8.41,23,software,Figma` | PASS |
| The contract is a real .docx | 9,955 B, `50 4b 03 04`, the Word content type; `word/document.xml` holds `within 14 days`, `statutory interest`, `18,000`, `intentionally` once each and `{{` **0 times** | PASS |
| The .ics is a real calendar file | 472 B, `text/calendar`, `BEGIN:VCALENDAR` / `VERSION:2.0` / `BEGIN:VEVENT` / `DTSTART:20261105T080000Z` / `DTEND:20261105T090000Z` / `END:VEVENT`; DTSTART is 09:00 Warsaw on a post-DST date, to the second | PASS |
| The invoice really crossed endpoints | `invoice_list` by curl on `/mcp/invoice`, same token: `INV-2026-0001`, Beta Corp, subtotal EUR 1500.00, `23% on EUR 1500.00 = EUR 345.00`, total EUR 1845.00, unpaid | PASS |
| The jurisdiction filter is free | `clause_search {jurisdiction: "PL"}` answered on the free tier, one result, no gate text | PASS |
| The tag filter skips rather than refuses | `clause_search {tags}` returned results-shaped output plus `free_tier_note` naming the dropped filter | PASS |
| The summary names the bank ledger when present | 4 bank transactions imported for the token; `expense_summary` returned **no `bank_ledger` field at all** | **FAIL, D-R76, fixed** |
| The free window shortens rather than lying | `expense_list {from: 06-01, to: 06-30}` -> `from 2026-08-05, to 2026-06-30`, note claiming coverage `2026-08-05 onwards` | **FAIL, D-R77, fixed** |
| A recurring amount is legible | `schedule_create` -> `amount: "EUR 1845.00"` and nothing else, for a EUR 1500 retainer | **FAIL, D-R78, fixed** |
| An upcoming total matches its rows | 3 rows of EUR 1845.00 above `totals_per_currency: ["EUR 11070.00"]` | **FAIL, D-R79, fixed** |
| A title collision names the library it hit | `a clause titled "Payment Terms" already exists; use clause_update` - for a starter clause | **FAIL, D-R80, fixed** |
| Your own timezone is never asked for | `find_meeting_slots` required `zone` per participant; `contacts_list` had no row for the caller | **FAIL, D-R82, fixed** |
| After the fixes, live | see below | PASS |

Live on the deployed worker after the fixes (version `38ce5e28`), on a fresh anonymous token
`anon_7cc163f79f32d66bfc0f7d696a7bbef7`:

```
expense_summary   "bank_ledger": "These are hand-logged receipts only. Any bank statements you
                  imported under this same token live in a separate store on
                  https://mcp.zovo.one/mcp/bank-statement, which this endpoint cannot read, so
                  nothing from them is counted above ... call that endpoint's statement_summary"
expense_list      "from": null, "to": "2026-06-30", "nothing_read": true, note: "Nothing was read.
                  The free tier reads the last 30 days only, back to 2026-08-05, and every day you
                  asked for (2026-06-01 to 2026-06-30) is older than that, so this is not an empty
                  result - the period was never opened."
schedule_list     "amount": "EUR 1845.00", "subtotal": "EUR 1500.00",
                  "tax": ["23% on EUR 1500.00 = EUR 345.00"], "amount_includes_tax": true
schedule_upcoming "totals_cover": "all 6 occurrence(s) found in the horizon, which is MORE than the
                  3 listed above: the rows you can see add up to EUR 5535.00",
                  "totals_per_currency_listed_rows": ["EUR 5535.00"]
clause_add        "Payment Terms" is the title of a STARTER clause (payment-terms) that ships with
                  this server, not one you wrote - you have not saved a clause by this name. Give
                  yours a distinguishing title (for example "Payment Terms (PL)") ... or call
                  clause_update {id: "payment-terms"} to overwrite the starter text with yours.
find_meeting_slots  Me (Europe/Warsaw) | Ann (America/New_York) | Kenji (Asia/Tokyo)  -- from
                  {name: "Me"}, {name: "Ann"}, {name: "Kenji"} and nothing else
contacts_list     You: Europe/Warsaw, 2026-09-04 12:58 Fri (GMT+2, UTC+02:00) - from your shared
                  business profile, so you never need to pass your own zone to find_meeting_slots
```

## Defects

### D-R76 (high, expense-tracker hosted) - FIXED

**The cross-server warning that exists so a receipt total is not mistaken for a month's spending
does not exist on the hosted endpoint.** `bankLedgerLine` (D-B4) counts the bank-statement
transactions in the period and names the exact bank tool to call. It reads
`/home/mcp/.local/share/mcp-servers/bank-statement/data.json`, which over stdio is a sibling file
this process can open. Hosted, the bank ledger is a **separate tenant document** served by
`/mcp/bank-statement`, and `remote/src/index.ts` hydrates it into the bank endpoint (which reconciles
against expenses) but not the other way. So `readBankTransactions()` always answers "absent", and
"absent" is treated as "you do not have bank-statement" - silence. Measured with four transactions
stored under the same token in the same month: `expense_summary` returned no `bank_ledger` field, and
a caller reading `EUR 67.99` for September had EUR 177.40 of bank debits they were never pointed at.

Fixed in `remote/build-vendor.mjs`, per server, because the stdio behaviour is right for stdio: the
hosted `bankLedgerLine` is **unconditional** and says the three true things - these are hand-logged
receipts only, any statements imported under this token are in a separate store this endpoint cannot
read, and **no count of them can be given here**, so call `/mcp/bank-statement`'s tool. It does not
pretend to a number it cannot have. Absent is not evidence of empty, and that is the whole fix.

### D-R77 (medium, expense-tracker) - FIXED, with tests

**The free 30-day window could return a range whose start is after its end, and describe it as
coverage.** `windowNote(from)` clamped `from` forward to the cutoff and never looked at `to`, so
"everything I logged in June" came back as `"from": "2026-08-05", "to": "2026-06-30"` with the note
`so this covers 2026-08-05 onwards instead of 2026-06-01`. Nothing in June was read; nothing could
have been; and the sentence says the opposite of that. This is D-R71 (currency `rate_on`) in a
second server: the estate's rule is shorten and say what you covered, and a shortening that lands
past the end of the request is not a shortening.

`windowNote(from, to)` in `servers/expense-tracker/src/index.ts` now has three outcomes instead of
two. Inside the window: untouched, no note. Straddling the cutoff: clamped, and the note names
**both ends** of what was covered. Entirely older than the window: `nothing_read: true`, the reported
`from` is **null** rather than an impossible date, and the note opens `Nothing was read` and closes
`this is not an empty result - the period was never opened`. The clamp still governs the SELECT, so
no gated row is read. All four call sites pass `to`.

`servers/expense-tracker/test/round15.test.mjs` drives the real stdio server: a 120-to-90-days-ago
range asserts `nothing_read`, the new sentence, `from === null` and - as non-vacuity - that the old
`so this covers ... onwards` wording is **gone**; a straddling range asserts it is still shortened,
still answered, and still totals the one expense inside the window; a range wholly inside asserts no
note at all, so the test cannot pass by flagging everything.

### D-R78 (medium, recurring) - FIXED, with tests

**Every amount this server printed was gross, and it never said so.** A EUR 1,500 monthly retainer
reads back as `amount: "EUR 1845.00"` in `schedule_create`, `schedule_list`, `schedule_get`,
`schedule_upcoming` and `invoice_generate_due`. The number is right - the shared profile carries
`default_tax_rate: 23` - but nothing in the payload distinguishes "the server added 23% tax" from
"the server misunderstood the unit price", and those have opposite fixes. The model did the right
thing and stopped to ask. What makes it a defect rather than a preference is that **the sibling that
issues the invoice already prints the breakdown**: `invoice_list` on `/mcp/invoice` returns
`subtotal EUR 1500.00`, `["23% on EUR 1500.00 = EUR 345.00"]`, `total EUR 1845.00` for the very same
schedule. One endpoint in this estate makes the number legible and the one that produced it does not.

`scheduleAmounts()` in `servers/recurring/src/index.ts` is now the single money-display path for a
schedule and returns `amount`, `subtotal`, `tax` (formatted per rate, the same wording `invoice_list`
uses) and `amount_includes_tax`. `summarize()` and the `schedule_upcoming` rows spread it. Storage
and arithmetic are untouched.

### D-R79 (medium, recurring) - FIXED, with tests

**A total that no visible row adds up to.** `schedule_upcoming` sums every occurrence found in the
horizon and then truncates the list to the free-tier cap, so six months of a monthly retainer
returned three rows of EUR 1,845.00 above `totals_per_currency: ["EUR 11070.00"]`. The note says how
many were withheld; nothing says the total counts them. The cost is visible in the transcript: the
model reconciled the two by printing a **six-row table, three rows of which it was never sent** -
correct by arithmetic, fabricated as text, and exactly the failure mode a free-tier truncation is
supposed to avoid.

`totals_cover` now names in one sentence which set the grand total covers, and when rows have been
withheld `totals_per_currency_listed_rows` gives the sum of the rows the caller can actually see. The
tests assert the cap really bites, that the two figures differ, that the listed-rows figure equals
the sum of the returned rows, that an untruncated call says so and emits no second figure, and that
the internal per-occurrence minor value never leaks into the payload.

### D-R80 (medium, clauses) - FIXED, with tests

**A title collision with a starter clause was reported as a collision with your own.** The 25 starter
clauses ship with this server and occupy the obvious titles. `clause_add {title: "Payment Terms"}`
answered `a clause titled "Payment Terms" already exists; use clause_update, or give a different
title`, which reads as "you saved this before". The model believed it, searched twice for a clause of
the caller's that was never there, and only then renamed. Four calls to learn something the server
had in hand: `clash.starter` was sitting in the object it used to build the error.

The error now branches. Starter: it says the title belongs to a **STARTER clause**, names its id,
says in so many words that **you have not saved a clause by this name**, and gives both ways out -
a distinguishing title, suggested from the jurisdiction the caller passed, which keeps both clauses,
or `clause_update {id}` to overwrite the starter text. Own clause: the old advice, with the id filled
in. The adversarial probe that asserted the vague wording was the defect asserted, and now asserts
the starter sentence.

### D-R81 (low, clauses) - logged

`clause_search`'s tag-skip message names the filter it dropped, which is the GUARDRAILS rule working.
It does not name the free tool that has the answer: `clause_list` returns the tags of all 27 clauses
on the free tier. The model found it on a second call. One sentence would have saved the round trip.

### D-R82 (high, timezone) - FIXED, with tests

**Asked to find a slot for "all three of us", the model asked the user what timezone they are in.**
No tool call at all. `find_meeting_slots` made `zone` required on every participant, `contacts_list`
listed everyone except the caller, and nothing anywhere surfaced the home zone - even though the
shared business profile has carried it since D-R31, `zoneOf("home")` resolves it, and **this same
file already reads it** for `now` and for the ICS organizer. This is D-R64 exactly: business identity
treated as per-call input, in the third server to do it.

`servers/timezone/src/index.ts`: `zone` is optional on a participant and resolved in order - the zone
you passed, then a saved contact of that name (with **its** working hours, not the 09:00-17:00
default), then the shared profile's timezone. Where each unpassed zone came from is reported under
the slots, because a slot computed against a guessed zone is worse than a question. With neither a
contact nor a profile it still refuses, but it refuses by naming both one-time fixes rather than
asking. `contacts_list` now ends with a `You:` row carrying the home zone and the sentence that you
never need to pass it. The tool description says it outright: include yourself by name, never ask the
caller what timezone they are in.

Seven tests: contact-sourced zones, profile-sourced caller, an explicit zone still winning and not
being annotated, the refusal naming `contacts_set` and `business_set`, both `contacts_list` states,
and - the one that would catch a lazy fix - a saved contact's own 11:00-15:00 hours yielding strictly
fewer slots than the 09:00-17:00 default.

## Bottom line

39/48. Every artifact was fetched and decoded rather than believed: 389 bytes of CSV read column by
column, 9,955 bytes of docx unzipped and grepped for four values and zero remaining placeholders, a
472-byte `.ics` parsed down to `DTSTART`, and an invoice re-read on a second endpoint under the same
token.

r14's seam was "the server tells the caller something that used to be true". r15's is the shape
underneath it: **the server is one of several, and each one answers as though it were the only one.**
expense-tracker totals receipts as if the bank ledger on the next endpoint did not exist.
recurring prints a gross figure the invoice server two hops away breaks into three. clauses reports
a collision without saying which of its two libraries it hit. timezone knows every participant's zone
except the caller's, which is the one fact stored for every server behind the token. None of the four
produced a wrong number, and three of the four were papered over by the model - once by inventing
three table rows it was never sent. The estate's per-token shared profile and sibling stores are the
best thing about it; four servers were not using them.
