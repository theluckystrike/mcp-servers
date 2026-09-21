# DIST R7 — PR re-audit + glama sweep + dead-surface reprobe (2026-09-21)

Round 7 of the directory-distribution loop, run inline by the orchestrator
(delegates failed 4x on iteration budget; see memory note). No new surfaces
submitted — the Albertchamberlain work item from r6 was already resolved
(its PR #52 went MERGED).

## PR re-audit (12 open)
- punkpeye #14559–14565 (7): all still OPEN, no labels lost. open-green.
- rohitg00 #338: OPEN, MERGEABLE, CLEAN.
- wagneragent #81: OPEN, MERGEABLE, CLEAN.
- habitoai #144: OPEN, MERGEABLE, CLEAN (review answered).
- mgoldsborough/awesome-mcpb #11: OPEN, MERGEABLE but UNSTABLE — repo defines
  no CI (empty rollup, 0 comments); unstable state is trivial, no action.
- DhanushNehru #85: OPEN, UNSTABLE.
- toolsdk #514: OPEN, idle since 09-12.
- YuzeHao2023 #473, MobinX #420, mctrinh #112, JustInCache #44, collabnix #112,
  abordage #106: not individually re-rolled this round (low maintainer activity).

## Merges confirmed since r6
- Albertchamberlain/Awesome-MCP PR #52 → MERGED. Entry live in Productivity
  (README line 222, cites mcp.zovo.one/mcp/invoice).
- mcpHQ PR #62 → MERGED.

## Glama sweep
- scripts/glama-watch.mjs live run: 12/47 server pages listed, 35 connectors
  listed, 0 gained / 0 lost vs r6. The 35 "absent" are mirror-repo page misses,
  not registry misses (connectors are the canonical Glama surface and cover
  effectively the whole estate).

## Dead-surface reprobe
- mcp.pizza: BACK ONLINE (200; was dead in r6). Search for zovo → no results;
  /server/zovo-mcp-servers 308s. Resurrected as a real surface — r8 action:
  locate the submit form and file the entry.
- mcp.so: still blocked (issue #4227 alive; server pages 404).
- mcpindex.net, portal.mcpcentral.io: still dead (connection failure).
- appcypher: still archived.

## Census
- PRs open: 12 · PRs merged (cumulative): 8
- Glama: 12 servers + 35 connectors
- Inbound live surfaces: 14 → 15 (mcp.pizza resurrected, entry pending)
- New submissions this round: 0

## Human-gated (unchanged)
npm publish token, GSC/Bing verification, outreach posting, CF Auto Minify,
Stripe dashboard audit.
