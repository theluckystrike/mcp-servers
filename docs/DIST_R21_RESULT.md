# Distribution round 21: wire mcp-work-order into the estate (2026-09-06)

status: IN PROGRESS

Written first as a checklist and updated as each item closed, so a stalled agent leaves a
verifiable state rather than an unknown one.

Opening state: `node scripts/release-check.mjs` -> 28 servers, 27 checks each, 17 failures,
15 of them `work-order` and 2 estate-wide.

The one thing that makes this round different from round 20: the Stripe key in the keychain
lost `product_write` (docs/HUMAN_GATED_PACK.md, 2026-09-06), so NO price id exists for
work-order and none can be minted by this agent. The product entry therefore ships with the
literal price `PENDING_HUMAN`, `/buy/work-order` answers 503 rather than calling Stripe, and
the release checker prints the gap by name instead of either failing the run or counting it
green.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SERVER_COUNT 27 -> 28 committed | todo | |
| 2 | PRODUCTS entry, price "PENDING_HUMAN", bundle derives twenty-eight and $493 | todo | |
| 3 | release-check product check treats PENDING_HUMAN as a named gap | todo | |
| 4 | /buy/work-order answers 503 with the bundle link, never a Stripe call | todo | |
| 5 | validate.mjs asserts the 503 rather than a 303, and says why | todo | |
| 6 | office-suite CHILDREN | todo | |
| 7 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | todo | |
| 8 | sync-mirrors ALL_SERVERS + topics_for | todo | |
| 9 | data/facts.json | todo | |
| 10 | build-pages ids, regenerate, deploy billing | todo | |
| 11 | data/tools.json from a live tools/list | todo | |
| 12 | validate.mjs probes + buy list | todo | |
| 13 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | todo | |
| 14 | guide /guides/work-orders-and-job-cards-from-chat | todo | |
| 15 | compare_none note | todo | |
| 16 | demo GIF under 400 KB | todo | |
| 17 | assets/work-order-logo.png | todo | |
| 18 | Docker catalog entry + repin 28 entries + PR 4892 body row | todo | |
| 19 | Cline marketplace issue | todo | |
| 20 | data/distribution.json hosted row | todo | |
| 21 | Round 35 user-value run into data/user_value_r35.json | todo | |
| 22 | `node scripts/release-check.mjs` green apart from the named product gap | todo | |

Not in scope here: `remote/src/index.ts` SERVERS (`endpoint`), which the remote agent owns,
exactly as in round 20.
