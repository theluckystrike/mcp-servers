# MCP Distribution Surfaces — Ranked Submission Plan (Oct 2026)

STATUS: complete (research summary, verified 2026-10-07)

## 1. Top 10 directory/review surfaces

| # | Surface | Submit URL / method | Automatable? | Status for our estate | Traffic notes |
|---|---------|--------------------|--------------|----------------------|---------------|
| 1 | **mcpservers.org** | mcpservers.org/submit (web form, free) | No — form + review (~2wk) | 65 submissions done (R28b/R31), last 7 confirmed 2026-09-28 | Established, high-traffic; referrals tracked in Search Console |
| 2 | **MCP Market (mcpmarket.com)** | mcpmarket.com/submit — paste GitHub repo URL | Form only; $29 instant / free queue 4–6wk | published/submitted | Claims 1M+ monthly visitors, 35K servers — largest claimed audience |
| 3 | **AllMCPs (allmcps.com)** | allmcps.com/submit (form, Cloudflare Turnstile) — **also has an "agent prompt" path + official `allmcps-server` MCP to submit/manage listings from an AI agent** | Yes, via MCP call or agent prompt; form is human-gated | Not yet submitted (local record: "human-gated") | 26,985 servers; self-reported 14.5k views / 25.6k AI reads; free listings nofollow, verified badge = dofollow |
| 4 | **Smithery** | `npx @smithery/cli mcp publish "<url>" -n org/repo --config-schema ...` — URL-based publish, picks up smithery.yaml; npm package NOT required for remote servers | CLI-driven but needs Smithery auth (account/API key) — human step | blocked (auth) | 100k+ tools/skills cataloged; major install surface |
| 5 | **PulseMCP** | pulsemcp.com/submit — **PAUSED since 2025-09-03**; picks up Official Registry automatically when reopened | N/A | blocked (paused) | 22,290+ servers, daily-updated; still a top SEO surface once reopened |
| 6 | **mcp.so** | mcp.so/submit → GitHub issue in their repo | Yes via `gh issue create` (no human web account needed beyond gh token) | Local record says "blocked: paid-only" — likely stale; free issue route exists, reconcile | 2.2M visits/12mo historically; strong SEO |
| 7 | **Glama** | Auto-indexed + glama.ai/mcp/reference API; quality grades drive ranking | No submission needed; improve repo metadata/licenses for A-grades | 8 real badges / partially indexed (3/10 sampled) | 97k servers indexed |
| 8 | **Official MCP Registry** | modelcontextprotocol/registry via mcp-publisher tool (reverse-DNS namespace, GitHub/domain ownership proof) | Already published | published | PulseMCP + others auto-ingest from here — highest leverage |
| 9 | **mcpmarketplace / hub surfaces** (mcpmarket.com/hub) | New 2026 "Hub" for managing skills/tools agents use | TBD | tracked (6 entries) | 2026-era aggregator trend |
| 10 | **Awesome-lists (punkpeye, abordage, mobinx, tensorblock…)** | git PR | Yes via gh CLI (already proven) | 4 merged PRs live; punkpeye backlog ~2220 open PRs (slow merge ~5-10/wk) | abordage: need ≥16 stars to appear in rendered README |

Blocked/skipped (do not retry): cursor.directory (login-gated), opentools.ai (Pro-gated), aiagentslist.com (paid), businessmcp.com (paid), mcp.directory (human-gated), mcp.pizza/mcpcentral.io/mcpindex.net/mcp-get.com (dead).

## 2. Five ranked organic distribution moves

1. **Smithery URL-based publish of all 54 servers** — `smithery mcp publish https://mcp.zovo.one/mcp/<id>` (one-time auth by Mike). Highest potential: Smithery is a top install surface and our remote endpoints fit its new URL-publish model perfectly. Requires: 1 human-authenticated CLI session.
2. **MCP Market free-queue submissions for all 54 repos** — free tier, 4–6wk lag, 1M+ claimed monthly visitors; form is simple (repo URL) so batch via browser automation with Mike's browser. Requires human web session (or $29/skip — not recommended at 54× cost).
3. **AllMCPs agent-path submission** — use the documented "agent prompt" / `allmcps-server` MCP to submit listings from the estate itself; includes hosted-endpoint field for mcp.zovo.one/mcp/<id>. Verified endpoint gets dofollow reciprocal links (SEO for mcp.zovo.one).
4. **mcp.so GitHub-issue route** — reconcile the stale "paid-only" record; `gh issue create` per server is curl/CLI-automatable, free.
5. **Organic stars campaign for abordage/awesome-lists visibility** — abordage needs ~16 stars to render in README (0-star repos cut); each new star re-includes 6 merged entries. Secondary: monitor PulseMCP reopen and punkpeye backlog (do not resubmit).

## 3. Human-account requirements

- **Requires human (Mike) accounts/actions:** Smithery CLI auth (1 session, then scriptable); MCP Market form (browser session); PulseMCP (paused — nothing to do); npm (NPM_TOKEN expired 2026-09-20 — highest-leverage manual unblock, still true).
- **Automatable via existing gh token:** mcp.so issue submission, awesome-list PRs, mcpservers.com sign-in flow (identified T14/S46, not listed yet).
- **Semi-automatable via MCP/agent path:** AllMCPs (official allmcps-server supports submit/manage listings from an agent).
- **No action needed:** Glama (auto), Official Registry (done), PulseMCP (paused but auto-ingests registry).

## Sources
- mcp.so, mcpservers.org/submit, mcpmarket.com/submit (form text), allmcps.com/submit (+ Turnstile + agent prompt), pulsemcp.com/submit (paused notice, dated 2025-09-03), glama.ai/mcp/reference (97,362 servers), Smithery CLI publish docs via kooexperience.com/blog/posts/create-mcp.html + tallyfy.com registry guide, dynomapper.com directory list, local census /Users/mike/mcp-servers/data/distribution.json (74 surfaces) + intel/dist-r30.md + intel/R7_DISTRIBUTION.md.
