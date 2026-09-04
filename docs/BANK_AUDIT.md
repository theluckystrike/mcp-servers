# mcp-bank-statement: adversarial audit and user-value run

Date 2026-09-04. Scope: `servers/bank-statement` only (src, test, README) plus this file.
Zero paid API calls. No network: `grep -rEn "fetch|https?://|node:http|node:net|node:dns" servers/bank-statement/src/`
returns nothing; the only URL in the built server is the checkout link inside the license gate's text.

Part 1 harness: `/private/tmp/bsaudit/probe.mjs` spawns `node servers/bank-statement/dist/index.js` with a fresh
`XDG_DATA_HOME`, writes JSON-RPC lines to stdin, prints every response with a millisecond offset and flags any
stdout line that does not parse as JSON. Fixtures in `/private/tmp/bsaudit/fx/`, 24 requests across five runs,
free tier and Pro (`node scripts/sign-license.mjs bank-statement`).

Part 2 harness: the real `claude` CLI as an MCP client against `/private/tmp/uv80/mcp.json`, which registers
`bank-statement` (Pro key) and `expense-tracker` (free) together, `--strict-mcp-config`, fresh
`XDG_DATA_HOME=/private/tmp/uv80/data` and `XDG_CONFIG_HOME=/private/tmp/uv80/cfg`, `--model sonnet`,
`--output-format json`, and an explicit per-tool allowlist of all 26 `mcp__bank-statement__*` /
`mcp__expense-tracker__*` tools (the wildcard `mcp__*` grants nothing, docs/EXPENSE_AUDIT.md D-E4).

---

## Part 1 - adversarial probes

| # | Probe | Before | Fixed | After |
| --- | --- | --- | --- | --- |
| 1 | `statement_import` with no arguments | PASS | - | zod: `Required at path` |
| 2 | `statement_import {path: 123}` | PASS | - | zod: `Expected string, received number at path` |
| 3 | 50 MB CSV, 200,000 rows (38.8 MB on disk) | PASS | - | refused before the read: `that file is 37.0 MB; the limit is 32 MB. Split the export by month.` |
| 4 | 20 MB CSV, 200,000 rows | PASS | - | **2.0 s** to parse, dedupe and store 200,000 rows; a `statement_summary` by month plus a `transactions_search` over that store, in the same process, took the whole session to **4.6 s**. `data.json` is 84 MB; peak RSS of the harness process 44 MB |
| 5 | free 12-month window: import or query? | PASS | - | enforced on **query**, never on import. Import stores every row and says so (`Everything was stored, but the free tier only READS the last 12 months.`); `transactions_list` / `transactions_search` / `statement_summary` move `from` to the cutoff and each response carries the reason. Deliberate: a file on disk must not disagree with the bank |
| 6 | UTF-16 BOM (little-endian, as Excel on Windows writes it) | **FAIL** | yes | before: `no header row was found in the first 25 lines ... The first line reads: ��D a t e , D e s c r i p t i o n`. After: 2 rows imported. Both byte orders handled (D-B3) |
| 7 | CR-only line endings | PASS | - | 2 rows, `header_line 1`; the spreadsheet reader treats a bare `\r` as a row break |
| 8 | quoted description with a comma, an embedded newline and doubled quotes | PASS | - | `ACME, Inc. Invoice 7` and `say "hi", ok` stored whole; the newline is collapsed to a space, the CSV export re-quotes both |
| 9 | `1.234,56` / `1,234.56` in one file | PASS | - | both 123456 minor |
| 10 | `(12.50)` accounting negative | PASS | - | -1250 minor |
| 11 | `12.50-` trailing minus | **FAIL (silent sign flip)** | yes | before: **+1250**, a debit stored as income. After: -1250 (D-B1) |
| 12 | `-` and an empty amount cell | PASS | - | both skipped and named: `"-" is not an amount`, `"" is not an amount`, with the file line number |
| 13 | mixed currencies in one file | PASS | - | EUR/PLN/JPY kept per row with the right minor units (JPY 30 = 30 minor); summaries group per currency and never add across |
| 14 | `03/04/2026` with no value above 12 anywhere | PASS | - | reads day-first and says so: `the date column is ambiguous (no value above 12 in either position), so it was read as day/month/year`; `date_order_inferred: false` marks the assumption. `13/04/2026` sets `date_order_inferred: true` |
| 15 | file with no header row | PASS | - | refused with the first line quoted back and what a header needs |
| 16 | header-only file | PASS | - | `rows_read 0, imported 0, date_range null`; the account is created empty, no error |
| 17 | duplicate re-import | PASS | - | 200,000 rows: `imported 0, duplicates_skipped 200000` |
| 18 | rule `(a+)+$` with `regex: true`, then a 60-char description | PASS | - | `refused_as_regex: ["(a+)+$"]`, used as a substring; the following import returned in under 5 s |
| 19 | rule with an empty match | **FAIL** | yes | before: accepted, and `categorised: 2` stamped `Everything` on every transaction including one with no description at all. After: refused, `Nothing was changed` (D-B2) |
| 20 | `reconcile_expenses` with no expense store | PASS | - | `expense_ledger_found: false` and the path it looked at; no error |
| 21 | `reconcile_expenses` with a corrupt expense store | PASS | - | the foreign ledger is read defensively: a parse failure returns `expenses: []` with a note naming the file, and rows of the wrong shape are dropped one by one. This server never writes that file |
| 22 | `statement_export` to `../../../../etc/passwd` | PASS | - | resolves against cwd like any path the user types, then `EACCES: permission denied, open '/etc/passwd.<pid>.tmp'`; the tmp file is unlinked, no partial write. There is no sandbox and there should not be: the caller names the path |
| 23 | `statement_export` over an existing file | **FAIL (silent)** | yes | before: replaced it with no mention. After: still replaces it (a monthly export is re-run), but the result carries `overwrote_existing_file: true` and a note. A path that is a directory is refused by name (D-B5) |
| 24 | corrupt own store | PASS | - | `data.json` that is not JSON is moved to `data.json.corrupt-<stamp>`, a `.corrupt` marker is written, and every later call fails with `restore a good copy ... then delete the marker`. Covered by `test/corrupt.test.mjs` |
| 25 | two processes, one data dir | PASS | - | `test/concurrency.test.mjs`: 20 concurrent imports across 2 processes leave 20 accounts and 80 transactions; 8 concurrent imports of one file into one account leave exactly 4 rows |
| 26 | stdout carries only JSON-RPC | PASS | - | no `console.*` in `src/`; the probe flagged 0 non-JSON lines across all five runs; asserted again in `test/adversarial.test.mjs` |

### Defects found and fixed in Part 1

**D-B1 (high) - a trailing minus was read as income.**
`12.50-` is how several German, Polish and SAP-derived exports write a debit. `parseNumberLoose` (in
`servers/spreadsheet`, out of this unit's write scope) strips a trailing non-digit run before parsing, so the
sign was dropped and the row was stored as **+12.50**. On a statement that writes every debit this way, every
expense in the file becomes income and the month's net is wrong by twice the spend.
Repro (pre-fix): import a CSV holding `2026-08-04,trailing minus,12.50-,EUR`; `data.json` holds
`"amount_minor": 1250`.
Fixed in `src/detect.ts`: `parseMoneyCell()` takes the trailing sign off the cell before the number is parsed and
applies it to the result, and is used for the amount, the debit, the credit and the balance columns.
`test/adversarial.test.mjs` "a trailing minus is a debit, not income".

**D-B2 (high) - a rule with an empty match categorised the entire ledger.**
`category_rules {rules: [{match: "", category: "Everything"}]}` was accepted; the matcher's substring path is
`description.includes("")`, which is true for every row, so one call silently rewrote every uncategorised
transaction, including a row whose description is empty. Repro (pre-fix): the call above, then
`transactions_list` - every row reads `"category": "Everything"`.
Fixed in `src/index.ts`: a match that is empty or whitespace is refused with the reason and nothing is written.

**D-B3 (medium) - a UTF-16 export could not be imported at all.**
`readFileSync(p, "utf8")` on a UTF-16 file turns `Date` into `D\0a\0t\0e`, the header search then fails, and the
error blames the user's file ("check that this is the CSV export and not a PDF converted by hand"). Excel on
Windows writes UTF-16 for "Unicode Text" and several bank portals do the same. Repro (pre-fix): the fixture at
`/private/tmp/bsaudit/fx/utf16.csv`.
Fixed in `src/index.ts`: `readStatementText()` reads the bytes, honours a UTF-16 byte-order mark either way, and
falls back to UTF-8 when there is none.

**D-B5 (low) - export replaced an existing file silently.** Now reported, and a directory target is refused.

Not fixed, by decision: `statement_export` does not confine the path. The caller names the file, the same as
`expense_export` in docs/EXPENSE_AUDIT.md probe 12; a traversal outside the user's own permissions fails with a
clean EACCES and leaves no partial file, which is the property that matters.

---

## Part 2 - user value through a real MCP client

Data written for the run: `/private/tmp/uv80/revolut.csv`, 40 rows in Revolut's export shape
(`Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance`): Spotify EUR 9.99 on
2026-07-05, 2026-08-05 and 2026-09-01; two Adobe EUR 61.50 charges (08-07 and 08-21); a client payment of
EUR +4,500.00 on 08-12; seven Costa Coffee lines; an Amazon refund of EUR +24.99; 25 other card payments; and one
`REVERTED` row that must not reach the ledger. The expense-tracker store was seeded first with the Adobe receipt
through `expense_add` (EUR 61.50, 2026-08-07, merchant "Adobe Systems").

### Scorecard - 13 / 18 after the fixes, 12 / 18 as shipped

3 = correct, right numbers, no clarification needed. 2 = correct but with a gap the user has to close.
1 = partially wrong or unanswered. 0 = failed.

| # | Prompt | Before | After | Turns | Sec | Note |
|---|---|---|---|---|---|---|
| s1 | "Import my Revolut export as Main." | 3 | 3 | 5 | 13.5 | 39 of 40 rows stored under account `Main`, the `REVERTED` line dropped and named, Revolut profile detected, dates read `ymd`. Verified against `data.json`: 39 transactions, one account |
| s2 | "Categorise Spotify and Adobe as Software, coffee as Meals." | 3 | 3 | 4 | 15.6 | Wrote three rules (`spotify`, `adobe`, `coffee`) to **both** servers unprompted and re-applied them: 5 Software (3 Spotify + 2 Adobe) and 7 Meals in `data.json`, exactly the rows the CSV holds |
| s3 | "What did I spend in August by category?" | **1** | **1** | 3 | 17.9 | Answered from `expense-tracker.expense_summary`, not from the bank: "Software EUR 61.50", the single seeded receipt, and reported the expense-tracker 30-day free window as if it were the answer's only flaw. The bank ledger it had just imported and categorised was never queried (D-B4) |
| s4 | "Which subscriptions am I paying?" | **2** | **3** | 4 | 17.7 | Before: Spotify monthly EUR 9.99, annualised EUR 119.88 (correct), and **Adobe "fortnightly, annualised EUR 1,599.00"** off two charges 14 days apart. After the fix the tool withholds the yearly figure until a third charge (`cadence_confirmed: false`) and the answer says "only 2 charges so far - unconfirmed" with no annual number (D-B6) |
| s5 | "Which of my expenses have no bank line, and which bank lines have no receipt?" | 2 | 2 | 4 | 37.0 | `reconcile_expenses` matched the Adobe receipt to the 08-07 debit at 0 days apart, 0 expenses without a bank line, 36 of 37 debits without a receipt - all correct and independently verified. Not a 3 because the model spent the first third of its answer on the expense-tracker free-tier window and its upsell text rather than on the reconciliation |
| s6 | "Export September to /private/tmp/uv80/sept.csv." | **1** | **1** | 1 | 5.6 | Asked which server to export from and which year, wrote no file. Repeated after the description fix, same result (D-B4) |

Total wall time 107 s for six prompts. s1 and s2 were re-run after a harness mistake overwrote their transcripts;
the re-run of s1 therefore reports the duplicate path (`imported 0, duplicates_skipped 39`), which is itself
correct. Their effect on the store, quoted above, is from the original run.

### Numbers verified independently from the CSV

Computed straight from `/private/tmp/uv80/revolut.csv` with a Python `csv.DictReader`, `State == COMPLETED`,
`Completed Date` in August:

| | rows | money out | money in |
| --- | --- | --- | --- |
| Software (Spotify + Adobe) | 3 | EUR 132.99 | - |
| Meals (Costa Coffee) | 6 | EUR 21.30 | - |
| everything else | 25 | EUR 878.38 | EUR 4,524.99 |
| **August total** | **34** | **EUR 1,032.67** | **EUR 4,524.99**, net EUR +3,492.32 |

The server's own `statement_summary` for the same range reproduces those figures. The s3 answer - EUR 61.50 in
one category - is 6 % of the real August spend, and nothing in it says the bank data was not consulted.
September holds four completed lines (Spotify 9.99, Costa 3.60, Biedronka 25.00, Zabka 6.40); s6 wrote none of
them, so `/private/tmp/uv80/sept.csv` does not exist.

### Defects from Part 2

**D-B4 (high, not fixable inside this server) - with two servers connected, "what did I spend" goes to the wrong
one, and "export September" goes to neither.**
Both s3 and s6 are the same failure: `expense-tracker` and `bank-statement` both offer a plausible tool, and the
model either picks the smaller ledger (s3) or refuses to choose (s6). What makes s3 damaging rather than merely
incomplete is that `expense_summary` answers confidently from one seeded receipt while the bank ledger with 39
rows sits unqueried in the same session.
Attempted server-side fix, measured and kept but ineffective: `statement_summary` retitled "What I spent, from
the bank account" with a description that names the exact question, `statement_export` retitled "Export bank
transactions to a file" naming "export September to <path>". Re-running both prompts against the rebuilt server
changed neither answer (s3b: still `expense_summary`, EUR 61.50; s6b: still asks which server). Tool-description
wording is not the lever. Fix direction, outside this unit: expense-tracker's `expense_summary` should say in its
own answer that it covers hand-logged receipts only and name the bank tool when a bank ledger exists on the same
data dir; alternatively `office-suite`-style single-server packaging removes the choice.

**D-B6 (medium) - two charges produced a yearly cost.** `recurring_detect` needed only `min_occurrences: 2`, and
two charges are one interval: 14 days between the two Adobe payments became "fortnightly, annualised EUR
1,599.00" for what is a monthly EUR 61.50 subscription billed twice. Repro (pre-fix): import two identical
charges 14 days apart and call `recurring_detect {months: 6}`.
Fixed in `src/index.ts`: `annualised` is `null` and `cadence_confirmed` is `false` until a third charge confirms
the interval, with `cadence_note` saying why. The detection itself still reports the pair, which is what the user
asked to see. Test: "two charges never produce a yearly cost".

---

## Edits made

| File | Change |
| --- | --- |
| `src/detect.ts` | `parseMoneyCell()`: a trailing minus is taken off the cell before parsing and applied as the sign; used for amount, debit, credit and balance (D-B1) |
| `src/index.ts` | `readStatementText()`: UTF-16 byte-order mark honoured either way, UTF-8 otherwise (D-B3) |
| `src/index.ts` | `category_rules` refuses a rule whose match is empty or whitespace (D-B2) |
| `src/index.ts` | `statement_export` reports `overwrote_existing_file` and refuses a directory target (D-B5) |
| `src/index.ts` | `recurring_detect`: `annualised` withheld and `cadence_confirmed: false` until a third occurrence (D-B6) |
| `src/index.ts` | `statement_summary`, `statement_export`, `recurring_detect` titles and descriptions name the bank ledger explicitly (D-B4, measured ineffective, kept because it is accurate) |
| `test/adversarial.test.mjs` | new file, 11 tests: trailing minus, dash/empty amounts, CR-only + quoted fields, date-order reporting, mixed currencies, no header / header-only, UTF-16 import, empty rule refused, catastrophic regex bounded, export overwrite reporting, two-charge annualisation |
| `README.md` | file shapes read (encodings, line endings, amount formats, ambiguous dates), the three tool-table rows above |

## Test summary

```
$ npm run build -w servers/bank-statement
> tsc -p tsconfig.json && node -e "...chmodSync('dist/index.js',0o755)"
(no diagnostics)

$ npm test -w servers/bank-statement
# tests 39
# pass 39
# fail 0
# duration_ms 1538

$ BS_TEST_PRO_KEY=$(node scripts/sign-license.mjs bank-statement) npm test -w servers/bank-statement
# tests 39
# pass 39
# fail 0
```

39 tests, up from 28. The Pro key is optional: without it the two tests that need a Pro tool assert the free
path instead (export writes no partial file) or return early.

## RESULT.md block

```
status: DONE

evidence:
$ node /private/tmp/bsaudit/probe.mjs dist/index.js <probe file> <fresh dir> [pro key]   # 24 hostile requests, 5 runs
0 non-JSON stdout lines, 0 hangs, 0 unanswered requests
200,000-row / 20 MB import: 2.0 s; import + summary + search in one session: 4.6 s; data.json 84 MB
38.8 MB file refused before the read at the 32 MB cap
$ BS_TEST_PRO_KEY=$(node scripts/sign-license.mjs bank-statement) npm test -w servers/bank-statement
# tests 39 / # pass 39 / # fail 0 / # duration_ms 1538
$ claude -p ... --mcp-config /private/tmp/uv80/mcp.json --strict-mcp-config --model sonnet
6 prompts, 13/18 after fixes (12/18 as shipped), 107 s

artifacts:
- /Users/mike/mcp-servers/docs/BANK_AUDIT.md
- /Users/mike/mcp-servers/servers/bank-statement/src/{index.ts,detect.ts}
- /Users/mike/mcp-servers/servers/bank-statement/test/adversarial.test.mjs
- /Users/mike/mcp-servers/servers/bank-statement/README.md
- /private/tmp/bsaudit/{probe.mjs,fx/*,out*.txt}, /private/tmp/uv80/{revolut.csv,mcp.json,allow.txt,s1..s6.json}

cost: 58 wall minutes

failures:
- "12.50-" was stored as +12.50: parseNumberLoose strips a trailing non-digit run, so the debit marker used by
  German, Polish and SAP-derived exports became income. Fixed by taking the sign off the cell in detect.ts.
- category_rules accepted an empty match, and one such rule stamped its category on every transaction, because
  the substring path is includes(""). Refused now.
- a UTF-16 export could not be imported at all and the error blamed the user's file. The BOM now selects the
  decoder.
- recurring_detect annualised two Adobe charges 14 days apart into EUR 1,599.00 a year. The yearly figure is
  withheld until a third charge.

insight:
The free-tier window is the difference between the two servers in this pair, and it decides who answers.
bank-statement applies its 12-month limit on the way OUT and says so in every response that moved a date;
expense-tracker's 30-day limit is applied the same way, but its ledger held one seeded receipt, so its partial
answer was also a complete-looking one. Asked "what did I spend in August by category" with both servers
connected, the model took the EUR 61.50 from the one-receipt ledger over the 39-row bank ledger it had imported
and categorised two prompts earlier, and reported the 30-day window as the only caveat. Retitling the bank tool
"What I spent, from the bank account" and naming the exact question in its description changed nothing on a
re-run. A limit that is enforced on the query rather than the import is honest about the rows it dropped, but it
cannot say anything about the rows that live in a different server.
```

---

## D-B4 follow-up (2026-09-04, expense-tracker side)

The retitle-only fix recorded above was measured ineffective. The fix direction it named -
"expense-tracker's expense_summary should say in its own answer that it covers hand-logged
receipts only and name the bank tool when a bank ledger exists on the same data dir" - is now
built inside `servers/expense-tracker`.

`servers/expense-tracker/src/store.ts` adds `readBankTransactions()`, mirroring
`kanban`'s `timeTrackerProjects()` and `bank-statement`'s own `readExpenses()`: same XDG data
root, `${XDG_DATA_HOME}/mcp-servers/bank-statement/data.json`, read-only, best effort. Missing
file, unreadable file, or a row of the wrong shape all fall back silently; only `date`,
`amount_minor` and `currency` are trusted off a foreign row.

`servers/expense-tracker/src/index.ts` adds `bankLedgerLine(from, to, tool)`, called from both
`expense_summary` and `expense_export`. It reads the sibling store, counts the bank
transactions that fall inside the requested period, and stays silent (no field, no line) when
the store is absent, corrupt, or holds nothing in range. When the count is nonzero it appends
one line naming the count and the exact bank tool to call:

`expense_summary` gets a new `bank_ledger` field in its JSON response, e.g.
`"The bank ledger (mcp-bank-statement) holds 34 transactions in this period that are not
counted here; call that server's statement_summary for them."`. `expense_export` appends the
same line, naming `statement_export`, to its plain-text result.

The tool descriptions for `expense_summary` and `expense_export` each gained one sentence
saying they cover manually logged receipts only and that imported bank transactions live in
the bank-statement server, and both stayed under the 220-char contract-test ceiling (189 and
199 chars).

Tests: `servers/expense-tracker/test/bank-sibling.test.mjs`, 8 new cases - the line present
with a populated sibling store in range, and absent with no sibling store, an out-of-range
sibling store, and a corrupt sibling store, for both tools, plus the description-length and
description-content check. `npm test -w servers/expense-tracker`: 53 tests, 53 pass (up from
45). `npm test -w servers/bank-statement`: unchanged, 39 tests, 39 pass (bank-statement was
not touched).

### Re-run of s3 and s6 against the real claude CLI

Same recipe as Part 2: `/private/tmp/uv80/mcp.json` (bank-statement Pro key + expense-tracker
free), `--strict-mcp-config`, `--model sonnet`, `--output-format json`, `--max-turns 14`, the
same 26-tool `--allowedTools` from `allow.txt`, against the same seeded data dir (39 bank
transactions imported and categorised, one Adobe receipt logged), each prompt under a 180 s
timeout, one bounded request per prompt.

| # | Prompt | Before (docs above) | After D-B4 fix | Note |
|---|---|---|---|---|
| s3 | "What did I spend in August by category?" | 1 | **3** | Answered from `statement_summary`: "34 transactions, EUR... Total spent EUR 1,032.67 (against EUR 4,524.99 in, net +EUR 3,492.32)" - matches the independently-verified CSV totals in Part 2 exactly. It separately noted "the expense-tracker (receipts you've logged by hand) only shows EUR 61.50 in Software for this period... a much smaller, manually-tracked subset" - the two ledgers are now named as two different things rather than one silently standing in for the other |
| s6 | "Export September to /private/tmp/uv80/sept.csv." | 1 | 1 | Unchanged: "I see two possible data sources with export capability... Which one do you want exported for September?" - `num_turns: 1`, no tool was called at all, so neither server's response text (where the new line lives) was ever read. A per-response line cannot fix a routing failure that happens before any tool is invoked |

s3 moved from float-worthy-of-a-defect to correct because the model called `statement_summary`
directly this run (its own retitled description already named the question); the fix's
practical contribution there is the added clarity that the two ledgers disagree, not the
routing itself. s6 is unchanged and is the residual: D-B4 is fixable inside expense-tracker
only for the case where expense-tracker's own tool actually gets called and answers from a
too-small ledger. The case where the caller asks a routing question and calls nothing needs a
fix outside this unit - single-server packaging (as the original note suggested) or a
top-level tool that lists both ledgers before either summary/export tool is chosen.

Evidence: `/private/tmp/uv80/s3c.json`, `/private/tmp/uv80/s6c.json`.

