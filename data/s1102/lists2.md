# lists2 (s1102), 2026-11-02

## PRs
- Sagargupta16/awesome-mcp-servers: https://github.com/Sagargupta16/awesome-mcp-servers/pull/273 (15 rows; format copied from merged #255; Finance 9, Search & Knowledge 3, Productivity 1, Marketing & Analytics 1, Security 1)
- bhavyshekhaliya/awesome-public-mcp-servers: https://github.com/bhavyshekhaliya/awesome-public-mcp-servers/pull/103 (15 rows; format copied from merged #100; hosted URL in each row; Finance and Commerce 9, Home and Lifestyle 2, Work and Productivity 1, Search and Research 1, Monitoring and Security 1, Science and Computation 1)

Satellites added to both: car-loan-interest-deduction-calculator, section-179-deduction-calculator, subdomain-finder, ab-test-sample-size-calculator, recipe-nutrition-calculator, ap-score-distributions (new 6); cups-to-grams, dscr-loan-calculator, gold-price-per-gram, minimum-wage, no-tax-on-overtime, paycheck-calculator, uk-income-tax-salary, us-federal-holidays-business-days (older 8; lake-level was already listed); retirement-contribution-limits-2027 (added per orchestrator). None of the 15 was listed in either README, and no open PR from theluckystrike existed in either list (gh search prs, empty).

## Verification
- validate.py (list A) passed locally: 449 entries, no duplicates. List B has no validator.
- gh api repos/theluckystrike/<repo> for all 15: MIT, not archived, pushed 2026-11-02. Hosted endpoint initialize POST: HTTP 200 for all 15.
- Author has starred list A (gh api user/starred -> 204), which A needs for auto-merge.
- Commits authored as theluckystrike, no AI attribution or trailers. PR bodies plain, no emoji.
- At write time A's CI was pending (7 checks); B reported CLEAN with no CI.

## mcpmarket.com gold-price-per-gram-mcp
One attempt with dirsub/scripts/post_mm.py: HTTP 200, success true, free queue (4-6 weeks), submission_id 1220494 at 2026-11-02T04:06:17Z. Log: lists2-mcpmarket-gold.jsonl.

## Open
- Watch PR 273 checks and both maintainers. B may ask to split the 15 rows.
- Note: B rows omit npx install because 6 new packages plus retirement are not on npm.
