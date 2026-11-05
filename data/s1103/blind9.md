# blind9: blind recommendation measurement R9 (2026-11-03)

Procedure: `docs/BLIND_RECOMMENDATION_PROCEDURE.md`. Questions: `data/blind_questions.json` v1 (18, frozen 2026-09-10, sha256 fe25d683...b759e2, unedited). Runner: fresh general-purpose subagent (Agent tool, not a fork), prompt = the 18 questions verbatim plus a neutral research instruction (no estate, zovo, mcpstamp, theluckystrike or lipmichal terms; checked in the runner transcript). Scoring was done by the parent after the runner finished. Single documentary web-search trial: no install, no runtime test, no buyer, no causal claim.

## Headline: R8 vs R9

| Measure | R8 (2026-10-16) | R9 (2026-11-03) |
|---|---|---|
| Named an estate server in the answer (KPI) | 9/18 | **10/18** (11/18 if a caveat-only mention in Q18 is counted) |
| Estate server listed first | 6/18 | 4/18 |
| mcp.zovo.one in the raw results of the verbatim search (diagnostic) | 15/18 | 0/18 |
| theluckystrike or lipmichal in raw results (diagnostic) | 11/18 | 4/18 |
| Questions citing an estate-owned host (URL in answer or recommendation) | 9 (all mcp.zovo.one) | 9 (all claudecodeguides.com) |
| Estate-owned host URLs cited | 14 | 12 |
| Recommendation occurrences, estate / total | 13/30 | 13/49 |
| Distinct recommended servers (runner-reported) | 22 | 35 (42 distinct URLs/names by the R8 definition; includes connectors and docs pages) |
| Raw results per verbatim search (min-max) | 20-65 | 7-20 |

Reading it: the KPI is flat (9 to 10, inside the noise of one trial; questions 4 and 11 gained, 18 lost). Everything underneath moved. First-listed fell 6 to 4. The runner never saw mcp.zovo.one in a verbatim result list (R8: 15/18) and cited none of its pages; every estate citation came from claudecodeguides.com/mcp/<server>/ pages (12 URLs, 9 questions) plus github.com/theluckystrike/mcp-servers. Raw-result diagnostics are NOT comparable across rounds: R9 search returned 7-20 links per query against 20-65 in R8, and the model and search backend differ (R8 runner `gpt-6-astra`, R9 `claude-sonnet-5-5`). The scorer reproduces R8 exactly from its JSON (9 named, 6 first, 15 host, 11 identity), so the scoring rules are the same on both sides; the instrument is not.

### How the 10 were reached (spillover caveat)

Estate text surfaced in the runner's own verbatim search for only 5 of the 10 named questions (4, 11, 13, 14, 15). For 1, 3, 6, 12, 17 the estate was found only by follow-up queries and by fetching sibling pages (claudecodeguides.com/mcp/<server>/, github.com/theluckystrike/mcp-servers/tree/main/servers/<server>) after the runner had learned the brand on other questions. The procedure scores named-in-answer, so the KPI stays 10/18, but a strictly per-question blind reading is 5/18. R8's 9 named all had mcp.zovo.one in their own verbatim results, so R8 had no such spillover. The first estate-term query was the runner's 21st search (after all 18 verbatim searches); 4 of its 34 searches carried an estate term, all after estate content had surfaced in neutral results.

## Per question

R8 = Y if an estate server was named. First = estate server first in the recommended list. Estate hosts cited are in R9 only; R8 cited mcp.zovo.one for every named question. Own-search = estate text appeared in the runner's verbatim search results for that question.

| Q | R8 named | R8 first | R9 named | R9 first | R9 estate servers | R9 own-search | R9 confident | mcp.zovo.one in raw | identity in raw |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Y | Y | Y | - | invoice | - | Y | - (R8 Y) | - (R8 Y) |
| 2 | - | - | - | - | - | - | Y | - (R8 Y) | - (R8 Y) |
| 3 | Y | Y | Y | Y | expense-tracker, mileage-log | - | Y | - (R8 Y) | - (R8 Y) |
| 4 | - | - | Y | - | bank-statement | Y | - | - (R8 Y) | - (R8 Y) |
| 5 | - | - | - | - | - | - | Y | - (R8 Y) | - (R8 Y) |
| 6 | Y | - | Y | Y | docx, quotes | - | Y | - (R8 Y) | - (R8 -) |
| 7 | - | - | - | - | - | - | Y | - (R8 -) | - (R8 -) |
| 8 | - | - | - | - | - | - | Y | - (R8 -) | - (R8 -) |
| 9 | - | - | - | - | - | - | Y | - (R8 Y) | - (R8 Y) |
| 10 | - | - | - | - | - | - | Y | - (R8 Y) | - (R8 -) |
| 11 | - | - | Y | - | barcode | Y | Y | - (R8 -) | Y (R8 Y) |
| 12 | Y | Y | Y | - | zip | - | Y | - (R8 Y) | - (R8 Y) |
| 13 | Y | Y | Y | Y | petty-cash, cash-book | Y | Y | - (R8 Y) | Y (R8 Y) |
| 14 | Y | Y | Y | Y | work-order | Y | - | - (R8 Y) | Y (R8 Y) |
| 15 | Y | Y | Y | - | recurring | Y | Y | - (R8 Y) | Y (R8 Y) |
| 16 | - | - | - | - | - | - | Y | - (R8 Y) | - (R8 -) |
| 17 | Y | - | Y | - | invoice, quotes, bank-statement, expense-tracker | - | Y | - (R8 Y) | - (R8 -) |
| 18 | Y | - | - | - | (caveat only) | - | - | - (R8 Y) | - (R8 -) |

Notes by question:

- Q1: markslorach/invoice-mcp listed first, Zovo Invoice second; the runner says none of the recommended invoice servers were in the verbatim result list (it found them by follow-up).
- Q3, Q6, Q13, Q14: estate server first (expense-tracker, docx, petty-cash, work-order). Q14 is flagged not confident by the runner: it found no delivery-schedule server, only work orders.
- Q4: gained. Zovo Bank Statement named as step 2 (categorise), but the runner read its README as CSV-only and said no single server does PDF plus categorise.
- Q11, Q12, Q15, Q17: estate named but not first (Q17 as "Zovo back-office suite", third of four, with the github.com/theluckystrike/mcp-servers URL).
- Q16 (paste a URL, no install): no estate server named. The runner listed Stripe, Timesheet, Apify, findtime and wesbos currency endpoints. Uncontested question still not owned.
- Q18 (paid servers, how to pay): lost. Estate appears only inside a caveat ("Zovo servers: $19 per server or $39 bundle per their READMEs; I did not find where the purchase is made"). Not counted in the KPI. That sentence is a purchase-path defect: a reader of the estate pages could not find where to buy.

## Source-host counts (cited URLs, de-duplicated per question)

| R8 host | URLs | Qs | | R9 host | URLs | Qs |
|---|---|---|---|---|---|---|
| mcp.zovo.one | 14 | 9 | | github.com | 13 | 10 |
| github.com | 5 | 5 | | claudecodeguides.com | 12 | 9 |
| docexport.ai | 4 | 3 | | docs.stripe.com | 4 | 4 |
| app.docexport.ai | 2 | 2 | | glama.ai | 4 | 4 |
| currency-mcp.wesbos.com | 2 | 2 | | pypi.org | 3 | 3 |
| barcodes.dev | 2 | 1 | | docs.timesheet.io | 2 | 2 |
| learn.microsoft.com | 2 | 1 | | mcp.timesheet.io | 2 | 2 |
| docs.apify.com | 2 | 1 | | currency-mcp.wesbos.com | 2 | 2 |
| quillpdf.com | 1 | 1 | | findtime.io | 2 | 2 |
| myfinance-mcp.com | 1 | 1 | | mcp.findtime.io | 2 | 2 |
| convertstatement.com | 1 | 1 | | mcp.stripe.com | 2 | 2 |
| docs.timesheet.io | 1 | 1 | | docs.apify.com | 2 | 2 |

Estate-owned hosts: mcp.zovo.one, zovo.one, mcpstamp.com, claudecodeguides.com (owner-controlled: `scripts/indexnow_csg.mjs` submits it, `data/s1103/leak.md` scanned its /mcp/ pages including /buy/ links), *.lipmichal.workers.dev. R8: mcp.zovo.one 14 URLs. R9: claudecodeguides.com 12 URLs, mcp.zovo.one 0, mcpstamp.com 0, lipmichal.workers.dev 0. Estate content on third-party hosts in R9: github.com/theluckystrike/mcp-servers (Q17) and mcpservers.org/servers/theluckystrike/* (fetched by the runner, not cited).

## SUPPLEMENT (not part of R9): 10 satellite and /can-claude/ questions

Separate question set frozen BEFORE the run in `data/s1103/blind9/supplement_questions.json` (sha256 7d764812a67f3e95...). Same instrument, same instruction, separate fresh runner. 25 satellites and 12 /can-claude/ pages exist; the 10 questions cover silver price, mileage deduction, per diem, river level, SAT percentiles, 401(k) limits, CPI inflation, business days, no tax on overtime, minimum wage. Not comparable with R8/R9.

**Result: 0 of 10 named an estate server. 0 first-listed. mcp.zovo.one, mcpstamp.com and *.lipmichal.workers.dev in raw results: 0 of 10, and none in any page the runner fetched (37 fetches, 34 searches).** The only estate string anywhere was one raw result at rank 10 of Q3: mcpservers.org/servers/theluckystrike/mcp-per-diem (the back-office per-diem server, not the irs-mileage-rate-per-diem satellite); the runner recommended gsa-perdiem-mcp (1102tools) instead. The runner flagged Q5 (SAT) and Q6 (401k) as no confident MCP answer; Q2 and Q9 were answered with IRS pages and arithmetic, not a server.

| Q | Question | Runner recommendation (first) | Confident |
|---|---|---|---|
| 1 | Is there an MCP server that gives the current silver price per gram? | MetalCharts MCP (get_spot_prices, XAG per gram, any currency; free plan needs si | Y |
| 2 | How can Claude calculate my 2026 mileage deduction? | (non-MCP) IRS Standard Mileage Rates page, used as the rate table with Claude do | Y |
| 3 | Is there an MCP server that looks up the current IRS per diem rates for a city? | gsa-perdiem-mcp by 1102tools (GSA Per Diem API, 7 tools, CONUS) | Y |
| 4 | What MCP server can tell Claude the current water level of a river? | cyanheads/usgs-water-mcp-server (USGS NWIS, 9 tools, no key, Apache-2.0) | Y |
| 5 | Can Claude look up SAT score percentiles? Is there an MCP server for that? | (non-MCP fallback, not a server) College Board SAT Understanding Scores percenti | - |
| 6 | Is there an MCP server that knows the current 401(k) contribution limits? | calcnook-mcp (conditional, low confidence; v0.1.1, 4 commits, 401(k) tool presen | - |
| 7 | How can I get Claude to adjust a dollar amount for inflation using real CPI data? | econstats-mcp (inflation_adjust, CPI-U; FRED key required; MIT) | Y |
| 8 | Is there an MCP server that counts business days between two dates, excluding US federal holidays? | SummitFlow MCP (business_days_between: weekends and US federal holidays; MIT; no | Y |
| 9 | How can Claude calculate the new no tax on overtime deduction? | (non-MCP) IRS One Big Beautiful Bill Act deductions page: cap, MAGI thresholds,  | Y |
| 10 | Is there an MCP server that looks up the minimum wage for a US state or city? | Nero Labs US Minimum Wage by Address and Date (free hosted MCP endpoint; paid Ap | Y |

Cited hosts (supplement): github.com 7, glama.ai 4, irs.gov 4, metalcharts.org 1, api.metalcharts.org 1, journalofaccountancy.com 1, research.collegeboard.org 1, apify.com 1, us-minimum-wage.nerolabs.workers.dev 1.

Reading it: where a satellite is the exact answer (silver per gram, mileage/per diem, river level, SAT percentiles, 401k, CPI, business days, no tax on overtime, minimum wage) no assistant research surfaced it. This is a retrieval failure, not a rejection: the satellites never appeared in 176 raw results across the ten verbatim searches. Competitors that won are single-purpose GitHub/Glama/Apify listings (MetalCharts, cyanheads/usgs-water-mcp-server, 1102tools gsa-perdiem-mcp, SummitFlow, Nero Labs minimum wage). mcpstamp.com has been indexed only about 4 days (`data/s1103/stamp.md`).

## Instrument integrity and limits

- Runner prompt files: `r9_runner_prompt.txt`, `supplement_runner_prompt.txt` (extracted from the runner transcripts; all questions present verbatim; no estate terms). Raw runner output: `r9_raw.json`, `supplement_raw.json`; the runner raw result lists match the search tool output in the transcripts for all 28 verbatim searches.
- Runner tools: R9 34 WebSearch, 74 WebFetch, 1 Write, 2 Bash (mkdir, JSON parse check); no local file reads. Supplement 34 WebSearch, 37 WebFetch, 1 Write, 1 Bash.
- Residual priming exposure that the Agent tool does not let me remove: a probe subagent (separate, never given the questions) listed what a general-purpose subagent started from this cwd can see: the cwd name mcp-servers, the memory index, the global ~/.claude/CLAUDE.md and a config path containing ".claude-zovo-team2". By its own report (a Haiku probe, so a self-report) it did NOT see the project CLAUDE.md, estate domains, theluckystrike, or any measurement number. The runner did not use any of those in a query before estate content appeared in neutral results.
- Different model and search backend from R8. Differences of one question (9 vs 10) are not a trend. A second R9-style run would show the variance; this lane ran one.
- Not measured: whether anyone installs, pays or visits. The estate still has $0 MCP Stripe gross all time (BRIEF.md, not re-derived here).

## What this says for the next sprint

1. The estate is recommended from owned pages and from GitHub. R8 relied on mcp.zovo.one guides, which the runner never retrieved in R9; claudecodeguides.com/mcp/ carried the load. Retrieval of the zovo.one guides is the open diagnostic, not content.
2. Q18 failed on purchase path: a runner that reached the $19/$39 price could not find where to buy. That is a page defect an assistant will repeat to a buyer.
3. Q16 stays unowned although 30 hosted endpoints exist; no assistant named any.
4. Satellites and /can-claude/ pages are invisible to assistant research so far (0/10). Indexing, not copy, is the gap; re-run the supplement after the pages age.

## Reproduce

`python3 -I ~/mcp-servers/data/s1103/blind9/score.py ~/mcp-servers/data/blind_recommendation_r8.json` (prints 9 named, 6 first, 15 host, 11 identity: the control). Scoring and audit: `data/s1103/blind9/build.py` (reads runner transcripts under ~/.claude-zovo-team2/projects/-Users-mike/*/subagents/agent-a5abbce40d16d064b.jsonl and agent-ad02314099cb616a4.jsonl and the raw JSON files above). Pre-run checks: `df -g /System/Volumes/Data` 37 GB Avail; `memory_pressure | tail -1` 63-65% free.
