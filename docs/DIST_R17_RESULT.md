# Distribution round 17: wire mcp-statement-of-account into the estate (2026-09-05)

status: IN PROGRESS

This file is written first, as a checklist, and updated as each item closes, so a stalled
agent leaves a verifiable state rather than an unknown one.

Opening state: `node scripts/release-check.mjs` -> 24 servers at 0.13.0, 27 checks each,
17 failures, 15 of them `statement-of-account` and 2 estate-wide.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | PRODUCTS entry, bundle derived to twenty-four and $417 | done | billing/src/index.js PRODUCTS["statement-of-account"], price_1UCLpbJKCamubEm1vvAD4jzZ; SERVER_COUNT 24 and BUNDLE_SAVING_USD 417 both derive, bundle desc reads "Saves $417 against buying twenty-four" |
| 2 | SERVER_COUNT 24 in packages/mcp-license and remote/src/shims/license.ts, bundle-link test at 24 | done | packages/mcp-license/src/index.ts and remote/src/shims/license.ts both at 24; bundle-link test derives the expected count from the gates and is 32/32 green |
| 3 | office-suite CHILDREN | done | servers/office-suite/src/index.ts CHILDREN |
| 4 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | done | scripts/build-mcpb.sh SERVERS, DISPLAY_NAME "Statement of Account", KEYWORDS |
| 5 | sync-mirrors ALL_SERVERS + topics_for | done | scripts/sync-mirrors.sh ALL_SERVERS and topics_for |
| 6 | data/facts.json | done | data/facts.json servers.statement-of-account |
| 7 | build-pages ids, regenerate, deploy billing | todo |  |
| 8 | data/tools.json from a live tools/list | done | data/tools.json, 8 rows read from a live tools/list over stdio |
| 9 | scripts/validate.mjs probes + buy list, validate green | todo |  |
| 10 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | done | billing/src/setup.js SETUP_SERVERS entry, six ANGLE entries, one WEB_ANGLE |
| 11 | guide /guides/client-statements-and-dunning-from-chat | done | billing/src/content.js GUIDES["client-statements-and-dunning-from-chat"], 9 FAQ rows |
| 12 | compare_none note | done | data/facts.json compare_none, 8 tokens probed on the live registry API |
| 13 | demo GIF under 400 KB | done | assets/demo-statement-of-account.gif, 374,711 bytes |
| 14 | assets/statement-of-account-logo.png | done | assets/statement-of-account-logo.png, 400x400 |
| 15 | Docker catalog entry + repin 24 entries + PR 4892 body row | todo |  |
| 16 | Cline marketplace issue | todo |  |
| 17 | data/distribution.json hosted row | done | data/distribution.json per_server.statement-of-account.hosted |
| 18 | Round 26 user-value run into data/user_value_r26.json | todo |  |
| 19 | `node scripts/release-check.mjs` green | GREEN | 24 servers, 27 checks each, 0 gaps |

Not in scope here: `remote/src/index.ts` SERVERS (`endpoint`), which the remote agent owns.
