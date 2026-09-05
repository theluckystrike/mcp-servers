# User value audit, round 17 — 2026-09-05

Round 17 is the **single-install** round. Not eleven children behind a bundle (round 8), not sixteen
hosted endpoints (round 15): **one stdio server, all nineteen children, 186 tools in one
`tools/list`**, which is what a user installing the one `.mcpb` actually gets. The question round 17
asks is narrow and structural: **at 186 tools, does the client still find the right one?**

Round 8 measured the same bundle at 108 tools across eleven children. Round 17 adds eight more
children (`pdf`, `calendar`, `kanban`, `image`, `bank-statement`, `quotes`, `barcode`, `zip`) and
72 more tools, and asks six prompts that each need **two or more children in one sentence**. If
scale degrades selection, this is where it shows.

## Method

- **Client** — `claude` CLI **2.1.261**, `-p`, `--model sonnet`, `--strict-mcp-config`,
  `--mcp-config /private/tmp/uv-r17/mcp.json`, `--output-format stream-json --verbose
  --max-turns 12`, one bounded request per prompt under `timeout 240`.
- **Allowlist** — **186 explicit `mcp__office__<tool>` entries**, written out by name from a live
  `tools/list` against the built bundle (`/private/tmp/uv-r17/tools.mjs`), because
  `--allowedTools "mcp__*"` grants nothing (D-E4, round 7).
- **The CLI's own tools are denied** — `Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,
  NotebookEdit,Task,TodoWrite,Agent` on `--disallowedTools`, and every turn ran in an **empty
  working directory** (`/private/tmp/uv-r17/cwd`), per r11 D-R57. Anything the model achieved, it
  achieved through the bundle.
- **Server** — `servers/office-suite/dist/index.js` **v0.9.3** registered as ONE stdio server named
  `office`, proxying all **19** children from `servers/office-suite/src/index.ts:33` `CHILDREN`.
  Fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` and `MCP_LICENSE_KEY=""` (**free tier throughout**) set
  **in the server's own `env` block inside `mcp.json`**, not in the CLI's environment.
- **One conversation** — `--session-id 17171717-...-0017` on prompt 1, `--resume` on every prompt
  after it, so "it", "them" and "this month" point at something.
- **Shared profile, seeded once** — `data/mcp-servers/profile/business.json` written before the run:
  Nova Studio, ul. Prosta 51 Warszawa, `vat_id PL1234567890`,
  `iban PL61109010140000071219812874`, `default_currency EUR`, `default_tax_rate 23`,
  `payment_terms_days 14`, `timezone Europe/Warsaw`.
- **Two seeded expenses** — Figma EUR 45.00 (2026-09-01) and Adobe EUR 22.99 (2026-09-03), by direct
  JSON-RPC, because "which subscriptions are **not** in my expense log" is only worth asking if the
  log holds some of them.
- **Two URL fixtures** — `python3 -m http.server 8794 --bind 127.0.0.1` over
  `/private/tmp/uv-r17/www`: `bank.csv` (6 rows, 4 of them subscriptions: Figma 45.00, Notion 10.00,
  Adobe 22.99, Slack 8.75, plus groceries and an incoming Acme payment) and `logo.png`
  (a real 64x64 RGBA PNG, 4,898 bytes). Both returned HTTP 200 before the run.
- **Clock** — host UTC+07, run start 08:29 local = 01:29 UTC, **Saturday 2026-09-05**. "This week"
  therefore has one working day left in it, which prompt 4 exists to test.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap to close. 1 = partially wrong, or asked for something the tool
could infer. 0 = failed. **Tool-call counts exclude the client's own `ToolSearch` schema lookups.**

## The namespace

| | round 8 | round 17 |
|---|---|---|
| children | 11 | **19** |
| tools on `tools/list` | 108 | **186** |
| sum of the children's own `tools/list` | — | 222 |
| collapsed by the bundle | — | **36** = 18 duplicate `license_status` / `license_activate` pairs |
| names that needed a child prefix | 2 | **2** (`invoice_business_set`, `docx_business_set`) |

222 - 36 = 186 exactly. Nineteen servers, and the bundle still had to disambiguate only **one** tool
name. The namespace is far less crowded than the tool count suggests.

## Scorecard — 13 / 18

| # | Children crossed | Prompt | Score | Calls | Sec | Note |
|---|---|---|---|---|---|---|
| 1 | time-tracker + invoice | "Log 3 hours today on Nova design and invoice them at EUR 90" | **2** | 7 | 54.2 | Turn 1 spent three lookups (`project_list`, `now`, `client_list`), found no client called Nova, and **asked** instead of writing. On "Yes, go ahead": `client_add` -> `entry_add {minutes: 180, rate: 90, currency: EUR}` -> `invoice_from_hours` -> `entry_mark_billed` unprompted. End state exact: `INV-2026-0001`, EUR 270.00 + 23% = **EUR 332.10**, due 2026-09-19 (issue + the profile's 14 days), the entry closed against the invoice number. Marked down for the turn: `entry_add` creates a project on the fly, so nothing in the sentence needed confirming. |
| 2 | quotes + barcode | "Quote Acme 2 days consulting at PLN 1200, then make the payment QR for it" | **2** | 2 | 27.2 | `client_list` -> `quote_create {currency: PLN, 2 x 120000 minor}` -> `Q-2026-0001`, PLN 2,400 + 23% = **PLN 2,952.00**, valid to 2026-10-05. Then it stopped and explained that both payment-QR tools are EPC069-12, which is **euro only**, and offered an FX conversion or a plain data QR. That is correct — verified by probe below — but it was inferred from the descriptions, not from a call, and the user got a question rather than either alternative done. |
| 3 | bank-statement + expense-tracker | "Import this bank CSV `http://127.0.0.1:8794/bank.csv` and tell me which subscriptions are not in my expense log" | **2** | 4 | 55.8 | Right tool first (`statement_import`), and it **failed on the URL**: the server resolved `http://...` as a relative filesystem path. The model searched for `Bash`/`WebFetch`, found none allowed, and asked for a local path rather than inventing one. Given the path: `statement_import` (6 rows) -> `transactions_list` -> `expense_list` -> **"Notion (EUR 10.00) and Slack (EUR 8.75) are not in your expense log — EUR 18.75 untracked"**, with the groceries and the incoming payment excluded as non-subscriptions. Exactly right. D-R83. |
| 4 | timezone (contacts + slots + ics) | "Find a 45-minute slot with Ann in New York this week and export it as .ics" | **2** | 3 | 37.5 | `contacts_list` -> `find_meeting_slots {participants: [{Ann, New York}, {me}], duration_minutes: 45, days: 5}` -> `ics_create`. The file is valid and the instant is right to the second: `DTSTART:20260907T133000Z` / `DTEND:20260907T141500Z` = 15:30-16:15 Europe/Warsaw = **09:30-10:15 America/New_York**, 45 minutes, and "me" resolved to Warsaw from the shared profile with no question asked (D-R82 holding). Marked down because the run day is **Saturday 2026-09-05** and the slot is **Monday 2026-09-07** — next week — and neither the tool nor the answer said the requested week had run out. D-R84. |
| 5 | image + invoice + pdf | "Resize `http://127.0.0.1:8794/logo.png` to 512 px and put it on a PAID stamp on invoice INV-2026-0001's PDF" | **2** | 3 | 36.7 | Three children, one sentence, all three right: `image_resize` -> 512x512 PNG on disk, `invoice_pdf` -> `INV-2026-0001.pdf`, `pdf_stamp` -> `INV-2026-0001-paid.pdf` carrying `<50414944> Tj` ("PAID") at 45 degrees in green. It also declined to pretend the logo was on the stamp: no tool composites an arbitrary image onto a page, and it said so and offered the Pro letterhead slot instead. It reached the URL fixture only by **guessing** the local path from prompt 3's answer — the same D-R83 gap, silently worked around. |
| 6 | zip + invoice + quotes | "Zip this month's invoices and quotes" | **3** | 1 | 15.1 | One call. `zip_bundle_month {servers: ["invoice", "quotes"]}` -> `2026-09.zip`, 2 entries, both invoice PDFs. And it volunteered the reason the quote is absent: `Q-2026-0001` was never rendered, because `quote_pdf` is Pro. The cleanest prompt in the round. |

**Totals: 20 bundle tool calls, 226.5 s of wall clock, 13 / 18 (72%).**

## First-prompt tool reach — the round's actual question

Two readings, both reported, because they answer different questions.

**Reach (R6 sense): was the tool that does the work called, in the prompt's own turn, with no user
hint? 5 / 6 = 83%.**

| # | The tool the prompt needs | Called on its own turn? |
|---|---|---|
| 1 | `entry_add` + `invoice_from_hours` | **no** — three lookups, then a question |
| 2 | `quote_create` | yes |
| 3 | `statement_import` | yes |
| 4 | `find_meeting_slots` + `ics_create` | yes |
| 5 | `image_resize` + `pdf_stamp` | yes |
| 6 | `zip_bundle_month` | yes |

**Strict reach (was the *first* bundle call the working tool? ): 3 / 6 = 50%** — misses at 1
(`project_list`), 2 (`client_list`) and 4 (`contacts_list`).

The strict number looks alarming and is not. **All three misses are the same move: read the entity
list before writing to it.** None of the three went to the wrong child, none of them wrote anything,
and two of the three cost nothing but a call. The one that cost a point (prompt 1) turned a lookup
into a confirmation question, which is a conversation habit, not a namespace problem.

The number that matters for a 186-tool bundle is this one: **every one of the 20 bundle calls went
to the correct child, and the correct tool within it. Zero cross-child confusion, zero wrong-server
picks, zero calls outside the bundle.** With the CLI's own filesystem and web tools denied, the
model never once tried to route around the servers except in prompt 3, where it searched for
`Bash`/`WebFetch`, found them unavailable, and correctly asked the user instead of guessing.

**Reach did not fall below 80 percent, so no grouping is proposed.** The contingency data is
recorded below anyway, because the next round adds more children.

### If a split ever is needed, the data says where

Ten of the nineteen children were never touched by a freelancer's six sentences:
`price-tracker`, `spreadsheet`, `currency`, `docx`, `resume`, `recurring`, `clauses`, `calendar`,
`kanban`, `barcode`. Nine carried the whole round:

| Child | Tools | Calls this round |
|---|---|---|
| invoice | 12 | 5 (`client_list` x2, `client_add`, `invoice_from_hours`, `invoice_pdf`) |
| timezone | 11 | 4 (`now`, `contacts_list`, `find_meeting_slots`, `ics_create`) |
| time-tracker | 14 | 3 (`project_list`, `entry_add`, `entry_mark_billed`) |
| bank-statement | 12 | 3 (`statement_import` x2, `transactions_list`) |
| image | 12 | 1 (`image_resize`) |
| pdf | 12 | 1 (`pdf_stamp`) |
| quotes | 11 | 1 (`quote_create`) |
| expense-tracker | 14 | 1 (`expense_list`) |
| zip | 9 | 1 (`zip_bundle_month`) |
| price-tracker, spreadsheet, currency, docx, resume, recurring, clauses, calendar, kanban, barcode | 111 | 0 |

The cut that the traffic supports is **money-and-documents** (invoice, quotes, time-tracker,
expense-tracker, bank-statement, currency, recurring, pdf, zip, barcode — the ten that touch a
number a client owes) against **workspace** (timezone, calendar, kanban, docx, clauses, resume,
image, spreadsheet, price-tracker — the nine that do not). That split is roughly 105 / 81 tools and
would have cost this round nothing: only prompt 4 (timezone alone) and prompt 5 (image + pdf +
invoice) cross it, and prompt 5 crosses it in exactly the direction that argues for keeping `image`
on the money side. **Nothing in round 17's data forces the split.** Ship it whole.

## Independent verification of the numbers

Read off the stores, the PDFs, the ZIP and the `.ics` — never off the model's prose.

| Check | Method | Result |
|---|---|---|
| 186 tools, live | `tools/list` against `dist/index.js` -> 186; per-child `tools/list` sums to 222; 222 - 36 (18 duplicate license pairs) = 186 | PASS |
| Only two names needed prefixing | the 186 names contain `invoice_business_set` and `docx_business_set` and no other `<child>_` prefix | PASS |
| Invoice arithmetic | `invoice/invoices.json`: `quantity 3`, `unit_price_minor 9000`, `gross_minor 27000`, `tax_minor 6210`, `total_minor 33210` -> **EUR 332.10**; 3 x 90 = 270, 23% of 270 = 62.10 | PASS |
| Payment terms came from the profile | `issue_date 2026-09-05`, `due_date 2026-09-19` = +14, the profile's `payment_terms_days` | PASS |
| The time entry is in **Warsaw's** day, not the host's | `time-tracker/data.json` `3948c01e`: `start 2026-09-05T07:00:00.000Z` = **09:00 Europe/Warsaw** on a UTC+07 host (which would have made it 02:00Z). Round 8 D-R35(b) is fixed and was exercised | PASS |
| Hours closed against the invoice | same entry: `billed_at`, `billed_invoice: "INV-2026-0001"` | PASS |
| Quote arithmetic | `quotes/quotes.json` `Q-2026-0001`: `2 x 120000 minor`, `net_minor 240000`, `tax_minor 55200`, `total_minor 295200` -> **PLN 2,952.00**, `valid_until 2026-10-05` | PASS |
| A PLN payment QR really is refused | direct probe on a scratch store: `invoice_payment_qr {invoice_id}` on a PLN invoice -> *"invoice INV-2026-0001 is in PLN, and an EPC payment QR code is euro only. A PLN invoice is paid by bank transfer with the details on the PDF; no code was created."* The model's prompt-2 answer was right | PASS |
| The bank CSV imported | `bank-statement/data.json`: account `bank`, **6** transactions, Figma -4500, Notion -1000, Adobe -2299, Slack -875, groceries -3120, Acme +123000, all EUR | PASS |
| The subscription diff | expense log holds Figma 45.00 and Adobe 22.99 only; the two bank subscriptions with no expense row are **Notion 10.00 and Slack 8.75 = 18.75**, which is what the model reported | PASS |
| A URL is not a path | probe: `statement_import {path: "http://127.0.0.1:8794/bank.csv"}` -> `Error: no file at /Users/mike/mcp-servers/http:/127.0.0.1:8794/bank.csv`; `image_resize` with the same URL -> `/Users/mike/mcp-servers/http:/127.0.0.1:8794/logo.png does not exist` | FAIL, D-R83 |
| The meeting instant | `timezone/meeting.ics`: `DTSTART:20260907T133000Z` / `DTEND:20260907T141500Z` — 45 minutes, 15:30 Warsaw, **09:30 America/New_York** (EDT, still on DST on 7 September) | PASS |
| The ICS is honest about Ann | `DESCRIPTION:Also attending (no email address was given, so they are not invited by the file): Ann` — no bogus `ATTENDEE`, and no invented `ORGANIZER` email (D-R40 holding) | PASS |
| "This week" | run day **Saturday 2026-09-05**; the slot is **Monday 2026-09-07**. Neither `find_meeting_slots` nor the answer said the week asked for had ended | FAIL, D-R84 |
| The image was really resized | `image/operations.json`: `image_resize`, `detail "64x64 -> 512x512"`; the output PNG's IHDR reads **512 x 512** | PASS |
| The stamp is really on the page | `INV-2026-0001-paid.pdf`, 3,480 bytes, `%PDF-1.7`; content stream 3 inflates to `BT 0.106 0.498 0.231 rg /Helvetica-Bold 72 Tf` with a 45-degree matrix and `<50414944> Tj` — hex for **PAID** | PASS |
| The original PDF survived | `invoice/pdf/INV-2026-0001.pdf` (2,516 B) still present alongside the stamped copy; `pdf/operations.json` records input and output separately | PASS |
| The ZIP holds what it says | `unzip -l 2026-09.zip` -> exactly `invoice/INV-2026-0001-paid.pdf` (3,480) and `invoice/INV-2026-0001.pdf` (2,516). No quote, because none was rendered — which the answer stated | PASS |
| Errors returned | 1 of 20 calls (`statement_import` on a URL). No crash, no non-JSON line, no tool returned a wrong number | PASS |

## Defects

**D-R83 (medium, bank-statement + image + every path-taking tool) — a URL is silently treated as a
relative filesystem path.** `statement_import` and `image_resize` both take a `path`, both expand
`~`, and both resolve anything else against the **server process's** current directory. Handed
`http://127.0.0.1:8794/bank.csv` they report `no file at
/Users/mike/mcp-servers/http:/127.0.0.1:8794/bank.csv` — a path that never existed, built by
collapsing `//` to `/`. The message is doubly misleading: it implies the file might exist somewhere,
and it leaks the server's cwd. In this round it cost prompt 3 a whole turn, and in prompt 5 the model
worked around it by **guessing** the local path from the answer to prompt 3, which happened to be
right and did not have to be. Repro: `/private/tmp/uv-r17/probe.mjs`, cases C and D. Server-side.
Fix direction: two lines, in the shared path helper both servers use. Detect a leading
`<scheme>://` and refuse by name — "that is a URL, not a file path; this tool reads local files.
Download it first, or pass the path it was saved to" — rather than resolving it. Then decide the
larger question separately: a `url` argument on `statement_import` (banks and PSPs hand out signed
download links) would have made prompt 3 a 3, and the same on `image_resize` would have made
prompt 5 self-sufficient. The refusal is the cheap half and should ship regardless.

**D-R84 (medium, timezone) — `find_meeting_slots` never says which days it actually searched, so
"this week" can quietly become next week.** The prompt said "this week" on a Saturday. The model
passed `days: 5`, the server searched forward from the run day, and the first slot inside both
parties' working hours was **Monday**, two days past the boundary the user named. The `.ics` is
correct; nothing in the payload or the answer flagged that the requested window had one non-working
day left in it. A user who asked for "this week" because of a Friday deadline gets a Monday meeting
and no warning. Repro: `/private/tmp/uv-r17/out/s4.jsonl` against `timezone/meeting.ics` on a run
day of Saturday 2026-09-05. Server-side. Fix direction: `find_meeting_slots` already knows
`earliest_date` and the home zone; have it return `searched_from` / `searched_to` in the payload and
say in the description that `days` counts calendar days forward from `earliest_date` regardless of
week boundaries. Better still, accept `within: "this_week" | "next_week"` resolved in the profile
timezone, and when the answer falls outside the window asked for, say so in one sentence: "no slot
was available before Sunday 2026-09-06; the first is Monday 2026-09-07."

**D-R85 (low, time-tracker + invoice; conversational) — a first sentence that names a new project
buys a confirmation question.** "Log 3 hours today on Nova design and invoice them at EUR 90" names
the project, the duration, the day, the task and the rate. `entry_add` creates a project on the fly
and `invoice_from_hours` creates a client on the fly — both did, one turn later, unprompted. But
with an empty store, `project_list` and `client_list` come back empty, and an empty list reads to a
model as "this does not exist, ask first." The result on turn 1 was three read calls and a question
for facts the sentence already carried. Repro: `/private/tmp/uv-r17/out/s1.jsonl` on a fresh
`XDG_DATA_HOME`. Server-side, cheaply. Fix direction: have `project_list` and `client_list` say what
happens next when they are empty — "no projects yet; `entry_add` creates one from its `project`
argument, no setup needed" — the same one-sentence-forward pattern that made `expense_add` and
`invoice_summary` reliable in rounds 8 and 15. An empty list is the single most common state a new
install is in, and it is the one state these tools say nothing about.

## Round 8 behaviours retested at 19 children

| Round 8 finding | Round 17 |
|---|---|
| D-R31 one business, three business profiles | **holding** — one seeded `profile/business.json` supplied the VAT rate to invoice and quotes, the payment terms to the invoice due date, and the timezone to time-tracker and timezone. Nothing was asked twice |
| D-R35(a) a stopped timer leaves a `USD 0.00` row | not exercised (no timer this round) |
| D-R35(b) entries stamped in the machine's zone | **fixed and exercised** — 09:00 Warsaw stored as `07:00:00Z` on a UTC+07 host |
| D-R40 an invented email on a client-facing document | **holding** — the `.ics` has no `ORGANIZER` email at all and says why, and the answer asked for one rather than improvising |
| D-R82 the caller's own timezone is never asked for | **holding** — `find_meeting_slots` resolved "me" to Europe/Warsaw from the profile with no question |
| tool selection right on 50 of 51 calls (108 tools) | **20 of 20 (186 tools)** — no wrong-child pick at 1.7x the namespace |

## Bottom line

Thirteen of eighteen, twenty calls, under four minutes of wall clock, and **not one call went to the
wrong server**. Round 8's worry was that a fact stated once would not survive to sentence nine;
round 17's worry was that 186 tools would be too many to choose from. Neither happened. The shared
profile carried Nova Studio's VAT rate, payment terms and timezone across five children without
being restated, and the model picked correctly from a 186-name list on every single call, including
a three-child sentence (image, invoice, pdf) it had never seen before.

What the round cost points on is smaller and more mundane: **a URL is not a file path** in two
servers that take files, **"this week" is not a number of days** in the one server that owns
calendars, and **an empty list is read as a closed door** by a model that has just been handed
everything it needs to open it. All three are one-sentence fixes in a payload or a description, and
all three are the same species of defect the last nine rounds have been grinding down — a tool that
knows the answer and does not say it.

## RESULT.md block

```
status: DONE
evidence:
  one conversation, 8 turns, 6 cross-server prompts through servers/office-suite/dist/index.js v0.9.3
  ONE stdio server, 19 children, 186 tools on a live tools/list (222 child tools minus 36 duplicate
    license pairs), per-tool allowlist of all 186, CLI filesystem and web tools DENIED, empty cwd
  free tier, fresh XDG dirs in the server env block, shared profile seeded once
    (Nova Studio, Europe/Warsaw, EUR, 23%, IBAN PL61109010140000071219812874)
  20 bundle tool calls, 226.5 s, 13/18; 1 tool error; ZERO calls outside the bundle
  first-prompt tool reach 5/6 = 83% (strict first-call reading 3/6; all three misses are
    read-the-list-before-writing, none is a wrong-child pick)
  tool selection correct on 20 of 20 calls at 186 tools, against 50 of 51 at 108 tools in round 8
  every number reproduced from the stores: INV-2026-0001 EUR 332.10 (27000 + 6210 minor),
    Q-2026-0001 PLN 2,952.00 (240000 + 55200), Notion 10.00 + Slack 8.75 = 18.75 untracked,
    ics DTSTART 20260907T133000Z = 09:30 New York, PAID stamp as <50414944> Tj, 2026-09.zip 2 entries
artifacts:
  docs/USER_VALUE_R17.md, data/user_value_r17.json
  /private/tmp/uv-r17 (mcp.json, allow.txt 186 entries, run.sh, tools.mjs, seed.mjs, probe.mjs,
    bychild.mjs, out/*.jsonl, data/, www/ fixtures)
cost: 45 wall minutes
failures:
  D-R83 a URL handed to statement_import or image_resize is resolved as a relative file path and the
    error prints a path that never existed, leaking the server's cwd
  D-R84 find_meeting_slots never reports the window it searched, so "this week" on a Saturday
    silently returned next Monday
  D-R85 an empty project_list / client_list reads as "does not exist", buying a confirmation
    question for a sentence that already carried every fact
insight:
  The fear behind this round was that 186 tools is past the point where a model can choose. It is
  not: twenty calls, nineteen candidate servers, zero wrong picks, including a sentence that needed
  three children at once. Scale was never the problem, and the strict 50% first-call number that
  looks like evidence of one is the opposite -- all three misses were the model reading a list
  before writing to it, which is good behaviour that these servers happen to punish, because an
  empty list is the one state they refuse to explain. The real ceiling this round found is that
  every remaining defect is a tool declining to say something it already knows: which window it
  searched, that the thing it was handed is a URL, that the empty list it just returned is not a
  wall. Adding eight children did not make selection harder. It made eight more places to be silent.
```
