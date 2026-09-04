# Release v0.8.0

status: DONE

The first release that ships `servers/barcode`, and the first with 19 bundles, 19 mirrors
and 44 registry entries. Everything else is version bookkeeping plus one defect caught
before it could 422: the barcode mcpb manifest carried a 106-character description and no
`remotes` block.

## evidence

### 1. Versions

18 servers plus `servers/office-suite` and `packages/mcp-license` bumped to 0.8.0, and 37
internal `@theluckystrike/*` ranges rewritten to `^0.8.0`.

Catalogue files moved with them. `ls servers/*/server*.json` is 67 files; 63 were bumped:
19 `server.json`, 19 `server.mcpb.json`, 14 `server.variant.json`,
`servers/docx/server.templates.json` and the 10 round-4 name manifests from
`docs/NAMING_R4_RESULT.md` (`server.<token>.json`: pivot, thumbnails, terms, cashflow,
sow, scheduling, subscriptions, freelance, career, standup). 44 of them carry an mcpb
`identifier` URL, each moved from `/download/v0.7.0/` to `/download/v0.8.0/`.

The 4 files left untouched are `servers/{invoice,price-tracker,spreadsheet,time-tracker}/server.npm-package.json`.
They are npm-registry fragments pinned at 0.1.0, no `@theluckystrike` package is on npm,
and they were not bumped at v0.6.1 or v0.7.0 either. Bumping them would assert an npm
release that does not exist.

```
npm install    ok
npm run build  20 workspaces, tsc clean (prebuild ran scripts/sync-versions.mjs, 19 version.ts rewritten)
npm test       exit 0; tests 818, pass 807, fail 0, cancelled 0, skipped 11
```

Zero cancelled, checked as its own field per the v0.7.0 insight, and the exit code was 0.

### 2. The barcode manifest that would have 422'd

`servers/barcode/server.mcpb.json` was written when the server was added, before any
publish. Two things were wrong with it and neither had a reader:

- `description` was 106 characters. The registry rejects over 100; this is the same 422
  that bit `quotes` at v0.7.0 and `server.mcpb.json` descriptions at v0.6.0. Rewritten to
  94 characters: "QR codes and barcodes offline: WiFi, vCards, SEPA payment codes, Code 128,
  EAN-13, SVG or PNG."
- It had no `remotes` block, although `servers/barcode/remotes.json` exists and
  `/mcp/barcode` has been live since the eighteenth-endpoint commit. Merged in.

A length check over all 44 publishable manifests found barcode as the only offender, and
`remotes.json` was compared by value against every `server.mcpb.json`: 18 of 18 equal
after the merge (office-suite has neither, as before).

### 3. Bundles

`scripts/build-mcpb.sh` run with `/opt/homebrew/bin/bash` (the pinned interpreter; `bash
scripts/build-mcpb.sh` gets macOS bash 3.2 and dies on `declare -A`) built 19 bundles,
barcode and office-suite included. office-suite vendors all 18 children.

Every bundle was checked standalone: unzipped outside the monorepo, `server/index.js`
spawned with a clean `HOME`/`XDG_DATA_HOME` and cwd, and `initialize` answered. **19 of 19
returned `serverInfo.version` 0.8.0, each matching its own bundle `manifest.json`.**

### 4. Release and registry

Pushed first, per the v0.6.0 failure: `6ced219..a9625ae main -> main`, then
`gh release create v0.8.0 bundles/*.mcpb`, 19 assets at
https://github.com/theluckystrike/mcp-servers/releases/tag/v0.8.0.

sha256 of each bundle written into every manifest that references it, resolved from the
`identifier` URL rather than the folder name, so the ten new name manifests and the
templates manifest were filled the same way as the mcpb and variant ones: **44 manifests**.
barcode: `e47c09ea98f195d7872c2e6e3d25a5f73cf6585951fb50a8daaeb23bd89de7f0`.

`mcp-publisher login github -token "$(gh auth token)"`, then 19 `server.mcpb.json`, 14
`server.variant.json`, 1 `server.templates.json` and 10 `server.<token>.json` published:
**44 of 44, no 422s**. Verified by fully qualified name (the v0.7.0 failure: the short name
does not find every entry) through
`GET /v0/servers?search=<fully qualified name>&version=latest`: **44 of 44 at 0.8.0**.

### 5. Mirrors, and two rewrites the script was missing

`scripts/sync-mirrors.sh` pushed all 19. `mcp-barcode` is new, and verifying it the way the
script's contract claims (fresh `git clone` of the pushed mirror, then
`npm install && npm run build && npm test` with no access to the monorepo) failed on the
first pass: **exit 1, 42 tests, 34 pass, 8 fail, 0 skipped**. The monorepo suite was green,
so both causes were mirror-specific and both were in the rewriting the script does to test
files.

1. **A signer in a shared helper is invisible to the per-file scan.** Step 5b marks
   pro-tier tests skipped because the signing key never leaves the monorepo, and it
   decides per file by looking for `sign-license`. barcode, image and pdf put the signer
   in `test/_client.mjs` and export it as `proKey()`. The helper matched, so its
   `execFileSync(... sign-license ...)` was replaced with `""` -- but a helper has no
   `test(` blocks to skip, and the files that call `proKey()` never spell `sign-license`,
   so their tests were left to run against an empty key and asserted their way to seven
   failures. The script now collects the exported identifiers of any helper under `test/`
   whose body signs a key, and a test block calling one is skipped like any other
   pro-tier test. On barcode it prints `pro-tier helper exports: proKey`.
2. **`REPO` is three levels up in a monorepo and one in a mirror.** Step 5a2 already
   rewrote `join(here, "..", "..", "..", "node_modules")`, but the same idiom without the
   `node_modules` tail is how these suites reach the monorepo root, and
   `join(REPO, "servers", "barcode", "package.json")` is a real path there and nothing at
   all in a mirror. Added: `join(here, "..", "..", "..")` becomes `join(here, "..")` and
   `join(REPO, "servers", "<name>")` collapses to `REPO`, so the version-agreement test
   reads the mirror's own `package.json` and `src/version.ts`. A residual
   `join(REPO, "scripts", "sync-versions.mjs")` cannot be fixed this way (the monorepo's
   `scripts/` is not part of any server folder), so blocks that run a script from
   `REPO/scripts` are marked skipped with a note, the same treatment the Pro tests get.

All 19 were re-synced with the fixed script and the fresh-clone check re-run on the pushed
`mcp-barcode`: **exit 0, 42 tests, 34 pass, 0 fail, 0 cancelled, 8 skipped** (7 Pro-key,
1 monorepo-script).

### 6. Ledger

`data/distribution.json`: 56 version strings moved to 0.8.0; the `registry` and `mcpb`
surface notes rewritten for the new counts (19 primary + 14 variants + 1 templates + 10
round-4 names = 44; 18 hosted); a `registry-name` row added to the ten servers that took a
round-4 name; and `per_server.barcode` moved off "pending" to published on registry, mcpb
and github-mirror at 0.8.0.

## artifacts

- /Users/mike/mcp-servers/servers/barcode/server.mcpb.json
- /Users/mike/mcp-servers/bundles/*.mcpb (19)
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/RELEASE_V080.md
- https://github.com/theluckystrike/mcp-servers/releases/tag/v0.8.0
- 19 mirror repos https://github.com/theluckystrike/mcp-<name>

## cost

Under 55 wall minutes. Zero paid API calls, zero paid submissions.

## failures

1. The publish loop's first form, `for f in $FILES`, passed all 44 paths as one argument
   and failed with `file name too long`. The shell here is zsh, which does not word-split
   an unquoted parameter expansion the way bash does. Nothing was published on that pass;
   re-run with an array, 44 of 44 succeeded.
2. A first verification pass, sequential with three 25-second retries per name, ran past a
   ten-minute tool timeout without finishing. Re-run in batches of eight concurrently:
   44 of 44 at 0.8.0.
3. The first `mcp-barcode` mirror push failed its own fresh-clone contract, 8 of 42 tests
   failing, for the two rewriting gaps in section 5. Fixed in `scripts/sync-mirrors.sh`
   and all 19 mirrors re-synced. The mirror had been pushed before it was verified; the
   check has to run on the pushed clone, which is what caught it.

## insight

The recurring shape in this repo is a writer with no reader. v0.7.0 found three (a version
literal, a hand-maintained child list, a description length); v0.8.0 found two more in the
same file, both in `servers/barcode/server.mcpb.json`, and both introduced by a commit that
added a server without publishing it. A manifest that is written at server-creation time
and first read at release time has a whole development round to drift in, and the two
checks that catch it, `description.length <= 100` and `remotes == remotes.json`, are one
line each. They ran over all 44 manifests here in a second and found exactly one offender;
the cost of running them every release is nil and the cost of not running them is a 422 in
the middle of a publish loop.
