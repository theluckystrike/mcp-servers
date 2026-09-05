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
| 2 | PRODUCTS entry, bundle derived to twenty-five and $436 | done | billing/src/index.js PRODUCTS["cash-book"], price_1UCOv4JKCamubEm15469I5YT; SERVER_COUNT 25 and BUNDLE_SAVING_USD 436 both derive from PRODUCTS, bundle desc reads "Saves $436 against buying twenty-five". NUMBER_WORD gained a 25 row and billing/test/checkout.test.mjs moved to /^Twenty-five MCP servers/ |
| 3 | office-suite CHILDREN | done | servers/office-suite/src/index.ts CHILDREN, one entry, verified by re-reading the block |
| 4 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | done | scripts/build-mcpb.sh SERVERS, DISPLAY_NAME "Cash Book", KEYWORDS |
| 5 | sync-mirrors ALL_SERVERS + topics_for | done | scripts/sync-mirrors.sh ALL_SERVERS and topics_for (bookkeeping double-entry ledger accounting) |
| 6 | data/facts.json | done | data/facts.json servers.cash-book, inserted as text at the file's own indent 2 so the diff is added lines only |
| 7 | build-pages ids, regenerate, deploy billing | done | scripts/build-pages.mjs ids; `node scripts/build-pages.mjs` regenerated billing/src/pages.js over 25 pages; billing deployed by wrangler, version af9702eb. /s/cash-book 200, /buy/cash-book 303, /guides/one-ledger-from-every-server 200, /setup/claude-web/cash-book 200 |
| 8 | data/tools.json from a live tools/list | done | data/tools.json, 8 rows read from a live tools/list over stdio on a fresh XDG_DATA_HOME |
| 9 | scripts/validate.mjs probes + buy list, validate green | done | scripts/validate.mjs PROBES["cash-book"], 12 assertions per tier, plus cash-book in the buy list. `node scripts/validate.mjs` 713/713, exit 0 |
| 10 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | done | billing/src/setup.js SETUP_SERVERS entry, six ANGLE entries, one WEB_ANGLE; the module was imported to prove it parses |
| 11 | guide /guides/one-ledger-from-every-server | done | billing/src/content.js GUIDES["one-ledger-from-every-server"], 9 FAQ rows, 8,067 bytes of html |
| 12 | compare_none note | done | data/facts.json compare_none.cash-book, 5 tokens probed on the live registry API on 2026-09-06 |
| 13 | demo GIF under 400 KB | done | assets/demo-cash-book.gif, 361,417 bytes, re-encoded at 10 fps on a 64-colour palette and a frame read back for legibility |
| 14 | assets/cash-book-logo.png | done | assets/cash-book-logo.png, 400x400 |
| 15 | Docker catalog entry + repin 25 entries + PR 4892 body row | done | fork commit 41bcc19 on add-theluckystrike-mcp-servers: servers/cash-book/server.yaml added and all 25 entries repinned to ca1636e after the HEAD check; PR 4892 body gained the row, the name list and the twenty-five/ca1636e pin line |
| 16 | Cline marketplace issue | done | https://github.com/cline/mcp-marketplace/issues/2453 |
| 17 | data/distribution.json hosted row | done | data/distribution.json per_server.cash-book.hosted, inserted at the file's own indent 1 so the diff is 13 added lines |
| 18 | Round 29 user-value run into data/user_value_r29.json | todo | |
| 19 | `node scripts/release-check.mjs` green | GREEN | 25 servers at 0.14.0, 27 checks each, 0 recorded gaps |

Not in scope here: `remote/src/index.ts` SERVERS (`endpoint`), which the remote agent owns.
