status: DONE

evidence:

```
$ npm install                     # root, workspaces
changed 2 packages in 399ms

$ npm run build -w servers/spreadsheet -w servers/bank-statement
> @theluckystrike/mcp-spreadsheet@0.5.0 build
> tsc -p tsconfig.json --declaration && node -e "...chmodSync('dist/index.js',0o755)"
> @theluckystrike/mcp-bank-statement@0.6.0 build
> tsc -p tsconfig.json && node -e "...chmodSync('dist/index.js',0o755)"
(no diagnostics from either)

$ npm test -w servers/spreadsheet -w servers/bank-statement
> @theluckystrike/mcp-spreadsheet@0.5.0 test
# tests 61
# pass 60
# fail 0
# skipped 1                      (pre-existing: "corrupt store is quarantined" is SKIPped, spreadsheet is stateless)
> @theluckystrike/mcp-bank-statement@0.6.0 test
# tests 28
# pass 28
# fail 0
wall: 8.9 s for both workspaces

$ node --test servers/bank-statement/test/parse.test.mjs
# pass 14   # fail 0
$ node --test servers/bank-statement/test/smoke.test.mjs
# pass 6    # fail 0   duration_ms 1391
$ node --test servers/bank-statement/test/corrupt.test.mjs servers/bank-statement/test/concurrency.test.mjs
# pass 8    # fail 0

$ node scripts/validate.mjs
validation db: run 50: 341/341     (unchanged; the script's server list is hardcoded and does not include bank-statement yet)

$ file assets/bank-statement-logo.png
PNG image data, 400 x 400, 8-bit/color RGB, non-interlaced
```

Measured behaviour proved by the tests, not asserted:

- 7 bank shapes read correctly: Revolut (signed amount, `State: REVERTED` dropped), Wise (day-first dates,
  merchant column), mBank (3 preamble lines, `;`, `-19,99 PLN` with the code inside the cell), PKO BP (all
  amounts positive, sign taken from `Typ transakcji`), ING (`Kwota transakcji (waluta rachunku)`), N26
  (currency only in the `Amount (EUR)` header), generic debit/credit columns.
- 60-row import: 60 stored, re-import of the same file stores 0 and reports 60 duplicates.
- 20 concurrent imports across 2 processes on one data dir: 20 accounts, 80 transactions, none lost.
  8 concurrent imports of ONE file into ONE account leave exactly 4 transactions.
- `recurring_detect` on the 60-row fixture: SPOTIFY monthly, 3 occurrences, EUR 9.99, annualised EUR 119.88.
- `reconcile_expenses` against a seeded expense-tracker store: 1 match at 1 day apart, 1 expense with no bank line.
- Free tier: 3rd account refused with `isError: false`; the same import under a Pro key succeeds.

artifacts:

- servers/bank-statement/{src/{index,detect,money,store}.ts, test/{parse,smoke,corrupt,concurrency}.test.mjs,
  package.json, tsconfig.json, README.md, LICENSE, llms-install.md, glama.json, smithery.yaml, Dockerfile,
  server.json, server.mcpb.json, RESULT.md}
- servers/spreadsheet/src/lib.ts, servers/spreadsheet/package.json ("exports" ./lib, build now emits declarations)
- assets/bank-statement-logo.png (400x400, monogram BS)

cost: 42 wall minutes.

failures:

1. `header_line` was reported as 3 for the mBank fixture whose header is on line 4. Cause: the reader filtered
   blank rows out of the grid before searching for the header, so every reported line number was an index into
   the filtered grid, not into the file. Fixed by keeping blank rows in place and skipping them inside the row
   loop. Every `skipped_lines` entry was off by the same amount and is now correct.
2. First `direction()` matched a marker anywhere in the cell as a substring. `"in"` inside a Polish or German
   category word would have booked a card payment as income. Fixed to whole-token matching before it could reach
   a test; multi-word markers ("przelew wychodzacy") still match as phrases.

insight:

The occurrence index is what makes dedupe correct, and it is not obvious which way it has to fail. A key of
date+amount+description alone collapses two identical EUR 3.50 coffees bought on the same day into one
transaction, which silently understates a month. Adding a row index instead breaks re-import, because a bank
that reorders its export or inserts one late-settling line shifts every index after it. The key that works is
date+amount+currency+account+description plus the count of identical rows seen SO FAR in this file, compared
against the count of identical rows already stored: the Nth identical line matches the Nth stored one. Measured
on the 60-row fixture: 60 stored, 60 duplicates on re-import, and 8 concurrent imports of one file across two
processes still leave exactly 4 rows, because the count is read inside the same file lock as the write.

follow-ups for the orchestrator (outside this unit's write scope):

- `scripts/validate.mjs` and the dashboard carry a hardcoded server list; bank-statement is not in it.
- `server.mcpb.json` holds `fileSha256: "TBD"` pending the v0.6.0 release build.
- No `remotes.json` and no `assets/demo-bank-statement.gif` were written.
