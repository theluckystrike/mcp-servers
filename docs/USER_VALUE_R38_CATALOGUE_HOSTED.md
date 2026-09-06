# User value audit, round 38 (catalogue, hosted, Pro key) - 2026-09-06

Round 38 is the hosted re-measurement of catalogue that `docs/PLAN_V25.md` item 4 asked for:
round 37 (`data/user_value_r37.json`, stdio, free tier) scored 14/18 and lost every point on one
prompt, where the model stated the valid-from rule correctly and then answered the one question
the user had NOT dated against the wrong row while the correct `in_force` block sat in the same
tool result. This round runs a fresh five-prompt scenario against
`https://mcp.zovo.one/mcp/catalogue` with the round 36 hosted recipe
(`docs/USER_VALUE_R36_WORK_ORDER.md`), scores 18 named checks at one point each, and puts the
undated question in twice. No code was changed as part of this round; it is measurement only.
Cap: 30 minutes, met. Record: `data/user_value_r38.json`.

## Method

- **Token.** A Pro bundle key signed locally with `node scripts/sign-license.mjs '*'`, per
  `docs/DIST_R22_RESULT.md`, because the round needs `price_list_pdf`, which is Pro.
  `/mcp/whoami/t/<key>` -> tenant `lic:ba28f06b907c`, tier pro; `/verify?key=` -> ok. The tenant
  was empty at the start (`sku_list` count 0). One key, reused for the whole lane and for every
  verification call afterwards.
- **Profile, set before any prompt ran.** `business_set` by curl on `/mcp/invoice` with the same
  bearer: Voss Electrical, 8 Mill Lane, Gdansk, `office@vosselectrical.example`, EUR,
  `default_tax_rate` 23, `Europe/Warsaw`. catalogue reads this shared profile for its currency,
  VAT fallback and the heading on the price list.
- **Registration.** One `mcp.json`, one `http` entry: `catalogue` at
  `https://mcp.zovo.one/mcp/catalogue` with an `Authorization: Bearer <key>` header. No sibling
  registered: the lane under test is catalogue and prompt 4 asks for payloads, not postings.
- **Allowlist.** 12 explicit `mcp__catalogue__<tool>` entries read from a live `tools/list` of
  that endpoint on that key (`sku_set`, `sku_get`, `sku_list`, `sku_delete`, `rate_set`,
  `rate_get`, `lines_resolve`, `price_list_text`, `price_list_pdf`, `catalogue_report`,
  `license_status`, `license_activate`). No `mcp__*` wildcard.
- **Client.** `claude` CLI 2.1.263, `-p`, `--model sonnet`, `--strict-mcp-config`,
  `--mcp-config` pointing at the one-entry file, `--output-format json`, one `--session-id`
  (`6d2f4b9e-3c1a-4f57-8e2b-9a0c7d5e1f38`) then four `--resume` so all five prompts are one
  conversation, each its own shell invocation under `timeout 240` with `</dev/null` on stdin,
  stdout written to disk per prompt and read back before the next prompt ran. All five: rc 0,
  `is_error` false, `permission_denials` empty; 23.2 s, 3.0 s, 9.3 s, 26.3 s, 20.3 s.
- **Empty working directory, disallowed CLI tools.** Every turn ran in an empty
  `/private/tmp/uv-r38cat/wd` with `Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch,
  NotebookEdit, Task, TodoWrite, Agent` denied. Fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` /
  `XDG_CACHE_HOME` / `XDG_STATE_HOME` under `/private/tmp/uv-r38cat/xdg` for every `claude`
  invocation (an http entry has no server env block, so the pins apply to the client only).
  `npm_config_cache=/Users/mike/.npm-cache-local`, `PATH` prefixed with `$HOME/.npm-global/bin`.
- **Transcript.** Tool arguments and raw tool results read back from the session jsonl, so
  every wire quote below is the server's text, not the model's summary. 13 tool calls reached
  the server (plus 4 client-side `ToolSearch` calls that never leave the CLI).
- **Verification.** Every figure re-derived after the round by curl on the SAME key:
  `sku_list`, `rate_get`, `sku_get` (undated and at the three dates), `lines_resolve` with the
  same lines and date, `price_list_text`, `price_list_pdf`. The verification resolution came
  back `RES-2026-0002` against the round's `RES-2026-0001`, which proves the round's counter
  was left alone. The prompt-5 download was fetched as raw bytes at the URL the tool returned.
- Em dashes in quoted model text are written as `--` here and in the JSON record.

## Scenario

Voss Electrical, a two-person electrical contractor, EUR. SOCKET-DBL 68.00 from 2025-01-01,
74.00 from 2026-01-01, 79.00 from 2026-10-01 (the newest row is booked for a date still in the
future, so on 2026-09-06 the newest row on file and the row in force are DIFFERENT numbers, the
opposite orientation to round 37's ladder). CU-SWAP 620.00 from 2026-01-01. EICR 180.00 from
2026-03-01. Electrician 55.00 an hour from 2026-01-01.

## Scorecard - 18/18 (round 37, stdio free: 14/18)

| # | Prompt | Checks | Score | What happened |
|---|---|---|---|---|
| cat1 | Set up the ladder, two more SKUs, the rate; explain the rule; "what each costs right now" | c1-c4 | **4/4** | Six writes in minor units unprompted; rule stated correctly; the undated tail answered 74.00 / 620.00 / 180.00 with 79.00 named as queued for 2026-10-01 |
| cat2 | "what do we charge for a double socket today? And for an EICR?" (no date anywhere) | c5-c8 | **4/4** | "Double socket: EUR 74.00. EICR: EUR 180.00." Zero tool calls; read forward from turn one's same-day `in_force` block |
| cat3 | 15 June 2025, 15 November 2026, 1 October 2024 | c9-c11 | **3/3** | 68.00, 79.00, and the pre-ladder date relayed as no price on file with the right earliest date |
| cat4 | Marina Bakery job as of 15 September 2026, both payloads, net / VAT / total | c12-c15 | **4/4** | One `lines_resolve`; both arrays reproduced field for field; 1,656.50 / 381.00 / 2,037.50 are the server's; 100x gap stated both ways |
| cat5 | Price list as a PDF to send to customers, plus the text version | c16-c18 | **3/3** | `price_list_pdf` link relayed verbatim and fetched; the client said it is HTML print-to-PDF, not a PDF; text rows match |

## The undated question, with the client text

Round 37's miss was: rule stated right, then "the EUR 49.50 row exists but isn't active until
July" two months after that July, and two live products "would report no price in force yet".

This round, prompt 1's tail ("what each of the three things costs right now"), client text:

> Today is 2026-09-06, so: Current prices (as of today, 2026-09-06): SOCKET-DBL ... EUR 74.00
> each, next change EUR 79.00 on 2026-10-01; CU-SWAP EUR 620.00; EICR EUR 180.00. Labour:
> electrician rate is EUR 55.00/hour, in force since 2026-01-01. Note: SOCKET-DBL's EUR 68.00
> (2025) row is now historical, and the EUR 79.00 (2026-10-01) row is queued but not yet live --
> it'll take over automatically in about three weeks.

The tool result it was reading (third `sku_set`, from the transcript): `"rows": 3`,
`"in_force": {"valid_from": "2026-01-01", "price": "EUR 74.00", "price_minor": 7400}`,
`"in_force_on": "2026-09-06"`, three `price_rows`.

Prompt 2, asked alone with no date, client text in full:

> Double socket: **EUR 74.00**. EICR: **EUR 180.00**.

Wire, re-derived after the round with `sku_get {"sku":"SOCKET-DBL"}` and no date:
`"price": "EUR 74.00"`, `"from_row": {"valid_from": "2026-01-01"}`, `"why": "SOCKET-DBL carries 3
EUR row(s) at tier standard; the latest valid_from at or before 2026-09-06 is 2026-01-01."`,
`"superseded_by": {"valid_from": "2026-10-01", "price": "EUR 79.00"}`. `sku_list`: EICR
`in_force` EUR 180.00 from 2026-03-01.

Both undated asks were answered from the row in force. The round-37 class did not recur. The
caveat is in the mechanism: prompt 2 made no tool call (`num_turns` 1, 3.0 s) and read the
previous turn's `in_force` block, which carried the same wall-clock date. Right today; a
September conversation resumed after 1 October would say 74.00 from memory while the books say
79.00. Recorded as an observation, not deducted, and not a server defect.

## Checks with proof

| Check | Client text | Wire | Verdict |
|---|---|---|---|
| c1 five price rows in minor units | `sku_set` args `price_minor` 6800 / 7400 / 7900 (SOCKET-DBL, valid_from 2025-01-01 / 2026-01-01 / 2026-10-01), 62000 (CU-SWAP, 2026-01-01), 18000 (EICR, 2026-03-01) | `sku_list`: SOCKET-DBL rows 3 in_force 7400; CU-SWAP 62000; EICR 18000, each with those valid_from dates | PASS |
| c2 rate card | `rate_set {"role":"electrician","hourly_minor":5500,"valid_from":"2026-01-01"}` | `rate_get`: electrician hourly_minor 5500 from 2026-01-01, in_force_on 2026-09-06 | PASS |
| c3 rule stated correctly | "the system takes the row with the latest `valid_from` that is on or before that date. Rows dated in the future just sit there until their date arrives" | `basis`: "the price on a date is the latest valid_from at or before it, worked out on the call" | PASS |
| c4 undated tail from in_force | 74.00 / 620.00 / 180.00, "EUR 79.00 (2026-10-01) row is queued but not yet live" | in_force 7400 on in_force_on 2026-09-06; superseded_by 2026-10-01 7900 | PASS |
| c5 undated socket = row in force | "Double socket: EUR 74.00" | `sku_get` no date: EUR 74.00 from 2026-01-01 | PASS |
| c6 EICR | "EICR: EUR 180.00" | `sku_list`: EICR in_force EUR 180.00 | PASS |
| c7 nothing false about today | no row called dormant, no product called unpriced | as above | PASS |
| c8 traceable to a same-date server result | figures are turn one's in_force values | in_force_on 2026-09-06 in the sku_set results; zero calls this turn | PASS (see caveat) |
| c9 2025-06-15 | "EUR 68.00 (the 2025 price was already in force)" | `sku_get` 2025-06-15: EUR 68.00 from_row 2025-01-01 | PASS |
| c10 2026-11-15 | "EUR 79.00 (the October 2026 price will be in force by then)" | `sku_get` 2026-11-15: EUR 79.00 from_row 2026-10-01, superseded_by none | PASS |
| c11 2024-10-01 refused | "no price on file -- our earliest SOCKET-DBL price starts 1 January 2025 at EUR 68.00 ... checked against old paperwork, not this system" | isError: "SOCKET-DBL has no EUR price at tier standard on 2024-10-01. Its earliest EUR standard row starts 2025-01-01, and a price that did not exist yet is not a price, so nothing was priced." | PASS |
| c12 one lines_resolve as given | args: client Marina Bakery, date 2026-09-15, lines 6 / 1 / 1 / 7.5 h | one call in the transcript; RES-2026-0001 | PASS |
| c13 invoice items in MAJOR units | unit_price 74 / 620 / 180 / 55, tax_rate 23, "electrician (55.00 EUR/h)" | `invoice_create.arguments.items` identical, "MAJOR units, which is what invoice_create's unit_price takes" | PASS |
| c14 quote items in MINOR units, gap both ways | unit_price_minor 7400 / 62000 / 18000 / 5500 with currency EUR per line; "Swapping them under- or over-charges by 100x" | `quote_create.arguments.items` identical; basis: "Passing one into the other misprices a 2-decimal line by 100x" | PASS |
| c15 totals are the server's, not re-added | "Net: EUR 1,656.50 VAT (23%): EUR 381.00 Total: EUR 2,037.50", "Nothing has actually been posted yet", VAT "coming from the shared business profile default" | net_minor 165650, vat_minor 38100, total_minor 203750, rounding_drift_minor 0, posted false, vat_rate_source "shared profile" | PASS |
| c16 download relayed and fetched | "File: https://mcp.zovo.one/mcp/download/44ef8613d83ccb2ada921b44fac8e3a7 (Heads up -- this isn't a raw PDF, it's an HTML page laid out for A4 ... the link expires in 1 hour)" | tool result carried that exact URL with document "HTML price list, A4 print-to-PDF layout (there is no PDF renderer on Workers), link valid 1 hour"; fetched with the bearer: 200, text/html, filename price-list-EUR-standard-2026-09-06.html, 2,750 bytes, body has Voss Electrical, 8 Mill Lane, Gdansk, CU-SWAP EUR 620.00 (from 2026-01-01), EICR EUR 180.00 (from 2026-03-01), SOCKET-DBL EUR 74.00 (from 2026-01-01), Subtotal EUR 874.00, electrician: EUR 55.00 an hour from 2026-01-01 | PASS |
| c17 text list rows | heading Voss Electrical / 8 Mill Lane, Gdansk; CU-SWAP EUR 620.00 from 2026-01-01; EICR EUR 180.00 from 2026-03-01; SOCKET-DBL EUR 74.00 from 2026-01-01 (EUR 79.00 from 2026-10-01); electrician EUR 55.00 an hour from 2026-01-01 | `price_list_text {date 2026-09-06}` returned those rows; re-derived by curl, identical. Model re-padded columns and dropped the closing rule line and the .txt link; added nothing | PASS |
| c18 today's list consistent with prompts 1 and 2 | "the current price customers pay today is still EUR 74.00", the bracketed 79.00 "just flagging the booked future price" | in_force 7400 on 2026-09-06, superseded_by 7900 from 2026-10-01 | PASS |

## Defects and observations

**D-R97 (proposed), catalogue hosted, low.** `price_list_pdf`, titled "The price list as a
PDF", serves text/html on the hosted endpoint: content-disposition
`price-list-EUR-standard-2026-09-06.html`, and its own `document` field says "HTML price list,
A4 print-to-PDF layout (there is no PDF renderer on Workers)". The user asked for "a PDF I can
send to customers". The model read the `document` field and said so, which is why no check was
lost, but the catch depended on the field rather than the name, and the link it would forward is
openable by any holder (fetched with no Authorization header it also returns 200, by design of
the one-hour capability URL). Every hosted document server shares the Workers limit; this is
recorded against catalogue because the tool NAME is the format it cannot produce. Fix candidate:
on the hosted shim only, alias to `price_list_document` with `format: html`, or put "HTML on the
hosted endpoint" in the first sentence of the hosted `tools/list` description, which today reads
"render the A4 price list ... and return a download link" and never says HTML. The stdio server
writes a real PDF and is unaffected.

**D-R98 (proposed), catalogue, low.** The price-list document prints the issuer twice: the head
block and an ISSUED BY block both carry Voss Electrical, 8 Mill Lane, Gdansk, the email, because
`price_list_pdf` renders through the invoice layout with the party set to the issuer. From the
source (`renderDocPdf` call in `servers/catalogue/src/index.ts`) the stdio PDF has the same
shape. The document also omits the booked later row that `price_list_text` prints in brackets
(EUR 79.00 from 2026-10-01), so a customer holding the sheet in October has a stale price with no
notice on the page. Fix candidate: drop the party block when the party is the issuer, and carry
the bracketed later row in the line description the way `priceListText` does.

**Observation, client-side, not deducted.** Prompt 2 made no tool call and answered from turn
one's same-day `in_force` block (see above). A future round can resume a September conversation
on an October wall clock to measure this directly.

**Observation, client-side, low.** Prompt 5 reproduced the text list with re-aligned columns
and without the closing rule line or the .txt download link; every row and figure present,
nothing added. `license_status` was also called between the two list tools, a wasted turn on a
key whose tier the preceding calls had already shown.

## Bottom line

18 of 18 hosted on a Pro key, against round 37's 14 of 18 over stdio on the free tier, and the
whole of the difference is the undated question. Asked twice, with the ladder's newest row booked
for a date still in the future so that the newest row on file and the row in force were
different numbers, the client answered from the `in_force` block both times: 74.00 today, 79.00
queued for 1 October, the 2025 row historical. The dated question picked three different rows
including a future one and relayed the pre-ladder date as a refusal. `lines_resolve` on a real
23 percent profile rate came back as two payloads reproduced field for field, `unit_price` 74
against `unit_price_minor` 7400, with the 100x gap stated in both directions and the server's
net, VAT and total repeated to the cent rather than re-added. The price list download was
fetched as bytes and carries the business heading and every in-force row, and the client said
out loud that the hosted endpoint serves an HTML print-to-PDF page rather than a PDF, which is
the round's one server-side finding (D-R97, low), with a second low proposal (D-R98) for the
document printing the issuer twice and omitting the booked later row. The measurement caveat is
that the standalone undated prompt read the previous turn's same-day result rather than calling
the server, which is right today and would be wrong after 1 October in a resumed conversation.

Built by theluckystrike. https://github.com/theluckystrike
