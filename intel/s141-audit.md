# S141 — Registry Findability Audit (night loop)

## Full remote-coverage sweep (71 estate names)
- 23 stdio-only (no remote declared — office-suite included, no broken promise)
- **48 with hosted remotes: 48/48 answer 200** (split-pdf re-checked after a registry read blip)
- Earlier urllib sweep showed uniform 403s = CF bot fingerprint on urllib; curl-verified truth is all green.

## Defect found & fixed: backlink-checker
- Registry row declared `https://mcp.zovo.one/mcp/backlink-checker` but the product was never wired into the remote worker (SERVERS table had 45 keys; backlink-checker + office-suite missing) → real buyers hit **404**.
- Fix: vendored `servers/backlink-checker` (stateless, fetch-only — like currency, nothing persisted), added import + SERVERS entry + TOOLS entry [link_check, link_audit, robots_guard_check, license_status/activate], removed pointless self-alias.
- Deployed (worker bd1ef41b). Verified live: initialize 200, tools/list returns all 3 tools, real `link_check` invocation returned a full verdict (Status/Robots/dofollow/Verdict lines). Commit `b86c4fbb`. Server count now 46.

## Search-saturation probes
- Phrase queries ("merge pdf", "budget tracker") return 0 registry hits — registry search is name-keyed, not description-keyed. Occupancy of exact-name slots is what matters.
- All 8 S139 buyer-intent names still hold their #0 slots for their own names (verified earlier this night).
- 23 stdio-only names = hosted-ify backlog (KPI upside, incl. office-suite).

## Residual notes
- `appointment` name collision pre-exists (registry-wide, not ours to fix).
- office-suite: prime candidate for next hosted-ify batch (multi-engine composite, more work than a simple vendor).
