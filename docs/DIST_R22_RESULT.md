# Distribution round 22: wire mcp-catalogue into the estate (2026-09-06)

status: IN PROGRESS

Written first as a checklist and updated as each item closes, so a stalled agent leaves a
verifiable state rather than an unknown one.

Opening state: `node scripts/release-check.mjs` -> 29 servers, 28 checks each, 16 failures,
14 of them `catalogue` and 2 estate-wide, plus the `work-order` named product gap carried
over from round 21.

Two named product gaps are expected at the end of this round, not one: the Stripe key in the
keychain still lacks `product_write` (docs/HUMAN_GATED_PACK.md), so `catalogue` ships the
literal price `PENDING_HUMAN` exactly as `work-order` did.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SERVER_COUNT 28 -> 29 committed | todo | |
| 2 | PRODUCTS entry, bundle derives twenty-nine and $512 | todo | |
| 3 | validate.mjs asserts /buy/catalogue 503 | todo | |
| 4 | office-suite CHILDREN | todo | |
| 5 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | todo | |
| 6 | sync-mirrors ALL_SERVERS + topics_for | todo | |
| 7 | data/facts.json | todo | |
| 8 | build-pages ids, regenerate, deploy billing | todo | |
| 9 | data/tools.json from a live tools/list | todo | |
| 10 | validate.mjs probes + buy list | todo | |
| 11 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | todo | |
| 12 | guide /guides/price-lists-and-rate-cards-from-chat | todo | |
| 13 | compare_none note | todo | |
| 14 | demo GIF under 400 KB | todo | |
| 15 | assets/catalogue-logo.png | todo | |
| 16 | Docker catalog entry + repin 29 entries + PR 4892 body row | todo | |
| 17 | Cline marketplace issue | todo | |
| 18 | data/distribution.json hosted row | todo | |
| 19 | Round 37 user-value run into data/user_value_r37.json | todo | |
| 20 | `node scripts/release-check.mjs` green apart from the two named product gaps | todo | |

Not in scope here: `remote/src/index.ts` SERVERS (`endpoint`), which the remote agent owns.
