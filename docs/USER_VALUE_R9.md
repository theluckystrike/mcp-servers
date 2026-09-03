# User value audit, round 9 — 2026-09-03

Round 9 is a **regression round**. Round 8 ran a freelancer's week as twelve sentences in one
conversation and scored 27/36; eight of those twelve scenarios scored below 3, and every deduction
was written up as a defect (D-R31..D-R40) and fixed the same day. Round 9 re-runs the same week,
same prompts, same order, on the fixed code, and scores only the eight that were short: **1, 3, 4,
5, 6, 9, 10, 11**. The other four (2, 7, 8, 12) were re-run because the conversation needs them —
you cannot invoice in sentence 8 what sentence 5 never logged — but they carry their round-8 score
and are not re-scored.

## Method

Identical to round 8, on a fresh base directory.

- **Client** — `claude -p ... --model sonnet --strict-mcp-config --output-format stream-json
  --verbose --max-turns 18`, per-tool allowlist written out by name, **108 entries**, taken from a
  live `tools/list` against the bundle (`/private/tmp/uv51/tools.mjs`), because `--allowedTools
  "mcp__*"` grants nothing (D-E4, round 7). A first attempt at this lane wrote the allowlist as bare
  tool names rather than `mcp__office__`-prefixed ones; every call came back as a permission refusal
  and the lane was discarded and re-run, not scored.
- **Server** — `servers/office-suite/dist/index.js` **v0.4.1** registered as ONE server named
  `office`, proxying eleven children. `tools/list` returns **108 tools**.
- **One lane, one conversation** — `/private/tmp/uv51`, fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME`,
  `MCP_LICENSE_KEY=""` (**free tier throughout**), `--session-id` then thirteen `--resume`.
- **Fixture** — none, except the same one-off ECB cache warm (`seed.mjs`). Every row in every store
  below was created by the model in this run.
- **Clock** — run start 15:41 local (UTC+07) = 08:41 UTC, Thursday 2026-09-03. "Yesterday" is
  2026-09-02. The declared home zone is Europe/Warsaw (UTC+02 in September), which is what round 8's
  D-R35 turned on.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap to close. 1 = partially wrong, or asked for something the tool
could infer. 0 = failed. Tool-call counts exclude the client's own `ToolSearch` schema lookups.

## Scorecard — 23 / 24 (round 8 on the same eight: 15 / 24)

| # | Server(s) | Scenario | R8 | R9 | Calls | Sec | What changed |
|---|---|---|---|---|---|---|---|
| 1 | invoice + shared profile | "I am Lucky Strike Software in Warsaw, VAT PL1234567890, I invoice in EUR with 23% VAT, 14-day terms." | 2 | **3** | 1 | 11.1 | One `invoice_business_set`, and the response now says the facts went to `mcp-servers/profile/business.json` "which docx, expense-tracker, recurring, time-tracker, timezone, resume and clauses all read. You do not need to repeat it anywhere else." The model relayed exactly that and **did not leave the bundle** to write the same facts into the CLI's memory directory, which it did twice in round 8. D-R31 fixed. |
| 3 | clauses + docx | "Write a proposal for Nova: API redesign, 3 phases, 6,000 EUR, using my standard scope and payment clauses." | 2 | **3** | 4 | 42.3 | `clause_list` -> `clause_get {scope-of-work}` -> `clause_get {payment-terms}` -> `proposal_create`, and the proposal was created **on the first call**: no missing-profile refusal, one reference burned (`PROP-2026-0001`), one row in `documents.json`, no phantom path. D-R31/D-R32 fixed. The letterhead prints `[add: email]` and the model surfaced it as a question instead of inventing an address — `word/document.xml` contains no `@` at all. D-R40 fixed. |
| 4 | clauses | "Draft the contract from my clause library: scope, payment 50% upfront, IP on final payment, Polish law." | 2 | **3** | 3 | 18.2 | Two `clause_get` then `contract_assemble`. The payload carries `resolved_references: []` and `missing_references: [{scope-of-work -> revisions}, {governing-law -> dispute-resolution}]`, the note says "The document cites nothing it does not contain", and the model passed both to the user with the offer to add them. Round 8's contract cited two clauses it did not contain. D-R37 fixed. |
| 5 | time-tracker | "Start a timer on Nova, API design." / "Stop it and log 3 more hours yesterday on Nova at 90 EUR." | 2 | **3** | 3 | 20.2 | `timer_start` -> `timer_stop` (11 s) -> `entry_add`. Both round-8 deductions are gone in the store: the stopped timer holds **no `rateCents` and no `currency`** (round 8 wrote `USD 0.00` into a EUR business), and the 3 h are stamped `2026-09-02T07:00:00.000Z` = **09:00 Europe/Warsaw**, the zone declared in sentence 1 (round 8 stamped 02:00 Warsaw off the machine zone). EUR 270.00 exact. D-R35 fixed. |
| 6 | expense-tracker | "Log a 61.50 EUR Adobe receipt for Nova, billable, and a 30 km drive to the airport in Poland." | 1 | **3** | 2 | 12.9 | `expense_add` returned `Net EUR 50.00, VAT EUR 11.50 at 23% (your shared business profile default_tax_rate)` — the split round 8 missed entirely, taken from the fact stated in sentence 1. D-R34 fixed. `mileage_add {km: 30, region: "PL"}` -> PLN 34.50, and the tool's own answer states `Project: none - this drive will NOT appear in expense_summary {by: "project"} or in expense_to_invoice` and `Billable: yes`; the model relayed both correctly and asked whether the drive belongs to Nova. Round 8 told the user the opposite of what the store held. D-R36 fixed. |
| 9 | recurring | "Set Nova up on a monthly retainer of 20 hours at 90 EUR from next month and show me the next 3 invoices." | 2 | **3** | 2 | 21.2 | `schedule_create` then `schedule_upcoming {days: 100}`. Round 8 needed a third call (`schedule_update {tax_rate: 0}`) and lost the reason for it; round 9 keeps the profile's 23% and **explains it**, offering `tax_note` by name for the reverse-charge wording. `schedule_upcoming` honoured the 100-day horizon and returned `count: 3, occurrences_found_in_horizon: 3, free_tier_occurrence_cap: 3` — three real occurrences, 2026-10-01 / 11-01 / 12-01 at EUR 2,214.00. Round 8 clamped the window to 30 days and returned one, so two of the "next 3 invoices" were the model's arithmetic. D-R39 fixed. |
| 10 | time-tracker + expense + spreadsheet | "Export this week's Nova time and expenses to a CSV and then open it and total it by type." | 2 | **2** | 4 | 30.4 | `export_csv` -> `expense_export` -> `sheet_read` x2. Two of round 8's three deductions are gone: the expense CSV now carries an `amount` column, so the `sheet_query {col: "amount"}` error does not recur (D-R38 fixed), and the timer stub row is written with **blank** rate/currency/amount rather than a fake 0.00 (D-R35). Totals exact against both files: **EUR 270.00** time, **EUR 61.50** expense. Still 2, for the same two reasons: the PLN 34.50 airport drive is absent from "this week's expenses" because it has no project and **nothing told the user that** at this point in the conversation, and "by type" was answered by the model over two `sheet_read` dumps rather than by `sheet_query`, so the aggregation left the server. D-R41. |
| 11 | resume | 120-word background, then "Tailor my resume to this Nova job posting: ..." | 2 | **3** | 3 | 45.2 | `profile_set` -> `tailor_to_job` -> **`resume_create`**. This is the whole D-R33 fix working: `tailor_to_job` reported the gap as read-only, the model wrote the tailored document with `resume_create` instead of re-writing the stored profile, and `resume/profiles.json` still holds the user's own sentence verbatim — `"Wrote the OpenAPI style guide two of those clients still use"`, with no trace of round 8's silently inserted "and governance documentation". 15 of 30 keywords matched and bolded, nothing fabricated, and the two near-miss keywords were offered as wording tweaks for the user to approve. |

**Scored totals: 22 tool calls, 201.5 s, 23 / 24.** Round 8 spent 34 calls and 328.5 s on the same
eight sentences for 15 / 24.

Carried, not re-scored (they ran to keep the conversation whole): 2 (3/3), 7 (3/3), 8 (3/3),
12 (3/3). Whole-week equivalent: **35 / 36**, against round 8's 27 / 36.

## Independent verification of the numbers

Every row read from the stores under `/private/tmp/uv51/data/mcp-servers`, not from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| One shared identity, written once | `profile/business.json` holds name, address, `vat_id PL1234567890`, `default_currency EUR`, `default_tax_rate 23`, `payment_terms_days 14`, `invoice_prefix INV`, `timezone Europe/Warsaw` after a single `invoice_business_set` | PASS, D-R31 |
| No document burned by a refusal | `docx/documents.json` has exactly **1** entry, `PROP-2026-0001`, path `api-redesign.docx` | PASS, D-R32 |
| No invented email anywhere | `word/document.xml` of the proposal: zero `@` matches; `[add: email]` present. Contract note: `No email is stored, so the letterhead shows "[add: email]"` | PASS, D-R40 |
| Contract cites nothing it lacks | `contract_assemble` payload: `missing_references` names `scope-of-work -> revisions` and `governing-law -> dispute-resolution`, `resolved_references: []` | PASS, D-R37 |
| Timer stub carries no money | `time-tracker/data.json` entry `34d46877`: `seconds: 11, billable: true`, **no `rateCents`, no `currency`** | PASS, D-R35 |
| Home zone honoured | entry `dae76464` `start: 2026-09-02T07:00:00.000Z` = 09:00 in Europe/Warsaw (UTC+02) | PASS, D-R35 |
| VAT split from the shared profile | `expense_add` result: `Net EUR 50.00, VAT EUR 11.50 at 23% (your shared business profile default_tax_rate)`; 61.50 / 1.23 = 50.00 exactly | PASS, D-R34 |
| Mileage tells the truth about itself | `mileage_add` result names `Project: none` and `Billable: yes`, and the model repeated both | PASS, D-R36 |
| Recurring horizon is a count cap, not a shorter window | `schedule_upcoming {days: 100}` -> `horizon_days: 100, to: 2026-12-12, count: 3, free_tier_occurrence_cap: 3`, totals `EUR 6642.00` = 3 x 2,214.00 | PASS, D-R39 |
| Retainer arithmetic | 20 x 90 = 1,800 net; 1,800 x 1.23 = 2,214.00, matching `schedules.json` and every occurrence | PASS |
| The user's resume text was not rewritten | `resume/profiles.json` contains `"Wrote the OpenAPI style guide two of those clients still use"`; the string `governance documentation` does not appear anywhere in the file | PASS, D-R33 |
| Expense CSV money column | header row of `expense-tracker/exports/expenses-2026-08-31-to-2026-09-03.csv`: `id,date,currency,amount,gross,net,vat,vat_rate,...` — `amount` present, no tool error in the lane | PASS, D-R38 |
| Week totals | time CSV: 3 h at EUR 90 = 270, plus the 0 h stub with blank money. Expense CSV: one row, 61.50 gross / 50.00 net / 11.50 VAT | PASS |

## Round 8 defects retested

| id | Round 8 | Round 9 |
|---|---|---|
| D-R31 | one business, three profiles, onboarding filled one | **fixed and exercised** — one write, seven servers read it, and the model stopped writing to the CLI's memory |
| D-R32 | a refused `proposal_create` burned a reference and a monthly document | **fixed** — one call, one number, one row |
| D-R33 | `tailor_to_job` had no write path, so the model rewrote the user's profile | **fixed and exercised** — `resume_create` wrote the document, the stored bullet is byte-identical to what the user dictated |
| D-R34 | the 23% from sentence 1 never reached expense-tracker | **fixed and exercised** — 50.00 + 11.50, with the source named |
| D-R35 | `USD 0.00` timer stub in a EUR business; "yesterday" in the machine zone | **fixed** — no rate on the stub, 09:00 Warsaw on the entry |
| D-R36 | `mileage_add` said nothing about `project` / `billable`, and the model then misreported both | **fixed** — the tool states both, the model relayed both |
| D-R37 | the assembled contract cited two clauses it did not contain | **fixed** — dropped and reported as `missing_references` |
| D-R38 | `amount` vs `gross` column mismatch cost a call | **fixed** — `amount` is in the expense CSV, no error in the lane |
| D-R39 | free tier clamped a 100-day horizon to 30 days and returned one occurrence | **fixed** — horizon honoured, 3 occurrences, cap stated |
| D-R40 | the model invented an email and printed it on a proposal | **fixed** — `[add: email]`, and the model asked instead |

Ten of ten. The one remaining deduction is not one of them.

## Defects

**D-R41 (low, expense-tracker + spreadsheet) — an unprojected mileage line is invisible to the
week's export, and the aggregation left the server.** Scenario 10 asks for "this week's Nova time and
expenses". `expense_export {project: "Nova Labs"}` correctly writes one row, because the PLN 34.50
airport drive from scenario 6 has no project. That is right, and `mileage_add` said so at the time —
but four sentences later the export is silent about it, so the user reads a week total that is short
by one line without being told. `expense_export` should count what it filtered out and say so, the
way `report {unbilled_only: true}` already volunteers "2 entries are hidden because they have already
been invoiced". Second half: the model answered "total it by type" from two `sheet_read` dumps rather
than `sheet_query`, which is the D-R19 class in its mild form — the tool was reached, the aggregation
was not asked of it. Repro: `/private/tmp/uv51/out/s10.jsonl`, `CALLS(4): export_csv, expense_export,
sheet_read, sheet_read`.

## Bottom line

Twenty-three of twenty-four on the eight sentences that were short in round 8, with **35% fewer tool
calls and 39% less wall clock** than round 8 spent on the same eight. Ten of ten round-8 defects are
fixed, and every one of them was exercised for real by this run rather than only by a unit test.

The through-line holds: round 8's finding was that the bundle had no memory of the user, and the
shared business profile is what closed six of the ten defects. A freelancer now states who they are
once, and the VAT split on a receipt, the letterhead on a proposal, the zone on a time entry and the
tax rate on a retainer all come from that one sentence. What is left is smaller and of a different
kind — an export that filters a line out without counting it, and an aggregation the model did in
its own head because the answer was already on screen.

## RESULT.md block

```
status: DONE
evidence:
  8 round-8 scenarios below 3 re-run verbatim in one conversation, 14 turns, office-suite v0.4.1
  108 tools from a live tools/list, per-tool allowlist, free tier, fresh XDG dirs, no seeded fixture
  scored 23/24 (round 8: 15/24) in 22 calls and 201.5 s (round 8: 34 calls, 328.5 s)
  whole-week equivalent 35/36 against round 8's 27/36
  every number reproduced from the stores: profile/business.json written once and read by 7 servers,
    docx/documents.json holds exactly 1 row, time entry 34d46877 has no rateCents, dae76464 starts
    09:00 Europe/Warsaw, expense 61.50 = 50.00 + 11.50 at 23%, schedule_upcoming honoured a 100-day
    horizon with 3 occurrences, resume/profiles.json bullet unchanged, zero @ in the proposal docx
  D-R31..D-R40: 10 of 10 fixed and exercised live
  1 new defect: D-R41 low (unprojected mileage silently absent from the week's export)
cost: 43 wall minutes including one discarded lane (allowlist written without the mcp__office__ prefix)
insight: six of the ten round-8 defects were one defect - the bundle could not remember the user -
  and one shared profile file closed all six. The regression round is where that pays: the fixes were
  not re-tested in isolation, they were re-run inside the same twelve sentences that exposed them,
  and every one of them fired on a fact the user stated once, four to nine sentences earlier.
artifacts:
  docs/USER_VALUE_R9.md, data/user_value_r9.json, data/defect_overrides.json
  /private/tmp/uv51/{mcp.json,allow.txt,run.sh,seed.mjs,tools.mjs,show.py}
  /private/tmp/uv51/out/*.jsonl (14 transcripts)
  /private/tmp/uv51/data/mcp-servers/{profile,invoice,docx,clauses,time-tracker,expense-tracker,recurring,resume,timezone,currency}
```
