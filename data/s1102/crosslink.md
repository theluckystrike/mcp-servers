# Crosslink lane, 2026-11-02

Goal: show each satellite MCP server to the human visitors of its money site. No site serves llms.txt (404 on all 7), so only homepages changed.

## Class A (deployed)

### lakelevelnow.com
- Source and deploy path: Astro 4, GitHub Pages via .github/workflows/pages.yml on push to main (public repo; workflow rebuilds with a fresh USGS/CDEC fetch and daily cron). Repo moved to github.com/lakelevelnow/lakelevelnow (push still redirected).
- Change: commit 34cfaf0 on main (rebased on 5fde91b after other sessions pushed), src/pages/index.astro +10 lines, section before Common questions
- Verification: Built base and modified from the same tree: only dist/index.html differs, 18 added lines, 0 removed. Live vs base differs only by data (30 vs 18 lakes etc), expected because CI refetches.
- Deploy: GitHub Pages run for 34cfaf0 completed success (previous 5fde91b)
- Rollback: `git revert 34cfaf0 and push to main (Pages redeploys); previous Pages commit 5fde91b`
- Live check: curl -A curl/8.7.1 https://lakelevelnow.com/ : heading x1, connector URL x2, repo link x1; /lakes/ 200

### noovertimetax.com
- Source and deploy path: Astro 4, Cloudflare Worker with static assets (name noovertimetax), private repo theluckystrike/noovertimetax main 1c65d36. CI deploy.yml runs on push; deployed by hand with wrangler as in the 2026-10-30 fix.
- Change: local commit 271831c in ~/mcp-servers/data/s1102/crosslink/src-noovertimetax (NOT pushed, private repo); patch patches/noovertimetax/0001-*.patch; message ends with [skip ci]
- Verification: Clean build of main 1c65d36 had homepage byte-identical to live (0 diff lines after masking the random astro-island uid) before the change. Base vs modified: index.html +25 lines 0 removed, sitemap-0.xml lastmod stamps only (URL set identical to live). Live after deploy vs local build: 0 diff lines.
- Deploy: 880085b5-167b-4c5d-ae65-8688b2e8697d (previous b0417928-88c1-4e55-b540-fe60e8d1e58d)
- Rollback: `CLOUDFLARE_ACCOUNT_ID=dd3f2a29b7707e21a87f26a622c0bb9d npx wrangler rollback b0417928-88c1-4e55-b540-fe60e8d1e58d --name noovertimetax`
- Live check: https://noovertimetax.com/ 200; heading x1, connector URL x2, repo link x1; /states/, /eligibility/, /calculators/tips/ 200

### statewage.com
- Source and deploy path: Astro 4, Cloudflare Worker with static assets (name statewage), private repo theluckystrike/statewage main 4e2fe39. Last Worker deploy 2026-10-29T07:14Z matches that commit time.
- Change: local commit 14b5aca in ~/mcp-servers/data/s1102/crosslink/src-statewage (NOT pushed, private repo); patch patches/statewage/0001-*.patch; message ends with [skip ci]
- Verification: Clean build of main 4e2fe39 had homepage identical to live (0 diff lines after masking astro-island uid) before the change. Base vs modified: only index.html differs, 23 lines added, 0 removed. Live after deploy vs local build: 0 diff lines.
- Deploy: cd5ec395-f95f-443f-8ddd-3c5425f53a76 (previous 22ef382d-ec3a-4d80-a6f6-5cfc376c15c3)
- Rollback: `CLOUDFLARE_ACCOUNT_ID=dd3f2a29b7707e21a87f26a622c0bb9d npx wrangler rollback 22ef382d-ec3a-4d80-a6f6-5cfc376c15c3 --name statewage`
- Live check: https://statewage.com/ 200; heading x1, both connector URLs x2 each, both repo links x1; /states/, /states/texas/, /401k-paycheck-calculator/ 200

## Class B (not deployed, snippet left for the orchestrator)

### dscrradar.com
- Why unclear: Live homepage shows "Updated Oct 1, 2026" with Oct 1 market data; a clean build of GitHub main 43ed2ca shows Oct 26 data (116 differing lines against live). The Worker was last deployed 2026-10-29T04:12Z (version a771051a-ce47-4952-8bdc-10388f83761a) from a source that is not on GitHub main (likely ~/dscrradar-clone, which has 6 uncommitted changes). Deploying from main would also roll the data forward and could drop unpushed work. Needs the owner or orchestrator to name the source of truth.
- Where: ~/mcp-servers/data/s1102/crosslink/src-dscrradar/src/pages/index.astro (clone of github.com/theluckystrike/dscrradar main 43ed2ca): new <section class="section"> immediately before the "Common questions" section (line 165). No llms.txt exists on the live site (404).
- Deploy target: Worker "dscrradar" (Workers Static Assets, wrangler deploy). Old version a771051a-ce47-4952-8bdc-10388f83761a.

```html
<section class="section" id="use-in-ai">
  <h2>Use this data in Claude or ChatGPT</h2>
  <p>The DSCR math on this site is also available as a free MCP server. An AI assistant can calculate a property DSCR, find the maximum loan or the rent needed for a target ratio, and compare scenarios with exact amortization instead of estimating. There is no account or API key.</p>
  <p style="margin-bottom:6px"><strong>Claude.ai or ChatGPT.</strong> Add a custom connector and paste this URL:</p>
  <pre style="margin:0 0 12px;padding:11px 13px;background:#fff;border:1px solid #e4e2db;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;"><code>https://dscr-loan-calculator-mcp.lipmichal.workers.dev/mcp</code></pre>
  <p style="margin-bottom:6px"><strong>Claude Code.</strong></p>
  <pre style="margin:0 0 12px;padding:11px 13px;background:#fff;border:1px solid #e4e2db;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;"><code>claude mcp add --transport http dscr-loan-calculator https://dscr-loan-calculator-mcp.lipmichal.workers.dev/mcp</code></pre>
  <p><a href="https://github.com/theluckystrike/dscr-loan-calculator-mcp">Source, tools and other install options on GitHub</a></p>
</section>
```

### ukmoneycalc.com
- Why unclear: Live homepage contains calculator cards (Income Tax, ISA allowance) that a clean build of GitHub main does not (20 differing lines). Live Pages deployments (6161d9ab..., ff7c7890..., 3 days old) came from a direct upload, most likely the unmerged branch fleet-20261029-1412-maternity-pay (also fleet-20261010-1436-live-source). Main is behind live, so deploying main would remove live pages.
- Where: ~/mcp-servers/data/s1102/crosslink/src-ukmoneycalc/src/pages/index.astro (clone of github.com/theluckystrike/ukmoneycalc main 841b5b1): new <section class="section narrow"> between the calculators section (id="calculators", line 22) and the "UK income tax & NI at a glance" section (line 46). No llms.txt exists (404).
- Deploy target: Cloudflare Pages project ukmoneycalc (direct upload and GitHub Deploy workflow on push to main, which would also redeploy main). Old production deployment 6161d9ab-1785-4f13-8a22-19f7a985f742.

```html
<section class="section" id="use-in-ai">
  <h2>Use this data in Claude or ChatGPT</h2>
  <p>The UK income tax and National Insurance rules on this site are also available as a free MCP server. An AI assistant can work out take-home pay for a salary, show the tax bands, compare salaries and give the marginal rate at an income, using 2026/27 figures rather than what it remembers from training. There is no account or API key.</p>
  <p style="margin-bottom:6px"><strong>Claude.ai or ChatGPT.</strong> Add a custom connector and paste this URL:</p>
  <pre style="margin:0 0 12px;padding:11px 13px;background:#fff;border:1px solid #e4e2db;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;"><code>https://uk-income-tax-salary-mcp.lipmichal.workers.dev/mcp</code></pre>
  <p style="margin-bottom:6px"><strong>Claude Code.</strong></p>
  <pre style="margin:0 0 12px;padding:11px 13px;background:#fff;border:1px solid #e4e2db;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;"><code>claude mcp add --transport http uk-income-tax-salary https://uk-income-tax-salary-mcp.lipmichal.workers.dev/mcp</code></pre>
  <p><a href="https://github.com/theluckystrike/uk-income-tax-salary-mcp">Source, tools and other install options on GitHub</a></p>
</section>
```

### goldgramprice.com
- Why unclear: A second automation deploys this site: launchd job com.mike.goldgramprice-refresh (StartInterval 10800 s) runs ~/cro-exec/goldgramprice/scripts/local-refresh.sh, which builds the LOCAL main commit of ~/cro-exec/goldgramprice in ~/goldgramprice-work/refresh-wt and runs wrangler pages deploy (latest Pages deployments 7108879d 1 h, 51dab5d6 4 h, 7e7a97d4 7 h ago, source 3441d77). A hand deploy from another tree would be overwritten within 3 hours. The correct path is to commit the section to local main of that checkout (private repo; orchestrator decides on push) and let the next refresh ship it.
- Where: ~/mcp-servers/data/s1102/crosslink/src-goldgramprice/src/pages/index.astro (clone of github.com/theluckystrike/goldgramprice main): new <section> between the "How gold value is calculated" section (id="how", line 76) and the FAQ section (line 106). No llms.txt exists (404).
- Deploy target: Cloudflare Pages project goldgramprice, deployed by launchd refresh. Old production deployment 7108879d-f30f-448a-b8bd-b1b465ce736d.

```html
<section class="section" id="use-in-ai">
  <h2>Use this data in Claude or ChatGPT</h2>
  <p>The gold price per gram on this site is also available as a free MCP server. An AI assistant can read the current spot price per gram, price any karat, value a piece of jewelry and convert between gram, ounce and tola units, with the figure fetched when you ask. There is no account or API key.</p>
  <p style="margin-bottom:6px"><strong>Claude.ai or ChatGPT.</strong> Add a custom connector and paste this URL:</p>
  <pre style="margin:0 0 12px;padding:11px 13px;background:#fff;border:1px solid #e4e2db;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;"><code>https://gold-price-per-gram-mcp.lipmichal.workers.dev/mcp</code></pre>
  <p style="margin-bottom:6px"><strong>Claude Code.</strong></p>
  <pre style="margin:0 0 12px;padding:11px 13px;background:#fff;border:1px solid #e4e2db;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;"><code>claude mcp add --transport http gold-price-per-gram https://gold-price-per-gram-mcp.lipmichal.workers.dev/mcp</code></pre>
  <p><a href="https://github.com/theluckystrike/gold-price-per-gram-mcp">Source, tools and other install options on GitHub</a></p>
</section>
```

### ingredientcalculator.com
- Why unclear: Live Pages production deployment 298c9132-325c-46b6-b438-42052613bcc5 (22 h ago, branch production, source commit 37dbcda) was built from a commit that does not exist in any local clone I checked (ingredientcalculator, -fleet-0725/1210/2101, Desktop/ingredientcalculator/repo, ingredient-offer-20260927 skipped because git status hangs on a dataless repo). Live index.html differs from the newest local copy at line 398, so the source of truth is unknown.
- Where: Static HTML site, no GitHub repo (github.com/theluckystrike/ingredientcalculator returns 404). Newest local copy: ~/satellite-repos/ingredientcalculator-fleet-0725/index.html (dfd1306). Put the section before the "More" tools section near the bottom of index.html (the last <h2 style="margin-top:8px">), and add a link line to the footer if desired. No llms.txt exists (404).
- Deploy target: Cloudflare Pages project ingredientcalculator (direct upload, production branch). Old production deployment 298c9132-325c-46b6-b438-42052613bcc5.

```html
<section class="section" id="use-in-ai">
  <h2>Use this data in Claude or ChatGPT</h2>
  <p>The cup, gram and ounce conversions on this site are also available as a free MCP server. An AI assistant can convert an ingredient by weight or volume, search ingredients, scale a recipe and convert oven temperatures using the same densities as the calculators. There is no account or API key.</p>
  <p style="margin-bottom:6px"><strong>Claude.ai or ChatGPT.</strong> Add a custom connector and paste this URL:</p>
  <pre style="margin:0 0 12px;padding:11px 13px;background:#fff;border:1px solid #e4e2db;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;"><code>https://cups-to-grams-mcp.lipmichal.workers.dev/mcp</code></pre>
  <p style="margin-bottom:6px"><strong>Claude Code.</strong></p>
  <pre style="margin:0 0 12px;padding:11px 13px;background:#fff;border:1px solid #e4e2db;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;"><code>claude mcp add --transport http cups-to-grams https://cups-to-grams-mcp.lipmichal.workers.dev/mcp</code></pre>
  <p><a href="https://github.com/theluckystrike/cups-to-grams-mcp">Source, tools and other install options on GitHub</a></p>
</section>
```

## Open
- Push the two local commits (noovertimetax 271831c, statewage 14b5aca) to the private repos once, with [skip ci], so a later CI deploy does not drop the live section. The statewage repo has no deploy-on-push workflow; noovertimetax deploy.yml deploys on push unless [skip ci].
- lakelevelnow repo moved to github.com/lakelevelnow/lakelevelnow.
- Class B snippets in crosslink.md.

## Incident
- A for-loop of git status hung ~30 min on a dataless repo (~/ingredient-offer-20260927); killed via TaskStop. A line in that command referenced goldgramprice local-refresh.sh but never executed because the loop never finished; verified no local-refresh process ran.