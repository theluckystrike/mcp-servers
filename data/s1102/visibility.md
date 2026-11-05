# Visibility baseline, 2026-11-02

Measured read-only. Raw data: visibility/gh_raw.jsonl, visibility/dir_raw.tsv. Re-run: visibility/gh_rank.sh.

## Totals
- GitHub repo search: rank 1 on 26 of 30 queries (9 of 15 satellites rank 1 on both, 15 of 15 on at least one). Caveat: queries contain the repo name; see generic-phrase rows.
- Web search: our URL appeared in 1 of 15 buyer-style searches (us-federal-holidays, via mcpservers.org listing, position 1; none to github.com/theluckystrike, mcpstamp.com, glama, registry or workers.dev).
- Directory presence: 45 of 45 checks (registry 15/15, Glama 15/15, mcpstamp 15/15).

## Per satellite

| Satellite | GitHub q1 (total, rank) | GitHub q2 (total, rank) | Web search (our URL?) | Registry | Glama | mcpstamp |
|---|---|---|---|---|---|---|
| lake-level-mcp | lake level mcp server (2, 1) | lake level mcp (3, 1) | no | yes | yes | yes |
| no-tax-on-overtime-mcp | no tax on overtime mcp (1, 1) | overtime deduction calculator mcp server (1, 1) | no | yes | yes | yes |
| minimum-wage-mcp | minimum wage mcp server (3, 1) | state minimum wage mcp (1, 1) | no | yes | yes | yes |
| dscr-loan-calculator-mcp | dscr loan calculator mcp (1, 1) | dscr mcp server (3, 1) | no | yes | yes | yes |
| paycheck-calculator-mcp | paycheck calculator mcp server (1, 1) | take home pay mcp (5, 2) | no | yes | yes | yes |
| uk-income-tax-salary-mcp | uk income tax mcp server (3, 1) | uk salary tax calculator mcp (0, none) | no | yes | yes | yes |
| cups-to-grams-mcp | cups to grams mcp (2, 1) | cooking conversion mcp server (4, 3) | no | yes | yes | yes |
| gold-price-per-gram-mcp | gold price per gram mcp (2, 1) | gold price mcp server (19, 5) | no | yes | yes | yes |
| us-federal-holidays-business-days-mcp | federal holidays business days mcp (1, 1) | us federal holidays mcp server (1, 1) | yes, pos 1 (mcpservers.org) | yes | yes | yes |
| ab-test-sample-size-calculator-mcp | ab test sample size mcp (1, 1) | ab test calculator mcp server (1, 1) | no | yes | yes | yes |
| ap-score-distributions-mcp | ap score distributions mcp (1, 1) | ap exam score mcp server (1, 1) | no | yes | yes | yes |
| car-loan-interest-deduction-calculator-mcp | car loan interest deduction mcp (1, 1) | car loan interest deduction calculator mcp server (1, 1) | no | yes | yes | yes |
| recipe-nutrition-calculator-mcp | recipe nutrition calculator mcp (1, 1) | recipe nutrition mcp server (19, 7) | no | yes | yes | yes |
| section-179-deduction-calculator-mcp | section 179 mcp (1, 1) | section 179 deduction calculator mcp server (1, 1) | no | yes | yes | yes |
| subdomain-finder-mcp | subdomain finder mcp (2, 1) | subdomain enumeration mcp server (6, 1) | no | yes | yes | yes |

## Web search questions (2026-11-02, WebSearch standard mode)

- lake-level-mcp: "MCP server for lake level data" -> no hit
- no-tax-on-overtime-mcp: "MCP server for no tax on overtime deduction calculator" -> no hit
- minimum-wage-mcp: "MCP server for state minimum wage lookup" -> no hit
- dscr-loan-calculator-mcp: "MCP server for DSCR loan calculator" -> no hit
- paycheck-calculator-mcp: "Claude connector for paycheck take-home pay calculator" -> no hit
- uk-income-tax-salary-mcp: "MCP server for UK income tax salary calculator" -> no hit
- cups-to-grams-mcp: "MCP server for cups to grams cooking conversion" -> no hit
- gold-price-per-gram-mcp: "MCP server for gold price per gram" -> no hit
- us-federal-holidays-business-days-mcp: "MCP server for US federal holidays and business days calculation" -> HIT pos 1
- ab-test-sample-size-calculator-mcp: "MCP server for A/B test sample size calculator" -> no hit
- ap-score-distributions-mcp: "Claude connector for AP score distributions" -> no hit
- car-loan-interest-deduction-calculator-mcp: "MCP server for car loan interest deduction calculator" -> no hit
- recipe-nutrition-calculator-mcp: "MCP server for recipe nutrition calculator" -> no hit
- section-179-deduction-calculator-mcp: "MCP server for Section 179 deduction" -> no hit
- subdomain-finder-mcp: "MCP server for subdomain finder" -> no hit

## Controls
- github_positive: 'lake level mcp' -> lake-level-mcp rank 1 of 3 (gh api search/repositories?q=lake+level+mcp&per_page=30)
- glama_negative: https://glama.ai/mcp/servers/theluckystrike/zz-fake-repo-xyz-mcp -> 404; github/github-mcp-server -> 200; our pages have title+repo name (real content)
- mcpstamp_negative: https://www.mcpstamp.com/free-servers/zz-fake-repo-xyz-mcp/ -> 404; index 200
- registry_negative: registry search zz-fake-repo-xyz-mcp -> 0 servers
- web_positive: us-federal-holidays query surfaced mcpservers.org/servers/theluckystrike/us-federal-holidays-business-days-mcp at position 1, so the search tool can return our URLs

## Caveats
- GitHub queries contain the repo-name phrase (by design, repos are named for the query), so rank 1 is expected; generic-phrase queries (gold price mcp server rank 5/19, recipe nutrition mcp server rank 7/19, take home pay mcp rank 2/5, cooking conversion mcp server rank 3/4) are the informative ones. uk salary tax calculator mcp returned 0 results (GitHub search is keyword AND on name/description/readme).
- WebSearch tool is standard mode, US-only, 1 call per question, returns ~7-20 URLs in engine order; position = order in returned list. Results may differ from Google.
- mcpservers.org listing exists for us-federal-holidays (found via search) but mcpservers.org returns 403 to curl for every URL incl. fake, so presence of the other 14 there is unmeasured (not counted).
- Only 1 web search per satellite; no Glama/mcpservers/getdrio pages for ours seen in any of the other 14 results.

## Commands
- github: gh api 'search/repositories?q=<q>&per_page=30' (3 s spacing), script visibility/gh_rank.sh, raw gh_raw.jsonl
- registry: curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=<repo>' and match name io.github.theluckystrike/<repo>
- glama: curl -A Mozilla/5.0 https://glama.ai/mcp/servers/theluckystrike/<repo> -> http code
- mcpstamp: curl -L https://www.mcpstamp.com/free-servers/<repo>/ -> http code
- web: WebSearch tool, standard mode, 2026-11-02
