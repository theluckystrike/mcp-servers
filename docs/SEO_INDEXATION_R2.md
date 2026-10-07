# SEO Indexation R2 — mcp.zovo.one (2026-10-07)

## Verdict
Google's 2/237 indexation on mcp.zovo.one is a **crawl-budget/discovery problem, not a content problem**. Evidence below; one fix shipped this round.

## Evidence
- GSC 28d: mcp.zovo.one = 0 clicks / 22 impressions / **2 indexed pages** (home pos ~3, /mcp/time-tracker). Control zovo.one = 47 clicks / 5,347 impressions / 364 pages.
- **URL Inspection API** (new tool `scripts/gsc_inspect_r3.py`, read-only JWT) on 5 sample URLs:
  - `/guides/track-time-in-claude-code`, `/s/time-tracker` → "URL is unknown to Google"
  - `/compare/time-tracker`, `/setup/claude-desktop`, `/suites/freelancer` → "Discovered — currently not indexed"
- Live probes: all sampled page classes return 200, server-rendered HTML, self-canonical, no noindex, clean robots.txt (only /buy|/success|/recover|/verify|/bound disallowed), dense internal linking.
- Root cause: Google knows the URLs (sitemap submitted, IndexNow 237/237 accepted HTTP 200) but has crawled almost none — classic low-authority-host scheduling. The only inbound link from zovo.one was a single footer link; the 2 indexed pages were reached through it.

## Fix shipped (2026-10-07)
**Contextual links from zovo.one authority pages → mcp.zovo.one**, in `~/zovo-workspaces/zovo-one-source`:
- `src/pages/AllExtensions.tsx` — paragraph after extension list
- `src/pages/BestHub.tsx` — footer area
- `src/pages/AlternativesHub.tsx` — above HubCrossLinks

Each links to https://mcp.zovo.one/ plus deep links to `/s/invoice` and `/s/time-tracker` (top-converting product pages per payment map).

Deployed: commit `a3f6b0a8` pushed to origin main (repo = extension-insiders; rebased on 73a20ea3, sitemap.xml conflict taken theirs). Build clean (`npm run build` exit 0; esbuild parse checks passed on all 3 files). Vercel auto-deploy.

## Next session
1. IndexNow-ping the 3 changed zovo.one pages once deploy verified.
2. Enrich `/s/<server>` pages with `payment_map.json` one_line_value_prop content — deferred; content is not the current blocker since Google hasn't crawled them.
3. Re-run URL Inspection on /s/time-tracker + 2 guides in 7–14 days to measure crawl pickup.
4. Only if pickup stays flat: consolidate the 33 compare pages.

## New reusable tool
`scripts/gsc_inspect_r3.py` — GSC URL Inspection API via read-only JWT (same auth as `gsc_pull_r3.py`).

Data: `data/organic_r3_gsc.json` (GSC pull), `data/organic_r3.json` (final round record).
