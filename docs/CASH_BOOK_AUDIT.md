# mcp-cash-book: Part 2 CLI run and the Part 1 gaps

Date 2026-09-06. Scope: `servers/cash-book/src`, `servers/cash-book/test` and this file.
`remote/`, billing, scripts and the cash-book manifests belong to other agents; nothing
there was touched. Pulled `--rebase --autostash` before editing.

Part 1 harness: `servers/cash-book/test/_client.mjs`, as in `docs/CASH_BOOK_RESULT.md`.

Part 2 harness: the real `claude` CLI (2.1.261) as an MCP client, `--model sonnet`, against
`/private/tmp/uv-cb/mcp.json`, which registers `cash-book`, `invoice`, `expense-tracker` and
`deposits` together with `--strict-mcp-config`, fresh `XDG_DATA_HOME=/private/tmp/uv-cb/data`,
`XDG_CONFIG_HOME=/private/tmp/uv-cb/cfg` and `XDG_STATE_HOME=/private/tmp/uv-cb/state` placed
in each server's own env block inside `mcp.json` (never `CLAUDE_CONFIG_DIR`, never the CLI's
own environment), and an explicit per-tool allowlist of every `mcp__cash-book__*`,
`mcp__invoice__*`, `mcp__expense-tracker__*` and `mcp__deposits__*` tool plus
`license_status`/`license_activate` on each. A shared business profile was written directly to
`data/mcp-servers/profile/business.json` before the run: name "Nova Studio",
`default_currency EUR`, `timezone Europe/Warsaw`, `default_tax_rate 23`. All four servers
stayed on the free tier for the whole run except prompt 6, which asks for the one Pro tool on
purpose. Each prompt is one bounded `-p` call with `--resume <session-id>` chaining the same
conversation, request timeout 240 s (every call completed well inside it, longest 18.8 s of API
time). Machine day: Sunday 2026-09-06. `claude` resolves to a shell function that prints a MOTD
banner to stdout before the JSON-RPC-shaped `--output-format json` line; the JSON is always the
last non-empty line of the captured output, so results were read from that line.

No allowlist misses this time: `invoice_from_hours` and the correct deposits tool names
(`deposit_record`, `deposit_apply`, `deposit_balance`) were already known from
`docs/STATEMENT_AUDIT.md`'s Part 2 run against the same sibling servers, so the allowlist was
built right the first time and every one of the six prompts completed on its first attempt.

---

## Part 2 — six prompts through the claude CLI

Scores are 0-3, checked against `invoices.json` (invoice), `data.json` (expense-tracker),
`deposits.json` (deposits) and `periods.json`/`closes.json` (cash-book, written under
`/private/tmp/uv-cb/data/mcp-servers/cash-book/`) on disk, not against the model's prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "Invoice Acme 10 hours at EUR 90 and they paid EUR 500 of it" | 3 | `invoice_from_hours` then `invoice_mark_paid`. Store: `INV-2026-0001`, 10h x EUR 90 = `net_minor 90000`, 23 percent VAT `tax_minor 20700`, `total_minor 110700`, `paid_minor 50000`, one payment row of 50000 dated 2026-09-06, `status: "partial"`. The model applied the shared profile's 23 percent default tax rate and said so, and flagged that Acme was auto-created with no address on file rather than inventing one |
| 2 | "Log EUR 123 for hosting and EUR 45.50 for a domain" | 3 | Two `expense_add` calls. Store: hosting 12300 minor, category `software`, `vat_rate` defaulted from the shared profile to 23, net 10000/VAT 2300; domain 4550 minor, same category and rate, net 3699/VAT 851 (round(4550*23/123) = 851). Both `billable: false` since no project was given. The model's table matched the stored split to the cent: 100.00/23.00 and 36.99/8.51 |
| 3 | "Acme's EUR 200 retainer arrived, apply it to their invoice" | 3 | `deposit_record` then `deposit_apply`. Store: `DEP-2026-0001`, `amount_minor 20000`, one application of 20000 against `INV-2026-0001`, `status: "applied"`. `invoices.json` shows `INV-2026-0001.paid_minor` raised from 50000 to 70000 by the application, with only the one payment row still present — matching the design decision that a deposit application never appends to `payments[]`. Reported balance due EUR 407.00 (1107.00 - 700.00), correct |
| 4 | "Build this month's ledger and show me the trial balance" | 3 | `ledger_build` then `trial_balance`. Answered debits = credits = EUR 2,175.50, imbalance zero. Cash EUR 531.50, receivables EUR 407.00, VAT output -EUR 207.00, VAT input EUR 31.51, expenses:software EUR 136.99, deposits held EUR 0.00, revenue -EUR 900.00. Hand check below |
| 5 | "What is in the cash account?" | 3 | `ledger_lines` filtered to `account: cash`. Answered the same four movements the ledger derives: +200.00 deposit received, +500.00 invoice payment, -123.00 hosting, -45.50 domain, net EUR 531.50. Matches prompt 4's cash figure exactly, and matches the deposit-application design rule: the 200.00 retainer's application to the invoice does NOT appear a second time in cash, only its receipt does |
| 6 | "Close the month" | 3 (correct refusal) | `month_close` refused: "this account is on the free tier — nothing was written." No `closes.json` file exists on disk after the call — confirmed by directory listing. The model additionally flagged, on its own, that 2026-09-06 is not the end of September and that closing now would snapshot a partial month, and offered the two real options (upgrade, or wait) rather than inventing a close or a fabricated snapshot |

Scorecard: **3.00 / 3** (18 of 18).

### Prompt 4 hand-verified to the minor unit

Entries posted this period, in `Nova Studio`'s EUR book, 2026-09-01 to 2026-09-06:

| document | posting |
| --- | --- |
| `DEP-2026-0001` received, 200.00 | Dr cash 200.00, Cr deposits held 200.00 |
| `INV-2026-0001`, net 900.00 + 23% VAT | Dr receivables 1,107.00, Cr revenue 900.00, Cr VAT output 207.00 |
| payment on `INV-2026-0001`, 500.00 | Dr cash 500.00, Cr receivables 500.00 |
| `DEP-2026-0001` applies 200.00 to `INV-2026-0001` | Dr deposits held 200.00, Cr receivables 200.00 |
| expense hosting, 123.00 gross at 23% | Dr expenses:software 100.00, Dr VAT input 23.00, Cr cash 123.00 |
| expense domain, 45.50 gross at 23% | Dr expenses:software 36.99, Dr VAT input 8.51, Cr cash 45.50 |

- Cash: 200.00 + 500.00 - 123.00 - 45.50 = **531.50**, matches the model and `ledger_lines`.
- Receivables: 1,107.00 - 500.00 - 200.00 = **407.00**, matches.
- Revenue: 900.00 (credit balance, shown as -900.00), matches.
- VAT output: 207.00 (credit, shown as -207.00), matches.
- VAT input: round(12300*23/123) + round(4550*23/123) = 2300 + 851 = **3151** minor = 31.51, matches.
- Expenses:software: 10000 + 3699 = **136.99**, matches.
- Deposits held: 200.00 received - 200.00 applied = **0.00**, matches.
- Total debit legs: 200.00 + 1107.00 + 500.00 + 200.00 + 123.00 + 45.50 = 2,175.50 = total
  credit legs (200.00 + 900.00 + 207.00 + 500.00 + 200.00 + 45.50), the figure the trial
  balance itself reports. Zero imbalance, no offenders.

### The retainer-applied identity, live through three real servers

This is the sharpest check in the six-prompt run, the same one `STATEMENT_AUDIT.md` measured
for `statement_build`: `deposit_apply` raised `INV-2026-0001.paid_minor` from 50000 to 70000
with no new `payments[]` row, and `trial_balance`'s cash figure (531.50) counts only the 200.00
deposit RECEIPT and the 500.00 direct payment, never the 200.00 application a second time. A
cash-book that got this wrong would have posted the application to cash too, showing EUR
731.50 in the cash account and a trial balance that still balanced — the double-count design
flaw named in `CASH_BOOK_RESULT.md` would have been invisible from the trial balance alone,
and only prompt 5's line-by-line cash listing (four movements, not five) proves it did not
happen here.

### Prompt 6: how the refusal reads and whether the model invents a close

It does not. The Pro gate fires before any write, the response states the refusal in the
tool's own words ("nothing was written"), and no `closes.json` file exists under
`/private/tmp/uv-cb/data/mcp-servers/cash-book/` afterward — `periods.json` (from prompt 4)
is present, `closes.json` is not. The model also reasoned about the calendar on its own
(2026-09-06 is not month-end) without being asked to, which is a second reason not to close
right now that has nothing to do with licensing — a correct answer volunteered, not required
by the gate.

---

## Part 1 — the eight named gaps

All eight gaps named in this task's brief were checked against `servers/cash-book/test/*.mjs`.
Six were already asserted before this pass; two (a missing bank store specifically, and an
expense with literally no `vat_rate` field checked as its own line-level assertion rather than
folded into the worked-month aggregate) did not have a standalone assertion and were added.

| # | Probe | Result | Where |
| --- | --- | --- | --- |
| 1 | A missing bank store | PASS, test ADDED | `adversarial.test.mjs` "a missing bank store never blocks a build, and costs nothing but the reconciliation": trial balance still balances, `sources` reports `bank-statement` as `read: true, rows: 0` (never `read: false`), and no line carries a `bank_ref`. The generic "every absent store says rows 0" test was also tightened to assert `bank-statement` by name, not only `deposits` and `expense-tracker` |
| 2 | An invoice in USD among EUR ones | PASS, re-verified | `adversarial.test.mjs` "two currencies in one period are refused by name, and naming one excludes the other" — a period with a EUR invoice and a USD invoice is refused naming both currencies; asking for EUR alone posts only the EUR side and counts the USD invoice as excluded, never summed. `CASH_BOOK_RESULT.md` probe 22 |
| 3 | A deposit applied to an invoice not in the store | PASS, re-verified | `adversarial.test.mjs` "a deposit applied to an invoice that does not exist is reported and never posted": the application is not posted, the full deposit is still carried as a liability, and the exception names the amount deposits held is too high by. `CASH_BOOK_RESULT.md` probe 25 |
| 4 | An expense with no VAT | PASS, test ADDED | `adversarial.test.mjs` "an expense with no VAT rate posts gross to the category account, no VAT input line at all": one 50.00 expense with no `vat_rate` on the record posts the full 50.00 to `expenses:software` and cash, zero VAT lines, even though the shared profile carries `default_tax_rate: 23` — proving the missing rate is read as "none stored" and not silently backfilled from the profile default that `expense_add` itself would have applied at write time |
| 5 | A bank row that matches two payments | PASS, re-verified | `adversarial.test.mjs` "a bank row that could be either of two expenses is matched to neither": two same-amount, same-day expenses against one bank debit leave both candidates named and no `bank_ref` written on either posting. `CASH_BOOK_RESULT.md` probe 24 |
| 6 | A corrupt expense store | PASS, re-verified | `adversarial.test.mjs` "an unreadable expense ledger is never read as an empty one": `read: false` with the parse error, a note naming expenses and VAT input as MISSING, and the ledger still balances on what remains. `CASH_BOOK_RESULT.md` probe 20 |
| 7 | Two processes on the free cap | PASS, re-verified | `concurrency.test.mjs` "two processes racing the third free period cannot both pass the meter": exactly 3 periods stored, the rest refused, one critical section around the check and the write. `CASH_BOOK_RESULT.md` probes 33/34 |
| 8 | (implicit pairing, corrupt store's own register) | PASS, re-verified | `adversarial.test.mjs` "a corrupt register of this server's own blocks building and leaves the trial balance answerable" — the server's own `periods.json`, not a sibling's, corrupted; `trial_balance` never touches the register so it still answers. `CASH_BOOK_RESULT.md` probe 31 |

Two new tests were added to `servers/cash-book/test/adversarial.test.mjs`:

1. `"a missing bank store never blocks a build, and costs nothing but the reconciliation"`
2. `"an expense with no VAT rate posts gross to the category account, no VAT input line at all"`

Both close a real gap: the existing suite proved a missing store in general is non-fatal and
proved VAT-inclusive expenses split correctly when a rate IS present, but neither test named
`bank-statement` by store name nor asserted a no-VAT expense at the line level (only inside the
worked month's aggregate trial balance, where a wrong VAT-input figure of zero would have been
indistinguishable from "no expense posted at all" without inspecting individual lines). No
source file in `servers/cash-book/src` changed — the behaviour was already correct in both
cases; only the assertion coverage was missing.

---

## Final test summary

    npm run build (repo-wide)                 tsc clean, no output
    npm test -w servers/cash-book              # tests 43 / # pass 43 / # fail 0
    npm test (repo-wide)                       exit code 0
    node scripts/sync-versions.mjs --check     0 file(s) written

Part 2's harness artifacts (`mcp.json`, the seeded profile, the six response JSON files) live
in `/private/tmp/uv-cb` and are not part of the repo.

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build (repo-wide): tsc clean
    - npm test -w servers/cash-book: # tests 43 / # pass 43 / # fail 0
    - npm test (repo-wide): exit code 0
    - node scripts/sync-versions.mjs --check: 0 file(s) written
    - Part 2: claude CLI 2.1.261, sonnet, cash-book + invoice + expense-tracker + deposits,
      per-tool allowlist, fresh XDG dirs in mcp.json's server env, shared profile (Nova
      Studio, Europe/Warsaw, EUR, 23 percent), free tier throughout except the deliberate
      Pro prompt, 6 prompts, all first-attempt, 3.00/3, trial balance verified to the minor
      unit (debits = credits = EUR 2,175.50), cash account cross-checked two ways (ledger
      derivation and ledger_lines listing) at EUR 531.50, month-close correctly refused on
      free tier with no closes.json written and no fabricated snapshot
    - Part 1 gap-fill: all 8 probes named in the brief checked; 6 already asserted in
      docs/CASH_BOOK_RESULT.md's 41-row table and re-verified passing; 2 (a missing bank
      store by name, an expense with no VAT rate at the line level) had no standalone
      assertion and were added to adversarial.test.mjs; no source defect found, no source
      file changed
    artifacts:
    - /Users/mike/mcp-servers/docs/CASH_BOOK_AUDIT.md
    - /Users/mike/mcp-servers/servers/cash-book/test/adversarial.test.mjs
    cost: 35 wall minutes
    failures:
    - None. No allowlist miss this run (the tool names were already known from
      docs/STATEMENT_AUDIT.md's Part 2 pass against the same sibling servers)
    insight:
    - The retainer application in prompt 3 is the sharpest check in the six-prompt run:
      deposit_apply raised INV-2026-0001's paid_minor by 20000 with no new payments[] row,
      and the cash account (verified two ways: the derived trial balance and the raw
      ledger_lines listing) counts only the deposit's original receipt, never its later
      application. A cash-book that double-posted the application would have shown EUR
      731.50 in cash instead of EUR 531.50 while the trial balance still balanced perfectly
      — the defect this server's own design doc names as the reason bank rows never post
      would have been completely invisible without prompt 5's line-level cash listing

Built by theluckystrike. https://github.com/theluckystrike
