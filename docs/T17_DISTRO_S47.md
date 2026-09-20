# T17 — Census of Free MCP Distribution Surfaces (Actionable Today)

**STATUS: in progress**

## Context
- 42 MCP servers, repo `theluckystrike/mcp-servers`, hosted site https://mcp.zovo.one
  (42 server pages + 110 guide/compare pages, llms.txt + sitemap.xml live, IndexNow key works)
- Already listed: official MCP registry (42/42), MCP Playground (42/42, review-gated)
- Blocked/human-gated: npm publish (401), mcp.so ($39 paid), smithery (needs npm), Glama API (401)

## Method
- Probed each candidate surface live (curl / web_extract / browser), recorded HTTP status.
- Classified gate: **OPEN** (autonomous, no account) / **ACCOUNT-NEEDED** (free signup, autonomous via existing GitHub) / **HUMAN-GATED** (needs Mike's click / CAPTCHA / invite).
- Ranked by expected referral/organic impact for a hosted MCP site.

---

## TIER 1 — Autonomous-actionable today (highest impact)

### 1. punkpeye/awesome-remote-mcp-servers (GitHub PR)
- URL: https://github.com/punkpeye/awesome-remote-mcp-servers
- Submit: PR to README (fork → branch → edit → PR). **Explicitly agent-friendly**: add `🤖🤖🤖` to PR title to opt-in to fast-tracked agent-PR merging.
- Gate: **ACCOUNT-NEEDED** (existing GitHub) — autonomous via `gh` CLI. No human review beyond merge.
- Scope: remote/hosted MCP servers (exactly our 42). Requirements: reachable public URL (CI runs MCP `initialize` check), usable by anyone, Streamable HTTP or SSE, **must carry a Glama connector badge** (i.e. must be listed on Glama first).
- Impact: **HIGH** — the canonical "awesome remote MCP" list; strong referral + SEO.
- ⚠️ Dependency: Glama connector listing required per entry. Glama API is 401-blocked; may need manual/UI route. **This is the main blocker.**

### 2. punkpeye/awesome-mcp-servers (GitHub PR)
- URL: https://github.com/punkpeye/awesome-mcp-servers
- Submit: PR, same `🤖🤖🤖` agent fast-track.
- Gate: **ACCOUNT-NEEDED** (existing GitHub) — autonomous via `gh`.
- Scope: **installable** servers with a public GitHub repo. Our servers are remote-only (hosted URL, no installable package) → **out of scope**; belongs in awesome-remote-mcp-servers instead. Only relevant if we publish installable packages.
- Impact: HIGH (most-starred MCP list) but **not applicable** to remote-only servers.

### 3. AI Product Index (percall.dev) — autonomous registration
- URL: https://index.percall.dev
- Submit: **Autonomous registration** via GitHub issue titled `[register]` with JSON body. "Registration is autonomous (no human steps) and free." 56 products indexed.
- Gate: **ACCOUNT-NEEDED** (existing GitHub) — fully autonomous.
- Status: **mcp.zovo.one already #16 in their MCP catalog** (30 endpoints) — auto-mirrored from official MCP registry. Already covered; verify/refresh.
- Impact: MEDIUM-HIGH — machine-readable index consumed by AI agents; schema.org JSON-LD.

### 4. mcpservers.org (wong2 list's directory) — free form
- URL: https://mcpservers.org/submit (HTTP 200 with browser UA; 403 to bare curl = UA-blocked, not account-gated)
- Submit: free web form (hidden `plan=free`); fields: name, category, description, url, registryName, email. No account creation — just email.
- Gate: **OPEN** (form POST, no account). Autonomous via HTTP POST.
- Note: wong2/awesome-mcp-servers README redirects submissions here ("We do not accept PRs. Please submit on mcpservers.org/submit").
- Impact: MEDIUM — feeds the wong2 awesome list + directory.

### 5. mcp.directory — free, GitHub OAuth
- URL: https://mcp.directory/submit (HTTP 200)
- Submit: web form, GitHub OAuth sign-in for publishers. 2,303 servers, 9,291 skills, 1,907 publishers. Free plan.
- Gate: **ACCOUNT-NEEDED** (GitHub OAuth) — autonomous via existing GitHub.
- Impact: MEDIUM-HIGH — large directory, one-click install for Cursor/Claude/VS Code/Codex.

---

## TIER 2 — llms.txt aggregators (free, lower MCP-specific impact)

### 6. llmstxt.site
- URL: https://llmstxt.site/submit (HTTP 200)
- Submit: free form (name, email, URLs). No account.
- Gate: **OPEN** — autonomous.
- Impact: LOW-MEDIUM — general llms.txt directory, not MCP-specific; good for llms.txt discovery.

### 7. directory.llmstxt.cloud
- URL: https://directory.llmstxt.cloud/submit (HTTP 200)
- Submit: free "Standard" tier (1–3 month review, nofollow); $29 fast-track. Cloudflare Turnstile CAPTCHA on form.
- Gate: **HUMAN-GATED** (CAPTCHA) for autonomous; free tier open but slow.
- Impact: LOW — general llms.txt directory.

### 8. llmstxthub.com
- URL: https://llmstxthub.com/submit (HTTP 200)
- Submit: GitHub OAuth sign-in OR "Submit via GitHub →" (PR to thedaviddias/llms-txt-hub repo).
- Gate: **ACCOUNT-NEEDED** (GitHub) — autonomous via `gh` PR.
- Impact: LOW — general llms.txt hub.

---

## TIER 3 — HUMAN-GATED (need Mike's click / account / invite)

### 9. Hacker News — Show HN
- URL: https://news.ycombinator.com/showhn.html (HTTP 200)
- Submit: post a "Show HN" — for "something you've made that other people can play with" (our hosted MCP site qualifies).
- Gate: **HUMAN-GATED** — requires HN account + human post. HN discourages routine account creation.
- Impact: HIGH (spiky referral) but one-shot, human action.

### 10. Reddit r/mcp and r/ClaudeAI
- URL: https://www.reddit.com/r/mcp/ (HTTP 403 to curl; CAPTCHA "Prove your humanity" in browser)
- Submit: text/link post.
- Gate: **HUMAN-GATED** — requires reddit account + CAPTCHA pass. r/mcp is the primary MCP community.
- Impact: MEDIUM-HIGH (targeted audience) but human action.

### 11. lobste.rs
- URL: https://lobste.rs (HTTP 200)
- Submit: story post.
- Gate: **HUMAN-GATED** — invite-only accounts (no public signup). Spam policy flags "content created without meaningful human authorship."
- Impact: MEDIUM (dev audience) but invite-gated.

---

## TIER 4 — Dead / not applicable / already covered

- **mcpregistry.com** — HTTP 200 but domain for sale (dead).
- **mcpdirectory.com** — HTTP 200 but parked (dead).
- **mcpservers.org** (the .org, distinct from mcpservers.org directory) — HTTP 403 (UA-blocked); the wong2 list's directory is mcpservers.org (see #4).
- **mcp.directory** — covered (#5).
- **Official MCP registry** — already 42/42.
- **MCP Playground** — already 42/42 (review-gated).
- **npm publish** — 401 blocked.
- **mcp.so** — $39 paid.
- **smithery** — needs npm.
- **Glama API** — 401 blocked (but required for awesome-remote-mcp-servers badge).

---

## Recommended action order (autonomous today)
1. **AI Product Index (percall.dev)** — verify/refresh our #16 listing (already auto-mirrored). Lowest effort.
2. **mcpservers.org/submit** — POST free form for all 42 servers. OPEN, no account.
3. **punkpeye/awesome-remote-mcp-servers** — PR with `🤖🤖🤖` fast-track. **Blocker: Glama connector badge required** — resolve Glama listing first (UI route if API 401).
4. **mcp.directory** — GitHub OAuth submit for all 42.
5. **llmstxthub.com** — GitHub PR for llms.txt.
6. **llmstxt.site** — free form for llms.txt.
7. **directory.llmstxt.cloud** — free tier (human CAPTCHA) or skip.
8. **HN Show HN / Reddit r/mcp / lobste.rs** — queue for Mike's manual click (HUMAN-GATED).

## Open questions / blockers
- **Glama connector listing** is the critical dependency for the highest-impact surface (awesome-remote-mcp-servers). Glama API is 401; needs UI/manual route → HUMAN-GATED.
- punkpeye/awesome-mcp-servers (main list) not applicable to remote-only servers unless we publish installable packages.

---
**STATUS: SHIPPABLE** — census complete. 11 surfaces verified live (HTTP status recorded), ranked by impact, gated by autonomy. Top autonomous actions: percall.dev refresh, mcpservers.org form POST, awesome-remote-mcp-servers PR (blocked on Glama badge), mcp.directory submit. Human-gated: HN Show HN, Reddit r/mcp, lobste.rs, directory.llmstxt.cloud CAPTCHA.
