import json, os
ROOT='/Users/mike/mcp-servers/apify'
actors={a['dir']:a for a in json.load(open(ROOT+'/actors.json'))}

C = {}
C['section-179-deduction-calculator-mcp'] = dict(
 short='section-179',
 intro="This Actor is a **Section 179 deduction calculator** that AI agents and MCP clients can call: Claude, ChatGPT developer mode, Cursor, VS Code, Cline and any agent that speaks the Model Context Protocol (MCP). It returns the exact 2025 and 2026 federal numbers after the One Big Beautiful Bill Act (OBBBA, P.L. 119-21), with the IRS document cited in every answer.",
 why=[
  "The Section 179 limit is **$2,500,000 for 2025** and **$2,560,000 for 2026** (Rev. Proc. 2025-32), with the phase-out starting at $4,000,000 / $4,090,000. Models trained before OBBBA still quote the old limits.",
  "**Bonus depreciation is 100% again** for property acquired after January 19, 2025. The acquisition date is the date of a written binding contract, not delivery. Property acquired on or before that date and placed in service in 2025 gets 40%.",
  "The 2026 heavy SUV Section 179 cap is **$32,000** and the first-year cap on a passenger car of 6,000 lb or less is **$20,300 with bonus** (Rev. Proc. 2026-15).",
  "The IRS has not published the 2027 limits yet (checked 2026-11-02). The tools say so instead of guessing.",
 ],
 tools=[
  ("calculate_section_179","Section 179 deduction with the annual limit, the dollar-for-dollar phase-out, the business income limit and the carryover."),
  ("calculate_bonus_depreciation","Bonus depreciation rate and amount from the acquisition and placed-in-service dates, applied after Section 179. Handles the 40% / 60% election and the phase-down for older property."),
  ("get_vehicle_depreciation_limits","First-year limits by gross vehicle weight: passenger auto caps, heavy SUV Section 179 cap, no cap over 14,000 lb, the over-50% business use rule."),
  ("calculate_asset_loan_payment","Monthly payment, total and first-year interest for an equipment, truck, tractor, RV, land or other asset loan, plus first-year net cash and lifetime after-tax cost for business use."),
 ],
 prompts=["I am buying a $180,000 excavator in December 2026. How much can I deduct this year with Section 179 and bonus depreciation?",
          "My new SUV weighs 6,400 lb and costs $82,000. What is the 2026 first-year deduction limit if I use it 80% for business?",
          "Compare financing a $95,000 farm tractor over 60 months at 7.5% and what it costs after tax at a 24% marginal rate."],
 data="Rules and limits come from IRS revenue procedures and Form 4562 instructions (irs.gov), recorded with an `as_of` date and a `source` field on every result. Source list: `DATA_SOURCES.md` in the repository.",
 disclaimer="Estimates for planning, not tax advice. Check Form 4562, its instructions and Pub. 946, or ask a tax professional before you file.",
 faq=[("Does it call the internet?","No. The calculations run inside the Actor from the bundled IRS tables, so results are fast and do not depend on a third-party API."),
      ("Which tax years are covered?","2025 and 2026. For 2027 the tools report that the IRS has not published the limits."),
      ("Is it affiliated with the IRS?","No. It applies published IRS rules and links to the irs.gov document it used.")],
 repo='section-179-deduction-calculator-mcp',
 tags='Section 179 deduction calculator, Section 179 limit 2026, bonus depreciation calculator, OBBBA depreciation, heavy SUV deduction, equipment loan calculator, Form 4562, MCP server for tax')

C['car-loan-interest-deduction-calculator-mcp'] = dict(
 short='car-loan-interest',
 intro="This Actor is a **car loan interest deduction calculator** for AI agents and MCP clients (Claude, ChatGPT developer mode, Cursor, VS Code, Cline and others). It applies the 2025-2028 deduction created by the One Big Beautiful Bill Act (OBBBA, P.L. 119-21) and also covers the new SALT cap, the child tax credit and the 2025 and 2026 federal brackets, citing the IRS source for each answer.",
 why=[
  "The **car loan interest deduction started in tax year 2025**, after most models were trained. You can take it without itemizing.",
  "The cap is $10,000 a year and the **phase-out is $200 for each $1,000 (or part of $1,000)** of modified adjusted gross income over $100,000 ($200,000 joint). One dollar over a step removes a whole $200.",
  "Only **new vehicles with final assembly in the US** qualify, the loan must be originated after December 31, 2024, and leases never count.",
  "The **SALT cap is $40,000 for 2025 and $40,400 for 2026**, not $10,000, shrinking by 30 cents per dollar above $500,000 of MAGI but never below $10,000. The 2026 standard deduction is $16,100 single and $32,200 joint.",
 ],
 tools=[
  ("calculate_car_loan_interest_deduction","Deduction after the $10,000 cap and the MAGI phase-out, with a check of the vehicle and loan tests: new, US final assembly, personal use, loan date, weight, first lien, not a lease."),
  ("calculate_salt_deduction","Deductible state and local tax under the SALT cap for 2025-2030, the 30% phase-down and the $10,000 floor, optionally compared with the standard deduction."),
  ("get_tax_brackets_and_standard_deduction","2025 and 2026 brackets and standard deductions, the extra amount for age 65 or blind, and the tax and marginal rate on a given taxable income."),
  ("calculate_child_tax_credit","$2,200 per child and $500 per other dependent, the 5% phase-out, the tax liability limit and the refundable part up to $1,700 per child."),
 ],
 prompts=["I bought a new Ford F-150 built in Michigan in March 2025 and paid $3,200 of interest. My MAGI is $105,000 and I file single. What is my car loan interest deduction?",
          "How much SALT can a married couple with $620,000 MAGI and $52,000 of state taxes deduct in 2026?",
          "What are the 2026 federal tax brackets and what is the tax on $85,000 of taxable income, head of household?"],
 data="Rules and amounts come from IRS forms and revenue procedures (Schedule 1-A, Rev. Proc. 2025-32 and others on irs.gov). Every result carries `as_of` and `source`. Source list: `DATA_SOURCES.md` in the repository.",
 disclaimer="Estimates for planning, not tax advice. Check the Schedule 1-A instructions or ask a tax professional before you file.",
 faq=[("Does it need my personal data?","It needs only the numbers you give it (filing status, MAGI, interest paid). Nothing is stored by the calculator."),
      ("Which years does it cover?","The car loan deduction for 2025-2028, SALT for 2025-2030, brackets and child tax credit for 2025 and 2026. Missing years are reported as not yet published."),
      ("Does it call the internet?","No. It runs from the bundled IRS tables.")],
 repo='car-loan-interest-deduction-calculator-mcp',
 tags='car loan interest deduction calculator, OBBBA car loan interest, Schedule 1-A, SALT cap calculator 2026, child tax credit calculator, 2026 tax brackets, MCP server for tax')

C['subdomain-finder-mcp'] = dict(
 short='subdomain-finder',
 intro="This Actor is a **passive subdomain finder** for AI agents and MCP clients (Claude, ChatGPT developer mode, Cursor, VS Code, Cline and others). It reads public **certificate transparency (CT) logs** (certspotter and crt.sh), merges and cleans the names, and can check them with **DNS over HTTPS** to show which hosts are live and which CNAMEs dangle. It needs no API key.",
 why=[
  "A domain's **current subdomains**: new hosts show up in CT logs within minutes of getting a certificate. A model's training data is months old and never had most of them.",
  "Which hosts **resolve right now**, which CNAMEs point at a deleted cloud resource (subdomain takeover candidates), and whether the zone has wildcard DNS.",
  "**Certificate history**: when each name first got a certificate, which CAs issued it, every SAN, revocation status and when the current one expires.",
  "Clean CT parsing: precertificate and certificate rows merged, e-mail SANs and out-of-scope names dropped, `*.` entries reported as wildcards instead of hosts.",
 ],
 tools=[
  ("find_subdomains","Deduplicated hostnames for a domain from CT logs, with first seen, last seen, valid until, certificate count, issuers and a wildcard flag. Optional DNS check of up to 40 names."),
  ("resolve_subdomains","A, AAAA and CNAME chain for up to 40 hosts. Marks live, NXDOMAIN, no records and dangling CNAMEs, names the cloud service behind a CNAME, and detects wildcard DNS."),
  ("get_certificate_history","Certificates for one host: issuer, validity dates, every SAN, revocation status and SHA-256, plus first and latest issuance."),
  ("summarize_attack_surface","The domain's hostnames grouped into development and test, staging, admin, API, auth, mail, remote access, storage and legacy, with naming clusters and the newest names."),
 ],
 prompts=["Find subdomains of example.org from certificate transparency and tell me which look like staging or admin hosts.",
          "Which of these hosts have dangling CNAMEs? api.example.org, old.example.org, shop.example.org",
          "Show the certificate history for login.example.org and when the current certificate expires."],
 data="Public CT logs (certspotter, crt.sh) and Cloudflare DNS over HTTPS, queried at call time. Every result carries `as_of` and the `source` query URL.",
 disclaimer="Passive and read-only: it reads public CT logs and public DNS and sends nothing to the target's servers. No port scanning, no HTTP probing, no brute-force wordlists. Use it on domains you own or are authorised to test, for example inside a bug bounty program's scope. CT logs only list names that received a public certificate, so some hosts will not appear.",
 faq=[("Is this a subdomain scanner that touches the target?","No. It only queries public certificate logs and public DNS resolvers."),
      ("Do I need certspotter or crt.sh keys?","No. It uses the public endpoints and falls back between them. Very large domains are capped per call."),
      ("Can it find every subdomain?","No. Hosts that never had a public certificate (internal names, plain HTTP) do not appear in CT.")],
 repo='subdomain-finder-mcp',
 tags='subdomain finder, subdomain enumeration, certificate transparency search, crt.sh API, certspotter, dangling CNAME checker, bug bounty recon, attack surface, MCP server')

C['ab-test-sample-size-calculator-mcp'] = dict(
 short='ab-test-calculator',
 intro="This Actor is an **A/B test sample size calculator** and significance-test toolkit for AI agents and MCP clients (Claude, ChatGPT developer mode, Cursor, VS Code, Cline and others). It works out how many users a test needs, how long it must run, whether a result is significant (z-test, chi-square, Fisher exact), the **Fisher-Freeman-Halton exact test** for larger tables, and how much **peeking** inflates false positives. It needs no API key and makes no network calls.",
 why=[
  "**Exact quantiles and the full formula.** Models round z-values, drop the pooled variance term or confuse relative and absolute MDE, and the answer moves by thousands of users.",
  "**Why calculators disagree.** Results show the standard pooled formula (as R `power.prop.test`) next to Evan Miller's published formula, so a 31,234 vs 30,244 gap has an explanation.",
  "**Exact hypergeometric sums.** A Fisher-Freeman-Halton p-value for a 4 x 4 table needs millions of tables summed. It cannot be estimated in your head.",
  "**Sequential testing numbers.** Checking a test 5 times at p < 0.05 gives a 14.2% false positive rate. The tool returns the Pocock and O'Brien-Fleming boundaries that fix it.",
 ],
 tools=[
  ("calculate_sample_size","Users per variant for a conversion-rate test: baseline, relative or absolute MDE, alpha, power, one or two-sided, several variants with optional Bonferroni, unequal splits."),
  ("estimate_test_duration","Days and whole weeks to reach the sample size from daily visitors, traffic share and number of variants."),
  ("test_ab_significance","Two-proportion z-test, p-value, confidence interval, relative lift, chi-square with and without Yates, Fisher exact p and a sample ratio mismatch check."),
  ("fisher_exact_test","Exact p-value for a 2x2 table (two-sided, greater, less) or any r x c table, next to Pearson chi-square and an expected-count check."),
  ("check_peeking_risk","The real false positive rate when a test is checked K times, and Pocock and O'Brien-Fleming boundaries for up to 10 looks."),
 ],
 prompts=["My baseline conversion is 3.2% and I want to detect a 10% relative lift at 80% power. How many visitors per variant, and how long with 4,000 visitors a day?",
          "Control: 12,410 visitors and 612 conversions. Variant: 12,388 visitors and 671 conversions. Is it significant?",
          "I plan to check my test 6 times before it ends. What is my real false positive rate?"],
 data="Closed-form statistics computed in the Actor. Method references are returned in the `source` field of every result.",
 disclaimer="Statistics help you decide, they do not replace experiment design. Check randomisation, sample ratio and metric definitions before you act on a result.",
 faq=[("Does it call an external API?","No. Everything is computed locally, so it is fast and deterministic."),
      ("Can it handle more than two variants?","Yes. Sample size supports several variants with an optional Bonferroni correction; the exact test supports r x c tables."),
      ("Why two sample sizes in one answer?","Different calculators use different formulas. Showing both explains small gaps between tools.")],
 repo='ab-test-sample-size-calculator-mcp',
 tags='A/B test sample size calculator, ab test significance calculator, Fisher exact test, chi-square test, statistical power, sequential testing, peeking problem, MCP server')

C['lake-level-mcp'] = dict(
 short='lake-level',
 intro="This Actor serves **live US lake and reservoir water levels** to AI agents and MCP clients (Claude, ChatGPT developer mode, Cursor, VS Code, Cline and others). It reads USGS, USACE, CDEC, Bureau of Reclamation and TWDB gauges at call time for **44 lakes in 12 states**, including Lake Mead, Lake Powell, Lake Travis, Shasta, Oroville, Folsom, Lake Lanier, Lake Texoma and Kentucky Lake. It needs no API key.",
 why=[
  "**Today's water level.** Lakes move every hour and a model's training data is months old.",
  "**The right gauge for each lake.** The USGS site and parameter, CDEC station, Reclamation RISE item, TWDB reservoir or USACE time series for each lake is already bound and verified.",
  "**Full-pool elevations and seasonal guide curves** (USACE, TVA, Alabama Power), so '8 feet low' can be read against the winter target and not only against summer full pool.",
  "**Feed quirks handled**: unpadded CDEC dates, CWMS loggers that stamp local time as UTC, USGS 15-minute data collapsed to one reading per day.",
 ],
 tools=[
  ("search_lakes","Covered lakes by name, river, operator or state, with slug, full pool and gauge."),
  ("get_lake_level","Current elevation, measurement time, change over 24 hours, 7 days and 30 days, feet below full pool, the operator seasonal target where published, percent full where the agency publishes storage, gauge id and data URL."),
  ("get_lake_history","Daily or weekly elevation series for up to 365 days, with first, last, low, high and mean."),
  ("compare_lakes","2 to 10 lakes side by side, ranked by feet below full pool. A lake whose gauge is down is reported, not fatal."),
 ],
 prompts=["What is the Lake Mead water level today and how far below full pool is it?",
          "Compare Lake Powell, Lake Mead and Lake Travis. Which is lowest relative to full pool?",
          "Show the Shasta Lake elevation for the last 90 days, weekly."],
 data="USGS Water Services, USACE CWMS, California CDEC, Bureau of Reclamation RISE and Texas Water Development Board, read live. Every result carries `as_of`, the agency `source` URL and a link to the matching lake page on lakelevelnow.com.",
 disclaimer="Gauge data is provisional and comes from third-party agencies. It can be delayed or missing when a gauge is down. Do not use it for flood warnings or safety decisions: use the official agency pages.",
 faq=[("How fresh is the data?","Read at call time. The result states the measurement time reported by the agency, which can be hours behind."),
      ("Which lakes are covered?","44 major US lakes in 12 states. Use search_lakes to list them."),
      ("What if a gauge is offline?","The tool reports it for that lake. compare_lakes keeps going for the others.")],
 repo='lake-level-mcp',
 tags='lake level API, lake water levels today, Lake Mead water level, Lake Powell elevation, reservoir levels, USGS water data, feet below full pool, MCP server')

for d,c in C.items():
    a=actors[d]
    name=d
    url=f"https://YOUR_USERNAME--{name}.apify.actor/mcp"
    short=c['short']
    price=a['priceUsd']
    lines=[]
    lines.append(f"# {a['title']}\n")
    lines.append(c['intro']+"\n")
    lines.append(f"**How you use it:** run it in Standby mode and connect your MCP client to `{url}` with your Apify API token. Each successful tool call costs **${price:.2f}**. Listing the tools is free.\n")
    lines.append("## What this MCP server knows that your model does not\n")
    for w in c['why']: lines.append(f"- {w}")
    lines.append("\n## Tools\n")
    lines.append("| Tool | What it returns |\n|---|---|")
    for t,dsc in c['tools']: lines.append(f"| `{t}` | {dsc} |")
    lines.append("\nEvery result has structured JSON, a plain-English summary, `as_of` and `source`, so an agent can quote it and cite it.\n")
    lines.append("## Pricing\n")
    lines.append(f"Pay per event: **${price:.2f} per successful tool call** (event `tool-call`). `initialize`, `tools/list` and failed calls are not charged. In Standby mode Apify also bills the small platform usage of the running container on top of the event price. You can set a maximum charge per run in the Apify Console, and the Actor stops answering tool calls when that limit is reached. A normal (non-Standby) run only performs a free self-check.\n")
    lines.append("## How to connect\n")
    lines.append("1. Create a free Apify account and copy your API token from **Settings > API & Integrations** in the Apify Console.")
    lines.append(f"2. The MCP endpoint is `{url}` (streamable HTTP). Replace `YOUR_USERNAME` with the Apify username that owns this Actor.")
    lines.append("3. Send the token as a Bearer header: `Authorization: Bearer YOUR_APIFY_TOKEN`.\n")
    lines.append("### Claude Code\n")
    lines.append(f"```bash\nclaude mcp add --transport http {short} {url} --header \"Authorization: Bearer $APIFY_TOKEN\"\n```\n")
    lines.append("### Cursor, VS Code, Cline and other clients with remote MCP support\n")
    lines.append(f"```json\n{{\n  \"mcpServers\": {{\n    \"{short}\": {{\n      \"url\": \"{url}\",\n      \"headers\": {{ \"Authorization\": \"Bearer YOUR_APIFY_TOKEN\" }}\n    }}\n  }}\n}}\n```\n")
    lines.append("### Claude Desktop (through the mcp-remote bridge)\n")
    lines.append(f"```json\n{{\n  \"mcpServers\": {{\n    \"{short}\": {{\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"mcp-remote\", \"{url}\", \"--header\", \"Authorization: Bearer YOUR_APIFY_TOKEN\"]\n    }}\n  }}\n}}\n```\n")
    lines.append("### Apify MCP server and the Apify API\n")
    lines.append("You can also reach this Actor through the Apify MCP server (`https://mcp.apify.com`) or call the Standby URL from any HTTP client that speaks MCP.\n")
    lines.append("## Example prompts\n")
    for p in c['prompts']: lines.append(f"- \"{p}\"")
    lines.append("\n## Data and method\n")
    lines.append(c['data']+"\n")
    lines.append("## Limits\n")
    lines.append(c['disclaimer']+"\n")
    lines.append("## FAQ\n")
    for q,ans in c['faq']: lines.append(f"**{q}**  \n{ans}\n")
    lines.append("**How is the Actor run?**  \nThe Actor starts the open-source MCP server bundled in this image (MIT licence) and exposes it over streamable HTTP in Apify Standby mode. It is built from the `apify/actor-templates` MCP proxy template. Source: https://github.com/theluckystrike/"+c['repo']+"\n")
    lines.append("**What is MCP?**  \nThe Model Context Protocol is an open standard that lets AI assistants call tools. See https://modelcontextprotocol.io\n")
    lines.append("## Related searches\n")
    lines.append(c['tags']+"\n")
    open(f"{ROOT}/{d}/README.md",'w').write("\n".join(lines))
    print(d, len("\n".join(lines)))
