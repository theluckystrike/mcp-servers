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

---

## Addendum (parent session, 2026-10-12, post-deploy reconciliation)

Registry distribution pass executed after the llms.txt deploy:

- Full registry publish run: 122 duplicates + 1 published (delivery-schedule@0.22.6).
- Per-name /versions/latest audit found 41 STALE + 1 HTTP-404 manifests. All fixed by re-publishing
  (root causes: local manifests lagging registry versions, one variant manifest stuck on the
  reserved `server.variant.json` filename — renamed to `server.template.json` and activated;
  delivery-schedule had a manifest-declared v0.22.5 asset URL that 404'd — repointed to the
  public v0.22.0 asset and bumped to 0.22.6).
- Final audit: every checked name returns OK at its manifest version (0 stale, 0 missing).
- KPI `raw.registry` now covers 149 names (was 121); "Registry entries at latest version" = 108.
- IndexNow pinged all 287 storefront URLs (accepted 287, failed 0) — includes the 47 /mcp/ pages.
- Live surface check: llms.txt / sitemap.xml / robots.txt all 200 post-deploy.
- Commit: 8448dcd0.
