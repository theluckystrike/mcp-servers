# outreach_drafts_r8.md — 5 held outreach posts (DRAFTS ONLY — do not post)
DATE: 2026-09-22 | STATUS: shipped | Rule: nothing posted autonomously; paste-ready, honest, no astroturf.

## 1. Reddit r/mcp (title + body)
**Title:** I built 47 free business MCP servers (invoices, expenses, time tracking, PDFs) — remote, no install
**Body:** I run a one-person freelance operation and wanted my AI assistant to handle the admin work directly in chat, so I built a suite of MCP servers for it — and now host them free for anyone to use. 47 servers covering invoices, expense tracking, time tracking, kanban, PDF tools, DOCX generation, purchase requisitions, dunning letters, petty cash, and more. All remote streamable-http endpoints at mcp.zovo.one — add one URL to your client config, no npm install, no local process. Free tier covers normal freelancer usage; higher limits are paid if you need them. Repo with per-server docs: https://github.com/theluckystrike/mcp-servers. Happy to take requests for the next batch — what admin task do you wish your assistant could do?

## 2. Hacker News (Show HN)
**Title:** Show HN: 47 free remote MCP servers for business admin (invoices, expenses, PDFs)
**Body:** After years of freelancing I noticed the same admin chores eat the first hour of every day: invoices, expense logging, timesheets, follow-up letters. So I built a fleet of MCP servers so an AI assistant can do them conversationally, and host all 47 free at mcp.zovo.one. Each server is a remote streamable-http endpoint — no install, no API keys on your machine, works with Claude and any MCP client. Full source on GitHub: https://github.com/theluckystrike/mcp-servers. Technical notes: 425 tools total, deployed as Cloudflare Workers, usage-metered with a free tier. Ask me anything about the architecture or the tool design choices.

## 3. X thread (5 tweets)
**T1:** I gave my AI assistant the boring half of my freelance business: invoices, expenses, timesheets, dunning letters. Here's how — 47 free MCP servers, no install: mcp.zovo.one
**T2:** Every server is a remote endpoint. Add one URL to your MCP client and ask "invoice Acme for 12 hours of design work" — it's done. 425 tools total.
**T3:** Highlights: invoice (PDF invoices from chat), expense-tracker (log + categorize), time-tracker (timers + reports), pdf (merge/split/fill), docx, kanban, petty-cash, purchase-requisition.
**T4:** All free for normal freelancer usage. Source: github.com/theluckystrike/mcp-servers. Works with Claude and any MCP client.
**T5:** Next batch being planned — dunning-letters and delivery-schedule are new this month. Requests welcome.

## 4. dev.to article outline
**Title:** "I Automated My Freelance Admin with 47 MCP Servers (Here's the Setup)"
- Intro: the admin tax on solo freelancers (~1hr/day) and why chat is the right interface.
- What MCP is in 3 sentences, for people who know Claude but not MCP.
- Architecture: remote streamable-http endpoints vs local stdio servers; why no-install matters for non-devs.
- Walkthrough: connecting one server (screenshots of client config), then a real session: "log 3 hours for Acme, add the Figma subscription to expenses, invoice Acme for both."
- Server tour table: the 8 most-used of the 47, with tool names.
- Free tier + limits explained honestly; link to mcp.zovo.one and GitHub.
- CTA: request new servers in comments.

## 5. Discord MCP community post
**Post:** Hey all — I host 47 free business-admin MCP servers at mcp.zovo.one (invoices, expenses, time tracking, kanban, PDF/DOCX tools, etc. — 425 tools total). All remote streamable-http, so no install: paste the endpoint URL into your MCP client and go. Free tier for everyday use; source at github.com/theluckystrike/mcp-servers. Looking for feedback on tool ergonomics — especially the invoice and time-tracker servers. What would make these more useful in your workflows?
