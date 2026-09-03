# MIRRORS_RESULT.md -- one public repo per server, 2026-09-02

status: DONE

## Why

GitHub repository search ranks repository NAME matches, and Glama and Smithery key on one
repository URL per server. All six servers live in subfolders of a single repo named
`mcp-servers`, so a search for "mcp time tracker" cannot surface them and a directory that
wants one repo per server has nothing to point at. Six mirrors fix the name axis without
splitting development: the monorepo stays the only place anyone commits.

## Repos

| server | mirror | description (tagline from data/facts.json) | homepage |
|---|---|---|---|
| time-tracker | https://github.com/theluckystrike/mcp-time-tracker | Track billable time without leaving the chat. | https://mcp.zovo.one/s/time-tracker |
| price-tracker | https://github.com/theluckystrike/mcp-price-tracker | Check and watch product prices on ordinary shop pages. | https://mcp.zovo.one/s/price-tracker |
| spreadsheet | https://github.com/theluckystrike/mcp-spreadsheet | Read, query, edit and convert xlsx and csv files safely. | https://mcp.zovo.one/s/spreadsheet |
| invoice | https://github.com/theluckystrike/mcp-invoice | Numbered invoices with tax lines, rendered to a professional PDF. | https://mcp.zovo.one/s/invoice |
| expense-tracker | https://github.com/theluckystrike/mcp-expense-tracker | Receipts, mileage and expenses that turn into invoice lines. | https://mcp.zovo.one/s/expense-tracker |
| office-suite | https://github.com/theluckystrike/mcp-office-suite | One install that exposes every tool of the five servers. | https://mcp.zovo.one/s/office-suite |

Each mirror carries the server folder at root (src, test, README.md, LICENSE, server.json,
smithery.yaml, glama.json, llms-install.md, Dockerfile, package.json), a MIRROR.md naming
the monorepo path as the source of truth and sending issues and PRs there, and a
`vendor/` directory holding the unpublished dependencies.

README top block, above the existing prose: demo GIF by absolute raw URL into the
monorepo, the `.mcpb` one-click link to the monorepo latest release, the hosted endpoint
line, and a one-line mirror notice. expense-tracker and office-suite have no demo GIF in
assets/; expense-tracker falls back to its 400x400 logo, office-suite has no image.

## Build self-containment

`@theluckystrike/mcp-license` is not on npm, so `npm install` in a mirror would fail on a
registry 404. The mirror vendors the built package into `vendor/mcp-license/` (dist +
package.json with scripts and devDependencies stripped) and rewrites the dependency to
`file:vendor/mcp-license`. office-suite additionally vendors the five servers it proxies
(their own license dependency rewritten to `file:../mcp-license`), which also satisfies
its runtime `require.resolve` fallback for child servers. A prepare script fetching the
package was rejected: it needs network at install time and a hosting URL that does not
exist. The vendor copy is the simplest thing that makes a fresh clone build.

Two mirror-only test patches, applied by the sync script, not by hand:

1. Pro-tier tests sign a key with `keys/license-private.pem`, which must never reach a
   public repo. Only the test blocks that use the signer are rewritten to `test.skip(`
   (price-tracker's concurrency file signs at module scope, so that whole file is
   skipped). Free-tier coverage runs in full.
2. office-suite's proxy fixture symlinks `../../../node_modules/@modelcontextprotocol`
   relative to `test/`. In a mirror the package root is the repo root, so the path is one
   level up. Without this the copied suite could not resolve the SDK and two of three
   tests were cancelled by timeout rather than failed.

## evidence

`scripts/sync-mirrors.sh` (all six, second run for time-tracker to prove idempotency):

```
=== mcp-time-tracker    pushed https://github.com/theluckystrike/mcp-time-tracker
=== mcp-price-tracker   pushed https://github.com/theluckystrike/mcp-price-tracker
=== mcp-spreadsheet     pushed https://github.com/theluckystrike/mcp-spreadsheet
=== mcp-invoice         pushed https://github.com/theluckystrike/mcp-invoice
=== mcp-expense-tracker pushed https://github.com/theluckystrike/mcp-expense-tracker
=== mcp-office-suite    pushed https://github.com/theluckystrike/mcp-office-suite
```

`gh api repos/theluckystrike/mcp-<name>`:

```
theluckystrike/mcp-time-tracker | branch=main | private=false | homepage=https://mcp.zovo.one/s/time-tracker | desc=Track billable time without leaving the chat. | topics=claude,cursor,freelance,mcp,mcp-server,model-context-protocol,time-tracking,timesheet
theluckystrike/mcp-price-tracker | branch=main | private=false | homepage=https://mcp.zovo.one/s/price-tracker | desc=Check and watch product prices on ordinary shop pages. | topics=claude,cursor,mcp,mcp-server,model-context-protocol,price-drop,price-tracking,shopping
theluckystrike/mcp-spreadsheet | branch=main | private=false | homepage=https://mcp.zovo.one/s/spreadsheet | desc=Read, query, edit and convert xlsx and csv files safely. | topics=claude,csv,cursor,mcp,mcp-server,model-context-protocol,spreadsheet,xlsx
theluckystrike/mcp-invoice | branch=main | private=false | homepage=https://mcp.zovo.one/s/invoice | desc=Numbered invoices with tax lines, rendered to a professional PDF. | topics=claude,cursor,invoice,mcp,mcp-server,model-context-protocol,pdf,vat
theluckystrike/mcp-expense-tracker | branch=main | private=false | homepage=https://mcp.zovo.one/s/expense-tracker | desc=Receipts, mileage and expenses that turn into invoice lines. | topics=claude,cursor,expenses,mcp,mcp-server,mileage,model-context-protocol,receipts
theluckystrike/mcp-office-suite | branch=main | private=false | homepage=https://mcp.zovo.one/s/office-suite | desc=One install that exposes every tool of the five servers. | topics=bundle,claude,cursor,mcp,mcp-server,model-context-protocol,office,productivity
```

Idempotency, after the second run of time-tracker
(`gh api repos/theluckystrike/mcp-time-tracker/commits --jq 'length, .[0].commit.message'`):

```
1
sync from monorepo 999f580a43f482bcb019a40e8fc323d774efcd82
```

Fresh-clone build test, `git clone && npm install && npm run build && npm test` in an
empty directory with no monorepo on the path (three mirrors, two required):

```
#### mcp-time-tracker      added 98 packages   # tests 7  # pass 5  # fail 0  # skipped 2
#### mcp-office-suite      added 172 packages  # tests 3  # pass 3  # fail 0  # skipped 0
#### mcp-invoice           added 160 packages  # tests 18 # pass 17 # fail 0  # skipped 1
```

Local pre-push run of the same commands over all six mirror trees (DRY_RUN=1): 0 failures;
skipped counts time-tracker 2, price-tracker 3, spreadsheet 1, invoice 1,
expense-tracker 1, office-suite 0 -- all of them the Pro-key tests.

## artifacts

- scripts/sync-mirrors.sh
- docs/MIRRORS_RESULT.md
- data/distribution.json (surface `github-mirrors`)
- six repos listed above

## cost

31 wall minutes. Zero paid API calls.

## failures

- First fresh-clone test failed 2 of 7: tests shell out to `../../../scripts/sign-license.mjs`,
  which does not exist outside the monorepo. Fixed by skipping only the Pro-key test blocks.
- First pass skipped all 13 price-tracker smoke tests: the file assigns the signer path to
  a `const signer` at module scope, and the naive "does this file mention sign-license"
  check caught the whole file. Fixed by tracking signer variables and testing per block.
- office-suite reported 1 pass, 0 fail, 2 cancelled in the mirror. Not a test failure:
  the proxy fixture's SDK symlink pointed outside the mirror, the copied suite hung, and
  node:test reported the parent as cancelled. A green `# fail 0` line is not proof; the
  `# pass` count has to match `# tests`.
- The README header duplicated the demo GIF, because the monorepo README already embeds
  the same image lower down. The sync now removes the second copy.

## insight

`# fail 0` from node:test can hide two dead tests. When the child process cannot resolve
its dependencies it never answers, the parent's promise stays pending, and the runner
files the subtests under `cancelled`, not `fail` -- a summary line that reads green. Gate
on `pass == tests`, not on `fail == 0`.

## S2: three new mirrors, recursive vendoring

`vendor_pkg` no longer takes a rewrite-string argument: it always rewrites a vendored
package's own `@theluckystrike/*` deps to `file:../<pkg>` (a no-op for packages, like
mcp-license, that have none). A new `vendor_closure` walks a package's `dependencies`
recursively and vendors every `@theluckystrike/*` package it finds, skipping one already
vendored in this mirror build (so mcp-license, reachable from every path, is copied once).
`pkg_src_dir` resolves a bare package name to `packages/<name>` if it exists there, else
`servers/<name minus the mcp- prefix>`. Per-server mirrors now vendor whatever their own
`package.json` lists; office-suite vendors its ten proxied servers (adding resume,
recurring, clauses to the existing seven) through the same function -- each of those in
turn pulls in its own deps (e.g. resume -> mcp-docx -> mcp-license) automatically.

`ALL_SERVERS` and `topics_for` gained resume (`resume cover-letter job-application`),
recurring (`recurring-billing subscription forecast`) and clauses (`contract clause
proposal`).

### Two more monorepo-path defects found and fixed during verification

- `servers/recurring/test/smoke.test.mjs` spawns the sibling invoice server as a second
  process via a hardcoded `"../../invoice/dist/index.js"` monorepo-sibling path, to check
  the invoice server's own process sees what recurring wrote. That path does not exist in
  a mirror. New step 5a3 rewrites it to `vendor/mcp-invoice/dist/index.js`.
- The step 5a2 fix (monorepo `node_modules` symlink three levels up from `test/`, valid in
  the monorepo, one level too many in a mirror) was previously applied only to
  `proxy.test.mjs` by name. `servers/office-suite/test/round7.test.mjs` has the identical
  pattern and was still breaking (2 subtests `cancelledByParent`, the same "pass count
  does not match tests count" failure mode documented below from the first pass). 5a2 now
  loops over every `test/*.mjs` file and applies the same replacement, which is a no-op on
  files that do not contain the pattern.

### Fresh-clone verification (`git clone && npm install && npm run build && npm test`,
three new mirrors plus office-suite, empty `/private/tmp` directories, no monorepo on the
path):

```
mcp-resume        added 120 packages   # tests 32  # pass 28  # fail 0  # cancelled 0  # skipped 4
mcp-recurring     added 160 packages   # tests 32  # pass 29  # fail 0  # cancelled 0  # skipped 3
mcp-clauses       added 120 packages   # tests 31  # pass 24  # fail 0  # cancelled 0  # skipped 7
mcp-office-suite  (fresh clone)        # tests 5   # pass 5   # fail 0  # cancelled 0  # skipped 0
```

`pass == tests - skipped` on all four (the gate this doc's earlier insight calls for, not
just `fail == 0`). Skipped counts are exactly the Pro-key tests. All three new repos are
one-commit ("sync from monorepo 98fb85fa7140dd4b8087f4a03fd482dd9bca94b6"), confirming the
push is still idempotent. All eleven mirrors were re-pushed in the same run (`bash
scripts/sync-mirrors.sh` with no arguments); none of the eight pre-existing mirrors
regressed.

### repos

- https://github.com/theluckystrike/mcp-resume
- https://github.com/theluckystrike/mcp-recurring
- https://github.com/theluckystrike/mcp-clauses
