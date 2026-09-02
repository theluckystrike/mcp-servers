status: DONE

evidence:
```
$ npm run build -w servers/expense-tracker
> tsc -p tsconfig.json && node -e "...chmodSync('dist/index.js',0o755)"
(no output, exit 0)

$ npm test -w servers/expense-tracker
1..14
# tests 14
# pass 14
# fail 0
# duration_ms 784.8335
```
Suites: test/money.test.mjs 10 tests (VAT split exactness over 40 gross/rate pairs, mileage table, per-currency
grouping, half-up rounding, JPY zero-decimal), test/smoke.test.mjs 3 tests (stdio initialize, tools/list of 12 tools,
resources/list expenses://month, prompts/list monthly_close, 3 expenses in EUR and PLN, rule auto-categorisation,
summary by category per currency, 4 mileage rows against all 4 default rates, expense_to_invoice key-shape check
{description, quantity, tax_rate, unit_price}, csv export line count 1+7, free 201-row csv export refused with
existsSync(path) === false, free xlsx refused with no file, pro xlsx written with a PK zip header, pro markup rebill),
test/concurrency.test.mjs 1 test (two processes, 40 adds, 40 stored, 40 unique ids, 20 per currency).

artifacts:
- /Users/mike/mcp-servers/servers/expense-tracker/src/index.ts (10 tools + license_status/license_activate, resource, prompt)
- /Users/mike/mcp-servers/servers/expense-tracker/src/money.ts
- /Users/mike/mcp-servers/servers/expense-tracker/src/store.ts
- /Users/mike/mcp-servers/servers/expense-tracker/test/{money,smoke,concurrency}.test.mjs
- /Users/mike/mcp-servers/servers/expense-tracker/{README.md,LICENSE,llms-install.md,glama.json,smithery.yaml,Dockerfile}
- /Users/mike/mcp-servers/servers/expense-tracker/{package.json,tsconfig.json,server.json,server.mcpb.json}
- /Users/mike/mcp-servers/assets/expense-tracker-logo.png (400x400, RGB, 1809 bytes)

cost: 34 wall minutes

failures:
- test/smoke.test.mjs asserted a rebill unit_price of 9.17 for EUR 10.00 gross at 20% VAT with a 10% markup. Measured
  9.16: the markup is applied to the already-rounded net (833 minor), 833 * 1.10 = 916.3 -> 916. Fixed the expectation,
  not the code: applying the markup to the unrounded net would make the line disagree with the stored expense.
- No other build or test failure. First `tsc` run was clean.

insight:
Rebilling an expense onto an invoice cannot pass the gross amount as unit_price. The invoice server recomputes tax from
tax_rate, so a VAT-inclusive unit_price is taxed a second time: EUR 61.50 at 23% would leave the client invoiced
EUR 75.65 for a EUR 61.50 receipt, a 23% silent overcharge. expense_to_invoice therefore emits the net
(round(gross * 100 / (100 + rate))) as unit_price with tax_rate alongside, which reconstructs the exact original gross
because the split is exact by construction (net + vat == gross, verified over 40 gross/rate pairs). The same argument
forces the per-currency grouping: one invoice carries one currency, so a mixed-currency selection has to be returned as
separate line-item groups rather than one summed list.
