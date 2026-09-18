# STRATEGY-44.md — 2026-09-18

STATUS: in progress

## Read of the data (cold)
- 13/53 distribution surfaces. mcpmux #300 pending merge. MCPmarket 12/42, zero link equity.
- KPI: Googlebot 2/190, GPTBot 90/141 tracked pages, ClaudeBot 140/141, bingbot 35/141, YandexBot 113.
  -> Bing-family crawling (35/190 ≈ 18%) is the weakest major crawler despite IndexNow 190/190 accepted twice.
  -> GPTBot missing 51 pages: guides(26) + /s(13) + compare(6) + setup(3) + root(3) — but 50 guides ARE covered, so
     the uncovered guides are likely the OLDER/less-linked ones. Internal fan-in just shipped; crawl should follow.
- Human-gated: GSC/Bing verification, CF Auto Minify, npm, Stars, MCPmarket claim.

## S44 tasks (autonomous-only, $0)
- T1_GPTBOT_DELTA_R1: identify the exact 51 GPTBot-uncovered URLs, check what the 50 covered ones have in common
  (recency? inbound links?), strengthen linking to uncovered set, IndexNow the delta. -> docs/T1_GPTBOT_DELTA_R1.md
- T2_BING_DELTA_R1: exact 155 bingbot-uncovered URLs; verify IndexNow key file 200; resubmit delta; check
  bingbot fetch pattern (does it hit /s/ pages at all?). -> docs/T2_BING_DELTA_R1.md
- T3_INTERNAL_LINKS_R2: second fan-in wave — /compare pages and /setup pages linking to /s; guides linking guides
  (hub-and-spoke). Target: raise median inbound /s links from 3 to 6+. Ship via GUIDE/COMPARE content arrays.
  -> docs/T3_INTERNAL_LINKS_R2.md
- T4_MCPMUX_FOLLOWUP_R1: check PR #300 review state (gh CLI, read-only); prepare 2 more registry JSON entries
  (office-suite, bill-of-sale) as a second PR only if #300 is merged or reviewed; else park in branch. -> docs/T4_MCPMUX_FOLLOWUP_R1.md
- T5_COMMUNITY_OUTREACH_R2: find 3 new GitHub issues/discussions where a theluckystrike server genuinely answers the
  question; draft (NOT post — posting needs my approval per never-ping rule) with exact URLs + suggested reply text.
  -> docs/T5_COMMUNITY_OUTREACH_R2.md
- T6_MONETIZATION_MAP_R1: audit current payment rails on the 42 /s pages (checkout links, Stars, upgrade paths);
  produce table server -> payment options visible -> gaps. Feed the "rock solid map with payment options" goal.
  -> docs/T6_MONETIZATION_MAP_R1.md

## Constraints
- Agents: leaf, 30 iterations, deliverable-first, STATUS blocks, no billing/src edits except T3 (I patch+deploy myself if needed — actually T3 may edit billing/src content arrays; give T3 exclusive ownership of billing/src/content.js COMPARE/GUIDE link tables, no deploy; I test+deploy).
- No commits by children. Orchestrator commits.
