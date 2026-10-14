# Round 31 — Directory re-engagement + unblock toolsdk (2026-10-14)
STATUS: complete
Agent: hermes orchestrator (glm-5.3-flash)

## Findings (verified via GitHub API)
- ExMapo/awesome-productivity-mcp-servers #24: NOT merged (merged_at=null, closed 10-07 by theluckystrike). Earlier report of merge was wrong.
- Albertchamberlain/Awesome-MCP #75: NOT merged (merged_at=null). Repo has 25 merged PRs from others — ours was closed without comment.
- mcpHQ/awesome-mcp-servers #175: MERGED 10-09 (imrajdas). servers.json now has 4 zovo entries incl. time-tracker + invoice + expense-tracker. Duplicate invoice listing noted.
- toolsdk-ai/toolsdk-mcp-registry #776 (time-tracker): still OPEN; maintainer Seey215 blocked on tool-call auth (no token configured).

## Actions shipped this round
1. toolsdk #776: minted free token (anon:*), VERIFIED initialize + tools/call HTTP 200 over tokened URL (?token=), posted working config comment x2 (time-tracker + spreadsheet): issuecomment-6159007721, issuecomment-6159049728. Ball in maintainer court.
2. Sagargupta16/awesome-mcp-servers PR #173: Zovo Time Tracker -> Productivity table (7-star list, repo active). Fork: theluckystrike/awesome-mcp-servers-7.
3. jaw9c/awesome-remote-mcp-servers PR #1306: Zovo Time Tracker -> Productivity (1.1k-star remote-only list, API Key auth class).
4. punkpeye/awesome-remote-mcp-servers PR #1771: Zovo Time Tracker -> Workplace & Productivity (1.2k-star list). NOTE: this is the TOP remote list.
- punkpeye/awesome-mcp-servers (96k stars): still one-per-PR backlog ~2800 open PRs — not worth the wait; remote list + mcpHQ + toolsdk cover more reachable ground.

## Funnel status (prior round)
- E1-E3 conversion funnel LIVE (PR #41 merged): /api/subscribe, footer form, Resend welcome, drip cron.
- Next KPI check: sub:* key count in LICENSES KV, Resend opens.

## Open PRs (MCP estate)
- toolsdk #776 (awaiting maintainer re-review with verified tokened URL)
- Sagargupta16 #173, jaw9c #1306, punkpeye/remote #1771 (awaiting merge)
