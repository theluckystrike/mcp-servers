# Plan v14 (2026-09-05, loop 17): one page for the operator, fresh slots, the last untested paths

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 1,983 | 480 in 24 hours |
| TensorBlock awesome list | PR 2164 MERGED | First third-party list acceptance; a live backlink and a relevance-ranked surface |
| Clicks 7d | 24, none since the bundle page and slotted links went live | The click burst was one visitor session; per-slot data needs traffic |
| Sales | 0 | |
| GSC | home discovered, never crawled | Wait |
| Load | 5 | Up to 5 agents |

## Top 5, ranked by impact x autonomy
1. Intel round 9: probe 30 fresh tokens for slots under 20 results with an honest fit over 0.6 (no naming on capped tokens); if one qualifies, build that server next loop. Pass: docs/INTEL_R9.md with counts and a build/no-build decision.
2. Weekly digest script: scripts/digest.mjs writes docs/WEEKLY_<date>.md from data only (downloads delta, clicks by src, rounds and scores, releases, registry entries, indexed pages, open defects, human-gated list); one page the operator reads. Pass: file generated, committed, linked from the dashboard.
3. Round 18 single-lane re-runs of quotes, calendar, pdf via url uploads (three agents). Pass: scores vs round 12.
4. D-R54 fix (date_order self-report says dmy for ISO input) with a test; D-R16-1 recorded as client trait in the ledger. Release v0.9.5 if sources change.
5. Refresh docs/how-it-works.html with current numbers, the bundle, the connect-by-URL path and the click instrument; served copy on the storefront if a route exists.
