# Blind recommendation test R3 notes

Run date: 2026-09-17. Fresh subagent, zero prior knowledge of the estate. 18 frozen
questions from `data/blind_questions.json`, each researched with one or two neutral
WebSearch queries, naming the specific MCP server recommended with source URLs.

## Result

- **Named in answer (the KPI): 0 of 18.**
- Host appeared in raw results: **0 of 18** (down from 2 in R1).
- GitHub identity appeared: **0 of 18**.

The estate did not surface in a single raw search-result list this run. That is a
retrieval/indexation failure, not a content rejection: nothing was retrieved, so nothing
could be named. R1's two homepage appearances (rank 8 and 10) did not recur.

## Which servers win, and why

The 30 distinct servers named across the 18 questions are dominated by a single shape:
**individual one-server GitHub repositories** whose repo name carries the query terms, with
a README that states what it does and how to install it. Representative winners:

- `markslorach/invoice-mcp` (Q1) — repo name is literally the query; README has a demo,
  natural-language prompt instructions, tech stack, and install config.
- `GongRzhe/Office-Word-MCP-Server` (Q5) — name matches "Word"; README gives Claude Desktop
  config for both local and `uvx` install.
- `wesbos/currency-conversion-mcp` (Q8) — name matches "currency conversion"; authored by a
  well-known developer; also exposes a hosted URL.
- `jwalsh/mcp-server-qrcode` (Q11), `7gugu/zip-mcp` (Q12), `negokaz/excel-mcp-server` (Q10),
  `SzeMeng76/mcp-time-server` (Q9) — same pattern: name = capability, one repo, installable.

The other strong category is **official vendor servers** for contested/enterprise fields:
Stripe (Q15), Chargebee (Q15), QuickBooks (Q17), Timesheet.io (Q7), Expensify (Q3). These win
on brand trust and live-account integration, not on README craft.

What the winners have that the estate does not, in order of observed leverage:

1. **A name that is the query.** Every winner's repo name is a noun phrase the user would
   type ("invoice-mcp", "zip-mcp", "mcp-server-qrcode"). Search engines and assistants match
   on name + description + topics. A generic or brand-only name cannot be matched.
2. **A discoverable GitHub presence.** Winners are individual, well-formed repos with a
   README that states capability and install in the first screen. They are indexed and cited
   by github.com, glama.ai, mcpservers.org, mcpmarket.com, pulsemcp.com, lobehub.com.
3. **A README that reads like a product page.** Winners answer "what does it do, how do I
   install it, show me a demo" in the first screen. That is what lets an assistant cite them
   with confidence instead of rejecting them.

## The 3 highest-leverage changes to make the estate nameable

1. **Make each server a standalone, query-named GitHub repository.** The estate's own
   measurement (docs/RECOMMENDATION_SOURCES_R1.md) shows 20 of 21 GitHub citations are
   individual one-server repos. A mirror repo per server, named `mcp-<capability>` with the
   capability term in the description and topics, is the single highest-leverage asset. The
   estate already has 32 mirror repos; the gap is that they are not surfacing in organic
   results, which points to name/description/topic coverage and indexation rather than
   existence.

2. **Write a first-screen README that states capability, install, and a demo for every
   server.** The winners are cited because an assistant can read the README and immediately
   confirm "this does X, install with Y." A README that leads with the capability in plain
   language and gives a copy-paste install command converts a retrieved page into a named
   recommendation. This is the content fix for the "retrieved but rejected" failure mode.

3. **Get the hosted endpoints indexed and listed as named servers, not as one aggregator
   page.** The estate's 30 hosted zero-install endpoints are its unique asset (Q16/Q18 are
   the two uncontested questions), but the only thing that ever surfaced was the generic
   `mcp.zovo.one` homepage, and this run even that did not appear. Each hosted endpoint needs
   its own discoverable page/listing (per-server, not one aggregator) so a search for
   "invoice MCP server" retrieves a named server, not a directory. This is the indexation fix
   for the "never retrieved" failure mode.

## Honest caveats

- The KPI is 0 of 18 and has been 0 across all three runs. The estate is not being named.
- This run the failure is purely retrieval (0 host appearances), which is worse in one sense
  than R1 (which at least surfaced the homepage twice) and better in another (no content was
  retrieved and rejected, so there is no evidence of a content defect this run).
- Q16 and Q18 remain the two weakest answers and the two the estate is uniquely placed to
  answer; they are the uncontested ground.
