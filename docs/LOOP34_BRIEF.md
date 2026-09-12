# LOOP 34 BRIEF — distribution, surfaces, and the rename test

Date: 2026-09-12. Orchestrated loop, 6 wave-1 agents + builder wave + measurement wave.

## Inputs this loop acts on

1. **Loop 33 convergence** (docs/LOOP33_CONVERGENCE.md): assistants answering buyer questions
   cite GitHub one-server repos and Glama /mcp/servers/ pages, never the storefront. The 32
   mirror repos are the primary distribution asset.
2. **GH_SEARCH_R2**: small fields winnable via coverage; contested fields star-gated. The way
   to grow is more uncontested questions, i.e. more servers aimed at small fields, plus ONE
   rename experiment (mcp-invoice -> mcp-invoice-generator) proposed and not yet run.
3. **CONTENT_R4 deployed** (verified 2026-09-12: all 9 new guide URLs 200, llms.txt 76,630
   bytes). Its follow-up — the blind re-run watching Q16/Q18 — was never executed. This loop
   runs it as R2.
4. **DISTRIBUTION_R2 leftovers**: 4 agent-submittable surfaces unused (Chat2AnyLLM, Zencoder,
   jaw9c, Appnova), Gemini CLI gallery unlock (gemini-extension.json at mirror roots + topic),
   Claude Code plugin marketplaces, stacklok/toolhive preflight, loop-33 PR status check.
5. **platform-analysis-2026 research** (~/Desktop, iCloud-recovered): MCP capture ratio 1.17
   vs Chrome 0.033 (35.5x); zero native billing in MCP = the estate's Stripe+license infra is
   a structural moat; Telegram bots ranked #1 raw but inferred — cheap test proposed (2 bots,
   30-day organic count), bot token is human-gated; Atlassian #1 measured, Forge credentials
   human-gated (exact commands in NEEDS_APPROVAL.md).

## Wave plan

- W1-A field scout: measure GH field sizes for ~20 candidate new-server names, pick 4.
- W1-B gemini unlock: gemini-extension.json into the mirror generator + topic; orchestrator ships.
- W1-C distribution PRs: Chat2AnyLLM, Zencoder, jaw9c, Appnova.
- W1-D distribution: loop-33 PR status, Claude Code plugin marketplaces, toolhive preflight,
  Glama /mcp/servers/ census.
- W1-E rename-test prep: baseline `mcp invoice generator` + 2 control queries, blast radius,
  execution script (orchestrator runs it).
- W1-F blind recommendation R2: fresh agent, 18 frozen questions, no estate knowledge.
- W2 builders: top 2-4 picks from W1-A, full CONVENTIONS.md contract.
- W3 orchestrator: builds, tests, releases, mirror sync, registry publish, remote deploy,
  validate.mjs (only when nothing else is deploying).
- W4 measurement: KPI refresh (scripts/kpi.mjs), GH rank re-measure, dashboard regeneration
  (render-main.mjs + update-dashboard.mjs), commit, sound.

## KPI baseline at loop start (from data/kpi.json 2026-09-10)

- Named by a blind assistant: 0 of 18 (R2 runs this loop)
- GH small-field rank-one slots held: 15 of 34 queries
- Distribution surfaces live: 12 of 49
- Google impressions storefront: 0 (28d); Brave index depth: 1 of 154
- Paid sessions: 0; license keys minted: 0
- Live validation: 1028/1028; unit tests 1563
- Stripe live verified this loop: session cs_live_a1ZK... amount 1900 = $19 (matches facts.json)

## Hard rules (unchanged)

No emoji. No paid surfaces. No account creation. Agents never push to theluckystrike repos,
never npm publish, never wrangler deploy — orchestrator ships. /usr/bin/grep only.
npm_config_cache=/Users/mike/.npm-cache-local. Every number carries its command. A 200 is not
evidence; positive controls required.
