# T5 S45: guide→guide RELATED mesh expansion

STATUS: in progress

## Objective
Expand the guide→guide RELATED mesh for topical clusters (value-first; internal links = crawl paths + session depth).

## Findings
(append as you go)

## Clusters Identified
(8-10 topical clusters)

## Related-Links Mechanism
(how each guide renders related links)

## RELATES Map
(data-driven related-guide additions)

## Validation
- all referenced slugs exist
- mesh symmetry decision

## Test Results
- cd billing && node --test test/ — baseline 152 green

## ORCHESTRATOR ADDENDUM — completed after subagent hit iteration cap

Subagent delivered the validated GUIDE_RELATED map (in /tmp/guide_related.js). Orchestrator inserted + wired it:

- content.js: GUIDE_RELATED (109 entries, symmetric, 13 clusters) inserted after PRODUCT_GUIDE_LINKS.
- index.js: import added; "Related guides:" paragraph in guide page Related section (filtered by GUIDES, no dangling).

Validation:
- Map pre-insert check: 109 entries / 109 GUIDES / 0 bad slugs / 0 asymmetry / degree 2-3.
- node --test test/ → 152 pass / 0 fail.
- Deliverable relocated billing/docs/ → docs/ (path fix).

STATUS: complete
