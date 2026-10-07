# DIST R30 — 2026-10-07

## PRs opened (2, both verified MERGEABLE via gh pr view)
1. ExMapo/awesome-productivity-mcp-servers PR #24 — Zovo Spreadsheet MCP in Data & Spreadsheets. MERGEABLE OPEN.
2. Albertchamberlain/Awesome-MCP PR #75 — statement-of-account entry in data/catalog.yaml (followed their schema + CONTRIBUTING). MERGEABLE OPEN.

## Skipped
- Sagargupta16/awesome-mcp-servers: existing fork of a same-named repo (punkpeye) blocks forking; ref creation 422.
- punkpeye/awesome-mcp-servers: 12 open PRs already; one-server-per-PR rule; backlog ~2220.

## Prior attempt (deleg_55ef9534 task-0) died at teardown ('I/O operation on closed file') — recon reused, PRs executed orchestrator-inline.

## Lesson
- gh api with `-f` via args list fails ("flag needs an argument") — pass JSON body with `-X POST --input -`.
- Fork name collision: one fork per (owner, reponame); repos named awesome-mcp-servers by different owners can't both be forked under the default name (GitHub auto-suffixes sometimes, 422 others).
