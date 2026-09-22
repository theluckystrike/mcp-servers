# R11 KPI pull — 2026-09-22

## GSC (sc-domain:zovo.one, 2026-08-25 → 2026-09-22)
- Total: 48 clicks / 2,848 impressions / CTR 1.7% / avg pos 17.4 (flat vs R8: 48/2848 — no GSC property change; mcp.zovo.one host: 0 clicks / 19 impressions on bare homepage only)
- Top page: zovo.one/ (41 clicks, 1116 impr — nearly all "zovo" brand queries)
- NO mcp.zovo.one deep page has any impressions yet. The /s/* pages are ~1 week old — too early.
- Queries containing "mcp": zero rows. Long-tail has not been picked up yet.
- Note: GSC service-account pull requires the Desktop key (~/Desktop/keys/gsc-sa-key.json). ~/.loop-creds copy gives "Invalid JWT Signature" (different key). traffic.mjs reports the Desktop key iCloud-dataless on first probe but node read works fine.

## Cloudflare 7d (scripts/traffic.mjs, data/traffic.json)
- 522,648 requests / 15,635 visits / 1.37 GB edge bytes (heavily bot-weighted)
- Render-proven human requests: 10,114 (excl. operator PL: 10,064)
- Sitemap: 205 URLs; crawlers: Amazonbot 95.6%, DataForSeo 94.1%, Semrush 86.3%, Yandex 36%

## Top human-verified pages (7d)
/, /s/spreadsheet (108 hv), /mcp/connect (94), /s/invoice (30), /s/bill-of-sale (21), /s/job-card (20), /s/time-tracker (19)

## GitHub (14d): 64 views / 54 uniques — negligible; distribution is the site, not the repo.

## Verdict / next moves
1. KPI floor: /s/* pages get zero Google impressions so far —IndexNow resubmitted (48 URLs incl. /suites/freelancer) 200 accepted 2026-09-22. GSC recheck in ~7d.
2. Biggest lever remains external mentions (backlinks) — the /s/ pages are verified-good but have zero links. Outreach drafts sit unposted in data/outreach_drafts_r8.md (human-approved channels only).
3. Homepage internal link to /suites/freelancer did NOT render (curl | grep suites/freelancer = 0 on /). Investigate where the link was added; crawl-discovery path broken.
4. Hub-page pattern is cheap: next suite hubs = /suites/pdf-tools, /suites/documents (per positions_sweep #3/#6) if freelancer hub gets impressions by next check.
