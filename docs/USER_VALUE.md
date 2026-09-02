# User value audit — 2026-09-02

Question: does a person get what they asked for, correctly, in one natural request?
Not "do the tools respond" (that is already 82/82).

Method: the four servers registered as stdio commands in `/private/tmp/uv/mcp.json`, driven by the
real `claude` CLI 2.1.258 as an MCP client (`--strict-mcp-config --model sonnet --allowedTools "mcp__*"`),
against a fresh free-tier data dir (`XDG_DATA_HOME=/private/tmp/uv/data`). Prompts are phrased as a
user would phrase them; no tool names. Every number was verified independently.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn or extra noise.
1 = partially wrong, or asked for something the tool could infer. 0 = failed or wrong numbers.

## Scorecard — 28 / 39

| Server | Scenario | Score | Calls | Sec | Note |
|---|---|---|---|---|---|
| time-tracker | Start tracking time for the Acme website project. | 3 | 1 | 8.6 | `timer_start`, one call, correct. |
| time-tracker | Stop the timer and tell me how long I worked. | 3 | 1 | 9.4 | 8 s / 0.00 h, correct for real elapsed time. |
| time-tracker | Log 2.5 hours yesterday for Acme, design review, at 90 euros an hour. | 2 | 1 | 10.0 | Logged right. **EUR silently dropped** — `entry_add` has no currency parameter. |
| time-tracker | How much do I bill Acme this week? Give me invoice lines. | 2 | 3 | 29.0 | 2.50 h / 225.00 correct, but printed as **$225.00 USD**, and hours split across two projects. |
| price-tracker | What does this cost right now: books.toscrape...? | 1 | 1 | 11.9 | Client used built-in **WebFetch**; `price_check` never called. Server delivered nothing. |
| price-tracker | (control) same prompt, WebFetch disallowed | 3 | 1 | 14.0 | `price_check` -> GBP 51.77, correct. This is the ceiling. |
| price-tracker | Watch that page and alert me if it goes under 40. | 2 | 2 | - | `watch_add` fine. **No alerting exists**, so the agent tried to build a cron job with an external scheduler skill. |
| price-tracker | Show me everything I'm watching and whether anything dropped. | 1 | 2 | 11.1 | `watch_list` works; the "dropped" half is unanswerable — `alerts_pending` is Pro-only. |
| spreadsheet | Open sales.xlsx and tell me what's in it. | 3 | 3 | 16.5 | 3 sheets, 400 rows, `headerRow=2` found past the title+blank rows, types and ranges correct. |
| spreadsheet | Which rep sold the most units in the North region? Top 5 with totals. | 2 | 5 | 71.4 | Right answer (Turing 650, Hopper 567, Linus 551, Lovelace 486, Liskov 290) but **only via a python fallback** — `sheet_query` cannot group or sum. |
| spreadsheet | Add a Revenue column and save it as a CSV next to the original. | 1 | 2 | - | Math correct incl. string prices, but the free **200-row cap wrote 200 of 400 rows** and reported success. Agent abandoned the server. |
| invoice | Set up my business: ... EUR, 23% VAT, 14 day terms. | 3 | 1 | 13.9 | Every field parsed from free text in one call. |
| invoice | Invoice Acme, 12 h API work at 90 EUR + 300 EUR setup, PDF. | 3 | 2 | 15.4 | EUR 1380.00 + 317.40 = **EUR 1697.40**, exact. PDF written. |
| invoice | Which invoices are unpaid and overdue? | 2 | 2 | 11.1 | `overdue_report` returned the upgrade text; correct answer came from the `invoice_list` fallback. |

Per server: invoice 8/9, time-tracker 10/12, spreadsheet 6/9, price-tracker 4/9 (ceiling 6/9 with the control).
Calls exclude the client's own `ToolSearch` schema lookups.

## Price extraction on the real web — 5 / 12 correct (41.7%)

Compiled `dist/fetch.js` + `dist/extract.js` called directly. "Correct" = the price also appears
as the product price in the HTML I grepped myself.

| # | URL | Status | Price | Cur | Source | Correct |
|---|---|---|---|---|---|---|
| 1 | books.toscrape.com (control) | 200 | 51.77 | GBP | regex-fallback | yes |
| 2 | apple.com/shop/buy-mac/macbook-air | 200 | 1299 | USD | json-ld | yes (AggregateOffer lowPrice, matches visible $1,299.00) |
| 3 | www2.hm.com product page | 403 | - | - | - | no (bot wall) |
| 4 | ikea.com BILLY bookcase | 200 | 39 | USD | json-ld | **no (wrong page)** |
| 5 | bestbuy.com AirPods Pro 2 | timeout 15 s | - | - | - | no |
| 6 | walmart.com Great Value milk | 200 | 3.52 | USD | microdata | yes |
| 7 | allegro.pl LEGO 11030 | 403 | - | - | - | no (bot wall) |
| 8 | mediamarkt.pl DeLonghi ECAM | 403 | - | - | - | no (bot wall) |
| 9 | homedepot.com Husky tool chest | 403 | - | - | - | no (bot wall) |
| 10 | newegg.com Ryzen 7 9800X3D | 200 | 469 | USD | class:product-price | yes |
| 11 | etsy.com | 403 | - | - | - | no (bot wall) |
| 12 | gap.com twill cargo shorts | 200 | 49.95 | USD | class:price | yes |

Failure classes: **5 bot walls (403)**, **1 timeout**, **1 wrong page** (see D-2).
Of the 7 pages that returned HTML, 6 yielded a price and 5 of those were right — the extractor itself
is strong (json-ld, microdata, class heuristics and a regex fallback all fired). The binding constraint
is reach, not parsing: 42% of a normal retail basket never returns HTML to a plain `fetch`.
The 403 message is good — it names the cause and offers `price_add_manual` as the way round.

## PDF verdict — PASS

`docs/assets/invoice-sample.png` (rendered `pdftoppm -png -r 80` from INV-2026-0001).

A4 single page, clean typographic grid: business name left / INVOICE + number right, an issue-due-status
block, BILL TO, a 4-column line table carrying per-line tax, right-aligned Subtotal / Tax / Total with the
Total in EUR, payment details with IBAN and reference, and a light footer. Nothing is cut off, nothing
overlaps, the totals are the most readable thing on the page. A client would accept this without comment.

Two cosmetic gaps: line amounts carry no currency symbol (only the Total does), and BILL TO shows only
"Acme" with no address, because `invoice_create` auto-created the client from a bare name.

## Free-tier fairness

A free user hits a limit **inside the first realistic session** — three times.

| Server | Limit | Where it bit | Severity |
|---|---|---|---|
| spreadsheet | 200-row write cap | `sheet_add_column` on a 400-row sheet | high — silent partial data (D-1) |
| price-tracker | `alerts_pending` Pro-only | "whether anything dropped" | high — that is the product |
| invoice | `overdue_report` Pro-only | "which invoices are overdue" | medium — `invoice_list` covers it |

Not hit: time-tracker 7-day window, spreadsheet 5,000-row / 5 MB read cap, invoice 3-per-month.

The upgrade message reads clearly. It names the feature, the price ($19, or $39 for all servers,
lifetime), the checkout URL, the activation step, and that keys verify offline with nothing sent anywhere.
No dark patterns. The complaint is not the wording, it is *which* features sit behind it: gating
`alerts_pending` means the free price-tracker cannot do the one thing its name promises, and the
model's honest reaction was to route around the paywall with Bash rather than suggest a purchase.

## Defects found

**D-1 (high, spreadsheet) — free write cap truncates data while reporting success.**
`sheet_add_column` on a 400-row sheet writes 200 rows and returns a success message plus a preview table.
The output file is structurally valid and looks complete; only the prose note says otherwise.
Repro: `node probe.mjs spreadsheet '{"name":"sheet_add_column","args":{"path":"/private/tmp/uv/sales.xlsx","sheet":"Sales","name":"Revenue","formula":"[Units] * [Unit Price]","out_path":"/private/tmp/uv/chk.csv"}}'`
-> `wc -l /private/tmp/uv/chk.csv` = 200, source has 400. `servers/spreadsheet/src/index.ts:60`.
Fix direction: refuse the write, or name the output `...-first-200-rows.csv`, or return `isError`.

**D-2 (high, price-tracker) — a redirect off the product page still returns a price.**
`https://www.ikea.com/us/en/p/billy-bookcase-white-00263850/` redirects to a category listing.
`extractPrice` returns "39" USD with title "BILLY, Bookcase, oak effect" — the cheapest item on a
different page. Sharper case: `https://www.ikea.com/us/en/p/billy-bookcase-white-00522047/` redirects to
`https://www.ikea.com/us/en/cat/products-products/` and returns price "10", title "Products".
No check that `finalUrl` still looks like a product page and no confidence signal on `regex-fallback`.
This is the worst failure mode for a price watcher: it will alert on a number that was never the price.

**D-3 (high, time-tracker) — the rate has no currency, so "90 euros" becomes USD.**
`entry_add` accepts `rate` but no `currency` (`src/index.ts:273-282`); currency lives only on the project
via `project_set_rate` and `currencyFor()` defaults to `"USD"` (`:131`). Repro: the tt3/tt4 pair above —
user says "90 euros an hour", the invoice summary prints `$90.00/hr` and `$225.00 USD`.
Fix direction: add `currency` to `entry_add`, or infer the project currency on first rated entry.

**D-4 (medium, price-tracker) — the server loses tool selection to the built-in WebFetch.**
With normal client tools available, the natural prompt "What does this cost right now: <url>" was answered
by WebFetch; `price_check` was never called (`out/pt1.jsonl`). It only wins when WebFetch is disallowed
(`out/pt1b.jsonl`). The tool description does not say what it adds over a plain page fetch (history,
normalized decimal price, currency detection, watch integration).

**D-5 (medium, price-tracker) — `watch_add` stores a watch nothing ever checks.**
There is no scheduler, no background refresh and no notification path, so "alert me if it goes under 40"
cannot be honoured. In `out/pt2b.jsonl` the agent's next move was to invoke an external `schedule` skill
to build a cron job. `watch_add` should say plainly that checks happen when the user asks, and
`watch_refresh` should be the documented pattern.

**D-6 (medium, spreadsheet) — no aggregation, so every "who sold the most" question leaves the server.**
`sheet_query` filters and selects but cannot group or sum. Getting the top-5-by-region answer took 5 calls
and 71 s, and the arithmetic was done by python outside the server (`out/ss2.jsonl`). A `group_by` +
`agg` on `sheet_query`, or a `sheet_pivot` tool, would turn a 71 s multi-tool detour into one call.

**D-7 (low, time-tracker) — no project name reconciliation.**
"the Acme website project" created `Acme website`; "for Acme" created `Acme`. `entry_add` accepts any new
string without listing near-matches, so the week's billing was split across two projects and the model had
to reconcile them in prose. A near-match warning on project creation would fix it.

**D-8 (low, invoice) — client auto-created with no address, and line amounts carry no currency symbol.**
`invoice_create` with `client: "Acme"` created the client silently, so BILL TO on the PDF is a bare name.
Cosmetic, but it is the first thing a real client's accounts department looks at.

## Bottom line

Correctness, where the server is actually reached, is good: the invoice arithmetic is exact to the cent,
the spreadsheet ranking matches ground truth, the header-row detection handles a title-and-blank-row
preamble, and the price extractor parses `"1,516.16"`-style string prices correctly. **invoice is
shippable as is.** The value is lost at three seams, not in the math: a free cap that mutilates data while
claiming success (D-1), a price extractor with no idea whether it is still on the product page (D-2), and
a currency that exists in the user's sentence but not in the schema (D-3). Fix those three and the score
goes from 28/39 to roughly 34/39 without a single new feature.

Artifacts: `data/user_value.json`, `docs/assets/invoice-sample.png`, transcripts in `/private/tmp/uv/out/`.

## Value fixes 2026-09-02 (price-tracker, invoice)

Four defects from the audit above, fixed with tests. Scope: `servers/price-tracker` and
`servers/invoice` only (D-1, D-3, D-6, D-7 belong to spreadsheet and time-tracker).

### D-2 (high, price-tracker) — a redirect off the product page still returned a price

- New `servers/price-tracker/src/redirect.ts:71` `checkRedirect(requestedUrl, finalUrl, title)`.
  A redirect is refused when the final URL lands on the home page, changes path depth family,
  enters a category/listing segment the request was not already in (`cat`, `category`, `collections`,
  `products`, `search`, ...), or when the page title is generic (`Products`, `Home`, `Search results`),
  is only the shop name, or contains "not found" / "404". The message is
  `the shop redirected to <finalUrl>, which is not a product page (<why>)`, plus what to do next.
  A non-redirect is always allowed, whatever the title says.
- `servers/price-tracker/src/fetch.ts:29-39,85` — `FetchedPage` now carries `requestedUrl`,
  `finalUrl`, `status` and `redirected`.
- `servers/price-tracker/src/index.ts:63-84` `observe()` runs the redirect check before it returns a
  price, and throws the failure instead.
- Confidence: `servers/price-tracker/src/extract.ts:9-35` adds `Extracted.confidence` and
  `confidenceOf()`; `:252` json-ld high, `:279` microdata / meta-itemprop high, `:304` opengraph high,
  `:330` data-attr medium, `:343` class hints medium, `:401` regex-fallback low.
  `servers/price-tracker/src/store.ts:15` persists it on every observation.
- Refusal to store: `servers/price-tracker/src/index.ts:90-99` `unstorable()` — a `low` confidence
  reading on a page with no product title is reported but never written. Wired into `watch_add`
  (`:209-210`) and `watch_refresh` (`:331-332`); `price_check` reports it as a `Warning:` line (`:157-158`).
- Exposure: `price_check` prints `Confidence: <level> (source <strategy>)`
  (`servers/price-tracker/src/index.ts:101-103,153`); `watch_add` prints the same line;
  `watchRow` adds `confidence` and `source` (`:123-124`), as does `alerts_pending` (`:462-463`).
- Tests: `servers/price-tracker/test/redirect.test.mjs` (8 unit cases) and three stdio tests in
  `test/smoke.test.mjs` driven by a local http server whose `/p/gone/...` 302s to
  `/cat/products-products/` with the title `Products`.

### D-4 (medium, price-tracker) — the server lost tool selection to a generic web fetch

Rewritten descriptions, `servers/price-tracker/src/index.ts`:
- `price_check` (`:137-141`): "Use this instead of fetching the page yourself: returns the structured
  price, currency, product title, extraction confidence, and the change since the last check; handles
  EU/US number formats and JSON-LD/Open Graph/microdata." plus the redirect guarantee and
  "Reading the raw HTML gives you none of that."
- `watch_add` (`:181-184`), `watch_refresh` (`:304-306`), `alerts_pending` (`:438-441`),
  `watch_list` (`:262`), `price_history` (`:362`) restated in the same concrete terms.

### D-5 (medium, price-tracker) — `watch_add` stored a watch nothing ever checked

- Honesty: `watch_add`'s description and its response now state that checks run only when
  `watch_refresh` runs, that nothing polls the page, and suggest saying "refresh my watches" at the
  start of a session (`servers/price-tracker/src/index.ts:181-184,245-246`).
- `alerts_pending` is now FREE: the `gate.isPro()` early return is gone
  (`servers/price-tracker/src/index.ts:436-448`), and the empty case distinguishes "no watches" from
  "no alerts, refresh first" (`:467-468`).
- New prompt `check_prices` (`servers/price-tracker/src/index.ts:490-514`): list watches, refresh all
  (falling back to per-id on free), read `alerts_pending`, then summarise drops and target hits.
- Free history raised 10 -> 30 observations (`servers/price-tracker/src/index.ts:23`).
  Free watch limit unchanged at 3. Pro keeps unlimited watches, full history and refresh-all.

### D-8 (low, invoice) — no currency on line amounts, silent address-less client

- `servers/invoice/src/pdf.ts:27` — the PDF's `money()` now uses `formatMoney` (code included) rather
  than `formatAmount`; columns re-laid out at `:18-19` so `EUR 1080.00` fits in UNIT and AMOUNT.
  Verified by rendering: UNIT `EUR 90.00`, AMOUNT `EUR 1080.00`, `Tax 23% on EUR 1080.00`,
  `Total EUR 1382.40`, nothing clipped or overlapping.
- `servers/invoice/src/index.ts:55-68` `lineRows()` puts the currency code on every line
  `unit_price` and `amount` in the text response of `invoice_create` (`:283-286`) and
  `invoice_from_hours` (`:317-322`); `summarize()` already coded subtotal, tax, total and balance.
- `servers/invoice/src/index.ts:254-262` — when the invoice's client has no address, the response says
  the BILL TO block will show only the name, whether the client was auto-created from the name alone,
  and gives the exact fix: `client_add {name, address, email, vat_id}` then render the PDF again.
- `overdue_report` is now FREE (`servers/invoice/src/index.ts:414-421`); Pro keeps unlimited invoices,
  no footer, logo and custom prefix.
- Tests: `servers/invoice/test/smoke.test.mjs` — the free-tier lifecycle test now asserts
  `overdue_report` answers with JSON and never mentions Pro, and a new test asserts every money key
  matches `EUR ...`, that no money value starts with a digit, and that the bare-client note appears
  and then disappears once `client_add` supplies an address.

READMEs updated: `servers/price-tracker/README.md` free/pro table (`alerts_pending` free, history 30,
redirect check and confidence rows) plus a new "Alerts: nothing runs in the background" section;
`servers/invoice/README.md` free/pro table (`overdue_report` free) and a money-formatting paragraph.

### Verification (verbatim)

`npm run build -w servers/price-tracker -w servers/invoice` — clean, no output beyond the tsc lines.

`npm test -w servers/price-tracker`:

```
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1848.166958
```

`npm test -w servers/invoice`:

```
# tests 14
# suites 0
# pass 14
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 824.334709
```

`node scripts/validate.mjs`:

```
time-tracker: 18/18 in 217 ms
price-tracker: 18/18 in 256 ms
spreadsheet: 15/16 in 353 ms
invoice: 20/20 in 364 ms
billing: 10/10
validation db: /Users/mike/mcp-servers/data/validation.json run 6: 81/82
```

No probe in `scripts/validate.mjs` needed editing: the price-tracker probe never tested
`alerts_pending` gating and the invoice probe tests the 4th-invoice-per-month gate, which is
unchanged. The single failure is `free: convert 300 rows -> capped 201 lines + upgrade` (301 lines),
which is spreadsheet D-1, owned by the concurrent agent.

## Value fixes 2026-09-02 (spreadsheet, time-tracker)

Four defects from the audit above, fixed in `servers/spreadsheet` and `servers/time-tracker`.

### D-1 (high, spreadsheet) - the free write cap no longer writes a partial file

The cap is now 500 rows (real files are bigger than toy files), and over the cap the tool writes
nothing at all instead of a truncated file that looks complete. The refusal is `isError: false` text
that names the row count, the cap, the upgrade path and a free workaround (filter the rows down first
with `sheet_query`, or write in 500-row batches). The source file is never touched.

- `servers/spreadsheet/src/sheet.ts:10` - `FREE_WRITE_ROWS` 200 -> 500.
- `servers/spreadsheet/src/index.ts:56-68` - `capRows()` (which sliced the data) replaced by
  `writeCapRefusal(rowCount, what, workaround)`, which returns the refusal text or `null`.
- `servers/spreadsheet/src/index.ts:425` (`sheet_write`), `:472` (`sheet_add_column`), `:494`
  (`sheet_convert`) - refuse and return before `writeMatrix`, so zero bytes are written.
- `servers/spreadsheet/README.md:79,82` - free/pro table and the note under it.
- `servers/spreadsheet/test/smoke.test.mjs:203` - the old "capped at 200" test became
  "300 rows write in full, 600 rows write nothing at all": 300 rows -> 301 lines on free,
  600 rows -> refusal text, `existsSync(out) === false` for `sheet_write`, `sheet_convert` and
  `sheet_add_column`, source still 601 lines, and 601 lines on pro.
- `scripts/validate.mjs:81-90` - the spreadsheet probe now expects 301 lines from the 300-row convert
  in both tiers, plus a 600-row convert that is refused with zero bytes on free and 601 lines on pro.

### D-6 (medium, spreadsheet) - `sheet_query` aggregates

`sheet_query` takes `group_by: string[]` and `aggregate: [{col, fn: sum|count|avg|min|max, as?}]`,
`sort` accepts an aggregate alias, and `limit` applies to groups. "Which rep sold the most units in
the North region, top 5" is one call: `where '[Region] = "North"'`, `group_by ["Rep"]`,
`aggregate [{col:"Units", fn:"sum", as:"total_units"}]`, `sort {col:"total_units", dir:"desc"}`,
`limit 5`. `col: "*"` counts rows; `group_by` without `aggregate` defaults to a row count.

- `servers/spreadsheet/src/sheet.ts:149` - `toNumber()` coerces "1,250.00", "$1,250.00",
  "EUR 1.250,00", "(300)" and "12.5%" so text money aggregates correctly.
- `servers/spreadsheet/src/index.ts:192` `aggValue()`, `:211` `groupRecords()`, `:238-330` the
  rewritten `sheet_query` tool (schema, grouping, sort over aggregate aliases, group-aware header line).
- `servers/spreadsheet/README.md:44` - tool table row.
- `servers/spreadsheet/test/query.test.mjs` - new file: `toNumber` coercion (`:68`) and the top-5
  question end to end over stdio (`:80`), plus multi-aggregate, two group columns, default count,
  and clear errors for an unknown group column or sort alias.

### D-3 (high, time-tracker) - money carries its currency

`entry_add`, `timer_start`, `entry_edit` and `project_set_rate` take `currency`, and `rate` /
`hourly_rate` also accept the words the user said ("90 euros an hour"), from which the currency is
parsed (euro/euros/eur, usd/dollars, gbp/pounds, pln/zl and other codes). The currency is stored on
the entry and wins over the project default. Reports, `export_csv` and `invoice_summary` use the
entry currency, group money by currency when a period mixes them ("EUR 225.00 + USD 100.00", one CSV
line per currency) and never print "$" for non-USD. "Log 2.5 hours at 90 euros an hour" answers
`EUR 90.00/h, EUR 225.00`.

- `servers/time-tracker/src/index.ts:25,39` - `currency?` on `Running` and `Entry`.
- `:126` `normCurrency()`, `:143` `parseRate()`, `:180` `currencyForEntry()`, `:186-205` per-currency
  `Amounts` helpers (`addAmount`, `mergeAmounts`, `nonZero`, `moneyOf`, `primaryOf`).
- `:564` `Bucket.amounts` replaces the single `cents`/`currency` pair; `report` (table, json with an
  `amounts` array, csv with one line per currency), `export_csv`, `invoice_summary` and the
  `timetracker://today` resource all read it.
- `:327` `timer_start`, `:404` `entry_add`, `:497` `entry_edit`, `:535` `project_set_rate` - schema
  and handler changes; `entry_add` now prints the rate and the amount.
- `servers/time-tracker/README.md:50,53,57,60` - tool table.
- `servers/time-tracker/test/currency.test.mjs:61,111` - "2.5 hours at 90 euros an hour" -> EUR 225.00,
  mixed EUR/USD kept apart in table, json, csv and export, rates stated in words, and
  `invoice_summary` billing in EUR with no "$" and no "USD" anywhere.

### D-7 (low, time-tracker) - partial project names

`timer_start` and `entry_add` resolve a project name that case-insensitively equals, prefixes or is
contained in exactly one existing project ("Acme" -> "Acme website") and say so in the response. When
two or more match, nothing is logged and the candidates are listed.

- `servers/time-tracker/src/index.ts:206-243` - `knownProjects()`, `resolveProject()`,
  `ambiguousText()`; called at `:330` (`timer_start`) and `:414` (`entry_add`).
- `servers/time-tracker/test/currency.test.mjs:125` - prefix match used and announced, timer too,
  then a second "Acme mobile" project makes "Acme" ambiguous: both candidates listed, nothing written.

### Tool descriptions

Rewritten so a model picks the right tool from natural language: the spreadsheet tools name
"excel", "xlsx", "csv" and point group/sum questions at `sheet_query` ("group by", "sum", aggregate
aliases); the time-tracker tools name "billable", "timesheet", "hours per project" and the currency
behaviour. `servers/spreadsheet/src/index.ts:145,152,238,311,393,482`,
`servers/time-tracker/src/index.ts:319,391,438,589,655,694`.

### Test summaries (verbatim)

`npm test -w servers/spreadsheet`

```
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 846.147625
```

`npm test -w servers/time-tracker`

```
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 379.8385
```

`node scripts/validate.mjs`

```
time-tracker: 18/18 in 236 ms
price-tracker: 18/18 in 255 ms
spreadsheet: 18/18 in 360 ms
invoice: 20/20 in 375 ms
billing: 10/10
validation db: /Users/mike/mcp-servers/data/validation.json run 8: 84/84
```
