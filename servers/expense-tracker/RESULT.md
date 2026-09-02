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

---

# Adversarial audit + user-value run, 2026-09-02 (docs/EXPENSE_AUDIT.md)

status: DONE

evidence:
$ node /private/tmp/mcp-audit/probe.mjs dist/index.js a.jsonl <fresh dir>   # 19 hostile requests
before: TIMEOUT_5S, process SIGKILLed, 3 requests never answered
after:  EXIT=0, 19 responses, every stdout line parseable JSON
$ npm test -w servers/expense-tracker
1..21 / # pass 21 / # fail 0 / # duration_ms 818
$ claude -p ... --mcp-config /private/tmp/uv3/mcp.json --strict-mcp-config --model sonnet
7 scenarios, 19/21, 9 tool calls, 104.0 s total

artifacts:
- /Users/mike/mcp-servers/docs/EXPENSE_AUDIT.md
- /Users/mike/mcp-servers/servers/expense-tracker/src/{index.ts,money.ts,store.ts}
- /Users/mike/mcp-servers/servers/expense-tracker/test/adversarial.test.mjs
- /private/tmp/uv3/{mcp.json,shim.mjs,run.sh,s1..s7.json,exp.csv}

cost: 41 wall minutes

failures:
- category_rules accepted "(a+)+$" and the next expense_add with a 60-character merchant never
  returned; the stdio server was killed at 15 s and every queued request was lost. Fixed:
  substring-first matching, a nested-quantifier check that refuses the pattern at store time, and a
  512-character cap on the matched input.
- markup_percent was Pro-gated; the model routed around it and emitted an invoice line priced off the
  gross with tax_rate 0, the exact double-tax the tool exists to prevent. Fixed: markup is free, the
  20-item cap remains the free limit.
- 1 MB merchant stored verbatim, "XYZ" accepted as a currency, and a EUR-to-JPY currency change
  silently reinterpreted 1234 cents as JPY 1234. All three refused now.

insight:
The paywall was the correctness bug. A limit on a tool the model can approximate by hand does not
stop the work, it moves the arithmetic out of the server and into the model's head, where the invariant
the server enforces (unit_price is the NET, tax_rate carries the VAT) does not exist. Measured: with
markup_percent gated, the model recomputed the line by hand as gross x 1.10; on the same expense
carrying 23% VAT the tool returns net 50.00 x 1.10 = 55.00 with tax_rate 23, while the hand
calculation returns 67.65 with tax_rate 0. Both look like an answer. Only one survives being handed
to invoice_create, which recomputes the tax from tax_rate.
