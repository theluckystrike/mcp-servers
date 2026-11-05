# dist (s1103), 2026-11-03

Scope: 20 free data satellites. Preflight: 20/20 answer tools/list on the hosted URL, 20/20 in the official registry (dist/health.txt). README npx paths verified over stdio for the three Cline candidates.

Lead ranking (live data or post-cutoff rules, health, category breadth): lake-level, gold-price-per-gram, subdomain-finder, ab-test-sample-size, us-federal-holidays-business-days, no-tax-on-overtime.

| Channel | Action | URL / id | Status | Recheck |
|---|---|---|---|---|
| toolsdk-ai/toolsdk-mcp-registry | #1191 Lake Level merged 11-03; new PR adds the other 19 as remote JSONs (validator 0 errors) | https://github.com/toolsdk-ai/toolsdk-mcp-registry/pull/1246 | open, CI green | 2026-11-06 |
| punkpeye/awesome-mcp-servers (97k stars) | 1 line, lake-level-mcp, Environment & Nature, Glama badge | https://github.com/punkpeye/awesome-mcp-servers/pull/18434 | open, check-submission green | 2026-11-10 |
| punkpeye/awesome-remote-mcp-servers (2.5k) | Gold Price Per Gram in Finance, Glama connector badge | https://github.com/punkpeye/awesome-remote-mcp-servers/pull/3709 | open | 2026-11-06 |
| cline/mcp-marketplace | 3 issues, logos pushed to repos, Cline-test box left unticked | issues 3487 (gold), 3488 (subdomain), 3489 (ab-test) | open | 2026-11-10 |
| Sagargupta16/awesome-mcp-servers | none | already lists all 20 | done | - |
| bhavyshekhaliya/awesome-public-mcp-servers | none (1 PR per repo) | #103 already carries the other 19 | open, mergeable | 2026-11-08 |
| docker/mcp-registry | skipped | our #5030, #6151, #6464 open | see below | 2026-11-17 |
| mcprepository.com | none | /theluckystrike/<name> | 20/20 pages 200 | - |
| mcp.directory | none | /servers/<name> | 0/20 live (control /servers/github 200), 4 days past 24h review | 2026-11-07 |
| mcpmarket.com | retried gold (only gap) | HTTP 409 already in queue | 20/20 queued | 2026-12-14 |
| mcpservers.org | none | ids 15018-15023 + 10-30 batch | pending | 2026-11-16 |

Docker decision: remote no-auth entries are allowed (server.yaml + tools.json + readme.md), but 2,507 PRs are open, the last 15 merges are pin bumps or updates (no new third-party server since July), and we already have 3 open unreviewed PRs. A fourth adds backlog, not reach. If one of ours gets reviewed, add lake-level-mcp as a one-server PR.

Flags: another lane added cpi-inflation-calculator-mcp, irs-mileage-rate-per-diem-mcp, silver-price-per-gram-mcp during this run; not submitted anywhere by this lane. A branch I pushed by mistake to the wrong fork (theluckystrike/awesome-remote-mcp-servers, which is a fork of jaw9c) was deleted right away. I did not star toolsdk (its guide asks agents to; not authorized).

Files: dist/health.txt, dist/live-pages.txt, dist/mm-gold.jsonl, dist/*-pr-body.md, dist/cline-*.md, dist/scripts/ (gen_toolsdk.py, logos.py).

## s1103 wave 2

Five new satellites: cpi-inflation-calculator-mcp, irs-mileage-rate-per-diem-mcp, silver-price-per-gram-mcp, river-level-mcp, sat-score-percentiles-mcp. Preflight 5/5 live tools/list, 5/5 in the registry.

| Channel | Result | Proof / URL | Recheck |
|---|---|---|---|
| mcprepository.com | 5/5 queued, duplicate false (pages 404 before) | dist/w2/mcprepository.jsonl | 11-04 |
| mcp.directory | 5/5 ok true, pending (pages 404 before) | dist/w2/md.jsonl | 11-07 |
| mcpmarket.com | 5/5 free queue, ids 1222611-1222615 | dist/w2/mm.jsonl | 12-14 |
| mcpservers.org | 5/5 pending, ids 15350-15354 | dist/w2/ms-*.jsonl | 11-17 |
| Glama | 5/5 connector pages live (control 404 for a fake name); 5/5 repo server pages 404, not yet indexed | curl | 11-06 |
| toolsdk #1246 | 5 files pushed to the same branch, validator 24 files 0 errors, title now 24 | https://github.com/toolsdk-ai/toolsdk-mcp-registry/pull/1246 | 11-06 |
| bhavyshekhaliya #103 | 5 rows added, our 4 out-of-order rows sorted, now +24 | https://github.com/bhavyshekhaliya/awesome-public-mcp-servers/pull/103 | 11-08 |

Backlinks (one plain link each, base build or file checked equal to live first):

| Page | Server | Commit / deploy | Rollback | Live check |
|---|---|---|---|---|
| examscorecalc.com/sat/ | sat-score-percentiles | c9bc7c7, Pages build 08:10Z | git revert c9bc7c7, push | cmp live = repo, link x1 |
| lakelevelnow.com/ | river-level | e2a2853, workflow success | git revert e2a2853, push | link x1, /lakes/ 200 |
| taxbreakcalc.com/self-employed-set-aside-calculator/ | irs-mileage-rate-per-diem | 67336fb [skip ci], Pages 11357949 (prev 22f7e59b) | dashboard rollback to 22f7e59b-ad60-43e7-b8bf-9d7427807c03 | live = build, link x1, www 301 |
| statewage.com/pay-raise-calculator/ | cpi-inflation-calculator | 328c5f0 [skip ci], Worker 9ca55f87-8b21-4ad6-a9bd-3f8ef0bbe53d (prev cd5ec395) | `CLOUDFLARE_ACCOUNT_ID=dd3f2a29b7707e21a87f26a622c0bb9d npx wrangler rollback cd5ec395-f95f-443f-8ddd-3c5425f53a76 --name statewage` | live = build, link x1 |
| goldgramprice.com silver | silver-price-per-gram | SKIPPED: s1102 class B, launchd refresh builds ~/cro-exec/goldgramprice local main and deploys every 3 h | - | - |

Comments recheck: Cline #3430, #3487-3489 have 0 comments; punkpeye #18434 only the Glama bot; awesome-remote #3709 labeled endpoint-ok, has-connector; toolsdk #1246 none. Nothing to answer.
Note: statewage weekly-refresh.yml failed its last 3 scheduled runs (not touched). Temp clones deleted, manifest dist/w2/deleted-manifest.txt.

## s1103 wave 3

raw-to-cooked-weight-mcp and vegetable-yield-percentage-mcp: both live (tools/list), in the registry, public.

- Directories (duplicate check first, 0 hits): mcprepository 2/2 queued; mcp.directory 2/2 ok, pending; mcpmarket 2/2 free queue (1222617, 1222618); mcpservers.org 2/2 pending (15359, 15360). Proof dist/w3/*.jsonl.
- Glama connector pages: 404 for both today, recheck 11-06.
- toolsdk #1246: third commit, 2 files, validator 26 files 0 errors, title 26. bhavyshekhaliya #103: 2 rows in Home and Lifestyle, now +26, mergeable.
- Backlink recipetool.net/tools/raw-to-cooked-weight-calculator: live equal to repo before; commit 68b0f60 [skip ci]; Pages deploy 681002a7-68bd-413e-afeb-15d806bae832 (previous 9f5ab57f-d703-4a72-90f3-2c6f598c9fcf, rollback via dashboard https://dash.cloudflare.com/dd3f2a29b7707e21a87f26a622c0bb9d/pages/view/recipetool/9f5ab57f-d703-4a72-90f3-2c6f598c9fcf); live page and homepage cmp equal to repo, link x1.
- Backlink ingredientcalculator.com: SKIPPED. Repo ingredientcalculator/ingredientcalculator last pushed 2026-08-14, production 036720ea is from commit 87e8d5d with 3 production deploys in the last day from unknown sources. No verified deploy path.
