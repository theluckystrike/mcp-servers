# S1105 shared brief (read fully before working)
Owner goal: money and organic traffic from the MCP estate. Revenue to date: $0. The one growing channel is Google traffic to
www.mcpstamp.com question pages. GSC (data/s1105/gsc_mcpstamp.json): impressions per day went 6 -> 143 over 10-30..11-04.
/can-claude/read-zip-files/ got 165 impressions at position 8; queries "can claude unzip files" pos 6.4, "can claude open zip" pos 6.
Answer pages that say honestly what the chat app cannot do alone, then name a real server that does it, rank fast.

Paths
- Site source: ~/mcp-site-2026-10-30/site (Astro). Page meta: site/src/data/pages.json (list). Page body: ~/mcp-site-2026-10-30/data/content/jobs.json {"jobs":{path:{...}}}
- Template: site/src/components/JobPage.astro (kind="answer"). Routes: site/src/pages/can-claude/[slug].astro and can-chatgpt/.
- Catalog of 58 servers and their tools: ~/mcp-servers/data/s1105/catalog_tools.txt (ids are the only valid "servers" values)
- Real Google autocomplete questions (2026-11-05, 1491 rows): ~/mcp-servers/data/s1105/suggest.txt
- Project rules: ~/mcp-servers/CLAUDE.md (traps section) and ~/mcp-servers/CONVENTIONS.md

Hard rules
- Do NOT edit pages.json, jobs.json or anything under site/ or repo/. Write only your own output file. The orchestrator merges and deploys.
- Do NOT push, deploy, publish to npm, or create accounts. Disk floor 20 GB (df -g /System/Volumes/Data); no builds unless your task says so.
- Every factual claim about Claude/ChatGPT/Cursor capability must be true as of Nov 2026; when unsure, state the narrower claim.
  A server claim must match a tool in catalog_tools.txt exactly. No invented numbers, no testimonials.
- Copy style: plain English, short sentences, singular I or neutral voice, no emoji, no em dash, no colon in body prose,
  no hype words (unlock, seamless, effortless, revolutionize, game-changer, leverage, robust, powerful). See ~/humanize-durable/HUMANIZE.md.
- Use /usr/bin/grep (grep is a broken shell function here).
