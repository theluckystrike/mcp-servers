# S1030 strategy, 2026-10-30

## The cold numbers that set the plan

| measure | value | source |
|---|---|---|
| MCP Stripe paid sessions, all time | 0 | CLAUDE.md R38, data/r38_kpi_final_audit.json |
| Google impressions / clicks, 28 days, mcp.zovo.one | 38 / 0 | R38 GSC finalized Sep 26-Oct 23 |
| Real calls to 27 listed Claude/ChatGPT directory apps, ~10 days | 45 | memory plugin-run-20261020 |
| GitHub repos tagged mcp-server (supply) | 26,879 on 2026-09-02 | platform-analysis-2026 RESULTS.md V3 |
| Claude connector directory size | 4,065 | memory claude-connectors-directory-pipeline |
| Blind assistant named an estate server | 9 of 18 buyer questions | docs/BLIND_RECOMMENDATION_R8.md |
| Small-field GitHub queries where we surface | 22-32 of 34, 15 at rank one | docs/GH_SEARCH_R2.md |

## Conclusions

1. The biggest win across all sprints is not revenue. It is that an unprimed assistant recommends
   an estate server for half of buyer questions, and that we take rank one on most small GitHub
   fields. Discovery by AI already works. Demand for what is discovered does not.
2. Back-office file jobs (invoice, VAT, PDF, spreadsheet) are what frontier models now do natively.
   A paid MCP for a job the model already does has near-zero willingness to pay. 58 servers, $0.
3. Per-listing MCP demand is a few calls per week even inside the official directories. Selling
   MCP servers one by one cannot reach meaningful revenue at any plausible conversion rate.
   At $19 and a generous 2% conversion, $1,000/month needs ~2,600 qualified visits/month.
4. Therefore MCP is a distribution channel, not the product. The money sites (noovertimetax,
   statewage, lakelevelnow, dscrradar, mcp.zovo.one bundle) already monetize. Each MCP result that
   cites them is an organic visit that no search ranking was needed for.
5. Build only what a model cannot do alone: rules newer than its training data, live data, exact
   calendar arithmetic. Place each in a field with 0-3 GitHub competitors, where rank one is free.

## This session

Five data satellites, each a one-server public repo, hosted on Workers with no token, listed in
the official registry (which feeds the GitHub/VS Code MCP gallery and Glama), every result linking
to its money site with UTM tags so the traffic is measurable in GA4.

## Owner unlocks, ranked by return per minute

1. `npm login` (5 min). 58 + 5 packages become installable by name and readable by every
   directory and model that indexes npm. Largest single multiplier left.
2. Glama claim of theluckystrike repos (5 min, glama.ai login). Unblocks the 97k-star
   punkpeye/awesome-mcp-servers PRs whose maintainer asked for exactly that.
3. Outreach. Resend already works (zovo.one verified). What is missing is consented recipients,
   not a sender. Highest-yield legitimate list: the ~10 MCP newsletter and directory editors
   (PulseMCP, mcp.so, Smithery, the awesome-list maintainers) who accept submissions, plus the
   existing Zovo/BLN extension users who opted into updates. Cold scraped lists break Resend's
   acceptable-use policy and would burn the zovo.one domain that the paid licence emails use.
