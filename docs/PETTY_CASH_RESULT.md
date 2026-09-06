# mcp-petty-cash: build

Date 2026-09-06. Scope: `servers/petty-cash` only, plus `scripts/gen-spec.mjs` (one
`CURATED` entry and one name in `SERVERS`) and this file. `servers/invoice/src/index.ts`
was NOT touched: `PROFILE_READERS` already carried `petty-cash` in HEAD, and this server
does import `readSharedProfile`, so `servers/invoice/test/profile-readers.test.mjs` passes
as it stands (1/1). Nothing in `packages/mcp-license`, `remote/`, the pages, the bundles or
the hosting layer is in this commit; the orchestrator wires those. Pulled `--rebase
--autostash` first. Zero paid API calls, zero network:
`grep -rEn "fetch\(|https?://|node:http|node:net|node:dns" servers/petty-cash/src/`
returns only the checkout host in the licensing copy, and the contract suite asserts that.

One thing outside the scope has to be landed by the orchestrator. Adding a 27th server
that sells Pro makes `packages/mcp-license/test/bundle-link.test.mjs` fail:

    SERVER_COUNT is 26 but 27 servers build a licence gate (... petty-cash ...).
    Update SERVER_COUNT in packages/mcp-license/src/index.ts and
    remote/src/shims/license.ts together, or every cap message names a stale count.

Both files still read 26 and neither was edited, because another agent is working in that
package. Bump both to 27 together.

The server is `@theluckystrike/mcp-petty-cash` 0.16.0, 7 tools plus the two license tools,
one resource and one prompt. It reads no sibling store and writes into none. It holds no
copy of the chart of accounts (`CASH`, `expenseAccount` and `accountFor` are imported from
`@theluckystrike/mcp-cash-book/lib`), no copy of the money formatting (`formatMoney`,
`currencyDecimals` from `@theluckystrike/mcp-asset-register/lib`), no copy of the
corrupt-store quarantine (`readJsonFile` from `@theluckystrike/mcp-timezone/lib`), no copy
of the timezone-aware "today" (`@theluckystrike/mcp-quotes/lib`) and no copy of the
licensing or locking code. It exports its own `./lib`: the balance, the reconciliation, the
replenishment, the float store and the two account ids it adds.

## Design decisions worth stating

**The replenishment is `imprest - balance`, never the sum of the vouchers.** This is the
decision the whole server rests on. The two figures differ by exactly what the counts found
over or short, and the sum of the vouchers is the one a person reaches for, because it is
the one the paperwork adds up to. On the worked month the vouchers total 20,194 minor units
and the cheque is 20,205: the count found the tin 11 short, and 11 is a `cash_over_short`
line, not a voucher. Reimbursing the voucher total restores the float 11 light, and the
same defect repeats every cycle while every reconciliation still reports a clean 11. The
unit suite runs three cycles of it and asserts the float ends at 49,967 against a 50,000
imprest.

**A count is a FACT, so it moves the book balance.** Once a count is recorded the balance
is what was counted, and the difference is carried forward as an over or short rather than
re-reported at every later count. The alternative, leaving the book at what the vouchers
say and reporting the same difference forever, makes the second count a copy of the first
and hides the moment a NEW difference appears. The count history keeps every difference, so
a tin that is short by a little every month is visible as a run rather than as one number.
The suite asserts the second count on the same day, with nothing spent in between, comes
back at exactly zero.

**No balance is stored.** The float record holds the imprest, the top-ups and the counts;
every balance is derived on the call from those and the vouchers. A stored balance is a
second copy of what the vouchers already decide, and the copy is the one that gets believed
after somebody deletes a voucher. `contract.test.mjs` greps the raw store file for
`"balance` and asserts the record's keys are the terms and the events only.

**A float is cash in a tin and can never hold less than nothing.** A voucher larger than
the balance on its own date is refused. So is a back-dated one that would make any LATER
day negative, which the at-the-date check alone does not catch: back-dating takes the cash
out earlier, so every day after it is short too. `firstNegative` replays the whole run of
events in date order, and the refusal names the day it breaks, not the day it was typed.

**A reconciled voucher cannot be deleted.** The cash it took out was counted on the day of
the count, so removing it would make a recorded count wrong by its own amount, and the
refusal says so with the number. Deletion is free while a voucher is still uncounted, which
is what keeps the monthly cap honest: a voucher typed in twice would otherwise cost a slot
with no way back but a key. The VOU series never reissues a number, so a gap in it is the
record that a voucher was deleted.

**A byte-identical voucher is refused by name.** Same float, date, amount, category,
description, payee and receipt reference is one voucher entered twice far more often than
it is two identical purchases. The refusal names the id already stored and the way through
(`duplicate_ok`), so the second taxi fare of the day is still recordable, deliberately.

**`replenish_request` writes nothing.** It says what the cheque should be; the cash is
recorded with `topup_record` when it is physically back in the tin, and that call is what
marks the vouchers reimbursed. A request is not a payment, and a float that counts a
request as cash is short by the whole request until the cheque clears.

**Under the imprest system `petty_cash` does not move.** It is debited once when the float
is opened and again only if the imprest itself changes. A replenishment credits `cash` and
debits the expenses; the float account is not in that journal at all, and the suite asserts
its absence.

**The chart of accounts is imported, not restated.** `cash` and the per-category
`expenses:<category>` ids come from `servers/cash-book`'s own `expenseAccount`, so a
category spelled "Office Supplies", "office supplies" and "  OFFICE   SUPPLIES  " is one
account and not three, and no rename in that server can leave this one posting to an
account its ledger does not have. `petty_cash` and `cash_over_short` are this server's
additions, following that file's id convention exactly.

## The worked month

    Imprest                                        50,000   (EUR 500.00)
    VOU-2026-0001  2026-03-02  postage  Stamps       1,250
    VOU-2026-0002  2026-03-05  travel   Taxi         3,480
    VOU-2026-0003  2026-03-11  office   Coffee         899
    VOU-2026-0004  2026-03-18  office   Paper       12,500
    VOU-2026-0005  2026-03-24  travel   Bus          2,065
                                                   -------
    vouchers                                       20,194
    expected on 2026-03-31                         29,806
    counted                                        29,795
    difference                                        -11   short, EUR -0.11
    replenishment (50,000 - 29,795)                20,205
      expenses:office   899 + 12,500 =             13,399
      expenses:postage                              1,250
      expenses:travel  3,480 + 2,065 =              5,545
      cash_over_short                                  11
      cash (credit)                                 20,205

Every figure above is asserted in `test/unit.test.mjs`, and the journal is asserted to
balance to zero.

## Tests

`servers/petty-cash/test/`, 41 assertions over four suites.

| suite | tests | what it holds |
| --- | --- | --- |
| `unit.test.mjs` | 10 | The worked month to the minor unit, the second count, the replenishment and its payload, the top-up, the three-cycle drift, the report, deletion, and the custodian from the shared profile |
| `adversarial.test.mjs` | 14 | Over the balance, the back-dated negative, negative and zero amounts, a count before any voucher, deleting a reconciled voucher, the duplicate, a future date, bad dates, a corrupt store, an ambiguous float, no float at all, both free caps, the engine against the server, and one category spelled three ways |
| `concurrency.test.mjs` | 4 | Forty vouchers from two processes, the race on the 21st free voucher, the race on the second free float, and a count racing a voucher |
| `contract.test.mjs` | 13 | Version identity across four manifests, the remotes rule, stdout, tool hygiene, the tier switch, the resource and prompt, three files and no others, no stored balance, the imported chart of accounts, no network in src, the required files, and integer minor units everywhere |

Selected results:

| # | Case | Result | Evidence |
| --- | --- | --- | --- |
| 1 | The worked month | PASS | expected 29,806, counted 29,795, difference exactly -11, five vouchers listed and marked |
| 2 | The second count | PASS | expected becomes 29,795, difference 0, no voucher reconciled twice |
| 3 | The replenishment | PASS | 20,205 against a voucher total of 20,194, `cash_over_short` 11, journal balances at 20,205 both sides |
| 4 | Three cycles at the voucher total | PASS | float ends 49,967 of 50,000, `differences_net_minor` -33, every individual count reported only -11 |
| 5 | A voucher over the balance | PASS | refused naming the balance on that date; `vouchers.json` was never even created |
| 6 | A back-dated voucher | PASS | 25,000 on the 2nd after 30,000 on the 10th is refused naming the 10th, the day it goes -5,000 |
| 7 | A reconciled voucher deleted | PASS | refused naming the count date and the 12,500 it would break; the store still holds 5 |
| 8 | A byte-identical duplicate | PASS | refused naming VOU-2026-0001; one field changed is not a duplicate; `duplicate_ok` admits it |
| 9 | Reconcile before any voucher | PASS | answers against the imprest with an empty voucher list and says what it proves; before the opening date it is refused |
| 10 | A corrupt store | PASS | every tool refuses, the bytes are quarantined verbatim beside a `.corrupt` marker |
| 11 | Two processes on the monthly cap | PASS | 26 calls, exactly 20 stored, 6 refused, the check and the write one critical section |
| 12 | stdout | PASS | every line across initialize, tools/list, a success and an error parses as JSON-RPC 2.0 |
| 13 | Manifest remotes rule | PASS | `server.mcpb.json` remotes deep-equal `remotes.json` (`/mcp/petty-cash`) with `fileSha256` "TBD"; `server.json`, `server.variant.json` and `server.imprest.json` carry none, and the three registry names differ |
| 14 | One category, three spellings | PASS | all three resolve to `expenses:office-supplies` and one 300 line, via the cash book's own `expenseAccount` |

## Final test summary

    npm run build (repo-wide)                  tsc clean, no output
    npm test -w servers/petty-cash             # tests 41 / # pass 41 / # fail 0
    node --test test/*.test.mjs (repo-wide)    # tests 86 / # pass 86 / # fail 0
    npm test -w servers/invoice                profile-readers 1/1 pass, untouched
    npm test -w packages/mcp-license           # tests 34 / # pass 33 / # fail 1 (SERVER_COUNT 26 vs 27, above)
    node scripts/sync-versions.mjs --check     0 file(s) written
    node scripts/gen-spec.mjs petty-cash       tools=9 resources=1 prompts=1 failure_modes=11, twice, no diff

## RESULT.md block

    status: DONE
    evidence:
    - npm run build (repo-wide): tsc clean
    - npm test -w servers/petty-cash: # tests 41 / # pass 41 / # fail 0
    - node --test test/*.test.mjs: # tests 86 / # pass 86 / # fail 0
    - node scripts/sync-versions.mjs --check: 0 file(s) written
    - Worked month: expected 29,806, counted 29,795, difference -11
    - Replenishment 20,205 against a voucher total of 20,194
    - Categories: office 13,399, postage 1,250, travel 5,545
    - Three cycles at the voucher total leave the float 33 light
    artifacts:
    - /Users/mike/mcp-servers/servers/petty-cash
    - /Users/mike/mcp-servers/docs/PETTY_CASH_RESULT.md
    cost: 52 wall minutes
    failures:
    - The worked month was first dated in the current month, which the future-dated-voucher
      guard refuses. Moved to a past month so the suite cannot depend on the day it runs
    - reconcile checked the last-count date before the opened date, so a count dated before
      the float existed was refused with the wrong reason. Opened date is checked first
    insight:
    - The replenishment is imprest minus balance, never the sum of the vouchers

## The measured insight

**The cheque is not the sum of the vouchers, and nothing in the voucher trail says so.**

On the worked month the tin is 11 minor units short: eleven cents no receipt will ever
explain. The replenishment that restores the float is 20,205, while the vouchers add to
20,194. The 11 is the whole difference between a float that stays at its imprest and one
that shrinks.

What makes it worth a test rather than a comment is what the wrong version looks like.
Reimbursing the voucher total is not obviously wrong: it is what the paperwork totals, it
reconciles against the receipts, and the next count comes back short by 11 again, which
reads as a fresh 11 rather than the same one. `unit.test.mjs` runs three cycles of exactly
that and the float ends 33 minor units light with three clean-looking reconciliations
behind it. The tin gets smaller and no single number in the record ever looks wrong.

Built by theluckystrike. https://github.com/theluckystrike
