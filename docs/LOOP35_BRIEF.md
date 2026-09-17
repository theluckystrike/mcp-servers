# LOOP 35 BRIEF — 2026-09-12 (orchestrated, 10 agents wave A+B)

Context chain: CLAUDE.md (operating knowledge) -> CONVENTIONS.md (build contract) ->
docs/LOOP34_RESULT.md (what shipped 6h ago) -> this file.

## Loop 35 targets, chosen from measured zeros/progress in data/kpi.json (2026-09-12 03:35)

| target | now | lever |
|---|---|---|
| Paid sessions | 0 (65 human checkout sessions died) | funnel forensics + fixes |
| Google impressions | 0 (Googlebot covers 2/171 URLs) | indexation audit + source fixes |
| Hosted endpoints | 34 of 37 | wire the missing 3 |
| Seam defects | 123 of 148 fixed | fix the remaining 25 |
| Registry findable share | 50% | phrase-variant registry names (loop34 pattern) |
| Distribution surfaces | 12 of 49 | autonomous submissions only |
| Server count | 37 | +4 on measured-empty GitHub fields |
| Blind assistant | 0/18 | mirror README content (wave C) |

## Hard rules for every agent (violations waste loops, learned expensively)

1. NO EMOJI anywhere. No paid APIs, listings, or reviews. No account creation or browser
   sign-in; record human-gated items with the exact URL and stop.
2. Every number in a report carries the command that produced it. A 200 is not evidence.
   Run a positive control before believing a zero.
3. `/usr/bin/grep` ONLY — `grep` is a shell function here that silently returns nothing.
   `grep -c` counts LINES; use `grep -o | wc -l` for occurrence counts.
4. `npm_config_cache=/Users/mike/.npm-cache-local` on every npm command.
5. Do not touch anything outside /Users/mike/mcp-servers except reading. No npm publish,
   no git push, no git commit (orchestrator commits). Do not use Desktop (iCloud dataless).
   No `killall`, no `ps aux`.
6. NO `wrangler deploy` and NO `scripts/validate.mjs` full runs — EXCEPT the hosted agent
   in wave A and the wiring agent in wave C. Validation while another deploy is mid-flight
   reads a mixed worker version and fails spuriously.
7. NO root `npm test` / `npm run build` during waves A/B (builder dirs are mid-construction
   and workspaces would fail spuriously). Run only your own server's tests.
8. npm install at root must be serialized across parallel builders:
   `while ! mkdir /tmp/mcp35-npm.lock 2>/dev/null; do sleep 5; done` ... `rmdir /tmp/mcp35-npm.lock`.
9. Tool descriptions are a build input: `remote/build-vendor.mjs` applies ~113 exact string
   patches and throws on a miss. If you edit a server description, grep build-vendor.mjs for
   the matching patch and update both sides.
10. Files you own are listed in your task. Do not edit files owned by another agent
    (data/kpi.json, data/ledger.json, index.html, dashboard/, README.md root = orchestrator).

## Wave A (6 agents, parallel)

- funnel: why 65 human checkout sessions -> 0 paid. Forensic, no purchases.
- google: why Googlebot covers 2/171 URLs, 0 impressions 99+ days. Source fixes only.
- hosted: 34 -> 37 hosted endpoints. SOLE wave-A deployer.
- quality: seam defects 123/148 -> 148/148 where real.
- variants: phrase-variant registry names for top blind-question servers (prep; publish only
  if no worker change needed).
- distribution: census 49 surfaces; submit everything autonomously submittable.

## Wave B (4 builders, parallel, disjoint dirs)

Fields measured 2026-09-11 in docs/LOOP34_FIELDS_R1.md (positive control passed; zeros are
real zeros). Winnability rule: total_count < 100, no star wall, no full-phrase incumbent.

| server | buyer query | field size | name coverage of repo name |
|---|---|---|---|
| supplier-list | mcp supplier list | 0 | 1.00 |
| service-agreement | mcp service agreement | 4 | 1.00 |
| maintenance-log | mcp maintenance log | 4 | 1.00 |
| mileage-log | mcp mileage | 4 | 1.00 (2 of 2) |

Template: servers/job-card (built in loop 34, proven contract suite 20/20, hosted, mirrored).

## Wave C (orchestrator-run after A+B)

wiring: worker shim SERVER_COUNT + 4 new endpoints, storefront product/setup pages, sitemap,
mcpb bundles, 4 mirror repos with full query-phrase name+description+topics coverage,
registry names (primaries + phrase variants), ONE wrangler deploy, full validate.mjs,
root npm test. Then mirror-content agent: blind-question FAQ sections in the top-8 mirror
READMEs (exact question phrasing as headers, our server as the answer).

## Wave D (orchestrator)

kpi.mjs refresh, update-dashboard.mjs, docs/LOOP35_RESULT.md, OPERATOR_ACTIONS_LOOP35.md,
git commit, sound notification (afplay).
