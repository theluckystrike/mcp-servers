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

## Codex v3 fixes (price-tracker)

Scope: `servers/price-tracker` only. Items 1, 30, 31, 32, 34, 35 of `docs/CODEX_REVIEW_V3.md`.

| Item | Was | Fix | Where |
| --- | --- | --- | --- |
| 1 (P0) | Any read or JSON parse failure returned an empty database, so the next mutation overwrote the whole price history. | Only `ENOENT` is empty. A parse failure, a non-database shape, or any other read error moves the file to `watches.json.corrupt-<timestamp>`, logs to stderr and raises a sticky `StoreError`; every tool then answers with that error until the server is restarted, and `save()` refuses to write. | `servers/price-tracker/src/store.ts:49` (StoreError), `src/store.ts:59` (quarantine), `src/store.ts:70` (load), `src/store.ts:97` (save guard), `src/index.ts:138` (all tools report StoreError instead of throwing across the transport) |
| 30 | JSON-LD offers from every product on the page were pooled and the lowest price won, under the first product's name. | Offers are read from the selected product's own `offers` subtree. The product whose name best matches the page title / `og:title` is selected; with no match, the first product carrying offers. Unattached offers are used only when the graph has no product node. | `servers/price-tracker/src/extract.ts:262` (fromJsonLd), `src/extract.ts:252` (titleScore), `src/extract.ts:224` (ownPrice), `src/extract.ts:239` (offerPrices) |
| 31 | `twitter:data1` was a high-confidence price source and returned shipping thresholds. | Removed from the Open Graph key list. | `servers/price-tracker/src/extract.ts:351` |
| 32 | Class-hint extraction took the first price-like value, including a crossed-out old price. | `stripStruckPrices()` removes `<s>`, `<del>`, `<strike>` and elements whose class or id contains `old`, `was`, `strike`, `regular`, `compare`, `list-price` or `rrp` before the hint scan. | `servers/price-tracker/src/extract.ts:402` (stripStruckPrices), `src/extract.ts:416` (fromClassHints) |
| 34 | A `$` was resolved through the ccTLD before any explicit currency text was considered, so `$10 USD` on a `.ca` shop read CAD. | An ISO 4217 code adjacent to the number, or anywhere in a currency token, wins; the ccTLD is used only for a bare symbol with no explicit code. | `servers/price-tracker/src/extract.ts:442` (explicitCode), `src/extract.ts:457` (firstPriceInText), `src/extract.ts:468` (firstCurrencyToken), `src/extract.ts:497` (regex fallback) |
| 35 | Any newly introduced `/products/` segment was classified as a listing, even when the SKU survived. | `products`, `product`, `p` and `dp` are not listing segments when the requested product identity survives in the final URL and the final title is a real product title. Every other category segment, `/cat/` included, still refuses. | `servers/price-tracker/src/redirect.ts:83` (PRODUCT_ROUTE_SEGMENTS), `src/redirect.ts:151` (listing test) |

Tests added: `servers/price-tracker/test/store.test.mjs` (4 tests: ENOENT is empty; garbage bytes preserved under
`watches.json.corrupt-*` and load/save both fail; non-database JSON quarantined; `price_add_manual`, `watch_remove`
and `watch_list` all return `isError` over stdio while the bad bytes stay on disk), 7 in `test/extract.test.mjs`
(items 30, 31, 32, 34) and 4 in `test/redirect.test.mjs` (item 35: `/item/12345` -> `/products/widget?sku=12345`
accepted, the same redirect with a generic title refused, identity-losing `/products/widgets` refused, IKEA `/cat/`
still refused).

`npm test` in `servers/price-tracker` (was 39 tests before this work):

```
# tests 54
# suites 0
# pass 54
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2012.418167
```

`npm run build` at the root: clean, all workspaces.

`node scripts/validate.mjs`:

```
price-tracker: 18/18 in 272 ms
validation db: /Users/mike/mcp-servers/data/validation.json run 33: 121/121
```

## Codex v3 fixes (stores, time-tracker)

2026-09-03. Scope: the JSON stores of time-tracker, invoice and expense-tracker, plus time-tracker
reporting. Items 1, 18, 19, 20, 21, 22, 23, 24, 26, 27 and 29 of `docs/CODEX_REVIEW_V3.md`.

### #1 (P0) a read or parse failure is no longer an empty database

- `servers/time-tracker/src/jsonstore.ts:23` `readJsonFile()` - only `ENOENT` returns the empty database.
  A parse failure renames the file byte-for-byte to `<file>.corrupt-<timestamp>`, writes a `<file>.corrupt`
  marker, logs to stderr and throws `data file is corrupt; moved to ...; nothing was written`. Any other
  read failure (permissions, EISDIR) throws without touching the file.
- `servers/time-tracker/src/index.ts:71` `load()` uses it, so every mutating tool and every read returns
  that error until the marker is removed.
- `servers/invoice/src/store.ts:81` (used by `readJson()` at `servers/invoice/src/store.ts:108`, so
  `business.json`, `clients.json`, `invoices.json` and `counter.json` are all covered).
- `servers/expense-tracker/src/store.ts:74`, used by `load()` at `servers/expense-tracker/src/store.ts:101`.
- Tests: `servers/time-tracker/test/codexv3.test.mjs:63`, `servers/invoice/test/corrupt.test.mjs`,
  `servers/expense-tracker/test/corrupt.test.mjs` - each writes garbage into the data file, calls a
  mutation, asserts the tool errored, that exactly one `.corrupt-<timestamp>` file exists holding the
  original bytes unchanged, that no fresh empty data file was written, and that a following read errors too.

### #18 rate strings

- `servers/time-tracker/src/index.ts:171` `parseAmount()`. `"1,200 USD"` -> 1200 (comma followed by exactly
  three digits), `"1,200.50"` -> 1200.50, `"1.200,50"` -> 1200.50, `"12,50 EUR"` -> 12.50 (one or two digits
  after the comma). Everything else with a separator, e.g. `"1,2345"`, is refused with a worked example.
  Wired into `parseRate()` at `servers/time-tracker/src/index.ts:154`.

### #19 rates captured at entry time

- `servers/time-tracker/src/index.ts:483` (`entry_add`) and `servers/time-tracker/src/index.ts:361`
  (`stopRunning`, used by `timer_stop` and by the auto-stop in `timer_start`) write `rateCents` and
  `currency` onto the entry from the explicit rate, else the project rate in force at that moment.
- `servers/time-tracker/src/index.ts:205` `rateForEntry()` keeps a project lookup only for entries written
  by older versions, which carry no rate of their own.
- `project_set_rate` at `servers/time-tracker/src/index.ts:625` says it applies to future entries only and
  takes `apply_to_existing: true` to backfill the rate-less entries of that project.

### #20 date-only bounds

- `servers/time-tracker/src/index.ts:102` `parseTime()` reads a bare `YYYY-MM-DD` as local midnight;
  `servers/time-tracker/src/index.ts:116` `endOfLocalDay()` and `windowFor()` at
  `servers/time-tracker/src/index.ts:304` make a date-only `to` the inclusive local end of that day
  (23:59:59.999). Documented in `servers/time-tracker/README.md` under "Dates, times and rates".

### #21/#22/#23 clipping and midnight splits

- `servers/time-tracker/src/index.ts:316` `clip()` intersects each entry with the window;
  `servers/time-tracker/src/index.ts:326` `select()` uses overlap, not start time, so partly-overlapping
  entries contribute their overlapping part.
- `servers/time-tracker/src/index.ts:650` `splitByDay()` splits an entry at local midnight, used by
  `partsOf()` at `servers/time-tracker/src/index.ts:665` for `group_by: "day"` and by `daySummary()`.
- `servers/time-tracker/src/index.ts:432` `timer_status` intersects logged entries and the running timer
  with `[today 00:00, tomorrow 00:00)`.

### #24 offsetless timestamps

- `servers/time-tracker/src/index.ts:102`: an offsetless timestamp is local time (Date parsing, DST folds
  included); an explicit offset or `Z` is honoured. Test asserts a `+02:00` entry is found by a window
  expressed in UTC (`servers/time-tracker/test/codexv3.test.mjs:170`).

### #26/#27 report totals

- `servers/time-tracker/src/index.ts:694` `totalsOf()` computes hours and money from the entries once;
  `report` uses it instead of summing buckets, so overlapping tag rows can no longer double-count.
  `servers/time-tracker/src/index.ts:706` `TAG_OVERLAP_NOTE` is printed under a tag table and returned as
  `note` in the JSON.
- `servers/time-tracker/src/index.ts:747` and `:754`: `amount_cents`/`currency` scalars are emitted only
  when a row or the total holds exactly one currency; mixed rows expose `amounts` alone.

### #29 one resolver

- `servers/time-tracker/src/index.ts:338` `resolveFilter()` wraps `resolveProject()`; `entry_list`,
  `report`, `export_csv`, `invoice_summary` and `project_set_rate` all refuse an ambiguous project name
  with the candidate list instead of matching exactly or silently creating a second project.

### Evidence

```
> @theluckystrike/mcp-time-tracker@0.2.3 test
# tests 13
# pass 13
# fail 0
> @theluckystrike/mcp-invoice@0.2.3 test
# tests 24
# pass 24
# fail 0
> @theluckystrike/mcp-expense-tracker@0.2.3 test
# tests 37
# pass 37
# fail 0
```

`npm run build` for the three packages: clean.

`node scripts/validate.mjs` (no probe changes were needed; the inclusive date-only bound only affects
date-only inputs and the probes pass full timestamps):

```
expense-tracker: 22/22 in 376 ms
time-tracker: 18/18 in 210 ms
price-tracker: 18/18 in 262 ms
spreadsheet: 18/18 in 374 ms
invoice: 20/20 in 406 ms
remote: 14/14
billing: 11/11
validation db: /Users/mike/mcp-servers/data/validation.json run 36: 121/121
```

One behaviour change visible to existing callers: the ambiguity refusal now reads "Nothing was written or
reported" (it is returned by read tools too), and `servers/time-tracker/test/currency.test.mjs:156` was
updated to match.

## Codex v3 fixes (spreadsheet)

Scope: `servers/spreadsheet` only. Items 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17 of
`docs/CODEX_REVIEW_V3.md`. Item 2 (UTF-16 BOM) and item 10 are noted at the end.

### One shared locale-aware numeric parser (items 4, 7)

New file `servers/spreadsheet/src/num.ts`. Every place that turns text into a number now calls it:
`servers/spreadsheet/src/csv.ts:109` (`coerce`, CSV import), `servers/spreadsheet/src/sheet.ts:226`
(`toNumber`, aggregation and `sheet_stats`), `servers/spreadsheet/src/expr.ts:149` (`num`, expression
comparison). There is no second private parser left: the one in `sheet_stats`
(`servers/spreadsheet/src/index.ts:461`) was deleted in favour of `toNumber`.

Separator rules, `servers/spreadsheet/src/num.ts:22-26`:

- `PLAIN` `42`, `-1.5`, `.5`, `1e3`, `1250.00`
- `EN_GROUPED` `1,250.00`, `1,250`
- `SPACE_GROUPED` `1 250.00` (also NBSP / narrow NBSP / figure space)
- `EU_DECIMAL` `/^[+-]?(?:\d{1,3}(?:[. ]\d{3})+|\d+),\d{2}$/` — a decimal comma is accepted **only**
  in the unambiguous European shape: a comma followed by exactly two digits at the end, with dots or
  spaces (never commas) grouping the integer part.

Measured: `12,99` -> 12.99 (was 1299), `1.234,56` -> 1234.56, `EUR 1 250,00` -> 1250 (was 125000),
`1,250.00` -> 1250, `1.234` -> 1.234, and `1,2500.00` / `1,234,56` stay text.

Three entry points, `servers/spreadsheet/src/num.ts:64`, `:83`, `:106`:
`parseNumberStrict` (CSV import: no currency stripping, identifiers and unsafe integers stay text),
`parseNumberLoose` (aggregation: strips currency symbols and codes, `%`, accounting parentheses) and
`parseNumberForCompare` (expressions: lenient, but a leading-zero identifier is not a number).

Consequence for comparisons, `servers/spreadsheet/src/expr.ts:145`: `[Code] = 7` on `"007"` is now
false (both sides compare as strings, `"007"` vs `"7"`), and `[Price] > 13` on `"12,99"` is false
because the value is 12.99, not 1299.

This supersedes two D-R12 expectations, updated in place with a comment:
`servers/spreadsheet/test/round5.test.mjs:77` (`coerce("1.250,00")` is now 1250, not text) and
`servers/spreadsheet/test/round5.test.mjs:102` (that cell is now a numeric xlsx cell).

### Unsafe integers stay strings (item 5)

`servers/spreadsheet/src/num.ts:52` — an integer with no exponent whose parsed value is not a safe
integer is rejected, so `9007199254740993` stays the string `"9007199254740993"` instead of being
imported as 9007199254740992.

### Early-exit CSV read for limit/offset (item 6)

- `servers/spreadsheet/src/csv.ts:62` — `parseCsv(text, delimiter, {maxRows, partial})` stops at
  `maxRows` completed rows and reports `consumed` (bytes used) and `complete`.
- `servers/spreadsheet/src/sheet.ts:110` — `readCsvHead` reads the file in 1 MiB chunks through a
  `StringDecoder` and stops as soon as enough complete rows exist; the rest of the file is never read.
- `servers/spreadsheet/src/sheet.ts:107` — `loadWorkbook(path, {rowBudget})`, and
  `servers/spreadsheet/src/index.ts:91` — `rowBudget()` supplies it only when no `where`, `sort`,
  `range`, `group_by` or `aggregate` is requested (anything that consults the whole sheet disables it).
  Wired at `servers/spreadsheet/src/index.ts:249` (`sheet_read`) and `:392` (`sheet_query`).
- When the budget applied, the row-count line says so instead of quoting a row count that was never
  computed: "showing 5 rows from offset 10 (only the rows asked for were read)".

Measured on the 50,000-row file built by the test: `parseCsv` with `maxRows: 101` consumes under
1/20th of the file (`servers/spreadsheet/test/codexv3.test.mjs:161`), and
`loadWorkbook(f, {rowBudget: 100})` returns 101 rows with `partial === true`.

### Header-row guess rejects a one-cell title (item 9)

`servers/spreadsheet/src/sheet.ts:186` — a candidate row with fewer than two filled cells is now
scored against the next five rows; if any of them has two or more filled cells, the candidate is a
title, not a header. `"Sales report\nName,Amount\nA,1"` now picks row index 1. A genuinely
single-column sheet (`Name / A / B`) still picks row 0.

### Aggregate alias collisions (item 13)

`servers/spreadsheet/src/index.ts:311` — aliases are checked case-insensitively against the group
columns and against each other before any grouping runs:
`aggregate alias "Region" collides with group column "Region". Give this aggregate a different "as" name.`

### xlsx writes preserve the other sheets (item 16)

`servers/spreadsheet/src/sheet.ts:80` exposes the parsed workbook as `Workbook.raw`;
`servers/spreadsheet/src/index.ts:141` (`writeMatrix`) takes it as `base`, clones `SheetNames`/`Sheets`,
replaces only the named worksheet and writes the whole workbook back. `sheet_write` passes it for
`append` and `overwrite` (`servers/spreadsheet/src/index.ts:555`) and adds a note naming the sheets
that were kept. Documented as a limitation in `servers/spreadsheet/README.md:199`: the sheet being
written is rebuilt from values, so formulas and formatting **on that sheet** are lost; other sheets
keep their cells as read.

### xlsx date cells (item 17)

`Cell` now includes `Date` (`servers/spreadsheet/src/sheet.ts:35`), `normMatrix` no longer flattens a
date to `YYYY-MM-DD`, and `XLSX.utils.aoa_to_sheet(aoa, {cellDates: true})` writes it back as a date
cell. `formatCellDate` (`servers/spreadsheet/src/sheet.ts:38`) renders ISO from local components with
the time only when the cell carries one; `cellText`/`jsonCell` apply it at every output boundary
(table, CSV, JSON, `sheet_find`, `sheet_stats`). Measured: a cell of 2026-09-03 15:30 converted
xlsx -> xlsx comes back as `t: "d"` with hours 15 and minutes 30, and reads as
`"2026-09-03T15:30:00"`; a midnight cell reads as `"2026-09-04"`. Documented at
`servers/spreadsheet/README.md:211`.

### Also fixed while in the file

- Item 3 — `servers/spreadsheet/src/csv.ts:95`: EOF inside a quoted field throws `CsvError`
  ("unterminated quoted field") instead of swallowing the rest of the file into one cell.
- Item 8 — `servers/spreadsheet/src/expr.ts:224`: an ordered comparison between a number and
  non-numeric text returns false instead of falling back to a lexical compare (`[v] > 2` on `"abc"`).
- Item 11 — `servers/spreadsheet/src/index.ts:331`: a global aggregate with no group columns always
  produces exactly one group, so `where: "1 = 0"` with `count(*)` answers 0 rather than no row.
- Item 12 — `servers/spreadsheet/src/index.ts:305`: `col: "*"` with anything but `count` is refused.
- Item 14 — `servers/spreadsheet/src/sheet.ts:231`: `minMax()` replaces `Math.min(...nums)`; the test
  asserts the spread it replaced does throw `RangeError` at 150,000 values.
- Item 15 — `servers/spreadsheet/src/index.ts:175`: an array append validates the first array as the
  header row and removes it, or refuses when it does not match the file's columns.
- Item 10 (partly) — `servers/spreadsheet/src/index.ts:326`: group keys are type-tagged
  (`` `${typeof v}:${cellText(v)}` ``) so numeric 1 and text "1" no longer merge.

Not fixed here: item 2 (UTF-16 BOM detection) — it needs the byte-level decode to move ahead of the
chunked reader added for item 6, and is left for a separate change.

### Evidence

`npm run build` in `servers/spreadsheet`: clean, no output.

`npm test` in `servers/spreadsheet` (39 pre-existing + 16 new in
`servers/spreadsheet/test/codexv3.test.mjs`):

```
# tests 55
# suites 0
# pass 55
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1710.164041
```

`node scripts/validate.mjs`:

```
spreadsheet: 18/18 in 376 ms
```
