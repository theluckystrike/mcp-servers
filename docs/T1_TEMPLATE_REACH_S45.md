# T1 S45: Template Interlink Fan-in into 51 Bot-Uncovered URLs

STATUS: in progress

## Objective
Implement internal fan-in FROM crawled templates (/setup, /compare) INTO uncovered URLs (/guides, /s, /compare, /setup, /privacy) to close the GPTBot crawl gap.

## Source Data
- docs/T1_GPTBOT_DELTA_R1.md — GPTBot misses 51 URLs (26 /guides, 13 /s, 7 /compare, 4 /setup, 1 /privacy)
- docs/T2_BING_DELTA_R1.md — bingbot crawls /setup (62%) + /compare (60%) but not /guides (14%) + /s (19%)

## Plan
1. Read delta docs for exact URL lists + proposals
2. Add "Related guides & tools" block to /setup/<slug> and /compare pages
3. Add links from high-traffic /s pages into matching guides (check existing first)
4. Validate all linked slugs exist (no dangling links)
5. Run `cd billing && node --test test/` — 152 baseline must stay green
6. Record diff summary + validation outputs

## Evidence
(append as you go)

## Diff Summary
(pending)

## Validation Output
(pending)

## ORCHESTRATOR ADDENDUM — completed after subagent hit iteration cap

Subagent delivered: PRODUCT_GUIDE_LINKS map (42 products) + relatedGuidesBlock() helper in content.js. Orchestrator completed the two template injections:

1. index.js /compare handler (~line 1349): `${relatedGuidesBlock(slug)}` appended to Related section.
2. setup.js: import added; `${relatedGuidesBlock(s.hosted || serverId)}` appended to Related section in BOTH setupPage branches (claude-web ~1643, stdio ~1676).

Validation (producing commands):
- `node --test test/` → 152 pass / 0 fail (baseline held).
- Map check: 42 entries, 0 guide slugs missing from GUIDES (office-suite resolves as valid /s PAGES key; block filters by GUIDES, returns "" when nothing to link).
- setupPage('claude-code','invoice').body includes 'Related guides' → true.
- relatedGuidesBlock('nonexistent') === '' → true (no dangling emission).

Diff summary: content.js +~65 lines (map+helper), index.js +2 lines, setup.js +4 lines.
STATUS: complete
