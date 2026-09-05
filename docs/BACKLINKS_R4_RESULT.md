# Estate backlinks round 4 - verification only - 2026-09-06

Goal: read-only health check of every backlink to `https://mcp.zovo.one` shipped in rounds 1-3
(docs/BACKLINKS_RESULT.md, docs/BACKLINKS_R2_RESULT.md, docs/BACKLINKS_R3_RESULT.md). No deploys,
no fixes. Home page plus one subpage named in the earlier rounds, fetched with
`curl -s -m 15 -A "Mozilla/5.0 (compatible; Googlebot/2.1)"`.

## Result

All 12 domains (24 pages) are up, HTTP 200, and still carry a live href to `mcp.zovo.one`. No domain
is down, no anchor is missing, no domain-for-sale/parking page was found. boldtake.io remains
excluded from this list (already recorded lost in R2/R3; not one of the twelve).

Count still serving: **12 / 12**.

| Domain | Page | HTTP | Bytes | Anchor href present | For-sale/parked page |
|---|---|---|---|---|---|
| ukmoneycalc.com | / | 200 | 10359 | yes | no |
| ukmoneycalc.com | /calculators/take-home-pay/ | 200 | 17363 | yes | no |
| statewage.com | / | 200 | 27950 | yes | no |
| statewage.com | /overtime-calculator/ | 200 | 12039 | yes | no |
| ml0x.com | / | 200 | 50409 | yes | no |
| ml0x.com | /tools/learning-rate-finder.html | 200 | 45323 | yes | no |
| heytensor.com | / | 200 | 24097 | yes | no |
| heytensor.com | /tools/ | 200 | 19973 | yes | no |
| kickllm.com | / | 200 | 24890 | yes | no |
| kickllm.com | /guides/ | 200 | 8894 | yes | no |
| toolsthatrank.com | / | 200 | 56059 | yes | no |
| toolsthatrank.com | /pricing/ | 200 | 41037 | yes | no |
| aiwebsitepipeline.com | / | 200 | 98390 | yes | no |
| aiwebsitepipeline.com | /faq.html | 200 | 82535 | yes | no |
| deepvalueradar.com | / | 200 | 1028619 | yes | no |
| deepvalueradar.com | /companies/ | 200 | 2009647 | yes | no |
| lakelevelnow.com | / | 200 | 36028 | yes | no |
| lakelevelnow.com | /almanac/ | 200 | 39395 | yes | no |
| worthmyclaim.com | / | 200 | 21650 | yes | no |
| worthmyclaim.com | /personal-injury-settlement-formula/ | 200 | 45479 | yes | no |
| dscrradar.com | / | 200 | 22503 | yes | no |
| dscrradar.com | /rental-vacancy-by-county/ | 200 | 590743 | yes | no |
| zovo.one | / | 200 | 33114 | yes | no |
| zovo.one | /free-tools | 200 | 54420 | yes | no |

Subpages used are the ones named in the earlier rounds' verification steps (R1 for ukmoneycalc and
statewage, R2 for ml0x/heytensor/kickllm/toolsthatrank/aiwebsitepipeline, R3 for
worthmyclaim/dscrradar). deepvalueradar, lakelevelnow and zovo.one had no subpage named in the prior
rounds' verification tables, so a subpage was picked from each site's own sitemap
(deepvalueradar `/companies/`, lakelevelnow `/almanac/`) or footer nav (zovo.one `/free-tools`).

## Notes

- Anchor text differs by round. ml0x, heytensor, kickllm, toolsthatrank, aiwebsitepipeline,
  deepvalueradar, lakelevelnow, worthmyclaim and dscrradar (9 sites) all carry the literal text
  "MCP servers for Claude" linking to `https://mcp.zovo.one` (confirmed by direct grep of the anchor
  text, count 1 per home page). ukmoneycalc.com and statewage.com (round 1, predates that wording)
  instead carry three separate links with different anchor text ("MCP Invoice" / "MCP invoice
  generator", "MCP Expense Tracker" / "MCP expense tracker", "MCP Time Tracker" / "MCP time tracker"),
  each pointing at `https://mcp.zovo.one/s/<slug>` rather than the bare domain. These are the same
  links R1 shipped and are still live; flagging the wording difference here since the task named
  "MCP servers for Claude" as the anchor for all eleven, and two of the eleven do not literally use
  that string.
- worthmyclaim.com home page is 21650 bytes now, down from the 23,937 bytes recorded live-verified in
  R3 (2026-09-04). The anchor is still present and the page is still 200, so this is not a link loss;
  it reads as ordinary page content drift (copy/layout changes) between R3 and this check, not
  something this read-only round investigated further. Worth a look if worthmyclaim content changes
  are unexpected.
- No domain returned a non-200 status, no site showed a registrar parking page, and no anchor was
  missing anywhere it was expected. boldtake.io's loss (documented in R2/R3) is unchanged and is not
  one of the twelve counted here.
- Read-only round: no code was changed, no site was deployed to, no repo was cloned or pushed.
