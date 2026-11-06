# A2 — Awesome-list PRs: rules to satisfy and owner actions (2026-11-06)

## PRs opened and re-verified OPEN via `gh pr list --state open`

| List | PR | Entries | Re-verified |
|---|---|---|---|
| punkpeye/awesome-mcp-servers | https://github.com/punkpeye/awesome-mcp-servers/pull/18737 | zovo-one/mcp-price-tracker + zovo-one/mcp-time-tracker (E-Commerce, Workplace & Productivity) | OPEN |
| mcpHQ/awesome-mcp-servers | https://github.com/mcpHQ/awesome-mcp-servers/pull/695 | MCP Price Tracker + MCP Time Tracker in `data/servers.json` | OPEN |

Pre-existing open PRs from earlier rounds (not counted): punkpeye #18434, #14681, #13966, #13965, #13964; DhanushNehru #95.

## Gating rules discovered (actionable)

1. **punkpeye/awesome-mcp-servers (main)** — NO star gate. Requires: public GitHub repo; links must be github.com; entry name `owner/repo`; emoji from permitted set (📇 = TypeScript, 📍 is NOT permitted — I had to fix this); no duplicate URLs; bullets end-of-section despite "alphabetical" wording in practice. `🤖🤖🤖` in PR title = agent fast-track. **Owner action: none — just watch #18737.**
2. **mcpHQ/awesome-mcp-servers** — JSON catalog (`data/servers.json`), schema in `data/servers.schema.json`; required fields name/url/description/category/language/provider/tags/official; optional fields (license, pricing, transport, install, auth, verified) only when verifiable; **agents must insert at a random middle position, never append**; `npm run validate` / `generate` / `check-generated` must pass; reviewed Sunday/Wednesday/Friday. **Owner action: if CI fails on #695, run `npm run validate` locally and fix; also consider renaming the auto-suffixed fork `theluckystrike/awesome-mcp-servers-9`.**
3. **punkpeye/awesome-remote-mcp-servers** — requires a real **Glama connector** listing + badge and a public endpoint that answers MCP initialize without credentials (CI handshake check). Verified: all 8 candidate zovo.one servers return "This MCP connector is not listed" at glama.ai. **Owner action: (a) submit servers to Glama as connectors and get listings live; (b) enable credential-free initialize/handshake tier on mcp.zovo.one endpoints.** Until both are done, this list (and similar Glama-gated lists) is closed to us.
4. **wong2/awesome-mcp-servers** — does NOT accept entry PRs; README is generated from the mcpservers.org dataset. **Owner action: submit at mcpservers.org/submit.**
5. **modelcontextprotocol/servers (official)** — closed to third-party additions; maintainers-only. **No path. Stop trying.**
6. **AIAnytime/Awesome-MCP-Servers** — JSON-per-server PRs (one server per PR) are accepted and our format precedent exists (merged PR #83), but forking is currently impossible: GitHub fork names are case-insensitive per account, and `theluckystrike/awesome-mcp-servers` (punkpeye fork) shadows `AIAnytime/Awesome-MCP-Servers` — a fork request silently redirects and pushes land on the wrong repo (I cleaned up the stray branch). **Owner action: rename the punkpeye fork to e.g. `awesome-mcp-servers-punkpeye`, then fork AIAnytime and add `servers/mcp-price-tracker.json` + `servers/mcp-time-tracker.json`.**
7. **MobinX/awesome-mcp-servers, abordage/awesome-mcp-servers** — repos no longer exist (renamed/deleted). No path; do not re-attempt without re-checking.

## Key correction to prior intel
The r6 snapshot claimed merged PRs at MobinX #420, abordage #106, mcpHQ #62 and 8 live Glama connector listings. Ground truth via gh/glama: none of those PRs exist under theluckystrike; no Glama connector listings exist. Only AIAnytime #83 (merged) and DhanushNehru #95 (open) are real.
