# STRATEGY-41 (2026-09-18)

## Measured starting state (data/kpi.json, generated 2026-09-17T13:45Z)
- met: registry 97/97, hosted coverage 34/33, tokens 130, tenants 616, checks 1135/1135, latency 313ms, checkout sessions 65, upgrade clicks 671, first-prompt reach 98.
- ZERO/progress (the gaps): Google impressions 0, Googlebot coverage 2/171, npm 0 (human-gated, skip), blind named 0/18, citation share 2/18, surfaces 17/49, GitHub visitors 33/200, hosted downloads 95/200, user-value 61/90, checkout ratio 9.7/40.

## Levers (impact x autonomy), judged against "audience is the binding constraint"
1. **T1 Glama mirrors 8 -> more of 42.** Glama is the #1 citation source for assistant
   recommendations (7 of 33 citations, docs/CLAUDE.md RECOMMENDATION_SOURCES_R1) and only
   8 of 42 mirror repos carry a Glama rating badge. Verify which mirrors Glama has indexed,
   add badge + cross-links to indexed ones, list gaps. Do NOT touch the official registry
   (CLAUDE.md: it is upstream only; no more registry-ranking rounds).
2. **T2 Google coverage push.** Googlebot coverage 2/171 is why impressions are 0. The
   full-resubmit window (24h after 2026-09-17T14:00Z) has elapsed: full sitemap IndexNow
   resubmit covering /s/, guides, compare drift + 8 new compare pages; verify keyLocation,
   Last-Modified validator, robots, llms.txt freshness; re-crawl probe of sample URLs.
3. **T3 New-surface sweep.** Surfaces 17/49. Identify and submit to surfaces that need no
   account and no payment (Smithery? mcpservers.org? OpenToolHive? any others), per-server,
   using existing repo/README assets. Record honest per-server statuses in
   data/distribution.json. No account creation, no sign-ins: human-gate those.
4. **T4 Blind R6.** Fresh-subagent blind recommendation test over data/blind_questions.json
   (R5 method). Measures: named count, citation sources, whether estate pages surface.
   This is the one number that matters.

## Execution
- Batch 1: T1 + T2 (independent). Batch 2: T3 + T4 (T4 must run fresh, no estate knowledge
  beyond the frozen questions file).
- Orchestrator-direct: KPI regeneration, DASHBOARD.html update, commit.

## Human-gated / skipped
- npm publish, Stars, paid listings, any account creation. Checkout improvements need
  payment rails: not autonomous, skip this sprint.

## Sprint-42 backlog (from T5)
- Worker-wide ETag defect: contentHeaders() assigns etag (src/index.js:409) but it never reaches the wire on ANY page (verified on origin). Fix = content-derived strong ETag (body hash). Filed docs/T5_FIXES_R1.md #4b.
