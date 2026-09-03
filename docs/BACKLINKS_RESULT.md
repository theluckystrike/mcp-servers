# Estate backlinks run - 2026-09-03

status: PREPARED, NOT DEPLOYED

Two footer patches are written and diffed against the exact repo HEADs that are currently live.
Neither was deployed, because the mandatory pre-deploy local build could not be completed inside
this environment within the 35-minute cap. Per the run's own safety rule ("if any check fails,
do not deploy"), the patches are delivered as diffs instead. Nothing on either live site was
touched: the baseline checksums below are also the current checksums.

## Site selection

Candidates read from the operator's memory notes: worthmyclaim, ukmoneycalc, lakelevelnow,
dscrradar, kickllm, toolsthatrank, statewage.

| Site | Stack | Deploy path | Audience fit | Picked |
|---|---|---|---|---|
| ukmoneycalc.com | Astro 4 | GitHub Actions `deploy.yml` on push to main, then `wrangler pages deploy dist --project-name=ukmoneycalc` | UK pay, pension, take-home; self-employed and salaried money tools | YES |
| statewage.com | Astro 4 on Cloudflare Workers static assets | push to main, git-connected rebuild (last commit 2026-08-29 is live, so the path is verified) | US paycheck, overtime, commission, bonus | YES |
| lakelevelnow.com | Astro, GitHub Pages | clean | reservoir levels, no overlap with invoicing or time tracking | no, audience |
| worthmyclaim.com | Astro on Workers | wrangler Workers, not Pages | injury settlement; has no GSC property so traffic is unmeasurable | no |
| dscrradar / kickllm / toolsthatrank | mixed | memory records live-vs-repo drift on dscrradar and an uncommitted staged set on kickllm | - | no, drift risk |

Cap on sites touched: 3. Sites touched: 0 deployed, 2 patched locally.

## Working copies

`~/Desktop/portfolio-empire/*` is iCloud-dataless and unusable: `ls -lO` shows
`compressed,dataless` on `package.json`, `astro.config.mjs`, `package-lock.json`, `README.md`,
`tsconfig.json` and `wrangler.toml` in all three of ukmoneycalc, statewage and lakelevelnow, and a
`cat` of one of them plus a `git remote -v` in that tree hung past 120 s (the known broken-recall
signature). All work was therefore done in fresh shallow clones at `/private/tmp/bl35/`:

- `/private/tmp/bl35/ukmoneycalc` at `e44acc3` (2026-08-30, "Add dividend and bonus tax calculators")
- `/private/tmp/bl35/statewage` at `f2be828` (2026-08-29, "Add the commission tax calculator ...")

Drift check, both clean: `https://ukmoneycalc.com/calculators/dividend-tax/` returns 200 and
`https://statewage.com/commission-tax-calculator/` returns 200, so each clone's HEAD is what is live.

## Link targets

All three verified 200 before writing any patch:

| URL | HTTP |
|---|---|
| https://mcp.zovo.one/s/invoice | 200 |
| https://mcp.zovo.one/s/time-tracker | 200 |
| https://mcp.zovo.one/s/expense-tracker | 200 |

## Live baselines captured before any change

| URL | bytes | sha256 |
|---|---|---|
| https://ukmoneycalc.com/ | 10017 | 20f0a9045caa392a3f446064fb6157b47be8dd4f2bf84086c65fe628137a7915 |
| https://ukmoneycalc.com/calculators/take-home-pay/ | 17021 | 9d4bcd583a2fcd0dba882478d843bc8735447050386efb4d3f07fe8076c32c45 |
| https://statewage.com/ | 26915 | 2547fb2451c356fd20c0aab3b2d2fef7edf170090c71bad6e24bbca50cc11bcc |
| https://statewage.com/overtime-calculator/ | 11004 | fc41fb3b37dbcbfb7a2aa83b731781f138a406fd4c6f7faf0e94163583128a95 |

These are unchanged, because nothing was deployed. Re-run the same four `curl | shasum -a 256` calls
after a future deploy and expect a delta only inside the added block.

## Why the deploy was not attempted

`npm ci` in both clones never completed and produced an empty log; `node_modules` stalled at 317
partial entries with no `node_modules/.bin/astro`. `npx astro build` then hung to the timeout with
zero output on every attempt, sandboxed and unsandboxed, because it was trying to fetch astro from a
registry that is not reachable here. Exit 124 on three separate runs, no `dist/` produced.

Without a local build there is no evidence that the patched `Footer.astro` compiles, and the footer
is shared by every page on both sites, so a bad patch would break the whole site rather than one
page. Both deploy paths are fail-safe (a failing build in CI deploys nothing), but the run's rule is
to verify before deploying, so the run stops here.

## Patch 1 - ukmoneycalc

File: `src/components/Footer.astro`. Uses only classes that already exist in
`src/styles/global.css`: `.foot-links` is `display:flex; flex-wrap:wrap`, and `.foot-links h2`,
`.foot-links .col`, `.foot-links a` and `.foot-links span` are all already styled, so the new group
is a third flex child and needs zero new CSS. Three links, since UK freelancers and contractors are
the site's stated audience.

```diff
--- a/src/components/Footer.astro
+++ b/src/components/Footer.astro
@@ -20,6 +20,15 @@ const endYear = CURRENT_TAX_YEAR.end.slice(0, 4);
           <a href="/calculators/take-home-pay/">Take-home pay</a>
         </div>
       </div>
+      <div>
+        <h2>Tools for Claude and Cursor</h2>
+        <div class="col">
+          <span>Free MCP servers that let an AI assistant do your admin.</span>
+          <a href="https://mcp.zovo.one/s/invoice">MCP Invoice</a>
+          <a href="https://mcp.zovo.one/s/expense-tracker">MCP Expense Tracker</a>
+          <a href="https://mcp.zovo.one/s/time-tracker">MCP Time Tracker</a>
+        </div>
+      </div>
       <div>
         <h2>Resources</h2>
         <div class="col">
```

## Patch 2 - statewage

File: `src/components/Footer.astro`. The footer already ships an `empire-related` cross-site block
with inline styles; the new block copies that block's exact style string, border, radius, background
and grid so the two read as one pattern. Only `margin` differs, `0 auto 64px` instead of
`48px auto 64px`, so the two stacked sections do not double their gap.

```diff
--- a/src/components/Footer.astro
+++ b/src/components/Footer.astro
@@ -51,6 +51,18 @@ const verifiedMonth = ...
       <li><a href="https://ukmoneycalc.com/">UK take-home pay calculator</a></li>
   </ul>
 </section>
+<!-- MCP: tools for Claude and Cursor -->
+<section class="mcp-tools" aria-label="Tools for Claude and Cursor" style="max-width:760px;margin:0 auto 64px;padding:24px 28px;border:1px solid #e3e6ec;border-radius:14px;background:#fafbfc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2933">
+  <h2 style="margin:0 0 10px;font-size:18px;font-weight:700;letter-spacing:-.01em">Tools for Claude and Cursor</h2>
+  <p style="margin:0 0 14px;font-size:14px;color:#52606d">Free MCP servers that let an AI assistant handle the paperwork behind a paycheck: hours, receipts and billing.</p>
+  <ul style="list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 18px;font-size:14px">
+      <li><a href="https://mcp.zovo.one/s/time-tracker">MCP time tracker</a></li>
+      <li><a href="https://mcp.zovo.one/s/expense-tracker">MCP expense tracker</a></li>
+      <li><a href="https://mcp.zovo.one/s/invoice">MCP invoice generator</a></li>
+  </ul>
+</section>
+<!-- /MCP -->
+
 <!-- /Empire -->
 
 </footer>
```

## Links that would result

Sitewide footer links, so one link per indexed page, dofollow, from two domains that already receive
search traffic.

| From | To | Anchor |
|---|---|---|
| ukmoneycalc.com (all pages) | https://mcp.zovo.one/s/invoice | MCP Invoice |
| ukmoneycalc.com (all pages) | https://mcp.zovo.one/s/expense-tracker | MCP Expense Tracker |
| ukmoneycalc.com (all pages) | https://mcp.zovo.one/s/time-tracker | MCP Time Tracker |
| statewage.com (all pages) | https://mcp.zovo.one/s/time-tracker | MCP time tracker |
| statewage.com (all pages) | https://mcp.zovo.one/s/expense-tracker | MCP expense tracker |
| statewage.com (all pages) | https://mcp.zovo.one/s/invoice | MCP invoice generator |

## To finish this, on a machine with npm registry access

1. `cd /private/tmp/bl35/ukmoneycalc && npm ci && npm run build`, confirm `dist/index.html` contains
   `mcp.zovo.one/s/invoice` and that the diff against a HEAD build is confined to the footer.
2. Same for statewage.
3. Commit in each clone as `theluckystrike <support@zovo.one>`, push to main.
4. ukmoneycalc deploys through `.github/workflows/deploy.yml`; watch the run, then curl the four
   baseline URLs and diff against the sha256 values above, expecting a change only in the footer.
5. statewage rebuilds on push through its git connection; verify the same way. Per the ukmoneycalc
   memory note, curl each `/_astro/*` asset referenced by the built HTML after propagation, a first
   deploy has reported "already uploaded" and served 404s for seconds afterward.
6. If either live page fails, revert the commit and push, which redeploys the previous build.

## Constraints honoured

Zero paid APIs called. No `killall`, no `ps aux`. No writes into any iCloud-dataless tree. Nothing
deployed, so no rollback was needed. Only `docs/BACKLINKS_RESULT.md` and `data/distribution.json`
were committed in mcp-servers.
