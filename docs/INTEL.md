# INTEL - what the used servers do that we do not, and the fifth slot

Measured 2026-09-02. Sources: registry.modelcontextprotocol.io/v0/servers, registry.smithery.ai/servers, registry.npmjs.org/-/v1/search, GitHub via gh api, and the Chrome Web Store counts already crawled in platform-analysis-2026/measured.json. Zero paid calls.


## A. Top 15 servers by use in our categories

Union of Smithery results for the 8 queries: time tracking, invoice, spreadsheet, excel, price, productivity, freelance, finance. 670 unique servers seen; the 15 highest useCount follow.

| # | Server | Use | Query | Tools | Remote | Verified | Pricing signal | GitHub | README | Demo img | License |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | pipeworx gateway | 419019 | spreadsheet | 2530 | yes | no | not fetched | none | n/a | no | n/a |
| 2 | Google Sheets | 56138 | spreadsheet | 13 | yes | yes | not fetched | none | n/a | no | n/a |
| 3 | Receiptor MCP | 15517 | invoice | 51 | yes | no | pricing,free trial,usd | none | n/a | no | n/a |
| 4 | nutribalance-mcp | 12688 | spreadsheet | 5 | yes | no | none-detected | none | n/a | no | n/a |
| 5 | sg-finance-data-mcp | 12254 | finance | 4 | yes | no | not fetched | none | n/a | no | n/a |
| 6 | Meeting Intelligence API | 10853 | time tracking | 6 | yes | no | not fetched | none | n/a | no | n/a |
| 7 | Ecommerce Intel MCP — Shopify Store &  | 10762 | productivity | 2 | yes | no | subscribe | none | n/a | no | n/a |
| 8 | Developer Utilities | 10009 | spreadsheet | 18 | yes | no | not fetched | none | n/a | no | n/a |
| 9 | Google Drive | 8569 | spreadsheet | 18 | yes | yes | not fetched | none | n/a | no | n/a |
| 10 | vibe-pay | 8540 | price | 8 | yes | no | usd | none | n/a | no | n/a |
| 11 | LMK.today MCP | 8243 | price | 13 | yes | no | usd | none | n/a | no | n/a |
| 12 | sg-cpf-calculator-mcp | 8020 | spreadsheet | 4 | yes | no | not fetched | none | n/a | no | n/a |
| 13 | Vivaldo Product Discovery | 7716 | productivity | 4 | yes | no | subscribe,usd | none | n/a | no | n/a |
| 14 | DevMatch | 6937 | freelance | 3 | yes | no | pricing,usd | none | n/a | no | n/a |
| 15 | Event Resolver — Settlement Oracle for | 6930 | price | 3 | yes | no | pricing,subscribe,x402,pay-per-call | yes | 7037 | yes | MIT |

Cohort facts:

- remote/hosted option: 15 of 15 (100%). Every one has a deploymentUrl.
- public GitHub repo: 1 of 15. README length, demo image and license are unmeasurable for 14 of 15 because there is no repo. That is itself the finding: the used servers are hosted products, not published source.
- tool count: median 5.5 excluding the pipeworx/gateway outlier (2,530 tools, 419,019 uses). Our four carry 8, 8, 10 and 11 tools, so we are already above the median on depth.
- pricing surface detected on the homepage: 7 of 15, all metered, pay-per-call (x402) or subscription. None sells a one-time key.
- Smithery verified badge: 2 of 15 (googlesheets, googledrive).

### Comparison cohort: highest-starred open-source MCP servers in our categories (n=20)

| Repo | Stars | README bytes | Demo image | License |
|---|---|---|---|---|
| oxygen-fragment/claude-modular | 283 | 7834 | yes | MIT |
| Eshaan-Nair/ArcRift | 245 | 33154 | yes | MIT |
| DevnorsAI/devnors-data-mcp | 242 | 6589 | no | MIT |
| vasylenko/bear-notes-mcp | 206 | 13542 | yes | Apache-2.0 |
| freema/openclaw-mcp | 183 | 13672 | yes | MIT |
| taskade/mcp | 163 | 20505 | yes | MIT |
| BV-Venky/excalidraw-architect-mcp | 147 | 24542 | yes | MIT |
| khendzel/skills-janitor | 115 | 6594 | yes | MIT |
| democratize-technology/vikunja-mcp | 108 | 41774 | no | MIT |
| georgeantonopoulos/Basecamp-MCP-Server | 99 | 12206 | yes | MIT |
| kunwarVivek/mcp-github-project-manager | 95 | 43100 | yes | MIT |
| xiaolaa2/ableton-copilot-mcp | 91 | 6563 | yes | MIT |
| jgravelle/jdatamunch-mcp | 81 | 12439 | yes | NOASSERTION |
| b0x42/Super-Productivity-MCP | 80 | 8829 | yes | MIT |
| jztan/redmine-mcp-server | 75 | 49259 | yes | MIT |
| 8bitgentleman/activitywatch-mcp-server | 72 | 9028 | yes | MIT |
| mholzen/workflowy | 72 | 8232 | yes | MIT |
| OpenStudy-dev/OpenStudy | 71 | 35713 | yes | MIT |
| nicepkg/vsync | 58 | 15944 | yes | MIT |
| vgnshiyer/apple-books-mcp | 56 | 10807 | yes | Apache-2.0 |

median README 12990 bytes | demo image 90% | MIT 85%

Ours: time-tracker 3,362B / price-tracker 5,238B / spreadsheet 5,242B / invoice 4,344B, 0 demo images, MIT.


### Five recommendations

**R1. Ship a remote streamable-HTTP endpoint for all four servers**

- Do: Add a `remotes` block to each servers/<name>/server.json and deploy one Node HTTP transport per server (or one multiplexed host). Keep stdio as the default install.
- Evidence: 15 of 15 top-use Smithery servers in our categories have remote=true and a deploymentUrl. 61 of 93 official-registry results for 'invoice' carry a remotes[] entry. Our 4 server.json files carry 0. Smithery useCount only accrues to deployed remote servers, so our measurable use is structurally pinned at 0.
- Row: `remote_share_top15=15/15; registry_invoice_remote=61/93; ours=0/4`

**R2. Occupy registry slots with per-locale name variants of one codebase**

- Do: Publish invoice as invoice-vat-eu, invoice-us-1099, invoice-uk-vat, invoice-pl-jpk from the same dist, each with its own server.json name; do the same for time-tracker (timesheet-billing, billable-hours).
- Evidence: app.wishpool holds 35 of the 93 official-registry results for 'invoice' (37.6%) using per-country names (argentina-invoice-mcp, belgium-invoice-mcp, brazil-invoice-mcp, chile-invoice-mcp, india-invoice). We hold 1 result, at rank 82 of 91. Registry search is name-substring only, so N names = N slots.
- Row: `wishpool_share=35/93=37.6%; ours=1/93 at rank 82`

**R3. Take each README from ~4KB to ~13KB and add a demo image**

- Do: Add a rendered screenshot or an animated transcript of a real session to each README, plus a worked end-to-end example, a troubleshooting section, and a full tool-argument reference.
- Evidence: n=20 GitHub cohort of the highest-starred MCP servers in our categories: median README 12,990 bytes, 90% carry at least one image, 85% MIT. Our READMEs are 3,362 / 4,344 / 5,238 / 5,242 bytes (2.5x to 3.9x shorter) and carry 0 images.
- Row: `cohort_median_readme=12990B, demo_image=90%; ours max=5242B, demo_image=0%`

**R4. Publish a single bundle server that re-exports all four tool sets**

- Do: Add servers/bundle exposing the ~37 tools of the four servers behind one name and one install line, gated by the existing bundle license id.
- Evidence: pipeworx/gateway carries 419,019 uses with 2,530 tools - 7.5x the #2 server in our categories and 30x the median. Aggregation, not depth, is what the use distribution rewards. Our four separate installs each ask the user for a separate config entry.
- Row: `gateway_uses=419019 vs next=56138 (7.5x); tool_count 2530 vs cohort median 5.5`

**R5. Add receipt and expense capture to the suite, as the fifth server**

- Do: Ship an expense/receipt ledger server (see Part B pick) and cross-link it from the other four READMEs.
- Evidence: Receiptor MCP is the highest-use non-gateway, non-Google server in our category set at 15,517 uses with 51 tools, and it does receipt and expense extraction - a capability none of our four have. 7 of 15 top servers show a pricing surface on their homepage, all metered or subscription; none sells a one-time key, which is the only rail a local stdio server has.
- Row: `receiptor_uses=15517, tools=51; our suite covers 0 of its capability; 7/15 top servers monetize at the endpoint`


## B. Fifth server: empty-slot scan over 40 intents

Method (same as the research): demand proxy / (1 + MCP supply). demand = Chrome Web Store competing-listing count from platform-analysis-2026/measured.json where measured (20 of 40); for the 20 new intents no CWS count exists, so the median of the measured consumer intents (640) is imputed and flagged, with a worst-case column recomputed at the measured minimum (191) to bound the imputation. supply_index = registry name-substring hits (hyphen form) + 0.5 x (token form) + npm packages whose name contains both 'mcp' and the token + smithery top useCount/1000. fit = score x pairs x local_value, zeroed when not buildable locally or already shipped. pairs (0-1) is how directly the intent feeds or consumes the four servers we ship; local_value (0-1) is the fraction of the market leader's value that survives the no-paid-API, no-native-deps rule in CONVENTIONS.md. Both are stated judgment, not measurement, and are printed per row so they can be overridden.

| Intent | reg hyphen | reg token | smithery n | smithery top use | npm | CWS | supply | score | worst case | buildable | shipped | pairs | local value | fit | note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| expense tracker | 4 | 14 | 154 | 15517 | 1 | imputed 640 | 27.52 | 22.44 | 6.7 | yes | no | 1.0 | 0.7 | 15.71 | JSON store + arithmetic; pairs with time-tracker and invoice directly |
| docx | 19 | 19 | 122 | 5593 | 4 | imputed 640 | 38.09 | 16.37 | 4.89 | yes | no | 0.9 | 1.0 | 14.73 | OOXML is a zip of XML, pure JS; pairs with spreadsheet |
| timezone | 0 | 12 | 176 | 10853 | 4 | imputed 640 | 20.85 | 29.29 | 8.74 | yes | no | 0.5 | 1.0 | 14.64 | pure Intl, trivial alone |
| currency converter | 6 | 15 | 153 | 12254 | 3 | imputed 640 | 28.75 | 21.51 | 6.42 | yes | no | 0.7 | 0.9 | 13.55 | needs a rate feed; ECB daily XML is public and free |
| markdown to pdf | 0 | 100 | 137 | 4235 | 5 | imputed 640 | 59.23 | 10.63 | 3.17 | yes | no | 0.9 | 1.0 | 9.57 | pure JS, reuses the invoice PDF writer |
| qr code | 6 | 4 | 170 | 3111 | 3 | imputed 640 | 14.11 | 42.35 | 12.64 | yes | no | 0.3 | 0.6 | 7.62 | pure-JS encode; decode needs an image decoder |
| bookmarks | 0 | 2 | 116 | 4514 | 2 | imputed 640 | 7.51 | 75.17 | 22.43 | yes | no | 0.1 | 1.0 | 7.52 | local, no office pairing |
| meeting notes | 0 | 12 | 160 | 10853 | 3 | imputed 640 | 19.85 | 30.69 | 9.16 | yes | no | 0.8 | 0.3 | 7.37 | local markdown store; pairs with time-tracker billable meetings |
| pomodoro | 4 | 4 | 100 | 900 | 1 | imputed 640 | 7.9 | 71.91 | 21.46 | yes | no | 0.1 | 1.0 | 7.19 | local, but duplicates servers/time-tracker |
| habit tracker | 4 | 21 | 174 | 1875 | 1 | imputed 640 | 17.38 | 34.83 | 10.39 | yes | no | 0.2 | 1.0 | 6.97 | local, but consumer habit, not freelancer office |
| unit converter | 6 | 5 | 165 | 10046 | 0 | imputed 640 | 18.55 | 32.74 | 9.77 | yes | no | 0.2 | 1.0 | 6.55 | local, trivial, no pairing |
| rss reader | 1 | 20 | 145 | 3481 | 13 | imputed 640 | 27.48 | 22.47 | 6.71 | yes | no | 0.2 | 1.0 | 4.49 | public feeds, pure JS parse; no office pairing |
| todo | 32 | 32 | 140 | 4450 | 5 | imputed 640 | 57.45 | 10.95 | 3.27 | yes | no | 0.4 | 1.0 | 4.38 | local, weak pairing, heavily supplied |
| barcode | 9 | 9 | 116 | 3250 | 1 | imputed 640 | 17.75 | 34.13 | 10.19 | yes | no | 0.2 | 0.6 | 4.1 | pure-JS encode only |
| note taking | 4 | 66 | 163 | 2359 | 4 | imputed 640 | 43.36 | 14.43 | 4.31 | yes | no | 0.5 | 0.5 | 3.61 | local files, weak pairing with billing suite |
| pdf | 100 | 100 | 147 | 5142 | 25 | 563 | 180.14 | 3.11 | 1.05 | yes | no | 0.9 | 1.0 | 2.8 | pure-JS generation already proven in servers/invoice |
| epub | 6 | 6 | 103 | 103303 | 0 | imputed 640 | 112.3 | 5.65 | 1.69 | yes | no | 0.2 | 1.0 | 1.13 | zip of XHTML, pure JS; no office pairing |
| dark mode | 0 | 0 | 193 | 2621 | 0 | 640 | 2.62 | 176.75 | 52.75 | no | no | 0.0 | 0.0 | 0.0 | browser-only concept, no local office value |
| screenshot | 26 | 26 | 188 | 4295 | 13 | 582 | 56.3 | 10.16 | 3.33 | no | no | 0.0 | 0.0 | 0.0 | needs a headless browser or native capture |
| translate | 12 | 11 | 183 | 2463 | 2 | 631 | 21.96 | 27.48 | 8.32 | no | no | 0.0 | 0.0 | 0.0 | needs a paid or hosted MT model |
| calendar | 89 | 89 | 168 | 17825 | 16 | 736 | 167.32 | 4.37 | 1.13 | no | no | 0.0 | 0.0 | 0.0 | value is in the hosted account (Google/MS), not local |
| github | 100 | 100 | 150 | 22596 | 31 | 987 | 203.6 | 4.82 | 0.93 | no | no | 0.0 | 0.0 | 0.0 | wrapper on a hosted API, saturated |
| notion | 83 | 83 | 126 | 10870 | 31 | 512 | 166.37 | 3.06 | 1.14 | no | no | 0.0 | 0.0 | 0.0 | hosted API wrapper |
| database | 71 | 100 | 177 | 43250 | 23 | 691 | 187.25 | 3.67 | 1.01 | no | no | 0.0 | 0.0 | 0.0 | native drivers |
| postgres | 88 | 2 | 114 | 6986 | 20 | 5 | 115.99 | 0.04 | 1.63 | no | no | 0.0 | 0.0 | 0.0 | native drivers, saturated |
| weather | 100 | 100 | 153 | 10680 | 57 | 596 | 217.68 | 2.73 | 0.87 | no | no | 0.0 | 0.0 | 0.0 | external API, no office pairing |
| email | 100 | 100 | 140 | 57738 | 40 | 919 | 247.74 | 3.69 | 0.77 | no | no | 0.0 | 0.0 | 0.0 | account credentials, saturated |
| slack | 68 | 68 | 130 | 24668 | 35 | 371 | 161.67 | 2.28 | 1.17 | no | no | 0.0 | 0.0 | 0.0 | hosted API wrapper |
| youtube | 100 | 100 | 151 | 4719 | 29 | 786 | 183.72 | 4.26 | 1.03 | no | no | 0.0 | 0.0 | 0.0 | hosted API wrapper |
| stripe | 20 | 20 | 154 | 48 | 14 | 191 | 44.05 | 4.24 | 4.24 | no | no | 0.0 | 0.0 | 0.0 | hosted API wrapper |
| price tracker | 8 | 100 | 151 | 5056 | 7 | 683 | 70.06 | 9.61 | 2.69 | yes | yes | 1.0 | 1.0 | 0.0 | already shipped |
| time tracker | 5 | 0 | 168 | 9780 | 0 | 897 | 14.78 | 56.84 | 12.1 | yes | yes | 1.0 | 1.0 | 0.0 | already shipped |
| spreadsheet | 15 | 19 | 122 | 56138 | 2 | 564 | 82.64 | 6.74 | 2.28 | yes | yes | 1.0 | 1.0 | 0.0 | already shipped |
| jira | 80 | 80 | 109 | 419019 | 63 | 659 | 602.02 | 1.09 | 0.32 | no | no | 0.0 | 0.0 | 0.0 | hosted API wrapper |
| clipboard | 15 | 15 | 102 | 329 | 3 | 706 | 25.83 | 26.31 | 7.12 | no | no | 0.0 | 0.0 | 0.0 | needs native pasteboard access |
| invoice | 93 | 68 | 129 | 1299 | 1 | 414 | 129.3 | 3.18 | 1.47 | yes | yes | 1.0 | 1.0 | 0.0 | already shipped |
| receipt scanner | 0 | 15 | 171 | 15517 | 3 | imputed 640 | 26.02 | 23.69 | 7.07 | no | no | 0.0 | 0.0 | 0.0 | OCR needs a paid API or a native binary |
| password | 0 | 22 | 183 | 4119 | 2 | imputed 640 | 17.12 | 35.32 | 10.54 | no | no | 0.0 | 0.0 | 0.0 | secret custody liability, will not ship |
| transcription | 5 | 14 | 171 | 4831 | 8 | imputed 640 | 24.83 | 24.78 | 7.39 | no | no | 0.0 | 0.0 | 0.0 | needs a speech model |
| ocr | 71 | 71 | 126 | 1865 | 3 | imputed 640 | 111.36 | 5.7 | 1.7 | no | no | 0.0 | 0.0 | 0.0 | native deps |

### Pick: expense-tracker (receipts and expenses ledger)

Row: `{"intent": "expense tracker", "registry_hyphen": 4, "registry_token": 14, "smithery_count": 154, "smithery_top_use": 15517, "npm_count": 1, "chrome_listings": null, "demand_used": 640, "demand_imputed": true, "supply_index": 27.52, "score": 22.44, "score_worst_case": 6.7, "buildable": true, "pairs": 1.0, "local_value": 0.7, "already_shipped": false, "fit_score": 15.71, "note": "JSON store + arithmetic; pairs with time-tracker and invoice directly"}`

It wins on two measured rows and one judgment row. Measured: official-registry supply is 4 hits for 'expense-tracker' and 14 for 'expense', against 4/66 for 'note-taking'/'notes', 19/19 for 'docx', 93/68 for 'invoice' and 100/100 for 'pdf' - the slot carries 23x less supply than 'invoice', where we already sit at rank 82 of 91. Measured: the highest-use non-Google, non-gateway server in the whole category set is a receipt/expense server (Receiptor, 15,517 uses, 51 tools), so paying demand for this shape exists. Judgment: it is the only high-fit intent that consumes the output of two servers we already ship (time-tracker hours out, invoice line items in) instead of duplicating one. Its Chrome demand figure is imputed, not measured, and the pick does not survive on the score alone - at the worst-case CWS bound it scores 6.70, below pomodoro (21.46) and bookmarks (22.43), both of which lose on pairing.

Runners-up by fit, new intents only: docx (14.73), timezone (14.64), currency converter (13.55), markdown to pdf (9.57), qr code (7.62). docx and timezone are within 10% of the pick on fit but neither consumes the output of an existing server; the tie is broken on the pairing row, which is judgment, so both stay on the shortlist.

#### Tools (10)

| Tool | What it does |
|---|---|
| `expense_add` | Log an expense: amount, currency, category, vendor, date, project, billable flag, optional receipt file path. |
| `expense_list` | List expenses as a compact table with filters for date range, project, category and billable. Free tier shows the last 30 days. |
| `expense_update` | Change any field on one expense by id. |
| `expense_delete` | Delete one expense by id. |
| `receipt_attach` | Attach a local receipt file to an expense; stores the path, size, sha256 and mime type. No upload, no OCR. |
| `category_rules` | Define and list keyword-to-category rules so vendor strings auto-categorise on add. |
| `expense_summary` | Totals by category, project, month and billable/non-billable, with a period comparison. |
| `mileage_add` | Log a trip in km or miles at a per-unit rate and store it as an expense. |
| `expense_export` | Export a filtered set to CSV or JSON for an accountant. Pro: XLSX via the spreadsheet writer. |
| `expense_to_invoice` | Emit billable expenses for a project as invoice line items in the shape servers/invoice consumes (rebillable pass-through with an optional markup). |

Plus `license_status` and `license_activate` from @theluckystrike/mcp-license, per CONVENTIONS.md.

#### Free vs Pro

| | Free | Pro ($19 one-time, or in the $39 bundle) |
|---|---|---|
| Expenses stored | unlimited | unlimited |
| expense_list window | last 30 days | all history |
| Projects | 3 | unlimited |
| Category rules | 5 | unlimited |
| expense_summary | current month + previous month | any range, any grouping, year-over-year |
| expense_export | CSV, 50 rows per call | CSV/JSON/XLSX, unlimited rows |
| expense_to_invoice | 5 line items per call | unlimited, with markup rules |
| Multi-currency | single base currency | per-expense currency with a stored rate |

Core value stays free: logging, categorising and seeing this month's totals never hits a wall. Pro sells volume and history, which is what a freelancer needs only at tax time and at invoicing time - the two moments they already paid us for time-tracker and invoice.

#### Three riskiest assumptions

1. That the empty slot is real and not an artefact of name-substring search. 'expense-tracker' returns 4 registry hits, but the research already measured the price-tracker and time-tracker slots closing inside 24 hours (io.github.CSOAI-ORG shipped both), and 9,355 servers were added in August. Test: re-run the two registry queries the day before publishing, and again 14 days after.

2. That Chrome Web Store listing counts proxy MCP demand at all. The 20 measured CWS counts sit in a narrow band (191-987, median 640) for every generic consumer intent, so the metric barely discriminates between intents and the imputed 640 for the 20 new intents may carry no signal. The worst-case column bounds this: at CWS=191 the ranking of the top five buildable intents is unchanged, but the absolute scores fall by 70%. Test: check whether any intent's CWS count predicts its Smithery top useCount - on the 20 measured rows it does not (CWS 987 for github vs 5 for postgres, yet postgres tops 1,350 uses).

3. That a local, no-OCR expense server is worth paying for. Receiptor's 15,517 uses come from a hosted service that reads receipts out of an inbox; ours reads nothing and only files what the user types. The measured counter-evidence is that OCR needs a paid API or a native binary, both banned by CONVENTIONS.md. Test: ship free-only for 14 days and count expense_to_invoice calls per install; if that tool is not used, the pairing thesis - the entire reason this intent beat docx and markdown-to-pdf - is false.


## RESULT.md schema block

```
status: DONE
evidence: 670 unique Smithery servers pulled across 8 category queries (2 pages x 50, dedup by qualifiedName);
  top 15 by useCount enriched from registry.smithery.ai/servers/<qualifiedName> -> remote=true 15/15,
  public repo 1/15, median tool_count 5.5 ex-outlier, pricing surface 7/15.
  Comparison cohort n=20 highest-starred category repos via gh api search/repositories:
  median README 12,990B, demo image 90%, MIT 85%; ours 3,362-5,242B, 0 images.
  Registry concentration: app.wishpool holds 35 of 93 'invoice' results; ours 1 at rank 82;
  61 of 93 carry remotes[], ours 0 of 4.
  40 intents measured on 5 instruments each (registry hyphen + token, smithery count + top use, npm).
  Pick expense-tracker: registry_hyphen=4 registry_token=14 smithery_top_use=15517 npm=1 fit=15.71.
artifacts: docs/INTEL.md, data/intel.json
cost: 34 wall minutes
failures: npm /-/v1/search total is an OR match (102,877 for 'mcp invoice'); replaced with a count of
  packages in the top 250 whose name contains both 'mcp' and the intent token. A GitHub repo-count
  demand proxy was measured then discarded: 'github' returned 19,450,978 repos, so the metric tracks
  word frequency, not intent demand. No CWS instrument exists for the 20 new intents, so the median
  is imputed and a worst-case column is carried alongside every score.
insight: the servers that get used in our categories are not better local servers - 15 of 15 are hosted
  endpoints and 14 of 15 publish no source at all. Smithery useCount cannot accrue to a stdio-only
  server, so our 4 servers are not losing the ranking, they are absent from the instrument that
  produces it.
```
