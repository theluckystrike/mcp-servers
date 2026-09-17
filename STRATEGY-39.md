# STRATEGY-39 — Organic disruption loop (2026-09-17, continuing)

## Measured starting state (commands on file, loops 36-38)
- KPI gaps: findable share 50/60, surfaces 17/49, GitHub unique visitors 33/200,
  Google impressions 0/1, paid sessions 0/5. Registry 97/97 met. Stars estate-wide: 66 total,
  most mirrors 0 (binding constraint on topics-search rank).
- Funnel: instrument v3 live (Referer required); true human clicks <=375/7d baseline.
- Distribution: 13 PRs across 5 awesome lists, all MERGEABLE, 0 merged.
- Organic: blind R4 -> mcpservers.org surfaces estate pages (first win). 178/178 IndexNow accepted
  with fresh lastmod. ClaudeBot covers 140/171 URLs; Googlebot only 2/171.

## Levers ranked by (impact x autonomy)
1. **AI-crawler surface (llms.txt + /mcp/connect) promotion** — ClaudeBot already crawls 140/171;
   push the remaining 31 URLs through IndexNow endpoints that accept them, verify /llms.txt lists
   every /s/ + /guides/ + /compare/ page, add Last-Modified headers.
2. **Findable share 50->60**: measure which of the 97 tracked tokens fail the fully-paginated
   registry search; for failing ones the fix is name/description tokens in the registry record
   (description is already in manifests — check whether tokens exist in name at all).
3. **Guide-page buyer-intent expansion**: guides get mixed-human traffic (173 clicks/7d).
   Add comparison guides targeting queries buyers actually type (measured in data/facts.json
   compare_none notes: 4 servers have zero competitors — write "best X MCP server" pages).
4. **PR follow-ups**: rebase any of the 13 that drift; collabnix README is workflow-regenerated.
5. **Stars**: only human-actionable, skip.

## Execution
- Agents: T1 AI-crawler/llms.txt audit; T2 findable-share token measurement;
  T3 buyer-intent guide pages for the 4 no-competitor servers; T4 PR drift rebase sweep.
- Orchestrator-direct: integrate, verify, deploy, dashboards.
