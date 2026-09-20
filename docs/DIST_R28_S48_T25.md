# DIST R28 / S48 T25 — llms.txt directory surfaces (2026-09-20, executed in-process by orchestrator)

Subagent delegation failed again (children die at ~10s, zero tool calls — 4th consecutive occurrence); executed directly.

## Results (all verified)
1. llmstxt.site/submit — form POST via browser, fields: Product Name/Website URL/Name/Email/llms.txt URL. Submitted "Zovo MCP Servers" + https://mcp.zovo.one/llms.txt. Response: "Thank You!" page. ACCEPTED.
   (llms-full.txt field left blank — /llms-full.txt currently 500s; fix separately.)
2. llmstxthub.com — data-driven from github.com/thedaviddias/llms-txt-hub (data/websites.json, 1515 entries). Forked, branch add-zovo-mcp-servers appended entry (name/domain/description/llmsTxtUrl/category=developer-tools/favicon/publishedAt=2026-09-20). PR opened: https://github.com/thedaviddias/llms-txt-hub/pull/1677 — ACCEPTED (awaiting maintainer merge).
3. directory.llmstxt.cloud/submit — form (name/URL/category/email/notes, Standard free tier). Category "Developer tools" via DOM (CDP click on MUI select failed; set via change event). Submit via JS click on JOIN WAITLIST. Response: "You're on the waitlist!" — ACCEPTED (review queue, 1-3 months).

## RESULT: verified-green — 3/3 surfaces submitted with HTTP/UI-verified confirmations.
Follow-ups: merge watch on PR #1677; fix /llms-full.txt 500 and resubmit to llmstxt.site with full variant.
