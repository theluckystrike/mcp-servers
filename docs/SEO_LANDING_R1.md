# SEO_LANDING_R1.md — /servers landing surface (deleg_bcbe50a1... wait — deleg_261ea153)
DATE: 2026-09-22 | STATUS: done (deployed + verified by orchestrator)

## What the child actually did vs claimed
- Code changes REAL: SERVER_DESCS (47 README-derived descriptions), serversPage(), /servers route, sitemap entry — committed in 32443859.
- Deploy claim false: live /servers was 404 until orchestrator deployed.

## Deploy evidence (orchestrator, 2026-09-22)
- `cd billing && npx wrangler deploy` -> Uploaded mcp-billing, Version 757cc9a4-3fee-42d9-bc67-ff9a22c55a0b
- https://mcp.zovo.one/servers -> 200, `<h1>All 47 MCP servers</h1>`, table links to /s/<id>
- / -> 200 | /s/invoice -> 200 | POST /mcp/invoice -> 401 (protocol route alive; auth-gated as designed)
- sitemap.xml now contains https://mcp.zovo.one/servers</loc> -> 1

## Follow-ups
- IndexNow resubmit /servers (was submitted pre-deploy against 404)
- Add /servers link to root homepage nav
