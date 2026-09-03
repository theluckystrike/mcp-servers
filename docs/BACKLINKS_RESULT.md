# Estate backlinks run - 2026-09-03

status: DONE, both sites deployed and verified live

Sitewide footer blocks linking mcp.zovo.one now ship on two owned Astro sites that already receive
search traffic. Two sites touched, cap was three. No rollback was needed.

## Result

| Site | Commit | Deploy mechanism | Pages carrying the links | Live verified |
|---|---|---|---|---|
| ukmoneycalc.com | `1cab454` | `.github/workflows/deploy.yml` on push to main, then `wrangler pages deploy dist --project-name=ukmoneycalc` | 15 of 16 | yes |
| statewage.com | `362f2d8` | `wrangler deploy` (Workers static assets), version `503012c3-b018-4de3-8826-0637649f19f3` | 63 of 64 | yes |

The one page per site without the links is `google1a218412aeef37cf.html`, the Search Console
verification file, which correctly has no layout.

## Site selection

Candidates read from the operator's memory notes: worthmyclaim, ukmoneycalc, lakelevelnow,
dscrradar, kickllm, toolsthatrank, statewage.

| Site | Verdict |
|---|---|
| ukmoneycalc.com | picked. Astro 4, unambiguous CI deploy, UK pay and pension audience |
| statewage.com | picked. Astro 4 on Workers, US paycheck audience, footer already carried a cross-site block to copy |
| lakelevelnow.com | rejected, reservoir levels have no overlap with invoicing or time tracking |
| worthmyclaim.com | rejected, memory records it has no GSC property so the traffic claim is unmeasurable |
| dscrradar, kickllm, toolsthatrank | rejected, memory records live-vs-repo drift or uncommitted staged deploy sets |

## Working copies

`~/Desktop/portfolio-empire/*` is iCloud-dataless and unusable. `ls -lO` shows `compressed,dataless`
on `package.json`, `astro.config.mjs`, `package-lock.json`, `README.md`, `tsconfig.json` and
`wrangler.toml` in all three of ukmoneycalc, statewage and lakelevelnow, and a single `cat` plus a
`git remote -v` in that tree hung past 120 s, the known broken-recall signature. All work was done in
fresh shallow clones under `/private/tmp/bl35/`.

Drift check before patching, both clean: the newest commit in each clone is what production serves.
`https://ukmoneycalc.com/calculators/dividend-tax/` (from `e44acc3`, 2026-08-30) returns 200 and
`https://statewage.com/commission-tax-calculator/` (from `f2be828`, 2026-08-29) returns 200.

## Link targets

Verified 200 before any patch was written: `https://mcp.zovo.one/s/invoice`,
`https://mcp.zovo.one/s/time-tracker`, `https://mcp.zovo.one/s/expense-tracker`.

## Before and after

Captured with `curl` then `shasum -a 256`, before any change and again after deploy.

| URL | bytes before | sha256 before | bytes after | sha256 after |
|---|---|---|---|---|
| https://ukmoneycalc.com/ | 10017 | 20f0a9045caa392a3f446064fb6157b47be8dd4f2bf84086c65fe628137a7915 | 10359 | 605d52d012023d4a3f6a506c70949f33aeda45f25783c1845df29f751acf306f |
| https://ukmoneycalc.com/calculators/take-home-pay/ | 17021 | 9d4bcd583a2fcd0dba882478d843bc8735447050386efb4d3f07fe8076c32c45 | 17363 | 0a12164a9c5a500ac50dbe7c2bb72d01e1a7585b4f446e5b83f899dbd960ccd5 |
| https://statewage.com/ | 26915 | 2547fb2451c356fd20c0aab3b2d2fef7edf170090c71bad6e24bbca50cc11bcc | 27950 | e22594af23bee719579cd5f519a58a08b954af349f690029a14a5d6f442e1202 |
| https://statewage.com/overtime-calculator/ | 11004 | fc41fb3b37dbcbfb7a2aa83b731781f138a406fd4c6f7faf0e94163583128a95 | 12039 | not captured, link count 3 confirmed |

Each ukmoneycalc page grew by exactly 342 bytes and each statewage page by exactly 1035 bytes, the
size of the respective block, which is itself evidence that nothing else moved.

## Proof that nothing else changed

For each site the live page was normalised (`>\s*<` split onto lines) and diffed against the
pre-change capture. ukmoneycalc home: a single hunk `196a197,205`, the nine lines of the new footer
group. statewage home: a single hunk `435a436,452`, the seventeen lines of the new section. No
deletions, no modifications, no other insertions anywhere in either document.

Stronger still, the deployed page is byte-identical to the locally built artifact that was inspected
before deploy: `cmp` of the live `https://ukmoneycalc.com/` against `dist/index.html` and of
`https://statewage.com/` against its `dist/index.html` both pass. The statewage deploy uploaded 63
files and deleted 0, so the dscrradar failure mode where a stale clone deletes live pages did not
occur. Every `/_astro/*` asset referenced by the built statewage HTML returns 200 after propagation.

## Patch 1 - ukmoneycalc

`src/components/Footer.astro`, a third group inside `.foot-links`. No new CSS: `.foot-links` is
`display:flex; flex-wrap:wrap` and `.foot-links h2`, `.foot-links .col`, `.foot-links a` and
`.foot-links span` are all already defined in `src/styles/global.css`, so the block inherits the
site's tokens exactly.

```diff
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
```

## Patch 2 - statewage

`src/components/Footer.astro`, a section placed directly after the existing `empire-related`
cross-site block and copying that block's exact inline style string, border, radius, `#fafbfc`
background and auto-fit grid, so the two read as one pattern. Only the top margin differs,
`0 auto 64px` instead of `48px auto 64px`, so the stacked sections do not double their gap.

```diff
@@ -51,6 +51,18 @@
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
```

## Links now live

Dofollow sitewide footer links, one set per indexed page, from two domains with existing search
traffic.

| From | To | Anchor |
|---|---|---|
| ukmoneycalc.com, 15 pages | https://mcp.zovo.one/s/invoice | MCP Invoice |
| ukmoneycalc.com, 15 pages | https://mcp.zovo.one/s/expense-tracker | MCP Expense Tracker |
| ukmoneycalc.com, 15 pages | https://mcp.zovo.one/s/time-tracker | MCP Time Tracker |
| statewage.com, 63 pages | https://mcp.zovo.one/s/time-tracker | MCP time tracker |
| statewage.com, 63 pages | https://mcp.zovo.one/s/expense-tracker | MCP expense tracker |
| statewage.com, 63 pages | https://mcp.zovo.one/s/invoice | MCP invoice generator |

## Findings worth keeping

**statewage does NOT deploy on push, and its own workflow comment says it does.** The header of
`.github/workflows/weekly-refresh.yml` reads "Cloudflare Pages (git-connected) rebuilds
automatically on the push". That is stale and wrong. `362f2d8` was pushed to `main` and the live
site stayed byte-identical to its pre-change checksum with zero mcp links. `wrangler.toml` is the
truthful source: the site is Cloudflare **Workers** static assets, pivoted off Pages because the
account is at the 100/100 Pages cap, and it ships only via `wrangler deploy`. That comment should be
corrected, otherwise every future push looks deployed and is not. ukmoneycalc, by contrast, really
does deploy from CI on push.

**`npm ci` cannot complete on this machine.** It hangs to timeout and dies on SIGTERM, because the
npm cache is configured at `~/Desktop/bugbounty/poc-verify/npm-cache`, which is on the
iCloud-backed Desktop. Every `npm ci` therefore blocks on iCloud recall. `npx astro build` does
work, but it exits 124 while having already written a complete and correct `dist/`, so the timeout
is a false negative. Check for `dist/` before concluding a build failed here.

**A pipe to `tail` hides a build failure.** `npm run build 2>&1 | tail -8` reported exit code 0 while
the log said `sh: astro: command not found`. Only the unpiped run surfaced the real status. Never
judge a build by the exit code of a pipeline.

**Two commits appeared in the site clones that this session did not issue.** `1cab454` in
ukmoneycalc at 07:21:57 +0700 and `362f2d8` in statewage at 07:22:01 +0700, both authored
`theluckystrike <support@zovo.one>`, both already pushed to `origin/main`, both containing this
run's patch text character for character. This session's own commit attempt, made afterwards,
returned "nothing to commit, working tree clean". The reflog shows only `clone` then `commit`, with
no push entry. The cause was not established. The content was verified line by line against the
intended patch and against the live pages before anything else was done, and it is correct, but the
provenance is unexplained and worth investigating, since something outside this session can commit
and push to these repos. Compare the operator's existing note on parallel agents sharing a worktree.

## Constraints honoured

Two sites touched, cap three. Zero paid APIs. No `killall`, no `ps aux`. No writes into any
iCloud-dataless tree. Baselines captured before every deploy, every live page re-verified after,
and no check failed, so no rollback was triggered. Only `docs/BACKLINKS_RESULT.md` and
`data/distribution.json` were committed in mcp-servers.
