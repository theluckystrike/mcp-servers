# r/mcp post

## Title

58 MCP servers for document/office workflows — 45 hosted remote, 1,816 unit tests + 1,254 live checks passing, free to connect

## Body

I've published a set of MCP servers aimed at document and office tasks: invoices, quotes, spreadsheets, PDFs, ZIPs, images, time tracking, amortisation, bank statements, currency conversion.

Quick facts:

- 58 servers, all on npm and GitHub: https://github.com/theluckystrike/mcp-servers
- 45 have hosted remote endpoints — add one URL to your config and they work in Claude/Cursor with no install
- The other 13 run locally via npm
- 1,816 unit tests pass; 1,254 live validation checks pass against the hosted endpoints
- 46 servers have a checkout at https://mcp.zovo.one — $19 each or a $39 lifetime bundle

Why hosted endpoints: a lot of document tooling is awkward to run locally (binary deps, file handling). With the remote endpoints you paste a URL into your MCP client config and the tool calls go straight to the hosted service. Full transparency: 46 of the 58 are paid ($19 each, or $39 lifetime for all of them), the rest are free to use.

I also ran a small blind discoverability test: 18 capability questions phrased like real user needs, searched them, and 9 of 18 results named this estate. And for honesty, my current numbers are 38 Google impressions and 0 clicks in 28 days, with 0 paid customers. Distribution is the problem I'm working on, not the code.

If you try one, tell me which and how the config went. Repo: https://github.com/theluckystrike/mcp-servers — issues welcome.
