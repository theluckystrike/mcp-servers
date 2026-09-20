# S59 — npm publish blocked on expired npm token (2026-09-20)

## Finding
- All 10 flagship listing pages on mcpservers.org (invoice live page inspected in full) state:
  "npm publish for @theluckystrike/mcp-* is pending. Until then, the .mcpb bundle or clone+build is the working path."
  The npx install command in every README + listing starts working the moment the package is published.
- `npm whoami` → 401. Token in ~/.npmrc (40 chars, registry.npmjs.org scope) is expired/revoked.
- `npm publish --dry-run` succeeds (package builds cleanly, 16 files).
- Real `npm publish` → 404 (npm masks auth failures for scoped PUT as 404).
- gh CLI is authed (theluckystrike) but cannot mint npm tokens.

## Unlocks when user fixes (2-min action)
1. Run: `npm login` in a terminal (browser opens; or mint a new Automation-type granular token at npmjs.com → Access Tokens and update ~/.npmrc `_authToken=`).
2. Then all 10 flagship packages can be published in-session (dry-run verified pipeline), which:
   - makes every `npx -y @theluckystrike/mcp-*` install command live across 46 READMEs + 4 live directory listing pages
   - enables the remaining 32 servers' README npx commands too

## Status
- BLOCKED: npm auth (user action required). Everything else in S59 executed autonomously.
