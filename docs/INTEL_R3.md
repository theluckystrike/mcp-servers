# INTEL_R3 — re-measuring the three servers now in build (currency, docx, timezone)

Measured 2026-09-03. Same instruments as docs/INTEL.md: official registry
name-substring counts (`registry.modelcontextprotocol.io/v0/servers?search=`,
full cursor pagination, not the page-size field), Smithery `registry.smithery.ai/servers`
counts + per-query top useCount + per-server tool list via the detail endpoint, npm
`registry.npmjs.org/-/v1/search` (top-250 name-substring count, not the OR'd `total`
field, which the R1 run already found useless — see failures), and GitHub
`gh api search/repositories` totals. Zero paid calls.

## A. Registry name-substring counts (full pagination, total results / unique server names)

| token | total | unique | note |
|---|---|---|---|
| currency | 16 | 11 | |
| exchange | 82 | 42 | |
| rates | 42 | 20 | |
| fx | 87 | 20 | |
| convert | 65 | 31 | |
| docx | 20 | 4 | |
| word | 285 | 64 | |
| document | 98 | 28 | |
| proposal | 2 | 1 | rarest real token found this round |
| contract | 94 | 52 | |
| timezone | 12 | 5 | |
| time-zone | 0 | 0 | hyphenated form never matches; registry search is not tokenized |
| meeting | 12 | 8 | |
| schedule | 18 | 13 | |
| world-clock | 0 | 0 | empty |
| ics | 907 | 252 | FALSE RARITY WARNING: substring match, not word match — catches "statistics", "logistics", "basics" etc; not a real signal of ics-server supply |
| calendar | 90 | 34 | |

Extra tokens checked for naming (see part D): converter 41/21, ecb 33/5, generator 118/44,
scheduler 8/4, slots 0/0, overlap 2/1, keyless 5/2, daily 42/39, rate 197/92, markdown
113/24, template 181/28, templates 1/1 (likely one server with a literal "templates" token,
treat as noise not a trend), writer 27/15, resume 17/11, cv 122/41, cover-letter 0/0,
qr-code 6/2, unit-converter 6/3, mileage 6/1, tax 66/46, vat 194/64.

## B. Smithery counts and top use per query

| query | total servers | top 3 by useCount |
|---|---|---|
| currency | 158 | vdineshk/sg-finance-data-mcp (12254); stockvibes07/exchange-mcp (9701); axel-belfort/currency-converter (4486) |
| exchange | 157 | vdineshk/sg-finance-data-mcp (12254); qbtlabs/openmm-mcp (10546); nexgendata-apify/finance-mcp-server (6135) |
| rates | 176 | vdineshk/sg-finance-data-mcp (12254); capratesignals/cap-rate-signals (6543); axel-belfort/currency-converter (4486) |
| fx | 148 | nexgendata-apify/finance-mcp-server (6135); loved0543/kdata-gate (5352); axel-belfort/currency-converter (4486) |
| convert | 151 | stockvibes07/exchange-mcp (9701); axel-belfort/currency-converter (4486); axel-belfort/screenshot-pdf (4295) |
| docx | 123 | XJTLUmedia2/x24 (5593, job/resume manager, not docx); ali-7ogs/storyflo (4450, unrelated); XJTLUmedia/x23 (3751, unrelated) |
| word document | 171 | kuibin-dev/hsk-mcp (4831, unrelated); linear (3816); re-port-flow/reportflow-mcp (3686, templates->PDF incl. invoices/contracts) |
| docx generator | 181 | axel-belfort/color-palette (4579, unrelated); axel-belfort/crontab-generator (4388, unrelated); re-port-flow/reportflow-mcp (3686) |
| contract | 171 | defi-io/smartcontract (3520, blockchain docs, unrelated); amalgix/document-intelligence (3322); agentbond/mcp-server (3060) |
| timezone | 176 | stockvibes07/meeting-mcp (10853); isdaniel/mcp_weather_server (10680, unrelated); heavysword1/agentflight (6404, unrelated) |
| timezone converter | 159 | stockvibes07/meeting-mcp (10853); isdaniel/mcp_weather_server (10680, unrelated); stockvibes07/exchange-mcp (9701, unrelated) |
| meeting | 175 | googlecalendar (17825); slack (12110, unrelated); stockvibes07/meeting-mcp (10853) |
| schedule | 172 | subwayinfo (22961, unrelated); googlecalendar (17825); stockvibes07/meeting-mcp (10853) |
| world clock | 186 | stockvibes07/meeting-mcp (10853); pipeworx/pipeworx (8926, gateway outlier); sincetomorrow/cultural-intelligence (7407, unrelated) |
| ics calendar | 173 | googlecalendar (17825); support-ix87/onehaus (15223, unrelated home-automation); stockvibes07/meeting-mcp (10853) |
| calendar | 167 | googlecalendar (17825); support-ix87/onehaus (15223, unrelated); stockvibes07/meeting-mcp (10853) |

Finding that repeats from R1: most raw query-volume leaders are name-collisions, not real
competitors (crontab-generator, color-palette, weather, subwayinfo). The genuine
competitors for each of our three servers are a small subset, isolated in Part C.

## C. Top 3 real competitors per server

All seven servers below are Smithery-hosted remotes (`*.run.tools` deploymentUrl) with
zero local/stdio Smithery listing among the leaders — same pattern as R1 (used servers
are hosted products).

### Currency converter (ECB rates)

| # | Server | Use | Tools | Hosted/stdio | Data source | Notes / what to match |
|---|---|---|---|---|---|---|
| 1 | stockvibes07/exchange-mcp | 9701 | 4: get_rate, convert, historical, currencies | hosted (run.tools), x402-billed | ECB, 33 currencies, keyless (no signup/API key), daily update | Match: `historical` tool and an explicit `currencies` list tool — we should ship both, not just convert |
| 2 | axel-belfort/currency-converter | 4486 | 1: finance_convert_currency | hosted (run.tools), x402-billed | ECB (fiat) + CoinGecko (crypto) | Match: crypto cross-rate is a real ask (BTC/ETH alongside fiat) — out of scope for keyless-only but note the demand |
| 3 | ofurkanuygur/tcmb_mcp | 3115 | 6: get_current_rates, get_historical_rates, list_currencies, convert_currency, get_rate_history, compare_currencies | hosted (run.tools) | Turkish Central Bank (TCMB), back to 1996 | Match: `compare_currencies` (multi-pair table) and depth of historical range — TCMB's 6 tools beat exchange-mcp's 4 |

Gap vs us: none of the three ships a `convert_batch` or an offline/cached-rate fallback.
ECB is the right keyless source (daily XML feed, no key, matches exchange-mcp's own
sourcing) — confirms the plan already in place.

### Docx document generator (proposals, contracts, markdown to Word)

| # | Server | Use | Tools | Hosted/stdio | Data source | Notes / what to match |
|---|---|---|---|---|---|---|
| 1 | re-port-flow/reportflow-mcp | 3686 | 5: get_design_parameters, list_templates, generate_pdf_sync, generate_pdfs_async, suggest_params | hosted (run.tools) | User-supplied templates, output PDF not docx | Match: `list_templates` + `suggest_params` (a picker/wizard flow) — no other competitor offers this |
| 2 | @docx-mcp/docx-mcp (npm) | n/a (npm-only, not on Smithery) | not listed | stdio (local npx) | none — pure OOXML read/write, "comprehensive image support" | Match: image embedding inside generated docx |
| 3 | @usejunior/docx-mcp (npm, aka UseJunior/safe-docx on registry) | n/a | not listed | stdio (local npx) | none | Match: tracked-changes editing (surgical edits to an existing .docx, not just generate-from-scratch) and .odt support |

Gap vs us: no competitor combines templated generation (proposals/contracts) with
markdown-to-docx conversion in one server — reportflow-mcp templates but outputs PDF
only; the docx-mcp npm packages edit/read docx but don't do templated
proposal/contract generation. That combination is still open.

### Timezone meeting planner (slots, overlap, ics)

| # | Server | Use | Tools | Hosted/stdio | Data source | Notes / what to match |
|---|---|---|---|---|---|---|
| 1 | stockvibes07/meeting-mcp | 10853 | 6: convert_time, get_holidays, check_business_hours, find_meeting_slots, create_calendar_link, create_event | hosted (run.tools) | IANA tz data + a holiday dataset for 100+ countries | Match: `get_holidays` and `check_business_hours` — both absent from our planned tool list and this is the #1 server in the whole timezone/meeting/calendar cluster |
| 2 | googlecalendar (Arcade-hosted) | 17825 (on `meeting`/`calendar` queries) | 9: CreateEvent, DeleteEvent, FindTimeSlotsWhenEveryoneIsFree, ListCalendars, ListEvents, RespondToEvent, UpdateEvent, WhoAmI, ListApps | hosted, needs a Google account | Google Calendar API (OAuth) | Not a fair local comparison (needs live account credentials) but `FindTimeSlotsWhenEveryoneIsFree` is the exact "overlap" feature we plan — good validation the feature is wanted |
| 3 | axel-belfort/timezone-converter | 2657 | 1: utility_convert_timezone | hosted (run.tools) | Intl/IANA, DST-aware | Minimal single-tool competitor; our planned slots+overlap+ics set is already a superset of this one |

Gap vs us: `find_meeting_slots` (meeting-mcp) and `FindTimeSlotsWhenEveryoneIsFree`
(googlecalendar) both validate the overlap-finder as the load-bearing feature; neither
competitor emits a `.ics` file, which is the one output token (`ics`, part A) that is
completely free of local-namespace competition once the substring noise is filtered.

## D. npm search (top-250 name-substring, `mcp <token>` query, not the OR'd total)

| query | raw npm `total` (OR match, discarded per R1 finding) | packages with both "mcp" and the token in the top 250 |
|---|---|---|
| mcp currency | 112,617 | 2: @alcorme/mcp-currency-converter, @radspaz/mcp-currency-converter |
| mcp docx | 109,151 | 4: @docx-mcp/docx-mcp, @usejunior/docx-mcp, @knorq/docx-mcp-server, docx-forge-mcp |
| mcp timezone | 104,103 | 3: @pipeworx/mcp-timezone, @iflow-mcp/timezone-toolkit, @mukundakatta/timezone-mcp |

Confirms the R1 finding again: `/-/v1/search` totals are a full-text OR match across
100k+ packages and carry no signal; the top-250 substring count is the usable number, and
it stays in single digits for all three tokens — npm is not yet saturated for any of the
three servers.

## E. GitHub repo search (`gh api search/repositories`, total_count)

| query | total_count |
|---|---|
| mcp currency converter | 31 |
| mcp exchange rates | 87 |
| mcp docx generator | 9 |
| mcp word document | 121 |
| mcp timezone | 101 |
| mcp meeting scheduler | 49 |

`mcp docx generator` at 9 is the smallest result set measured across all six queries in
this round — the docx-generation niche (as opposed to docx-editing, which is what the two
npm competitors above actually do) is the least crowded of the three.

## F. Registry name proposals

Method: same as docs/NAMING_RESULT.md — search is a raw substring match on the full
`io.github.theluckystrike/<slug>` name, sorted alphabetically, so a token already carried
by dozens of other servers buys almost nothing once our result sits past the first
screen; a token at 0-2 registry hits buys a rank-1 slot for free. Slugs below mix real
capability words (so the name stays honest and self-documenting) weighted toward the
rarest ones measured in Part A/C.

| server | proposed registry name | slug chars | tokens (registry total each) |
|---|---|---|---|
| currency | `io.github.theluckystrike/currency-converter-ecb-rates-daily-keyless` | 42 | currency(16) converter(41) ecb(33) rates(42) daily(42) keyless(5) |
| docx | `io.github.theluckystrike/docx-document-generator-proposal-contract-markdown` | 50 | docx(20) document(98) generator(118) proposal(2) contract(94) markdown(113) |
| timezone | `io.github.theluckystrike/timezone-world-clock-meeting-slots-overlap-ics` | 46 | timezone(12) world-clock(0) meeting(12) slots(0) overlap(2) ics(907, noisy but a real output format) |

All three describe only capabilities the server actually ships (ECB source, daily
update, no API key; docx/document generation from markdown with proposal and contract
templates; timezone conversion, world-clock, meeting slot-finding, overlap detection,
.ics export) — no token names an unbuilt feature.

`proposal` (2 registry hits) and `slots`/`world-clock` (0 hits each) are this round's
`billable`/`timesheet` equivalents from the R1 rename: near-zero supply, and both are
core, not incidental, features of the server they're attached to.

### 4th candidate for the next round

`resume-cover-letter-docx-generator` — scored the same way as Part A/F:

| token | registry total |
|---|---|
| resume | 17 |
| cv | 122 |
| cover-letter | 0 |
| docx | 20 |
| generator | 118 |

`cover-letter` returns 0 registry hits and `resume` only 17 — both rarer than every token
already spent on the docx server except `proposal`. It is buildable with zero paid APIs
(same OOXML writer the docx server already ships, templated instead of markdown-driven)
and pairs directly with the docx server (shared code) and the contract/proposal
positioning of the office-suite servers. It is not yet in `servers/` and was not on the
R1 Part-B shortlist, so it is a genuinely new slot rather than a re-score of an old one.

Proposed name for that round: `io.github.theluckystrike/resume-cover-letter-docx-generator`
(43 chars) or, spending the `proposal` token again since it is shared code with the docx
server, `resume-cover-letter-proposal-docx-generator` (44 chars).

## RESULT.md schema block

```
status: DONE
evidence: Registry (full cursor pagination, not page-size): 16 tokens counted for the
  three in-build servers, plus 20 naming-candidate tokens. proposal=2, world-clock=0,
  slots=0, cover-letter=0, time-zone=0 are the rarest measured; ics=907 flagged as
  substring noise (statistics/logistics/basics etc), not real ics-server supply.
  Smithery: 16 queries run, top-3 useCount extracted per query; cross-checked against
  each leader's own detail endpoint for a real tool list and hosted/stdio status -
  7 of 7 inspected competitors are Smithery-hosted remotes (*.run.tools), 0 stdio.
  npm: OR-match totals (104k-113k) reconfirmed useless per the R1 finding; replaced with
  top-250 substring counts: mcp+currency=2, mcp+docx=4, mcp+timezone=3 packages.
  GitHub: 6 gh api search/repositories queries, 9-121 total_count; "mcp docx generator"=9
  is the smallest set measured, i.e. least crowded as a generation (not editing) niche.
artifacts: docs/INTEL_R3.md, data/intel_r3.json
cost: 20 wall minutes (hard cap)
failures: registry ?search= page metadata.count is the page size, not a total - had to
  fully paginate every token with a cursor loop to get real totals (same trap R1 avoided
  by doing the same thing; noted here because it is easy to reintroduce by reading
  metadata.count directly). "docx" and "timezone" as bare Smithery queries mostly surface
  unrelated name-collision servers (crontab-generator, color-palette, weather,
  subwayinfo) ranked by raw useCount; had to re-query with "word document"/"docx
  generator"/"timezone converter" and manually filter descriptions to find the 7 real
  competitors used in Part C.
insight: for the docx server specifically, the two real npm competitors (docx-mcp,
  safe-docx) both EDIT existing Word files; the one real hosted competitor
  (reportflow-mcp) templates but only outputs PDF, not docx. Nobody in either measured
  set generates a docx from markdown with a proposal/contract template - that gap is
  still open, and "mcp docx generator" is the least-crowded of the six GitHub queries run
  (9 total_count) supporting the same conclusion from a second instrument.
```
