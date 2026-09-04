# Estate backlinks round 2 - 2026-09-04

Goal: one crawlable HTML anchor to `https://mcp.zovo.one`, anchor text **MCP servers for Claude**,
from every indexed site the operator deploys from this machine. Round 1 (`BACKLINKS_RESULT.md`)
covered ukmoneycalc.com and statewage.com; this round covers the remaining twelve candidates.

Target verified before any patch: `https://mcp.zovo.one` returns 200, 26,575 bytes.

## Summary

| Site | Verdict |
|---|---|
| ml0x.com | SHIPPED, 65 pages |
| heytensor.com | SHIPPED, 121 pages |
| kickllm.com | SHIPPED, 65 pages |
| toolsthatrank.com | SHIPPED, 7 pages |
| aiwebsitepipeline.com | SHIPPED, 6 pages |
| deepvalueradar.com | SHIPPED, 46 pages |
| lakelevelnow.com | SHIPPED, 56 pages (CI build) |
| worthmyclaim.com | SKIPPED, repo is behind live |
| dscrradar.com | SKIPPED, repo is behind live |
| ingredientcalculator.com | SKIPPED, no repo, no deploy path |
| boldtake.io | SKIPPED, domain expired and parked for sale |
| statewage.com, ukmoneycalc.com | already done in round 1 |

## Per site

### ml0x.com
- live before: HTTP 200, `/` 50,322 bytes, 0 links to mcp.zovo.one
- repo: `theluckystrike/ml0x.com`, fresh shallow clone at `/private/tmp/bl36/ml0x.com`; `git status` clean at clone
- drift check: repo `index.html` is **byte-identical** to live (50,322 = 50,322)
- deploy: GitHub Pages, `main` branch, root path, legacy build. Push deploys.
- anchor location: inside the existing sitewide `<nav class="footer-links-seo">` block in the footer, same inline-free anchor style as its siblings, `target="_blank" rel="noopener"` to match
- commit: `Add MCP servers for Claude footer link`, 65 files
- verify: `/` HTTP 200, 50,409 bytes (+87, +0.17%), 1 anchor. Subpage `/tools/learning-rate-finder.html` HTTP 200, 45,323 bytes, 1 anchor.

### heytensor.com
- live before: HTTP 200, `/` 24,040 bytes, 0 links
- repo: `theluckystrike/heytensor.com` at `/private/tmp/bl36/heytensor.com`
- drift check: repo vs live differ only where Cloudflare rewrites the `mailto:` into `/cdn-cgi/l/email-protection` and injects `email-decode.min.js`. No content drift.
- deploy: GitHub Pages, `main`, root. Push deploys.
- anchor location: first item of the existing `<div class="zovo-network-links">` cross-site block (the "Explore More Tools" nav), plain `<a>` exactly like its neighbours
- commit: 121 files
- verify: `/` HTTP 200, 24,097 bytes (+57, +0.24%), 1 anchor. `/tools/` HTTP 200, 19,974 bytes, 1 anchor.

### kickllm.com
- live before: HTTP 200, `/` 24,833 bytes, 0 links
- repo: `theluckystrike/kickllm.com` at `/private/tmp/bl36/kickllm.com`
- drift check: repo `index.html` byte-identical to live (24,833 = 24,833)
- deploy: GitHub Pages, `main`, root. Push deploys.
- anchor location: same `zovo-network-links` block as heytensor
- commit: 65 files
- verify: `/` HTTP 200, 24,890 bytes (+57, +0.23%), 1 anchor. `/guides/` HTTP 200, 8,895 bytes, 1 anchor.

### toolsthatrank.com
- live before: HTTP 200, `/` 55,993 bytes, 0 links
- repo: `theluckystrike/toolsthatrank-site` at `/private/tmp/bl36/toolsthatrank-site`
- drift check: repo `index.html` byte-identical to live (55,993 = 55,993)
- deploy: GitHub Pages, `main`, root. Push deploys.
- anchor location: first item of the footer `<nav aria-label="Footer">` list
- commit: 7 files (every page carrying that nav)
- verify: `/` HTTP 200, 56,059 bytes (+66, +0.12%), 1 anchor. `/pricing/` HTTP 200, 41,038 bytes, 1 anchor.

### aiwebsitepipeline.com
- live before: HTTP 200, `/` 98,327 bytes, 0 links
- repo: `theluckystrike/aiwebsitepipeline` at `/private/tmp/bl36/aiwebsitepipeline`
- drift check: repo `index.html` byte-identical to live (98,327 = 98,327)
- deploy: GitHub Pages, `main`, root. Push deploys.
- anchor location: the footer nav. This site has three different hand-written footer shapes
  (`nav.flinks`, `nav.footnav`, `ul.footnav`); the anchor was added to all three, reaching 6 of 14 pages.
  The remaining 8 pages use a fourth shape and were left alone rather than risk a blind edit.
- commits: `Add MCP servers for Claude footer link` then `Extend MCP servers for Claude footer link to remaining pages`
- verify: `/` HTTP 200, 98,390 bytes (+63, +0.06 percent), 1 anchor. `/faq.html` HTTP 200, 82,536 bytes, 1 anchor.

### deepvalueradar.com
- live before: HTTP 200, `/` 1,028,538 bytes, 0 links
- repo: `theluckystrike/deepvalueradar` at `/private/tmp/bl36/deepvalueradar`
- drift check: local `astro build` produced `dist/index.html` at 1,028,619 bytes against a live 1,028,538,
  a difference of 81 bytes, which is exactly the inserted anchor plus its indentation. The repo is level with live.
- deploy: no CI. `package.json` `deploy` script = `wrangler pages deploy dist --project-name deepvalueradar`,
  run with `CLOUDFLARE_API_TOKEN` read from `~/.zshenv` and `npm_config_cache=/Users/mike/.npm-cache-local`.
  Deployment `https://7a1bfd7a.deepvalueradar.pages.dev`, 47 files uploaded, 21 already uploaded, 0 deleted.
- anchor location: `src/layouts/Base.astro`, last item of `<nav class="footer-nav">`, after Disclaimer
- build: 46 pages, all 46 carry the anchor
- verify: `/` HTTP 200, 1,028,619 bytes (+81, +0.008%), 1 anchor
- commit: not pushed to GitHub in this round, the site ships from the local dist by wrangler; the patched
  clone is at `/private/tmp/bl36/deepvalueradar`.

### lakelevelnow.com
- live before: HTTP 200, `/` 35,873 bytes, 0 links
- repo: `theluckystrike/lakelevelnow` at `/private/tmp/bl36/lakelevelnow`
- drift check: the local build differs from live only in (a) reservoir readings, which the CI refetches
  from USGS/CDEC at build time, and (b) the almanac CTA href. That href is not repo drift: `pages.yml`
  supplies `PUBLIC_ALMANAC_LINK_SINGLE=https://buy.stripe.com/00w3cw2oafoc7VXgjj43S0q` as a build env var,
  so the CI build reproduces the live Stripe link. Structure, nav and footer match live exactly.
- deploy: push to `main`. `.github/workflows/pages.yml` builds and publishes GitHub Pages, which serves the
  apex; `deploy.yml` additionally ships a Workers preview. Both fire on push.
- anchor location: `src/components/Footer.astro`, appended to the existing `<div class="flinks">` list after Contact
- build: local `astro build` produced 59 pages, 56 carrying the anchor (the 3 without are layout-free files)
- commit: `Add MCP servers for Claude footer link`, 1 file
- verify: `/` HTTP 200, 35,929 bytes (35,873 before, +56, +0.16 percent), 1 anchor.

### worthmyclaim.com - SKIPPED
Live `/` (HTTP 200, 23,839 bytes) links to `/personal-injury-settlement-formula/` and
`/wrongful-death-settlement-calculator/` from its calculator card grid and its footer. Neither page
exists in `theluckystrike/worthmyclaim` at `main`, and the built `dist/` is 28 pages against a live
site that has at least 30. The repo is behind live, so `wrangler deploy` from it would delete two
live pages. Matches the operator's recorded shipping dates for those two pages (2026-08-24 and
2026-08-29) and the known dscrradar failure mode. Patch written, **not committed, not deployed**.

### dscrradar.com - SKIPPED
Memory already records the GitHub clone as three weeks behind live. Confirmed independently:
`https://dscrradar.com/rental-vacancy-by-county/` returns HTTP 200 and `src/pages/` in the clone has
no such route. Deploying the clone would delete live pages. Not touched.

### ingredientcalculator.com - SKIPPED
Live returns HTTP 200 (91,418 bytes) but no deploy path could be established. The GitHub repos named
`ingredientcalculator` and `ingredientcalc` are a Rust crate and a D package, not this site. The only
local working copy, `~/Desktop/ingredientcalculator`, is **not a git repository** at all
(`fatal: not a git repository`) and its files are iCloud `compressed,dataless`. Skipped rather than guess.

### boldtake.io - SKIPPED
The domain has expired. `https://boldtake.io/` returns HTTP 200 with a Porkbun parking page titled
"porkbun.com | domain for sale". There is no site to link from.

## Method notes

- Every repo was cloned fresh and shallow into `/private/tmp/bl36/`. Nothing was written into
  `~/Desktop/portfolio-empire`, which is iCloud-dataless.
- No `git stash` and no `git reset` anywhere.
- `npm install` with `npm_config_cache=/Users/mike/.npm-cache-local` completed in all three Astro
  repos, where the default Desktop-backed cache would have blocked on iCloud recall.
- No em dashes and no emoji were added to any page. Every inserted anchor is a plain `<a href>` that
  copies the surrounding block's own markup style, and no CSS was added anywhere.
- The insertion is additive on every site: the diffs are pure insertions except on ml0x, where the
  footer nav is a single line so the line is rewritten in place (65 insertions, 65 deletions, one line each).
