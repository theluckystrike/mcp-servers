# T27 — Purchase-Requisition 0-Fail — S48-3

STATUS: complete
RESULT: verified-green
DATE: 2026-09-19

## Result
`node --test test/contract.test.mjs` in servers/purchase-requisition: **20 tests, 20 pass, 0 fail**.
Build: `npm run build` exit 0.

## Fixes this loop (final 6 → 3 → 0)
- **#9** buy-URL regex hyphen vs underscore (test-side, contract.test.mjs ~199-211)
- **#10** resource URI camelCase → kebab-case `purchase-requisition://contract` in src/index.ts registerResource + content uri (real server bug), then `npm run build`
- **#11** expected dir array mis-sorted in test; harness `open()` writes the profile dir — server was innocent
- **#16** src filename underscore `purchase_requisition.ts` (test-side)
- **#19 estate registrations** (all verified by the suite's regex sweep):
  - scripts/build-mcpb.sh (SERVERS, DISPLAY_NAME, KEYWORDS), scripts/build-pages.mjs, scripts/gen-spec.mjs
  - servers/office-suite/src/index.ts CHILDREN, servers/invoice/src/index.ts PROFILE_READERS
  - scripts/validate.mjs: live probe `purchaseRequisition:` (~line 961) + honest STDIO-only note in remote() (~line 2206)
  - data/facts.json `purchaseRequisition` 8-key entry (43 servers), data/tools.json 14-tool honest entry
  - README.md `[mcp-purchase-requisition]` table row, scripts/sync-mirrors.sh ALL_SERVERS (kebab), scripts/mirror-seo.py CAPABILITY + topics
- **#20** data/distribution.json per_server.purchaseRequisition (honest `hosted: "pending deploy:"`) + validate.mjs remote() documented exclusion

## Honesty notes
- purchase-requisition is stdio-only: no hosted URL asserted anywhere. remote() carries an explicit comment why it is excluded from the hosted tools/list sweep (packing-list/checklist precedent).
- tools.json descriptions mirror the server's own tool descriptions.
