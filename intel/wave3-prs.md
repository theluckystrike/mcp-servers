# Wave 3 PR Report — MCP Directories

**Task:** Open PRs adding luckystrike MCP servers to NEW GitHub awesome-lists with active intake (merged PRs last 60 days), verified via `gh pr view`.

**Targets:** price-tracker, time-tracker, backlink-checker
**Repo:** https://github.com/theluckystrike/mcp-servers
**Site link:** https://mcp.zovo.one

## STATUS: complete — 1 verified PR

## Verified PRs (via `gh pr view`)

| Repo | PR | State | Mergeable | Added |
|------|----|-------|-----------|-------|
| punkpeye/awesome-remote-mcp-servers (95k org; 377★, pushed 09-23, merged PR #556 same-day) | [#610](https://github.com/punkpeye/awesome-remote-mcp-servers/pull/610) | OPEN | MERGEABLE | Zovo Price Tracker — Finance category, exact 3-line format (homepage link, endpoint backtick, Glama connector badge 200-verified, 🔓 marker, ≤120-char desc ending in period), placed alphabetically at end of F (before Food & Dining). Title carries 🤖🤖🤖 fast-track opt-in per CONTRIBUTING. |

Pre-flight verified: hosted endpoint initialize 200 (Streamable HTTP); Glama connector badge SVG 200; entry format from CONTRIBUTING.md.

## Candidates vetted, rejected
- chatmcp/mcpso (2107★) — dead intake, last push 2025-03-26.
- punkpeye/awesome-mcp-clients (6591★) — clients, not servers; out of scope.
- punkpeye/awesome-mcp-devtools (484★) — no push since 08-04, borderline stale.
- soxoj/awesome-osint-mcp-servers (495★, active) — OSINT vertical; backlink-checker is SEO not OSINT; skipped to keep PRs coherent.
- toolsdk-ai/toolsdk-mcp-registry, drshade, others — stars < 30 or single-server repos.
- Time-tracker/backlink-checker: no fitting category in remote-list (Workplace & Productivity is for business SaaS); can go in a later wave.

## Notes
- Attempt 1 (deleg_5321decc): timed out during research, no PRs.
- Attempt 2 (deleg_76287ea8): failed HTTP 504 model lock; partial research reused.
- Attempt 3 (orchestrator, this run): direct execution. Git push hit corrupt-shallow-pack errors twice (remote unpack failed / missing tree objects) — resolved by fresh clone of upstream and pushing to the `-2` fork.
