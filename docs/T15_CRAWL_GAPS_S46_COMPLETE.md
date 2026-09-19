# T15 CRAWL GAPS — SPRINT 46 COMPLETE (2026-09-19, loop 40)

All five fixes shipped, tested, deployed, live-verified. Tests 164/0. Honesty gate 154.

## Fix status (all LIVE)
- #1 priority-guide nav: `<nav class="pg">` first element after `<body>` on every page,
  10 measured top guides by 7d traffic. Regenerator: scripts/gen-priority-guides.mjs.
- #2 cluster-sibling mesh: AUDITED COMPLETE — GUIDE_RELATED is 109/109 symmetric, zero
  asymmetric edges. Nothing to add.
- #3 footer hub links: sitewide footer (home/guides/setup/compare/changelog).
- #4 featured-servers strip: `<p class="feat">Popular servers: …</p>` at top of all 109
  guide pages, top-8 human-verified /s/ pages, deduped against the guide's own cross
  block. Regenerator: scripts/gen-featured-servers.mjs.
- #5 sitemap lastmod: RELEASE_V0230.md → lastmod 2026-09-19 on all 193 URLs.

## Deploys this fix set
65918e11 (lastmod) → f35eb76b (fix #1) → daf69205 (fix #4). Commits 3913f8d5, 5faf976f,
57ac4dc1. IndexNow 193/193 accepted after each deploy.

## 72h re-crawl measurement (window ended 2026-09-19T03:24Z, vs 09-18 baseline)
Baseline (b950b967, window ended 09-18T23:57) → now:
- Googlebot 15/193 (7.8%) → 15/193 (7.8%) — FLAT (window barely moved; next read due
  09-21+ is the decisive one)
- bingbot 3/193 → 3/193 — flat
- GPTBot 15 → 15 flat; ClaudeBot 28 → 28 flat; PerplexityBot 9 → 9 flat
- Largest crawlers by coverage: Amazonbot 93.3%, Barkrowler 83.9%, DotBot 76.2%,
  SemrushBot 73.1%, meta-externalagent 52.8%
- Googlebot's 15 fetched URLs include guide pages (mcp-server-not-showing-up,
  mcp-server-free-vs-pro) — the guide-content strategy is what Googlebot reads when it
  comes at all.

## Registry census (2026-09-19, loop 40)
Official MCP registry: 126 distinct io.github.theluckystrike/* names, 15 cursor pages
(cursor pagination, limit=100). All estate servers present. Glama API probe returns 401
(browser page check remains the method; glama lag noted in distribution.json).

## Honest read
The 72h window closed with zero movement in search-engine bot coverage. Internal-link
fan-in and sitemap fixes are necessary but not sufficient — the gap is likely crawl
budget/priority signals that only GSC verification (blocked, human-gated) or external
backlinks can move. mcp.so $39 listing is the one paid lever with a DR-72 dofollow.
