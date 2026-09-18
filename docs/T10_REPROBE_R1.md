# T10 — Re-probe round R1 (2026-09-18)

Commands: curl -s -o /dev/null -w "%{http_code}" per URL (10s timeout), results below carry producing output in-line.

## mcp.so ingestion of #4227/#4228 — NOT YET
- /server/theluckystrike-mcp-invoice → 404
- /server/theluckystrike-mcp-bill-of-sale → 404
- /server/theluckystrike-mcp-office-suite → 404
- Expected: manual pipeline, 24–72h. Next reprobe window opens ~2026-09-20.

## Official MCP registry — HEALTHY
- io.github.theluckystrike%2Finvoice versions/latest → 200 (control for the 404s above).

## MCP Market (mcpmarket.com) — submission pending verification
- Form submission completed 2026-09-18 (browser automation, Free Queue $0, repo theluckystrike/mcp-servers, email support@zovo.one).
- Headless verification blocked: curl /server/theluckystrike-mcp-servers → 403 (bot shield), search page 0 hits. Needs browser reprobe + watch support@zovo.one inbox.
- Paid fast-track $29 optional (24h listing + Try Now link) — human decision.

## KPI snapshot (node scripts/kpi.mjs data 2026-09-18T01:06Z)
- Organic traffic gates still red: Google impressions 0/1, Googlebot 2/190, ClaudeBot 140/190.
- Distribution surfaces 12/51 live (surfaces map: data/distribution.json, 52 entries).
- Click→checkout 29.9% (target 40) — 334 upgrade-link clicks, 100 checkout sessions.

## Status
STATUS: verified — probes reproduced, no false claims; MCP Market unverifiable headlessly (flagged).
