# build-gen lane, S1103 (2026-11-03)

Three new data satellites built, deployed as NEW Cloudflare Workers, pushed to new public repos (1 push each) and published to the official MCP registry. No existing worker was touched. Not published to npm (per-publish 2FA approval needed; packages are npm-ready, `npm view` E404 for all three, positive control cups-to-grams-mcp 1.0.0).

| repo | money site (GSC clicks 28d) | hosted URL | worker version | tests | live tools/call | npx github | registry |
| --- | --- | --- | --- | --- | --- | --- | --- |
| silver-price-per-gram-mcp | goldgramprice.com (228) /silver-price-per-gram/ | https://silver-price-per-gram-mcp.lipmichal.workers.dev/mcp | 58eb1d69-ddae-47c8-817c-52c713234c37 | 20/20 | 4/4 | ok | visible 1.0.0 |
| river-level-mcp | lakelevelnow.com (310) | https://river-level-mcp.lipmichal.workers.dev/mcp | 89cacb60-4e61-471a-a974-8f47a83186a1 | 16/16 | 4/4 | ok | visible 1.0.0 |
| sat-score-percentiles-mcp | examscorecalc.com (1) /sat/ | https://sat-score-percentiles-mcp.lipmichal.workers.dev/mcp | 6aacd64a-d269-4da4-b6a0-22d760c3b899 | 13/13 | 4/4 | ok | visible 1.0.0 |

Rollback for each: `npx wrangler delete --name <repo>` (brand-new workers, one version each).

## Why these three

- Field sizes (`gh search repos "<phrase> mcp"`, 2026-11-03): silver price 0, river level 0, streamflow 0, sat score 0, sat percentile 0. Positive control: "lake level mcp" returned theluckystrike/lake-level-mcp.
- Live or post-mid-2025 data: silver spot (gold-api.com, same feed as goldgramprice.com) with central-bank FX; USGS Water Data OGC API + NOAA NWPS flood stages and forecasts (legacy waterservices.usgs.gov shuts down 2027-02-22 per its own page); College Board class of 2026 SAT Suite Annual Report (national + 53 state/territory supplements, fall 2026).
- Every tool result carries `source` (primary URL) and `more` (money-site page with `utm_source=mcp&utm_medium=<repo>`); all more-links checked 200.

## Not built

- Snowpack (NRCS AWDB REST API) for lakelevelnow.com: wcc.sc.egov.usda.gov timed out on TCP connect from this host.
- Baking substitutions (ingredientcalculator.com): field is empty but the content is not live or post-2025, so it fails the "model cannot answer alone" rule.

## Owner unlocks

- npm publish for the three packages (2FA web approval per publish).
- Optional: api.data.gov key for USGS (https://api.data.gov/signup/) only if river-level-mcp starts returning 429 in production.

Details and open issues per server: silver-price-per-gram-mcp.json, river-level-mcp.json, sat-score-percentiles-mcp.json. Deleted source downloads (76 MB): build-gen/deletions-manifest.tsv.
