# mcp-recurring: adversarial audit and user-value run

Date 2026-09-03. Scope: `servers/recurring` only (plus reads of `servers/invoice`, whose engine it
calls). Zero paid API calls, zero network calls: `grep -rE "fetch\(|https?://|node:http|node:net|node:dns"
servers/recurring/src/` returns only the checkout URL string in the licence copy, and
`test/adversarial.test.mjs` asserts that every run.

Part 1 harness: `/private/tmp/recaudit/seq.mjs`, a SEQUENTIAL stdio JSON-RPC probe (it waits for each
response before sending the next request) against `servers/recurring/dist/index.js`, fresh
`XDG_DATA_HOME` per batch, `MCP_LICENSE_KEY=""` unless noted. The sequential form matters: the earlier
fire-and-forget probe from `docs/EXPENSE_AUDIT.md` reported `would_create: []` for a schedule that in fact
offered 1,520 periods, because the `invoice_generate_due` read raced ahead of the `schedule_create` write.
A concurrent probe cannot audit a stateful server.

Part 2 harness: the real `claude` CLI as an MCP client against `/private/tmp/uvrec/mcp3.json`, which
registers TWO servers, `recurring` and `invoice`, both pointed at one fresh `XDG_DATA_HOME`
(`/private/tmp/uvrec/data3`) and `XDG_CONFIG_HOME`, with a Pro key from `scripts/sign-license.mjs`.
One session, `--session-id` then five `--resume` calls, so "run it again" and "pause Acme" refer back.

---

## Part 1 - adversarial probes

| # | Probe | Before | Fixed | After |
|---|---|---|---|---|
| 1 | `schedule_create {}` | PASS | - | zod: `Required at client / items / start_date`, `Invalid input at every` |
| 2 | `schedule_create {items: "nope"}` (wrong type) | PASS | - | zod: `Expected array, received string at items` |
| 3 | `every: {days: 0}` | PASS | - | zod: `Number must be greater than or equal to 1 at every.days` |
| 4 | `every: {days: 100000}` | PASS | - | zod: `Number must be less than or equal to 3650 at every.days` |
| 5 | every: `"weekly"`, `"monthly"`, `"quarterly"`, `"yearly"`, `{days: n}` | PASS | - | all five accepted; `{days: 1}` and `{days: 3650}` are the bounds |
| 6 | `start_date: "2026-13-45"` | PASS | - | `start_date must be a real calendar date as YYYY-MM-DD` |
| 7 | `start_date: "1900"` | PASS | - | same; a bare year is not a date |
| 8 | `start_date: "2100"` | PASS | - | same |
| 9 | `start_date: "1900-01-01"` then `invoice_generate_due` | **FAIL** | yes | see D-R1: 1,520 due periods were offered; now 60 per run with the remainder named |
| 10 | `start_date: "2100-01-01"` | PASS | - | accepted, nothing due, `next_due 2100-01-01` |
| 11 | `end_date` before `start_date` (create and update) | PASS | - | `end_date 2025-01-01 is before start_date 2026-01-01` |
| 12 | 1,000 line items | **FAIL** | yes | was accepted and rendered a 56 KB PDF; now refused at the schema, `at most 200 line items` |
| 13 | `unit_price: 1e308` | PASS | - | `unit_price is out of range` (finite, +/- 1e12) |
| 14 | `unit_price: -50` | PASS by design | - | stored, `EUR -50.00`; a negative line is a credit/discount line and the engine's minor-unit maths is sign-safe |
| 15 | `currency: "XYZ"` | **FAIL (silent)** | yes | was stored and printed `XYZ 10.00` on every future PDF; now `"XYZ" is not an ISO 4217 currency code` on create AND update |
| 16 | `as_of: "2126-01-01"` on a plain monthly schedule | **FAIL** | yes | created **1,193 invoices and 1,193 PDFs, 6.0 MB, 6.8 s** in one call; now 60, oldest first, and the answer names the remainder |
| 17 | `as_of: "2020-01-01"` (before start) | PASS | - | `created 0 invoices, skipped 0`; `invoices.json` is never created |
| 18 | paused schedule + `invoice_generate_due` | PASS | - | `created 0 invoices`, no file written |
| 19 | `schedule_delete` then `invoice_generate_due` | PASS | - | `created 0 invoices`; the deleted schedule's invoices and history rows stay |
| 20 | delete, then RE-CREATE the same schedule, then generate | **FAIL (silent double-bill)** | yes | INV-0003/0004 re-billed the same two periods with no warning, contradicting the tool's own copy; now a named warning, and the copy says what actually happens |
| 21 | corrupt `history.json` | PASS | - | `data file is corrupt; moved to ...`, quarantine marker written, both `dry_run` and the real run refuse, `invoices.json` still holds exactly 2 - **no re-bill** |
| 22 | corrupt `schedules.json` | PASS | - | every reader (`schedule_list`, `schedule_create`, `invoice_generate_due`, `forecast`, `schedule_upcoming`) fails with the same quarantine error |
| 23 | invoice store with no business profile | PASS | - | generates; the PDF carries `(Your business)` and the response prints `NO_BUSINESS_NOTE` once |
| 24 | two processes, one data dir, 36 concurrent periods | PASS | - | unchanged from the build run: 36 created between them, 36 unique numbers, 36 unique `(schedule_id, period)` keys, third run creates 0 |
| 25 | stdout is JSON-RPC only | PASS | - | 0 non-JSON stdout lines across every probe; no `console.log/info/warn` in `src/` |
| 26 | no network | PASS | - | no `fetch`, `http`, `net`, `dns` in `src/` |

### The one that would have cost money

Probe 16. `invoice_generate_due {as_of: "2126-01-01"}` is a two-character typo away from
`"2026-01-01"`, and on a one-line monthly schedule it created **1,193 real invoices**, rendered
**1,193 PDFs** and burned **1,193 numbers out of the shared `INV-YYYY-NNNN` series** that the invoice
server also allocates from. Nothing in the tool bounded it: `MAX_OCCURRENCES = 5000` in `period.ts` is a
loop guard, not a billing guard, and 5,000 monthly steps is 416 years. A schedule with
`start_date: "1900-01-01"` reaches the same place without any typo at all (1,520 periods offered).

Fix, `src/index.ts`:

- `MAX_PERIODS_PER_RUN = 60`. `dueRows()` is sorted oldest-period-first and sliced; the remainder stays
  due. Idempotency is untouched - the key is still `(schedule_id, period)` - so continuing is literally
  calling the tool again.
- Both the dry run and the real run report it: `still_due_after_this_run` in the JSON, and in prose
  *"One run creates at most 60 invoices, oldest period first. 1133 periods are still due; call
  invoice_generate_due again to continue, or check as_of and the schedule's start_date if that number
  looks wrong."* The last clause is the point: the user is told the number so a typo is visible.
- 60 is one full month-by-month catch-up of a five-year-old schedule, which is the largest legitimate
  backlog this tool has produced in any run.

### Edits made in Part 1

| File | Change |
|---|---|
| `src/currency.ts` | new: the ISO 4217 active alphabetic set + `isKnownCurrency()` |
| `src/index.ts` | `MAX_PERIODS_PER_RUN = 60`, applied to `invoice_generate_due` in both modes, reported in JSON and prose (D-R1) |
| `src/index.ts` | `MAX_ITEMS = 200` on `schedule_create` and `schedule_update` (D-R2) |
| `src/index.ts` | ISO 4217 check on `schedule_create` and `schedule_update` (D-R4) |
| `src/index.ts` | duplicate `(client, period)` warning in `invoice_generate_due`, resolving the client name through the generated invoice so a DELETED schedule's rows still count (D-R3) |
| `src/index.ts` | `schedule_delete` description and response corrected: the id-keyed history cannot stop a re-created schedule, and now says so |
| `test/adversarial.test.mjs` | new file, 9 tests covering all of the above (4 more were added in Part 2) |

---

## Part 2 - user value through a real MCP client

`claude -p "<prompt>" --mcp-config mcp3.json --strict-mcp-config --model sonnet --output-format json
--max-turns 16 --allowedTools "<24 tools by name>"`, one resumed session, fresh data dir, Pro key.
The per-tool allowlist is written out by name because `--allowedTools "mcp__*"` grants nothing
(D-E4 in `docs/USER_VALUE_R7.md`); that is a harness fact, not a server defect.

Pro rather than free, because the scenario's own words - "the last day of each month" - are the
`end_of_month` / `anchor_day` rules, which the free tier strips. As it turned out the model never
needed them (see the note under s2), but the run should not have been testing a paywall.

### Scorecard - 18 / 18 (before the Part 2 fixes: 15 / 18)

3 = correct, right numbers, no clarification. 2 = correct but the user has to close a gap.
1 = partially wrong. 0 = failed.

| # | Scenario | Before | After | Calls | Sec | Tools | Note |
|---|---|---|---|---|---|---|---|
| s1 | "Set up my business Lucky Strike Software, 23% VAT." | 3 | 3 | 1 | 6.4 | `business_set` | `business.json` holds `name: "Lucky Strike Software", default_tax_rate: 23, default_currency: "EUR", payment_terms_days: 14, invoice_prefix: "INV"`. The model named the three defaults it had chosen rather than the two facts it was given. |
| s2 | "Bill Acme 12 hours a month at 90 EUR on the last day of each month starting August 1, due in 14 days." | 3 | 3 | 2 | 27.1 | `schedule_list`, `schedule_create` | Stored `start_date: "2026-08-31"`, `every: "monthly"`, `due_days: 14`, one item `12 x 90`. It resolved "last day of each month starting August 1" into the FIRST OCCURRENCE, 08-31, and did not reach for `end_of_month` at all - correct, because rule 3 in `period.ts` keeps anchor day 31 and clamps, so the series is 08-31, 09-30, 10-31, 11-30, and February lands on the 28th/29th. It stated the arithmetic, EUR 1,080 + 23% = **EUR 1,328.40**, before anything was invoiced. |
| s3 | "What is due in the next 30 days?" | **2** | **3** | 1 | 6.9 | `schedule_upcoming` | Before: the tool answered with the 09-30 occurrence only, and the unbilled 08-31 period was invisible - the first run recovered it from the conversation, which a fresh session would not have. After D-R5: `past_due_not_yet_invoiced` is in the payload and the answer flags "the 2026-08-31 Acme occurrence (EUR 1,328.40) hasn't been invoiced yet" as a separate line. |
| s4 | "Generate everything that is due and show me the invoices." | 3 | 3 | 2 | 18.7 | `invoice_generate_due`, `invoice_get` | **Exactly one** invoice, the 08-31 period; 09-30 correctly withheld as not yet due. `INV-2026-0001`, net 108000, tax 24840, total **132840 minor = EUR 1,328.40**, due 2026-09-14, one PDF on disk starting `%PDF-`. |
| s5 | "Run it again." | 3 | 3 | 1 | 3.9 | `invoice_generate_due` | *"Nothing new"*. `invoices.json` still holds one row, `history.json` one row. |
| s6 | "Pause Acme for October and show the forecast for the next 3 months." | **1** | **3** | 2 | 9.5 | `schedule_skip`, `forecast` | See below. |

**Totals: 9 tool calls, 72.5 s of wall clock, 18 / 18.**

### The scenario that failed

s6 is the only sentence in the set that the server could not answer at all, and it failed three times over.

1. `schedule_pause` stops the WHOLE schedule, so September stopped billing too.
2. A resumed schedule back-bills what it missed - by design, and correct for a holiday - so October
   would simply arrive late. There was no way to close one period.
3. `forecast` dropped paused schedules entirely, so the answer to "show me the forecast" was **EUR 0**.

The first run ended with the model refusing to proceed and offering the user two workarounds, neither
of which does what was asked. That is the right answer to a tool that cannot express the request, and
it is a 1.

Fixes, `src/index.ts`:

- **`schedule_skip {id, period, undo?}`** (new tool). Writes a history row with `skipped: true` and no
  invoice number, so the existing `(schedule_id, period)` idempotency key closes that period for good
  while every other period bills normally. It refuses a date that is not an occurrence of the schedule
  (and names the nearby ones), refuses a period that was already invoiced, and `undo: true` reverses it.
- **`forecast` reports paused schedules separately** (`paused_not_included`) instead of answering 0.
- **`forecast` and `schedule_upcoming` subtract settled periods.** The second run exposed this one: with
  `schedule_skip` shipped but the forecast still projecting the flat cadence, the model called October at
  EUR 1,328.40, noticed it contradicted the skip it had just made, and reported *"that looks like a
  quirk/bug in `forecast` ... don't rely on that number for October"* - correct, and a 2, because the
  user was handed a corrected table plus a warning about their own tool. After the fix the third run
  answers the question in four tool calls with no caveat at all.

### Defects

| id | Defect | Repro | Status |
|---|---|---|---|
| D-R1 | One `invoice_generate_due` call could create unlimited invoices and PDFs | `schedule_create` monthly from 2026-01-01, then `invoice_generate_due {as_of: "2126-01-01"}` -> 1,193 invoices, 1,193 PDFs, 6.0 MB | fixed: 60 per run, remainder named |
| D-R2 | A schedule accepted 1,000 line items and rendered them onto every period's PDF | `schedule_create` with a 1,000-entry `items` array | fixed: `MAX_ITEMS = 200` |
| D-R3 | Delete + re-create silently double-billed; the tool's own copy claimed it could not | create, generate 2, `schedule_delete`, create the same schedule, generate -> INV-0003/0004 repeat 08-01 and 09-01 | fixed: named warning at generate time, copy corrected |
| D-R4 | Any 3-letter string was accepted as a currency and printed on every PDF | `schedule_create {currency: "XYZ"}` -> stored, `XYZ 10.00` | fixed: ISO 4217 check on create and update |
| D-R5 | "What is due" hid periods that had already fallen due and were never invoiced | schedule from 2026-01-31, `schedule_upcoming` -> only future dates | fixed: `past_due_not_yet_invoiced` |
| D-R6 | No way to skip one period; pause stops everything and a resume back-bills | s6 | fixed: `schedule_skip` |
| D-R7 | `forecast` answered 0 for a paused schedule instead of showing what was paused | pause the only schedule, `forecast {months: 3}` -> `per_month: []` | fixed: `paused_not_included` |
| D-R8 | `forecast` and `schedule_upcoming` projected periods that were already invoiced or skipped | `schedule_skip` October, `forecast {months: 3}` -> October still EUR 1,328.40 | fixed: settled periods excluded and listed |
| D-R9 | A fire-and-forget JSON-RPC probe races a stateful server and reports false PASSes | send `schedule_create` and `invoice_generate_due` on one write, read the replies afterwards | harness defect, not a server defect: Part 1 uses a sequential probe |

Not fixed, by design: a negative `unit_price` is accepted (a credit or discount line, and the minor-unit
maths is sign-safe); `schedule_history` stays Pro; the free tier still caps active schedules at 3,
`schedule_upcoming` at 30 days and `forecast` at 3 months.

---

## Final test summary

```
$ npm run build -w packages/mcp-license -w servers/invoice -w servers/recurring   # clean
$ npm test -w servers/recurring
# tests 26
# pass 26
# fail 0
# duration_ms 3193.947708
$ npm test -w servers/invoice
# tests 28
# pass 28
# fail 0
```

26 = 10 period cases + 2 stdio smoke + 1 concurrency (unchanged) + 13 new adversarial cases.

## RESULT.md block

```
status: DONE
evidence: see docs/RECURRING_AUDIT.md; 26/26 recurring tests, 28/28 invoice tests, 0 non-JSON stdout
  lines across 26 adversarial probes, Part 2 scored 18/18 in 9 tool calls / 72.5 s
artifacts: servers/recurring/src/{index,store,currency}.ts, servers/recurring/test/adversarial.test.mjs,
  servers/recurring/README.md, docs/RECURRING_AUDIT.md
cost: 30 wall minutes
failures: 8 server defects (D-R1..D-R8), all fixed and pinned by a test
insight: the two defects that mattered were both the same mistake in opposite directions - a number the
  tool refused to bound and a number the tool refused to show. invoice_generate_due would bill 1,193
  periods off a two-character typo in as_of, and forecast would answer EUR 0 for a paused schedule
  rather than say what was paused. A billing tool is judged on the numbers it declines to invent: the
  cap is only safe because the response says how many periods are still due, and the forecast is only
  honest because it names what it left out. The client model caught the forecast defect itself in run 2
  and warned the user off its own tool's number, which is the cheapest defect detector in this harness.
```
