# User value audit, round 16 - expense-tracker only - 2026-09-05

Round 15 scored expense-tracker 10/12 hosted, and found two defects that were fixed the same day:
D-R76 (the hosted `expense_summary` never named the bank ledger, because "absent" was read as "you
have no bank-statement") and D-R77 (the free 30-day window could clamp `from` past `to` and describe
the impossible range as coverage). Round 15's own writeup also recorded a follow-up: the D-R76 fix
was first a stopgap sentence in `remote/build-vendor.mjs`, then replaced once `SERVERS["expense-tracker"]`
gained a `sharedDoc` pointing at the bank-statement store, so the hosted expense-tracker now reads
the same tenant's bank ledger read-only and the `bank_ledger` line is a real count again, not an
unconditional sentence. This round re-runs round 15's four expense-tracker prompts, on a fresh
anonymous token, to check both fixes live. No code was touched this session; this is measurement
only.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, 8,025 bytes, minted
  `anon_bb06830e155e4235c6f6b69e925a6577`.
- **Seed.** Round 15's ex2/ex4 questions only mean something if a bank ledger exists under the same
  token, so before the four prompts: `bank_upload {name: "revolut-main", url:
  "https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/remote/fixtures/revolut-main.csv"}`
  then `statement_import {path: "revolut-main", account: "Revolut EUR", bank: "revolut"}`, both sent
  by direct JSON-RPC `tools/call` against `/mcp/bank-statement/t/<token>` (not through the claude
  CLI - this is test setup, not a scored turn). 41 of the fixture's 43 lines imported (one row
  skipped, state `REVERTED`), spanning 2026-07-28 to 2026-09-03. Four of those 41 fall in September
  2026: Spotify 9.99, Adobe Stock 25.00, and two Coffee Republic charges 3.60 and 6.40, EUR 44.99
  total, confirmed with `statement_summary {from: 2026-09-01, to: 2026-09-30}` before the
  expense-tracker lane ran.
- **Registration.** Only `/mcp/expense-tracker/t/<token>` was registered for the four scored prompts,
  one `{"type":"http","url":"https://mcp.zovo.one/mcp/expense-tracker/t/<token>"}` entry, no
  `--header`.
- **Allowlist.** 14 `mcp__expense-tracker__<tool>` entries from a live `tools/list`: `expense_add`,
  `expense_list`, `expense_update`, `expense_delete`, `receipt_attach`, `category_rules`,
  `expense_settings`, `expense_summary`, `mileage_add`, `expense_export`, `expense_to_invoice`,
  `expense_mark_rebilled`, `license_status`, `license_activate`.
- **Client.** `claude` 2.1.261, `--model sonnet`, `--strict-mcp-config`, `--output-format
  stream-json --verbose --max-turns 12`, one `--session-id` then three `--resume`.
- **D-R57 honoured.** The lane ran in an **empty** working directory with the CLI's own filesystem
  and search tools disallowed (`Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch,
  NotebookEdit, Task, TodoWrite`), and with fresh `XDG_CONFIG_HOME` / `XDG_DATA_HOME` /
  `XDG_CACHE_HOME` / `XDG_STATE_HOME` directories, so nothing from any earlier session was on disk.
  `timeout 240` per prompt; each prompt's raw `stream-json` output was written to disk before the
  next was sent.
- **No business profile seeded.** Round 15 additionally seeded `business_set` on `/mcp/invoice`
  with `default_tax_rate: 23%`, which is why its ex1 replies named a VAT rate source. This round's
  brief was to seed only the bank rows, so VAT stays 0 by design here and that difference is not
  scored as a regression.
- **Clock.** 2026-09-05.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong, or asked for something the tool could
infer. 0 = failed.

## Scorecard - 12 / 12 (round 15: 10 / 12)

| # | Prompt | R16 | R15 | Calls | What happened |
|---|---|---|---|---|---|
| ex1 | "Log three expenses: 2026-09-01 Figma EUR 45 (software), 2026-09-02 taxi PLN 68 (travel), 2026-09-03 Adobe EUR 22.99 (software)." | **3** | 3 | 3 | Three `expense_add`. Two currencies, never mixed. Each reply named the billable default unprompted (no project means it will not appear in `expense_to_invoice` unless `billable: true` is passed). VAT stayed 0 with an explanation, since no rate was given or stored this round (no seeded business profile) |
| ex2 | "Give me a summary of September so far, grouped by category." | **3** | 2 | 1 | One `expense_summary`. EUR software 67.99, PLN travel 68.00, correct to the cent, and this time a real `bank_ledger` field: "The bank ledger (mcp-bank-statement) holds 4 transactions in this period that are not counted here; call that server's `statement_summary` for them." The model relayed the count and offered to pull the bank side in. **D-R76 verified fixed** |
| ex3 | "Export those September expenses as a CSV I can download." | **3** | 3 | 1 | One `expense_export {format: "csv"}`. `GET`: 200, `text/csv; charset=utf-8`, 309 bytes, `filename="expenses-2026-09-01-to-2026-09-05.csv"`, 16 columns, exactly the three rows, byte-exact against what `expense_add` stored |
| ex4 | "Now show me everything I logged in June 2026." | **3** | 2 | 1 | `expense_list {from: 2026-06-01, to: 2026-06-30}` returned `"from": null`, `"nothing_read": true`, and a note opening "Nothing was read" and naming the real cutoff (2026-08-06) - no range whose start is after its end. Relayed correctly on the first turn, nothing to rescue. **D-R77 verified fixed** |

**Totals: 12/12, 6 tool calls.**

## Independent verification

Every number below was re-read by direct `tools/call` or decoded from the downloaded CSV bytes,
not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | one lane, one `/t/<token>` entry, connected first try, no `Authorization` anywhere | PASS |
| The CSV is a real CSV | `GET` -> 200, `text/csv; charset=utf-8`, 309 bytes, 16-column header, three rows: `1e6e659c,2026-09-01,EUR,45,45,45,0,0,software,Figma,,no,,,,` / `6d20e77f,2026-09-02,PLN,68,68,68,0,0,travel,taxi,,no,,,,` / `f95007d6,2026-09-03,EUR,22.99,22.99,22.99,0,0,software,Adobe,,no,,,,` | PASS |
| The expense_list rows match the CSV | a direct `expense_list {2026-09-01 to 2026-09-05}` curl returns the same three ids, amounts and currencies as the downloaded CSV | PASS |
| D-R76: the summary names the bank ledger when present | `expense_summary` -> `"bank_ledger": "The bank ledger (mcp-bank-statement) holds 4 transactions in this period that are not counted here; call that server's statement_summary for them."`; a direct `statement_summary {2026-09-01 to 2026-09-30}` on `/mcp/bank-statement` for the same token independently returns `count: 4`, `money_out: "EUR 44.99"` - the number named matches the number present | **PASS, D-R76 fixed** |
| D-R77: the free window never returns from-after-to | `expense_list {2026-06-01 to 2026-06-30}` on a token whose data starts 2026-09-01 returned `"from": null`, `"nothing_read": true`, note opening "Nothing was read" - no impossible range, no contradiction for the model to catch | **PASS, D-R77 fixed** |
| ex3 also carries the bank ledger note | `expense_export` tool_result: "The bank ledger (mcp-bank-statement) holds 4 transactions in this period that are not counted here; call that server's `statement_export` for them." (not scored separately, since ex3's prompt only asked for the expense CSV, but recorded as consistent with the ex2 fix) | PASS |

## Bottom line

12/12, up from 10/12 in round 15, entirely on the two prompts round 15 flagged. D-R76 and D-R77 are
both confirmed fixed on the live hosted endpoint, with evidence pulled independently of the model's
own words: a cross-endpoint `statement_summary` call that agrees with the number `expense_summary`
named, and a raw `expense_list` payload that no longer contains a date range whose start is after
its end. ex1 and ex3 held their round 15 score of 3, unaffected by either fix. No new defects were
found this round, and none were fixed here - this is a re-measurement, not a repair.
