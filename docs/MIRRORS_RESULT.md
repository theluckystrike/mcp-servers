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
