# Content round 18: GET /changelog generated from docs/RELEASE_V*.md - 2026-09-05

status: DONE

## What shipped

Edited `scripts/build-pages.mjs`, `billing/src/index.js`, `billing/test/bundle.test.mjs`,
`billing/test/store-src.test.mjs`, added `billing/test/changelog.test.mjs`, regenerated
`billing/src/pages.js`, and this result file. No changes to `scripts/release-check.mjs` or
`scripts/kpi.mjs` (owned by another agent this round).

1. `scripts/build-pages.mjs` reads every `docs/RELEASE_V*.md` and parses, per file:
   - version and date from the header line (`# Release v0.11.0 (2026-09-05)`). Twelve release
     files exist (v0.6.0 through v0.11.0). Seven of the twelve (v0.6.0, v0.6.1, v0.7.0, v0.8.0,
     v0.9.0, v0.9.1, v0.9.2) carry no date in the header line at all; the page says so for each
     one ("date not recorded in the release file") instead of guessing a date from git history
     or anywhere else. Only v0.9.3 onward put a date in the header.
   - the evidence: either the one-line `evidence:` field (v0.9.3+) verbatim, or, for the six
     older files that use `## evidence` / `## insight` / `## artifacts` markdown headings instead
     of inline fields, the first prose paragraph found under that heading (skipping subheadings
     and code fences), lines joined with a single space. Never composed or summarized.
   - the insight: the first full sentence of the `insight:` line or `## insight` paragraph, using
     the same sentence-split rule as the existing `evidenceSentence()` helper in this file (so
     abbreviations, decimals and quoted openers do not fire a false split).
   - the GitHub release link: the first `https://github.com/.../releases/tag/...` URL in the file,
     trailing punctuation stripped.
   - `CHANGELOG = { releases, serverCount, currentVersion }` is written into `billing/src/pages.js`
     alongside `PAGES`. `serverCount` is `ids.length` (21, the same list this script already uses
     to build `PAGES`, which is the single-server set `PRODUCTS` minus `bundle`). `currentVersion`
     is `releases[0].version` after sorting numerically descending, i.e. the newest release file's
     own version, not a separately typed constant, so it cannot drift from what render.
2. `billing/src/index.js`: added `changelogPage()` (same shape as `bundlePage()`: `page()` wrapper,
   `esc()` on every value, a meta description under 160 chars, no JSON-LD per the task). Routed at
   `GET /changelog`. Footer link "Changelog" added next to the support line. `/sitemap.xml`'s url
   list gained `/changelog`. `/llms.txt` gained one line linking it and naming the version range
   and current version.
3. Two pre-existing tests broke on the second export in `pages.js` and were fixed, not disabled:
   - `billing/test/store-src.test.mjs` parsed `pages.js` by slicing after the first `=` and calling
     `JSON.parse` on the rest, which now runs into `export const CHANGELOG = ...` mid-string. Fixed
     to slice specifically between `export const PAGES = ` and `;\nexport const CHANGELOG`.
   - `billing/test/bundle.test.mjs` asserted the literal sitemap array prefix
     `["/", "/bundle", "/guides", "/compare"`; updated to
     `["/", "/bundle", "/changelog", "/guides", "/compare"` to match the new insertion point.
4. New `billing/test/changelog.test.mjs`: every version under `docs/RELEASE_V*.md` appears on the
   live page; the newest version renders first (checked against a fresh, independent scan of
   `docs/` sorted by numeric version, not by trusting the build script's own order); the meta
   description is under 160 chars; footer/sitemap/llms.txt all link `/changelog`; and a
   whitespace-normalized substring check that every rendered evidence and insight sentence
   actually occurs in its source release file, so a future change to the extraction logic cannot
   quietly start inventing text.

## Quality gate

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|revolutionary|blazing|cutting-edge|leverage' on scripts/build-pages.mjs, billing/src/index.js (new/changed lines), billing/src/pages.js (CHANGELOG section), billing/test/changelog.test.mjs, billing/test/bundle.test.mjs, billing/test/store-src.test.mjs -> 0
      (billing/src/index.js has one pre-existing hit, "unlocks Pro", in the untouched bundlePage() body copy, not in any line this round wrote)
    em dash count across the same files                                            -> 0
    non-ASCII count across the same files                                          -> 0
      (billing/src/pages.js has one pre-existing non-ASCII character, "L with stroke" in a server's
       README-derived PAGES entry, unrelated to the CHANGELOG section this round added)
    node --check scripts/build-pages.mjs, billing/src/index.js                     -> syntax OK
    Rendered /changelog HTML itself, checked for the same three patterns           -> 0, 0, 0

## Verification

    cd billing && npm test        -> 72 pass, 1 fail
      The 1 failure ("the round each page names is one that scored at least as well as any other
      round for that server", billing/test/first-five.test.mjs) is pre-existing: confirmed by
      stashing this round's changes (git stash, which keeps the new untracked changelog.test.mjs
      out of the run) and re-running npm test on the unmodified tree, where the same test fails
      with the same message and count (67 pass, 2 fail there, one of the two being the stashed-out
      changelog suite itself failing to import). Not touched or caused by this round.

    git pull --rebase --autostash  -> already up to date
    wrangler deploy                -> mcp-billing, Version 8cdfe7e8-97c3-433b-949b-4728d0b0481c

    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/changelog          -> 200
    curl -s https://mcp.zovo.one/changelog | grep -o 'v0\.[0-9]*\.[0-9]*' | sort -u -> all 12
      versions present (v0.6.0, v0.6.1, v0.7.0, v0.8.0, v0.9.0 through v0.9.5, v0.10.0, v0.11.0)
    curl -s https://mcp.zovo.one/sitemap.xml | grep -c /changelog                  -> 1
    curl -s https://mcp.zovo.one/llms.txt    | grep -c /changelog                  -> 1
    curl -s https://mcp.zovo.one/             | grep -o 'href="/changelog"'        -> present (footer)

    POST https://api.indexnow.org/IndexNow (key from data/indexnow.key, 3 URLs: /changelog,
      /sitemap.xml, /llms.txt) -> HTTP 200

## Discrepancy found and not smoothed over

The task description says "date from the header line" as if every release file carries one.
Seven of the twelve do not (v0.6.0, v0.6.1, v0.7.0, v0.8.0, v0.9.0, v0.9.1, v0.9.2); only the run
of files from v0.9.3 onward added a `(YYYY-MM-DD)` to the header. Rather than infer a date from
`git log` (a fact about the commit, not a fact stated in the release file, and the task's "never
invent text" rule reads as covering more than prose) the page renders "date not recorded in the
release file" for those seven and a real date for the other five. A future round that wants every
release dated should add the date to those seven header lines directly, which then flows through
this same parser with no further change needed here.

Zero paid API calls.
