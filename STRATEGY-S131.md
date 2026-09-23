# STRATEGY-S131 — Distribution multiplication (2026-09-23)

## Measured baseline (data/kpi.json 2026-09-22, data/distribution.json, BLIND_R7)
- Registry names live 46 (target 131); findable share 50%; surfaces 15/70.
- Blind organic retrieval 1/18 (R7). Google impressions 0, Googlebot 24/207.
- Whitespace queries R7: q6 quotes/estimates, q10 spreadsheet-from-chat, q14 delivery
  schedule/work order, q16 no-install usage, q17 small-business accounting roundup,
  q18 paid MCP discovery.
- npm: token expired (human-gated). Checkout: 100 human sessions, 0 paid, 37 upgrade clicks.
- 47 servers built / 46 published; /s/<name> pages 200; hosted 16 servers live.

## Thesis
Listings are saturated; retrieval is not. The three levers with full autonomy today:
1. Registry name multiplication (variant names rank per token; purchase-requisition
   pattern proved 4 tokens per codebase).
2. Whitespace content: publish pages on mcp.zovo.one that ANSWER the six R7 whitespace
   queries in natural language (content.js + deploy), each linking /s/ + registry entry.
3. Surface sweep: re-probe pending/blocked surfaces for status flips (futuretools review,
   mcpmarket queue, glama indexing, mcpservers.com submit path) + find new free surfaces
   via gh search.

## Units
- T1_REGISTRY_VARIANTS — compute next high-demand variant-name set from
  data/token_demand_r1.json; generate manifests; registry-publish-all --only.
- T2_WHITESPACE_CONTENT — content.js answers for q6/q10/q14/q16/q17/q18; tests; deploy.
- T3_SURFACE_SWEEP — re-probe all pending/open surfaces; record flips in distribution.json.
- T4_KPI_R3 — kpi.mjs refresh + blind organic spot-check on the 6 whitespace queries.
- T5_DASHBOARD — update dashboard/index.html + DASHBOARD.html + mcp/ folder note.

## Gates
All deploys require node --test green. Registry publishes require uploaded mcpb asset.
