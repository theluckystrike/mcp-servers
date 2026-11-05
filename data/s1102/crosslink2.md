# Crosslink2 lane, 2026-11-02

Goal: show each new satellite MCP server to the human visitors of its money site. Same method as the first crosslink lane. Five sites deployed (A), one held (B).

## Class A (deployed)

### taxbreakcalc.com (car-loan-interest-deduction-calculator-mcp)
- Source and deploy path: Astro 4, Cloudflare Pages project taxbreakcalc (direct upload, branch main, Pages Function _middleware.js), private repo theluckystrike/taxbreakcalc
- Proof source equals live: wrangler pages deployment list showed production ca6cf6ac with source b2e21af = origin/main HEAD. Clean astro build of b2e21af: homepage equal to live, 0 diff lines after masking the astro-island uid
- Change: commit ce89f6e, src/pages/index.astro +13, section before About TaxBreakCalc, message ends [skip ci]
- Diff check: dist differs from base only in index.html (diff -rq); new index.html minus the section equals base ignoring whitespace; 75 pages in both
- Deploy: 22f7e59b-ad60-43e7-b8bf-9d7427807c03 (previous ca6cf6ac-5e18-49b4-8454-ddca458eb433)
- Rollback: Cloudflare Pages rollback, not exercised. Dashboard https://dash.cloudflare.com/dd3f2a29b7707e21a87f26a622c0bb9d/pages/view/taxbreakcalc/ca6cf6ac-5e18-49b4-8454-ddca458eb433 (Rollback to this deployment), or API POST /accounts/dd3f2a29b7707e21a87f26a622c0bb9d/pages/projects/taxbreakcalc/deployments/ca6cf6ac-5e18-49b4-8454-ddca458eb433/rollback, or git revert the commit, rebuild and wrangler pages deploy
- Push: gh api: private=true. One push b2e21af..ce89f6e with [skip ci]; the repo has no workflows
- Live check: https://taxbreakcalc.com/ 200, live homepage equals local build (0 diff after uid mask), heading x1, connector URL x2, setup link x1, repo link x1. /overtime-tax-calculator/, /state-overtime-tax-map/, /about/ 200, www 301 (middleware intact)

### assetloancalculator.com (section-179-deduction-calculator-mcp)
- Source and deploy path: Astro 4, Cloudflare Pages project assetloancalculator (direct upload, branch main, Pages Function), private repo theluckystrike/assetloancalculator
- Proof source equals live: production 11a25317 source 12853ab = origin/main HEAD. Clean build of 12853ab: homepage differs from live in 4 diff lines, all of them the build-time FRED Prime Rate as-of date (live 2026-10-26, build 2026-10-27, value 7.00% in both). Nothing else differs
- Change: commit cc16643, src/pages/index.astro +10, section after Honest by design, message ends [skip ci]
- Diff check: dist differs from base only in index.html; new index.html minus the section equals base ignoring whitespace
- Side effect: the deploy moved the Prime benchmark as-of date from 2026-10-26 to 2026-10-27 on the pages that show it (wrangler uploaded 33 files). Same documented build-time fetch, value unchanged
- Deploy: ca8d186b-071f-485b-a65f-184afecb773e (previous 11a25317-e931-4b2b-911a-e1cf4bc2dd38)
- Rollback: Cloudflare Pages rollback, not exercised. Dashboard https://dash.cloudflare.com/dd3f2a29b7707e21a87f26a622c0bb9d/pages/view/assetloancalculator/11a25317-e931-4b2b-911a-e1cf4bc2dd38 (Rollback to this deployment), or API POST /accounts/dd3f2a29b7707e21a87f26a622c0bb9d/pages/projects/assetloancalculator/deployments/11a25317-e931-4b2b-911a-e1cf4bc2dd38/rollback, or git revert the commit, rebuild and wrangler pages deploy
- Push: private=true. One push 12853ab..cc16643 with [skip ci]; no workflows in the repo
- Live check: https://assetloancalculator.com/ 200, equals local build (0 diff), heading x1, connector x2, setup x1, repo x1. /rv-loan-calculator/, /land-loan-calculator/, /about/ 200

### bugbountyreality.com (subdomain-finder-mcp)
- Source and deploy path: Static HTML, public repo theluckystrike/bugbountyreality.com, served from Cloudflare Pages project bugbountyreality (direct upload, not GitHub Pages)
- Proof source equals live: production b3a8ac65 source 27f5cec = origin/main HEAD. Homepage and all 47 other html pages byte-identical to the repo files (curl -L vs git file, 0 diff)
- Change: commit efbbeac, index.html +16 -0 (git diff 27f5cec efbbeac --numstat), section after the essay and before the colophon
- Deploy: ebb28fb0-a2d0-44d9-9c7a-7305e526f7ed (previous b3a8ac65-a10f-4b0c-a828-ee54a6dbb223)
- Deploy command: git archive HEAD into a clean dir, then wrangler pages deploy --project-name=bugbountyreality --branch=main --commit-hash=efbbeac. Wrangler uploaded 1 file, 58 already uploaded
- Rollback: Cloudflare Pages rollback, not exercised. Dashboard https://dash.cloudflare.com/dd3f2a29b7707e21a87f26a622c0bb9d/pages/view/bugbountyreality/b3a8ac65-a10f-4b0c-a828-ee54a6dbb223 (Rollback to this deployment), or API POST /accounts/dd3f2a29b7707e21a87f26a622c0bb9d/pages/projects/bugbountyreality/deployments/b3a8ac65-a10f-4b0c-a828-ee54a6dbb223/rollback, or git revert the commit, rebuild and wrangler pages deploy
- Push: public. One push 27f5cec..efbbeac. I pushed before I confirmed the site is not on GitHub Pages; harmless, main now equals the deployed tree
- Note: the h2 is 'Use this data in Claude <em>or ChatGPT.</em>' to match the site's italic title style, so a grep for the exact heading string returns 0 although the text reads the same
- Live check: https://bugbountyreality.com/ 200, cmp live vs repo HEAD index.html equal, connector x2, setup x1, repo x1. /tools/subdomain-finder-real/, /tools/dns-lookup-tool/, /support/ 200

### abwex.com (ab-test-sample-size-calculator-mcp)
- Source and deploy path: Static HTML, public repo toolsthatrank/abwex.com. A push to main triggers a GitHub Pages build and the workflow 'Publish verified static assets to Cloudflare'
- Proof source equals live: live homepage byte-identical to origin/main d49b1b5 index.html (cmp, 0 diff)
- Change: commit 7ffc94e, index.html +10 -0, section before Common questions
- Deploy: GitHub Pages build 7ffc94e (built 2026-11-02T03:34:24Z), workflow run 41383745942 success (previous d49b1b5)
- Rollback: git revert 7ffc94e and push to main; previous commit d49b1b5
- Push: public. One push d49b1b5..7ffc94e
- Live check: https://abwex.com/ 200, cmp live vs repo HEAD equal, heading x1, connector x2, setup x1, repo x1. /tools/sample-size-calculator.html and /answers/is-my-ab-test-significant.html 200

### examscorecalc.com (ap-score-distributions-mcp)
- Source and deploy path: Static HTML on GitHub Pages (legacy branch build), public repo theluckystrike/examscorecalc-live (redirects to toolsthatrank/examscorecalc-live)
- Proof source equals live: live homepage byte-identical to origin/main 7d03985 index.html (cmp, 0 diff); last-modified 2026-10-28 07:14:59Z matches that Pages build
- Change: commit b279b7d, index.html +8 -0, section after Honest by design
- Deploy: GitHub Pages build b279b7d (built 2026-11-02T03:33:55Z) (previous 7d03985)
- Rollback: git revert b279b7d and push to main; previous commit 7d03985
- Push: public. One push 7d03985..b279b7d
- Live check: https://examscorecalc.com/ 200, cmp live vs repo HEAD equal, heading x1, connector x2, setup x1, repo x1. /ap-score-distributions/ and /ap/ 200

## Class B (not deployed)

### recipetool.net (recipe-nutrition-calculator-mcp)
- Why: Another session is active on recipetool. Commits 9ffc3e5 (09:39), a96bd31 (09:45), e2603cd (10:19, local time) and three Pages production deploys in about an hour. The newest, cf53c05f-05f5-4a0d-b7bd-20268def9ca0 (source e2603cd), was about 22 minutes old when I checked at 10:41. A deploy from me could race its next one.
- Base proof: live homepage byte-identical to origin/main e2603cd recipe-dist/index.html (cmp, 0 diff), so the patch applies to the live tree
- Where: ~/mcp-servers/data/s1102/crosslink2/src-recipetool (clone of private theluckystrike/recipetool). Local commit 3d35f96 on e2603cd, NOT pushed. Patch patches/recipetool/0001-*.patch. The section sits after the FAQ and before the end-position ad-slot in recipe-dist/index.html
- Deploy target: Cloudflare Pages project recipetool, wrangler pages deploy recipe-dist --project-name=recipetool --branch=main from the repo root (it has _worker.js). Previous production cf53c05f-05f5-4a0d-b7bd-20268def9ca0
- How to ship: in the other session's tree (~/cro-exec/recipetool) git am the patch or insert snippets/recipetool.html, commit with [skip ci], deploy with its usual command, push once (private, no workflow), curl live for use-in-ai x1

```html
<section class="section prose" id="use-in-ai">
  <h2>Use this data in Claude or ChatGPT</h2>
  <p>The nutrition math on this site is also available as a free MCP server. An AI assistant can use it to look up USDA FoodData Central values for an ingredient, total the calories and macros of a recipe from plain ingredient lines, scale a recipe by servings, and round a label the way the FDA rules require. It uses the same USDA data as the calculator. There is no account or API key.</p>
  <p style="margin-bottom:6px"><strong>Claude.ai or ChatGPT.</strong> Add a custom connector with this URL.</p>
  <pre style="margin:0 0 12px;padding:11px 13px;background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-sm);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;color:var(--text);"><code>https://recipe-nutrition-calculator-mcp.lipmichal.workers.dev/mcp</code></pre>
  <p style="margin-bottom:6px"><strong>Claude Code.</strong></p>
  <pre style="margin:0 0 12px;padding:11px 13px;background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-sm);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;color:var(--text);"><code>claude mcp add --transport http recipe-nutrition-calculator https://recipe-nutrition-calculator-mcp.lipmichal.workers.dev/mcp</code></pre>
  <p><a href="https://www.mcpstamp.com/free-servers/recipe-nutrition-calculator-mcp/">Setup steps</a> &middot; <a href="https://github.com/theluckystrike/recipe-nutrition-calculator-mcp">Source on GitHub</a></p>
</section>
```

## Notes
- Rollback for the three Pages sites was not exercised. The API call needs a token; the dashboard route works with the logged-in account.
- insert2.py holds the per-site section text and style tokens. Prose has no colons and no emoji (checked by an assert).
- No browser was started, so the new sections were checked by markup and curl, not by eye.
- No llms.txt on any of the six (bugbountyreality returns a 200 html fallback, not a real file).

## Open
- recipetool snippet (above) for the session that owns that site.
- Nothing else pending. Private pushes done once each with [skip ci], public pushes once each.
