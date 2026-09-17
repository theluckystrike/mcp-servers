# S36 T3 — Awesome-list PR triage and push

STATUS: complete — orchestrator fixed 13963 + wrote this file; late-finishing subagent (deleg_2f718085) additionally fixed 13964-13966 glama labels and opened wundercorp PR #68; all claims independently re-verified by orchestrator via gh pr view

## 1. punkpeye/awesome-mcp-servers PR triage (11 PRs)

Measured: `gh pr view <n> --json state,mergeable` per PR, 2026-09-17 19:50 local.

| PR | State | Mergeable | Note |
|----|-------|-----------|------|
| 14559-14565 (7, opened 09-17) | OPEN | MERGEABLE | CI check-submission pass (verified loop 35) |
| 13963 | OPEN | MERGEABLE (was CONFLICTING) | fixed this loop, see §2 |
| 13964-13966 (opened 09-08) | OPEN | MERGEABLE | were `missing-glama` (maintainer nudge 09-15); subagent added Glama badge in 13963's format, labels flipped to `has-glama` + `has-emoji,valid-name`, check-submission re-ran pass — verified `gh pr view <n> --json mergeable,labels` |

11/11 OPEN, 11/11 MERGEABLE, 0 closed.

## 2. CI fixes applied

- PR 13963 (mcp-statement-of-account) had drifted behind main (mergeable=CONFLICTING).
- Rebuilt branch from current punkpeye main @ HEAD: shallow clone, applied the PR diff
  (`curl -sL .../pull/13963.diff`), `git apply` failed at README.md:2368 (upstream context moved),
  inserted the single +1/-0 entry line directly before the `### 🎮 Gaming` section header,
  one-line diff, force-pushed to `theluckystrike/awesome-mcp-servers`.
- Verified after push: `gh pr view 13963 --json mergeable` -> MERGEABLE;
  `gh pr checks 13963` -> check-submission pass 9s.
- Placement assert: entry at README.md:2505, immediately before the Gaming section header.

## 3. PR #52 — Albertchamberlain/Awesome-MCP

`gh pr view 52 --json state,mergeable` -> OPEN MERGEABLE. CI state unchanged
(first-time-contributor gate; maintainer approval still pending — normal for this repo,
5 of the last 9 external PRs share the gate). Bundled upstream catalog.yaml conflict fix
gives the maintainer a reason to merge.

## 4. New list submissions

- **wundercorp/awesome-mcp — PR #68 opened** (subagent): OPEN, MERGEABLE, mergeStateStatus=CLEAN
  (verified `gh pr view 68 -R wundercorp/awesome-mcp --json state,mergeable,mergeStateStatus`).
  Files: servers/data/zovo-mcp/server.json + regenerated README.md (8 categories);
  passes their required validate-catalog.mjs (23 entries) and generate-readme.mjs;
  repository_url + provider fields added per their schema.
- habitoai: already has our PR #144 open covering Finance — skipped as duplicate.
- unihack/collabnix: next candidate, needs a browse-based entry — queued next loop.

## 5. Raw evidence log

- 11x `gh pr view <n> -R punkpeye/awesome-mcp-servers --json state,mergeable` (output above)
- `gh pr view 52 -R Albertchamberlain/Awesome-MCP --json state,mergeable` -> OPEN MERGEABLE
- `gh pr checks 13963` -> check-submission pass after rebase
- `gh pr view 13964 --json labels` -> has-emoji,valid-name,has-glama (was missing-glama)
- `gh pr view 68 -R wundercorp/awesome-mcp` -> OPEN MERGEABLE CLEAN
