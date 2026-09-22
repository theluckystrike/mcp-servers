# R20: Registry URL conflict — root cause & resolution

## Final state (verified)
- Full publish run: **published 0, duplicate 44, failed 3** (up from 85 failed before R19; up from 4 residual).
- `change-order` fixed itself: republishing its alias `variation-order@0.22.1` to its own URL freed `https://mcp.zovo.one/mcp/change-order`; primary now publishes as duplicate (already at latest).
- Remaining 3 hard failures: **credit-note, delivery-schedule, packing-list**.

## Root cause (experimentally proven)
The official MCP registry enforces remote-URL uniqueness across **all versions of all servers**, including immutable old versions.

For these 3 servers, alias manifests were published in the past at 0.22.0 claiming the primary's URL:

| Primary (blocked) | Alias holding primary URL |
|---|---|
| credit-note | io.github.theluckystrike/credit-memo@0.22.0 |
| delivery-schedule | io.github.theluckystrike/deliverable-tracker@0.22.0 |
| packing-list | io.github.theluckystrike/carton-consignment-waybill-pack-list@0.22.0 |

Mitigation attempted and PARTIALLY working:
- Published alias fixes at 0.22.1 (own URLs) — succeeds, but the immutable 0.22.0 record still holds the claim.
- Published credit-memo@0.22.2 with `remotes: []` — does NOT free the URL (uniqueness scans all versions).
- PUT /v0.1/servers/{name}/versions/{version} to edit 0.22.0 → 403 (no edit permissions on published records; immutable by design).
- Version-bump of the primary (credit-note@0.22.1) → still blocked.

## Conclusion
These 3 need registry-side intervention (file an issue at github.com/modelcontextprotocol/registry asking to purge or re-point the 3 stale 0.22.0 records, or support for tombstoning versions). Everything else in the estate is at latest / duplicate-clean.

## Script change
`scripts/registry-publish-all.mjs` now publishes **only `server.json`** primaries (all `server.*.json` alias/variant manifests skipped) — they can never publish while sharing the primary URL.
