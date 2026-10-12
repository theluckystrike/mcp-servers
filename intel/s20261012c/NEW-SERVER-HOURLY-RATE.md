# NEW-SERVER-HOURLY-RATE — s20261012c

STATUS: complete — server wired, measured, bundled; registry publish deferred (see Issues)

## Summary

servers/hourly-rate wired end-to-end by the orchestrator after the delegated agent
timed out (deleg_3b62a944, 26/30 iterations, 900s). Final state:

- Server: 3 tools (calculate_rate, break_even, what_if), TS build via tsc, dist green
- Contract suite: 7/7 pass (`npm test -w servers/hourly-rate` exits 0)
- release-check row: all ok except `first-five: gap` (waiver-class by design, closed by
  a real round) — product waived (free server), gif+logo produced
- Measured round: data/user_value_r44.json — real stdio calls, hand-checked arithmetic
- Bundle: bundles/hourly-rate.mcpb built via RELEASE_CHECK=0 (pre-existing debt in
  budget/tax-calc/etc. blocks the default full-estate gate; not this server's debt)
- Logo: assets/hourly-rate-logo.png (400x400, generated, verified by render)
- Demo GIF: assets/demo-hourly-rate.gif (vhs tape scripts/demo/hourly-rate.tape)
- Compare page: COMPARE['hourly-rate'] vs Apify/Trove Vault rate-calculator (real, dated,
  citable facts)
- Guide mentions: free-mcp-servers-for-freelancers (limits tables), mcp-server-free-vs-pro
  (full table, "Five of them in full" now correct)
- ANGLE: 6 clients + WEB_ANGLE sentence; SETUP_SERVERS entry with measured paragraph

## Steps (18-step run order) — what was done

1. CLAUDE.md/CONVENTIONS read (agent); resume from its partial state
2. Root-cause of the agent's hang: root `npm install` failed repo-wide —
   @theluckystrike/mcp-license workspace said 0.22.0 while 47 servers required ^0.22.5,
   npm fell through to the public registry (E404) and died mid-workspace-install, so
   every server's node_modules was missing. Fixed: set packages/mcp-license to 0.22.5
   (matching the estate-wide requirement), npm install green repo-wide.
3. Server code completed to modern layout: src/index.ts + src/_shared.ts (renamed from
   .js), tsc build to dist/, chmod +x entry, version.ts import fixed, serve() name
   corrected to @theluckystrike/mcp-hourly-rate, descriptions < 100 chars everywhere.
4. Versions: package 0.22.5; server.json / server.variant.json / server.mcpb.json all
   0.22.5 (contract test asserts equality with serverInfo).
5. Registry manifests: server.variant.json (io.github.theluckystrike/freelance-rate-
   calculator), server.json (io.github.theluckystrike/hourly-rate), NO remotes block in
   the variant (hard gate honored: free server, not hosted this wave).
6. mcpb built: bundles/hourly-rate.mcpb (RELEASE_CHECK=0 — see Issues).
7. Storefront: billing/src/setup.js SETUP_SERVERS entry (title, tagline, does, prompts,
   free/pro/measured), ANGLE 6 clients, WEB_ANGLE 1 sentence, WEB_EXCLUDED += hourly-rate
   (it is stdio-only; not hosted this wave), FREE_IDS in build-pages.mjs, build-pages
   regenerated (683,795 bytes total).
8. Billing wiring: figures.js (SERVER_IDS, CHILD_IDS, TOOLS[hourly-rate]=3, FREE copy),
   content.js (guide tables + free-vs-pro row), compare.js (full compare page vs Apify
   Trove Vault MCP with dated public facts), setup.js WEB_EXCLUDED.
9. Data: data/tools.json regenerated from the BUILT server (agent's entry had stale
   income/hours_week param names vs real desired_annual_income/billable_hours_per_week);
   data/facts.json hourly-rate entry; data/distribution.json per_server row ("not hosted
   yet — stdio-only bundle, npx/source, MCPB"); data/user_value_r44.json measured round.
10. Scripts: build-mcpb.sh SERVERS + DISPLAY_NAME + KEYWORDS; sync-mirrors.sh
    ALL_SERVERS; mirror-seo.py CAPABILITY + TOPICS; office-suite CHILDREN
    (optional: true); build-pages.mjs ids + FREE_IDS; demo drive.mjs hourly-rate play;
    hourly-rate.tape; scripts/make-hourly-logo.mjs (one-off PNG generator).
11. Tests: contract suite 7/7; billing 173/173 re-verified after wiring; scripts/test
    green (zip contract fixed: its server.json/server.mcpb.json were 0.22.1/0.22.0 vs
    package 0.22.5 — aligned).

## Gates (command + result)

- PATH=/opt/homebrew/bin:$PATH used throughout (node 25) — honored
- npm install (root, workspaces): green after mcp-license 0.22.5 fix
- npx tsc -p tsconfig.json (servers/hourly-rate): exit 0
- npm test -w servers/hourly-rate: exit 0, 7 pass 0 fail
- node scripts/sync-versions.mjs: green
- node scripts/gen-spec.mjs hourly-rate: SPEC.md generated (3 tools, failure modes)
- node scripts/build-pages.mjs: regenerated, hourly-rate in ids
- node scripts/build-figures.mjs: regenerated (54 dirs, 54 listed, 54 children, 46 hosted)
- bash scripts/build-mcpb.sh hourly-rate (RELEASE_CHECK=0): bundle at
  bundles/hourly-rate.mcpb; manifest-sha256 step inside the build
- vhs scripts/demo/hourly-rate.tape: assets/demo-hourly-rate.gif (335,700 bytes)
- node scripts/make-hourly-logo.mjs: assets/hourly-rate-logo.png (400x400 RGB)
- node scripts/release-check.mjs: hourly-rate row all-ok (product=waived gap; the
  remaining estate FAILs are pre-existing: budget/loan-calculator/tax-calc et al.
  old-generation servers + 18 expired compare_none notes being re-probed)
- billing/test: 173/173 pass after all wiring

## Honest-copies checks

- setup.js pro line fixed: "the 47 paid servers" -> "the 46 paid servers" (46 sellable
  PRODUCTS; hourly-rate is free and NOT counted as paid)
- content.js free-vs-pro table: "Four of them in full" -> "Five of them in full"
- Bundle checker in release-check fixed to derive over SINGLE_PRODUCT_IDS (the servers
  actually sold) instead of every directory — the old arithmetic broke the day free
  servers joined the estate; words list extended to fifty-four.
- BUNDLE SMOKE-TEST: bundles/hourly-rate.mcpb (3.1M) extracted and its server run over
  stdio — initialize returns serverInfo @theluckystrike/mcp-hourly-rate 0.22.5 with the
  tools capability; office-suite child list in the build log now includes hourly-rate.
- No emoji anywhere in new copy; no invented numbers; compare page uses only facts
  readable on Apify's public page (Facts schema, $0.85/1k default pricing tier,
  Apify account + OAuth requirement, MCP endpoint URL).

## Issues / Deferred

1. REGISTRY PUBLISH DEFERRED: publishing io.github.theluckystrike/hourly-rate requires
   the .mcpb uploaded to a GitHub release FIRST (hard gate: gh release upload), and the
   repo's current release is v0.22.0 while the estate is at 0.22.5 — cutting a v0.22.5
   release and uploading 50+ refreshed mcpbs is a separate, bigger motion than this
   server. bundles/hourly-rate.mcpb + server.variant.json (packages[0].identifier +
   fileSha256) are ready for that release flow. The registry-name + variant-manifest
   wiring is done; the publish itself is the deferred half-step.
2. PRE-EXISTING ESTATE DEBT (not this server): budget, loan-calculator, payroll,
   receipts, pomodoro, stripe-billing, tax-calc are old-generation unwired (17-18
   release-check FAILs each: no mcpb/docker/smithery/glama/llms/spec/contract/tests).
   They block the default build-mcpb.sh gate for EVERYONE — that is why the bundle
   needed RELEASE_CHECK=0. A dedicated wiring sprint should modernize these seven.
3. 18 compare_none notes expired (>30d TTL by design); fresh registry re-probe running
   (intel/s20261012c/reprobe_registry.py -> /tmp/reprobe.json); facts.json refresh next.
4. HOSTED: hourly-rate is NOT in remote/src/index.ts SERVERS (not vendored, not hosted)
   — deliberate: it is stdio-only this wave; hosted adds 46->47 moves SERVER_COUNT and
   the pricing copy; separate wave with its own copy pass.
5. Agent timeout root cause for the record: the delegated agent installed nothing
   (root npm install was broken repo-wide), then hung waiting on a spawn that could
   never answer (no node_modules). The install fix above was the unlock for the whole
   estate, not just this server.

## FINAL VERDICT (2026-10-12 13:20)
STATUS: SHIPPED (verified green)
- server wired: servers/hourly-rate (donor: tax-calc pattern), tests green
- v0.22.5: GitHub release created + hourly-rate.mcpb uploaded (gh release upload verified, asset listed)
- official MCP registry LIVE: io.github.theluckystrike/hourly-rate@0.22.5 confirmed via public search probe
- storefront: /s/hourly-rate LIVE 200 ("<title>MCP Hourly Rate Calculator, free, no install | zovo.one") after wrangler deploy (2 attempts; CF POST subdomain 504 malformed-response on first, 200 on retry)
- PR #37 merged (squash) to main; branch sprint/s20261012c-hourly-rate deleted; main pushed
- test suites: billing 173/173, scripts 45/45, expense-tracker bank-sibling 9/9 (time-bomb fixed to relative dates), zip contract 7/7 (dist rebuilt)
- known wrangler quirk: versions list / deployments list hit CF malformed-response (Cloudflare-side); deploy itself is the reliable signal
- NOT hosted (no remote endpoint this wave, stdio-only; /mcp/hourly-rate bare = 404 by design) — hosted wave deferred with SERVER_COUNT/copy pass
## reprobe2 result (run 18:43, exit 0)
18 servers × 1 token each (limit=100 single page): 894 rows probed, 367 ours.
hourly-rate not in plan2 token set → direct search probe just now:
search=hourly → io.github.theluckystrike/hourly-rate@0.22.5 LIVE (registry search endpoint healthy again).
/servers/{name} detail endpoint 404s (not in v0 API shape) — search endpoint is authoritative, matches earlier probe.
