# R4: Directory Wave 4 (Research-driven)

STATUS: COMPLETE — 1 verified PR opened.

## Goal
Target GitHub awesome-lists in underserved verticals (finance, pdf, time tracking, productivity) with PRs adding 2-3 hosted servers from the estate:
- price-tracker → https://mcp.zovo.one/mcp/price-tracker
- time-tracker → https://mcp.zovo.one/mcp/time-tracker
- pdf → https://mcp.zovo.one/mcp/pdf
- invoice → https://mcp.zovo.one/mcp/invoice
- quotes → https://mcp.zovo.one/mcp/quotes

## Search results (queries: "awesome mcp finance|pdf|time tracking|productivity", stars>=30)
No vertical-specific awesome-lists meet the >=30-star + active + not-covered bar. Searches returned either:
- mega generic lists (all already covered: punkpeye, wong2, yzfly, TensorBlock, MobinX, YuzeHao2023, etc.), or
- low-star individual server repos (not lists).

## Candidates investigated
| Repo | Stars | Active(<90d) | Accepts servers? | Verdict |
|------|-------|------|------------------|---------|
| bh-rat/awesome-mcp-enterprise | 120 | yes | Issue-first gate (PRs w/o approved issue auto-closed) | SKIP (cannot auto-PR) |
| e2b-dev/awesome-mcp-gateways | 174 | yes | Gateways only; no finance entries | SKIP (wrong scope) |
| TrueHaiq/awesome-mcp | 33 | yes | Direct MCP-server PRs accepted | TARGET |
| Puliczek/awesome-mcp-security | 738 | no (>90d) | security | SKIP |
| AIM-Intelligence/awesome-mcp-security | 51 | no | security | SKIP |
| darjeeling/awesome-mcp-korea | 243 | no | KO-language | SKIP |
| PipedreamHQ/awesome-mcp-servers | 284 | no | - | SKIP |

## PR opened (verified OPEN + MERGEABLE)
1. **TrueHaiq/awesome-mcp** — PR #52 — https://github.com/TrueHaiq/awesome-mcp/pull/52
   - state: OPEN, mergeable: MERGEABLE, mergeStateStatus: CLEAN
   - Added 3 hosted finance/business servers to the `💹 Finance` category (alpha-matched format, icon + name + description):
     - Invoice → https://mcp.zovo.one/mcp/invoice
     - Price Tracker → https://mcp.zovo.one/mcp/price-tracker
     - Quotes → https://mcp.zovo.one/mcp/quotes
   - Branch: theluckystrike:add/zovo-estate-servers (fork theluckystrike/awesome-mcp-2)

## Verified PRs (via `gh pr view`)
| PR | Repo | state | mergeable |
|----|------|-------|-----------|
| #52 | TrueHaiq/awesome-mcp | OPEN | MERGEABLE |

## Notes / blockers
- No per-server GitHub repos exist (404 for all 5 names under github.com/theluckystrike) — entries link to hosted URLs as the task specified.
- Only ONE clean auto-PR target existed: TrueHaiq. bh-rat requires an approved proposal issue before PR (out of auto-budget); e2b is gateways-only. No other vertical list met the bar.
- time-tracker & pdf not added: no category in TrueHaiq fits them (Finance category choice limited to finance/business servers for coherence and acceptance).
