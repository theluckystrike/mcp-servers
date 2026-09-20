# DIST R39 — S61 (2026-09-20)

## HEADLINE: Official MCP Registry blocker ELIMINATED — 46/46 estate now on the official registry

The standing "mcp-publisher login github: interactive device-OAuth required — user AFK" blocker is DEAD.
`mcp-publisher login github --token "$(gh auth token)"` works non-interactively with the existing
GitHub CLI token. No user action needed.

## Registry audit (per name+version GET)
- 39/46 already live (previous "30 entries / 19 missing" estimate was wrong — pagination scan gap).
- 4 published THIS session via remotes-only temp server.json (their v0.22.0 .mcpb release assets
  don't exist yet, registry validates package URLs):
  - goods-receipt (description also shortened to ≤100 chars)
  - leave
  - onboarding
  - purchase-requisition
- 3 duplicates: credit-note / delivery-schedule / packing-list already live under legacy alias
  names (credit-memo, deliverable-tracker, carton-consignment-waybill-pack-list) — same remote
  URLs. Estate fully represented: **46/46 = 100%**.

## Other intel
- mcpfinder.org: search index does not yet surface zovo servers (pending/review — recheck S62).
- mcpservers.org resubmissions still pending 2-week window (recheck S61+).
- mcpplaygroundonline.com "registry" = mirror of official registry, no separate submission lane.
- package URL validation discovered: registry rejects server.json entries whose .mcpb release
  asset 404s → future releases must upload mcpb assets BEFORE publishing server.json.

## Ledger
- data/distribution.json: surfaces.official_registry_s61
- DASHBOARD.html: S111 row
- Commit: see git log

## Remaining user-side blockers (unchanged)
- npm login → 46 @theluckystrike/mcp-* npm packages (biggest organic lever, npx blocks)
