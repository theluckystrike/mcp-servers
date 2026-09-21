# S128_B_REDISTRO — free-directory re-probe (2026-09-21, orchestrator after delegated agent burned budget on reads only)

STATUS: complete — all 5 surfaces probed this session with producing commands.

## Results (old -> new, evidence)

### mcpservers.org — still blocking bots
- `curl -A 'Mozilla/5.0 (Macintosh...) .../search?q=zovo'` -> 403 (twice: search + server page)
- Transition: 403 -> 403. No change. Needs real-browser probe (browser tool) to confirm listing status; not free-lane actionable via curl.

### mcpmarket.com — zovo NOT listed
- `curl .../search?q=zovo` -> 200 but result cards are unrelated servers (lancedb, osv-scalibr, ...)
- `curl .../server/mcp-invoice` -> 404; `/server/mcp-time-tracker` -> 404
- Transition: not-listed -> not-listed. Re-submission required (free, no lane confirmed for submit endpoint — Next.js app, submit form not probed).

### glama.ai — 401 on all three slugs
- `curl .../api/mcp/v1/servers/theluckystrike/mcp-invoice|spreadsheet|bank-statement` -> 401 x3
- Transition: 404 -> 401. API now requires auth token for lookups. Repair via glama dashboard needs login (human-gated) or authed API token — check repo for stored glama API key before next attempt.

### mcp.so — zovo NOT listed
- `curl .../search?q=zovo` -> 200, page states "No servers match zovo"
- Free submit path not confirmed from /submit markup. Paid-only assumption unresolved.

### cline-marketplace — no open PRs
- `gh api 'search/issues?q=author:theluckystrike+type:pr+cline'` -> total_count 0
- Transition: submitted -> none-found. Prior PR (if it existed) closed/rejected or repo name differs; needs target-repo re-identification before resubmit.

## Net
No live zovo listings gained this round. Real win confirmed elsewhere: official MCP registry 137 active (see S128_RESULT.md). Directory lanes remain low-yield vs GSC/npm/marketplace unlocks.
