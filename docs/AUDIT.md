# Adversarial pre-publish audit

Date 2026-09-02. Scope: servers/time-tracker, servers/price-tracker, servers/spreadsheet,
servers/invoice, packages/mcp-license, and the fresh-machine install path.
Zero paid API calls. Network use: one GET of the MCP registry schema, plus a local HTTP server
on 127.0.0.1:8792 used as the price-tracker fixture.

Harness: `/private/tmp/mcp-audit/probe.mjs` spawns a bin, writes JSON-RPC lines to stdin, and
flags any stdout line that is not parseable JSON.

## Probe table

| Server | Probe | Result | Fixed |
| --- | --- | --- | --- |
| all | `npm pack` of package + `npm i <tgz>` into fresh `npm init -y` project | PASS | - |
| all | `files` includes dist, dist present in tarball | PASS | - |
| all | shebang `#!/usr/bin/env node` on dist/index.js | PASS | - |
| all | `@theluckystrike/mcp-license` is a dependency at `^0.1.0` (not dev) | PASS | - |
| all | installed bin answers initialize + tools/list within 5 s | PASS | - |
| all | stdout carries only JSON-RPC, no console.log in src | PASS | - |
| all | no network call outside price-tracker fetch (grep fetch/http/net/dns in src) | PASS | - |
| all | free limits match README table | PASS after fix | yes (spreadsheet README) |
| all | bundle key `"*"` unlocks the server | PASS | - |
| all | key for another product rejected with reason | PASS | - |
| all | expired / forged / v9 / malformed key rejected with reason | PASS | - |
| all | README has Claude Desktop, `claude mcp add`, Cursor snippets, free/pro table, buy link, byline | PASS | - |
| all | no emoji in servers/, packages/, README.md (positive control matched) | PASS | - |
| all | server.json validates against the 2025-12-11 registry schema | FAIL, now PASS | yes |
| all | server.json name / registryType / identifier / version / transport | PASS | - |
| time-tracker | timer_stop twice with no timer running | PASS | - |
| time-tracker | timer_stop twice after one start | PASS | - |
| time-tracker | missing required arg, empty project, wrong types | PASS | - |
| time-tracker | 1 MB project string | PASS | - |
| time-tracker | negative minutes, end before start, no end and no minutes | PASS | - |
| time-tracker | minutes 1e15 (unrepresentable date) | PASS | - |
| time-tracker | negative rate, tags as string | PASS | - |
| time-tracker | unknown entry id for delete and edit | PASS | - |
| time-tracker | export_csv to /etc/passwd and to ../../etc | PASS (clean EACCES) | - |
| time-tracker | two processes, same data dir, 20 entry_add each | FAIL | no, documented |
| price-tracker | missing url, url as number, unparseable url | PASS | - |
| price-tracker | file:// and ftp:// schemes | PASS | - |
| price-tracker | page with no price | PASS | - |
| price-tracker | 3 MB page (2 MB read cap) | PASS | - |
| price-tracker | HTTP 404, redirect loop, dead port, 100 KB hostname | PASS | - |
| price-tracker | target_price not a number | PASS | - |
| price-tracker | 6 concurrent watch_add, free limit 3 | FAIL, now PASS | yes |
| price-tracker | watch_refresh writes back a pre-fetch snapshot | FAIL, now PASS | yes |
| price-tracker | price_add_manual with "abc" | PASS | - |
| price-tracker | price_add_manual with "1e999" stored as 1999 | FAIL | no, documented |
| price-tracker | negative target_price accepted | FAIL | no, documented |
| spreadsheet | missing path, path as number | PASS | - |
| spreadsheet | path traversal ../../etc/passwd and /etc/passwd | PASS (reads, no crash) | - |
| spreadsheet | nonexistent file | PASS | - |
| spreadsheet | empty csv, 0-byte xlsx | PASS | - |
| spreadsheet | csv with invalid UTF-8 bytes | PASS | - |
| spreadsheet | xlsx that is not a zip | PASS | - |
| spreadsheet | 1.1 MB csv, 20,000 rows (free cap applies) | PASS | - |
| spreadsheet | 1 MB path string | PASS, error echoes the 1 MB path | no, documented |
| spreadsheet | limit -5 and limit 999999999 | PASS | - |
| spreadsheet | where expression `process.exit(1)`, `require('fs')`, 100 KB expression | PASS | - |
| spreadsheet | unknown tool name | PASS | - |
| invoice | invoice with 0 items | PASS | - |
| invoice | quantity 0, negative unit_price | PASS (accepted by design) | - |
| invoice | unknown currency string, empty currency | FAIL, now PASS | yes |
| invoice | 1000 line items | PASS | - |
| invoice | issue_date 2026-13-45 burns an invoice number | FAIL, now PASS | yes |
| invoice | quantity/unit_price 1e308 stores total_minor null | FAIL, now PASS | yes |
| invoice | discount_percent 1000 | FAIL, now PASS | yes |
| invoice | unknown invoice number for get / mark_paid / pdf | PASS | - |
| invoice | overdue_report on free tier | PASS (upgrade text) | - |
| invoice | missing required args on client_add, invoice_create | PASS | - |
| packages/mcp-license | `files` lists README.md that did not exist; no LICENSE shipped | FAIL, now PASS | yes |

## Failures not fixed

1. Cross-process lost updates, time-tracker (and the same read-modify-write shape in
   price-tracker and invoice). Two processes sharing one data dir, 20 `entry_add` each:
   40 successful tool results, 20 entries in `data.json`, split A=19 B=1. The file stayed
   valid JSON; 20 entries were lost. Each handler does `load()` then `save()` with no
   inter-process lock, so the later `rename` discards the other process's writes while
   still reporting success. A correct fix is an advisory lock file held across the whole
   load-mutate-save cycle in each store, which is larger than a surgical edit and was left
   for the owner. In-process concurrency is now safe in price-tracker (see fixes below);
   time-tracker and invoice handlers have no `await` between load and save, so a single
   process is consistent.
2. price-tracker `price_add_manual` with price `"1e999"` is normalised to `1999`. Nonsense
   input becomes a plausible-looking price instead of an error.
3. price-tracker accepts a negative `target_price` and stores it.
4. spreadsheet echoes the full path in `file not found`, so a 1 MB path produces a 1 MB
   error text.
5. spreadsheet identifies any non-csv file as `format: xlsx`, including /etc/passwd. It
   parses without crashing but the reported format is wrong.
6. `serverInfo.name` is inconsistent: `time-tracker` and `price-tracker` use the bare id,
   `mcp-spreadsheet` and `mcp-invoice` use the npm-style name.

## Edits made

| File:line | Change |
| --- | --- |
| servers/price-tracker/src/index.ts:154-166 | `watch_add` re-reads the store after `await observe()` and re-checks both the duplicate-URL case and `FREE_WATCH_LIMIT` against the fresh file. Before: 6 concurrent `watch_add` stored 1 watch and bypassed the free limit of 3. After: 3 stored, 3 refused with the upgrade text. |
| servers/price-tracker/src/index.ts:266-272 | `watch_refresh` merges the refreshed watches into a freshly loaded store instead of saving the snapshot taken before the fetches, so a watch added during a refresh is not dropped. |
| servers/invoice/src/index.ts:144-155 | `itemSchema` bounds `quantity` and `unit_price` to a finite +/-1e12 and `tax_rate` to -100..1000. Before: `1e308` produced `total_minor: null` in invoices.json and printed `EUR Infinity.NaN`. |
| servers/invoice/src/index.ts:181-190 | `issue_date` is checked for calendar validity before `nextNumber()` is called, and `due_days` must be a whole number. Before: `2026-13-45` passed the regex, consumed invoice number INV-2026-0004, then threw `Invalid time value`, leaving a permanent gap in the sequence. |
| servers/invoice/src/index.ts:196-202 | Currency must be a 3-letter code, and a total that is not a safe integer is refused. Before: currency `""` rendered totals as `" 10.00"`. |
| servers/invoice/src/index.ts:69,231,235,251-255,259 | `default_currency` and `currency` constrained to `^[A-Za-z]{3}$`; `discount_percent` constrained to 0..100; `hours` and `rate` bounded like item amounts. |
| servers/time-tracker/server.json:4, servers/price-tracker/server.json:4, servers/spreadsheet/server.json:4, servers/invoice/server.json:4 | `description` shortened to at most 100 characters. All four were 128-172 characters and failed the registry schema `maxLength: 100`, which would have rejected the registry publish. |
| servers/time-tracker/package.json:8, servers/price-tracker/package.json:8, servers/invoice/package.json:8 | `server.json` added to `files` (spreadsheet already had it). |
| packages/mcp-license/README.md | Created. `files` listed a README that did not exist. |
| packages/mcp-license/LICENSE | Added (MIT, copied from the repo root). |
| packages/mcp-license/package.json:9 | `LICENSE` added to `files`. |
| servers/spreadsheet/README.md:78 | Free-vs-Pro table now names `sheet_add_column` and `sheet_convert` as read-capped, which is what the code enforces via `open()`. |

## Test summary after fixes

```
@theluckystrike/mcp-license    # tests 10  # pass 10  # fail 0
@theluckystrike/mcp-invoice    # tests 12  # pass 12  # fail 0
@theluckystrike/mcp-price-tracker  # tests 18  # pass 18  # fail 0
@theluckystrike/mcp-spreadsheet    # tests 31  # pass 31  # fail 0
@theluckystrike/mcp-time-tracker   # tests 2   # pass 2   # fail 0
```

Post-fix install verification, packed and installed again from tarballs into a second fresh
project:

```
time-tracker: EXIT=0 toolsListReturned=1 nonJsonStdoutLines=0
price-tracker: EXIT=0 toolsListReturned=1 nonJsonStdoutLines=0
spreadsheet: EXIT=0 toolsListReturned=1 nonJsonStdoutLines=0
invoice: EXIT=0 toolsListReturned=1 nonJsonStdoutLines=0
```

Post-fix server.json validation against
https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json:

```
time-tracker  {"schemaValid":true,"name":true,"registryType":true,"identifier":true,"versionMatch":true,"transport":true}
price-tracker {"schemaValid":true,"name":true,"registryType":true,"identifier":true,"versionMatch":true,"transport":true}
spreadsheet   {"schemaValid":true,"name":true,"registryType":true,"identifier":true,"versionMatch":true,"transport":true}
invoice       {"schemaValid":true,"name":true,"registryType":true,"identifier":true,"versionMatch":true,"transport":true}
```

---

status: PARTIAL
evidence: |
  npm pack + npm i of 5 tarballs into a fresh project: "added 169 packages in 4s"; all four
  bins answered initialize + tools/list, 0 non-JSON stdout lines.
  ajv against the 2025-12-11 registry schema, before: all four
  "must NOT have more than 100 characters" at /description (128, 156, 172, 149). After: all
  four schemaValid true.
  price-tracker, 6 concurrent watch_add on free tier, before: "stored watches: 1"; after:
  "stored watches: 3" plus 3 "The free tier tracks 3 items at a time".
  invoice, issue_date 2026-13-45, before: counter.json "INV-2026": 6 with 5 invoices
  (0004 burned); after: "Error: issue_date must be a real calendar date as YYYY-MM-DD" and
  counter.json "INV-2026": 1 with 1 invoice.
  invoice, quantity/unit_price 1e308, before: stored invoice with "total_minor": null and
  "EUR Infinity.NaN"; after: "quantity is out of range at items[0].quantity".
  time-tracker, two processes x 20 entry_add on one data dir: 40 success responses,
  "valid JSON, entries=20 {"B":1,"A":19}".
  npm test across the workspace after fixes: 10/12/18/31/2 pass, 0 fail.
artifacts: |
  docs/AUDIT.md
  /private/tmp/mcp-audit/probe.mjs, /private/tmp/mcp-audit/*.jsonl (probe scripts)
  /private/tmp/mcp-audit/proj, /private/tmp/mcp-audit/proj2 (fresh install projects)
  /private/tmp/mcp-audit/proj/val.mjs (server.json schema validator)
cost: 27 wall minutes
failures: |
  server.json descriptions over the registry's 100-character limit on all four servers, which
  would have failed the registry publish. Shortened.
  price-tracker watch_add awaited the network between load() and save(), so concurrent calls
  lost every watch but the last and bypassed the free limit of 3. Re-read and re-check after
  the await.
  invoice accepted an impossible issue_date after allocating the invoice number, permanently
  burning a number, and accepted 1e308 amounts that persisted null totals. Both validated
  before allocation now.
  packages/mcp-license shipped no README and no LICENSE despite listing them. Added.
  Cross-process lost updates in the JSON stores remain: 20 of 40 entries lost with two
  processes on one data dir. Not fixed, needs an advisory lock across load-mutate-save.
insight: |
  The free-tier paywall was enforced against a stale read. In price-tracker the limit check
  ran on a db loaded before an awaited network fetch, so six watch_add calls issued together
  all saw zero watches and all passed the check; only one survived the last write. The gate
  logic was correct and the crypto was correct, and the paywall still did not hold, because
  the check and the write were separated by an await. Every measured license bypass in this
  audit was a concurrency bug, not a licensing bug.

---

## Concurrency fix 2026-09-02

Fixes failure 1 above (cross-process lost updates). An advisory lock is now held across the
whole load-mutate-save cycle in time-tracker, price-tracker and invoice.

`withFileLock<T>(lockPath, fn, opts?)` was added to `packages/mcp-license/src/lock.ts` and is
exported from the package index. The lock is a directory: `mkdirSync` is atomic, `EEXIST`
means another process holds it. Waiters retry with 5-25 ms jittered sleeps until `timeoutMs`
(default 5000) and then throw. A lock directory whose mtime is older than 30 s is treated as
abandoned by a crashed process and removed. The lock is released in `finally`. Pure node, no
dependencies.

| File | Change |
| --- | --- |
| packages/mcp-license/src/lock.ts | New. `withFileLock`, `STALE_MS`. |
| packages/mcp-license/src/index.ts | Re-exports `withFileLock` and `STALE_MS`. |
| servers/time-tracker/src/index.ts | `LOCK = join(dataDir(), ".lock")`; `timer_start`, `timer_stop`, `entry_add`, `entry_delete`, `entry_edit`, `project_set_rate` bodies wrapped in `withFileLock`, so `load()` runs inside the lock. Reads (`timer_status`, `entry_list`, `report`, `export_csv`, `invoice_summary`) stay unlocked. |
| servers/price-tracker/src/index.ts | `LOCK = join(dataDir(), ".lock")`. `watch_remove` and `price_add_manual` wrapped whole. `watch_add` fetches outside the lock, then takes the lock for the post-fetch re-read, duplicate check, free-limit check and save. `watch_refresh` fetches outside the lock, then takes it for the load-merge-save. `watch_list`, `price_history`, `alerts_pending` and the resource stay unlocked. |
| servers/invoice/src/index.ts | `locked()` helper over `join(dataDir(), ".lock")`; `business_set`, `client_add`, `invoice_create`, `invoice_from_hours` (both via `createInvoice`, which allocates the invoice number) and `invoice_mark_paid` run inside it. `client_list`, `invoice_list`, `invoice_get`, `invoice_pdf`, `overdue_report` stay unlocked. |
| servers/invoice/src/store.ts | `writeJson` tmp file is now `<file>.<pid>.tmp`, matching the other two stores. Two processes shared one `.tmp` name and raced `rename`, which produced hard ENOENT tool errors. |
| packages/mcp-license/test/lock.test.mjs | New, 5 tests. |
| servers/time-tracker/test/concurrency.test.mjs, servers/price-tracker/test/concurrency.test.mjs, servers/invoice/test/concurrency.test.mjs | New. Each spawns TWO server processes on one `XDG_DATA_HOME` temp dir, fires 20 mutating calls at each concurrently (40 total), waits for all 40 responses, then asserts the stored count is exactly 40, the ids are unique and the JSON file parses. |

### Measured before / after

Same test, same machine. "Before" was measured by replacing the compiled
`packages/mcp-license/dist/lock.js` with a pass-through `withFileLock` (run the body, no lock)
and rebuilding afterwards.

| Server | Mutating call | Calls issued | Stored before | Stored after |
| --- | --- | --- | --- | --- |
| time-tracker | `entry_add` | 40 (2 x 20) | 26 | 40 |
| price-tracker | `price_add_manual`, distinct URLs | 40 (2 x 20) | 21 | 40 |
| invoice | `client_add` | 40 (2 x 20) | 24 | 40 |

The original audit run of the same time-tracker probe stored 20 of 40. The loss count varies
with scheduling; every unlocked run lost writes, and all 40 tool calls still reported success.
The stored JSON stayed valid in every case, so the data loss is silent. With the lock, three
consecutive runs of each of the three tests passed 1/1.

### Test summaries, verbatim

```
> @theluckystrike/mcp-license@0.1.0 test
# tests 15
# pass 15
# fail 0
> @theluckystrike/mcp-invoice@0.1.0 test
# tests 13
# pass 13
# fail 0
> @theluckystrike/mcp-price-tracker@0.1.0 test
# tests 19
# pass 19
# fail 0
> @theluckystrike/mcp-spreadsheet@0.1.0 test
# tests 31
# pass 31
# fail 0
> @theluckystrike/mcp-time-tracker@0.1.0 test
# tests 3
# pass 3
# fail 0
```

`npm run build` at the root: clean, all five workspaces.

`node scripts/validate.mjs`:

```
time-tracker: 18/18 in 239 ms
price-tracker: 18/18 in 270 ms
spreadsheet: 16/16 in 382 ms
invoice: 20/20 in 371 ms
billing: 10/10
validation db: /Users/mike/mcp-servers/data/validation.json run 5: 82/82
```
