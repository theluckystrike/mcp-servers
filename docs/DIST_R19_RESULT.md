# Distribution round 19: wire mcp-amortization into the estate (2026-09-06)

status: IN PROGRESS

This file is written first, as a checklist, and updated as each item closes, so a stalled
agent leaves a verifiable state rather than an unknown one.

Opening state: `node scripts/release-check.mjs` -> 26 servers at 0.15.0, 27 checks each,
17 failures, 15 of them `amortization` and 2 estate-wide.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SERVER_COUNT 25 -> 26 committed | done | 64bf5a5, packages/mcp-license/src/index.ts and remote/src/shims/license.ts, by path |
| 2 | PRODUCTS entry, bundle derived to twenty-six and $455 | todo | |
| 3 | office-suite CHILDREN | todo | |
| 4 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | todo | |
| 5 | sync-mirrors ALL_SERVERS + topics_for | todo | |
| 6 | data/facts.json | todo | |
| 7 | build-pages ids, regenerate, deploy billing | todo | |
| 8 | data/tools.json from a live tools/list | todo | |
| 9 | scripts/validate.mjs probes + buy list, validate green | todo | |
| 10 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | todo | |
| 11 | guide /guides/loan-and-lease-schedules-from-chat | todo | |
| 12 | compare_none note | todo | |
| 13 | demo GIF under 400 KB | todo | |
| 14 | assets/amortization-logo.png | todo | |
| 15 | Docker catalog entry + repin 26 entries + PR 4892 body row | todo | |
| 16 | Cline marketplace issue | todo | |
| 17 | data/distribution.json hosted row | todo | |
| 18 | Round 31 user-value run into data/user_value_r31.json | todo | |
| 19 | `node scripts/release-check.mjs` green | todo | |

Not in scope here: `remote/src/index.ts` SERVERS (`endpoint`), which the remote agent owns.
