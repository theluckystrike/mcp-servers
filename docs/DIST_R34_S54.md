# DIST_R34 — S54 (2026-09-20)

## Result: verified-green — 10 new listings live on index.percall.dev (AI Product Index)

## Lane findings
| Surface | Verdict |
|---|---|
| index.percall.dev | **10/10 ACCEPTED & LIVE** — autonomous, free, JSON-issue protocol |
| mcpmarket.com (GitHub free queue) | Already listed ("Productivity Suite") — no action needed |
| mcpmarket.com (Remote MCP) | $69 paid-only — skipped |
| smithery.ai | Publish requires GitHub OAuth password entry — BLOCKED (needs user). Anonymous MCP handshake at mcp.zovo.one verified 200 (prereq already met) |
| mcp.so | $39 paid-only — skipped (confirmed S54) |
| mcpdirectory.com, mcps.store, mcpai.dev | Dead/parked domains |
| glama.ai | Auto-indexes; "Add Server" needs signup+CAPTCHA — skipped |

## percall registration details
- Protocol: schema-valid JSON listing in `[register]` issue body on 110kc3/seo (docs: https://index.percall.dev/llms.txt)
- Issues #41–#50 all accepted; #51–#55 retry batch (first 5 failed on registry-side CI git-push race when 10 filed simultaneously — fixed by 100s spacing)
- Verified: all 10 https://index.percall.dev/l/zovo-*.html → 200; search?q=zovo total=10
- Slugs: zovo-invoice, zovo-quotes, zovo-time-tracker, zovo-pdf, zovo-resume, zovo-spreadsheet, zovo-calendar, zovo-barcode, zovo-currency, zovo-image
- **CAP REACHED: max 10 listings per GitHub account** — future expansion requires a second account (user decision)
- Pitfall recorded: Cloudflare on mcp.zovo.one 403s Python-urllib UA — URL pre-checks must send a normal UA

## Cumulative distribution position
- mcpservers.org: 52 listings (estate complete)
- index.percall.dev: 10 listings (cap)
- Official MCP registry: 30 entries
- glama: ~13 (auto)
- percall issue #40: superseded by #41–#55 (old issue rejected for non-JSON body)

## Next sprint (S55)
1. Smithery publish — needs user: 2-min GitHub OAuth in browser (CLI `smithery auth login` device flow) → then 46 servers publishable
2. Official MCP registry publish via mcp-publisher — same GitHub device-flow auth unblocks this too
3. Second percall account (user decision) for 10 more listings
4. Measure organic referrers on Cloudflare analytics

## Files
- data/distribution.json — surfaces.percall added, totals.percall_accepted=10
- docs/notes_s54_smithery.md — smithery blocker notes
