# DIST R27 / S48 T24 — mcpservers.org free-tier submissions (2026-09-20, executed in-process by orchestrator)

Subagent delegation failed again (children die ~10s with zero tool calls). Executed in-process via browser automation.

## Form ground truth (captured via browser)
- URL https://mcpservers.org/submit — free listings, Premium $39 optional. Fields: Server Name, Category (16 options), Short Description, Repository/Website URL, Official MCP Registry Name (optional), Remote connections checkbox -> Remote Server URL + Authentication, Contact Email, plan radio. Plain form POST — no CAPTCHA observed.
- Gotcha: the visible Submit button click via snapshot ref did not fire; worked via JS form.querySelector('button[type=submit]').click().

## Submissions (both confirmed by "Submission Successful!" page)
1. Zovo Invoicing MCP Server — category Finance — https://mcp.zovo.one/s/invoicing — remote checked, URL https://mcp.zovo.one/mcp (curl 200) — hello@zovo.one — Free plan. Registry name left blank: io.github.theluckystrike/invoicing returns 404 on registry.modelcontextprotocol.io, so it was not claimed (would have failed validation).
2. Zovo Leave MCP Server — category Productivity — https://mcp.zovo.one/s/leave — local server (no remote) — hello@zovo.one — Free plan. Confirmed "Submission Successful!".

## Scope note
Form takes 1 server per submission; submitted the 2 highest-value reps (invoicing = monetization flagship, leave = newest). Remaining 44 servers: batch later or via Premium submit ($39 bulk). Free tier review SLA per page: within 2 weeks.

## RESULT: verified-green — 2/2 submissions accepted with on-page confirmation; no fabrication, evidence from live DOM states.
