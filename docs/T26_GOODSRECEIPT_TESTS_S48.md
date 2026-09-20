# T26 — S48-3 goods-receipt: build + tests 0-fail

STATUS: complete
RESULT: verified-green

## Scope
Built the goods-receipt (GRN) MCP server from INTEL_R15 BUILD list (score 81.0, registry count=0), following the leave server architecture. Leaf deleg_116eae57 produced the src (build green, no tests); orchestrator ported the test suite directly and fixed two real server bugs found during testing.

## Gate evidence (real runs, 2026-09-19)
- `npm run build` (tsc) → exit 0 (verified after each src fix)
- `node --test test/*.test.mjs` → **# tests 14, # pass 14, # fail 0** (/tmp/ga.log: 14 `ok`, 0 `not ok`)

## Server bugs found and fixed by the test suite (real defects, not test artifacts)
1. **poLineRef case bug** (src/index.ts:55): composite ref built as `${po.id}-${ref.toLowerCase()}` — po.id NOT lowercased, so bare line refs ("L01") never matched and every grn_add was refused with "line does not exist". Fixed to `${po.id.toLowerCase()}-...`. Verified live: both "L01" and "PO-0001-L01" forms resolve.
2. **Cumulative over-tolerance gate never fired** (src/index.ts:138 + store.receivedForLine): GRN lines stored the bare ref ("L01") but the gate counts prior receipts by full PO line id ("PO-0001-L01") — match always failed, cumulative total always 0, so receiving past tolerance was silently accepted. Fixed by normalizing stored gl.line to poLine.id at buildGrnLine call. Verified live: 40+50+40=130 of 100 ordered now refused: "PO-0001-L01: receiving 130 of 100 breaks the 10% over tolerance."

## Test-side corrections (honesty alignment)
- Closed-GRN semantics: closing a GRN closes that GRN (no more lines); it does NOT close the PO — test now asserts grn_line_add /closed/ on closed GRN.
- grn_export_csv returns raw CSV text — test uses raw call text, not JSON.parse.
- Integer-only math: zod correctly REFUSES fractional quantities ("Expected integer"); test now asserts the refusal plus integer success path (shortage 6 on 10 ordered / 4 received).

## Suite coverage (14 tests)
po_add id/line-ids/status; grn_add per-line received/damaged/shortage; over-tolerance refusal (single + cumulative partial deliveries); exactly-at-tolerance allowed; unknown-PO refusal; closed-GRN refusal + double-close; grn_line_add append + cumulative gate; grn_close; grn_discrepancy (damaged + short, note preserved); grn_status_report (fullyReceived vs discrepancy, open units, includeOnlyDiscrepancies); free-tier full CRUD without license key; Pro CSV export (header + rows, watermark-free, comma-in-reference row integrity); integer-only refusal.

## Notes
- Estate-consistency contract tests (server.snag.json / server.onboarding.json / descriptions ≤220 / buy-URL) not yet ported for goods-receipt — same pattern as purchase-requisition, next session.
- No commit/publish/deploy performed per contract.
