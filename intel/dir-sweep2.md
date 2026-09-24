# Non-GitHub MCP Directory Submission Sweep (dir-sweep2)

**Date:** 2026-09-24
**Estate:** theluckystrike / mcp-servers
**Repo:** https://github.com/theluckystrike/mcp-servers
**Site:** https://mcp.zovo.one
**Flagship servers (5):** invoice-generator, price-tracker, time-tracker, backlink-checker, pdf-merger
**Hosted form:** https://mcp.zovo.one/mcp/<name>

## Summary Table

| Directory | Submission path used | Status |
|-----------|---------------------|--------|
| mcp.so | https://mcp.so/submit | skipped: paid listing only ($39 one-time, no free tier) |
| Smithery (smithery.ai) | https://smithery.ai/new | skipped: human-gated (GitHub OAuth sign-in / service token required) |
| PulseMCP (pulsemcp.com) | https://pulsemcp.com/submit | skipped: submissions paused since 2026-09-03 |
| mcpservers.org | https://mcpservers.org/submit | skipped: human-gated (Cloudflare bot challenge + manual web form, email + 2-wk review) |
| mcpmarket.com | https://mcpmarket.com/submit | skipped: human-gated (account sign-in required) |
| cursor.directory | https://cursor.directory/plugins/new | skipped: human-gated (GitHub sign-in required) |

## Evidence per directory

### mcp.so — skipped: paid listing only
- /submit offers only a paid one-time $39 listing (no free tier). No free submission path exists.
- Rule: no paid listings -> skipped.

### Smithery (smithery.ai) — skipped: human-gated
- Real publish path is https://smithery.ai/new (enter public HTTPS URL) or CLI/API
  (`smithery mcp publish`, `PUT /servers/{ns}/{server}`, `POST .../releases`).
- ALL paths require an authenticated namespace: GitHub OAuth sign-in at smithery.ai/new,
  or a service token for the CLI/API. No credential available in this session.
- Rule: no account creation/sign-in -> skipped: human-gated.

### PulseMCP (pulsemcp.com) — skipped: submissions paused
- /submit page states submissions and changes are temporarily paused (last updated
  2026-09-03) and directs users to the Official MCP Registry. Site also behind reCAPTCHA.
- No active free submission path -> skipped.

### mcpservers.org — skipped: human-gated
- This is the punkpeye/awesome-mcp-servers directory. Its GitHub README explicitly says
  "Please submit your MCP on the website: https://mcpservers.org/submit" (no PR path).
- /submit is a free $0 form (name, category, description, repo/website, contact email,
  remote flag) with review within 2 weeks. It is a TanStack Start server-function form.
- Site is protected by a Cloudflare JS challenge (`/cdn-cgi/challenge-platform/scripts/jsd/main.js`);
  browser navigation to /submit timed out on the challenge. Automated POST is blocked.
- Manual form requires a contact email and human review -> effectively human-gated.
- Rule: no browser sign-in / bot-protected manual form -> skipped: human-gated.

### mcpmarket.com — skipped: human-gated
- /submit offers a free queue ($0, avg 4-6 wk) vs paid $29. Free queue requires a GitHub
  repo URL.
- Submit page HTML contains auth/signin/login elements -> account sign-in required to submit.
- Rule: no account creation/sign-in -> skipped: human-gated.

### cursor.directory — skipped: human-gated
- /contribute is 404. Real submission path is https://cursor.directory/plugins/new which
  requires Sign In (GitHub login) before the form is usable.
- Rule: no account creation/sign-in -> skipped: human-gated.

## Outcome
No directory in this sweep offered a free, non-account-gated, non-bot-protected submission
path that could be completed programmatically. All 6 were recorded as skipped with reasons.
The 5 estate servers (invoice-generator, price-tracker, time-tracker, backlink-checker,
pdf-merger) were NOT submitted to any of these 6 directories this pass.

STATUS: complete — 0 submitted, 6 skipped (2 paid/paused, 4 human-gated)
