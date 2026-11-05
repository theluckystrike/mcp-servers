# MCP estate KPI snapshot, 2026-11-03 (cold, read-only)

Measured 2026-11-03 07:35-08:00 UTC (2026-11-03 07:56 UTC build). Baseline: `data/s1102/kpi.md` (2026-11-02 ~02:30 UTC). Every figure carries the command that produced it; scripts, raw outputs and this build live in `data/s1103/kpi/`. 11-03 is a partial UTC day (~7.7 h). Result: npm finally reports (17,205 downloads, all mirror/scanner-shaped), but no channel shows verified human usage and MCP paid stays $0 (Stripe still locked).

## 0. Headline and deltas vs the 11-02 baseline

| metric | 11-02 baseline | 11-03 | delta | section |
|---|---|---|---|---|
| npm downloads, 68 pkgs, 10-30..11-01 (npm populated through 11-01) | not measurable (0, window ended 10-29) | 17,205 (15,662 / 926 / 617) | measurement now possible; not growth | 1 |
| npm median per package 10-30 / 10-31 / 11-01 | n/a | 203.5 / 14 / 7 | decay to floor 7/day | 1 |
| npm share of downloads on placeholder version `0.0.0-stage` | n/a | 6,835 of 17,205 (39.7%) | scanner/mirror evidence | 1 |
| mcp.zovo.one guard-passing clicks, total | 1020 | 1020 | 0 | 2 |
| ... last 7d / of which known-dead `buy.unknown-product` | 35 / 32 | 26 / 23 | -9 / -9 (window roll, no new clicks) | 2 |
| mcp.zovo.one ordinary successful_business_call, window total | 373 (10-27..11-02 partial) | 379 (10-28..11-03 partial) | +6 | 2 |
| mcp.zovo.one ordinary checkout_handoff, window total | 5 | 5 | 0 (last 10-31) | 2 |
| Workers: 20 satellites invocations 11-02 / 11-03 partial | 9 old only: 753 (11-02 partial 02:30Z) | 24,797 (11-02 full, 20 sats) / 9,012 (11-03 to 07:34Z) | old 9: 753 -> 8,762 (partial -> full day) | 3 |
| Workers: mcp-remote 11-02 / 11-03 partial | 14,235 (partial) | 176,578 / 59,679 | flat ~7.6k/h | 3 |
| GitHub, 65 mirror repos, views / clones (14d) | 254 / 3,864 | 247 / 3,412 | -7 / -452 (14d window roll) | 4 |
| GitHub, original 9 satellites, views / clones (14d) | 8 / 792 | 13 / 996 | +5 / +204 | 4 |
| GitHub, all 20 satellites, views / clones (14d) | n/a | 14 / 1,240 | 11 satellites new | 4 |
| GSC mcpstamp.com, 28d fresh impressions / clicks | 92 / 0 | 200 / 0 | +108 impr, 0 clicks | 5 |
| GSC mcp.zovo.one pages, 28d clicks / impressions | 0 / 37 | 0 / 37 | 0 / 0 | 5 |
| GA4 utm_source=mcp sessions, 28d, 30 properties | 7 | 7 | 0 (all 7: ingredientcalculator.com, 10-30, 0 engaged) | 6 |
| GA4 all-source sessions 28d, same properties | 13,069 (30 props) | 13,831 (30 props) | +762 | 6 |
| Stripe MCP paid | $0 last known (10-30), not re-measurable | not re-measurable (live key invalid) | owner unlock | 7 |

## 1. npm downloads (68 packages)

Commands: `python3 npm.py` = `GET https://api.npmjs.org/downloads/range/2026-10-30:2026-11-03/<pkg>` per package (scoped `/` as `%2F`) plus `GET https://registry.npmjs.org/<pkg>` for `time.created`; `python3 npm_versions.py` = `GET https://api.npmjs.org/versions/<pkg>/last-week`. Raw: `npm.json`, `npm_versions.json`.

Positive control `@modelcontextprotocol/sdk`: `curl https://api.npmjs.org/downloads/point/last-day/@modelcontextprotocol%2Fsdk` now returns 7,867,120 for 2026-11-01..2026-11-01 (on 11-02 the window ended 10-29); explicit range 2026-10-30:2026-11-02 returns 28,961,417 (11-02 baseline: 0). Per day in `range/2026-10-25:2026-11-03`: 10-30 13,292,449, 10-31 7,801,848, 11-01 7,867,120, **11-02 = 0 and 11-03 = 0 (not yet populated, a zero here is NOT a measurement)**. So npm is populated through 2026-11-01 only; our packages were created 2026-10-30 04:05..05:xx UTC (registry `time.created`, 53 in hour 04, 15 in hour 05), so 10-30 is a partial first day.

**Total, 68 packages, 10-30..11-01: 17,205** (10-30 15,662; 10-31 926; 11-01 617). @theluckystrike scope (n=59): 14,394; unscoped satellites (n=9): 2,811. The 11 satellites built on 11-02 are not on npm (`curl https://registry.npmjs.org/<name>` returns `Not found` for all 11; control `cups-to-grams-mcp` resolves, created 2026-10-30T04:05Z), so there is nothing to download.

Top 15 by 10-30..11-01 downloads:

| # | package | 10-30 | 10-31 | 11-01 | total | on `0.0.0-stage` (last-week) | flag |
|---|---|---|---|---|---|---|---|
| 1 | @theluckystrike/mcp-timezone | 490 | 18 | 54 | 562 | 129 (23%) | OUTLIER |
| 2 | @theluckystrike/mcp-license | 394 | 16 | 55 | 465 | 88 (19%) | OUTLIER |
| 3 | no-tax-on-overtime-mcp | 314 | 21 | 5 | 340 | 155 (46%) | mirror band |
| 4 | @theluckystrike/mcp-payroll | 311 | 17 | 7 | 335 | 138 (41%) | mirror band |
| 5 | @theluckystrike/mcp-loan-calculator | 309 | 15 | 8 | 332 | 125 (38%) | mirror band |
| 6 | @theluckystrike/mcp-stripe-billing | 309 | 13 | 6 | 328 | 138 (42%) | mirror band |
| 7 | @theluckystrike/mcp-budget | 305 | 12 | 7 | 324 | 143 (44%) | mirror band |
| 8 | @theluckystrike/mcp-invoice | 283 | 17 | 24 | 324 | 83 (26%) | OUTLIER |
| 9 | minimum-wage-mcp | 303 | 13 | 7 | 323 | 144 (45%) | mirror band |
| 10 | cups-to-grams-mcp | 293 | 16 | 9 | 318 | 147 (46%) | mirror band |
| 11 | @theluckystrike/mcp-petty-cash | 292 | 16 | 7 | 315 | 135 (43%) | mirror band |
| 12 | @theluckystrike/mcp-receipts | 292 | 14 | 7 | 313 | 134 (43%) | mirror band |
| 13 | uk-income-tax-salary-mcp | 294 | 13 | 6 | 313 | 142 (45%) | mirror band |
| 14 | lake-level-mcp | 290 | 15 | 5 | 310 | 146 (47%) | mirror band |
| 15 | @theluckystrike/mcp-tax-calc | 286 | 14 | 8 | 308 | 129 (42%) | mirror band |

**Mirror/scanner noise (not demand).** Every one of the 68 packages got 166..490 downloads on 10-30 (median 203.5, MAD 22.5), 8..21 on 10-31 (median 14) and 4..55 on 11-01 (median 7): one shape, same order of magnitude for a 58-server back-office estate and 9 data satellites alike. 6,835 of 17,205 downloads (39.7%) hit version `0.0.0-stage`, a placeholder created in the first publish minute that no human installs by name; all 68 packages show downloads of it (per-version API). That is registries/mirrors/scanners fetching every version of every new package. Decay 203 -> 14 -> 7 per package per day is the signature of a one-time sweep plus a residual crawler floor.

**Outliers** (robust z: above median + 5 x 1.4826 x MAD on that day):

| package | day: downloads (x median) | stage share | note |
|---|---|---|---|
| @theluckystrike/mcp-timezone | 10-30: 490 (2.4x); 11-01: 54 (7.7x) | 23% | on 11-01 54 vs floor 7; placeholder share well below the 40% norm: more of its downloads are on the real version |
| @theluckystrike/mcp-license | 10-30: 394 (1.9x); 11-01: 55 (7.9x) | 19% | on 11-01 55 vs floor 7; placeholder share well below the 40% norm: more of its downloads are on the real version |
| @theluckystrike/mcp-invoice | 11-01: 24 (3.4x) | 26% | on 11-01 24 vs floor 7; placeholder share well below the 40% norm: more of its downloads are on the real version |
| @theluckystrike/mcp-quotes | 11-01: 21 (3.0x) | 27% | on 11-01 21 vs floor 7; placeholder share well below the 40% norm: more of its downloads are on the real version |

Caveat: npm gives no UA/referrer/geography, so even the outliers (mcp-timezone, mcp-license on both 10-30 and 11-01; mcp-invoice, mcp-quotes on 11-01) are only 'above the mirror floor by 3-8x'. Generic names (timezone, license, invoice, quotes) fit npm-search discovery or one extra scanner; neither is proven. Satellites: none of the 9 unscoped satellite packages is an outlier (totals 294..340 vs median 223.5); no-tax-on-overtime-mcp is #3 only because its 10-30 count is a little higher. Delta vs baseline: baseline had no data; this is the first real read. Re-run `python3 npm.py` on/after 2026-11-05 for 11-02..11-04.

## 2. mcp.zovo.one first-party funnel and clicks

Commands: `curl -s -H 'x-mcp-probe: 1' -A mcp-kpi/1 https://mcp.zovo.one/stats/funnel` (generated_at 2026-11-03T07:42:59.992Z, http 200, complete=true) and `/stats/clicks` (generated_at 2026-11-03T07:43:02.890Z); clicks interpreted with `node scripts/r38-commercial-kpis.mjs data/s1103/kpi/stats_clicks.json`. Raw: `stats_funnel.json`, `stats_clicks.json`, `r38_out.json`. 'ordinary' = unmarked, not proven human; 'probe' = requests carrying x-mcp-probe.

| day (UTC) | offer_view | successful_business_call | first_success_anon_token_day | upgrade_impression | checkout_handoff | probe offer_view | source |
|---|---|---|---|---|---|---|---|
| 2026-10-27 | 278 | 2 | 1 | 2 | 0 | n/a | 11-02 baseline (10-27 fell out of the 7-date window) |
| 2026-10-28 | 915 | 0 | 0 | 0 | 3 | 3052 | 11-03 stats/funnel |
| 2026-10-29 | 614 | 3 | 1 | 3 | 0 | 3054 | 11-03 stats/funnel |
| 2026-10-30 | 549 | 4 | 1 | 4 | 1 | 3052 | 11-03 stats/funnel |
| 2026-10-31 | 651 | 6 | 5 | 6 | 1 | 3053 | 11-03 stats/funnel |
| 2026-11-01 | 482 | 358 | 194 | 287 | 0 | 3064 | 11-03 stats/funnel |
| 2026-11-02 | 948 | 8 | 2 | 1 | 0 | 3115 | 11-03 stats/funnel |
| 2026-11-03 (partial) | 25 | 0 | 0 | 0 | 0 | 1847 | 11-03 stats/funnel |

Delta on overlapping days: 10-28..11-01 identical to baseline; 11-02 was 41 offer_view / 0 calls at 02:30Z and is now 948 / 8 (full day). 11-01 sweep (358 business calls, 194 anon token-days, all `unattributed`) was a single day and has not repeated (11-02: 8, 11-03: 0 so far). **New on 11-02: 7 successful_business_call and 1 first-success anon token with source `oauth`** (all other days are `unattributed`); source labels are unverified declarations, so this is a client that completed an OAuth flow and called tools, not a verified person. Probe cohort: 20,237 offer_views in the window (about 3,050/day, probe-marked: monitors or tests, not customers) and 2 probe checkout_handoffs today (11-03; probe-marked, most likely tests). Ordinary checkout_handoff: 5 in the window, last 10-31, none since.

Clicks (instrument 3): guard-passing total 1020 (baseline 1020, delta 0: **no new counted click in ~29 hours**); last 7d 26 (baseline 35), of which known-dead `buy.unknown-product` 23 (baseline 32) and 3 other (`site.usecase.merge-pdf-in-claude.sticky` 1, `store.bundle` 1, `store.home.table.invoice` 1; unchanged). Unattributed (excluded from totals): total 170 (baseline 170), 7d 2 (baseline 2). Verified buyers: not measurable (null).

## 3. Cloudflare Workers invocations per satellite (all 20, plus mcp-remote)

Command: `python3 cf2.py` = GraphQL `workersInvocationsAdaptive` on account dd3f2a29..., dims scriptName/status/datetimeHour, `scriptName_in` the 20 satellites in `~/mcp-servers/satellites` that have a results JSON + 3 in-progress ones from other lanes + `mcp-remote`, window 2026-10-26T00:00:00Z .. 2026-11-03T07:34:43Z; token from env `CLOUDFLARE_API_TOKEN`. Raw: `cf.json` (per-day/status and per-hour). 11-03 is partial (00:00..07:34Z). Counts include our probes and scanners; no UA/path dimension.

| worker | 11-02 (full) | 11-03 (to 07:34Z) | baseline 11-02 (02:30Z partial) | median req/h, last 24 full hours | launch burst (hour UTC: req) | errors |
|---|---|---|---|---|---|---|
| ab-test-sample-size-calculator-mcp | 1,599 | 1,183 | n/a (deployed 11-02) | 33.5 | 11-02T05: 600 | 0 |
| aca-premium-tax-credit-calculator-mcp | 1,281 | 437 | n/a (deployed 11-02) | 29 | 11-02T05: 643 | 0 |
| ap-score-distributions-mcp | 1,473 | 370 | n/a (deployed 11-02) | 30 | 11-02T05: 599 | 0 |
| car-loan-interest-deduction-calculator-mcp | 1,539 | 1,151 | n/a (deployed 11-02) | 36.5 | 11-02T05: 593, 11-03T06: 816 | 0 |
| cups-to-grams-mcp | 910 | 329 | 105 | 34.5 | 10-30T05: 661 | 0 |
| dscr-loan-calculator-mcp | 858 | 321 | 74 | 32.5 | 10-30T05: 668 | 0 |
| estate-gift-tax-exemption-calculator-mcp | 1,360 | 436 | n/a (deployed 11-02) | 36 | 11-02T05: 656 | 0 |
| gold-price-per-gram-mcp | 849 | 351 | 71 | 35.5 | 10-30T05: 637 | 0 |
| lake-level-mcp | 1,102 | 314 | 85 | 37.5 | 10-30T05: 586 | 0 |
| minimum-wage-mcp | 1,010 | 325 | 85 | 40.5 | 10-30T05: 636 | 0 |
| no-tax-on-overtime-mcp | 915 | 310 | 70 | 31 | 10-30T05: 622 | 0 |
| paycheck-calculator-mcp | 1,009 | 332 | 90 | 38 | 10-30T05: 631 | 0 |
| recipe-nutrition-calculator-mcp | 1,546 | 367 | n/a (deployed 11-02) | 33.5 | 11-02T05: 631 | 0 |
| retirement-contribution-limits-2027-mcp | 1,421 | 447 | n/a (deployed 11-02) | 32 | 11-02T05: 664 | 0 |
| section-179-deduction-calculator-mcp | 1,545 | 403 | n/a (deployed 11-02) | 35.5 | 11-02T05: 618 | 0 |
| student-loan-repayment-assistance-plan-calculator-mcp | 1,356 | 455 | n/a (deployed 11-02) | 32 | 11-02T05: 670 | 0 |
| subdomain-finder-mcp | 1,557 | 380 | n/a (deployed 11-02) | 34.5 | 11-02T05: 616 | 0 |
| uk-income-tax-salary-mcp | 1,014 | 330 | 88 | 37.5 | 10-30T05: 646 | 0 |
| uk-statutory-sick-pay-maternity-pay-calculator-mcp | 1,358 | 427 | n/a (deployed 11-02) | 35.5 | 11-02T05: 667 | 0 |
| us-federal-holidays-business-days-mcp | 1,095 | 344 | 85 | 43 | 10-30T05: 660 | 0 |
| **20 satellites total** | **24,797** | **9,012** | old 9: 753 | | | 0 |
| mcp-remote | 176,578 | 59,679 | 14,235 | 7568 | none | 0 errors; 152 clientDisconnected (baseline 139) |

Reading: (1) every satellite shows exactly one 586..670 req/hour burst in the hour 05:00 UTC after its first deploy (10-30 for the old 9, 11-02 for the 11 new ones), then a flat median of 29..43 req/hour (individual hours 14..115) around the clock with no day/night swing: crawler/monitor shape, same for all 20, no satellite stands out. (2) Old-9 11-02 baseline numbers (70..105) were a 2.5-hour slice; the full day is 849..1,102, i.e. the same ~35-45/h. (3) Two bursts today are not demand: `car-loan-interest-deduction-calculator-mcp` 816 req in hour 06 and `ab-test-sample-size-calculator-mcp` 811 req in hour 07; their source dirs (and gold-price, subdomain-finder) were modified 07:33Z by another lane, so these are most likely that lane's build/test traffic (not verified). (4) Errors on satellites = 0 (clientDisconnected on 5 workers, 1-2 each). 3 satellite dirs created today (`cpi-inflation-calculator-mcp`, `irs-mileage-rate-per-diem-mcp`, `silver-price-per-gram-mcp`) have 0 invocations (not deployed yet) and are excluded from the 20. mcp-remote: median 7.6k requests/hour, flat, 176,578 on 11-02, against 8 ordinary business calls that day.

## 4. GitHub traffic (14-day window)

Command: `python3 gh.py` = `gh api repos/<repo>/traffic/views`, `/traffic/clones`, `/traffic/popular/referrers`, `/traffic/popular/paths`, `repos/<repo>` for 20 satellites (theluckystrike) and the 65 estate mirrors. Raw: `gh.json`. All repos report private=false. Window now ends 11-02 (11-03 not yet reported), so the 14 days roll one day forward relative to the baseline.

| satellite repo | views (uniq) | clones (uniq) | baseline views (uniq) | baseline clones (uniq) | referrers |
|---|---|---|---|---|---|
| ab-test-sample-size-calculator-mcp | 0 (0) | 0 (0) | n/a | n/a | none |
| aca-premium-tax-credit-calculator-mcp | 0 (0) | 0 (0) | n/a | n/a | none |
| ap-score-distributions-mcp | 0 (0) | 0 (0) | n/a | n/a | none |
| car-loan-interest-deduction-calculator-mcp | 1 (1) | 59 (30) | n/a | n/a | none |
| cups-to-grams-mcp | 1 (1) | 129 (72) | 0 (0) | 96 (54) | none |
| dscr-loan-calculator-mcp | 1 (1) | 90 (51) | 1 (1) | 84 (48) | none |
| estate-gift-tax-exemption-calculator-mcp | 0 (0) | 33 (20) | n/a | n/a | none |
| gold-price-per-gram-mcp | 1 (1) | 110 (61) | 1 (1) | 68 (39) | none |
| lake-level-mcp | 1 (1) | 125 (68) | 1 (1) | 115 (63) | none |
| minimum-wage-mcp | 2 (1) | 101 (61) | 1 (1) | 92 (55) | none |
| no-tax-on-overtime-mcp | 2 (2) | 111 (60) | 1 (1) | 83 (48) | none |
| paycheck-calculator-mcp | 1 (1) | 107 (59) | 0 (0) | 82 (49) | none |
| recipe-nutrition-calculator-mcp | 0 (0) | 54 (28) | n/a | n/a | none |
| retirement-contribution-limits-2027-mcp | 0 (0) | 0 (0) | n/a | n/a | none |
| section-179-deduction-calculator-mcp | 0 (0) | 52 (26) | n/a | n/a | none |
| student-loan-repayment-assistance-plan-calculator-mcp | 0 (0) | 46 (25) | n/a | n/a | none |
| subdomain-finder-mcp | 0 (0) | 0 (0) | n/a | n/a | none |
| uk-income-tax-salary-mcp | 1 (1) | 117 (61) | 1 (1) | 92 (50) | none |
| uk-statutory-sick-pay-maternity-pay-calculator-mcp | 0 (0) | 0 (0) | n/a | n/a | none |
| us-federal-holidays-business-days-mcp | 3 (3) | 106 (59) | 2 (2) | 80 (47) | none |

Satellites: 0..3 views each, 0 referrers on all 20, 33..129 clones with 20..72 uniques on the 14 repos that have any, 0 clones on 6 (ab-test, aca-ptc, ap-score, retirement-limits, subdomain-finder, uk-ssp; the newer repos) - clone volume rises with repo age: crawlers, CI, registry/directory ingestion. Original 9: views 8 -> 13, clones 792 -> 996. Top 5 estate mirrors by view uniques:

| repo | views | view uniq | clones | clone uniq | referrers | baseline views/uniq/clones/uniq |
|---|---|---|---|---|---|---|
| theluckystrike/mcp-servers | 120 | 42 | 1735 | 197 | github.com 15, registry.modelcontextprotocol.io 1 | 123/44/1404/199 |
| zovo-one/mcp-price-tracker | 8 | 8 | 12 | 12 | Google 7 | 9/9/14/14 |
| zovo-one/mcp-resume | 12 | 7 | 18 | 17 | none | 10/6/19/18 |
| zovo-one/mcp-spreadsheet | 10 | 7 | 16 | 15 | geminicli.com 1, github.com 1 | 12/7/19/18 |
| zovo-one/mcp-invoice-generator | 23 | 5 | 18 | 13 | geminicli.com 2 | 26/5/22/17 |

65 mirrors: 247 views, 3,412 clones (baseline 254 / 3,864; the clone drop is `bln-mcp-grammar-server` rolling off a 710-clone day, not a trend). Non-github.com referrers across all 85 repos (14d): Google 7, geminicli.com 4, search.brave.com 2, aocr.org 1, registry.modelcontextprotocol.io 1, yandex.ru 1, kagi.com 1. Where: Google 7 on zovo-one/mcp-price-tracker (views on 10-28 1, 10-29 1, 10-30 2, none 10-31..11-01; baseline 8); geminicli.com 4 (mcp-invoice-generator 2, mcp-spreadsheet 1, mcp-barcode 1); search.brave.com 2 (mcp-pdf, mcp-pomodoro), kagi.com 1 (mcp-tax-calc), yandex.ru 1 (mcp-calendar), registry.modelcontextprotocol.io 1 (theluckystrike/mcp-servers), aocr.org 1. Monorepo `theluckystrike/mcp-servers`: views 120 (42 uniq), clones 1,735 (197 uniq), private=false (baseline 123/44, 1,404/199).

## 5. Google Search Console, 28 days

Command: `python3 gsc.py` (`scripts/gsc_tool.py` searchAnalytics/query per property, 67 properties; baseline 66, new: https://frit-app.pages.dev/), final window 2026-10-04..2026-10-31 (dataState=final; final data ends 10-31), fresh window 2026-10-06..2026-11-02 (dataState=all; data ends 11-02). Positive control ingredientcalculator.com: 565 final clicks (baseline 539). Raw: `gsc.json`, `gsc_sitemaps.json` (note: the copied gsc.py sitemap call had a 's1102 typo `mpstamp`' that returned 403 in `gsc.json`; `gsc_sitemaps.py` supersedes it).

| property (satellite money site) | satellites | final clicks / impr | baseline final | fresh clicks / impr | baseline fresh |
|---|---|---|---|---|---|
| sc-domain:ingredientcalculator.com | cups-to-grams | 565 / 259,542 | 539 / 231,399 | 617 / 310,680 | 564 / 274,243 |
| https://goldgramprice.com/ | gold-price-per-gram | 241 / 62,313 | 228 / 59,330 | 255 / 68,226 | 238 / 62,485 |
| https://lakelevelnow.com/ | lake-level | 303 / 30,861 | 310 / 34,129 | 320 / 27,757 | 297 / 25,784 |
| https://statewage.com/ | minimum-wage, paycheck, retirement-limits | 21 / 20,140 | 21 / 19,455 | 22 / 20,473 | 22 / 19,602 |
| sc-domain:recipetool.net | recipe-nutrition | 356 / 19,607 | 357 / 19,551 | 358 / 19,782 | 339 / 18,595 |
| https://taxbreakcalc.com/ | aca-ptc, car-loan, estate-gift | 87 / 13,485 | 84 / 13,194 | 89 / 13,785 | 86 / 13,335 |
| https://assetloancalculator.com/ | section-179 | 40 / 9,178 | 37 / 8,570 | 48 / 10,361 | 40 / 9,260 |
| sc-domain:abwex.com | ab-test | 22 / 1,714 | 22 / 1,683 | 26 / 1,799 | 23 / 1,698 |
| https://examscorecalc.com/ | ap-score | 1 / 1,353 | 1 / 1,317 | 1 / 1,367 | 1 / 1,308 |
| sc-domain:bugbountyreality.com | subdomain-finder | 11 / 5,154 | 11 / 5,344 | 11 / 4,679 | 11 / 4,655 |
| sc-domain:mcpstamp.com | student-loan (free-servers page) + brand | 0 / 55 | 0 / 6 | 0 / 200 | 0 / 92 |
| sc-domain:zovo.one | us-federal-holidays (mcp.zovo.one) + zovo.one | 55 / 2,873 | 56 / 3,065 | 54 / 2,567 | 51 / 2,494 |

No Search Console property for noovertimetax.com, dscrradar.com, ukmoneycalc.com (OWNER UNLOCK, unchanged: add zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com). Money-site traffic (lakelevelnow 303, goldgramprice 241, ingredientcalculator 565, statewage 21 final clicks) predates the MCPs and cannot be attributed to them: GSC never sees UTM.

**mcp.zovo.one** (page filter `//mcp.zovo.one/` inside sc-domain:zovo.one): final 0 clicks / 37 impressions on 6 pages, fresh identical (top: `/` 26, `/mcp/connect` 7); per day 10-20..11-02 impressions: 10-20 1, 10-21 0, 10-22 1, 10-23 1, 10-24 0, 10-25 0, 10-26 0, 10-27 0, 10-28 0, 10-29 1, 10-30 1, 10-31 0, 11-01 1, 11-02 0. Unchanged from baseline.

**mcpstamp.com** (sc-domain, fresh window): impressions per day 10-29 0, 10-30 6, 10-31 49, 11-01 72, 11-02 73 (all 0 clicks); 28d total 200 impressions vs 92 on 11-02 (final window 55 vs 6). First impressions appear on 10-30 and climb to ~72/day by 11-01. Top pages (fresh): /can-claude/read-zip-files/ 52, /developers/ 18, /for/ops-hr/ 14, /use-cases/chase-overdue-invoices/ 14, /servers/supplier-list/ 9. Top queries (fresh): `chase overdue invoices automatically` 13, `can claude open zip files` 10, `can claude read zips` 6, `invoiced to chatgpt` 4, `payroll services norway nok market entry norway claude idea` 4, `ecb calculator` 3.

Sitemaps: mcpstamp.com `https://www.mcpstamp.com/sitemap.xml` submitted 159 (baseline 144), last downloaded 2026-11-03T07:34:03.670Z, errors 0; `mcp.zovo.one/sitemap.xml` submitted 299 (unchanged), downloaded 2026-11-01T09:03:33.382Z. The `indexed` field reads 0 on every sitemap including zovo.one ones that earn clicks, so it is unreliable; impressions are the indexing signal.

## 6. GA4 (28 days)

Commands: `python3 ga4.py` (Analytics Data API `runReport`, service account zovo-gsc-cleanup, sessionSource EXACT `mcp`, 28daysAgo..today, 30 properties), `python3 ga4b.py` (CONTAINS `mcp` on source/medium/campaign), `python3 ga4c.py`, `python3 ga4d.py`. Positive control: ingredientcalculator.com google sessions 591 (baseline 561); hostName control: zovo.one property hostNames 28d = [['zovo.one', '211'], ['(not set)', '1']] (so `mcp.zovo.one` hostName = 0 rows is a real zero; and `curl -s https://mcp.zovo.one/` (200, 116,364 bytes) contains no gtag/googletagmanager/analytics string, so there is no GA tag on that page and GA4 could not see human visits there anyway). Raw: `ga4.json`, `ga4_mcp_detail.json`, `ga4_ingredient_mcp_sessions.json`, `ga4d.json`.

**utm_source=mcp sessions across all 30 properties: 7 (baseline 7, delta 0)**; also zero for any `-mcp` utm_medium besides these: all 7 are ingredientcalculator.com, medium `cups-to-grams-mcp`, 2026-10-30, 4 on `/cups-to-grams` and 3 on `/recipe-converter`, 0 engaged, US desktop Windows Chrome/Edge (property time 06:32-06:33 and 11:57; the property time zone is Europe/Warsaw per `ga4e.py` -> analyticsadmin `properties/555964379` timeZone, so 05:32-05:33 and 10:57 UTC on 10-30, which puts the first group of 5 inside the 05:00 UTC hour in which the cups-to-grams-mcp Worker took its 661-request launch burst; the 11-02 baseline wrote 13:32 / 18:57 UTC, which assumed Los Angeles time and was wrong). No new session since; none for any of the other 19 satellites on any property (lakelevelnow, goldgramprice, statewage, recipetool, assetloancalculator, mcpstamp, zovo.one included). Satellites whose money site has no GA4 property cannot be verified at all (verified with `python3 ga4e.py`: analyticsadmin dataStreams defaultUri of all 30 properties contain none of these six domains): noovertimetax.com, dscrradar.com, ukmoneycalc.com, taxbreakcalc.com, abwex.com, bugbountyreality.com (9 of 20 satellites: no-tax-on-overtime, dscr, uk-income-tax, uk-ssp, aca-ptc, car-loan, estate-gift, ab-test, subdomain-finder). Total sessions 28d 13,831 vs 13,069 baseline.

| property | sessions 28d | baseline | utm_source=mcp | top sources |
|---|---|---|---|---|
| belikenative.com | 3,785 | 3762 | 0 | (direct) 2655, google 730, bing 187 |
| lakelevelnow.com | 2,591 | 2234 | 0 | bing 666, (direct) 614, yahoo 433 |
| ingredientcalculator.com | 1,271 | 1193 | 7 | google 591, (direct) 416, bing 105 |
| englishlearner.org | 1,177 | 1081 | 0 | (direct) 417, chatgpt.com 244, cn.bing.com 168 |
| recipetool.net | 867 | 805 | 0 | google 416, (direct) 261, bing 70 |
| kickllm.com | 839 | 828 | 0 | (direct) 781, bing 29, chatgpt.com 7 |
| ml0x.com | 820 | 837 | 0 | (direct) 301, gpt0x 131, epochpilot 87 |
| goldgramprice.com | 723 | 648 | 0 | (direct) 367, google 304, chatgpt.com 16 |
| notemods.com | 353 | 343 | 0 | (direct) 329, google 14, gemini.google.com 3 |
| makeroll.com | 295 | 295 | 0 | (direct) 192, chatgpt.com 30, google 30 |
| mcpstamp.com | 220 | 193 | 0 | (direct) 211, bing 6, (not set) 1 |
| zovo.one | 212 | 205 | 0 | (direct) 96, checkout.stripe.com 29, chromewebstore.google.com 27 |

**mcpstamp.com sessions by day and source** (`ga4d.py`, property time zone Europe/Warsaw (`ga4e.py`), sessions / engaged): 10-30 bing organic: 1/0; 10-30 direct: 156/2; 10-30 m.facebook.com/referral: 1/0; 10-31 bing organic: 1/0; 10-31 direct: 19/2; 11-01 direct: 15/0; 11-02 (not set)/(not set): 1/0; 11-02 bing organic: 4/0; 11-02 direct: 18/3; 11-03 direct: 3/1; 11-03 google organic: 1/1. Direct dominates (156 sessions on 10-30 with 2 engaged = launch-day scan; 15-19/day after, 0-3 engaged); organic search: bing 1+1+4 sessions (10-30, 10-31, 11-02, 0 engaged) and **1 google organic session on 11-03, engaged**. That one session is the only GA4 event in the estate that is both search-sourced and engaged, and it is n=1.

## 7. Stripe (MCP checkout sessions and paid)

**UNAVAILABLE. Owner unlock.** Command, tried once: `python3 stripe.py` (copied from s1102; first call is `stripe -p worthmyclaim get /v1/checkout/sessions --live -d limit=100 -d created[gte]=<now-7d>`). Result: exit 1, `your live mode API key needs to be re-configured. Run `stripe login` to re-authenticate` (same failure as 11-02 section 5). No `stripe login`, no browser sign-in, no plugin authenticate call. Unlock: owner runs `stripe login` for the live BeLikeNative account, then `python3 data/s1103/kpi/stripe.py`. Last known (2026-10-30 `data/s1030/stripe_raw.json`): MCP paid ever 0, MCP sessions 7d 5, 28d 13. Independent proxy (section 2): ordinary checkout_handoff (the event that creates a session) = 5 in the window, last on 10-31, none since; probe-marked handoffs today: 2 (tests). So any paid MCP order since the snapshot is bounded by 0 ordinary handoffs after 10-31; still unconfirmed without the key.

## 8. Ranked: what shows any signal that is plausibly human

Ranking is by how hard the signal is to explain with bots/our own checks. Nothing here is verified human; all are small.

1. **mcpstamp.com Google/Bing search discovery (channel).** Evidence: GSC impressions 6 (10-30), 49, 72, 73 (11-02), 200 in 28d vs 92; real long-tail queries (`can claude open zip files` 10, `chase overdue invoices automatically` 13, `invoiced to chatgpt` 4) on pages /can-claude/read-zip-files/ 52, /developers/ 18; GA4 1 google-organic ENGAGED session on 11-03 plus 6 bing-organic sessions (0 engaged). Why plausibly human: Impressions come from Google users or indexers issuing real queries; engaged organic session is behavior a scanner rarely shows. Caveats: 0 GSC clicks through 11-02, n=1 engaged session, could be our own test search. Indexing is what is new here.
2. **mcp.zovo.one `oauth` source calls (channel).** Evidence: 11-02: 7 successful_business_call + 1 first-success anon token with source `oauth`; every earlier day is `unattributed`. Why plausibly human: A completed OAuth flow followed by tool calls is what a real MCP client (e.g. a Claude/ChatGPT connector) does; scanners and our probes use `unattributed`/probe. Caveat: source label is an unverified declaration; no offer_view or checkout_handoff accompanies it; one UTC day only.
3. **npm outliers: @theluckystrike/mcp-timezone, mcp-license, mcp-invoice, mcp-quotes (packages).** Evidence: 11-01: 54, 55, 24, 21 downloads vs median 7 (robust outliers); timezone 490 and license 394 on 10-30 vs median 203; stage-placeholder share 19-27% vs 40% overall. Why plausibly human: Excess sits on the real versions, not the scanner-only placeholder, and persists into the third day when the sweep has decayed. Caveat: npm has no UA/referrer; could be one extra scanner or npm-search ranking for generic names.
4. **GitHub search-engine referrals (channel).** Evidence: Google 7 on zovo-one/mcp-price-tracker (views 10-28..10-30, none after); search.brave.com 2 (mcp-pdf, mcp-pomodoro), kagi.com 1 (mcp-tax-calc), yandex.ru 1 (mcp-calendar), geminicli.com 4, registry.modelcontextprotocol.io 1. Why plausibly human: People clicking from a search result land as search-engine referrers; bots rarely send a Referer. Caveat: 1-2 views per day total, all on back-office mirrors, none on any of the 20 satellites (0 referrers), last Google referral 10-30.
5. **cups-to-grams-mcp -> ingredientcalculator.com (satellite).** Evidence: 7 GA4 sessions utm_source=mcp on 10-30 (4 `/cups-to-grams`, 3 `/recipe-converter`), 0 engaged, no new since. Why plausibly human: Only satellite with any downstream landing. Five sessions in two consecutive minutes at 05:32-05:33 UTC (GA4 property time zone is Europe/Warsaw; the 11-02 baseline mis-converted this to 13:32 UTC) and 2 at 10:57 UTC, all 0 engaged, US desktop Windows: the first group lands inside the 05:00 UTC launch-scan hour in which this Worker took 661 requests, so a JS-executing scanner or our own deploy check following the tool-result link is the simplest explanation. Static for 4 days.

**Show none** (each with the check that says so):

- All 20 satellite Workers (invocations): identical 586..670 req/h launch burst at 05:00Z then flat median 29..43/h around the clock, 0 errors; no worker differs from the others (section 3).
- 19 of 20 satellites on GA4: 0 utm_source=mcp sessions in all 30 properties apart from the 7 cups-to-grams sessions (positive control: ingredientcalculator.com google 591 sessions); the money sites with GA4 are lakelevelnow, goldgramprice, statewage, recipetool, assetloancalculator, examscorecalc, mcpstamp; 9 satellites (no-tax-on-overtime, dscr-loan, uk-income-tax, uk-ssp, aca-ptc, car-loan, estate-gift, ab-test, subdomain-finder) have a money site with no GA4 property, so their downstream is unmeasurable, not zero.
- GitHub clones on the 14 satellites that have any (33..129 per repo, 20..72 uniques; 6 have 0) with 0 referrers and 0..3 views: crawler/CI/registry ingestion, not developers.
- npm for the 9 published satellites and the 58 back-office packages: all in the one mirror band (10-30 counts 166..490 across all 68, median 203; 7 median on 11-01); 11 newer satellites are not on npm.
- mcp.zovo.one clicks: 0 new guard-passing clicks since the baseline (1020 -> 1020); 23 of 26 in 7d are the known-dead `buy.unknown-product` route; Google clicks to mcp.zovo.one pages 0 (37 impressions, unchanged).
- mcp-remote (176,578 requests on 11-02): 8 ordinary business calls, 0 ordinary checkout_handoff after 10-31; the 11-01 spike of 358 calls did not repeat.
- Stripe: cannot be read (live key invalid); last known MCP paid = $0.

## Owner unlocks (unchanged unless noted)

- Stripe live read: `stripe login` (live BeLikeNative account), then `python3 data/s1103/kpi/stripe.py`.
- GSC and GA4 for noovertimetax.com, dscrradar.com, ukmoneycalc.com (GSC) and GA4 for taxbreakcalc.com, abwex.com, bugbountyreality.com: add zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com (https://search.google.com/search-console, https://analytics.google.com admin > access management).
- Workers path/UA split: enable Workers Logs (observability) on the satellite workers (config change, not done here).
- GA4 tag on mcp.zovo.one (no gtag in the home page HTML, hostName returns 0 rows with a working control), if page-level human traffic there should ever be measurable.
- npm: re-run `python3 npm.py` on/after 2026-11-05 to read 11-02..11-04.

## Reproduce

`cd data/s1103/kpi && for s in npm.py npm_versions.py cf.py cf2.py gh.py gsc.py gsc_sitemaps.py ga4.py ga4b.py ga4c.py ga4d.py; do timeout 600 python3 $s; done; curl -s -H "x-mcp-probe: 1" -A mcp-kpi/1 https://mcp.zovo.one/stats/funnel -o stats_funnel.json; curl -s -H "x-mcp-probe: 1" -A mcp-kpi/1 https://mcp.zovo.one/stats/clicks -o stats_clicks.json; (cd ~/mcp-servers && node scripts/r38-commercial-kpis.mjs data/s1103/kpi/stats_clicks.json > data/s1103/kpi/r38_out.json); python3 build.py`. Scripts are copies of data/s1102/kpi with output paths, windows (gsc.py), satellite list (cf2.py, gh.py: 20) and sitemap typo adjusted; no s1102 file was modified.
