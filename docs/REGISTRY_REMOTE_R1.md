# Registry remote R1 — 2026-09-17

## Before
- Live registry `?search=theluckystrike`: 30 rows but only 2 distinct names (version dupes), 0 with remotes.
- server.json on disk: all 41 hosted servers already had correct `remotes[0].url = https://mcp.zovo.one/mcp/<server>` — the repo was never the problem.

## What blocked publishing
1. MCPB assets: server.json referenced v0.22.0 release assets that did not exist (latest release was v0.21.0) -> "not publicly accessible (404)".
2. npm packages: `@theluckystrike/mcp-*` are not on npm and the npm token in ~/.npmrc is revoked (`npm whoami` -> E401), so every manifest listing an npm package fails validation.

## Fixed this session
- Rebuilt all 38 .mcpb bundles (scripts/build-mcpb.sh must run under node 22; node 20 lacks `registerHooks` used by remote/test — run with PATH=/opt/homebrew/opt/node@22/bin:$PATH).
- Created release v0.22.0 and uploaded all 38 .mcpb as assets (gh release view -> assets: 38).
- Ran `node scripts/registry-publish-all.mjs`: **published 38, failed 112**.
- 4 servers (maintenance-log, mileage-log, service-agreement, supplier-list) also fail release-check on missing demo gif/logo/SPEC — cosmetic, not registry-blocking.

## After
- Registry now has 30 distinct names; **15 carry live remote URLs** (verified via registry API `version=latest`).
- Remaining 112 failures are all one root cause: npm packages 404. Human-gated fix: create a fresh npm token (https://www.npmjs.com/settings/theluckystrike/tokens/new), replace ~/.npmrc _authToken, `npm publish` per server, then re-run registry-publish-all.mjs. Every remaining registry entry then publishes with its remote and the hosted endpoints become visible to every directory that consumes the registry.

## Final state (2026-09-17 17:40) — all 41 hosted endpoints live in the Official MCP Registry

`node scripts/registry-publish-all.mjs` runs (reg5-reg7) + per-server curl checks:

- 80/150 manifests published-or-duplicate (duplicate = same name+version already live, i.e. published)
- 42 primary server.json manifests switched from npm-package entries (npm 404, token revoked)
  to mcpb entries with real fileSha256 (was "TBD" placeholder on 8, causing sha-pattern 422s)
- 3 servers bumped to 0.22.1 (credit-note, delivery-schedule, packing-list) where the same
  (name,version) was already registered with different content
- Verified per-endpoint: all 41 hosted remote URLs https://mcp.zovo.one/mcp/<server> are
  queryable in the registry (38 under primary names, 3 under alias names:
  credit-note -> credit-memo, delivery-schedule -> deliverable-tracker,
  packing-list -> carton-consignment-waybill-pack-list)

Remaining known limits (not blockers):
- 70 alias manifests fail with "remote already used"/"duplicate version" — the aliases are
  redundant second names for already-published servers; the publisher retries them every run
  and they stay failed. Harmless; could be skipped explicitly in a future edit.
- npm packages still 404 until the token is replaced (human-gated).
