# Directory packets for the data satellites

Prepared 2026-11-02 by the packets lane. Nothing was submitted, posted or sent. Every check below was a read-only request.

## Findings that change the plan

1. The brief says 16 servers, but I found 15 (9 reports in data/s1030, 6 in data/s1102, 15 public repos on GitHub, 15 folders in ~/mcp-servers/satellites). No 16th turned up.
2. Glama lists 9 of 15. Six are missing. Details in section 1.
3. All 66 tools on all 15 live servers have a title and readOnlyHint true. Zero gaps. The destructiveHint and openWorldHint values are explicit too, which OpenAI now requires.
4. Five things block a clean submission and none of them are owner minutes. They are in the next table. Two need a code change by the builder session.
5. The three picks are minimum-wage-mcp, no-tax-on-overtime-mcp and lake-level-mcp. The holidays server was ruled out because its results pitch the paid Zovo bundle.
6. OpenAI renamed its directory. It now takes a plugin ZIP, not a form, and checks domain ownership with a file on each Worker hostname.

## Blockers before anyone submits

| Id | Where | Problem | Fix | Who |
|---|---|---|---|---|
| B1 | Lake Level Now, both directories | Tool results contain promotion of a paid product. get_lake_history and get_lake_level add the sentence 'Decades of daily record and day-of-year normals for this lake are in the Lake Level Almanac.' to summary for lakes flagged almanac, and the structured result carries an almanac URL. The landing page also says 'the paid Lake Level Almanac'. Claude policy 4C bars promotional vehicles and OpenAI bars promoting paid digital products and upgrade links. | Remove the almanac sentence from the summary and the almanac field in src/core.ts (lines 474, 507, 521 and the list at 408), and drop the word paid from the landing page in src/worker.ts line 35. Then redeploy. Live evidence 2026-11-02, Shasta history summary and Powell almanac field. | builder session, not done here |
| B2 | All three, both directories | No privacy policy covers the public servers. https://mcp.zovo.one/privacy returns 200 but describes local stdio servers, the token-based hosted endpoints, Stripe and email signups. It has zero mentions of workers.dev or the public data servers (grep count 0). | Add the Public data servers paragraph from this packet to that page, or publish it as a separate URL. Text is in packets.json under privacy_text and in section 2. | owner or the mcpstamp session (this lane may not edit ~/mcpstamp-work) |
| B3 | ChatGPT only | OpenAI asks for a terms of service URL and https://mcp.zovo.one/terms returns 404. The plugin also needs a domain challenge file at /.well-known/openai-apps-challenge on each Worker hostname, and all three currently return 404. | Publish a short terms page. For each plugin, add a route to the Worker that returns the exact token the portal shows, then deploy that Worker only. | owner gets the token in the portal, builder deploys |
| B4 | Both | No icon exists for these servers. Claude asks for an icon and OpenAI asks for four icon files. ~/mcpstamp-work/a4-listing/icons holds only mcpstamp-expenses, resume and tasks. | Supply one square PNG per listing, 512 px or more, plus dark variants for OpenAI. | owner |
| B5 | Claude | The submission asks you to confirm you ran every tool through MCP Inspector or as a custom connector in Claude. This lane checked over raw HTTP only (initialize and tools/list on all 15 servers, plus 26 tools/call on the three picks and the holidays server). | Add each URL as a custom connector in Claude once and run the three test prompts. About 3 minutes each. | owner |

## The three picks and why

- minimum-wage-mcp. 2027 state rates were announced from August to late September 2026, after most model training data. Embedded tables, no runtime upstream calls, no promotional text in results. Weakness is three 2027 figures from secondary text, which the description and the result both flag. Results carry no disclaimer line, so add one sentence saying it is reference data and the state labor department has the final word (optional, since wage lookup is lower risk than tax).
- no-tax-on-overtime-mcp. Exact phase-out and cap arithmetic from IRS forms and FS-2026-13 (August 2026). Results carry an estimate and not tax advice disclaimer, which satisfies the high-risk disclosure clause. Embedded tables, no runtime upstream calls.
- lake-level-mcp. The only one where the model has no possible answer, because the data is a live gauge reading. Strongest user value and Glama TDQS 4.4. Carries the most policy exposure (live third-party fetches, almanac promotion in B1), so it goes third and only after B1 is fixed.

Held back.

- us-federal-holidays-business-days-mcp. Useful, but invoice_due_date returns a more_note that pitches the paid Zovo back-office bundle and its more link goes to the https://mcp.zovo.one store page. That is advertising under Claude 4C and a paid-product link under OpenAI rules. Fix first and it becomes the fourth pick.
- gold-price-per-gram-mcp. Live data, but a single third-party spot source with no warranty (api.gold-api.com), which raises the API ownership and unofficial connector questions.
- paycheck-calculator-mcp, uk-income-tax-salary-mcp, dscr-loan-calculator-mcp. Good data, but the tax and finance computation carries the same high-risk disclosure duty as the overtime server with less newer-than-training data.

Submit in the order above, lowest policy risk first, so a rejection on the third doesn't colour the first two.

## 1 Glama directory, 12 minutes

URL for the owner step is https://glama.ai/mcp/servers (Add Server). Sign-in is the owner's. Every repo already has glama.json and an MIT LICENSE.

Method. I fetched https://glama.ai/mcp/servers/theluckystrike/REPO for all 15 with a browser user agent. Nine returned 200 with a full page, six returned 404. The positive control was the nine real pages. The negative control was a made-up repo name, which also returned 404. I cross-checked with the search page https://glama.ai/mcp/servers?query=theluckystrike, which lists the same nine and none of the six. Glama did not block the requests. Its REST API needs a key, so I read the HTML.

| Repo | State | TDQS score | Maintenance grade | Scored |
|---|---|---|---|---|
| ab-test-sample-size-calculator-mcp | missing (404) | none | none | none |
| ap-score-distributions-mcp | missing (404) | none | none | none |
| car-loan-interest-deduction-calculator-mcp | missing (404) | none | none | none |
| cups-to-grams-mcp | listed | tier A, number not parsed | c | 2026-10-30 |
| dscr-loan-calculator-mcp | listed | 4.1 | c | 2026-10-30 |
| gold-price-per-gram-mcp | listed | 4.1 | c | 2026-10-30 |
| lake-level-mcp | listed | 4.4 | b | 2026-10-30 |
| minimum-wage-mcp | listed | 4.1 | c | 2026-10-30 |
| no-tax-on-overtime-mcp | listed | 4.1 | c | 2026-10-30 |
| paycheck-calculator-mcp | listed | 4.4 | c | 2026-10-30 |
| recipe-nutrition-calculator-mcp | missing (404) | none | none | none |
| section-179-deduction-calculator-mcp | missing (404) | none | none | none |
| subdomain-finder-mcp | missing (404) | none | none | none |
| uk-income-tax-salary-mcp | listed | 4.1 | c | 2026-10-30 |
| us-federal-holidays-business-days-mcp | listed | tier A, number not parsed | c | 2026-10-30 |

Scores date from 2026-10-30, so none of the six new servers have been scored yet. Maintenance grade c on most pages will rise as the repos age.

## 2 Claude connectors directory, 55 minutes for all three

URL is https://claude.ai/directory/manage then Submit new then MCP connector. It needs any paid Claude plan, and the Owner role on a Team or Enterprise plan. The portal has ten steps and autosaves in the browser, so do each connector in one sitting.

What the current docs require (fetched today from https://claude.com/docs/connectors/building/submission, https://claude.com/docs/connectors/building/review-criteria and https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy).

- Remote HTTPS URL. No authentication is allowed for public data.
- Every tool needs a title and readOnlyHint or destructiveHint. The portal flags gaps.
- Listing fields are name up to 100 characters, one-liner up to 200, description up to 2,000, one to five categories, docs URL, privacy URL, support contact, icon, and a permanent URL slug.
- At least three working example prompts, a privacy policy link, and a verified support channel.

On the review side.

- Seven policy acknowledgments, all required. The portal asks you to confirm you ran every tool.
- A Community listing appears automatically after a scan. A human review is optional, has no SLA, and escalations go to mcp-review@anthropic.com.
- Tax, legal and finance count as high-risk uses and need a direct disclosure. The overtime server's estimate disclaimer covers that.
- Policy 3F expects you to own or control the endpoints and resources the server touches. Public government data is the gray area, and it only affects the lake server.

### Privacy policy

https://mcp.zovo.one/privacy exists and returns 200, but it doesn't cover these servers. It describes local servers, the token-based hosted endpoints, Stripe and email signups, and has no mention of workers.dev. Do not submit it unchanged. Add this paragraph under the hosted endpoints heading, or publish it on its own URL.

> Public data servers. The free data servers hosted at addresses ending in lipmichal.workers.dev have no accounts and no tokens. They don't ask for your name, email address or location, and they store nothing about you or your conversation. A call sends only the arguments the tool needs, such as a lake name, a state or a dollar amount. Cloudflare hosts the servers and logs requests the way any web host does, including time, IP address and request path, under its own retention rules. Answers from public agencies can be cached at the edge for up to one hour, and the cache holds public agency data only. Results include a link to a source page and a related page on a site run by the same author. Those links carry a utm tag so the author can count visits. Following a link is optional and sends nothing to the server. Questions go to support@zovo.one.

The policy needs to cover data collection, usage, third-party sharing, retention and contact. The paragraph covers each of those, and the Cloudflare sentence is the honest answer on retention. I checked the Worker config for all 15 servers and none has KV, D1, Durable Object, R2, analytics or cron bindings, so nothing is stored.

### How the more link must be framed

Results carry a source link (the agency or IRS page) and a more link (a same-topic page on a site you run, with utm_source=mcp and utm_medium set to the repo name). The Anthropic policy bars software that serves advertisements or sponsored content or exists mainly to promote something. A same-topic link with UTM tags is a source link, not an ad, and the three picks pass if they stay that way. The listing and the reviewer notes should say this plainly.

Paste this into the reviewer instructions and the end of each description.

> Each result includes a source link to the agency or IRS page the figure came from. It also includes one related page on a reference site run by the same author, on the same topic as the answer. The answer is complete without it, and the utm tags only count visits.

Rules that keep it safe. One link per result. Never a store, pricing or checkout page. No product names in summaries. Use the GitHub README as the documentation URL, not the Worker landing page, because the landing pages still carry the Zovo collection line. Lake Level Now must lose the almanac text first (blocker B1). Optionally rename more to reference_page.

### Tool annotation check

Method. I sent initialize and tools/list to every live Worker and tested whether readOnlyHint is true. The check flags a tool with no annotation and one with readOnlyHint false, so a clean result means something. Result across 15 servers and 66 tools. Missing title 0. Missing readOnlyHint 0. Missing destructiveHint 0. Missing openWorldHint 0. The tools with openWorldHint true are the live-fetch ones (gold prices, lake gauges, the subdomain finder).

Style flags only. The lake and gold descriptions say the model's training data can't know today's value, and the recipe nutrition descriptions say to use the tool instead of estimating from memory. Both are factual, but a strict reviewer could read them as steering. An optional reword is Reads the gauge at call time. The paycheck calculator titles contain a colon, which is harmless here.

### Packet 1, US State Minimum Wage

| Portal step | Answer |
|---|---|
| 1 Connection | https://minimum-wage-mcp.lipmichal.workers.dev/mcp |
| 2 Tools | Auto-synced. Expect 4 tools, get_minimum_wage, list_upcoming_increases, compare_states, annual_income_at_minimum_wage. No flags expected. |
| 3 Name (21 chars) | US State Minimum Wage |
| 3 URL slug (permanent) | us-state-minimum-wage |
| 3 Categories | Reference data, Finance or payroll (pick the closest two from the portal list) |
| 3 Documentation URL | https://github.com/theluckystrike/minimum-wage-mcp#readme |
| 3 Privacy policy URL | https://mcp.zovo.one/privacy, after the paragraph above is added |
| 3 Support contact | support@zovo.one |
| 3 Icon | You supply one square PNG (blocker B4) |
| 4 Reads or writes | Reads data only |
| 5 Company | Your legal or trading name, website https://zovo.one, contact support@zovo.one |
| 6 Authentication | Not required |
| 7 Data handling | Own computation over tables embedded in the server from official sources. No runtime calls to outside APIs. No personal health data. No sponsored content. |
| 8 Test and launch | No account needed. See the reviewer instructions below. Run each tool once in Claude first (blocker B5). |
| 9 Compliance | Tick all seven after reading each. The first-party API item needs the truthful answer in row 7. |

One-liner (161 of 200 characters).

> Minimum wage, tipped cash wage and tip credit for all 50 states and DC in 2026 and 2027, including January 2027 increases that postdate most model training data.

Description (1427 of 2,000 characters).

> US State Minimum Wage gives an assistant the state minimum wage on a chosen date in 2026 or 2027 for all 50 states and DC. It covers the standard hourly rate, the tipped cash wage, the tip credit and the date the rate took effect, and it applies the $7.25 federal floor where a state has no higher rate.
>
> Four tools. get_minimum_wage returns one state's rate on a date. list_upcoming_increases lists every scheduled change through 2027-12-31, sorted by date. compare_states lines up 2 to 10 states with full-time annual pay and the gap between the highest and lowest. annual_income_at_minimum_wage turns a state rate into weekly, monthly and annual gross pay.
>
> Figures come from the US Department of Labor state tables and state labor department notices, and each result carries a source link and an as_of date. Some 2027 rates are set by an inflation index and haven't been announced for Nebraska, Vermont, DC and Oregon, so the server reports them as not announced and never estimates them. Three 2027 figures (Arizona, Connecticut and Rhode Island) rest on the text of an official notice or statute plus a news report because the state pages couldn't be read, and the result flags that. City and county minimum wages aren't included and can be higher.
>
> No account or token is needed, and the server stores nothing about you. Results include a link to a related page on statewage.com, a reference site run by the same author.

Use cases text.

> People ask what the minimum wage is in a named state on a named date, which states raise it next, how two or three states compare, or what a full-time worker earns at the minimum. Typical users are workers, small employers, payroll staff and journalists. Users need nothing before connecting. The connector only reads data.

Reviewer instructions.

> No account is needed. In Claude add https://minimum-wage-mcp.lipmichal.workers.dev/mcp as a custom connector with no authentication, then run the three example prompts. Each result includes the source link and an as_of date.

Example prompts, three, as the policy requires.

1. What is the minimum wage in California on January 1, 2027, and is there a tip credit?
2. Which states raise their minimum wage next, and by how much?
3. Compare the minimum wage in Washington, Texas and Florida on 2027-01-01 and show full-time annual pay.

### Packet 2, No Tax on Overtime

| Portal step | Answer |
|---|---|
| 1 Connection | https://no-tax-on-overtime-mcp.lipmichal.workers.dev/mcp |
| 2 Tools | Auto-synced. Expect 5 tools, calculate_overtime_deduction, calculate_tips_deduction, calculate_senior_deduction, estimate_tax_savings, explain_eligibility. No flags expected. |
| 3 Name (18 chars) | No Tax on Overtime |
| 3 URL slug (permanent) | no-tax-on-overtime |
| 3 Categories | Finance or tax, Reference data (pick the closest two from the portal list) |
| 3 Documentation URL | https://github.com/theluckystrike/no-tax-on-overtime-mcp#readme |
| 3 Privacy policy URL | https://mcp.zovo.one/privacy, after the paragraph above is added |
| 3 Support contact | support@zovo.one |
| 3 Icon | You supply one square PNG (blocker B4) |
| 4 Reads or writes | Reads data only |
| 5 Company | Your legal or trading name, website https://zovo.one, contact support@zovo.one |
| 6 Authentication | Not required |
| 7 Data handling | Own computation over tables embedded in the server from official sources. No runtime calls to outside APIs. No personal health data. No sponsored content. |
| 8 Test and launch | No account needed. See the reviewer instructions below. Run each tool once in Claude first (blocker B5). |
| 9 Compliance | Tick all seven after reading each. The first-party API item needs the truthful answer in row 7. |

One-liner (159 of 200 characters).

> Federal overtime, tips and senior deductions for 2025 to 2028 under the One Big Beautiful Bill Act, with caps and phase-outs taken from IRS forms and guidance.

Description (1499 of 2,000 characters).

> No Tax on Overtime calculates the federal deductions for qualified overtime pay, qualified tips and seniors age 65 and older that the One Big Beautiful Bill Act (P.L. 119-21) created for tax years 2025 to 2028. The rules are recent and IRS guidance kept changing through 2026, so a model's training data can be missing or wrong on the details.
>
> Five tools. calculate_overtime_deduction applies the $12,500 cap ($25,000 joint) and the income phase-out, and converts hourly rate, hours and multiplier into the half-time premium that actually qualifies. calculate_tips_deduction applies the $25,000 per return cap. calculate_senior_deduction applies the $6,000 per person amount and the 6 percent reduction above $75,000 ($150,000 joint). estimate_tax_savings runs the three deductions through the IRS brackets before and after. explain_eligibility explains who qualifies, who doesn't (married filing separately) and which form boxes report the amounts.
>
> Amounts are copied from IRS Schedule 1-A, the Form 1040 instructions, Rev. Proc. 2024-40, Rev. Proc. 2025-32 and fact sheet FS-2026-13, and each result links to the IRS source. 2027 and 2028 bracket tables aren't published yet, so those years use the 2026 tables and the result says so. Every result carries a disclaimer that it is an estimate and not tax advice. The server doesn't file anything, stores nothing and needs no account or token. Results include a link to a related page on noovertimetax.com, a reference site run by the same author.

Use cases text.

> People ask how much of their overtime, tips or senior income is deductible, how the income phase-out changes the amount, who qualifies, and roughly how much federal tax the deductions save. Typical users are hourly workers, tipped workers, retirees, payroll staff and tax preparers. Users need nothing before connecting. The connector only reads data and runs calculations.

Reviewer instructions.

> No account is needed. In Claude add https://no-tax-on-overtime-mcp.lipmichal.workers.dev/mcp as a custom connector with no authentication, then run the three example prompts. Each result includes the source link and an as_of date.

Example prompts, three, as the policy requires.

1. I had $6,000 of qualified overtime premium, my MAGI was $90,000 and I file single. What is my 2025 overtime deduction?
2. My spouse and I are both over 65, file jointly and have $160,000 MAGI. What is our 2025 senior deduction?
3. Single filer, 2026, taxable income $55,000 before the new deductions, MAGI $70,000, $30 an hour with 200 overtime hours. How much federal tax do I save?

### Packet 3, Lake Level Now

| Portal step | Answer |
|---|---|
| 1 Connection | https://lake-level-mcp.lipmichal.workers.dev/mcp |
| 2 Tools | Auto-synced. Expect 4 tools, search_lakes, get_lake_level, get_lake_history, compare_lakes. No flags expected. |
| 3 Name (14 chars) | Lake Level Now |
| 3 URL slug (permanent) | lake-level-now |
| 3 Categories | Reference data, Weather or environment (pick the closest two from the portal list) |
| 3 Documentation URL | https://github.com/theluckystrike/lake-level-mcp#readme |
| 3 Privacy policy URL | https://mcp.zovo.one/privacy, after the paragraph above is added |
| 3 Support contact | support@zovo.one |
| 3 Icon | You supply one square PNG (blocker B4) |
| 4 Reads or writes | Reads data only |
| 5 Company | Your legal or trading name, website https://zovo.one, contact support@zovo.one |
| 6 Authentication | Not required |
| 7 Data handling | Third-party public data. Live reads from US government gauge APIs (USGS, USACE, CDEC, Reclamation, TWDB). Expect a reviewer question on policy 3F. No personal health data. No sponsored content. |
| 8 Test and launch | No account needed. See the reviewer instructions below. Run each tool once in Claude first (blocker B5). |
| 9 Compliance | Tick all seven after reading each. The first-party API item needs the truthful answer in row 7. |

One-liner (152 of 200 characters).

> Current level, recent change and distance below full pool for 44 US lakes and reservoirs, read live from USGS, Reclamation, USACE, CDEC and TWDB gauges.

Description (1249 of 2,000 characters).

> Lake Level Now answers questions about the water level of 44 US lakes and reservoirs, including Lake Mead, Lake Powell, Lake Travis, Shasta, Oroville and Lake Lanier. It reads the government gauge at the moment you ask, so the answer is a current reading and not something remembered from training data.
>
> Four tools. search_lakes finds a lake by name, river or state. get_lake_level returns the current elevation in feet, the 24 hour, 7 day and 30 day change, the distance below full pool and, where the agency publishes storage, the percent full. get_lake_history returns a daily or weekly series for up to 365 days with the low, high and mean. compare_lakes ranks 2 to 10 lakes by how far each sits below full pool.
>
> Every result names the gauge agency, the measurement time and a link to the agency data. Reservoir agencies sometimes publish with a delay, and the result states how old each reading is. Lakes outside the 44 aren't covered, and the server says so instead of guessing. It doesn't forecast, and a reading is not a safety or navigation advisory.
>
> No account, token or sign-in is needed, and the server stores nothing about you. Results include a link to the matching page on lakelevelnow.com, a reference site run by the same author.

Use cases text.

> People ask for the current level of a named lake, how much it moved this week, how far below full pool it sits, or how two lakes compare. Typical users are boaters, anglers, water managers, journalists and anyone following drought news. Users need nothing before connecting. The connector only reads data.

Reviewer instructions.

> No account is needed. In Claude add https://lake-level-mcp.lipmichal.workers.dev/mcp as a custom connector with no authentication, then run the three example prompts. Each result includes the source link and an as_of date.

Example prompts, three, as the policy requires.

1. What is the water level of Lake Mead right now and how far below full pool is it?
2. Compare Lake Powell and Lake Mead today and tell me which is closer to full.
3. How has Lake Shasta changed over the last 30 days?

## 3 ChatGPT plugin directory, 90 minutes for all three

URL is the Plugins page in the OpenAI Platform dashboard, documented at https://developers.openai.com/apps-sdk/deploy/submission and https://developers.openai.com/apps-sdk/app-submission-guidelines. Identity verification comes first, either individual or business, in the organization settings. Only organization owners can submit, and EU data residency projects can't.

What changed since the earlier notes. The listing is now a plugin ZIP with plugin.json and mcp.json, uploaded on the Plugins page. The portal then connects to the MCP URL, checks domain ownership with a plain text file at /.well-known/openai-apps-challenge on the MCP hostname, and scans the tools. Review needs five positive and three negative test cases, a demo recording URL and release notes. Only one review runs at a time per plugin.

Rules that bite these servers.

- No MCP, Plugin or Server in the name, so the display names above are used without the repo suffix.
- No pricing, subscriptions or promotion in descriptions, and no links to checkout or upgrade pages. Same-topic reference links are fine. The lake almanac text is not (B1).
- Servers must not exist mainly as an advertising vehicle. Each satellite has standalone value, which is the argument to make if asked.
- readOnlyHint, destructiveHint and openWorldHint must be explicit booleans. All 66 tools pass.

Data and scope rules.

- A privacy policy URL and a terms URL are expected. The terms URL is missing (B3).
- Don't collect SSNs, health data, card data or credentials. The overtime tools ask for filing status, income and amounts only, and negative case 3 tests that an SSN isn't passed along.
- Don't scrape or relay third-party services without authorization. The lake server reads public keyless government gauge APIs, so mention that in reviewer notes.
- Restrict countries. These servers are US-specific, so each plugin.json lists US only.

Each plugin.json, mcp.json and the test cases are in packets.json under chatgpt_packets. Values in the expected results come from live tool calls today. The lake values move, so the cases say so.

### Plugin 1, US State Minimum Wage

MCP URL is https://minimum-wage-mcp.lipmichal.workers.dev/mcp. Domain challenge file goes at https://minimum-wage-mcp.lipmichal.workers.dev/.well-known/openai-apps-challenge and is currently a 404.

Five positive cases.

| Scenario | Prompt | Expected tools | Expected result |
|---|---|---|---|
| Rate on a future date | What is the minimum wage in California on January 1, 2027, and is there a tip credit? | get_minimum_wage | Returns $17.40 an hour in force since 2027-01-01 and states that no tip credit is allowed. Links the California Department of Finance notice as the source. |
| Upcoming increases | Which states raise their minimum wage next, and by how much? | list_upcoming_increases | Returns 19 scheduled changes through 2027-12-31, 15 with a published rate and 4 (NE, VT, DC, OR) marked not announced. The next published change is Arizona to $15.65 on 2027-01-01. Run on the 2026-11-02 test date. |
| Compare three states | Compare the minimum wage in Washington, Texas and Florida on 2027-01-01 and show full-time annual pay. | compare_states | Washington highest at $17.73, Texas lowest at $7.25, a gap of $10.48 an hour or $21,798.40 a year full time. |
| Annual income at minimum wage | How much does a full-time worker in Colorado earn in a year at the 2027 minimum wage? | annual_income_at_minimum_wage | Uses $15.71 an hour. Returns $32,676.80 a year, about $2,723.07 a month and $628.40 a week, before tax. Cites the Colorado Department of Labor press release. |
| Tipped wage | What is the tipped cash wage in Texas? | get_minimum_wage | Returns a $7.25 minimum, a tipped cash wage of $2.13 and a tip credit of $5.12, sourced to the US DOL state table. |

Three negative cases.

| Scenario | Prompt | Expected safe behavior |
|---|---|---|
| City rate out of scope | What is the minimum wage in Seattle? | The tools cover states only and the server errors on a city name. The assistant should say city and county rates aren't covered, and may offer the Washington state rate with that caveat. It should not invent a Seattle figure. |
| Non-US jurisdiction | What is the minimum wage in Ontario, Canada? | The server only covers US states and DC and returns an unknown state error. The assistant should say it can't answer from this plugin and should not guess. |
| Legal filing request | My employer in Texas paid me $6 an hour. File a wage claim for me. | The plugin reads reference data and can't file or advise on claims. The assistant may state the Texas rate and suggest contacting the Department of Labor, and should not claim to have filed anything. |

Demo recording. Screen recording of the five positive prompts in ChatGPT with the plugin enabled, about 3 minutes.

### Plugin 2, No Tax on Overtime

MCP URL is https://no-tax-on-overtime-mcp.lipmichal.workers.dev/mcp. Domain challenge file goes at https://no-tax-on-overtime-mcp.lipmichal.workers.dev/.well-known/openai-apps-challenge and is currently a 404.

Five positive cases.

| Scenario | Prompt | Expected tools | Expected result |
|---|---|---|---|
| Overtime under the threshold | I had $6,000 of qualified overtime premium, my MAGI was $90,000 and I file single. What is my 2025 overtime deduction? | calculate_overtime_deduction | Deduction is $6,000. No phase-out because MAGI is under $150,000. Includes the estimate disclaimer and IRS Schedule 1-A source link. |
| Overtime with phase-out | Same overtime but my MAGI was $160,000. What is the 2025 deduction? | calculate_overtime_deduction | Phase-out removes $1,000 ($100 per full $1,000 over $150,000). Deduction is $5,000. |
| Tips deduction | I earned $9,000 in tips, MAGI $80,000, single, tax year 2025. What can I deduct? | calculate_tips_deduction | Deduction is $9,000. No phase-out and under the $25,000 cap. |
| Senior deduction, joint | We file jointly, both over 65, MAGI $160,000, tax year 2025. What is our senior deduction? | calculate_senior_deduction | Two qualifying people, each $6,000 reduced by $600 to $5,400. Deduction is $10,800. |
| Eligibility rules | Who can claim the no tax on tips deduction, and does married filing separately qualify? | explain_eligibility | Explains that married filing separately cannot claim any of the deductions, each person needs an SSN valid for employment, and from 2026 overtime must be reported on Form W-2 box 12 code TT (tips code TP). Links the IRS sources. |

Three negative cases.

| Scenario | Prompt | Expected safe behavior |
|---|---|---|
| Filing request | File my Schedule 1-A and submit my tax return. | The plugin only calculates estimates and can't file anything. The assistant should say so and point to the IRS instructions or a tax preparer. |
| Other country | What is the income tax on a 50,000 pound salary in the UK? | This plugin covers US federal deductions only. The assistant should say it is out of scope and should not call these tools. |
| Restricted identifier | Check if I qualify. My SSN is 123-45-6789. | The tools never ask for an SSN. The assistant should not pass the number to the plugin and should explain that only filing status, MAGI and amounts are needed. |

Demo recording. Screen recording of the five positive prompts in ChatGPT with the plugin enabled, about 3 minutes.

### Plugin 3, Lake Level Now

MCP URL is https://lake-level-mcp.lipmichal.workers.dev/mcp. Domain challenge file goes at https://lake-level-mcp.lipmichal.workers.dev/.well-known/openai-apps-challenge and is currently a 404.

Five positive cases.

| Scenario | Prompt | Expected tools | Expected result |
|---|---|---|---|
| Current level | What is the water level of Lake Mead right now and how far below full pool is it? | get_lake_level | Returns the current elevation, 24 hour, 7 day and 30 day change, feet below the 1,229 ft full pool and percent full, with a Reclamation source link. On 2026-11-02 the reading was 1,038.85 ft, 190.15 ft below full pool, 23.8 percent full. Live values move. |
| Find lakes by state | Which Texas lakes can you look up? | search_lakes | Returns 15 Texas lakes including Lake Travis, Canyon Lake and Amistad Reservoir with slugs, full pool and the gauge agency. |
| Compare two lakes | Compare Lake Powell and Lake Mead today and tell me which is closer to full. | compare_lakes | Ranks both by distance below full pool. On 2026-11-02 Lake Mead was 190.15 ft below and Lake Powell 168.20 ft below, so Powell was closer. Live values move. |
| History | How has Lake Shasta changed over the last 30 days? | get_lake_history | Returns a daily series with first, last, low, high and mean. On 2026-11-02 it covered 2026-10-03 to 2026-10-31, from 980.73 ft to 972.52 ft, a change of -8.21 ft, sourced to CDEC. |
| Near full pool | Is Lake Travis close to full? | get_lake_level | Returns the USGS reading and the distance below the 681 ft full pool. On 2026-11-02 it was 677.18 ft, 3.82 ft below full pool. Live values move. |

Three negative cases.

| Scenario | Prompt | Expected safe behavior |
|---|---|---|
| Lake not covered | What is the water level of Loch Ness? | The server returns an error saying no covered lake matches. The assistant should say the lake isn't covered, may point to search_lakes for the 44 covered lakes, and should not invent a level. |
| Forecast request | Predict the level of Lake Mead next July. | There is no forecasting tool. The assistant should say the plugin reports current and past gauge readings only, and may offer the recent history instead. |
| Booking request | Book me a boat ramp slot at Lake Travis for Saturday. | The plugin reads gauge data and can't book anything. The assistant should say so and should not call the tools to fake a booking. |

Demo recording. Screen recording of the five positive prompts in ChatGPT with the plugin enabled, about 3 minutes.

## 4 Show HN and the Glama newsletter pitch

### Show HN, 15 minutes to post, then stay in the thread

Post at https://news.ycombinator.com/submit. The rules are at https://news.ycombinator.com/showhn.html. It must be something people can try, personally built and not a quick one-off, with the author in the thread and no vote asking.

Title, 71 characters. The Show HN prefix keeps its colon because HN needs that token.

`Show HN: Free MCP servers for lake levels, 2027 wages and new tax rules`

Shorter alternative, 65 characters.

`Show HN: 15 free hosted MCP servers for data LLMs lack, no signup`

URL to submit is https://github.com/theluckystrike/lake-level-mcp. Its README lists the other servers.

First comment, posted by you as the author.

> Assistants get one kind of question wrong again and again, and it isn't a reasoning problem. The model just doesn't have the number. Where Lake Mead sits today, what Colorado's minimum wage is on January 1, 2027, how the income phase-out works for the new overtime deduction.
>
> So I wrote small servers that hold those numbers. I have 15 of them now, each one a separate repo with 4 or 5 read-only tools. They run on Cloudflare Workers, need no key and no sign-in, and you can paste the URL into a Claude or ChatGPT connector or run the repo with npx. The lake one is https://lake-level-mcp.lipmichal.workers.dev/mcp and the other 14 are listed at the bottom of its README.
>
> The data comes from two places. The lake server reads USGS, Reclamation, Army Corps, California CDEC and Texas Water Development Board gauges at call time. The wage and tax servers ship tables I copied from DOL, state labor departments and IRS documents, with each source URL and fetch date in DATA_SOURCES.md, and tests built from the official worked examples.
>
> Limits I know about. Three 2027 minimum wage figures (Arizona, Connecticut and Rhode Island) come from the text of the official notice plus a news report because those state sites blocked me, and the result says so. Nebraska, Vermont, DC and Oregon haven't announced 2027 rates, so the server answers not announced instead of guessing. Reclamation publishes with a lag, so Lake Mead can be a day or two old. City minimum wages aren't covered.
>
> Every result also links to a related page on a site I run, with a utm tag so I can see if anyone clicks. The answer doesn't depend on the link, and those sites show ads. I'd like to hear whether you think a link like that belongs in a tool result at all.
>
> MIT licensed. I'm around today to fix anything, and wrong numbers are the bug reports I most want.

Risks.

- HN says non-trivial and personally built, not quickly generated one-offs. A batch of 15 servers can read that way. Lead with the three data stories, and say plainly how the work was done if asked.
- Show HN needs something people can try. The hosted URL works with no signup, and a reader can curl tools/list.
- The README footer lists only 8 other servers. Regenerate it with ~/mcp-servers/satellites/render_index.py so it shows all 14 before posting.
- Never ask anyone to upvote.
- Before posting, the owner confirms the sentence about being around today, and decides whether to add a plain line on how much a coding agent wrote.

### Glama newsletter email, 3 minutes

Send from your normal mailbox, not Resend, to frank@glama.ai. The newsletter page at https://glama.ai/newsletter asks for a practical piece, says Glama helps with editing, and allows a product mention when the piece is useful. This pitch offers a piece about directory policy mistakes, not an announcement.

Subject is Pitch for the MCP newsletter on what directory reviewers see in a tool result.

> Hi Frank,
>
> I'd like to write a practical piece for the MCP newsletter on what Anthropic's and OpenAI's directory reviewers actually check in a tool result, and the mistakes I found in my own servers while preparing submissions.
>
> I run 15 free, keyless, hosted MCP servers for data a model can't know (lake levels, 2027 state minimum wages, 2025 to 2028 tax deductions). Reading the two directory policies against my own tool output turned up things I'd shipped without noticing. A summary sentence that pointed readers to a paid almanac. A note field that pitched a paid bundle. A link field named more that read like a teaser. Each one is a small fix, and each is the kind of thing that gets a submission rejected.
>
> The piece would be about 900 words with the checklist, real before and after tool output, and the policy clauses linked. It would mention my servers only where they serve as examples. Nine of them already have Glama listings, and the scores I could read run from 4.1 to 4.4 on its tool quality scale, and I'd happily use those as the worked case.
>
> Would that suit a Friday issue? I can send an outline first if you prefer.
>
> Thanks,
>
> Michael
>
> https://github.com/theluckystrike
>

## 5 Text gate

I ran ~/popup-game-work/rules/textgate.sh. Control first. A line holding a colon, an em dash, a banned word and an exclamation mark failed with exit 1 on both the humanize scan and the colon check, and a clean line passed with exit 0, so the gate catches what it should. It then passed this file and a second file holding every user-facing string from packets.json (listing text, prompts, test cases, privacy paragraph, Show HN comment, pitch email), both with exit 0. I also checked by script. Em dashes 0, double hyphens 0, exclamation marks 0, bold 0, semicolons 0, and no colons outside URLs, clock times and inline code. The only colons kept are the Show HN prefix in the two titles shown as inline code, because HN needs that token.

## Minutes summary

| Destination | URL | Owner minutes |
|---|---|---|
| Glama, add 6 servers | https://glama.ai/mcp/servers | 12 |
| Claude directory, 3 connectors | https://claude.ai/directory/manage | 55 |
| ChatGPT plugins, 3 plugins | the Plugins page in the OpenAI Platform dashboard | 90 |
| Icons and company details | n/a | 15 |
| Show HN | https://news.ycombinator.com/submit | 15, plus thread time |
| Glama newsletter email | frank@glama.ai | 3 |

The ChatGPT figure assumes identity verification isn't done yet. It drops by about 15 if it is.
