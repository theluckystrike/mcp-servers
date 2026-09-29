# R7 — Organic-search state for mcp.zovo.one

**STATUS: in progress**

## Sections
1. Fresh GSC Search Analytics (28d, page dimension) + urlInspection verdicts on key /s/ pages
2. Live sitemap audit (URL count + 5 content spot-checks)
3. robots.txt / llms.txt / feed
4. Crawler logs (Googlebot / ClaudeBot) vs 12/32 baselines
5. Highest-leverage executable SEO fix — implemented + verified
6. Appendix: raw commands + outputs

## Current baseline (from prior run, data/gsc.json)
- mcp.zovo.one 28d: 19 impressions, 0 clicks, 1 page (`https://mcp.zovo.one/`), position 3.1
- Googlebot covers 12 sitemap URLs / 7d; ClaudeBot 32 / 7d
- Sitemap was 235 URLs (cut from 312; permutations noindex,follow)

## Measured (2026-09-29, orchestrator-run via scripts/traffic.mjs + /tmp/gsc_mcp_r7.mjs)
- GSC sc-domain:zovo.one (28d final): 57 clicks / 4,435 impressions overall; mcp.zovo.one
  host-probe: 20 impressions / 0 clicks / 9 days with impressions; top query "site:zovo.one"
  (9 impr, pos 2.7) - vanity query, no real queries yet.
- Direct GSC URL-prefix query for mcp.zovo.one: 0 impressions 28d (filtered diff vs
  host-probe is window/dataState).
- Crawler URL coverage / 7d (Cloudflare, 237-URL sitemap): Googlebot 2 URLs (0.8%),
  ClaudeBot 34 (14.3%), PerplexityBot 8, Bytespider 42. Googlebot remains the choke
  point - 2 URLs fetched despite 24+ dofollow backlinks; classic new-host quality gate,
  matches S361 finding on tg.zovo.one.
- Highest-leverage executable fix available today: none code-side that we have not done
  (sitemap clean, noindex permutations, IndexNow key correct). The lever is external
  authority - the 12 open awesome-list PRs and mcpservers.org review wave landing is
  what moves Googlebot.
