# dist_r8_kpi.md — KPI refresh round 8
DATE: 2026-09-22 | STATUS: shipped (all data pulled live by orchestrator; r7 baseline from data/dist_r7.json)

## KPI table (28d window 2026-08-25..09-22 vs r7 baseline)
| Metric | r7 | r8 | Δ |
|---|---|---|---|
| GSC clicks (zovo.one, 28d) | 59 | 48 | -11 |
| GSC impressions (28d) | 4,855 | 2,848 | -2,007 |
| mcp.zovo.one host clicks | 0 | 0 | = |
| mcp.zovo.one impressions | 19 | 19 | = |
| Open PRs | 12 (10 auditable) | 7 open | -5 |
| Merged cumulative | 8 | 11 | +3 |
| Landing HTTP | — | 200 | live |
| Glama | 12 servers/35 connectors | unchanged this round | — |

## GSC detail (verified via SA JWT + webmasters v3)
- Top query: "zovo" 35 clicks/938 impr; top page zovo.one/ 41/1,116.
- mcp.zovo.one/ appears as a PAGE row: 0 clicks / 19 impressions — indexed but zero CTR yet (landing deployed mid-window).

## PR audit (gh pr view, live 09-22)
MERGED since r7: Albertchamberlain/awesome-MCP#52 (09-18), abordage/awesome-mcp#106 (09-14), mcpHQ/awesome-mcp-servers#62 (09-17).
Still OPEN (7): DhanushNehru#85, habitoai#144, mgoldsborough/awesome-mcpb#11, punkpeye#14559, rohitg00#338, toolsdk-ai#514, wagneragent#81.
(r7 counted 12 open incl. 2 non-auditable entries; auditable set = 10.)

## Verdict
- MOVED: 3 PRs merged (+3 cumulative = 11); landing page live at 200.
- STALLED: mcp.zovo.one organic (0 clicks, impressions flat at 19 — pre-landing window; expect movement next measurement).
- NOTE: overall site clicks DOWN 59→48 — zovo/ free-tools traffic dipped; not an mcp-estate issue.

## Next measurement hooks
- Recheck mcp.zovo.one CTR ~10-14d post-landing.
- mcp.so GH issue + mcpservers.org/mcpfinder submissions (see dist_r8_discovery.md) should add referral+indexed surfaces.
