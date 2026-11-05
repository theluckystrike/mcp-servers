# r/ClaudeAI post

## Title

No-install MCP for Claude: 45 hosted document servers you add with one config URL (PDFs, spreadsheets, invoices, and more)

## Body

If you use Claude and keep hitting "the model can't touch my files" — I built something for exactly that: a set of MCP servers for document work, and 45 of them run as hosted remote endpoints, so there is nothing to install.

Add the server to your MCP client config with its remote URL and Claude can immediately work with:

- PDFs — split, merge, extract, manipulate
- Spreadsheets — read, edit, build Excel files
- Invoices, quotes, and bank statements
- ZIP archives, images
- Time tracking, amortisation schedules, currency conversion

58 servers in total; 45 are hosted, the other 13 run locally from npm. All the code is open on GitHub: https://github.com/theluckystrike/mcp-servers

Honesty section, because I think it matters: 1,816 unit tests and 1,254 live validation checks pass across the estate. 46 of the servers are paid at $19 each or $39 lifetime for the bundle (https://mcp.zovo.one). And the traffic reality: 38 Google impressions, 0 clicks, 0 customers so far — I'm building this in public, discoverability included.

If you add one and it does (or doesn't) work in Claude, I want to hear it. Which document task do you most want your assistant to handle?
