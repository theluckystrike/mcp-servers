# niche-lists (s1102), 2026-11-02

## PRs opened (3 of max 8)
- subdomain-finder-mcp: https://github.com/edoardottt/awesome-hacker-search-engines/pull/389 (edoardottt/awesome-hacker-search-engines, 11453 stars)
- ab-test-sample-size-calculator-mcp: https://github.com/PavelGrigoryevDS/awesome-data-analysis/pull/113 (PavelGrigoryevDS/awesome-data-analysis, 2159 stars)
- minimum-wage-mcp: https://github.com/hanlulong/awesome-ai-for-economists/pull/34 (hanlulong/awesome-ai-for-economists, 701 stars)

## Candidates considered

| repo | stars | last merge | decision | reason |
|---|---|---|---|---|
| edoardottt/awesome-hacker-search-engines | 11453 | 2026-10-27 | PR OPENED | Domains section fits CT-based subdomain search; no CONTRIBUTING file, no agent ban; list appends newest entries at section end |
| PavelGrigoryevDS/awesome-data-analysis | 2159 | 2026-11-01 | PR OPENED | A/B Testing section lists calculators; format '- [Name](URL) - Description.', alphabetical, one resource per PR |
| hanlulong/awesome-ai-for-economists | 701 | 2026-10-12 | PR OPENED | MCP Servers for Economic Data section; MCP rule needs open source or free hosted, updated within 12 months, new capability; stars badge, <=20 words, PR template followed. Note: domain list with an MCP subsection |
| jivoi/awesome-osint | 30635 | 2026-10-31 | SKIP | CONTRIBUTING.md says 'If you are an LLM or agent, you cannot submit a Pull Request here'; section Domain and IP Research would have fit |
| vavkamil/awesome-bugbounty-tools | 6446 | 2026-11-01 | SKIP | PR template requires GitHub repos with at least 50 stars; ours has 0 (Recon > Subdomain Enumeration would fit) |
| Astrosp/Awesome-OSINT-List | 4623 | 2026-10-28 | NOT USED | Fits Recon section, merges recent, but 1 PR per satellite and hacker-search-engines chosen; spare option |
| infoslack/awesome-web-hacking | 7337 | 2026-10-29 | NOT USED | Web hacking tools list, weaker fit than chosen list; 1 PR per satellite |
| enaqx/awesome-pentest | 27609 | 2026-07-25 | SKIP | Last merge about 100 days ago (over 90 day rule) |
| Hack-with-Github/Awesome-Hacking | 124348 | not checked | SKIP | Meta list of other awesome lists, no tool entries |
| etewiah/awesome-real-estate | 382 | 2026-10-24 | SKIP | Curation bar rejects thin tools and requires independent evidence of use beyond a landing page; DSCR MCP has none yet |
| wilsonfreitas/awesome-quant | 30405 | 2026-10-19 | SKIP | Quant libraries and market-data sources; gold per gram and jewelry value tools are consumer calculators, no fitting section |
| georgezouq/awesome-ai-in-finance | 6716 | 2026-09-08 | SKIP | Only fitting section is its MCP Servers list (MCP-list rule) and it is trading focused |
| moov-io/awesome-fintech | 396 | n/a | SKIP | Already an open TapVow PR from this account (1 per list) |
| jzarca01/awesome-food | 254 | 2026-03-17 | SKIP | Last merge over 90 days ago |
| jrhizor/awesome-nutrition-tracking | 153 | 2026-11-01 | SKIP | Below 200 stars and RecipeTool PR #60 already merged there |
| bbbenji/awesome-recipes | n/a | n/a | SKIP | Open PR #18 (Ingredient Calculator) from this account |
| sshuair/awesome-gis; okhosting/awesome-open-data; iamtekson/awesome-geospatial-data-sources; sacridini/Awesome-Geospatial | n/a | n/a | SKIP | Lake Level already submitted to all four by earlier sessions |
| softwareunderground/awesome-open-geoscience | 1867 | 2026-05-26 | SKIP | Last merge over 90 days ago; lake-level already covered |
| ESIPFed/Awesome-Earth-Artificial-Intelligence | 252 | 2026-10-13 | SKIP | ML-for-earth-science focus, no section for a lake data tool; lake-level already covered |
| awesomedata/awesome-public-datasets | 79901 | 2021-03-11 | SKIP | No merge in years |
| erikgahner/awesome-statistics | 169 | not checked | SKIP | Below 200 stars |
| servicelogon/awesome-recon-tools | 183 | not checked | SKIP | Below 200 stars |
| soxoj/awesome-osint-mcp-servers | 535 | not checked | SKIP | MCP-specific list (excluded by lane rules) |
| public-api-lists/public-api-lists | 16279 | not checked | SKIP | Lists REST APIs, our endpoints are MCP; not read in depth |
| lukasz-madon/awesome-remote-job | 50269 | 2026-09-21 | SKIP | Remote jobs list, no section for payroll or tax tools (only checked section names via merged PR title) |
| Ibexoft/awesome-startup-tools-list | 1098 | 2026-10-31 | SKIP | Startup SaaS directory with featured listings; not read in depth, no clear fit |
| kdeldycke/awesome-billing | 1367 | not checked | SKIP | Cloud billing and payments knowledge, no fit for tax or payroll calculators; not read in depth |
| siddhantgoel/awesome-beancount | 388 | 2026-10-23 | SKIP | Plain-text accounting tools, no fit for tax calculators; not read in depth |
| thuquant/awesome-quant | 5704 | 2026-11-02 | SKIP | Chinese-language quant list, no fit |

## Satellites with no suitable domain list found
- no-tax-on-overtime-mcp
- car-loan-interest-deduction-calculator-mcp
- section-179-deduction-calculator-mcp
- paycheck-calculator-mcp
- uk-income-tax-salary-mcp
- gold-price-per-gram-mcp
- us-federal-holidays-business-days-mcp
- ap-score-distributions-mcp
- dscr-loan-calculator-mcp
- cups-to-grams-mcp (only open PR awesome-recipes)
- recipe-nutrition-calculator-mcp (RecipeTool already merged)
- lake-level-mcp (4 geo lists already)

## Method
gh api search/repositories with many awesome-<domain> keyword/topic queries (stars>=150-200); gh pr list -R <repo> --state merged; gh search prs --author theluckystrike --repo <repo> before each PR (all empty). Multi-word GitHub searches mostly returned nothing, so personal finance, tax, payroll, hydrology, education, calendar, gold, cooking lists with 200+ stars and recent activity do not appear to exist.

## Open
- PRs 389, 113, 34 awaiting maintainer review
- Spare lists if a PR is rejected: Astrosp/Awesome-OSINT-List (Recon), infoslack/awesome-web-hacking
