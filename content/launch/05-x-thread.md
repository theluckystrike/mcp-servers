# X thread — 8 posts

## Post 1

I built 58 MCP servers for document work: PDFs, spreadsheets, invoices, quotes, ZIPs, images, bank statements, amortisation, currency. 45 run as hosted remote endpoints — no install, one config URL. Code: https://github.com/theluckystrike/mcp-servers

## Post 2

Why hosted endpoints? Because document tooling is miserable to install locally — binary deps, file handling. With a remote URL you paste one line into Claude or Cursor and the tools just appear in your assistant.

## Post 3

Example config (Cursor or Claude Desktop):

"mcpServers": {
  "pdf-tools": {
    "url": "https://mcp.zovo.one/mcp/pdf-tools"
  }
}

Save, restart, done.

## Post 4

Verification matters, so there are two layers: 1,816 unit tests pass across the repo, and 1,254 live validation checks pass against the actual hosted endpoints. Not just "code exists" — the endpoints get exercised.

## Post 5

I also ran a blind test: wrote 18 capability questions like real user needs and searched them. 9 of 18 answers named this estate. Encouraging, and a reminder the other half of the time people find something else first.

## Post 6

The honest numbers: last 28 days — 38 Google impressions, 0 clicks, 0 paid customers. Building in public means publishing the numbers that sting, not just the ones that flatter.

## Post 7

46 of the servers have a checkout at https://mcp.zovo.one — $19 each or a $39 lifetime bundle for everything. Free ones exist too. The blind test and search data cost nothing to run and taught me more than any ad spend could.

## Post 8

If you wire one into your assistant, tell me how it went — good or broken. Distribution is the hard part and I'm learning it in public: https://mcp.zovo.one
