# s20261012 — LLM Findability Upgrade for mcp.zovo.one

STATUS: partial (llms.txt Use-when live; agent budget exhausted before final polish pass)

## Goal
Make mcp.zovo.one maximally findable by AI crawlers and assistants: audit/upgrade llms.txt, verify AI-crawler access, deploy.

## Checklist
- [ ] Fetch live https://mcp.zovo.one/llms.txt — audit coverage (54 servers, value props, links)
- [ ] Locate llms.txt/robots.txt handlers in billing/src/index.js
- [ ] Fetch robots.txt — confirm GPTBot, ClaudeBot, Claude-Web, PerplexityBot, Google-Extended, CCBot, Bytespider not blocked
- [ ] Probe /llms.txt + 3 per-server pages with ClaudeBot/GPTBot UAs — 200 + real text (not JS shell)
- [ ] Upgrade llms.txt: per-server "Use when..." entries, bundle line, hosted endpoint URLs
- [ ] node --test green, deploy, curl-verify live
- [ ] Commit 'R-s20261012: ...'

## Evidence
- Live llms.txt audit (pre-deploy): 260 lines; header claims 54 servers / 46 hosted — matches figures.js (LISTED_IDS=54, HOSTED_IDS=46). All 54 `/s/<id>` page links present, 46 hosted `/mcp/<id>/t/<token>` URLs, bundle line + hand-written office-suite line present, llms.txt-spec header (H1 + blockquote + sections).
- GAP: zero "Use when:" task-phrasing anywhere in live llms.txt (grep=0). Blind-recommendation R1–R7 scored 0/18 — assistants pick servers from task phrasing.
- robots.txt live: `User-agent: *` + `Allow: /` — none of GPTBot/ClaudeBot/Claude-Web/PerplexityBot/Google-Extended/CCBot/Bytespider blocked; sitemap declared; but no explicit AI-crawler groups.
- Fix: `LLM_USE_WHEN` map (54 entries) added to billing/src/index.js; wired into /llms.txt lines (after tagline) and /llms-full.txt sections; robots.txt now names the 8 AI crawler groups (7 required + anthropic-ai) restating identical Allow/Disallow + Sitemap with an llms.txt pointer comment.
