# NEXT-SPRINT — S44 handoff (from S43 close, 2026-09-18)

## Context
S43 closed at 8.5/10. Fan-in complete (0 /s pages without internal inbound links). Distribution 13/53. All agent deliverables harvested; 9 commits pushed (6c79dce7..0fe4e237).

## Priority queue (biggest-impact first)
1. **GSC/Bing verification** (HUMAN-GATED, highest unlock): Googlebot at 2/190. Once verified: submit sitemap, request indexing on the 42 /s pages + top 20 guides. Everything on-site is ready for this.
2. **CF Auto Minify toggle** (HUMAN-GATED): dashboard.cloudflare.com -> Speed -> Optimization -> Content Optimization -> disable Auto Minify. Worker weak-ETag fix (161696a4) already deployed; this toggle alone restores ETags on every HTML page -> conditional crawling works.
3. **T-A: recheck clocks (agents can do)**: mcp.so /server/theluckystrike-mcp-invoice + office-suite (was 404; #4227/#4228 filed). If ingested, file the remaining 36 repos per T9 pipeline. EDNA listing check (sam@enterprisedna.co said ~a week). mcpmux PR #300 merge watch (never ping maintainers).
4. **T-B: MCPmarket 30-server gap**: 30 of 42 missing. Mechanism = repo-level only; decide whether separate per-server repos are worth it, or defer to the $29 fast-track decision (human call). Also claim account + fix source-repo links (HUMAN-GATED).
5. **T-C: compare-page fan-in audit**: guides now fan in; /compare pages already do; audit /setup pages (8 URLs) for missing /s links.
6. **T-D: outreach posting** (partially human-gated): drafts 03-07 in docs/outreach/R1/ + R2/ need Reddit/dev.to accounts.
7. **T-E: KPI refresh + dashboard** after any coverage change (data/traffic.json is the source of truth for crawler sets).

## Conventions
- Leaf contract: 30 iterations, deliverable first with STATUS: in progress, evidence with producing commands, RESULT block, do not commit (orchestrator commits).
- kpi.mjs reads data/distribution.json; kpi.json parse via d['kpis'].
- IndexNow: node scripts/indexnow.mjs --all (190 URLs); key verified serving at site root.
- Deploy: cd billing && npx wrangler deploy; run node --test test/ first.
