# MCP estate KPI baseline, 2026-11-02 (read-only)

Measured 2026-11-02 ~02:30 UTC. Every figure carries its command; scripts and raw outputs in `data/s1102/kpi/`. Summary: no channel shows verified human usage. The only non-zero signals are 7 unengaged GA4 sessions (cups-to-grams, 10-30), 8 Google-referred GitHub views on zovo-one/mcp-price-tracker, and automated Worker traffic.

## 1. npm downloads (68 packages)

Command: `GET https://api.npmjs.org/downloads/point/{last-week|last-day}/<pkg>` (scoped `/` as `%2F`), script `npm.py`. Served window last-week = 2026-10-23..2026-10-29, last-day = 2026-10-29..2026-10-29.

**Result: sum last-week = 0, last-day = 0, but this is NOT a measurement.** The npm API window ends 2026-10-29, before the 2026-10-30 publish. Positive control `@modelcontextprotocol/sdk`: last-week 87,026,138, last-day 14,820,372 (window ends 10-29), but explicit ranges `2026-10-30:2026-11-02` return 0 for it as well, so npm has not populated any data after 10-29. Re-run `npm.py` on/after 2026-11-04.

Top 15 (all tied at 0; order is list order, shown for completeness):

| # | package | last-week | last-day |
|---|---|---|---|
| 1 | @theluckystrike/mcp-amortization | 0 | 0 |
| 2 | @theluckystrike/mcp-asset-register | 0 | 0 |
| 3 | @theluckystrike/mcp-backlink-checker | 0 | 0 |
| 4 | @theluckystrike/mcp-bank-statement | 0 | 0 |
| 5 | @theluckystrike/mcp-barcode | 0 | 0 |
| 6 | @theluckystrike/mcp-bill-of-sale | 0 | 0 |
| 7 | @theluckystrike/mcp-billing-docs | 0 | 0 |
| 8 | @theluckystrike/mcp-budget | 0 | 0 |
| 9 | @theluckystrike/mcp-calendar | 0 | 0 |
| 10 | @theluckystrike/mcp-cash-book | 0 | 0 |
| 11 | @theluckystrike/mcp-catalogue | 0 | 0 |
| 12 | @theluckystrike/mcp-change-order | 0 | 0 |
| 13 | @theluckystrike/mcp-checklist | 0 | 0 |
| 14 | @theluckystrike/mcp-clauses | 0 | 0 |
| 15 | @theluckystrike/mcp-credit-note | 0 | 0 |

## 2. Cloudflare Workers invocations, per UTC day (last 7 days)

Command: GraphQL `workersInvocationsAdaptive` on account dd3f2a29..., filtered `scriptName_in`, dims scriptName/status/datetimeHour, token from env `CLOUDFLARE_API_TOKEN` (analytics scope works; no unlock needed). Script `cf2.py`. Counts include our probes and scanners; no UA/path dimension exists.

| worker | 10-26 | 10-27 | 10-28 | 10-29 | 10-30 | 10-31 | 11-01 | 11-02 | 7d total | statuses |
|---|---|---|---|---|---|---|---|---|---|---|
| gold-price-per-gram-mcp | 0 | 0 | 0 | 0 | 1,748 | 1,042 | 956 | 71 | 3,817 | success 3,817 |
| dscr-loan-calculator-mcp | 0 | 0 | 0 | 0 | 1,864 | 1,168 | 1,053 | 74 | 4,159 | success 4,159 |
| uk-income-tax-salary-mcp | 0 | 0 | 0 | 0 | 1,774 | 969 | 1,006 | 88 | 3,837 | success 3,837 |
| cups-to-grams-mcp | 0 | 0 | 0 | 0 | 1,835 | 1,039 | 969 | 105 | 3,948 | success 3,948 |
| us-federal-holidays-business-days-mcp | 0 | 0 | 0 | 0 | 1,989 | 1,331 | 1,199 | 85 | 4,604 | success 4,604 |
| paycheck-calculator-mcp | 0 | 0 | 0 | 0 | 1,840 | 1,213 | 1,140 | 90 | 4,283 | success 4,281, clientDisconnected 2 |
| no-tax-on-overtime-mcp | 0 | 0 | 0 | 0 | 1,649 | 928 | 935 | 70 | 3,582 | success 3,582 |
| minimum-wage-mcp | 0 | 0 | 0 | 0 | 1,876 | 1,192 | 1,155 | 85 | 4,308 | success 4,307, clientDisconnected 1 |
| lake-level-mcp | 0 | 0 | 0 | 0 | 1,482 | 1,203 | 1,121 | 85 | 3,891 | success 3,890, clientDisconnected 1 |
| mcp-remote | 118,488 | 149,775 | 157,075 | 168,160 | 168,293 | 164,150 | 189,679 | 14,235 | 1,129,855 | success 1,129,716, clientDisconnected 139 |

11-02 is partial (~02:30 UTC). Satellites deployed 10-30: first day has a ~600 req/hour burst at 05:00 UTC (launch scan), then a flat 25-90/hour around the clock, the shape of crawlers/monitors. Satellite errors = 0. mcp-remote runs about 150k requests/day, of which Google gave 0 clicks and the ordinary business-call funnel (section 7) is ~5/day: it is overwhelmingly bots. Owner unlock for a path/UA/tool split: enable Workers Logs (observability) on the workers.

## 3. GitHub traffic (14-day window)

Command: `gh api repos/<repo>/traffic/views|clones|popular/referrers`, script `gh.py`.

Satellites (theluckystrike):

| repo | views | view uniques | clones | clone uniques | referrers |
|---|---|---|---|---|---|
| cups-to-grams-mcp | 0 | 0 | 96 | 54 | none |
| dscr-loan-calculator-mcp | 1 | 1 | 84 | 48 | none |
| gold-price-per-gram-mcp | 1 | 1 | 68 | 39 | none |
| lake-level-mcp | 1 | 1 | 115 | 63 | none |
| minimum-wage-mcp | 1 | 1 | 92 | 55 | none |
| no-tax-on-overtime-mcp | 1 | 1 | 83 | 48 | none |
| paycheck-calculator-mcp | 0 | 0 | 82 | 49 | none |
| uk-income-tax-salary-mcp | 1 | 1 | 92 | 50 | none |
| us-federal-holidays-business-days-mcp | 2 | 2 | 80 | 47 | none |

Top 5 estate repos by view uniques (of 65 pulled; the per-server mirrors live under zovo-one, theluckystrike/mcp-servers is the monorepo):

| repo | views | view uniques | clones | clone uniques | referrers |
|---|---|---|---|---|---|
| theluckystrike/mcp-servers | 123 | 44 | 1404 | 199 | github.com 15, registry.modelcontextprotocol.io 1 |
| zovo-one/mcp-price-tracker | 9 | 9 | 14 | 14 | Google 8 |
| zovo-one/mcp-spreadsheet | 12 | 7 | 19 | 18 | geminicli.com 1 |
| zovo-one/mcp-resume | 10 | 6 | 19 | 18 | none |
| zovo-one/mcp-invoice-generator | 26 | 5 | 22 | 17 | geminicli.com 2 |

All 65 estate repos: 254 views, 3864 clones in 14 days. Satellites: 0-2 views each, 68-115 clones with 39-63 uniques = crawlers/CI, not developers. The only Google-referred human-looking traffic: zovo-one/mcp-price-tracker, 8 views from Google. Note: `theluckystrike/mcp-servers` reports private=false via `gh api repos/theluckystrike/mcp-servers --jq .private`, while BRIEF.md calls it private.

## 4. Google Search Console, 28 days

Command: `python3 scripts/gsc_tool.py sites` (66 properties), then searchAnalytics/query per property (`gsc.py`); final window 2026-10-03..10-30, fresh window (dataState=all) 2026-10-06..11-02. Positive control: ingredientcalculator.com 539 clicks.

| property | clicks (final) | impr (final) | clicks (fresh) | impr (fresh) |
|---|---|---|---|---|
| sc-domain:ingredientcalculator.com | 539 | 231399 | 564 | 274243 |
| https://ingredientcalculator.com/ | 537 | 231204 | 562 | 274044 |
| sc-domain:belikenative.com | 695 | 237000 | 646 | 226164 |
| https://goldgramprice.com/ | 228 | 59330 | 238 | 62485 |
| https://lakelevelnow.com/ | 310 | 34129 | 297 | 25784 |
| https://statewage.com/ | 21 | 19455 | 22 | 19602 |
| sc-domain:recipetool.net | 357 | 19551 | 339 | 18595 |
| https://recipetool.net/ | 357 | 19550 | 339 | 18594 |
| https://taxbreakcalc.com/ | 84 | 13194 | 86 | 13335 |
| https://assetloancalculator.com/ | 37 | 8570 | 40 | 9260 |
| https://bugbountyreality.com/ | 11 | 5344 | 11 | 4655 |
| sc-domain:bugbountyreality.com | 11 | 5344 | 11 | 4655 |
| sc-domain:notemods.com | 22 | 2756 | 23 | 2993 |
| sc-domain:gpt0x.com | 8 | 2783 | 7 | 2608 |
| sc-domain:aiwebsitepipeline.com | 2 | 2629 | 2 | 2588 |
| sc-domain:zovo.one | 56 | 3065 | 51 | 2494 |
| sc-domain:kickllm.com | 11 | 2621 | 11 | 2416 |
| sc-domain:englishlearner.org | 142 | 2293 | 142 | 2290 |
| sc-domain:abwex.com | 22 | 1683 | 23 | 1698 |
| sc-domain:ml0x.com | 39 | 1695 | 33 | 1615 |
| sc-domain:enhio.com | 4 | 1601 | 4 | 1593 |
| https://examscorecalc.com/ | 1 | 1317 | 1 | 1308 |
| sc-domain:claudflow.com | 38 | 1178 | 37 | 1151 |
| https://worthmyclaim.com/ | 1 | 1036 | 1 | 965 |
| https://handsofflinks.com/ | 0 | 727 | 0 | 783 |
| sc-domain:b2berp.com | 2 | 851 | 2 | 778 |
| sc-domain:writingassistant.org | 0 | 616 | 0 | 618 |
| sc-domain:deepvalueradar.com | 0 | 524 | 0 | 536 |
| sc-domain:krzen.com | 23 | 508 | 16 | 496 |
| sc-domain:gen8x.com | 1 | 454 | 1 | 492 |
| sc-domain:addthisbot.com | 9 | 202 | 15 | 471 |
| sc-domain:paraphrasetool.org | 7 | 480 | 7 | 440 |
| sc-domain:dismissticket.com | 1 | 454 | 1 | 398 |
| sc-domain:toolroutine.com | 0 | 387 | 0 | 388 |
| https://toolroutine.com/ | 0 | 387 | 0 | 388 |
| sc-domain:epochpilot.com | 1 | 359 | 0 | 371 |
| https://toolsthatrank.com/ | 0 | 320 | 0 | 296 |
| https://makeroll.com/ | 38 | 271 | 32 | 251 |
| sc-domain:grammarhelper.org | 7 | 249 | 7 | 228 |
| sc-domain:lockml.com | 0 | 255 | 0 | 226 |
| sc-domain:ml3x.com | 29 | 174 | 46 | 203 |
| https://welikeremotestack.com/ | 1 | 212 | 1 | 193 |
| https://claudhq.com/ | 3 | 176 | 3 | 170 |
| sc-domain:claudhq.com | 3 | 176 | 3 | 170 |
| https://pictureeditor.net/ | 0 | 170 | 0 | 163 |
| sc-domain:pictureeditor.net | 0 | 170 | 0 | 163 |
| sc-domain:earlythunder.com | 0 | 149 | 0 | 134 |
| https://deepvalueradar.com/ | 0 | 96 | 0 | 126 |
| sc-domain:heytensor.com | 0 | 135 | 0 | 126 |
| sc-domain:mcpstamp.com | 0 | 6 | 0 | 92 |
| sc-domain:lochbot.com | 2 | 68 | 2 | 60 |
| https://iamvivi.com/ | 0 | 51 | 0 | 51 |
| sc-domain:kappafy.com | 1 | 39 | 1 | 39 |
| sc-domain:neovistainc.com | 3 | 34 | 2 | 33 |
| sc-domain:seeninaianswers.com | 0 | 28 | 0 | 30 |
| https://securetoolsguide.com/ | 0 | 18 | 0 | 18 |
| sc-domain:invokebot.com | 0 | 17 | 0 | 17 |
| https://bestremotetools.com/ | 0 | 10 | 0 | 13 |
| sc-domain:claudkit.com | 1 | 11 | 2 | 11 |
| https://chrometipsguide.com/ | 0 | 13 | 0 | 10 |
| https://tg.zovo.one/ | 0 | 8 | 0 | 8 |
| https://tgtools-site.lipmichal.workers.dev/ | 0 | 9 | 0 | 8 |
| sc-domain:viryd.com | 0 | 7 | 0 | 7 |
| https://bestchromeextensions.com/ | 0 | 6 | 0 | 6 |
| sc-domain:bestchromeextensions.com | 0 | 6 | 0 | 6 |
| sc-domain:boldtake.io | 403 | | | |

mcp.zovo.one (page filter `//mcp.zovo.one/` inside sc-domain:zovo.one): final 0 clicks / 37 impressions on 6 pages (top: / 26, /mcp/connect 7); fresh window identical. mcpstamp.com: 0 clicks, 6 impr final / 92 impr fresh (top page /can-claude/read-zip-files/ 17, /developers/ 14; queries all 1-5 impressions, e.g. `chase overdue invoices automatically` 5). Satellite money sites: lakelevelnow.com 310 clicks, goldgramprice.com 228, statewage.com 21, ingredientcalculator.com 539, all pre-existing organic traffic that predates the MCPs. noovertimetax.com, dscrradar.com, ukmoneycalc.com have NO property visible to the service account (OWNER UNLOCK: add zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com).

Sitemaps (mcpstamp.com): https://www.mcpstamp.com/sitemap.xml submitted 144, indexed 0, errors 0, last downloaded 2026-11-01T14:11Z. mcp.zovo.one/sitemap.xml submitted 299, indexed 0. Caveat: the sitemap `indexed` field reads 0 on every sitemap, including zovo.one ones whose property earns clicks, so it is unreliable; use impressions as the indexing signal.

## 5. Stripe (MCP checkout sessions and paid, 7 and 28 days)

**UNAVAILABLE today. Owner unlock.** Method (same as r38/audit scripts: Stripe live `GET /v1/checkout/sessions`, MCP = success_url host mcp.zovo.one) was attempted with `stripe -p worthmyclaim get /v1/checkout/sessions --live ...` and with the key in `~/.config/stripe/worthmyclaim.toml`: HTTP 401 Invalid API Key; the CLI asks for `stripe login` (default profile is sandbox only). Did not re-login (no browser sign-in). Unlock: run `stripe login` for the live BeLikeNative account, then `python3 data/s1102/kpi/stripe.py`.

Last known (2026-10-30 snapshot, `data/s1030/stripe_raw.json`, not re-measured): MCP sessions 7d = 5 (2 probes, 3 untagged expired), 28d = 13; MCP paid ever = 0; account-wide paid 28d = 17 (other products). Independent proxy today: `curl -H 'x-mcp-probe: 1' https://mcp.zovo.one/stats/funnel` shows checkout_handoff (the event that creates a session) = 5 in 7 days, last 2026-10-31, so any new session would be at most 1-2 since the snapshot; unconfirmed.

## 6. GA4 (utm_source=mcp, 28 days)

Access exists: service account zovo-gsc-cleanup with scope analytics.readonly sees 30 GA4 properties (accountSummaries); Data API runReport works (positive control: ingredientcalculator.com google 561 sessions). Filter sessionSource = mcp, then CONTAINS mcp on source/medium/campaign (`ga4.py`, `ga4b.py`).

| property | sessions 28d | utm_source=mcp sessions |
|---|---|---|
| belikenative.com | 3762 | 0 |
| lakelevelnow.com | 2234 | 0 |
| ingredientcalculator.com | 1193 | 7 |
| englishlearner.org | 1081 | 0 |
| ml0x.com | 837 | 0 |
| kickllm.com | 828 | 0 |
| recipetool.net | 805 | 0 |
| goldgramprice.com | 648 | 0 |
| notemods.com | 343 | 0 |
| makeroll.com | 295 | 0 |
| zovo.one | 205 | 0 |
| mcpstamp.com | 193 | 0 |

Total utm_source=mcp sessions across all 30 properties: 7. All on ingredientcalculator.com, utm_medium=cups-to-grams-mcp, 2026-10-30 (landing /cups-to-grams 4, /recipe-converter 3), 0 engaged sessions, US desktop Windows Chrome/Edge, 5 within one minute at 13:32 UTC and 2 at 18:57 UTC. That is the launch-day click-through of the tool-result link; plausibly a scanner or our own check, not proven human. mcp.zovo.one hostName returned no GA4 rows. lakelevelnow, goldgramprice, statewage and mcpstamp.com: 0 mcp sessions. noovertimetax.com, dscrradar.com, ukmoneycalc.com have no GA4 property (OWNER UNLOCK).

## 7. Extra: mcp.zovo.one first-party funnel (public aggregate, x-mcp-probe header)

Command: `curl -s -H 'x-mcp-probe: 1' -A mcp-revenue-audit/1 https://mcp.zovo.one/stats/funnel` and `/stats/clicks`; clicks interpreted with `node scripts/r38-commercial-kpis.mjs stats_clicks.json`.

| day | offer_view | successful_business_call | first_success_anon_token_day | upgrade_impression | checkout_handoff |
|---|---|---|---|---|---|
| 2026-10-27 | 278 | 2 | 1 | 2 | 0 |
| 2026-10-28 | 915 | 0 | 0 | 0 | 3 |
| 2026-10-29 | 614 | 3 | 1 | 3 | 0 |
| 2026-10-30 | 549 | 4 | 1 | 4 | 1 |
| 2026-10-31 | 651 | 6 | 5 | 6 | 1 |
| 2026-11-01 | 482 | 358 | 194 | 287 | 0 |
| 2026-11-02 | 41 | 0 | 0 | 0 | 0 |

'ordinary' = unmarked, not proven human. 2026-11-01 jumped from ~5 to 358 business calls and 194 anonymous token-days, all source 'unattributed', with no matching rise in offer_view or checkout_handoff: one sweep (scanner, registry validator or another agent session), unverified. Clicks: total guard-passing 1020, last 7d 35, of which 32 are known-dead `buy.unknown-product`, 3 other; verified buyers: not measurable (null).

## Ranking of channels by evidence of real usage

1. None verified. 2. GA4 7 unengaged mcp sessions on ingredientcalculator.com (10-30). 3. GitHub: Google-referred views on zovo-one/mcp-price-tracker (8). 4. mcp-remote business calls (373 in 7d, 358 on one day). 5. Worker satellites: flat automated baseline. 6. npm: unmeasurable until 2026-11-04. 7. Stripe: unmeasurable today (key invalid); last known MCP paid = $0.

## Owner unlocks

- Stripe live read: `stripe login` (BeLikeNative live account) or restricted read key; then run `data/s1102/kpi/stripe.py`.
- GSC/GA4 for noovertimetax.com, dscrradar.com, ukmoneycalc.com: add zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com at https://search.google.com/search-console and https://analytics.google.com (admin > access management).
- Workers path/UA split: enable Workers Logs on satellite workers (config change, not done here).
- npm: re-measure on/after 2026-11-04.

