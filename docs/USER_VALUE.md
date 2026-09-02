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
