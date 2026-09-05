# Plan v12 (2026-09-05, loop 15): finish the funnel, re-test the weakest lanes

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 1,762 (1,503 at loop 14 close) | Biggest overnight gain yet; catalog channel accelerating |
| Upgrade link clicks 7d | 20: store.home 15, clauses 2, recurring 1, resume 1, time-tracker 1 | The home page converts attention into checkout clicks; nothing pays |
| Sales | 0 | 20 clicks, 0 payments: the checkout page itself is the next measurement |
| GSC | sitemap fetched daily, 208 submitted, 0 indexed, home "discovered, not indexed", never crawled, 0 impressions | Eleven estate links in; Google still waits. Nothing left to do from the terminal except keep links and content honest |
| Machine load | 6.9, fileproviderd at 128 percent | Launch 4 agents, not 8 |

## Top 5, ranked by impact x autonomy
1. Checkout page inspection: follow a store.home click through to Stripe with a browser-like client, record what the customer sees (product name, price, description, whether the $39 bundle saving is stated, currency, tax text), fix the Checkout Session parameters so the bundle page states "19 servers, lifetime, saves $322" and single-server sessions offer the bundle upsell (Stripe cross-sell or a line in the description). Pass: live session objects show the new text; billing tests.
2. Round 16 hosted re-run: timezone, bank-statement, expense-tracker with the round 15 fixes and url uploads. Pass: scores up or residuals named.
3. Bundle funnel page /bundle: what the nineteen servers do in one table, the connect-by-URL path, the price maths, one CTA tagged store.bundle; linked from the home hero and every s-page. Pass: live, hype grep zero, IndexNow.
4. Round 17: office-suite over stdio as the single-install experience (one .mcpb, 186 tools): does the client find the right tool among 186; measure first-prompt tool reach across six cross-server prompts. Pass: scored; if reach drops below 80 percent, propose grouping.
5. Registry names on capped tokens: honest multi-word names (e.g. invoice-pdf-generator, time-tracking-timer, csv-xlsx-converter) that surface in substring search for the capped single tokens; one per server max. Pass: probe before and after.
Release v0.9.4 only if server sources change.
