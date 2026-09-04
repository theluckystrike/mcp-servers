# Release v0.7.0

status: DONE

The first release that ships `servers/quotes`, and the first with 18 bundles. Everything
else in it is version bookkeeping plus two defects found on the way: an office-suite test
fixture broken since v0.6.1, and a mirror script whose office-suite child list was
hand-maintained.

## evidence

### 1. Versions

17 servers plus `servers/office-suite` and `packages/mcp-license` bumped to 0.7.0, and every
internal `@theluckystrike/*` range rewritten to `^0.7.0`. `servers/quotes` was excluded from
the v0.6.1 bump (it was another agent's server at the time) and still carried `^0.6.0` ranges;
it is in the bump now.

Catalogue files moved with them: 18 `server.json`, 18 `server.mcpb.json`, 14
`server.variant.json` and `servers/docx/server.templates.json`, including each mcpb
`identifier` URL from `/download/v0.6.1/` to `/download/v0.7.0/`.

`servers/quotes/server.variant.json` is new: `io.github.theluckystrike/estimates`, the
one-word second name the other twelve servers already have. It is stdio-only (no `remotes`
block, unlike `server.mcpb.json`) and its description is 88 characters, under the registry's
100-character limit that produced 422s at v0.6.0. `server.mcpb.json`'s own description was
110 characters and would have been rejected on this publish; it is 90 now.

```
npm install    ok
npm run build  19 workspaces, tsc clean (prebuild ran scripts/sync-versions.mjs, 18 version.ts rewritten)
npm test       tests 771, pass 760, fail 0, cancelled 0, skipped 11
```

### 2. The office-suite fixture that has been dead since v0.6.1

`npm test` exited 1 with `fail 0`. Four office-suite tests reported
`failureType: 'cancelledByParent'`, which the aggregate `# fail` line does not count, and the
whole file finished in 105 ms: the suite under test was exiting instantly.

`servers/office-suite/test/{proxy,round7}.test.mjs` build a throwaway monorepo-shaped tree and
`copyFileSync(ENTRY, join(suiteDist, "index.js"))` into it. v0.6.1 made `dist/index.js` import
a generated sibling, `./version.js`. Reproduced by hand:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../dist/version.js'
  imported from '.../dist/index.js'
```

Fixed by copying the built directory rather than one file, so any future generated sibling
travels with it:

```
cpSync(dirname(ENTRY), suiteDist, { recursive: true });
```

This is the same class of defect the v0.6.1 insight described, one step further out: the
release fixed the drift between a version literal and package.json, and the fix broke a
fixture that had assumed `index.js` was the whole build. It went unnoticed for a release
because a cancelled test is not a failed test in the TAP summary.

### 3. Bundles

`scripts/build-mcpb.sh` (run with `/opt/homebrew/bin/bash`; `set -u` plus `declare -A` under
the system bash 3.2 fails at line 32 with `time: unbound variable`) built 18 bundles, quotes
and office-suite included.

Every bundle was checked standalone: unzipped outside the monorepo, `server/index.js` spawned
with a clean `XDG_DATA_HOME`, and `initialize` answered. 18 of 18 returned
`serverInfo.version` 0.7.0 matching their own `manifest.json`. office-suite answered from the
bundle's vendored children.

### 4. Release and registry

Pushed first, per the v0.6.0 failure: `4879561..da2ca6d main -> main`, then
`gh release create v0.7.0 bundles/*.mcpb`, 18 assets at
https://github.com/theluckystrike/mcp-servers/releases/tag/v0.7.0.

sha256 of each bundle written into its `server.mcpb.json`, `server.variant.json` and
`server.templates.json` before the commit, 33 manifests. quotes:
`35267fa498773abae278308137a0fe0120d46f8890622f6597db3479228f49ab`.

`servers/<name>/remotes.json` is merged into the `remotes` block of `server.mcpb.json` for all
17 servers that have one (office-suite has none); checked equal by value, quotes included.

`mcp-publisher login github -token "$(gh auth token)"`, then 18 `server.mcpb.json`, 14
`server.variant.json` and 1 `server.templates.json` published: 33 of 33, no 422s. Verified by
exact-name lookup through `GET /v0/servers?search=<short name>&version=latest`: **33 of 33 at
0.7.0**. One name, `io.github.theluckystrike/calendar` (the timezone variant), does not appear
in the `search=calendar` page and needs the fully qualified name as the search term; it is at
0.7.0.

### 5. Mirrors

`scripts/sync-mirrors.sh` pushed all 18, `mcp-quotes` for the first time. The new mirror was
verified the way the script's contract claims: fresh `git clone`, then
`npm install && npm run build && npm test` with no access to the monorepo. Exit 0, 30 tests,
6 pass, 24 skipped (the Pro-key tests the mirror deliberately skips, since
`keys/license-private.pem` never leaves the monorepo).

One fix there. The office-suite branch vendored a hand-written list of eleven children while
step 3 rewrites *every* `@theluckystrike` dependency in `package.json` to `file:vendor/<pkg>`.
`servers/office-suite` depends on twelve; `mcp-pdf` and `mcp-calendar` were rewritten to
vendor paths that the mirror did not contain, so a fresh clone of `mcp-office-suite` could not
resolve them. office-suite is not a special case at all: its children are exactly its own
`@theluckystrike` dependencies, so the special case was deleted and the generic branch now
runs for every server, quotes included.

### 6. Ledger

`data/distribution.json`: 51 version strings moved to 0.7.0, the `registry` and `mcpb` surface
notes rewritten for the new counts (18 primary + 14 variants + 1 templates; 17 hosted), a
`registry-templates` row added to docx, and `per_server.quotes` filled in from four fields to
the full eleven every other server has, with `registry`, `mcpb`, `github-mirror`,
`registry-variant` and `hosted` all at 0.7.0.

## artifacts

- /Users/mike/mcp-servers/servers/quotes/server.variant.json
- /Users/mike/mcp-servers/servers/office-suite/test/proxy.test.mjs
- /Users/mike/mcp-servers/servers/office-suite/test/round7.test.mjs
- /Users/mike/mcp-servers/scripts/sync-mirrors.sh
- /Users/mike/mcp-servers/bundles/*.mcpb (18)
- /Users/mike/mcp-servers/data/distribution.json
- https://github.com/theluckystrike/mcp-servers/releases/tag/v0.7.0
- 18 mirror repos https://github.com/theluckystrike/mcp-<name>

## cost

About 70 wall minutes. Zero paid API calls.

## failures

1. `bash scripts/build-mcpb.sh` failed at line 32 with `time: unbound variable`. The script's
   shebang pins `/opt/homebrew/bin/bash` because it needs bash 4 associative arrays; invoking
   it as `bash <script>` on macOS runs bash 3.2 instead, which parses `declare -A` as a plain
   assignment and then trips `set -u` on the first array read. Re-run with the pinned
   interpreter.
2. The registry search API did not return `io.github.theluckystrike/calendar` for
   `search=calendar`, so a name-by-name verification loop reported it missing. It is
   published at 0.7.0; the fully qualified name as the search term finds it.

## insight

`npm test` exiting 1 while every summary line says `fail 0` is the shape to watch for. Node's
test runner counts a subtest killed by the runner as `cancelled`, not `fail`, and the standard
aggregation over `# fail` lines therefore reports a green suite for a file whose tests all
died at startup. Four office-suite tests had been in that state since v0.6.1 and the v0.6.1
record reports the suite as green, because the reader was summing the wrong field. The reader
here sums `cancelled` too, and the number that decided this release was the process exit code.
The same shape appears twice more in this release: the mirror script's office-suite child list
and the manifest description length were both writers with no reader asserting they still
agreed with anything, and both would have failed silently downstream, in a fresh clone and in
a 422.
