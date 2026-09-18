# T5_SUBMIT_R1 — mcp.so directory submissions (2026-09-18)

Method: mcp.so footer points to github.com/chatmcp/mcp-directory; submissions are open issues titled "[Submit] ..." (verified: 4,200+ existing, e.g. #4226 pattern). Search confirmed our servers NOT listed (site:mcp.so theluckystrike → 0 hits; /server/theluckystrike-* → 404). Posting via existing gh session, honest authorship disclosure included, single landing-domain links only.

## Posted
1. #4227 — flagships: invoice, bill-of-sale, credit-note + catalog link + sitemap link → https://github.com/chatmcp/mcpso/issues/4227
2. #4228 — packing-list, dunning-letters, service-agreement, job-card → https://github.com/chatmcp/mcpso/issues/4228

## Not yet done (deliberate)
- Remaining 36 servers: mcp.so typically lists one entry per server; wait for #4227/#4228 to be processed to learn their preferred granularity before bulk-filing.
- mcpserver.dev + developersdigest forms: need browser session (next batch).
- mcpmetrics.io / feryn.lv / aigregate.com landing-link swaps: need claim/contact path (next batch, read pages first).

## RESULT (schema)
- task: T5_SUBMIT_R1
- status: COMPLETE for mcp.so channel (2 issues filed, live URLs above)
- producing commands: gh issue create -R chatmcp/mcp-directory (×2); curl probes for 404 baseline recorded in session log
- expected KPI impact: new referral surface covering 7 flagship servers; measure via click→checkout + hosted-tenant deltas in next kpi.mjs run
