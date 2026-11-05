# build-w3 lane, S1103 (2026-11-03)

## Part 1: two new satellites (new Workers, new public repos, 1 push each, official registry)

| repo | money site (GSC clicks 28d) | hosted URL | worker version | tests | live tools/call | npx github | registry |
| --- | --- | --- | --- | --- | --- | --- | --- |
| raw-to-cooked-weight-mcp | recipetool.net (357) /tools/raw-to-cooked-weight-calculator | https://raw-to-cooked-weight-mcp.lipmichal.workers.dev/mcp | 0aaa7fa2-81ef-4268-bda0-e070a2d4e497 | 18/18 | 5/5 | ok | visible 1.0.0 |
| vegetable-yield-percentage-mcp | ingredientcalculator.com (539) /vegetable-yield-percentage-calculator | https://vegetable-yield-percentage-mcp.lipmichal.workers.dev/mcp | d0342726-0220-41dd-acf2-13c897bfefde | 15/15 | 4/4 | ok | visible 1.0.0 |

Rollback: `npx wrangler delete --name <repo>` (brand-new workers, `wrangler deployments list` shows 1 version each).

Data (bundled, the Workers make no outbound calls):
- USDA ARS Table of Cooking Yields for Meat and Poultry, Release 2 (2014), xlsx: 173 cut/method rows with yield, n, SD, range, moisture and fat change.
- USDA SR28 (sr28asc.zip, ARS): refuse % and refuse description (FOOD_DES) plus household weights (WEIGHT) for 305 raw fruits and vegetables, 790 weights.

Why these: field sizes `gh search repos` 2026-11-03: "raw to cooked mcp" 0, "cooked weight mcp" 0, "cooking yield mcp" 0, "vegetable yield mcp" 0, "produce yield mcp" 0, "edible portion mcp" 0 (controls: "lake level mcp" -> theluckystrike/lake-level-mcp, "food safety mcp" 5). Cut-specific yields and trim losses are figures a model guesses (a flat 25% loss rule; bacon is 29-32%, cured boneless ham 94-96%, corn on the cob 36% edible).

Not built: FSIS safe temperatures and FoodKeeper storage times. fsis.usda.gov, foodsafety.gov, usda.gov and fns.usda.gov answered 403 (Akamai) to this host, and web.archive.org answered 429, so no primary source could be fetched.

npm: packages ready (`npm pack --dry-run` 9 files each, 20.6 kB / 26.9 kB; `npm view` E404 for both, control cups-to-grams-mcp 1.0.0). Not published: `npm whoami` E401. OWNER UNLOCK: `npm login`, then `npm publish` in each repo dir.

Open: no boneless skinless or grilled chicken breast in the USDA table (the tools return the closest row and say so). GitHub search did not return either repo minutes after creation (indexing lag), so re-check.

## Part 2: goldgramprice.com silver page link

- Job: launchd `com.mike.goldgramprice-refresh` (~/Library/LaunchAgents, StartInterval 10800) runs ~/cro-exec/goldgramprice/scripts/local-refresh.sh. The script checks out LOCAL `main` into ~/goldgramprice-work/refresh-wt, builds and runs `wrangler pages deploy --project-name=goldgramprice`. Its header names `launchctl kickstart` as the documented manual run.
- Before the edit: the working tree was clean, the last commit was f362fca (2026-11-02 04:45 UTC), and no source file had changed in the last 90 min.
- Change: src/pages/silver-price-per-gram.astro gets a "Use this data in Claude or ChatGPT" h2 and one paragraph with one plain link to https://github.com/theluckystrike/silver-price-per-gram-mcp. The heading and link text match the gold server link on the homepage. Local commit 1e90594 "[skip ci]". Not pushed: the repo is private and the job deploys the local main.
- Deploy: ran `launchctl kickstart` once at 08:37 UTC. Log: "2026-11-03T08:39:24Z deployed main@1e90594 ... https://2a037c68.goldgramprice.pages.dev pages=65 live-ok".
- Live check: `curl https://goldgramprice.com/silver-price-per-gram/` contains the link. Control: the homepage gold-price-per-gram-mcp link is still present.
- Rollback: `git -C ~/cro-exec/goldgramprice revert 1e90594`. The next 3-hourly run then redeploys without the link.

## Cleanup
Deleted 40 source download files (56.4 MB, the SR28 zip and extracts and the ARS xlsx/pdf working copies), listed in build-w3/deletions-manifest.tsv. The npx temp dirs are removed. Stray wait loops (PIDs 15664, 15761) were stopped.
