# Show HN post

## Title

Show HN: 58 MCP servers for document workflows, 45 hosted with no install

## Body

I'm Michael Lip. Over the past months I've built a set of MCP (Model Context Protocol) servers focused on document and office work: invoices, quotes, spreadsheets, PDFs, ZIPs, images, time tracking, amortisation, bank statements, and currency conversion.

There are 58 servers in total, all published on npm and GitHub. 45 of them have hosted remote endpoints, so you can connect them in Claude or Cursor with a single config entry — no npm install, no local process. The other 13 run locally from npm.

46 of the servers have a paid tier at $19 each, or a $39 lifetime bundle for the whole estate: https://mcp.zovo.one

What each server does is verified two ways. There are 1,816 unit tests that pass across the repo, and separately 1,254 live validation checks that pass against the actual hosted endpoints. So when a server claims it can split a PDF or amortise a loan, that claim has been exercised against the live service, not just the code.

I also ran a blind test on discoverability. I wrote 18 capability questions — the kind of thing a person would type when they need a document tool done — and searched for them. 9 of the 18 answers named this estate. That's both encouraging and a reminder that half the time people still find something else first.

The honest numbers: in the last 28 days my site got 38 Google impressions and 0 clicks, and I have 0 paid customers so far. I'm posting here because writing code was the easy part; distribution is the part I'm now learning in public. The blind test and the search data are the most interesting things I've produced so far, and neither of them cost anything to run.

Try a hosted server: pick one from https://mcp.zovo.one, paste its remote URL into Claude or Cursor, and it works. Code is at https://github.com/theluckystrike/mcp-servers if you'd rather self-host from npm.

What I learned measuring: search engines currently send me essentially nothing — 38 impressions, 0 clicks in 28 days. Everything depends on people finding the tools directly. If you work with documents and an assistant, I'd genuinely like to know which of these you'd wire in first, and what's missing that would make you pick this over building your own.
