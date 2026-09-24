# S142 — Directory Wave 2: New awesome-MCP-list PR submissions

STATUS: COMPLETE

## Outcome
- PR opened: https://github.com/Sagargupta16/awesome-mcp-servers/pull/109 (OPEN, MERGEABLE, awaiting maintainer review)
- Adds 4 Zovo servers: Pomodoro Timer, PDF Merger, Invoice, Backlink Checker -> theluckystrike/mcp-servers monorepo
- Orchestrator follow-up: rebase conflict resolved (upstream had merged mcp-invoice row first; kept upstream row, dropped duplicate), force-pushed 54268be, PR now mergeable
- Skipped: Rodert/awesome-mcp (dead intake, 0 merged / 11 open); see live transcript for full screen list

## Strategy
Target NEW 'awesome MCP servers' list repos not in the already-covered set, verify
active intake (merged PRs) and format, open compliant PRs, verify PR URLs via `gh pr view`.

## Candidates screened

| Repo | Stars | Merged PRs | Archived | Verdict |
|------|-------|-----------|----------|---------|
| Sagargupta16/awesome-mcp-servers | 5 | 74 | no | **ACCEPT** — general list, auto-merge, clear table format + validate.py |
| lobstercare/mcp-hub | 61 | 33 | no | In-progress — general list, bullet+icon format, no CONTRIBUTING |
| VipinMI2024/awesome-mcp-servers | 11 | 3 | no | Marginal — sales-only categories, small |
| Rodert/awesome-mcp | 17 | 0 | no | SKIP — dead intake (0 merged / 11 open) |
| geesugar/awesome-mcp | 4 | 0 | no | SKIP — dead intake |
| timunbasah3/awesome-mcp | 11 | 0 | no | SKIP — dead intake |
| korchasa/awesome-mcp | 8 | 0 | no | SKIP — dead intake |
| PipedreamHQ/awesome-mcp-servers | 284 | n/a | no | SKIP — stale (no push since 2025-03) |
| jaw9c/awesome-remote-mcp-servers | 1119 | n/a | no | SKIP — remote-only list, our servers are local npm |
| Tommertom/awesome-ionic-mcp | 46 | n/a | no | SKIP — ionic-specific |
| toolsdk-ai/toolsdk-mcp-registry | 187 | n/a | no | SKIP — registry with own process |
| habitoai/ai list etc. | | | | already covered |

## Servers available (repo https://github.com/theluckystrike/mcp-servers)
- invoice-generator — PDF invoices (duplicate of existing Sagargupta16 entry 'Invoice MCP' -> skip)
- pdf-merger — merge PDFs from chat (File Systems & Storage)
- backlink-checker — dоfollow/nofollow, anchor text, robots guards (Marketing & Analytics / SEO)
- pomodoro-timer — focus sessions (Productivity)

## Crafted entries (Sagargupta16 table format: | [Name](URL) | Description | Language |)
- Marketing & Analytics:
  | [Backlink Checker MCP](https://github.com/theluckystrike/mcp-servers) | Check backlinks: dofollow/nofollow, anchor text and robots guards | TypeScript |
- File Systems & Storage:
  | [PDF Merger MCP](https://github.com/theluckystrike/mcp-servers) | Merge PDF files from chat | TypeScript |
- Productivity:
  | [Pomodoro Timer MCP](https://github.com/theluckystrike/mcp-servers) | Focus sessions and pomodoro timer from chat | TypeScript |
Note: invoice-generator only via the dedicated mcp-invoice repo already listed; skip to avoid duplicate.

## PR log
(pending)

## Verification
`gh pr view <url>` — required before claiming success.

## Status note
If <3 repos qualify as active compliant lists, report honestly rather than force-doing PRs
into dead or mismatched repos.