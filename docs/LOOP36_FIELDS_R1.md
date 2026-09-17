# Loop 36: candidate new-server fields, round 1

Measured 2026-09-12 (same day as loop 35, method identical to docs/LOOP34_FIELDS_R1.md).
Raw API output: `data/loop36_fields_raw.json`. Positive control passed:
`modelcontextprotocol` total_count 1249, first hit modelcontextprotocol/modelcontextprotocol
(zeros below are real zeros). Search budget: 30/30 before, 18 calls made.

## Buildable queue (all pass: total_count < 100, no star wall, no full-phrase incumbent)

| rank | candidate | query | total_count | top-3 (stars, name coverage) |
|---|---|---|---|---|
| 1 | retainer-agreement | mcp retainer agreement | 0 | EMPTY |
| 2 | staff-rota | mcp staff rota | 0 | EMPTY |
| 3 | goods-received-note | mcp goods received note | 0 | EMPTY |
| 4 | handover-note | mcp handover note | 0 | EMPTY |
| 5 | equipment-checkout | mcp equipment checkout | 0 | EMPTY |
| 6 | rent-invoice | mcp rent invoice | 0 | EMPTY |
| 7 | subcontractor-agreement | mcp subcontractor agreement | 0 | EMPTY |
| 8 | late-fee-calculator | mcp late fee | 1 | 2/0.00 |
| 9 | commission-calculator | mcp commission calculator | 1 | 0/0.67 |
| 10 | visitor-log | mcp visitor log | 2 | 2/0.67, 1/0.33 |
| 11 | purchase-requisition | mcp purchase requisition | 2 | 9/0.33, 0/0.00 |
| 12 | punch-list | mcp punch list | 3 | 0/0.33, 1/0.33, 0/0.33 |
| 13 | delivery-note | mcp delivery note | 4 | 0/0.33, 0/0.00, 0/0.00 |

Not buildable (field >= 100 rule skipped none; these failed on size or caveat): price-list 64,
incident-report 45, appointment-booking 38, service-report 51 — all pass the <100 gate but sit
above the loop-36 build budget; queue them behind the 13 above.

## Next 4 picks (loop 36 wave B), ranked by field size then buyer-intent clarity

1. **retainer-agreement** — field 0; freelanced buyer intent is unambiguous; sibling of
   service-agreement (loop 35), can share the clause-library pattern but NOT code.
2. **staff-rota** — field 0; every small shop with part-timers needs a rota; distinct from
   calendar (personal) and time-tracker (after-the-fact).
3. **late-fee-calculator** — field 1, incumbent has 0.00 coverage; pairs with dunning-letters
   and invoice; pure arithmetic, cheap to make excellent.
4. **commission-calculator** — field 1, incumbent 0/0.67; sales-comp math is painful and
   frequent.

Then: goods-received-note, handover-note, equipment-checkout, rent-invoice,
subcontractor-agreement, visitor-log, purchase-requisition, punch-list, delivery-note.

## Query each new repo must fully cover

| repo | query | name coverage |
|---|---|---|
| mcp-retainer-agreement | mcp retainer agreement | 1.00 |
| mcp-staff-rota | mcp staff rota | 1.00 |
| mcp-late-fee-calculator | mcp late fee (calculator in description+topics) | 1.00 of name terms |
| mcp-commission-calculator | mcp commission calculator | 1.00 |
