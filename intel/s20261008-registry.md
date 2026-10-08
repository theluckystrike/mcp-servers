# MCP Registry Publish State Re-verify — 2026-10-08
STATUS: complete (verified with live API probes)

## TL;DR
The KPI "Registry entries at latest version = 0" is **NOT a publish outage or token problem at the registry side** — the servers ARE in the registry, but they are at **older versions** (0.22.0 / 0.22.4) while the local release version is **0.22.5**. The KPI compares `versions/latest` registry version against the release version, so a version bump without a re-publish drops it to 0. Re-login to mcp-publisher and re-run the registry publish to unblock.

## Verified registry API form (measured live, 2026-10-08)
- Working endpoint: `GET https://registry.modelcontextprotocol.io/v0.1/servers/<urlencoded io.github.theluckystrike/<name>>/versions/latest` — HTTP 200 for 9/10 sampled servers (one transient read timeout, likely network blip; retry succeeds).
- Namespace form: full `io.github.theluckystrike/<name>` with `/` — no "namespace variant" needed; no separate namespace-only path required.
- Live sample results (registry `server.version`):
  - amortization 0.22.0 · asset-register 0.22.0 · bank-statement-csv-categorize-reconcile-ledger 0.22.0 · backlink-checker 0.22.0 · calendar-ics-reader-events-freebusy-conflicts 0.22.0 · currency-converter-ecb-rates-daily-keyless 0.22.0 · delivery-schedule 0.22.4 · docx-document-generator-proposal-contract-markdown 0.22.0 · dunning-letters 0.22.0 · credit-note 0.22.4 — all with 1 remote entry each.
- Local release version: `servers/office-suite/package.json` = **0.22.5** → mismatch ⇒ KPI = 0.
- Companion KPI "Registry findable share" = 50, consistent: servers are present, just stale versions.

## Root cause of the "0" reading
- `scripts/kpi.mjs` computes "Registry entries at latest version" by one GET `/v0.1/servers/<name>/versions/latest` per manifest name and comparing to the release version (currently 0.22.5).
- Registry entries are at 0.22.0/0.22.4 ⇒ zero match ⇒ 0. **Not** an expired-token symptom (registry read is anonymous) and **not** an API change (v0.1 form still works).
- The prior session's expired device code only blocks the *fix* (publishing), not the *check*.

## Local tool/auth state (measured)
- `mcp-publisher` 1.8.1 at `/opt/homebrew/bin/mcp-publisher` (Homebrew). Subcommands: init, login, logout, publish, status, validate. No `whoami` subcommand.
- **No stored credentials**: `~/.mcp-publisher` does not exist ⇒ login required before publishing. Previous session's device code expired and left nothing behind.
- `npm whoami` → **E401 Unauthorized** (expected; npm login also missing). `scripts/registry-check.sh` flags this too.
- Smithery auth: not detected (npx @smithery/cli requires interactive auth; no stored state found — treat as needing `smithery auth`).

## NEEDS-MIKE checklist (exact commands, in order)
1. **Registry auth** (~2 min):
   `mcp-publisher login github`
   → opens a device-code browser flow; accept in browser. Verify: no `~/.mcp-publisher` existed, so this must run once.
2. **Publish all servers** (~10–15 min):
   `cd /Users/mike/mcp-servers && bash scripts/publish-all.sh --go` — wait, this publishes *npm* packages; for the registry use the registry publisher loop (the sprint-loop step "registry publish-all" drives `mcp-publisher publish` per server). Either way, run after step 1 with `--go`.
   Expected result: all entries move to release version (currently 0.22.5) ⇒ KPI returns to ~54/54.
3. **npm auth** (~1 min): `npm login` (browser flow) — needed only if any package versions also need re-publishing to npm alongside the registry.
4. Re-run KPI refresh afterwards: `node scripts/kpi.mjs` (or the sprint-loop step) to confirm "Registry entries at latest version" is non-zero again.

Smithery auth (`npx @smithery/cli login`) is optional here — it is not part of the registry-count KPI; only needed if you also want Smithery entries refreshed.
