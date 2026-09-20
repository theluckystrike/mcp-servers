# DIST_R37 — S59 (2026-09-20)

## Scope
1. Recheck S58 resubmissions on mcpservers.org
2. Amplification (organic lane)
3. npm publish attempt

## Findings

### 1. Resubmission recheck (browser-only, curl CF-403)
- /servers/...-quotes: **Not Found**
- /servers/...-pdf: **Not Found**
- /servers/...-invoice: **live 200** (16,340 chars, baseline control)
- Verdict: S58 resubmissions accepted ("Submission Successful" 11/11) but listing pages not yet published. Consistent with directory's 2-week review window. Recheck S60.

### 2. IndexNow amplification — 200
- Pinged 11 URLs (10 flagship /s/{slug} pages on mcp.zovo.one + control) via api.indexnow.org, key db6dbf5cfdbc08d1cc9b5365d398145b (key file verified 200 previously).

### 3. npm publish — BLOCKED (token expired)
- `npm whoami` → E401; publish PUT → masked 404. Token in ~/.npmrc (40 chars) revoked/expired.
- Dry-run publish succeeds (`+ @theluckystrike/mcp-invoice@0.22.0`, 16 files).
- **Impact if unblocked**: 46 packages publishable; every mcpservers.org listing page renders a working `npx @theluckystrike/mcp-*` block → direct user acquisition lane.

## Unblocks needed from user (2 min each)
1. `npm login` — unlocks 46 package publishes + listing-page install blocks
2. GitHub device-OAuth for mcp-publisher — unlocks 19 official-registry listings

## Next sprint (S60)
- Recheck 10 resubmitted listing pages (browser)
- If published: badge + amplify 10 new listings
- Re-probe full 46-slug estate for any newly published panels
