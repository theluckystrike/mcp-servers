# R33 — Registry full-coverage publish + audit (2026-10-14d)

## What was done
1. **Full registry audit**: probed official MCP registry for all 149 local manifest names
   via `GET /v0.1/servers/io.github.theluckystrike%2F<name>/versions` (URL-encoded slash,
   plain 404s from the unencoded path were false negatives).
2. **Published everything stale**: `node scripts/registry-publish-all.mjs` —
   **115 ok, 8 duplicate (expected), 0 failed**, all at 0.22.5.
3. **freelance-rate-calculator** (variant manifest inside hourly-rate/, skipped by the
   batch script by design) published directly with `mcp-publisher publish
   servers/hourly-rate/server.variant.json` — verified live at 0.22.5.
4. Batch result committed as PR #46 (squash, f3ad15fb) after protected-branch push
   rejection on main direct push.

## Verified registry state
- 149/149 names present in official registry at local version (0.22.5 or 1.0.1).
- Registry `/versions` endpoint (not `versions/latest` — that path 404s on this API
  version) is the correct membership probe.
- kpi.mjs "Registry entries at latest version" showed 0 because it hits
  `versions/latest`, which returns "Endpoint not found" (404) — the KPI was measuring a
  broken endpoint, not missing entries. **kpi.mjs needs the probe path fixed** (next
  session: change to `/versions` + take servers[0].server.version).

## Key learnings
- Registry API: `/v0.1/servers/{encoded name}/versions` works; `/versions/latest` does
  NOT exist (despite openapi.json listing it) — returns 404 "Endpoint not found".
- Registry is very slow under parallel load (35/149 probe timeouts at concurrency 8);
  serial with 25s timeout works.
- `server.variant.json` manifests are valid registry entries but excluded from the batch
  script — publish those manually.
- Push to protected main is rejected — always PR branch + squash.

## KPI impact
- Registry coverage: 149/149 = 100% (was 148 + 1 missing variant).
- Directory PRs: #1306 (jaw9c) closed unmerged by maintainer; #173 + #1771 still open.
- Funnel: 4 sub keys (3 real + 1 E2E), 1 unsub. No revenue events.
