# Release v0.6.0

status: DONE

## evidence

### 1. Version bump

`scripts`-free node pass over every manifest: 59 files changed to 0.6.0 (16 servers +
office-suite `package.json`, `packages/mcp-license/package.json`, and every `server.json`,
`server.mcpb.json`, `server.variant.json`). Every internal `@theluckystrike/*` range rewritten to
`^0.6.0`, including office-suite's twelve child ranges, `mcp-license` -> `mcp-timezone`,
bank-statement -> `mcp-spreadsheet`, calendar -> `mcp-timezone`, clauses/resume -> `mcp-docx`,
recurring -> `mcp-invoice`.

```
npm install      changed 1 package, audited 289 packages
npm run build -ws  18 workspaces, tsc clean
npm test         tests=686 pass=676 fail=0 skipped=10
```

The 10 skipped are the Pro-key tests that need a signing key.

### 2. Bundles

`/opt/homebrew/bin/bash scripts/build-mcpb.sh` exit 0. 17 bundles built (16 servers +
office-suite), `Manifest schema validation passes!` 17 times, every `manifest.json` at 0.6.0.

Standalone check: each `.mcpb` unzipped into `/private/tmp/sacheck/<name>` and its manifest entry
point spawned with cwd `/private/tmp` (outside the monorepo, so no hoisted `node_modules` can be
reached), driven through `initialize` + `tools/list` over stdio JSON-RPC. 17/17 answered:

```
bank-statement 12 tools   calendar 12   clauses 12   currency 10   docx 11
expense-tracker 14        image 12      invoice 12   kanban 16
office-suite 162          pdf 12        price-tracker 10   recurring 14
resume 10                 spreadsheet 10   time-tracker 14   timezone 11
```

GitHub release: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.6.0, 17 assets.
`gh release create` tags at the remote default-branch head, which was the pre-bump commit, so the
tag was force-moved to the bump commit `3b5cec9` after pushing.

sha256 of each bundle written into its `server.mcpb.json` `fileSha256` with the
`v0.6.0` asset URL as the identifier, and into the matching `server.variant.json`.
Verified against the uploaded asset by download: `kanban.mcpb` ->
`2777e812f3f0e9bacd5c73e19352e8d1bbf207528dec7c55669d8c73e23e0063`, identical to the local file.

`servers/<x>/remotes.json` merged into the `remotes` block of each `server.mcpb.json`: 16 of 17
(office-suite has none). bank-statement's hosted endpoint was checked before including it: a bare
`curl -s -X POST https://mcp.zovo.one/mcp/bank-statement` returns the same JSON auth error as the
known-live `/mcp/invoice`, so that is not sufficient evidence; a signed Pro key
(`node scripts/sign-license.mjs '*'`) was used instead and the endpoint answered a real JSON-RPC
result, `serverInfo {"name":"mcp-bank-statement","version":"0.6.0"}`. bank-statement remotes are
therefore included.

Variants carry no `remotes` block: the registry rejects a second name reusing a parent's remote URL.

### 3. Registry

`mcp-publisher login github -token "$(gh auth token)"` -> Successfully logged in. One login covered
the whole run, no JWT expiry.

17 `server.mcpb.json` published, then 13 `server.variant.json`. Two 422s on the first pass:
`bank-statement` (description 125 chars) and `kanban` (139), both over the registry's 100-char
`body.description` limit. Descriptions shortened to 99 and 98 chars in `server.json` and
`server.mcpb.json` and both republished green. `package.json` descriptions were left alone so the
already-uploaded bundles stay byte-identical to their recorded sha256.

Verified through `GET /v0/servers?search=<name>&version=latest`, matching on exact name:
**30 of 30 entries report 0.6.0**.

| entry | registry name | version |
| --- | --- | --- |
| bank-statement | bank-statement-csv-categorize-reconcile-ledger | 0.6.0 |
| calendar | calendar-ics-reader-events-freebusy-conflicts | 0.6.0 |
| clauses | contract-clause-library-proposal-template-docx | 0.6.0 |
| currency | currency-converter-ecb-rates-daily-keyless | 0.6.0 |
| docx | docx-document-generator-proposal-contract-markdown | 0.6.0 |
| expense-tracker | expense-tracker-receipts-mileage | 0.6.0 |
| image | image-resize-convert-compress-watermark | 0.6.0 |
| invoice | invoice-pdf-billing-generator | 0.6.0 |
| kanban | kanban-todo-tasks-projects-board | 0.6.0 |
| office-suite | office-suite-time-invoice-expense-excel-price | 0.6.0 |
| pdf | pdf-merge-split-stamp-extract-pages | 0.6.0 |
| price-tracker | price-tracker-drop-alert-watch | 0.6.0 |
| recurring | recurring-invoice-scheduler-subscription-billing-due-reminders | 0.6.0 |
| resume | resume-cover-letter-docx-generator | 0.6.0 |
| spreadsheet | excel-spreadsheet-xlsx-csv | 0.6.0 |
| time-tracker | time-tracker-timesheet-billable-hours | 0.6.0 |
| timezone | timezone-world-clock-meeting-slots-overlap-ics | 0.6.0 |
| variant: calendar | availability | 0.6.0 |
| variant: clauses | agreement | 0.6.0 |
| variant: currency | exchange-fx | 0.6.0 |
| variant: docx | documents | 0.6.0 |
| variant: expense-tracker | expenses | 0.6.0 |
| variant: invoice | invoices-invoicing | 0.6.0 |
| variant: pdf | pdfs | 0.6.0 |
| variant: price-tracker | prices-deal | 0.6.0 |
| variant: recurring | retainer | 0.6.0 |
| variant: resume | application | 0.6.0 |
| variant: spreadsheet | sheets | 0.6.0 |
| variant: time-tracker | timer-tracking | 0.6.0 |
| variant: timezone | calendar | 0.6.0 |

### 4. Mirrors

`scripts/sync-mirrors.sh` exit 0, 17 repos pushed (`theluckystrike/mcp-<name>`), siblings vendored
into `vendor/` with `file:` ranges.

Spot-check, fresh clone of the newest and most dependency-heavy mirror:

```
git clone https://github.com/theluckystrike/mcp-bank-statement /private/tmp/mirrorcheck
version=0.6.0
deps: @theluckystrike/mcp-license file:vendor/mcp-license
      @theluckystrike/mcp-spreadsheet file:vendor/mcp-spreadsheet
npm install   added 109 packages in 5s
npm run build tsc clean
npm test      tests 39, pass 30, fail 0, skipped 9
```

### 5. Ledger

`data/distribution.json`: every `per_server` entry now carries `registry` (with the published
registry name and 0.6.0), `mcpb`, `github-mirror`, `hosted`, and `registry-variant` for the 13
servers that have one. `surfaces.registry`, `surfaces.mcpb`, `surfaces.github-mirrors` and
`surfaces.hosted` notes rewritten to the v0.6.0 counts.

## artifacts

- https://github.com/theluckystrike/mcp-servers/releases/tag/v0.6.0 (17 .mcpb assets)
- /Users/mike/mcp-servers/servers/*/package.json, server.json, server.mcpb.json, server.variant.json
- /Users/mike/mcp-servers/packages/mcp-license/package.json
- /Users/mike/mcp-servers/bundles/*.mcpb
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/RELEASE_V060.md
- 17 mirror repos https://github.com/theluckystrike/mcp-<name>

## cost

52 wall minutes. Zero paid API calls.

## failures

1. `gh release create v0.6.0` tagged the remote default-branch head, which was still the pre-bump
   commit, because the version bump had been committed locally and not pushed. Fixed by pushing the
   bump, then `git tag -f v0.6.0 HEAD` and `git push -f origin refs/tags/v0.6.0`. Bundle assets were
   unaffected (they are uploaded files, not tree content). Ordering rule: push before
   `gh release create`.
2. Two registry 422s on the 100-char description limit (bank-statement 125, kanban 139). Both new
   servers this release; the limit is not enforced anywhere in the build, only by the registry.
   Fixed by shortening and republishing.
3. `GET https://mcp.zovo.one/mcp/token` returned `rate_limited` (10 anonymous tokens per hour per
   address, already spent by the concurrent hosting agent). Worked around with a locally signed Pro
   key, which is what `scripts/validate.mjs` already does.

## insight

The `serverInfo.version` a server reports over the protocol is a string literal in its
`src/index.ts`, not read from `package.json`, so it is not touched by a version bump. Measured on
the standalone boot of all 17 bundles at v0.6.0: only the three servers written this release report
0.6.0. invoice, spreadsheet, time-tracker and price-tracker still announce 0.1.0, expense-tracker
0.2.0, currency/docx/timezone 0.3.0, clauses/recurring/resume 0.4.0, calendar/pdf 0.5.0, and
office-suite 0.1.0. Every outward-facing surface (bundle manifest, registry entry, npm-style
package.json, mirror) says 0.6.0, so an MCP client that trusts the handshake sees a version up to
five releases stale while every catalogue says otherwise. Not fixed here: the strings live in
`servers/*/src`, and `remote/build-vendor.mjs` patches those files by exact string match, so a
sweep would break the hosted worker build that another agent is holding open.
