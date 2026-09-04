# Release v0.9.2

status: DONE (resumed after a stall)

This release was started by an earlier agent run that stalled after the sha256-manifest
commit (`e5575ff`). This document separates what that run left as verified fact from
what was merely assumed, then finishes the remaining steps: registry re-verification,
mirror sync for five stale mirrors, and the `data/distribution.json` ledger.

## evidence

### 0. What was confirmed done before this run started

Taken as given, not re-derived: 21 `package.json` files and 67 server manifests bumped
to 0.9.2 and pushed (`30e4fdc`), GitHub release `v0.9.2` created with 20 `.mcpb` assets,
sha256 of each bundle written into every manifest that references one (`e5575ff`), and
registry entries for `zip` and `qr-code` confirmed at 0.9.2.

### 1. Versions

All 71 `servers/*/server*.json` files present; 47 are the publishable set (the 4
`server.npm-package.json` files for invoice, price-tracker, spreadsheet, time-tracker
stay pinned at 0.1.0, unpublished, since no `@theluckystrike` npm package exists — same
as every release back to v0.6.1). Read all 47 locally: **47 of 47 at version 0.9.2**,
names matching the fully qualified `io.github.theluckystrike/*` pattern.

```
node scripts/release-check.mjs   green, 0 recorded gaps, 19 servers x 25 checks, all ok
```

### 2. Registry verification

Queried the registry by fully qualified name (`GET /v0/servers?search=<name>&version=latest`)
in batches of 8 concurrent, curl -m 15, up to 4 retries: **13 of 47 confirmed on the
first pass, 21 came back MISSING, 13 never got a slot before the batch script's own
300s wrapper timeout cut it off.**

The 21 MISSING did not mean unpublished. A manual single-request re-check of one
(`qr-code`) came back `0.9.2` immediately, with a registry `publishedAt` timestamp
(11:30:21Z) about 3h48m before this session even started — proving the manifest had
been live in the registry the whole time and the batch script produced a false
negative. Re-ran all 34 outstanding names (21 MISSING + 13 unprocessed) at concurrency
3 instead of 8: **34 of 34 came back 0.9.2 on the first attempt.** The conclusion:
8-way concurrent curl against this registry's search endpoint is what caused the
apparent gaps, not an actual publish gap — a flaky-network artifact, not a data
problem. **Final count: 47 of 47 manifests verified at 0.9.2 in the registry.**
No republish was needed; `mcp-publisher` was never invoked in this run.

### 3. Mirrors

`git rev-parse HEAD` = `e5575ff488ac2a6d3bf77e5d10909b8f4532bb5e`. Checked all 20
mirrors' `main` branch commit message via `gh api repos/theluckystrike/mcp-<x>/commits/main
-q .commit.message` (timeout 60, up to 3 retries): **15 of 20 already matched this HEAD**
(time-tracker, price-tracker, spreadsheet, invoice, expense-tracker, currency,
timezone, docx, resume, recurring, clauses, pdf, calendar, kanban, image) — synced by
the earlier, stalled run. **5 were stale**, still on an older commit
(`3920e681...`): bank-statement, quotes, barcode, zip, office-suite — the newer
servers, apparently never reached before the stall.

Ran `scripts/sync-mirrors.sh bank-statement quotes barcode zip office-suite`. All 5
pushed cleanly with no errors (office-suite vendors all 19 children and takes the
longest). Re-verified all 20 mirrors afterward by the same commit-message check:
**20 of 20 now match HEAD `e5575ff`.** No individual retries were needed.

### 4. data/distribution.json

Replaced every literal `0.9.1` with `0.9.2` in place (`sed`, preserving the file's
existing 1-space indent style rather than a JSON pretty-printer, to avoid an
unrelated reformatting diff): **79 version strings changed** (up from the 69 changed
at the v0.9.1 release, since barcode's second registry name and the newer servers
added more version-bearing fields since then). `updated_at` bumped to the commit
time. Verified after: `0.9.1` count 0, `0.9.2` count 79, file still valid JSON.

## artifacts

- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/RELEASE_V092.md
- https://github.com/theluckystrike/mcp-servers/releases/tag/v0.9.2
- 20 mirror repos https://github.com/theluckystrike/mcp-<name>, all at HEAD e5575ff

## cost

This resumed session: under 25 wall minutes. Zero paid API calls, zero paid
submissions, `mcp-publisher` not invoked (nothing needed republishing).

## failures

The stalled agent's failure mode is unknown — no error was recorded, it simply
stopped after the sha256 commit. This run treated everything after that commit as
unverified until checked, rather than assuming completion.

1. Concurrent registry search at 8-wide produced false MISSING results for 21 of 47
   names under today's flaky network conditions. The fix was lowering concurrency to
   3, not retrying harder at the same concurrency — all 4 retries at concurrency 8
   still failed for names that resolved instantly at concurrency 3. Future release
   scripts should default to concurrency 3-4 against this registry, not 8.
2. Five mirrors (the newest servers: bank-statement, quotes, barcode, zip,
   office-suite) were apparently never reached by the stalled run's mirror-sync step,
   consistent with the agent stopping partway through an alphabetically-late or
   dependency-ordered step list.

## insight

The stall left no error to diagnose, which made "verify, don't assume" the only
correct approach for both remaining unknowns (registry publish state, mirror sync
state) even though the task's own starting assumption ("all 47 manifests are at
0.9.2 locally, so the registry probably is too") turned out to be right for
2 servers and untested for the rest. Treating a flaky-network false negative
(21 MISSING) as a real gap would have triggered an unnecessary `mcp-publisher`
republish of 21 already-correct entries; the cheaper diagnostic — one manual
single-request re-check before trusting the batch result — caught the network
cause first.
