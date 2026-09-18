# T3 Platform Recheck — S45

STATUS: complete

## Task
Recheck external listing statuses for blocked platform listings.

## Checks
1. mcp.so issues #4227, #4228 (chatmcp/mcpso) + listing presence
2. MCP Playground (mcpplaygroundonline.com)
3. Glama (glama.ai/mcp/servers)
4. mcpmux PR #300
5. Bing coverage of mcp.zovo.one

## Status Table

| Platform | Probe URL | Result | Positive Control | Verdict |
|----------|-----------|--------|------------------|---------|
| mcp.so issue #4227 | github.com/chatmcp/mcpso/issues/4227 | OPEN, 0 comments | n/a (GH API 200) | pending |
| mcp.so issue #4228 | github.com/chatmcp/mcpso/issues/4228 | OPEN, 0 comments | n/a (GH API 200) | pending |
| mcp.so listing | https://mcp.so/server/mcp-invoice | HTTP 404; search?q=zovo = **0 results**, servers=[] | modelcontextprotocol search = 5137 results | not-listed |
| MCP Playground | mcpplaygroundonline.com | registry `/mcp-registry` search `zovo`=0, `invoice`=0 zovo/luckystrike (26 unrelated invoice servers); `/mcp-servers` curated 75 | search `supabase`=multiple (Supabase, smithery, waystation) | not-listed |
| Bing | bing.com/search?q=site:mcp.zovo.one | site: operator unreliable (returns football/BFC results, b_no). Phrase `"mcp.zovo.one"` → **73 results** indexing references (github, mcpservers.org, lobehub, getrank) | modelcontextprotocol site: also returns 0 via curl (operator fails) | indexed (references) |
| Bing mcp.zovo.one itself | `"mcp.zovo.one"` phrase | 73 results, incl. mcpso #4228, theluckystrike repos, mcpservers.org, lobehub, getrank.top | n/a | indexed |
| mcpmux PR #300 | mcpmux/mcp-servers | OPEN, MERGEABLE, 0 comments | n/a (GH API 200) | pending |
| Glama invoice | glama.ai/mcp/servers/theluckystrike/mcp-invoice | HTTP 404 | modelcontextprotocol/servers = 200 | not-listed |
| Glama spreadsheet | glama.ai/mcp/servers/theluckystrike/mcp-spreadsheet | HTTP 404 | modelcontextprotocol/servers = 200 | not-listed |
| Glama bank-statement | glama.ai/mcp/servers/theluckystrike/mcp-bank-statement | HTTP 404 | modelcontextprotocol/servers = 200 | not-listed |
| MCP Playground | mcpplaygroundonline.com/?s=invoice | page 200 (review-gated, listing unclear) | homepage 200 | _checking_ |

## Evidence
- 4227 `[Submit] theluckystrike hosted business-document MCP servers (invoice, bill-of-sale, credit-note + 39 more)` — OPEN, 0 comments
- 4228 `[Submit] more hosted business-document MCP servers: packing-list, dunning-letters, service-agreement, job-card` — OPEN, 0 comments
- mcp.so /server/mcp-invoice → 404; mcp.so /search?q=zovo → 200 (content still to inspect)
