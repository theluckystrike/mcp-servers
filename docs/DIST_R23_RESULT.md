# Distribution round 23: wire mcp-change-order into the estate (2026-09-06)

status: IN PROGRESS

Written first as a checklist and updated as each item closes, so a stalled agent leaves a
verifiable state rather than an unknown one. An item is `done` only once the file exists on
disk in its final shape and the evidence column holds a measured result, never a plan.

Opening state: `node scripts/release-check.mjs` -> 30 servers, 28 checks each; the
change-order line reads 14 FAIL plus the `product` named gap (docs/CHANGE_ORDER_RESULT.md).
The hosting agent, running in parallel, owns `remote/` and the hosted fields of
`data/distribution.json` (hosted-row, endpoint); this round does not touch either.

Three named product gaps are expected at the end of this round: the Stripe key still lacks
`product_write` (docs/HUMAN_GATED_PACK.md), so `change-order` ships the literal price
`PENDING_HUMAN` exactly as `work-order` and `catalogue` did.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | office-suite CHILDREN | done | b5fdec9, `servers/office-suite/src/index.ts` CHILDREN, one entry, optional true |
| 2 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | done | b5fdec9, `scripts/build-mcpb.sh` SERVERS, DISPLAY_NAME "Change Order", KEYWORDS; `bash -n` clean |
| 3 | sync-mirrors ALL_SERVERS + topics_for | done | b5fdec9, `scripts/sync-mirrors.sh` ALL_SERVERS and topics_for (change-order variation-order scope-change contract-value) |
| 4 | build-pages ids | done | b5fdec9, `scripts/build-pages.mjs` ids, 30 entries |
| 5 | data/facts.json server row, added lines only | done | `data/facts.json` servers["change-order"], inserted as text at the file's own indent: 22 insertions, 0 deletions across the server row and the compare_none note together |
| 6 | data/facts.json compare_none note, 30-day TTL, with a control | done | `data/facts.json` compare_none["change-order"], 4 tokens (change-order, variation-order, scope-change, contract-value) probed on 2026-09-06 on registry.modelcontextprotocol.io/v0/servers?search=, all 0, the two-word form 0, control `service` 100 in the same minute; ttl 30 days |
| 7 | data/tools.json from a live stdio tools/list | done | `data/tools.json`, 11 rows read from a live tools/list over stdio on a fresh XDG_DATA_HOME, no licence key. 46 insertions, 0 deletions |
| 8 | data/distribution.json per_server row, added lines only, hosted fields left to the hosting agent | done | `data/distribution.json` per_server["change-order"], 13 insertions, 0 deletions; `hosted` left as a pending placeholder naming the hosting agent, so the hosted-row check stays red until that agent writes the published value |
| 9 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | todo | |
| 10 | guide /guides/change-orders-and-contract-value-from-chat | todo | |
| 11 | validate.mjs PROBES["change-order"] with the 100x assertion re-derived from each payload's own items | todo | |
| 12 | validate.mjs asserts /buy/change-order 503 | todo | |
| 13 | demo GIF under 400 KB, scripts/demo/change-order.tape + drive.mjs branch | todo | |
| 14 | assets/change-order-logo.png 400x400 | todo | |
| 15 | build-pages regenerated, billing deployed by wrangler | todo | |
| 16 | live: /s/change-order 200, /buy/change-order 503 price-pending-human, guide 200, /setup/claude-web/change-order 200 | todo | |
| 17 | Docker catalog entry + repin 30 entries + PR 4892 body row | todo | |
| 18 | Cline marketplace issue in the shape of 2460 | todo | |
| 19 | `node scripts/release-check.mjs` change-order green apart from product and hosted-row | todo | |
| 20 | `node scripts/validate.mjs` run, remote block count reported only | todo | |

## Evidence

(filled in as items close)
