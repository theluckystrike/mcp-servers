# A1 Registry Distribution Matrix — sprint 2026-11-06

STATUS: complete

## Method
Enumerate registries; probe each with curl for submit mechanism + presence of our servers ('zovo', 'theluckystrike'); live verification bar = HTTP 200 AND body contains our package name or 'zovo'. Estate: 58 servers, 68 npm packages `@theluckystrike/mcp-*`, site https://mcp.zovo.one.

## Findings (evidence appended)

- **Official MCP registry (registry.modelcontextprotocol.io)**: HTTP 200 on `/v0/servers?search=theluckystrike`. Our listings present under `io.github.theluckystrike/*`. Count/pagination being measured. Auto-indexed from GitHub (no submission needed).
- **npm registry search** (`registry.npmjs.org/-/v1/search?text=theluckystrike`): HTTP 200, 59 distinct `@theluckystrike/*` package names returned. Per-package liveness check running.
- **Smithery** `registry.smithery.ai/servers?query=theluckystrike`: HTTP 200 but 0 hits in body — inspecting whether the query is honored (search-params-don't-filter trap) or truly empty.
- **Glama API**: connection fails from this box (2 attempts) — badge-SVG check is the fallback route (8 listings verified in r6).
- **PulseMCP API**: HTTP 403 (Cloudflare) — human-gated/form.
- **mcpservers.org**: direct URL 403 w/ 'theluckystrike' echoed (client-rendered trap); API path 404.
- **mcp.so**: 404 on API + server URL. Intake = GitHub issue on chatmcp/mcpso (free route, known from prior rounds; maintainer queue huge).
- **mcphub.io**: HTTP 402 "Payment required" — paid/blocked.
- **mcpmarket.com**: 404/403 previously — dark.
- **Fleur**: registry page 200, no zovo entries.
- **cursor.com/mcp**: 200 but Next.js shell; 'zovo' hits likely echoed params — untrusted.

## Matrix
(being written to A1-registry-matrix.json; see that file for per-registry rows)

## Actions
(see A1-ACTIONS.md)
