# Distribution round 18: wire mcp-cash-book into the estate (2026-09-06)

status: IN PROGRESS

This file is written first, as a checklist, and updated as each item closes, so a stalled
agent leaves a verifiable state rather than an unknown one.

Opening state: `node scripts/release-check.mjs` -> 25 servers at 0.14.0, 27 checks each,
17 failures, 15 of them `cash-book` and 2 estate-wide.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SERVER_COUNT 24 -> 25 committed | done | fc01b89, packages/mcp-license/src/index.ts and remote/src/shims/license.ts |
| 2 | PRODUCTS entry, bundle derived to twenty-five and $436 | todo | |
| 3 | office-suite CHILDREN | todo | |
| 4 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | todo | |
| 5 | sync-mirrors ALL_SERVERS + topics_for | todo | |
| 6 | data/facts.json | todo | |
| 7 | build-pages ids, regenerate, deploy billing | todo | |
| 8 | data/tools.json from a live tools/list | todo | |
| 9 | scripts/validate.mjs probes + buy list, validate green | todo | |
| 10 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | todo | |
| 11 | guide /guides/one-ledger-from-every-server | todo | |
| 12 | compare_none note | todo | |
| 13 | demo GIF under 400 KB | todo | |
| 14 | assets/cash-book-logo.png | todo | |
| 15 | Docker catalog entry + repin 25 entries + PR 4892 body row | todo | |
| 16 | Cline marketplace issue | todo | |
| 17 | data/distribution.json hosted row | todo | |
| 18 | Round 29 user-value run into data/user_value_r29.json | todo | |
| 19 | `node scripts/release-check.mjs` green | todo | |

Not in scope here: `remote/src/index.ts` SERVERS (`endpoint`), which the remote agent owns.
