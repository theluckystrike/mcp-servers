# Plan v17 (2026-09-05 evening, loop 20): server 22, drift fixes, changelog

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 2,414 | +130 in an hour |
| Clicks 7d | 51; billing-docs and deposits caps clicked within hours of shipping | New servers convert attention immediately |
| List PRs | AIAnytime merged; TensorBlock merged earlier; four open, Docker open | Second acceptance |
| Sales | 0 | Branding still generic |
| KPI reader | "Hosted tenants with stored data" unmeasured: wrangler kv list timed out | Reader needs a timeout and a cached fallback |
| Load | 24 to 31 (iCloud) | Three agents |

## Top 5, ranked by impact x autonomy
1. Build `per-diem`: daily allowance calculator on bundled public tables (Polish delegacja rates for domestic and foreign travel per the 2023 regulation still in force, UK HMRC benchmark scale rates, US GSA CONUS standard rate; each table dated and sourced in the README), trip record with days, meals deducted, currency, export to the expense tracker as one expense; registry names per-diem and travel-allowance. Audit, wire, host, content, catalogs, release v0.12.0.
2. Drift fixes: per_server.hosted in distribution.json derived from remotes.json at release-check time; the "Hosted tenants with stored data" KPI reader with a 60 s timeout and the last good value marked stale rather than null.
3. Storefront /changelog generated from docs/RELEASE_V*.md at build-pages time, linked from the footer, in the sitemap; IndexNow.
4. Hosted round 21 single-lane on deposits.
5. PR follow-through: none needed; record the AIAnytime merge.
