# Plan v10 (2026-09-04, loop 13): measure what cannot be seen yet

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 1,283 (1,242 at loop 12 close) | Steady catalog pull |
| Sales | 0 | No human checkout traffic exists to convert |
| GSC | OAuth endpoint unreachable from this host for two loops | Crawl status unmeasurable; not a code fault |
| PRs and issues | Docker 4892, three list PRs, 19 Cline issues: zero comments | Reviews pending, nothing to act on |
| Findable share | KPI reads 41 from a stale registry_rank.json; NAMING_R4 measured 50 | Reader fix, inline probe only |
| Round 14 | Base64 paste of 13 KB took 16 minutes to emit a call | Upload path is model-output bound; a URL fetch path removes it |

## Top 5, ranked by impact x autonomy
1. Upload by URL on every hosted upload shim (pdf, docx, image, sheet, bank, zip): `url` alternative to base64 with an SSRF guard (public hosts only, no private ranges, no own zone), size cap, content-type and magic check, one fetch per call. Pass: round-14 style prompt with a 40 KB file completes in one turn.
2. Measurable conversion instrument: every cap message's upgrade link carries `?src=<server>.<tool>`; the billing worker counts clicks per src in KV before redirecting; kpi.mjs reports clicks by src and the click-to-session ratio. Pass: a live click increments the counter; KPI row present.
3. Findable-share reader: regenerate data/registry_rank.json inline (curl -m 20, no background jobs), kpi.mjs reads it; refresh the RELEASE_CHECK open-gap table; add the missing registry-name rows; clear the zip compare waiver with a dated none-found note. Pass: KPI shows the measured share; release-check green with zero waivers.
4. Round 15 hosted: office-suite as a single connector is not hosted (stdio proxy), so test the four never-scored hosted servers expense-tracker, recurring, clauses, timezone. Pass: scored, seams fixed.
5. Docker catalog nudge: a polite status comment on PR 4892 is allowed once; the three list PRs and Cline issues wait.
Release v0.9.2 only if server sources change.
