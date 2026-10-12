# s20261009b — MCP Registry Publish Report

## STATUS: COMPLETE — 54/54 servers live in official registry

## Task
Publish all missing/stale MCP servers to the official MCP registry (registry.modelcontextprotocol.io).

## Plan
1. Run publisher script (multiple passes if needed; duplicates = success).
2. Save stdout to intel/s20261009b-registry-publish-log.txt.
3. Verify via registry API for io.github.theluckystrike/*.

## Pass log
- Agent pass: 119 duplicate (= already latest), 2 failed.
- Orchestrator pass (2nd wave): identified 23 servers missing from registry entirely via /v0.1/servers?search=theluckystrike&version=latest (100-cap) + per-server 404 checks.
- Root cause for missing servers: their server.json versions (e.g. 1.0.0, 0.22.0) had ALREADY been published historically but were superseded/never indexed as latest → registry rejects duplicate version. Fix: bump patch version + republish.
- 21/23 fixed by automated version-bump loop (commit 66d933a1).
- price-tracker-drop-alert-watch: also had 404 MCPB asset URL (v0.22.5 missing) → repointed to v0.22.0 asset, recomputed sha256, bumped to 0.22.8, published OK.
- time-tracker-timesheet-billable-hours: name-collision/dup issue → bump to 0.22.3, published OK.
- One 401 "Registry JWT expired" mid-run → re-authed via `mcp-publisher login github` (device flow).

## Registry verification
- All 54 local servers verified live (published or already at latest).
- Receipts check: io.github.theluckystrike/receipts → version 1.0.2 live.

## Failures (verbatim)
- None remaining. Historical: `invalid version: cannot publish duplicate version` (resolved by bump), `MCPB package ... not publicly accessible (status: 404)` (resolved by repointing to v0.22.0 asset).

## KPI impact
- MCP registry servers at latest: 31/54 → 54/54 (100%).

## Evidence
- intel/s20261009b-registry-publish-log.txt (agent pass log)
- /tmp/republish_results.json (2nd-wave loop results)
- git commit 66d933a1
