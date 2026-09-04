# Release v0.9.0

status: DONE

The first release that ships `servers/zip`, and the first with 20 bundles, 20 mirrors and
46 registry entries. The new work in it is the zip server plus the round 13 user-value
fixes to barcode and time-tracker; the rest is version bookkeeping, and this time the
bookkeeping found nothing wrong, because the two checks v0.8.0 added ran clean.

## evidence

### 1. Versions

19 servers plus `servers/office-suite` and `packages/mcp-license` bumped to 0.9.0 (21
package.json files), and 38 internal `@theluckystrike/*` ranges rewritten to `^0.9.0`.

`ls servers/*/server*.json` is 69 files; 65 were bumped: 20 `server.json`,
20 `server.mcpb.json`, 14 `server.variant.json`, `servers/docx/server.templates.json` and
the 10 round-4 name manifests (`server.<token>.json`: pivot, thumbnails, terms, cashflow,
sow, scheduling, subscriptions, freelance, career, standup). 45 of them carry an mcpb
`identifier` URL, each moved from `/download/v0.8.0/` to `/download/v0.9.0/`.

The 4 files left untouched are
`servers/{invoice,price-tracker,spreadsheet,time-tracker}/server.npm-package.json`, npm
registry fragments pinned at 0.1.0. No `@theluckystrike` package is on npm, so bumping
them would assert a release that does not exist. They were left alone at v0.6.1, v0.7.0
and v0.8.0 for the same reason.

```
npm install    ok
npm run build  20 workspaces, tsc clean (prebuild ran scripts/sync-versions.mjs)
npm test       exit 0; tests 868, pass 857, fail 0, cancelled 0, skipped 11
```

Zero cancelled, checked as its own field, and the exit code was 0. `fail 0` alone does not
mean green: a cancelled run also reports `fail 0`.

### 2. The zip variant name

`servers/zip` shipped with one registry name,
`io.github.theluckystrike/zip-archive-create-extract-bomb-guard`. A second name is only
worth publishing when it is a word a person would actually search, not a synonym invented
to fill a slot. `archive` is that word, so `servers/zip/server.variant.json` was written:
name `io.github.theluckystrike/archive`, stdio-only mcpb package (no `remotes`, matching
every other variant), description 91 characters.

The two v0.8.0 checks were re-run over all 46 publishable manifests before publishing:

- `description.length <= 100`: 0 offenders (zip's mcpb description is 94, the new variant
  91). This is the check that caught barcode at v0.8.0 and quotes at v0.7.0.
- `remotes == remotes.json` by value: 19 of 19 equal, zip included, which is where the
  merge the release asked for would have shown up had it been missing. office-suite has
  neither, as before.

### 3. Bundles

`scripts/build-mcpb.sh` run with `/opt/homebrew/bin/bash` (the pinned interpreter; plain
`bash scripts/build-mcpb.sh` gets macOS bash 3.2 and dies on `declare -A`) built 20
bundles. `zip.mcpb` is new at 3.4 MB; office-suite vendors all 19 children and is 27 MB.

Every bundle was checked standalone: unzipped outside the monorepo, `server/index.js`
spawned with a clean `HOME`/`XDG_DATA_HOME`/`TMPDIR` and cwd, `initialize` sent over
stdio. **20 of 20 returned `serverInfo.version` 0.9.0, each matching its own bundle
`manifest.json`.**

### 4. Release and registry

Pushed first, per the v0.6.0 failure: `bf53060..889f1a3 main -> main`, then
`gh release create v0.9.0 bundles/*.mcpb`, 20 assets at
https://github.com/theluckystrike/mcp-servers/releases/tag/v0.9.0.

sha256 of each bundle written into every manifest that references one, resolved from the
`identifier` URL rather than the folder name, so the name manifests and the templates
manifest were filled the same way as the mcpb and variant ones: **46 manifests**.
zip: `29f1d360add9154f65d8d68e053b7129dae7ace8ad92a9226ddf8f7d20b4bfe5`.

`mcp-publisher login github -token "$(gh auth token)"`, then 20 `server.mcpb.json`, 15
`server.variant.json`, 1 `server.templates.json` and 10 `server.<token>.json` published
from a bash array (never `for f in $FILES`; zsh does not word-split an unquoted parameter
expansion, and the v0.8.0 run failed with `file name too long` for it): **46 of 46, no
422s**. Verified by fully qualified name through
`GET /v0/servers?search=<fully qualified name>&version=latest`, in batches of eight
concurrently: **46 of 46 at 0.9.0**.

### 5. Mirrors

`scripts/sync-mirrors.sh` pushed all 20. `mcp-zip` is new, and was verified the way the
script's contract claims: fresh `git clone` of the pushed mirror, then
`npm install && npm run build && npm test` with no access to the monorepo.
**exit 0, 43 tests, 38 pass, 0 fail, 0 cancelled, 5 skipped** (Pro-key tests, whose signing
key never leaves the monorepo). The v0.8.0 fixes carried it: the script printed
`pro-tier helper exports: proKey` for zip, so the signer inside `test/_client.mjs` was seen
and the tests that call it were skipped rather than left to run against an empty key.

### 6. Ledger

`data/distribution.json`: 68 version strings moved to 0.9.0; the `registry` and `mcpb`
surface notes rewritten for the new counts (20 primary + 15 variants + 1 templates + 10
round-4 names = 46; 19 hosted); and `per_server.zip` moved off "pending" to published on
registry, registry-name, mcpb and github-mirror at 0.9.0.

## artifacts

- /Users/mike/mcp-servers/servers/zip/server.variant.json
- /Users/mike/mcp-servers/bundles/*.mcpb (20)
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/RELEASE_V090.md
- https://github.com/theluckystrike/mcp-servers/releases/tag/v0.9.0
- 20 mirror repos https://github.com/theluckystrike/mcp-<name>

## cost

Under 60 wall minutes. Zero paid API calls, zero paid submissions.

## failures

1. `git pull --rebase` refused to run: "cannot pull with rebase: You have unstaged
   changes." The rebuilt `bundles/**` are deliberately left unstaged, so the pull has to
   come after the source commit, not before it. Resolved by committing first and checking
   `git rev-list --count HEAD..origin/main` (0) instead.
2. The first registry verification pass reported 8 of 46 names MISSING. All 8 were
   published seconds earlier and all 8 returned 0.9.0 on a retry after a short wait: the
   search index is eventually consistent, and a name that has just been published can be
   absent from `?search=` for tens of seconds. A verification that does not retry
   misreports a successful publish as a failure. The batch loop retries three times per
   name; that was not enough for the newest entries, and one (`documents`) needed a fourth
   attempt after the batch finished.

## insight

v0.7.0 and v0.8.0 both found a writer with no reader, and both added a one-line check for
it. This release is the first where those checks found nothing: description lengths and
`remotes` were correct in all 46 manifests on the first pass, including the two zip
manifests written between releases, which is exactly the window where barcode drifted.
The checks cost a second to run and they are now the reason the publish loop is boring.

The one thing that still is not checked is the reverse direction: nothing asserts that a
server which has a `remotes.json` also has a variant name, or that a new server was given
its second registry name at all. `zip` shipped at v0.8.0 with one name and got its second
only because this release went looking. That is a reader gap of the same shape, one release
later, and it is worth a check of its own.
