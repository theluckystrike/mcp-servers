# Traffic reality, loop 32 (2026-09-09) — measurement

Instrument: `node scripts/traffic.mjs --indexation`. Raw output: `data/traffic.json`,
`data/gsc.json`, `data/indexation.json`. Method is `docs/TRAFFIC_R2.md`; it is not re-derived
here, only extended. Comparison baseline: R2, generated `2026-09-08T08:26:39Z`.

Window: **2026-09-02T09:09Z → 2026-09-09T09:09Z**, of which the adaptive dataset holds
`6.882` days for this host (`cloudflare.effective_window`). R2 held 5.852 days from the same
start, so **R3's window is R2's window plus 24.7 hours** and the two are subtractable.
Sitemap: **141 URLs** (126 in R2; the 14 reference guides and `/privacy` landed at
2026-09-08T08:26Z and 08:29Z, three minutes after R2 was stamped).

---

## Job 2 first: the registry referral baseline did not move. It is flat, and the flatness is exact.

**Against the recorded success criterion in `data/traffic.json.registry_referral_baseline`,
nothing has moved. Criterion 1 is unmeasurable today, criteria 2 and 3 are unmet and flat to
the request.**

| # | Recorded criterion | Baseline 2026-09-08 | Now 2026-09-09 | Verdict |
|---|---|---|---|---|
| 1 | `github_side.registry_referrer_unique_visitors_14d` rises above 10 (a real gain is ≥ 15) | 10 | 10 | **UNMEASURABLE — see below** |
| 2 | `storefront_side.requests_from_registry_ecosystem` rises above 30, and `registry.modelcontextprotocol.io` above 8 | 30 / 8 | **30 / 8** | **NOT MET — flat** |
| 3 | The `/s/` pages named by the `com.bestremotetools` server pick up human page views where they had none | `/s/delivery-schedule` = 0 | **0** | **NOT MET — flat** |

Criterion 2 is flatter than "no significant change". R3's window strictly contains R2's, and
the counts are **identical**: `registry.modelcontextprotocol.io` 8, `mcpindex.ai` 8,
`www.mcpi.app` 6, `mcp.ahel.io` 6, `glama.ai` 2. A separate pull over only the 24.7 hours
since the baseline (`--start 2026-09-08T08:26:26Z`) returns the complete referer list

    (none) 39,236 · mcp.zovo.one 737 · www.google.com 33 · verifymcp.io 10 · bing.com 7
    · gateturbo.com 3 · www.stork.ai 1

with **no registry-ecosystem host on it at all**. So the finding is not "flat within noise";
it is **zero registry-referred requests in 24.7 hours**.

**Criterion 1 cannot be judged today, and that is a measurement fact, not a hedge.** GitHub's
traffic API is serving the identical 14-day window it served when the baseline was stamped:
`2026-08-25 → 2026-09-07`, last non-zero day 09-07 with 1 view, totals 48 views / 25 uniques,
referrers `registry.modelcontextprotocol.io` 21/10 and `github.com` 1/1. Every byte of
`github_traffic` in `data/traffic.json` is identical to R2's. Verified independently of the
script:

    $ gh api repos/theluckystrike/mcp-servers/traffic/views
    window 2026-08-25 … 2026-09-07, count 48, uniques 25

GitHub has not advanced its window in 24 hours, so criterion 1 has had no opportunity to
move and a "flat" reading of it would be an artefact. The correct statement is: **the GitHub
side of the baseline is frozen at the baseline's own data; re-read it when the window
advances past 2026-09-07.**

### The reason a flat result is the only honest one: almost nothing has been live long enough

The criterion the predecessor stamped says re-run **on or after 2026-09-15**. This run is
2026-09-09, six days early, and the change list is younger than the gap suggests. Commit
timestamps, converted to UTC:

| Change | Commit | Live at (UTC) | Exposure at window close |
|---|---|---|---|
| 14 reference guides, `/privacy`, sitemap 141, IndexNow resubmit | `3869875`, `3a5b914` | 2026-09-08T08:26Z / 08:29Z | **24.7 h** |
| README opens with a demo and the two working install paths; repo description corrected; topics 10 → 20 | `666ad4e` | 2026-09-09T06:36Z | **2.6 h** |
| Hosted endpoints serve a human page to browsers | `6cbec3d` | 2026-09-09T06:49Z | **2.3 h** |
| Tool descriptions rewritten across all 31 servers | `10c1bc7`, `97ce452` | 2026-09-09T07:31Z / 07:43Z | **1.6 h / 1.4 h** |

Four of the five changes named in the brief were live for between 1.4 and 2.6 hours when the
window closed. The repo change is confirmed live (`gh api repos/…` returns the new
description and exactly 20 topics), the endpoint change is confirmed live (below), and the
sitemap is confirmed at 141. **They are deployed; they have not been exposed.** No instrument
here can attribute a referral to a change that has been public for two hours, so the flat
result is a statement about elapsed time as much as about the work.

---

## Job 1 — the same measures as last time

Run: `node scripts/traffic.mjs --indexation`, exit 0. The day-slicing and the saturation
guard are unchanged and did not fire; largest single day slice 4,054 rows of 10,000 (41%).

### Crawler URL coverage

Over the **same 126-URL set R2 measured**, so the two rounds are directly comparable
(`crawler_url_coverage_previous_set`, `previous_generated_at: 2026-09-08T08:26:39Z`):

| Crawler | R2 (of 126) | R3 (of the same 126) | Direction |
|---|---|---|---|
| ClaudeBot | 126 | 126 | flat, at ceiling |
| Amazonbot | 102 | **125** | up 23 |
| MJ12bot (SEO) | 112 | 112 | flat |
| YandexBot | 112 | 112 | flat |
| SemrushBot (SEO) | 82 | **99** | up 17 |
| GPTBot | 48 | **78** | up 30 |
| meta-externalagent | 66 | 67 | flat |
| bingbot | 35 | 35 | flat |
| Applebot | 4 | **33** | up 29 |
| PerplexityBot | 4 | 5 | flat |
| **Googlebot** | **2** | **2** | flat |
| AhrefsBot | 2 | 2 | flat |

Over the current 141: ClaudeBot 140 (99.3%), Amazonbot 127, YandexBot 113, MJ12bot 112,
SemrushBot 98, GPTBot 90, meta-externalagent 67, bingbot 35, Applebot 33, PerplexityBot 5,
**Googlebot 2 (1.4%)**. The 14 new guides were picked up by ClaudeBot, Amazonbot and GPTBot
within a day; Googlebot took none of them.

**Moved:** GPTBot, Applebot, Amazonbot, SemrushBot. **Did not move:** ClaudeBot (already at
its ceiling), Googlebot, bingbot, YandexBot, MJ12bot, meta-externalagent.

### A correction to a number both R1 and R2 carried: Googlebot's real coverage is 1 URL, not 2

Googlebot's two URLs are `/` (7 requests) and `/s/invoice` (1). Pulling the exact UA strings
and countries behind those rows (`userAgent_like: "%Googlebot%"`, same window):

| Requests | Path | Country | Reading |
|---|---|---|---|
| 3 | `/` | **VN** | Googlebot does not crawl from Vietnam |
| 1 | `/s/invoice` | **PL** | the operator's own country |
| 1 | `/` | **PL** | the operator's own country |
| 3 | `/` | US | plausible, and one of them is confirmed below |
| 6 | `/mcp/{invoice,time-tracker,spreadsheet,token}` | US | contradicted by Search Console, below |

`docs/INBOUND_LINKS_R1.md` records the project's own live-fetch instrument as
`curl -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'`. The two
PL rows are that instrument fetching this host. So **`/s/invoice` has never been fetched by
Googlebot; it was fetched by this project's own verification tooling wearing Googlebot's
name.** Search Console agrees independently: `/s/invoice` has `lastCrawlTime: null`. The
honest Googlebot figure for the whole estate is **one URL, `/`.**

### Render-proven humans — and a defect in that measure that changes the headline

Same discriminator as R1 and R2 (`botScore` is Enterprise-only on this zone).

| Measure | R2 (5.85 d) | R3 (6.88 d) |
|---|---|---|
| Browser-looking UA strings seen | 165 | 253 |
| …of which render-proven | 43 | 53 |
| Render-proven requests | 709 | **1,232** |
| Human page views on sitemap URLs, ex-operator | 321 | **424** |
| …excluding the homepage | **78** | **137** |
| Sitemap URLs with ≥1 such view, ex-homepage | 50 of 125 | **71 of 140** |

Taken at face value that is off-homepage human page views rising from 13.3/day to 19.9/day.
**It is not.** New this round, `render_proven_ua_profile` in `data/traffic.json` profiles each
render-proven UA string by how many *distinct* catalogue URLs it touched and how many
countries it appeared from. A person reads a few pages from one place; a rendering crawler
touches many pages from a proxy pool.

| UA | Distinct sitemap URLs | Off-homepage views | Countries |
|---|---|---|---|
| `…Windows NT 10.0… Chrome/148.0.0.0…` | **53** | 63 | **8** (CN, DE, FR, GB, JP, PL, SG, US) |
| `…Mac OS X 10_15_7… Chrome/150.0.0.0…` | 13 | 12 | 5 (CN, FR, JP, PT, US) |
| `…Mac OS X 10_15_7… Chrome/148.0.0.0…` | 13 | 13 | 2 (CN, SG) |
| `…Mac OS X 10_15_7… Chrome/149.0.0.0…` | 10 | 10 | 5 (CN, DE, HK, NL, US) |

One user-agent string touched 53 of 141 catalogue pages from eight countries in a week.
**18 of the 53 render-proven UA strings appeared from more than one country**, which no
single person does. Two independent filters, and a sensitivity sweep across both:

| Filter | Off-homepage views excluded | Remaining floor (6.88 d) |
|---|---|---|
| none — the number reported above | — | 137 |
| UA touched ≥ 10 distinct URLs | 98 | **39** |
| UA touched ≥ 5 distinct URLs | 118 | 18 |
| UA touched ≥ 3 distinct URLs | 132 | 4 |
| UA seen from > 1 country | 122 | **14** |
| both (single country **and** < 10 URLs) | 123 | **14** |

(The country rows are computed over the 40 UA strings the profile stores in full; they
account for 136 of the 137 views, so the last view sits in an untabulated single-view row.)

The 24.7-hour window is starker still, because a sweep that looks like a week of reading
compresses into one day. Every render-proven UA in that window, by breadth:

    12, 9, 9, 7, 7, 6, 4 distinct URLs  → 54 of the 57 off-homepage views
    every other render-proven UA        → 0 or 1 view each, 3 views in total

So the apparent "56 human page views across 50 catalogue pages yesterday" is **one
distributed rendering-crawler fleet plus about three page views**.

**The corrected reading: off the homepage, this catalogue receives on the order of 14 to 39
human page views per week, not 137, and the strictest defensible floor is 14.** The estate is
more audience-poor than R2 reported, not less. R2's 78 cannot be retro-corrected — the
profile did not exist then — so the R2→R3 comparison above is uncorrected on both sides and
should be read as "the crawler fleet got busier", which it did.

By section (`cloudflare.section_rollup`), uncorrected, ex-operator:

| Section | URLs | Requests | Crawler hits | Human views | R2 human views |
|---|---|---|---|---|---|
| `/` | 1 | 1,206 | 33 | 287 | 243 |
| `/guides/**` | 77 | 2,854 | 368 | 60 | 38 (63 URLs) |
| `/s/**` | 32 | 1,907 | 177 | 54 | 31 |
| `/compare/**` | 20 | 612 | 105 | 7 | 1 |
| `/setup` | 8 | 337 | 59 | 14 | 8 |
| `/bundle`, `/changelog` | 2 | 115 | 21 | 2 | 0 |
| `/privacy` | 1 | 13 | 2 | 0 | — |

### Referer breakdown

| Referer host | R2 (5.85 d) | R3 (6.88 d) | New in the 24.7 h delta |
|---|---|---|---|
| (none) | 92,220 | 131,734 | — |
| `mcp.zovo.one` (self) | 1,182 | 1,933 | — |
| `www.google.com` | 19 | **53** | 33 |
| `verifymcp.io` | — | **10** | 10 |
| `bing.com` | — | **8** | 7 |
| `gateturbo.com` | — | 3 | 3 |
| `www.stork.ai` | — | 1 | 1 |
| `registry.modelcontextprotocol.io` | 8 | **8** | **0** |
| `mcpindex.ai` | 8 | **8** | **0** |
| `www.mcpi.app` | 6 | **6** | **0** |
| `mcp.ahel.io` | 6 | **6** | **0** |
| `glama.ai` | 2 | **2** | **0** |

The only referers that grew are the ones `docs/SEARCH_ARRIVALS_R1.md` already established are
not people (`www.google.com` on URLs Google has never crawled) and MCP directory probes
(`verifymcp.io`, `gateturbo.com`, `www.stork.ai`). Every registry-ecosystem referer is
frozen.

User-initiated assistant fetches — the only measurable proxy for an assistant putting a
person here — did move, from a base of nearly nothing: `Claude-User` 2 → **10**,
`ChatGPT-User` 1 → 1, `PerplexityBot` 19 → 26, `OAI-SearchBot` 17 → 23. Six of the eight new
`Claude-User` fetches went to `/mcp/spreadsheet`. Eight fetches in a day is a real change in
a number that had been stuck at 2, and it is still eight fetches.

### Status mix

Window totals: 200 → 65,287; **401 → 35,788**; **404 → 10,909**; **202 → 6,898**;
303 → 6,236; **504 → 5,034**; 400 → 1,088; 301 → 992; **429 → 888**.

Per calendar day (`cf_status_x_date`; 09-02 and 09-09 are partial):

| Date | 200 | 401 | 404 | 504 | 202 |
|---|---|---|---|---|---|
| 2026-09-05 | 10,526 | 8,332 | 3,151 | 337 | 195 |
| 2026-09-06 | 6,616 | 8,816 | 2,013 | 313 | 49 |
| 2026-09-07 | 3,998 | 8,361 | 1,455 | 1,794 | 0 |
| **2026-09-08** | **17,474** | **3,093** | 1,246 | 1,088 | **3,549** |
| 2026-09-09 (to 09:09Z) | 12,783 | **383** | 293 | 589 | **2,844** |

**The 401s collapsed and 202s replaced them, on the same paths.** R2 reported 401 at
5,945/day and could not reduce it; it is now ~400–3,100/day and falling. In the 24.7-hour
delta the top 401 paths are still `POST /mcp/<server>` (62, 51, 51, 49 …) but the top 202
paths are the *same* endpoints at five times the volume (`POST /mcp/deposits` 322,
`POST /mcp/per-diem` 306, `POST /mcp/billing-docs` 306 …). Probed live:

    POST /mcp/invoice  tools/list, no token          → 200, 13,442 bytes, full tool list
    POST /mcp/invoice  notifications/initialized     → 406 (accept header), 202 when correct
    GET  /mcp/invoice  accept: text/html             → 200 text/html, 4,054 bytes
    GET  /mcp/invoice  no accept header              → 200 application/json, 1,175 bytes

So the metric R2 flagged as immovable did move, but the reading is "the same scanner
population is now being accepted rather than refused", not "fewer clients are failing". Not
measurement's call to judge; reported.

**404s are unchanged in shape** — the `/.well-known/*` discovery files that do not exist,
~1,250/day. **504s did not recover.** R2 flagged a 5.7x spike on 09-07 concentrated on
checkout; two days later `/buy/*` is still timing out (`GET /buy/bundle` 132, and every other
`/buy/` route 20–31, in the last 24.7 h). This is the one operational finding that has
persisted across two rounds without improving. **429 is new**: 888 in the window, all
`POST /mcp/<server>`.

---

## Job 3 — indexation

### Google indexed the first URL this project has ever had, and it is the homepage

| Measure | R2 (126 URLs, 09-08) | R3 (141 URLs, 09-09) |
|---|---|---|
| `verdict: PASS`, in the index | **0** | **1** |
| Ever crawled (`lastCrawlTime` present) | **0** | **1** |
| API errors | 0 | 0 |

    https://mcp.zovo.one/
      verdict           PASS
      coverage_state    Submitted and indexed
      last_crawl_time   2026-09-08T17:20:24Z
      google_canonical  https://mcp.zovo.one/

Cloudflare corroborates from the other side: in the 24.7 hours since R2, Googlebot made
**exactly one** sitemap fetch (`/`) and one `/sitemap.xml` fetch. That single crawl is the
whole event. Nine days after the subdomain went up and two days after the sitemap was cut and
resubmitted, Google has fetched and indexed one page, and 140 of 141 URLs remain uncrawled.

### The discovered/unknown split is not a measurement, and this round proves it

R2 called that split "approximate" after seeing 59/67, 57/68 and 66/60 in one day. Two full
141-URL censuses were run **15 minutes apart** today with the same key:

| Pass | Discovered | Unknown | Indexed | Ever crawled |
|---|---|---|---|---|
| 08:45Z | 121 | 19 | 1 | 1 |
| 09:00Z | 51 | 89 | 1 | 1 |

Per-URL comparison: **82 of 141 URLs (58%) returned a different `coverageState`** — 76 moved
`Discovered → unknown`, 6 moved the other way. Recorded in
`data/indexation.json.split_stability`. **Do not track the split between rounds; track
`in_google_index` and `ever_crawled_by_google`, which were stable in both passes.** Any
report of "discovered rose from 66 to 121" would have been an artefact of which minute the
census ran.

### The hosted `/mcp/<server>` endpoints: Google has not crawled a single one

New this round: the census now covers the hosted endpoints as well as the sitemap. The
endpoint list is taken from the paths actually observed in the Cloudflare log this window
rather than from a hand-written list, so it cannot silently miss one.

| Measure | Result |
|---|---|
| Endpoint URLs inspected | **36** |
| `Submitted and indexed` | 0 |
| `URL is unknown to Google` | **36 of 36** |
| Ever crawled by Google | **0** |

Google does not know these URLs exist. That matters twice over:

1. **The HTML change has had no crawl to benefit from.** It went live at 2026-09-09T06:49Z,
   and no Googlebot fetch of any `/mcp/` URL has happened since — or ever. The pages are
   crawlable (`robots.txt` is `Allow: /`, each carries a self-canonical, `accept: text/html`
   returns 200 text/html), they are simply not in the sitemap and Google has not found them.
2. **It settles the Googlebot rows on those paths.** Cloudflare shows six "Googlebot" fetches
   of `/mcp/invoice`, `/mcp/time-tracker`, `/mcp/spreadsheet` and `/mcp/token` from US IPs.
   Search Console says all four are unknown to Google and never crawled. Google's own records
   beat a self-declared UA string: **those rows are not Googlebot.** This is the same
   conclusion `docs/SEARCH_ARRIVALS_R1.md` reached about the `google.com` referer traffic,
   reached independently on a different signal.

### Google impressions: still zero, now with a control that reaches yesterday

R2's impression probe used `dataState: final`, which lags ~3 days and therefore could not see
the day the homepage was indexed. A second probe was added with `dataState: all` over the
last 10 days:

| Query | Result |
|---|---|
| `//mcp.zovo.one/`, 2026-08-30 → 09-09, `dataState: all` | 10 daily rows, **0 impressions, 0 clicks** |
| Positive control `//zovo.one/`, same query | 10 rows, **1,818 impressions, 17 clicks**, data present through **2026-09-08** |
| `//mcp.zovo.one/`, 28 d, `dataState: final` | 0 rows, 0 impressions |
| `//mcp.zovo.one/`, 480 d | 0 page rows, 0 impressions |
| Property total, 28 d | 59 clicks, 4,746 impressions, 431 page rows |

The control carries data through 2026-09-08, so the zero covers the day of the index entry.
**Indexed, and still zero impressions.**

### Bing, Yandex and the rest: UNMEASURED, unchanged

All three scripted `site:` probes ran with their positive controls and all three controls
returned zero results on a domain that is certainly indexed. Every probe is blind; recorded
`UNMEASURED`, never zero. Unchanged from R2, and unchanged in remedy: Bing Webmaster or
Yandex Webmaster keys, both free, both a human step.

---

## Job 4 — inbound links: 18 of 18 still live, including all four placed yesterday

`data/inbound_links.json` carries 20 expected placements, 18 marked `live` and 2 already
recorded `lost`. Each distinct URL was fetched once with the documented Googlebot UA and the
exact `href="…"` counted with `/usr/bin/grep`, per the file's own `verify_command`.

| Group | Expected | Live now |
|---|---|---|
| Placed 2026-09-08 (`R1_inbound_loop30`): claudhq.com ×2, claudflow.com, bestremotetools.com | 4 | **4** |
| Footer/sitewide (`BACKLINKS_RESULT`, `_R2`, `_R3`): ukmoneycalc ×3, statewage ×3, ml0x, heytensor, kickllm, toolsthatrank, aiwebsitepipeline, lakelevelnow, dscrradar, zovo.one | 14 | **14** |
| Previously recorded lost: deepvalueradar.com, worthmyclaim.com | 0 | 0 (still absent, string not present anywhere in either page) |

**Nothing vanished this round.** Every one of the 18 matched on the *exact* href, so the
tolerant fallback (trailing slash, single quotes) never had to be used, and every host page
returned HTTP 200.

Two placements deserve their status restated rather than assumed safe:

- **`dscrradar.com`** is flagged `fragile` in the data file because it was shipped by a
  live-mirror deploy while the repo is behind live. It is live today. It will disappear the
  moment that repo is deployed, exactly as `worthmyclaim.com` did.
- The four new placements are in **repo source**, which is why they survived: claudhq and
  claudflow are GitHub Pages builds from committed commits (`739f229`, `a1b17a8`) and
  bestremotetools is a git-connected Cloudflare Pages build (`de01820`). The failure mode
  that killed the earlier two — writing into build output — was not repeated.

Referer evidence that these links carry traffic is thin but non-zero and unchanged:
`www.statewage.com` 4, `zovo.one` 3, `statewage.com` 1, `worthmyclaim.com` 1 in 6.88 days.
None of the four new placements has produced a referred request yet, which at one day old is
expected rather than informative.

---

## What is unmeasured, and why

- **Criterion 1 of the registry experiment**, until GitHub advances its traffic window past
  2026-09-07. Nothing free can force it.
- **Assistant answers.** Unchanged from R2: no log records whether ClaudeBot's coverage turns
  into a recommendation inside a conversation.
- **Bing / Yandex / Seznam / Naver index membership.** All scripted probes blind, controls
  fail. Needs a Webmaster key, a human step.
- **Whether the four sweeper UAs are one operator or several.** Cloudflare's free plan gives
  no ASN or IP dimension here, so breadth and country count are the only discriminators
  available. Both point the same way; neither identifies the actor.
- **Which humans came from where.** Referer and userAgent are separate groupings on this
  plan, so "render-proven humans referred by the registry" still cannot be computed.
- **Anything before 2026-09-02T12:00Z on this host.** Retention, unchanged.

## Instrument changes made this round

All in `scripts/traffic.mjs`; the R2 guards are intact and none were weakened.

1. `inspectCensus()` factored out of `indexation()`, so any URL list can be censused with the
   same retry behaviour. Used for a second census over the hosted `/mcp/<server>` endpoints,
   whose paths are read from the Cloudflare log rather than hand-listed.
2. `indexation.json` now reads the file it is about to overwrite and records `previous_run`
   and `movement`, so the between-round delta lives in the artefact.
3. `render_proven_ua_profile` — per-UA distinct-URL breadth, country count, page views, and
   the ex-sweeper floors. This is the change that corrected the headline human number.
4. GSC `fresh_probe` — a `dataState: all` window over the last 10 days with its own positive
   control, because `dataState: final` structurally cannot see the last three days.
5. The write guard was hit again and worked: the GSC key went iCloud-dataless mid-session,
   the run refused to overwrite `data/gsc.json` and `data/indexation.json` with a DOWN
   extract, and `brctl download` plus roughly four minutes of waiting recovered it. The guard
   was not weakened.

## Re-running this

```
node scripts/traffic.mjs                       # 7d window, both channels, UA profile
node scripts/traffic.mjs --indexation          # + URL Inspection: 141 sitemap + 36 endpoints
node scripts/traffic.mjs --start 2026-09-08T08:26:26Z --out /tmp/since.json --no-gsc
```

External calls this round: 2 full 141-URL sitemap censuses plus 1 × 36 endpoint URLs
(URL Inspection, free, 2,000/day quota), ~40 Cloudflare GraphQL queries across four windows,
16 inbound-link page fetches, 5 GitHub API calls and 8 live probes of the host.

**Durable risk, hit for the third session running:** the GSC key at
`~/Desktop/keys/gsc-sa-key.json` is on iCloud Desktop and goes dataless without warning. See
`docs/HUMAN_GATED_PACK.md`.
