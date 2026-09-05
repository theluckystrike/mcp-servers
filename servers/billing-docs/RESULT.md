status: DONE

evidence:
```
$ npm run build --workspace @theluckystrike/mcp-billing-docs
> tsc -p tsconfig.json --declaration && node -e "...chmodSync('dist/index.js',0o755)"
(no output)

$ npm test --workspace @theluckystrike/mcp-billing-docs
1..34
# tests 34
# pass 34
# fail 0
# duration_ms 3776.344584

$ node scripts/gen-spec.mjs billing-docs
servers/billing-docs/SPEC.md  tools=14 resources=1 prompts=1 failure_modes=9

measured, one process, macOS, warm:
credit_note_create (amount, two VAT rates)   4 ms
credit_note_pdf                             13 ms, 2,440 bytes
purchase_order_create, 200 line items        5 ms, EUR 9959.32
purchase_order_pdf, 200 line items          29 ms, 14,391 bytes, store 69,156 bytes
```

artifacts:
- servers/billing-docs/src/{index,store,pdf,text,lib,version}.ts
- servers/billing-docs/test/{_client,unit,adversarial,corrupt,concurrency,contract}.test.mjs
- servers/billing-docs/{SPEC.md,README.md,RESULT.md,llms-install.md,Dockerfile,smithery.yaml,glama.json}
- servers/billing-docs/{server.json,server.mcpb.json,server.variant.json,server.purchase-order.json}
- docs/BILLING_DOCS_RESULT.md

cost: 58 wall minutes.

failures:
- The report test seeded a purchase order dated 2026-08-01 with a delivery date of 2020-01-01 to
  make it overdue. `purchase_order_create` refuses a delivery date before the order date, so the
  order was never stored and the report answered zero open orders. The refusal is correct; the test
  was fixed, not the server.
- `renderInvoicePdf` cannot be called directly: it hardcodes "INVOICE" in the header, the PDF
  metadata and the running footer, and takes an `Invoice`, which carries `due_date`, `status` and
  `paid_minor` that neither of these documents has. `src/pdf.ts` reproduces that page with the
  title, the reference line, the party label, the date rows and the footer block as arguments.

insight:
Crediting part of a mixed-VAT invoice at a single rate is wrong by far more than rounding. An
invoice of EUR 1,000.00 at 23% plus EUR 500.00 at 8% totals EUR 1,770.00. Credit ten percent of it,
EUR 177.00: at one rate that is net EUR 143.90 and VAT EUR 33.10; split across the rates the invoice
actually used, in proportion to each rate's share of the total, it is net EUR 150.00 and VAT EUR
27.00 (EUR 23.00 at 23%, EUR 4.00 at 8%). The gross the client sees is identical, so nothing on the
client's side ever shows the error, and the VAT line -- the number that goes on a return -- is out
by EUR 6.10, 22.6 percent of it. Measured above and asserted in test/unit.test.mjs.
