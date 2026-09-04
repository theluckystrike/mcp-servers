# Round 7: bank-statement demo GIF, Docker MCP catalog + Cline marketplace

status: DONE

evidence:

## A. Demo GIF (mcp-bank-statement)

- `scripts/demo/drive.mjs`: added a `bank-statement`-only env block that generates a real Pro key at run
  time via `execFileSync(process.execPath, [scripts/sign-license.mjs, "bank-statement"])` and passes it
  as `MCP_LICENSE_KEY`, so the recorded session genuinely unlocks `recurring_detect` (a Pro-gated tool)
  rather than showing the upgrade message. New `bank-statement` sequence: writes an 8-row Revolut-shaped
  CSV fixture to the sandbox (header `Type,Product,Started Date,Completed Date,Description,Amount,Fee,
  Currency,State,Balance`, matching the server's own test fixture for the Revolut bank profile), three of
  the eight rows a EUR 9.99 "Spotify" charge 30 days apart (2026-07-04, 2026-08-03, 2026-09-02) so
  `recurring_detect` sees three occurrences of a monthly cadence, the other five a salary top-up,
  groceries, rent, a restaurant charge and an ATM withdrawal.

  Mid-task correction: `servers/bank-statement/src/index.ts` gained a `cadence_confirmed` guard while
  this task was running (an audit/hardening agent editing the same server concurrently) that withholds
  the annualised figure until a third charge confirms the interval, to stop two charges 14 days apart
  being over-read as a EUR 1,599/year subscription. The fixture was originally written with only two
  Spotify occurrences (matching the two-row instruction literally); after the guard landed, `npm run
  build` was re-run and the fixture was extended to three occurrences so the recorded demo shows the
  confirmed, non-withheld `recurring_detect` result rather than a `cadence_confirmed: false` / null
  annualised line. Ran `statement_import` (bank auto-detected as Revolut, no `bank` argument passed),
  `category_rules` (Spotify -> software, Rent -> rent), `statement_summary` (category totals,
  2026-07-01..2026-09-03), `recurring_detect` (`months: 12` so the window is stable regardless of the
  actual run date) -- comes back with Spotify, 3 occurrences, cadence monthly, `cadence_confirmed: true`,
  annualised EUR 119.88.

- Tape: `scripts/demo/bank-statement.tape`, identical settings to the existing thirteen (900x480,
  Dracula, 40ms typing, `Sleep 10s`). `vhs scripts/demo/bank-statement.tape` from repo root.

  Output size (limit 400 KB): `assets/demo-bank-statement.gif` 280,430 bytes (273.9 KB).

  Verification:
  ```
  $ file assets/demo-bank-statement.gif
  assets/demo-bank-statement.gif: GIF image data, version 89a, 900 x 480
  $ ffprobe -v error -select_streams v -show_entries stream=width,height,nb_frames,avg_frame_rate \
      -of default=noprint_wrappers=1 assets/demo-bank-statement.gif
  width=900 height=480 avg_frame_rate=25/1 nb_frames=274
  ```
  A valid 900x480 GIF at 25 fps, about 11s, matching the existing thirteen demos.

- README updates: `servers/bank-statement/README.md` -- the file was re-read immediately before editing
  (an audit agent was concurrently updating other lines of the same README about the new format-detection
  and `cadence_confirmed`/`statement_export` behavior); only the logo line was touched, replacing
  `<img src="../../assets/bank-statement-logo.png" alt="bank-statement" width="120" />` with
  `![bank-statement demo](../../assets/demo-bank-statement.gif)`. `README.md` (root): added one row
  (mcp-bank-statement) to the demo-thumbnail table, right before the mcp-office-suite bundle row, same
  row format as the other fourteen (link, thumbnail, one-line description, npx install line with the `*`
  footnote marker).

## B. Docker MCP catalog + Cline marketplace (bank-statement)

Docker MCP catalog (docker/mcp-registry PR #4892, fork theluckystrike/mcp-registry branch
add-theluckystrike-mcp-servers, clone reused at /private/tmp/docker-mcp-registry).
- `git -c rebase.autoStash=true pull --rebase` on the fork clone first: already up to date (branch
  unchanged since round 6's push).
- Read `servers/bank-statement/Dockerfile` in theluckystrike/mcp-servers first: it builds from the repo
  root as context, copying `packages/mcp-license` and `servers/spreadsheet` (a sibling-workspace
  dependency, `@theluckystrike/mcp-spreadsheet` imported at runtime as `.../lib`) in addition to its own
  package, same multi-stage shape recurring's Dockerfile uses for its dependency on invoice. No
  `directory` key needed in server.yaml -- that key is used elsewhere in this catalog for a different
  repo layout (a subfolder-per-server monorepo path), not for a workspace-sibling dependency, confirmed
  by reading `servers/recurring/server.yaml` (no `directory` key despite depending on
  `@theluckystrike/mcp-invoice`).
- Added `servers/bank-statement/{server.yaml,tools.json}`: category finance, `dockerfile:
  servers/bank-statement/Dockerfile`, `MCP_LICENSE_KEY` optional secret same as all fifteen prior
  entries, commit and icon URL both pinned to `5478b42fa9c8432cd34ff61ae559723f909e112b` (origin/main
  HEAD of theluckystrike/mcp-servers at task start). One fix needed: the unquoted `about.description`
  contained `: ` (colon-space) inside a sentence ("adds nothing: every line..."), which YAML parses as an
  unintended mapping and broke `cmd/validate` with "mapping values are not allowed in this context" --
  fixed by quoting the description, same failure mode this catalog's own YAML would hit on any
  colon-in-prose description.
- Took the same commit as an opportunity to repin all fifteen existing entries (time-tracker,
  price-tracker, spreadsheet, invoice, expense-tracker, currency, timezone, docx, resume, recurring,
  clauses, pdf, calendar, kanban, image) from `806454f16a32918efc20a22e06af04d180e5c14e` to the same new
  HEAD, per the instruction to keep all sixteen on one commit.
- `tools.json` generated from a live `tools/list` call over stdio JSON-RPC against
  `servers/bank-statement/dist/index.js` (the same small Node driver script used in rounds 5/6, converting
  `inputSchema.properties` into the `{name, type, desc}` argument shape used by the existing files):
  bank-statement 12 tools (`statement_import`, `transactions_list`, `transactions_search`,
  `category_rules`, `transaction_categorize`, `statement_summary`, `reconcile_expenses`,
  `recurring_detect`, `statement_export`, `accounts_list`, `license_status`, `license_activate`).
- `go run ./cmd/validate -name <n>` for all 16 (bank-statement, time-tracker, price-tracker, spreadsheet,
  invoice, expense-tracker, currency, timezone, docx, resume, recurring, clauses, pdf, calendar, kanban,
  image): 16/16 green each (Name, Directory, Title, YAML formatting, Commit is pinned, Secrets, Config
  env, License, Icon, Remote skipped, OAuth dynamic). `npm_config_cache` exported to
  `/private/tmp/npmcache` for the validate calls per the round-5/6 fix.
- Committed and pushed to the fork branch: commit `9f85c99` "Add bank-statement server; pin all 16 to
  latest commit". Pushed to `fork` (`theluckystrike/mcp-registry`), `82a76f8..9f85c99
  add-theluckystrike-mcp-servers -> add-theluckystrike-mcp-servers`. PR #4892 updates automatically from
  the branch (still one PR, now sixteen servers).

Cline marketplace (cline/mcp-marketplace), same issue template as the fifteen prior submissions.
- Issue created: https://github.com/cline/mcp-marketplace/issues/2424 (bank-statement)
- Repo URL https://github.com/theluckystrike/mcp-servers/tree/main/servers/bank-statement, logo
  https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/assets/bank-statement-logo.png,
  llms-install.md referenced (confirmed present in the repo before writing the issue). Same honest-
  checkbox pattern as the prior fifteen: "Cline installed it from the README" left unchecked because the
  npm package is not published, "server is stable" checked. Free-tier limits quoted verbatim from the
  README's Free vs Pro table.

Status check, PR #4892 read via `gh pr view --json state,mergeable`: state OPEN, mergeable MERGEABLE.
No verbatim maintainer request found on either the Docker PR or any of the sixteen Cline issues to date
(not re-checked individually this round beyond the PR; see round 6's `DIST_R6_RESULT.md` for the full
per-issue status table as of round 6).

data/distribution.json: added `per_server.bank-statement` (`github: "published"`, `registry: "pending
(v0.6.0)"` matching the `0.6.0` in package.json, `docker-mcp-catalog: "submitted"`,
`cline-marketplace: "submitted"`), matching the four surfaces specified in scope. Appended a note to
`surfaces.docker-mcp-catalog.note` and `surfaces.cline-marketplace.note` with this round's PR/issue
references, the sixteen-way repin commit, and the YAML-quoting fix. `updated_at` bumped.

Paid surfaces: none encountered.

artifacts:
- scripts/demo/drive.mjs (extended)
- scripts/demo/bank-statement.tape (new)
- assets/demo-bank-statement.gif (new)
- servers/bank-statement/README.md, README.md
- docs/DEMO_RESULT.md
- /private/tmp/docker-mcp-registry servers/bank-statement/{server.yaml,tools.json} (new),
  servers/{time-tracker,price-tracker,spreadsheet,invoice,expense-tracker,currency,timezone,docx,resume,
  recurring,clauses,pdf,calendar,kanban,image}/server.yaml (commit repin only), pushed to
  theluckystrike/mcp-registry branch add-theluckystrike-mcp-servers, commit 9f85c99
- Docker PR (updated in place): https://github.com/docker/mcp-registry/pull/4892
- Cline issue: https://github.com/cline/mcp-marketplace/issues/2424 (bank-statement)
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/DIST_R7_RESULT.md (this file)

cost: 25 wall minutes

failures:
- YAML mapping error on the first `cmd/validate` run for bank-statement (unquoted colon-space in
  `about.description`); fixed by quoting the description string.
- Recorded the GIF once before noticing `servers/bank-statement/src/index.ts` had changed underneath
  this task (a concurrent audit agent adding the `cadence_confirmed` guard); rebuilt `dist/`, extended
  the CSV fixture from two to three Spotify occurrences, and re-recorded so the demo shows the confirmed
  (not withheld) recurring-charge result.

insight: the same colon-in-prose YAML trap that broke `cmd/validate` here would break on any future
entry whose `about.description` is written as flowing prose rather than a short tagline; every
`server.yaml` added by this repo across rounds 5-7 should probably be audited for the same risk before
the next round, though none of the other fifteen tripped it (their descriptions happened not to contain
"word: word" mid-sentence).
