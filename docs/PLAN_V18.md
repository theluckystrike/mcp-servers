# Plan v18 (2026-09-05 night, loop 21): the bundle is invisible from where the clicks come from

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 2,599 | +120 in an hour |
| Clicks 7d | 65, zero through any bundle or cross-sell source | Every cap-message click lands on a $19 single-server checkout; the $39 bundle is only mentioned inside Stripe's custom text |
| Sales | 0 | The cheapest offer for a buyer who already uses three servers is never shown where they decide |
| PRs | four list PRs and Docker open, no comments | Wait |
| GSC | key dataless | Unmeasurable |
| Load | 12 to 22 | Four agents |

## Top 5, ranked by impact x autonomy
1. Bundle in every cap message: hostedUpgradeText and upgradeText append one sentence "or all N servers for $39 (bundle link with src=<product>.<tool>.bundle)" wherever a single-server link appears; the cap tests assert both links; hosted and stdio; codemod-safe. Pass: /stats/clicks shows a .bundle source within a day; validate green.
2. Build `asset-register`: fixed assets with purchase date, cost, useful life from bundled public tables (Polish KST rates, HMRC capital allowance pools, US MACRS classes; each sourced), straight-line and declining-balance schedules, monthly depreciation journal lines, disposal with gain or loss; registry names asset-register and depreciation. Audit, wire, host, content, catalogs, release v0.13.0.
3. Real compare page for per-diem against com.1102tools/gsa-perdiem-mcp from its README, replacing the compare_none note.
4. Hosted round 22 single-lane on per-diem.
5. Intel round 10: 30 fresh tokens for slots under 20 results with fit over 0.6.
