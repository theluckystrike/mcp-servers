# User value audit, round 5 — 2026-09-03

Round 5 is ten **fresh** scenarios nobody has run before. Nothing here re-runs a round-3 or round-4
prompt; the point was to walk a normal freelancer week end to end and see where the office-suite
bundle actually pays off and where it dead-ends.

## Method

Same client and rubric as rounds 3 and 4.

- **Client** — `claude -p ... --model sonnet --strict-mcp-config --output-format stream-json
  --verbose --max-turns 16`, per-tool allowlist written out by name (51 entries, the round-4
  `allow.txt`), because `--allowedTools "mcp__*"` grants nothing (D-E4 in `docs/EXPENSE_AUDIT.md`).
- **Server** — `servers/office-suite/dist/index.js` registered as ONE server named `office`, so any
  child can answer. Startup line every lane:
  `mcp-office-suite ready, proxying [time-tracker, price-tracker, spreadsheet, invoice, expense-tracker], 49 tools`.
- **Fresh state** — four independent lanes, each with its own `XDG_DATA_HOME` /
  `XDG_CONFIG_HOME` and `MCP_LICENSE_KEY=""` (free tier):

  | Lane | Dir | Scenarios | Conversation |
  |---|---|---|---|
  | A | `/private/tmp/uv10` | 1, 2, 6, 7, 8, 9 (+ extra 7b) | one session, `--session-id` then `--resume` |
  | B | `/private/tmp/uv11` | 3, 4 | one session |
  | C | `/private/tmp/uv12` | 5 (two turns) | one session |
  | D | `/private/tmp/uv13` | 10 (two turns) | one session |

- **Fixture** — `/private/tmp/uv11/costs.csv` (copy at `/private/tmp/uv6/costs.csv`): 250 rows,
  header `Date,Supplier,Invoice,Amount`, dates first, every amount a quoted thousands-separator
  string (`"1,250.00"`). Ten suppliers, six over 1000 in total and four under, so the filter is
  discriminating rather than trivial.
- **Licence** — lane D used a key signed locally: `node scripts/sign-license.mjs '*'` ->
  `MCPL1.eyJ2IjoxLCJwIjoiKiIsImlkIjoiZTA1NDU5NGRjNTIzIiwiaWF0IjoxNzg4MzkyMTYxfQ...`, id `e054594dc523`.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn or extra
noise. 1 = partially wrong, or asked for something the tool could infer. 0 = failed.
Tool-call counts exclude the client's own `ToolSearch` schema lookups.

## Scorecard — 26 / 30

| # | Surface | Scenario | Score | Calls | Sec | Note |
|---|---|---|---|---|---|---|
| 1 | time-tracker | "I forgot to track yesterday: 9-12:30 Nova redesign, 2-5 Nova bug fixes, rate 85 USD" | **3** | 2 | 22.9 | `entry_add` x2 with explicit `start`/`end`/`rate`/`currency`. 3.50 h = USD 297.50, 3.00 h = USD 255.00, **6.5 h = USD 552.50**. Rate carried on the entries. |
| 2 | time-tracker | "Show me a standup summary for yesterday and today." | **3** | 1 | 11.3 | `entry_list {from 2026-09-02, to 2026-09-03}`. Correct split, "no time logged yet" for today. The `daily_standup` **prompt** was never used — see D-R16; the prompt exists and works. |
| 3 | spreadsheet | "which suppliers did we pay more than 1000 in total, sorted?" | **2** | 9 | 46.3 | Final answer exact against the fixture, but `sheet_query` was call **9 of 9**: `Read`, then five blocked `Bash` attempts, then `ToolSearch`, then the tool. See D-R11. |
| 4 | spreadsheet | "Convert that to xlsx and add a column Amount with VAT at 23%." | **2** | 2 | 12.6 | `sheet_convert` -> `sheet_add_column {formula: "[Amount] * 1.23"}`. **1,250.00 -> 1537.5 correct.** But 245 of 250 VAT cells carry 4 decimals and 5 Amount cells were written as **text**. D-R12, D-R13. |
| 5 | price-tracker | "Watch this page and tell me the current price" then "refresh my watches" | **3** | 2 + 2 | 26.2 / 15.3 | `watch_add` -> `price_check`; then `watch_refresh {all:true}` -> `alerts_pending`. **GBP 53.74**, matches the page. The model relayed the low confidence and the "nothing polls this page" line verbatim. |
| 6 | expense-tracker | "12.40 EUR train ticket for Nova today, and 30 km driving in the UK for Nova, billable" | **3** | 2 | 21.6 | `expense_add` -> `mileage_add {miles: 18.64, region: UK}`. 30 km converted to 18.64 mi **by the model, and disclosed**; 18.64 x 0.45 = **GBP 8.39**. The tool's own km+UK path was probed separately and refuses correctly. |
| 7 | invoice | "Invoice Nova for everything unbilled this week in USD, 0% VAT, due in 30 days. Give me the file." | **1** | 2 | 37.8 | `entry_list` -> `expense_to_invoice`. **No invoice, no file.** The unbilled set is USD hours + an EUR expense + a GBP mileage line; one invoice carries one currency and nothing in the suite converts, so the turn ended asking the user for FX rates. D-R14. |
| 7b | invoice | EXTRA: "Option 2: invoice the hours only, in USD" | (3) | 2 | 18.8 | `invoice_from_hours` -> `invoice_pdf`. **INV-2026-0001, USD 552.50, 0% VAT, due 2026-10-02**, real PDF on disk. Not counted in the total. |
| 8 | expense-tracker | "Which of my expenses have no receipt attached?" | **3** | 1 | 14.4 | `expense_list`. Both expenses correctly named, and the free-tier 30-day window disclosed unprompted. |
| 9 | time-tracker | "Export my Nova time as CSV for last month." | **3** | 1 | 12.4 | `export_csv {from 2026-08-01, to 2026-08-31}` -> "Wrote 0 entries" + the 7-day free window. The model led with **"returned 0 entries"**, named the cause, and offered the 7-day export instead. Exactly the honesty this scenario was built to test. |
| 10 | bundle / licence | "Activate my license MCPL1.garbage", then a real key | **3** | 1 + 1 | 17.5 / 13.7 | Garbage key: "5 of 5 servers did not accept the key" with a per-server FAILED table, model asked for the real one. Real key: "Activated on all 5 servers in the bundle", `license.json` written. |

**Totals per server** (scenario scores only, extras excluded):

| Server | Scenarios | Score |
|---|---|---|
| time-tracker | 1, 2, 9 | **9 / 9** |
| expense-tracker | 6, 8 | **6 / 6** |
| price-tracker | 5 | **3 / 3** |
| bundle / licence | 10 | **3 / 3** |
| spreadsheet | 3, 4 | **4 / 6** |
| invoice | 7 | **1 / 3** |
| **total** | | **26 / 30** |

## Independent verification of the numbers

Read off the stores, the files and the wire — not off the model's prose.

| Check | Method | Result |
|---|---|---|
| 6.5 h x 85 = USD 552.50 | `entry_add` results: `3.50 h ... USD 297.50` and `3.00 h ... USD 255.00`; `entry_list` says `2 entries, 6.50 h total`; `invoice_from_hours` returned `"total_minor": 55250` | PASS |
| Invoice file is real | `/private/tmp/uv10/data/mcp-servers/invoice/pdf/INV-2026-0001.pdf` written by `invoice_pdf`; due_date `2026-10-02` = issue + 30 d | PASS |
| Supplier totals | independent `csv.DictReader` sum over the fixture: Initech 18,876.83 / Acme 17,301.09 / Stark 16,675.33 / Globex 16,363.61 / Northwind 16,027.93 / Umbrella 15,818.79 over 1000; Wayne 608.60, Vandelay 519.52, Hooli 447.71, Soylent 446.83 under. `sheet_query` returned **exactly these ten numbers** and the model's six-row answer is the correct subset | PASS |
| VAT column | `xl/worksheets/sheet1.xml` row 5: `<c r="D5" t="str"><v>1,250.00</v></c><c r="E5"><v>1537.5</v></c>` — **1,250.00 x 1.23 = 1537.50** | PASS |
| VAT column rounding | 245 of 250 E cells have more than 2 decimals (`40.7868`, `90.7125`, `635.9346`) | FAIL, D-R13 |
| xlsx Amount column type | 5 of 250 D cells written as `t="str"`: `1,250.00`, `403.00`, `123.00`, `641.00`, `703.00`. `SUM(D:D)` in Excel skips them | FAIL, D-R12 |
| Price GBP 53.74 | `curl https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html \| grep price_color` -> `£53.74` (the second `51.77` on the page is the related-items strip) | PASS |
| Watch persisted | `/private/tmp/uv12/data/mcp-servers/price-tracker/watches.json`: id `ef58aa04`, 2 observations, both `53.74 GBP`, `regex-fallback`, confidence `low` | PASS |
| 30 km in the UK | 30 km = 18.641 mi; 18.64 x 0.45 = 8.388 -> **GBP 8.39** stored as `18.64 mile at 0.45 GBP/mile (UK)` | PASS |
| The tool would not have guessed | direct JSON-RPC probe, `mileage_add {km: 30, region: "UK", purpose: "..."}` -> `Error: the UK rate is per mile, but you gave km. Pass miles, or pass rate_per_km with your own rate for km.` No silent multiply | PASS |
| Licence really activated | `/private/tmp/uv13/cfg/mcp-servers/license.json` -> `{"*": "MCPL1.eyJ2IjoxLCJwIjoiKiIsImlkIjoiZTA1NDU5NGRjNTIzIi..."}`, and all five children returned `OK ... Activated Pro for all servers (bundle)` | PASS |
| `daily_standup` exists and works | direct `prompts/list` on the bundle -> `daily_standup`, `check_prices`, `monthly_close`; `prompts/get daily_standup` returns a fully rendered YESTERDAY/TODAY/ENTRIES brief | PASS (server), see D-R16 |

## Defects

**D-R11 (high, spreadsheet) — `sheet_query` loses to generic file tools, and in one configuration is
never reached at all.** This is D-R9 (price-tracker) repeating in a second server, so it is a pattern,
not a one-off.

Two forms, both reproduced:

1. *Never reached.* First lane-B run, MCP tools + `Read` in the allowlist, `cwd=/Users/mike/mcp-servers`
   and the CSV outside it. The model called `Bash cat` (blocked by the cwd sandbox), then `Read`
   (permission prompt), then **gave up and asked the user to move the file** — with `sheet_read`,
   `sheet_query`, `sheet_stats` and `sheet_info` all sitting in the allowlist, and `sheet_query`
   taking an absolute path that the sandbox does not restrict. Score would be 0. Turn 2 repeated it.
   Transcripts `/private/tmp/uv11/out/s3_cwdblocked.jsonl`, `s4_cwdblocked.jsonl`.
2. *Reached last.* Scored run, MCP-only allowlist, cwd inside the lane dir. Call order:
   `Read` -> `Bash python3` (approval) -> `Bash python3` (approval) -> `Bash awk` (ansi_c_string) ->
   `Bash awk|sort` (approval) -> `Bash awk` (approval) -> `Bash awk --dangerouslyDisableSandbox`
   (approval) -> `ToolSearch` -> `sheet_query`. Six failed generic attempts before the server was
   tried. 46.3 s for a query the server answered in one call.

Repro (form 2): `cd /private/tmp/uv11 && claude -p "Here is my costs sheet
/private/tmp/uv11/costs.csv, which suppliers did we pay more than 1000 in total, sorted?"
--mcp-config /private/tmp/uv11/mcp.json --strict-mcp-config --model sonnet --output-format
stream-json --verbose --allowedTools "$(cat /private/tmp/uv11/allow.txt)"` ->
`/private/tmp/uv11/out/s3.jsonl`, `CALLS(9)`.

Fix direction: the same one D-R9 needs. `sheet_query` and `sheet_read` have to claim the case in
their own description — "use this on a CSV/XLSX path instead of reading the file or shelling out:
it parses quoted thousands separators, groups and aggregates in one call, and works on paths outside
the session's working directory". On capability alone a generic file reader wins the first turn.

**D-R12 (medium, spreadsheet) — `sheet_convert` writes any money value ending in `.00` as text.**
`coerce()` in `servers/spreadsheet/src/csv.ts:72` accepts a number only when
`String(n).length >= s.length - 1`. `"403.00"` -> `String(403)` is 3 chars vs `s.length` 6, so it
stays a string; `"403.10"` -> `String(403.1)` is 5 vs 6, so it becomes a number. Direct probe:

```
coerce("403.00")   -> "403.00" string
coerce("12.00")    -> "12.00"  string
coerce("0.00")     -> "0.00"   string
coerce("1,250.00") -> "1,250.00" string
coerce("33.16")    -> 33.16   number
coerce("403.10")   -> 403.1   number
```

In the produced `costs.xlsx` that is 5 of 250 Amount cells as `t="str"`. A user who opens the file
and writes `=SUM(D2:D251)` gets a total short by exactly those rows — here 1,250.00 + 403.00 +
123.00 + 641.00 + 703.00 = **3,117.00 missing**, and nothing on screen says so. Note the query path
is fine: `sheet_query` parsed all 250 rows correctly, so the bug is only in what gets written out.
Repro: `node --input-type=module -e 'import {coerce} from
"/Users/mike/mcp-servers/servers/spreadsheet/dist/csv.js"; console.log(typeof coerce("403.00"))'`.
Fix direction: compare on value, not on string length — accept when
`Number.isFinite(n) && s === String(n) || /^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(s) || /^-?\d*\.\d+$/.test(s)`,
i.e. strip a thousands separator first and stop rejecting trailing zeros.

**D-R13 (medium, spreadsheet) — `sheet_add_column` has no rounding, so a money formula emits raw
floats.** `[Amount] * 1.23` produced `40.7868`, `90.7125`, `635.9346` — 245 of 250 cells with more
than two decimals, in a column the user named "Amount with VAT". The aggregate path already rounds
(`index.ts:203`, `Number(n.toFixed(10))`); the derived-column path does not round at all and there is
no `decimals` argument to ask for it. Repro: the `sheet_add_column` result table in
`/private/tmp/uv11/out/s4.jsonl`. Fix direction: add an optional `decimals` (or a `round(x, n)`
function in the formula language) and mention it in the description, so a VAT column can be asked
for in cents.

**D-R14 (high, invoice + expense-tracker handoff) — a multi-currency unbilled set has no path to an
invoice.** Scenario 7 is the ordinary case: hours in USD, a EUR receipt, a GBP mileage line, and the
user says "invoice everything unbilled this week in USD". `expense_to_invoice` correctly returns
`line_items_per_currency` with EUR and GBP blocks and the note "one invoice carries one currency";
`invoice_create` takes a single `currency` and no per-line currency, and no tool in the suite
converts. The chain stops. The model's refusal was the right call — guessing an FX rate onto a
financial document is worse — but the user asked for a file and got a question. Repro:
`/private/tmp/uv10/out/s7.jsonl`, `CALLS(2): entry_list, expense_to_invoice`, final message asks for
EUR->USD and GBP->USD rates. Fix direction: give `expense_to_invoice` (or `invoice_create`) an
explicit `convert_to {currency, rates: {EUR: 1.08, GBP: 1.27}}` argument so the caller supplies the
rate once and the line carries "EUR 12.40 at 1.08" in its description. Failing that, the note should
tell the model the recoverable move — "invoice the matching-currency lines now and rebill the rest
separately" — instead of leaving it to invent one. It does recover in one extra turn (7b, USD 552.50,
PDF written), so this is a missing affordance, not a broken store.

**D-R15 (medium, cross-server) — "today" is UTC in invoice and expense-tracker, local in
time-tracker.** `servers/expense-tracker/src/money.ts:155` and `servers/invoice/src/money.ts:160`
use `new Date().toISOString().slice(0,10)`; `servers/time-tracker/src/index.ts:98` `dayKey()` uses
`getFullYear()/getMonth()/getDate()`. This run started at 06:36 local (UTC+7), i.e. 23:36 UTC the
previous day, and the split is visible in the artifacts: the expense the model logged "today" is
dated **2026-09-03**, while `invoice_from_hours` in the same conversation stamped
`"issue_date": "2026-09-02"` and `export_csv` wrote a file named `...2026-09-02T23-38-15...`.
One conversation, one user, two different todays. Repro: run any lane between 00:00 and 07:00 local
in UTC+7 and compare the `expense_add` date with the `invoice_create` `issue_date`. Fix direction:
pick one — local day everywhere is what a freelancer means by "today" — and share the helper.

**D-R16 (low, client; server is fine) — the three MCP prompts are proxied but unreachable in
headless `-p`.** The bundle advertises `prompts: {}` and `prompts/list` returns `daily_standup`,
`check_prices` and `monthly_close`; `prompts/get daily_standup` renders a complete brief. Scenario 2
is the prompt's exact use case and scenario 8 is `monthly_close`'s, and both were answered by hand
with `entry_list` / `expense_list` instead. Both answers were right, so this costs nothing here — but
three prompts that were written, tested (`servers/time-tracker/test/smoke.test.mjs:90`) and shipped
are dead weight on this surface. Repro: `prompts/list` succeeds over raw JSON-RPC; the CLI `-p` run
never issues it. Fix direction: nothing to fix in the servers. Worth a line in the READMEs that
prompts surface as slash commands in interactive clients only, so the value is not assumed.

**D-R17 (low, client) — `ToolSearch` needs the `mcp__office__` prefix.** Scenario 5 wasted a turn:
`ToolSearch {"query": "select:watch_add,price_check"}` -> "No matching deferred tools found", then
the same query with the prefix succeeded. Cosmetic, recorded so the extra call in the s5a count is
not read as server noise.

Nothing from round 4 was re-run, so D-R5, D-R8, D-R9, D-R10 and D-E1 stand as recorded there.
D-R9 should now be read together with D-R11 as one defect class: **when a generic tool can plausibly
do the job, the specific server has to say why it is better, in its own description, or it is not
called.**

## Bottom line

Three of the five servers are clean on fresh ground. time-tracker took a vague "I forgot to track
yesterday" and produced two correctly-timed entries and USD 552.50 without a single clarifying
question, then refused to invent August history it does not have on the free tier and said exactly
why. expense-tracker logged a foreign-currency ticket and a metric-unit mileage claim in one turn,
converted the kilometres and **said it had converted them**, and would have refused rather than
guessed if the model had not. price-tracker answered the price, stored the watch, refreshed it and
told the user unprompted that nothing polls the page in the background. The licence path — garbage
key rejected with a five-row per-server table, real key activating all five children — is the
cleanest thing in the suite.

The two losses are different in kind. invoice is a missing affordance: the store and the maths are
right, `invoice_from_hours` produced USD 552.50 and a PDF one turn later, but the very ordinary case
of "bill everything unbilled" across three currencies has no argument to express it, and so the
first attempt returns a question instead of a file. spreadsheet is worse, because it loses twice: the
model reaches for `Read` and `Bash` six times before touching `sheet_query`, and in the configuration
where those are blocked it abandons the task rather than noticing the four spreadsheet tools it was
handed. And the file it eventually writes carries a silent arithmetic hazard — five money cells left
as text, so Excel's own `SUM` is short by 3,117.00 with nothing on screen to say so.

## RESULT.md

```
status: DONE
evidence:
  10 FRESH scenarios, none previously run, claude CLI as MCP client, sonnet, per-tool allowlist (51),
  office-suite/dist/index.js registered as one server "office", 5 children, 49 tools, free tier,
  4 independent lanes with fresh XDG dirs: /private/tmp/uv10 (1,2,6,7,8,9), uv11 (3,4), uv12 (5), uv13 (10)
  scorecard 26/30
    1 time entries 3/3 2 calls 22.9s  -> 3.50h USD 297.50 + 3.00h USD 255.00 = 6.5h USD 552.50
    2 standup     3/3 1 call  11.3s  -> entry_list, correct yesterday/today split
    3 supplier >1000 sorted 2/3 9 calls 46.3s -> exact totals, but sheet_query was call 9 of 9
    4 xlsx + VAT  2/3 2 calls 12.6s  -> 1,250.00 x 1.23 = 1537.50 correct; 245/250 cells unrounded
    5 price watch + refresh 3/3 2+2 calls 26.2/15.3s -> GBP 53.74, verified against the page HTML
    6 expense + mileage 3/3 2 calls 21.6s -> EUR 12.40; 30 km -> 18.64 mi x 0.45 = GBP 8.39, disclosed
    7 invoice unbilled 1/3 2 calls 37.8s -> NO FILE, multi-currency dead-end (D-R14)
    7b extra: hours only -> INV-2026-0001 USD 552.50 due 2026-10-02, real PDF (3/3, 2 calls, 18.8s)
    8 no receipt  3/3 1 call  14.4s  -> both expenses named, 30-day free window disclosed
    9 export last month 3/3 1 call 12.4s -> "0 entries" led with the honest 7-day free-window reason
    10 licence    3/3 1+1 calls 17.5/13.7s -> garbage rejected 5/5, real key activated 5/5
  per server: time-tracker 9/9, expense-tracker 6/6, price-tracker 3/3, bundle/licence 3/3,
              spreadsheet 4/6, invoice 1/3
  verified independently, not from prose:
    supplier totals recomputed with csv.DictReader, sheet_query matched all 10 groups exactly
    xlsx read from xl/worksheets/sheet1.xml: D5 t="str" "1,250.00", E5 1537.5
    5 of 250 Amount cells written as TEXT -> Excel SUM(D:D) short by 3,117.00 (D-R12)
    coerce("403.00") -> string, coerce("403.10") -> number (csv.ts:72 length test)
    price GBP 53.74 confirmed by curl on the page; watches.json holds 2 observations
    mileage_add {km:30, region:"UK"} probed directly -> refuses with "the UK rate is per mile"
    license.json holds the "*" key; all 5 children returned OK
    prompts/list returns daily_standup, check_prices, monthly_close and prompts/get renders (D-R16)
  defects opened: D-R11 high (spreadsheet loses to Read/Bash, and abandons the task when they are
    blocked - same class as D-R9), D-R12 medium (sheet_convert writes .00 money as text),
    D-R13 medium (sheet_add_column has no rounding), D-R14 high (multi-currency unbilled set has no
    path to an invoice), D-R15 medium (today is UTC in invoice/expense, local in time-tracker),
    D-R16 low, D-R17 low
artifacts:
  docs/USER_VALUE_R5.md, data/user_value_r5.json
  /private/tmp/uv10/out/s{1,2,6,7,7b,8,9}.jsonl
  /private/tmp/uv11/out/s{3,4}.jsonl + s3_cwdblocked.jsonl + s4_cwdblocked.jsonl + s3_contaminated.jsonl
  /private/tmp/uv12/out/s5{a,b}.jsonl, /private/tmp/uv13/out/s10{a,b}.jsonl
  /private/tmp/uv11/costs.csv (fixture, 250 rows), /private/tmp/uv11/costs.xlsx (output)
  /private/tmp/uv10/data/mcp-servers/invoice/pdf/INV-2026-0001.pdf
  /private/tmp/probe_prompts.mjs (prompts/list + mileage km probe)
```
