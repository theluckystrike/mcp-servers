# R34 — Registry hosted-remotes restore + KPI probe fix (2026-10-14e)

## What happened
R33's mass republish (server.json files without `remotes`) silently STRIPPED the
hosted/streamable-http URLs from ~50 registry entries. Discovered via fixed KPI probe.

## Fixes shipped
1. **kpi.mjs probe fixed** (PR #48): `/versions/latest` 404s on registry API — now uses
   `/versions` + `servers[0].server`; excludes `.mcpb.json` manifests. KPI now truthful
   (was falsely 0).
2. **remotes restored** on 55 base manifests (https://mcp.zovo.one/mcp/<slug>) — PR #48.
3. **URL-collision resolution** (PR #49): registry enforces one remote URL per server.
   Variants had stolen primaries' slugs during the mass edit. Fixed by republishing
   owners WITHOUT remotes (frees URL), then primaries at bumped versions:
   - credit-note 0.22.8 -> mcp.zovo.one/mcp/credit-note-ics (live, verified 200)
   - packing-list 0.22.8 -> mcp.zovo.one/mcp/packing-slip (live, verified 200)
   - purchase-requisition 0.22.8 -> QUEUED: stale registry URL-index still blocks its own
     slug even though owner (onboarding variant 0.22.7) no longer carries it. Retry next session.
   - delivery-note 0.22.7 published; asset-register transient net error -> landed as dup.

## Registry quirks learned (SAVE — these cost 1h)
- `mcp-publisher publish <file.json>` requires the file to be named server.json in CWD
  context; arbitrary paths fail with "server.json not found" (but worked earlier —
  flaky; safest: `--only <name>` via registry-publish-all.mjs).
- Duplicate name+version = hard 400; version bump required for ANY manifest change.
- URL-ownership index is EVENTUALLY CONSISTENT (~10-20 min lag). Errors lie during lag.
- Registry API `/versions` rows keep historical remotes per version; `_meta...isLatest`
  flags the current one. Some old rows show `status: deprecated` — cosmetic.
- Registry propagation lag means kpi "at latest" reads low right after batches.

## KPI after
- 8/32 indicators met (was 7). hosted=2 (registry lag hides more; sampled entries
  amortization 0.22.6 + remotes confirmed live).
- Funnel unchanged: 3 real subs, 0 revenue. Distribution PRs: #173 MERGED,
  #1771 open (bumped comment 6160760537).

## Next session
1. Retry purchase-requisition publish (stale index should have cleared).
2. Smithery bulk publish — BLOCKED on user login (CLI auth flow needs interactive browser).
3. Verify kpi "at latest" recovers to ~105/105 after propagation.
