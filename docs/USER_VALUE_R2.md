# User value audit, round 2 — 2026-09-02

Same question as round 1 (`docs/USER_VALUE.md`): does a person get what they asked for, correctly, in
one natural request? Same 14 scenarios, same prompts, same fixture, same rubric, re-run after the two
"Value fixes 2026-09-02" sections landed.

Method: the four servers registered as stdio commands in `/private/tmp/uv2/mcp.json`
(`node /Users/mike/mcp-servers/servers/<name>/dist/index.js`), driven by the real `claude` CLI as an
MCP client, `--strict-mcp-config --model sonnet --max-turns 12 --allowedTools "mcp__*"`, against a
fresh free-tier data dir (`XDG_DATA_HOME=/private/tmp/uv2/data`, `XDG_CONFIG_HOME=/private/tmp/uv2/cfg`).
Transcripts are kept as `stream-json` so tool calls are countable. The price-tracker "what does this
cost" scenario is run twice, exactly as round 1: the natural variant and the control with
`--disallowedTools "WebFetch,WebSearch,Bash,Read,Write,Edit"`.

Fixture: `/private/tmp/uv2/sales.xlsx` rebuilt from the round-1 record set — title row, blank row,
header on row 3, 400 data rows, sheets `Sales` / `Reps` / `Notes`, string prices like `"1,516.16"`.
Ground truth for "North, top rep by units" is identical to round 1: Turing 650, Hopper 567, Linus 551,
Lovelace 486, Liskov 290.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn or extra
noise. 1 = partially wrong, or asked for something the tool could infer. 0 = failed or wrong numbers.

## Scorecard — 37 / 39 (round 1: 28 / 39)

| Server | Scenario | R1 | R2 | Calls | Sec | Note |
|---|---|---|---|---|---|---|
| time-tracker | Start tracking time for the Acme website project. | 3 | 3 | 1 | 7.1 | `timer_start`, one call. |
| time-tracker | Stop the timer and tell me how long I worked. | 3 | 3 | 1 | 10.8 | 8 s / 0.00 h, correct. |
| time-tracker | Log 2.5 hours yesterday for Acme, design review, at 90 euros an hour. | 2 | **3** | 1 | 9.2 | `rate: "90 euros an hour"` parsed; answer **EUR 90/h = EUR 225.00**; "Acme" resolved to the existing "Acme website". D-3 and D-7 gone. |
| time-tracker | How much do I bill Acme this week? Give me invoice lines. | 2 | 2 | 7 | 35.6 | **EUR 225.00**, 2.50 h, one project — numbers now right. But `invoice_summary`, the tool the prompt names, is Pro-gated, so the model rebuilt the lines from `entry_list` + `report` over 7 calls (D-11). |
| price-tracker | What does this cost right now: books.toscrape...? | 1 | 1 | 1 | 13.7 | **Still answered by built-in WebFetch.** The model ran `ToolSearch "select:WebFetch"` and never opened a price-tracker description. D-4 not fixed. |
| price-tracker | (control) same prompt, WebFetch disallowed | 3 | 3 | 1 | 9.6 | `price_check` -> GBP 51.77, and the new `Confidence: low (regex-fallback)` line was relayed to the user. |
| price-tracker | Watch that page and alert me if it goes under 40. | 2 | **3** | 1 | 12.6 | `watch_add`, and the model told the user unprompted that nothing polls in the background and that "refresh my watches" is the pattern. No cron/scheduler detour. |
| price-tracker | Show me everything I'm watching and whether anything dropped. | 1 | **3** | 3 | 14.3 | `watch_refresh {all:true}` -> `watch_list` -> `alerts_pending`, all free. "Nothing dropped, GBP 51.77, +0.00%, target GBP 40 not hit." |
| spreadsheet | Open sales.xlsx and tell me what's in it. | 3 | 3 | 3 | 14.2 | 3 sheets, 400 rows, header row found past the preamble. |
| spreadsheet | Which rep sold the most units in the North region? Top 5 with totals. | 2 | **1** | 3 | 23.0 | Aggregation now happens **in the server** (one `group_by` + `sum` call, no python, 71.4 s -> 23.0 s). But the model added an unrequested `[Status] = "Closed"` filter and reported Turing **391**, Linus 334, Hopper 311, Lovelace 173, Liskov 156 — wrong for the question asked (D-10). |
| spreadsheet | Add a Revenue column and save it as a CSV next to the original. | 1 | **3** | 1 | 17.3 | **401 lines**, all 400 rows, Revenue exact on every row (total 10,142,542.04), string prices handled, source untouched, one call. D-1 gone. |
| invoice | Set up my business: ... EUR, 23% VAT, 14 day terms. | 3 | 3 | 1 | 16.3 | Every field parsed from free text in one call. |
| invoice | Invoice Acme, 12 h API work at 90 EUR + 300 EUR setup, PDF. | 3 | 3 | 2 | 18.1 | EUR 1380.00 + 317.40 = **EUR 1697.40**, exact. The bare-client warning reached the user with the `client_add` fix. |
| invoice | Which invoices are unpaid and overdue? | 2 | **3** | 1 | 11.8 | `overdue_report` answered directly on free, no fallback. |

Per server: invoice 9/9 (was 8/9), time-tracker 11/12 (was 10/12), price-tracker 10/12 (was 4/12),
spreadsheet 7/9 (was 6/9). Calls exclude the client's own `ToolSearch` schema lookups.

Every number was checked independently: invoice total EUR 1697.40 (12 x 90 + 300 = 1380, x1.23 =
1697.40); time-tracker EUR 225.00 stated in EUR with no "$" anywhere in the answer; `sales.csv`
`grep -c '' = 401` with zero rows where `Revenue != Units x Unit Price`; the North ranking checked
against the generator.

## Defect status, judged on the model's final answer

| Defect | Server | Fixed for the user? | Evidence |
|---|---|---|---|
| D-1 free write cap truncates data | spreadsheet | **yes** | ss3 wrote 401 lines in one call, revenue exact, no python fallback. |
| D-2 redirect off the product page still returns a price | price-tracker | **yes** (but see D-9) | IKEA `price_check` now errors: `redirected to .../cat/billy-bookcases-58288/ ... it is a "cat" listing page`. Round 1 returned USD 39. |
| D-3 rate has no currency | time-tracker | **yes** | tt3 "EUR 90.00/h = EUR 225.00"; tt4 table in EUR. |
| D-4 loses tool selection to WebFetch | price-tracker | **no** | pt1 identical to round 1: WebFetch answered, `price_check` never called. |
| D-5 watch nothing ever checks | price-tracker | **yes** | pt2 stated the no-polling contract and named `watch_refresh`; no scheduler skill invoked. |
| D-6 no aggregation | spreadsheet | **partial** | one in-server `group_by`/`sum` call replaced the 5-call python detour, but the answer the user read was wrong (D-10). |
| D-7 no project reconciliation | time-tracker | **yes** | "Acme" -> "Acme website", announced; tt4 billed one project. |
| D-8 no currency on line amounts, bare client | invoice | **yes** | PDF carries EUR on every amount; the missing-address note reached the user. |

Six of eight fixed outright, one partial, one untouched.

## New defects

**D-9 (high, price-tracker) — `checkRedirect` false-positives on slug-canonicalisation redirects.**
`https://www.newegg.com/p/N82E16819113877` 301s to
`https://www.newegg.com/amd-ryzen-7-9000-series-.../p/N82E16819113877` — the same product, same id.
`checkRedirect` refuses it with `the path depth changed from 2 to 3 segments`
(`servers/price-tracker/src/redirect.ts:88`), so a page the extractor read correctly as USD 469 in
round 1 now returns an error. Repro:
`node /private/tmp/uv2/probe.mjs price-tracker '{"name":"price_check","args":{"url":"https://www.newegg.com/p/N82E16819113877"}}'`.
Fix direction: before the depth rule, accept a redirect whose final path still contains every
non-generic segment of the requested path (here the product id), or whose final path is the requested
path with a leading slug inserted. This class — short canonical URL expanding to a slug URL — is
common (Newegg, Amazon `/dp/`, Zalando), so the rule as written will cost real hits.

**D-10 (medium, spreadsheet) — the aggregate answer silently narrows the question.**
ss2's model call was `where '[Region] = "North" AND [Status] = "Closed"'`; nothing in the prompt asked
for closed deals only. The server did exactly what it was told and the user read 391 instead of 650.
The same query without the Status filter returns the ground truth in one call:
`node /private/tmp/uv2/probe.mjs spreadsheet '{"name":"sheet_query","args":{"path":"/private/tmp/uv2/sales.xlsx","sheet":"Sales","where":"[Region] = \"North\"","group_by":["Rep"],"aggregate":[{"col":"Units","fn":"sum","as":"total_units"}],"sort":{"col":"total_units","dir":"desc"},"limit":5}}'`
-> `Alan Turing 650 | Grace Hopper 567 | Linus T 551 | Ada Lovelace 486 | Barbara Liskov 290`.
Fix direction: the group header already prints `5 groups from 102 of 400 rows`; have it echo the
`where` clause too, so a filter the user never asked for is visible in the model's own output.

**D-11 (medium, time-tracker) — `invoice_summary` is the last paywall that costs a free user work.**
With `alerts_pending` and `overdue_report` freed, this is the one Pro gate a first session still hits,
and it sits on the exact phrase "give me invoice lines": 7 calls and 35.6 s to reconstruct one tool's
output. `servers/time-tracker/src/index.ts:701`. Repro:
`node /private/tmp/uv2/probe.mjs time-tracker '{"name":"invoice_summary","args":{"project":"Acme website","from":"2026-08-31","to":"2026-09-02"}}'`
-> upgrade text. Fix direction: free for one project or a 7-day window, Pro for multi-project or
arbitrary ranges — the treatment the other two gates already got.

## Price extraction on the real web — 5 / 12 correct (41.7%), same rate, different 5

| # | URL | Status | Price | Cur | Conf | Source | Correct |
|---|---|---|---|---|---|---|---|
| 1 | books.toscrape.com (control) | 200 | 51.77 | GBP | low | regex-fallback | yes |
| 2 | apple.com/shop/buy-mac/macbook-air | 200 | 1299 | USD | high | json-ld | yes |
| 3 | www2.hm.com product page | 403 | - | - | - | - | no (bot wall) |
| 4 | ikea.com BILLY bookcase | 200 | **refused** | - | high | json-ld | **yes — correctly refused** |
| 5 | bestbuy.com AirPods Pro 2 | timeout 15 s | - | - | - | - | no |
| 6 | walmart.com Great Value milk | 200 | 3.52 | USD | high | microdata | yes |
| 7 | allegro.pl LEGO 11030 | timeout 15 s | - | - | - | - | no (was 403) |
| 8 | mediamarkt.pl DeLonghi ECAM | 403 | - | - | - | - | no (bot wall) |
| 9 | homedepot.com Husky tool chest | 403 | - | - | - | - | no (bot wall) |
| 10 | newegg.com Ryzen 7 9800X3D | 200 | **refused** | - | medium | class:product-price | **no — false refusal (D-9)** |
| 11 | etsy.com | 403 | - | - | - | - | no (bot wall) |
| 12 | gap.com twill cargo shorts | 200 | 49.95 | USD | medium | class:price | yes |

The headline rate is unchanged at 5/12, but the composition moved: IKEA went from a wrong price to a
correct refusal (the round-1 worst case — alerting on a number that was never the price — is gone),
and Newegg went from a correct price to a false refusal. Pages returning usable HTML: 6 (was 7;
Allegro's 403 became a timeout, which is site variance, not a code change). Of those 6, five correct,
one falsely refused. Confidence levels are now reported and are plausible: `json-ld`/`microdata` high,
class-hint medium, the books.toscrape regex fallback low — and the model relayed that "low" to the
user in both pt1b and pt2, which is the behaviour the confidence signal was added for.

## PDF verdict — PASS

`docs/assets/invoice-sample-r2.png`, `pdftoppm -png -r 80` of INV-2026-0001.

Currency codes on every amount: UNIT `EUR 90.00` / `EUR 300.00`, AMOUNT `EUR 1080.00` / `EUR 300.00`,
`Subtotal EUR 1380.00`, `Tax 23% on EUR 1380.00  EUR 317.40`, `Total EUR 1697.40`. Nothing clipped,
nothing overlapping; the widened money strings still sit inside their columns and the right edge of
AMOUNT is flush with the table rule. Header, issue/due/status block, BILL TO, 4-column line table with
per-line tax, payment details with IBAN and reference, single-line footer — one A4 page.
The only remaining cosmetic gap is BILL TO showing the bare name "Acme" because the client was
auto-created; unlike round 1, the tool response now says so and gives the `client_add` fix, so the
user is not left to discover it on the PDF.

## Free-tier fairness

One Pro wall is still hit in a first realistic session, down from three.

| Server | Limit | Where it bit | Severity |
|---|---|---|---|
| time-tracker | `invoice_summary` Pro-only | "give me invoice lines" | medium — 7 calls to rebuild it (D-11) |

No longer hit: the spreadsheet write cap (200 -> 500, and it refuses rather than truncating),
`alerts_pending` (free), `overdue_report` (free). Not hit: time-tracker 7-day window, spreadsheet
5,000-row / 5 MB read cap, invoice 3-per-month, price-tracker 3-watch limit. The upgrade message is
unchanged and still clean: feature named, $19 / $39 lifetime, checkout URL, activation step, offline
verification, no dark patterns.

## Bottom line

28 -> 37 of 39. The three seams named in round 1 are closed where it counts: no more partial file that
looks complete, no more price from a page the user never asked about, no more currency that exists in
the sentence but not the schema. price-tracker moved most (4 -> 10) because two of its three losses
were paywall and honesty problems, not code problems. What is left is one unfixed selection problem
(D-4: a better description cannot win a race the model never enters — the fix has to be a tool the
model reaches for first, or nothing), one over-tight guard that now costs real hits (D-9), one
reporting gap that let a model narrow a question invisibly (D-10), and one paywall in the wrong place
(D-11). None of them is arithmetic.

## RESULT.md

```
status: DONE
evidence:
  14 scenarios, claude CLI as MCP client, free tier, /private/tmp/uv2
    tt1 3/3 1 call 7.1s | tt2 3/3 1 call 10.8s | tt3 2->3 1 call 9.2s | tt4 2->2 7 calls 35.6s
    pt1 1->1 1 call 13.7s | pt1b 3/3 1 call 9.6s | pt2 2->3 1 call 12.6s | pt3 1->3 3 calls 14.3s
    ss1 3/3 3 calls 14.2s | ss2 2->1 3 calls 23.0s | ss3 1->3 1 call 17.3s
    iv1 3/3 1 call 16.3s | iv2 3/3 2 calls 18.1s | iv3 2->3 1 call 11.8s
  total 37/39 (round 1: 28/39)
  independent checks: invoice EUR 1697.40 exact; time-tracker "EUR 225.00", no "$";
    grep -c '' /private/tmp/uv2/sales.csv = 401, 0 rows where Revenue != Units x Unit Price;
    North top rep = Alan Turing 650 (server one-call query matches generator)
  12 retailer URLs through dist/fetch.js + dist/extract.js: 5/12 correct (41.7%)
    IKEA refused as intended; newegg falsely refused (D-9)
  pdftoppm -png -r 80 INV-2026-0001 -> docs/assets/invoice-sample-r2.png: PASS
artifacts:
  docs/USER_VALUE_R2.md
  data/user_value_r2.json
  docs/assets/invoice-sample-r2.png
  /private/tmp/uv2/out/*.jsonl (transcripts), /private/tmp/uv2/price_raw.json
cost: 26 wall minutes
failures:
  D-4 unfixed: pt1 still answered by WebFetch, price_check never called
  D-9 new: checkRedirect rejects newegg /p/<id> -> /<slug>/p/<id> on path-depth change
  D-10 new: model added an unrequested [Status]="Closed" filter, reported 391 not 650
  D-11 new: invoice_summary Pro-gate cost 7 calls / 35.6 s in tt4
insight:
  Freeing alerts_pending and rewriting descriptions had opposite effects. The paywall fix
  moved price-tracker 1->3 on pt3 immediately; the description fix moved pt1 not at all,
  because the client resolved WebFetch by name without ever fetching an MCP tool schema.
  Tool-selection losses are won upstream of the description text.
```

## Round-2 fixes

Three defects from the list above are closed in code. Build and tests below are verbatim.

**D-9 (price-tracker) — `checkRedirect` accepts slug canonicalisation.**
`servers/price-tracker/src/redirect.ts:38` `GENERIC_PATH_SEGMENTS` (markers `p`/`dp`/`item`/... plus
the listing words and, at `:44`, two-letter locales) defines which path segments carry no product
identity. `servers/price-tracker/src/redirect.ts:57` `productToken` returns the longest purely
alphanumeric, non-generic segment of the request (>= 5 chars, so slugs with hyphens and short markers
are excluded). `servers/price-tracker/src/redirect.ts:68` `keepsProductIdentity` is true when every
non-generic segment of the requested path survives in the final path, or when the product token
appears anywhere in the final URL including its query string.
`servers/price-tracker/src/redirect.ts:131` computes that verdict and `:134` makes the path-depth
rule conditional on it, so `/p/<id>` -> `/<slug>/p/<id>` no longer refuses. The home-page rule at
`:126` runs before it, and the category/listing rule at `:141` plus the generic/not-found/shop-name
title rules at `:145`-`:151` still run after it, so identity preservation buys nothing when the final
page is a listing or has a generic title.

Cases added, `servers/price-tracker/test/redirect.test.mjs:60,69,78,87,97,103`:
newegg `/p/N82E16819113877` -> same path with `?Item=...` (accept), newegg `/p/N82E16819113877` ->
`/amd-ryzen-7-9800x3d-processor/p/N82E16819113877` (accept), amazon `/dp/B0XXXX1234` ->
`/Acme-Widget-Pro-Oak/dp/B0XXXX1234/ref=sr_1_1` (accept), ikea `/us/en/p/billy-bookcase-white-00522047/`
-> `/us/en/cat/billy-bookcases-58288/` (refuse, `"cat" listing page`), `shop.example.com/item/123` ->
`/` (refuse, home page), plus a direct `productToken` case.

**D-10 (spreadsheet) — `sheet_query` echoes the query it ran.**
`servers/spreadsheet/src/index.ts:241` `describeQuery` renders the effective `where`, `group_by`,
`aggregate` (as `<fn> <col> as <alias>`), `sort` and `limit` as one line; `:326` puts it in front of
the existing counts line, which stays byte-identical at `:321`. A call with no filter, grouping,
aggregate, sort or limit prints no query line, so plain reads are unchanged. The first two lines of
the ss2 call now read:

```
Query: where [Region] = "North" AND [Status] = "Closed"; group by Rep; sum Units as total_units; sort total_units desc; limit 5
5 groups from 102 of 400 rows, showing 5
```

Case added, `servers/spreadsheet/test/query.test.mjs:153`: asserts that exact `Query:` line shape for
a narrowed grouped query, the bare `Query: where [Region] = "South"` line for an ungrouped filter, and
that an unfiltered read still starts with `15 of 15 rows match`.

**D-11 (time-tracker) — `invoice_summary` is free inside the 7-day window.**
`servers/time-tracker/src/index.ts:701` replaces `if (!gate.isPro()) return gated("invoice_summary")`
with the same `pro` / `windowFor(a.from, a.to, pro)` treatment `entry_list`, `report` and `export_csv`
already use: free callers get the last 7 days, Pro gets the full history. The clamp note is appended
at `:726` (and `:708` for an empty period), so a free caller asking for a longer period gets the
invoice lines it can produce plus `Note: the free tier shows the last 7 days` and the checkout URL,
instead of only upgrade text. Gate text updated at `:694`: "Free for the last 7 days; Pro invoices any
period from the full history." Pro keeps full history, `group_by tag` (`:599`) and unlimited rated
projects (`:540`) — those two gates are untouched.

Test updated, `servers/time-tracker/test/smoke.test.mjs:115`: the free-tier case now asserts
`doesNotMatch(/Pro feature/)`, `Invoice summary - acme`, the `USD 100.00` rate and a
`TOTAL 1.5x h  USD 15x.xx` total, then asserts that a 2020-to-today range still answers with the
7-day note and the `mcp.zovo.one/buy/time-tracker` URL. The pro-tier test is unchanged apart from its
name (`pro tier: a signed key unlocks full invoice history, tag grouping and full history`).

`servers/time-tracker/README.md` still lists `invoice_summary` as Pro-only (rows 60 and 76); that file
is owned by another agent this round and was not edited.

### Build

```
> @theluckystrike/mcp-price-tracker@0.1.1 build
> tsc -p tsconfig.json && node -e "import('node:fs').then(f=>f.chmodSync('dist/index.js',0o755))"

> @theluckystrike/mcp-spreadsheet@0.1.1 build
> tsc -p tsconfig.json && node -e "require('fs').chmodSync('dist/index.js',0o755)"

> @theluckystrike/mcp-time-tracker@0.1.1 build
> tsc -p tsconfig.json && node -e "import('node:fs').then(f=>f.chmodSync('dist/index.js',0o755))"
```

### Tests

```
> @theluckystrike/mcp-price-tracker@0.1.1 test
# tests 39
# pass 39
# fail 0
> @theluckystrike/mcp-spreadsheet@0.1.1 test
# tests 34
# pass 34
# fail 0
> @theluckystrike/mcp-time-tracker@0.1.1 test
# tests 6
# pass 6
# fail 0
```

price-tracker 33 -> 39 tests (6 D-9 cases), spreadsheet 33 -> 34 (1 D-10 case), time-tracker 6
unchanged (the D-11 case replaced the gate assertion inside the existing free-tier test).

### scripts/validate.mjs

```
time-tracker: 18/18 in 272 ms
price-tracker: 18/18 in 278 ms
spreadsheet: 18/18 in 377 ms
invoice: 20/20 in 427 ms
billing: 10/10
validation db: /Users/mike/mcp-servers/data/validation.json run 9: 84/84
```

84/84, unchanged. The time-tracker probe does not exercise `invoice_summary` gating, so no probe line
needed adjusting.
