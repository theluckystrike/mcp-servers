# S4 — contract specs per server

Date 2026-09-03. Scope: `scripts/gen-spec.mjs`, 11 `servers/<name>/SPEC.md`, 11
`servers/<name>/test/contract.test.mjs`. No file under any `servers/*/src` was touched;
defects found by the new suites are reported below, not fixed.

## What was built

`scripts/gen-spec.mjs` spawns each built server over stdio and reads the contract off the
wire (`initialize`, `tools/list`, `resources/list`, `prompts/list`), then joins it with
three non-probeable sources: the free-vs-pro table lifted out of `servers/<name>/README.md`,
the literal error-message heads grepped out of `servers/<name>/src/*.ts`, and a curated
block of invariants and storage paths held inline in the script. `office-suite` is excluded:
it is a proxy bundle and its contract is the union of its children's.

Output is deterministic — tools, resources, prompts, arguments and failure modes are sorted,
and no timestamp is written — so re-running produces no diff.

| spec | tools | resources | prompts | failure modes grepped |
| --- | --- | --- | --- | --- |
| `servers/clauses/SPEC.md` | 12 | 1 | 1 | 10 |
| `servers/currency/SPEC.md` | 10 | 1 | 1 | 16 |
| `servers/docx/SPEC.md` | 11 | 1 | 1 | 10 |
| `servers/expense-tracker/SPEC.md` | 14 | 1 | 1 | 18 |
| `servers/invoice/SPEC.md` | 12 | 1 | 0 | 4 |
| `servers/price-tracker/SPEC.md` | 10 | 1 | 1 | 6 |
| `servers/recurring/SPEC.md` | 14 | 1 | 1 | 7 |
| `servers/resume/SPEC.md` | 10 | 1 | 1 | 6 |
| `servers/spreadsheet/SPEC.md` | 10 | 0 | 0 | 13 |
| `servers/time-tracker/SPEC.md` | 14 | 1 | 1 | 10 |
| `servers/timezone/SPEC.md` | 11 | 1 | 1 | 5 |

Each SPEC carries: package/version/bin/`serverInfo.name`, a tool index, a per-tool argument
table (type, required, description, and the schema constraints — pattern, min, max, default),
resources, prompts, the invariant list, the README free/pro table plus the enforced
constants read from src, the storage layout, and the failure-mode list.

## Contract suites

`servers/<name>/test/contract.test.mjs`, one per server, six tests each. Mechanical only —
no suite asserts a number a human chose.

1. **stdout is JSON-RPC only.** Every non-blank stdout line across `initialize`,
   `tools/list` and one harmless call must parse as JSON and carry `jsonrpc: "2.0"`.
2. **Description hygiene.** Non-empty, trimmed, no emoji, under a 1200-character hard
   ceiling, and the tool count matches the SPEC. The 220-character rule and the
   imperative-opener rule for file/URL tools are enforced as a **ratchet**: the tools that
   already break them are listed as a baseline in the suite and a new offender fails.
3. **Corrupt store quarantine.** Garbage is written into the server's primary data file, one
   mutating tool is called, and the suite asserts `isError`, a `corrupt`/`not valid JSON`
   message, exactly one `<file>.corrupt-<timestamp>` copy holding the original bytes, and
   that no empty store replaced the corrupt one. Skipped for `spreadsheet` (stateless).
4. **Write caps leave no partial file.** `spreadsheet` `sheet_write` with 501 rows on free
   and `expense-tracker` `expense_export` with 201 rows on free: the refusal must name the
   cap and the output path must not exist, then the same call under the cap must succeed and
   write the full file. The other nine skip with a message (their free limits are counts of
   stored records, not row caps on a written file).
5. **License tier.** `license_status` reports `"tier": "free"` with no key, `"tier": "pro"`
   with a key from `scripts/sign-license.mjs <product>`, and `"tier": "free"` again with a
   key signed for a different product.

The caps in the brief were off by one against the source: the spreadsheet free write cap is
`FREE_WRITE_ROWS = 500` (not 600) and the expense export cap is `FREE_EXPORT_ROWS = 200`
(201 rows is the first refusal). The suites test the measured constants.

## Defects found (not fixed — all live in src)

**D-S1. 43 of 128 tool descriptions exceed 220 characters.** Every server is affected. The
longest is `expense-tracker` `expense_to_invoice` at 1,135 characters; `invoice_from_hours`
562, `sheet_add_column` 529, `rate_on` 486, `mileage_add` 470.

| server | over 220 |
| --- | --- |
| clauses | `clause_add`, `clause_import`, `contract_assemble` |
| currency | `convert`, `fx_rates_for`, `rate_history`, `rate_on`, `rates_latest` |
| docx | `business_set`, `contract_create`, `doc_create`, `doc_fill_template`, `doc_to_html`, `proposal_create`, `proposal_update` |
| expense-tracker | `category_rules`, `expense_add`, `expense_mark_rebilled`, `expense_settings`, `expense_to_invoice`, `mileage_add` |
| invoice | `invoice_create`, `invoice_from_hours`, `invoice_pdf` |
| price-tracker | `alerts_pending`, `watch_refresh` |
| recurring | `invoice_generate_due`, `schedule_create`, `schedule_delete`, `schedule_skip` |
| resume | `cover_letter_create`, `profile_set`, `resume_create`, `tailor_to_job` |
| spreadsheet | `sheet_add_column`, `sheet_write` |
| time-tracker | `entry_mark_billed`, `invoice_summary`, `project_set_rate`, `report`, `timer_start` |
| timezone | `business_days`, `find_meeting_slots` |

This one is a genuine tension, not a clean bug. The long descriptions are where rounds 3-7
put the seam contracts — `invoice_from_hours` spells out the `fx_rates` direction,
`expense_to_invoice` spells out the double-tax rule — and R6 measured client tool selection,
not server behaviour, as the loss surface. Trimming to 220 characters would delete the text
that fixed those seams. Recommendation: either raise the limit to a measured number, or move
the contract text into the per-argument `describe()` strings (which clients also read) and
keep the tool description to the one-line "when to call this".

**D-S2. 26 of the 38 tools that take a `path`, `url`, `out_path` or `template_path` do not
open with an imperative sentence.** `docx` is worst: 7 of 7 file tools open with a
declarative ("Write a real .docx file from...", "Turn markdown into a .docx...").

| server | not imperative |
| --- | --- |
| clauses | `clause_export`, `clause_import`, `contract_assemble` |
| docx | `contract_create`, `doc_create`, `doc_fill_template`, `doc_from_markdown`, `doc_read`, `doc_to_html`, `proposal_create` |
| expense-tracker | `expense_export`, `receipt_attach` |
| invoice | `invoice_pdf` |
| price-tracker | `price_add_manual`, `price_history`, `watch_remove` |
| resume | `cover_letter_create`, `resume_create`, `resume_read`, `resume_to_html` |
| spreadsheet | `sheet_add_column`, `sheet_convert`, `sheet_find`, `sheet_write` |
| time-tracker | `export_csv` |
| timezone | `ics_create` |

`currency` and `recurring` pass trivially: they expose no file or URL tool.

**D-S3. `currency` `cache_status` reports success while quarantining a corrupt cache.**
Measured: write garbage into `daily.json`, call `cache_status`. The file is correctly moved
to `daily.json.corrupt-<timestamp>` byte-for-byte and the marker is written — but the tool
returns `isError: false` and a normal-looking status block. The caller is told the cache is
fine on the same call that destroyed it, and only the *next* call fails. Every other store-
backed server returns `isError: true` with the corrupt message on the same call. The
contract suite asserts the quarantine hard and emits the flag as a diagnostic rather than
locking in the wrong behaviour.

Second-order: `currency` has no mutating tool that works offline — every write path
refreshes from the ECB — so the quarantine contract on its *write* path is untested here.

**D-S4. `serverInfo.name` is still inconsistent.** Nine servers report `mcp-<name>`;
`price-tracker` and `time-tracker` report the bare id. This was raised in `docs/AUDIT.md`
(2026-09-02, "failures not fixed" item 6) and is still open. It is visible to every client
that groups tools by server name.

**D-S5. Capability registration is uneven.** `invoice` and `spreadsheet` answer
`prompts/list` with a method-not-found error while the other nine register one prompt each;
`spreadsheet` also registers no resource while the other ten register one. Not a
correctness bug, but a client that lists prompts sees the bundle as partly furnished.

---

status: DONE
evidence: |
  node scripts/gen-spec.mjs
    servers/clauses/SPEC.md  tools=12 resources=1 prompts=1 failure_modes=10
    servers/currency/SPEC.md  tools=10 resources=1 prompts=1 failure_modes=16
    servers/docx/SPEC.md  tools=11 resources=1 prompts=1 failure_modes=10
    servers/expense-tracker/SPEC.md  tools=14 resources=1 prompts=1 failure_modes=18
    servers/invoice/SPEC.md  tools=12 resources=1 prompts=0 failure_modes=4
    servers/price-tracker/SPEC.md  tools=10 resources=1 prompts=1 failure_modes=6
    servers/recurring/SPEC.md  tools=14 resources=1 prompts=1 failure_modes=7
    servers/resume/SPEC.md  tools=10 resources=1 prompts=1 failure_modes=6
    servers/spreadsheet/SPEC.md  tools=10 resources=0 prompts=0 failure_modes=13
    servers/time-tracker/SPEC.md  tools=14 resources=1 prompts=1 failure_modes=10
    servers/timezone/SPEC.md  tools=11 resources=1 prompts=1 failure_modes=5

  Determinism, second and third run:
    node scripts/gen-spec.mjs && git diff --stat -- 'servers/*/SPEC.md'
    (no output)

  npm test at the root, per workspace (tests / pass / fail):
    mcp-license 15/15/0   clauses 31/30/0   currency 41/40/0   docx 29/28/0
    expense-tracker 46/46/0   invoice 34/33/0   office-suite 5/5/0
    price-tracker 61/60/0   recurring 32/31/0   resume 32/31/0
    spreadsheet 61/60/0   time-tracker 26/25/0   timezone 52/51/0
    total 465 tests, 0 fail, 10 skipped (the 10 documented contract skips)
    Before this unit the same command reported 399.

  node scripts/validate.mjs
    clauses 16/16, recurring 20/20, resume 18/18, docx 16/16, timezone 16/16,
    currency 16/16, expense-tracker 22/22, time-tracker 24/24, price-tracker 18/18,
    spreadsheet 18/18, invoice 20/20, remote 26/26, billing 17/17,
    validation db run 50: 247/247

  Corrupt-store probe, one line per server (isError / quarantined copies / bytes preserved):
    clauses true/1/true      docx true/1/true        expense-tracker true/1/true
    invoice true/1/true      price-tracker true/1/true  recurring true/1/true
    resume true/1/true       time-tracker true/1/true   timezone true/1/true
    currency FALSE/1/true    <- D-S3
artifacts: |
  scripts/gen-spec.mjs
  servers/{clauses,currency,docx,expense-tracker,invoice,price-tracker,recurring,resume,spreadsheet,time-tracker,timezone}/SPEC.md
  servers/{...same 11...}/test/contract.test.mjs
  docs/SPEC_RESULT.md
cost: 42 wall minutes
failures: |
  The 220-character and imperative-opener rules fail on 43 and 26 tools respectively against
  the shipped descriptions, and the brief forbids editing src. Enforcing them as hard
  assertions would have left 11 red suites. Both are enforced as a ratchet instead: the
  current offenders are listed by name in each suite, a new offender fails the build, and a
  fixed one prints a diagnostic telling the owner to drop it from the baseline. The full
  lists are D-S1 and D-S2 above.
  The row caps named in the brief did not match the source (600 vs FREE_WRITE_ROWS 500,
  201 vs FREE_EXPORT_ROWS 200). The suites test the constants that are actually enforced.
  currency has no offline mutating tool, so its corrupt-store test had to go through
  cache_status, which is how D-S3 surfaced.
insight: |
  Generating the spec from the built server rather than from src is what found D-S5 and
  confirmed D-S4: reading src tells you what was registered, spawning the binary tells you
  what a client actually sees, and the two disagree on two servers' identity and on three
  servers' capability set. The same asymmetry produced the largest defect: the corrupt-store
  contract holds on 10 of 10 store-backed servers when you grep for the quarantine code, and
  on 9 of 10 when you make the call — currency writes the quarantine and returns success in
  the same breath.

---

# Fixes — D-S1 to D-S5

Date 2026-09-03. Scope: `servers/*/src`, `servers/*/test/contract.test.mjs`,
`servers/{docx,invoice,spreadsheet}/README.md`, the eleven regenerated `servers/*/SPEC.md`.
`remote/`, `scripts/` and the office-suite proxy logic were not touched. All five defects are
closed and every ratchet baseline is now empty.

## D-S1 — 43 tool descriptions over 220 characters

Fixed on all eleven servers. Measured on the wire after the fix: **128 tools, 0 over 220
characters**, longest description 220 (`docx` `doc_fill_template`). Was 43 over, longest 1,135
(`expense-tracker` `expense_to_invoice`, now 195).

| server | tools shortened |
| --- | --- |
| clauses | `clause_add`, `clause_import`, `contract_assemble` |
| currency | `convert`, `fx_rates_for`, `rate_history`, `rate_on`, `rates_latest` |
| docx | `business_set`, `contract_create`, `doc_create`, `doc_fill_template`, `doc_to_html`, `proposal_create`, `proposal_update` |
| expense-tracker | `category_rules`, `expense_add`, `expense_mark_rebilled`, `expense_settings`, `expense_to_invoice`, `mileage_add` |
| invoice | `invoice_create`, `invoice_from_hours`, `invoice_pdf` |
| price-tracker | `alerts_pending`, `watch_refresh` |
| recurring | `invoice_generate_due`, `schedule_create`, `schedule_delete`, `schedule_skip` |
| resume | `cover_letter_create`, `profile_set`, `resume_create`, `tailor_to_job` |
| spreadsheet | `sheet_add_column`, `sheet_write` |
| time-tracker | `entry_mark_billed`, `invoice_summary`, `project_set_rate`, `report`, `timer_start` |
| timezone | `business_days`, `find_meeting_slots` |

No contract text was deleted. Each description now carries the imperative first sentence plus
what the tool returns; the seam contracts moved into the per-argument zod `.describe()` strings
and, where they are actionable at call time, into the tool's own response text. The two seams
R6 measured are both still stated twice:

- `currency` `fx_rates_for` and `invoice` `invoice_from_hours` — the fx direction ("1 unit of
  the key = X units of the target", "nothing here fetches or guesses a rate") is in the
  `currencies` / `fx_rates` argument description and is restated in the response whenever a
  conversion actually happened.
- `expense-tracker` `expense_to_invoice` — the double-tax rule (an expense with no recorded rate
  holds GROSS and is emitted at `tax_rate` 0, so a default invoice rate would tax the receipt
  twice; a stored 0 is a real rate; the settings default is never retroactive) is in
  `assume_vat_rate.describe()` and in a new always-present `line_item_note` field on the response.

Other relocations of note: the ECB publishing calendar and the free/Pro history window
(`currency`), the mileage rate table and its "not a tax calculation" honesty note
(`expense-tracker` `mileage_add`), the month-clamp and idempotency rules (`recurring`), the
"money is grouped by currency, EUR is never added to USD" rule (`time-tracker` `report`, now
also emitted at runtime when a period really does span more than one currency), the
meeting-fairness definition (`timezone` `find_meeting_slots`, now in the response header), and
the free-tier caps on `clauses`, `resume` and `spreadsheet`.

## D-S2 — 26 file/URL tools not opening with an imperative sentence

Fixed. Measured on the wire: **32 tools take `path`, `url`, `out_path` or `template_path`;
0 fail the imperative rule.** Every one now opens "Call this tool to ..." or "Call this tool
for ...". Fixed: `clauses` `clause_export`, `clause_import`, `contract_assemble`; `docx`
`contract_create`, `doc_create`, `doc_fill_template`, `doc_from_markdown`, `doc_read`,
`doc_to_html`, `proposal_create`; `expense-tracker` `expense_export`, `receipt_attach`;
`invoice` `invoice_pdf`; `price-tracker` `price_add_manual`, `price_history`, `watch_remove`;
`resume` `cover_letter_create`, `resume_create`, `resume_read`, `resume_to_html`; `spreadsheet`
`sheet_add_column`, `sheet_convert`, `sheet_find`, `sheet_write`; `time-tracker` `export_csv`;
`timezone` `ics_create`.

## D-S3 — currency `cache_status` reported success while quarantining the cache

Fixed in `servers/currency/src/store.ts` and `servers/currency/src/index.ts`.
`CorruptDataError` now carries `quarantined` (the `<file>.corrupt-<timestamp>` copy) and
`justQuarantined`, set true only on the parse-failure path that does the moving — a later call
blocked by an existing marker is not a fresh quarantine. `cache_status` no longer swallows that
error: if either `loadDaily()` or `loadHistory()` quarantined a file during the call, it returns
`isError: true` naming the copy that holds the original bytes and how to clear the marker.
`currency` now matches the other ten store-backed servers, which return `isError: true` with the
corrupt message on the same call.

The contract suite's diagnostic became a hard assertion — `servers/currency/test/contract.test.mjs`
now asserts `isError === true`, `/quarantined by this call/` and `/daily\.json\.corrupt-/`
alongside the existing byte-for-byte quarantine checks.

## D-S4 — serverInfo.name inconsistent

Fixed. `price-tracker` reports `mcp-price-tracker` and `time-tracker` reports `mcp-time-tracker`;
their `smoke.test.mjs` assertions were updated with them. All eleven `SPEC.md` files now read
`serverInfo.name | mcp-<id>`.

## D-S5 — uneven capability registration

Fixed. `invoice` and `spreadsheet` each register a prompt, and `spreadsheet` registers a listable
resource.

- `invoice`: `prompts: {}` added to the server capabilities; new `monthly_invoicing` prompt
  (optional `month` and `client` arguments) whose body is a five-step numbered list of real calls
  — `invoice_list {status: "unpaid"}`, `invoice_list {status: "partial"}`, `overdue_report`, then
  a drafted `invoice_create` / `invoice_from_hours`, then `invoice_pdf`.
- `spreadsheet`: the `McpServer` was constructed with no capabilities argument at all, which is
  why `prompts/list` and `resources/list` answered method-not-found; it now declares
  `{ tools: {}, resources: {}, prompts: {} }`. New `explore_sheet` prompt runs `sheet_info` first,
  forbids guessing column names, and then proposes three to five concrete `sheet_query` calls
  built from the columns actually found.
- `spreadsheet` `sheet://recent`: a fixed resource listing the spreadsheet files opened in this
  server session, newest first. The server stays stateless on disk — the list is a module-level
  in-memory array in `src/sheet.ts` (cap 20, deduped by resolved path, ISO timestamp) pushed from
  the shared `loadWorkbook()`. The pre-existing `sheet://{path}` template still resolves and is
  not shadowed.

`node scripts/gen-spec.mjs` now reports `invoice prompts=1` and `spreadsheet resources=1
prompts=1`; every server is at one resource and one prompt or better.

---

status: DONE
evidence: |
  Description rules re-measured over stdio against the built servers (128 tools, office-suite
  excluded as a proxy bundle):
    clauses: tools=12 over220=0 fileTools=3 nonImperative=0
    currency: tools=10 over220=0 fileTools=0 nonImperative=0
    docx: tools=11 over220=0 fileTools=7 nonImperative=0
    expense-tracker: tools=14 over220=0 fileTools=2 nonImperative=0
    invoice: tools=12 over220=0 fileTools=1 nonImperative=0
    price-tracker: tools=10 over220=0 fileTools=5 nonImperative=0
    recurring: tools=14 over220=0 fileTools=0 nonImperative=0
    resume: tools=10 over220=0 fileTools=4 nonImperative=0
    spreadsheet: tools=10 over220=0 fileTools=8 nonImperative=0
    time-tracker: tools=14 over220=0 fileTools=1 nonImperative=0
    timezone: tools=11 over220=0 fileTools=1 nonImperative=0
    TOTAL tools=128 over220=0 nonImperative=0 longest=220 (docx doc_fill_template)

  Every OVER_LENGTH_BASELINE and NON_IMPERATIVE_BASELINE in the eleven
  servers/*/test/contract.test.mjs is now the empty array:
    grep -c "BASELINE = \[\];" servers/*/test/contract.test.mjs -> 2 for each of the eleven

  npm test at the root, per workspace (tests / pass / fail / skipped):
    mcp-license      15 / 15 / 0 / 0
    clauses          31 / 30 / 0 / 1
    currency         41 / 40 / 0 / 1
    docx             29 / 28 / 0 / 1
    expense-tracker  46 / 46 / 0 / 0
    invoice          34 / 33 / 0 / 1
    office-suite      5 /  5 / 0 / 0
    price-tracker    61 / 60 / 0 / 1
    recurring        32 / 31 / 0 / 1
    resume           32 / 31 / 0 / 1
    spreadsheet      61 / 60 / 0 / 1
    time-tracker     26 / 25 / 0 / 1
    timezone         52 / 51 / 0 / 1
    total 465 tests, 455 pass, 0 fail, 10 skipped (the same 10 documented contract skips)
    exit code 0

  node scripts/gen-spec.mjs
    servers/clauses/SPEC.md  tools=12 resources=1 prompts=1 failure_modes=10
    servers/currency/SPEC.md  tools=10 resources=1 prompts=1 failure_modes=17
    servers/docx/SPEC.md  tools=11 resources=1 prompts=1 failure_modes=10
    servers/expense-tracker/SPEC.md  tools=14 resources=1 prompts=1 failure_modes=18
    servers/invoice/SPEC.md  tools=12 resources=1 prompts=1 failure_modes=4
    servers/price-tracker/SPEC.md  tools=10 resources=1 prompts=1 failure_modes=6
    servers/recurring/SPEC.md  tools=14 resources=1 prompts=1 failure_modes=7
    servers/resume/SPEC.md  tools=10 resources=1 prompts=1 failure_modes=6
    servers/spreadsheet/SPEC.md  tools=10 resources=1 prompts=1 failure_modes=13
    servers/time-tracker/SPEC.md  tools=14 resources=1 prompts=1 failure_modes=10
    servers/timezone/SPEC.md  tools=11 resources=1 prompts=1 failure_modes=5
    (was: invoice prompts=0, spreadsheet resources=0 prompts=0, currency failure_modes=16)
    Still deterministic: two consecutive runs hash identically.

  serverInfo.name, grepped out of the eleven regenerated SPEC.md files:
    mcp-clauses mcp-currency mcp-docx mcp-expense-tracker mcp-invoice mcp-price-tracker
    mcp-recurring mcp-resume mcp-spreadsheet mcp-time-tracker mcp-timezone

  node scripts/validate.mjs
    clauses 16/16, recurring 20/20, resume 18/18, docx 16/16, timezone 16/16,
    currency 16/16, expense-tracker 22/22, time-tracker 24/24, price-tracker 18/18,
    spreadsheet 18/18, invoice 20/20, remote 26/26, billing 17/17,
    validation db run 50: 247/247
artifacts: |
  servers/{clauses,currency,docx,expense-tracker,invoice,price-tracker,recurring,resume,spreadsheet,time-tracker,timezone}/src/index.ts
  servers/currency/src/store.ts
  servers/spreadsheet/src/sheet.ts
  servers/{...same 11...}/test/contract.test.mjs
  servers/{price-tracker,time-tracker}/test/smoke.test.mjs
  servers/{docx,invoice,spreadsheet}/README.md
  servers/{...same 11...}/SPEC.md
  docs/SPEC_RESULT.md
cost: 34 wall minutes
failures: |
  None outstanding. One self-inflicted regression was caught and fixed inside the unit:
  appending the new mixed-currency note to time-tracker report's shared note field corrupted
  the format:"json" branch, and two of that server's own suites failed on JSON.parse. The note
  is now emitted only on the table and plain branches. This is the D-S1 hazard in miniature -
  moving contract text into a response is only safe on the branches whose output is prose.
cost_note: |
  The 220-character rule cost no information. Every sentence cut from a description landed in
  an argument description, a response field, or both; the two seams R6 measured are each stated
  twice now rather than once.
insight: |
  D-S1 read as a genuine tension in S4 - trim the descriptions and lose the seam contracts that
  rounds 3-7 put there. It was not one, because the premise was wrong: the choice was never
  "description or nothing". A tool's contract has three surfaces a client actually reads, and
  only one of them was being used. Moving the fx direction into fx_rates.describe() puts it next
  to the argument it constrains, where a client reads it while filling that field, rather than
  in a paragraph it must retain from tool-selection time; moving the double-tax rule into the
  response puts it in front of the caller at the moment it can still act on it. The 220-character
  limit did not force a trade-off, it forced the text to the surface where it works better.
  The corollary is D-S3's shape too: cache_status swallowed the quarantine because reporting it
  felt like reporting a failure of the read, when it was a report of a write the read performed.
  Both defects are the same mistake - putting information where it is convenient to write rather
  than where the caller is standing when it matters.
