# Release v0.9.1

status: DONE

A patch release: no new server, no new bundle. Everything shipped in it was written
between v0.9.0 and now, and all of it is a seam fix or a check. The one number that
changed shape is the manifest count, because `servers/barcode/server.variant.json`
(`io.github.theluckystrike/qr-code`) was added by the release checker's first run, taking
the publishable set from 46 to 47.

## evidence

### 1. Versions

19 servers plus `servers/office-suite` and `packages/mcp-license` bumped to 0.9.1 (21
package.json files), and 38 internal `@theluckystrike/*` ranges rewritten to `^0.9.1`.

`ls servers/*/server*.json` is 71 files; 67 were bumped: 20 `server.json`,
20 `server.mcpb.json`, 16 `server.variant.json`, `servers/docx/server.templates.json` and
the 10 round-4 name manifests (pivot, thumbnails, terms, cashflow, sow, scheduling,
subscriptions, freelance, career, standup). 47 of them carry an mcpb `identifier` URL,
each moved from `/download/v0.9.0/` to `/download/v0.9.1/`.

The 4 files left untouched are
`servers/{invoice,price-tracker,spreadsheet,time-tracker}/server.npm-package.json`, npm
registry fragments pinned at 0.1.0. No `@theluckystrike` package is on npm, so bumping
them would assert a release that does not exist. They were left alone at v0.6.1 through
v0.9.0 for the same reason.

```
node scripts/release-check.mjs   green, 1 recorded gap (zip compare), not blocking
npm install                      ok
npm run build                    20 workspaces, tsc clean (prebuild ran sync-versions.mjs)
npm test                         exit 0; tests 907, pass 896, fail 0, cancelled 0, skipped 11
```

Zero cancelled, checked as its own field, and the exit code was 0. `fail 0` alone does not
mean green: a cancelled run also reports `fail 0`. The suite grew from 868 to 907 tests,
the 39 new ones being the contract suites for bank-statement, calendar, image, kanban and
pdf.

### 2. release-check

`scripts/release-check.mjs` ran first, as the first step of `scripts/build-mcpb.sh`, over
24 checks and 19 servers. Green on every cell. The one recorded gap is `zip compare`, a
content gap waived in the script's own table.

The waiver table shrank this release without anything being waived: the ten `spec` and
`contract` gaps open at the time `docs/RELEASE_CHECK.md` was written were closed by
writing the SPEC and contract suites for all five servers, and the entries were deleted
rather than left to report `STALE`.

### 3. Bundles

`scripts/build-mcpb.sh` run with `/opt/homebrew/bin/bash` (the pinned interpreter; plain
`bash scripts/build-mcpb.sh` gets macOS bash 3.2 and dies on `declare -A`) built 20
bundles. office-suite vendors all 19 children and is 26 MB packed.

Every bundle was checked standalone: unzipped outside the monorepo, `server/index.js`
spawned with a clean `HOME`/`XDG_DATA_HOME`/`TMPDIR` and cwd, `initialize` sent over
stdio. **20 of 20 returned `serverInfo.version` 0.9.1, each matching its own bundle
`manifest.json`.**

### 4. Release and registry

Pushed first, per the v0.6.0 failure, then `gh release create v0.9.1 bundles/*.mcpb`:
20 assets at https://github.com/theluckystrike/mcp-servers/releases/tag/v0.9.1.

sha256 of each bundle written into every manifest that references one, resolved from the
`identifier` URL rather than the folder name: **47 manifests**, 47 of 47 values changed
(every bundle was rebuilt, so no sha survived).
barcode: `6c55155658ffb2de434121f1277fa3a8f12dd3b38919662c68b8ed7a3d6947b8`.
zip: `b866b4a73e4992b019aad7bc053c2d4804d4eacee51363d4b2efa34596fa7d0d`.
`remotes` compared against `remotes.json` by value: 19 of 19 equal.

`mcp-publisher login github -token "$(gh auth token)"`, then 20 `server.mcpb.json`, 16
`server.variant.json`, 1 `server.templates.json` and 10 `server.<token>.json` published
from a bash array (never `for f in $FILES`; zsh does not word-split an unquoted parameter
expansion, and the v0.8.0 run failed with `file name too long` for it): **47 of 47, no
422s**. Verified by fully qualified name through
`GET /v0/servers?search=<fully qualified name>&version=latest`, in batches of eight
concurrently with up to four retries per name: **47 of 47 at 0.9.1, on the first pass, no
retry needed** (v0.9.0 needed four attempts for the newest names).

### 5. Mirrors

`scripts/sync-mirrors.sh` pushed all 20. Verified the way the script's contract claims:
fresh `git clone` of `mcp-barcode`, then `npm install && npm run build && npm test` with
no access to the monorepo. **version 0.9.1, exit 0, 44 tests, 36 pass, 0 fail, 0
cancelled, 8 skipped** (Pro-key tests, whose signing key never leaves the monorepo; the
script printed `pro-tier helper exports: proKey`, so the signer was seen and those tests
were skipped rather than left to run against an empty key).

### 6. Ledger

`data/distribution.json`: 69 version strings moved to 0.9.1; the `registry` surface note
rewritten for the new counts (20 primary + 16 variants + 1 templates + 10 round-4 names =
47; 19 hosted); and `per_server.barcode` given the `registry-name` row it never had,
now that barcode has a second registry name.

### 7. What is actually in the release

Rounds 13 and 14 seam fixes: barcode SEPA profile fallback, time-tracker `entry_edit` and
home-zone clock, currency window clamp, price-tracker single display path, docx and resume
read-back guidance. 22 over-length and 23 non-imperative tool descriptions rewritten.
SPEC.md and contract tests for five servers. The release checker itself.
`scripts/publish-all.sh` now derives its package list and publish order from the
workspace, so it covers 21 packages instead of a hardcoded 4.

## artifacts

- /Users/mike/mcp-servers/bundles/*.mcpb (20)
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/RELEASE_V091.md
- https://github.com/theluckystrike/mcp-servers/releases/tag/v0.9.1
- 20 mirror repos https://github.com/theluckystrike/mcp-<name>

## cost

Under 60 wall minutes. Zero paid API calls, zero paid submissions.

## failures

None that needed a fix. The two hazards the previous releases recorded were both avoided
by following the recorded recipe rather than rediscovering it:

1. `git pull --rebase` still cannot run with `bundles/**` dirty, so every pull in this
   release used `--rebase --autostash`, which does work, and the source commit came
   before the pull rather than after it.
2. The registry search index was eventually consistent within the batch loop this time.
   The four-retry loop was in place and never fired, which is not evidence that it is
   unnecessary: 8 of 46 names needed it at v0.9.0.

## insight

v0.9.0 closed with an observation that nothing checked the reverse direction of the
wiring: no reader asserted that a server with a `remotes.json` also had a variant name, or
that a new server got its second registry name at all. `scripts/release-check.mjs` is that
reader, and its first run found nineteen real wiring failures across 456 cells, including
the exact defect predicted: `barcode` had one registry name, one server after `zip` had
the same problem.

The interesting part is the shape of what it found. Nine of nineteen were registry
descriptions over 100 characters in `server.json` and five more were sentences a previous
machine fix had cut mid-word. None of those would have been caught by any release, because
`server.json` is never published: it is the npm-registry variant, held back until an
`@theluckystrike` package exists on npm. It has been accumulating damage for nine releases
in a file nobody reads, and it would have 422'd on the first day it mattered. A check over
the artifacts you do not ship yet is worth as much as one over the artifacts you do,
because the unshipped ones are exactly where nothing else is looking.

This release is the first where the version bookkeeping cost nothing to trust: green
checker, green build, green tests, 47 of 47 published and verified on the first pass, 20
of 20 bundles booting at the right version. That is what a patch release should look like,
and it is the release-check script that made the difference between believing it and
knowing it.
