status: DONE

evidence:

```
$ export npm_config_cache=/Users/mike/.npm-cache-local
$ npm install            # repo root, once
added 75 packages in 4s

$ npm run build -w servers/invoice
> tsc -p tsconfig.json && node -e "import('node:fs').then(f=>f.chmodSync('dist/index.js',0o755))"
npm run build -w servers/invoice  1.67s user 0.08s system 231% cpu 0.754 total

$ npm test -w servers/invoice
1..12
# tests 12
# suites 0
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 566.367084
npm test -w servers/invoice  0.80s user 0.15s system 132% cpu 0.720 total
```

Test names, all passing:
```
ok 1  - roundHalfUp is half-up and float-stable
ok 2  - toMinor and formatMoney respect currency decimals
ok 3  - 12 hours at 90 EUR with no tax
ok 4  - multiple tax rates group into one line per rate
ok 5  - default tax rate applies only to lines without their own
ok 6  - discount is applied per line before tax
ok 7  - rounding is per line then summed, not on the raw total
ok 8  - JPY has zero decimals end to end
ok 9  - JPY discount rounds to whole yen
ok 10 - date helpers are ISO and UTC stable
ok 11 - stdio: initialize, tools/list, full invoice lifecycle, PDF
ok 12 - free tier blocks a 4th invoice in a calendar month; Pro allows it
```

PDF render check, 40 line items, out-of-band:
```
$ pdfinfo big.pdf | grep -iE "pages|page size"
Pages:           3
Page size:       595.28 x 841.89 pts (A4)
$ pdftotext big.pdf - | tail -12
Total
EUR 9492.42
PAYMENT DETAILS
IBAN: PL61
Bank: Test Bank
Reference: INV-2026-0009
Please pay by 2026-03-16.
NOTES
Late payment interest per contract.
Lucky Strike Software | VAT ID PL123
Invoice INV-2026-0009 | page 3 of 3
Generated with mcp-invoice by theluckystrike
```

Smoke test asserts, over stdio JSON-RPC: initialize returns serverInfo.name "mcp-invoice"; tools/list contains all 12 tools; resources/list contains invoices://open; business_set, client_add, client_list, invoice_create (INV-2026-0001, subtotal EUR 1130.00, tax lines 8% and 23%, total EUR 1382.40 = 138240 minor), invoice_get, invoice_pdf (file exists, first 5 bytes "%PDF-", size > 1024), invoice_mark_paid, invoice_list by status, invoice_from_hours, overdue_report gated as plain text with isError false. Pro path uses MCP_LICENSE_KEY from `node scripts/sign-license.mjs invoice`: license_status reports tier pro, 4 invoices in 2026-04 all created with the custom prefix ACME, overdue_report returns 4 rows and totals ["EUR 400.00"], Pro PDF has no branding line. Each server runs against its own XDG_DATA_HOME / XDG_CONFIG_HOME temp dir from mkdtempSync.

artifacts:
- /Users/mike/mcp-servers/servers/invoice/src/index.ts
- /Users/mike/mcp-servers/servers/invoice/src/money.ts
- /Users/mike/mcp-servers/servers/invoice/src/pdf.ts
- /Users/mike/mcp-servers/servers/invoice/src/store.ts
- /Users/mike/mcp-servers/servers/invoice/test/money.test.mjs
- /Users/mike/mcp-servers/servers/invoice/test/smoke.test.mjs
- /Users/mike/mcp-servers/servers/invoice/package.json
- /Users/mike/mcp-servers/servers/invoice/tsconfig.json
- /Users/mike/mcp-servers/servers/invoice/server.json
- /Users/mike/mcp-servers/servers/invoice/smithery.yaml
- /Users/mike/mcp-servers/servers/invoice/Dockerfile
- /Users/mike/mcp-servers/servers/invoice/README.md
- /Users/mike/mcp-servers/servers/invoice/LICENSE
- /Users/mike/mcp-servers/servers/invoice/RESULT.md
- /Users/mike/mcp-servers/servers/invoice/dist/ (build output)

cost: 19 wall minutes

failures:
- pdfkit's `doc.bufferedPageRange()` returned a count of 1 because `bufferPages` was not set, so the per-page footer would have been written only to the last page. Fixed by constructing the document with `bufferPages: true` and writing the footer in a `switchToPage` loop after `doc.end()` content is laid out.
- The totals value column was 60pt wide, which wrapped the bold 11pt "EUR 9492.42" onto two lines. Caught by pdftotext, not by the assertions. Fixed by moving the totals label column left (M+215, width 175), giving the value 125pt.
- First smoke run asserted the wrong expected total (EUR 1408.40). The computed EUR 1382.40 was correct: 1080.00 + 50.00 + 23% of 1080.00 (248.40) + 8% of 50.00 (4.00). Assertion corrected.
- The smoke test's 20s per-request timeout timers kept the event loop alive, so the file took 20.5s to exit. `timer.unref()` brought it to 0.57s.

insight:
The float-stability epsilon in `roundHalfUp` is load-bearing, not decoration. 1.005 * 100 evaluates to 100.49999999999999 in IEEE 754, so a plain `Math.floor(v + 0.5)` rounds a 1.005 unit price down to 100 cents instead of 101. Measured across the money suite this is the only place a naive implementation diverges, and it diverges silently by one cent per affected line, which then compounds through the per-line tax step. Doing the rounding per line rather than on the raw total is what makes the error bounded and visible: with three lines at 0.005 EUR the per-line rule gives 3 cents and matches the three printed "0.01" rows, while rounding the 0.015 sum gives 2 cents and produces an invoice whose lines do not add up to its own total.
