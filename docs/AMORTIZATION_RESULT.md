# mcp-amortization: build

Date 2026-09-06. Scope: `servers/amortization` only, plus `scripts/gen-spec.mjs` (one
`CURATED` entry and one name in `SERVERS`) and this file. `servers/invoice/src/index.ts`
was NOT touched: this server does not read the shared business profile, so `PROFILE_READERS`
does not gain it, and `servers/invoice/test/profile-readers.test.mjs` still passes as it
stands. Nothing in `packages/mcp-license`, `remote/`, the pages, the bundles or the hosting
layer is in this commit; the orchestrator wires those. Pulled `--rebase --autostash` first.
Zero paid API calls, zero network:
`grep -rEn "fetch\(|https?://|node:http|node:net|node:dns" servers/amortization/src/`
returns only the checkout host in the licensing copy, and the contract suite asserts that.

One thing outside the scope has to be landed by the orchestrator: adding a 26th server that
sells Pro makes `packages/mcp-license/test/bundle-link.test.mjs` fail on `SERVER_COUNT`,
which is 25 in both `packages/mcp-license/src/index.ts` and `remote/src/shims/license.ts`.
That test names the fix itself: bump both to 26, together, or every cap message in the suite
quotes a stale count. Both files carry the bump in the working tree, and neither is in this
commit.

The server is `@theluckystrike/mcp-amortization` 0.15.0, 6 tools plus the two license tools,
one resource and one prompt. It reads no sibling store and writes into none. It holds no
copy of the money formatting (`formatMoney` and `currencyDecimals` from
`@theluckystrike/mcp-asset-register/lib`), no copy of the exact minor-unit allocator that
the straight-principal method splits with (`allocate`, from the same place), no copy of the
corrupt-store quarantine (`readJsonFile` from `@theluckystrike/mcp-timezone/lib`), no copy
of the timezone-aware "today" (`@theluckystrike/mcp-quotes/lib`) and no copy of the
licensing or locking code. It exports its own `./lib`: the rate arithmetic, the schedule,
the early settlement, the loan store and the three account ids.

## Design decisions worth stating

**The payment never varies and the last period absorbs the residual, in the SPLIT and not
in the payment.** This is the decision every figure in the server rests on. Rounding each
period's interest to the minor unit leaves the closing balance a few units away from zero
after a chain of subtractions, and there are only two places to put that difference: the
final payment, or the final period's interest-and-principal split. The payment is the
amount the borrower is contractually due to pay; the split is not. So the final period's
principal is exactly what is left to repay and its interest is the rest of the same level
payment. On the reference loan that makes the final interest 882 rather than the 880 an
unrounded balance carries, the total interest 66,188 rather than 66,186, and the closing
balance exactly zero, with all twelve payments at 88,849.

**A residual is only absorbed while it IS a residual.** The first cut absorbed it
unconditionally, and that is wrong the moment the balance clears before the term ends: the
rule then reported a final "interest" of 33,608 on a balance of 55,241, and further out it
reported negative interest on a negative balance. Per-period rounding drifts by about one
minor unit a period, so anything wider than the term itself is not drift, it is a final
period that is genuinely short. Then the PAYMENT gives way and the interest stays the
interest actually charged. An interest figure is never negative anywhere in this server,
and the 720-schedule sweep in `adversarial.test.mjs` is the alarm on it.

**A level payment rounded once, repeated, can clear the debt early, and the schedule stops
where the debt does.** See the measured insight below. Filling out the term instead
produces rows the borrower does not owe.

**Compounding and payment frequency are two different clocks.** The rate for one payment
period is the equivalent rate taken through the compounding clock, `(1 + r/m)^(m/p) - 1`,
never the nominal rate divided by the number of payments. It is worth 1.0 percent of the
interest on a one-year loan, in the lender's favour, and it is invisible in a quote.

**No schedule is stored.** The register holds the terms and exactly two derived figures,
the payment and the effective annual rate, kept only so a list does not have to rebuild
every schedule to name the payment. Every row is derived on the call. A stored schedule is
a second copy of what the rate and the term already decide, and the copy is the one that
gets believed after somebody edits the rate. `contract.test.mjs` greps the raw store file
for `opening_minor`, `closing_minor` and `rows` and asserts none of them is there.

**Only the interest is an expense.** `loan_journal` debits interest expense and loan
liability and credits cash, and the `expense_add`-ready payload carries the INTEREST alone.
Booking the whole payment as an expense overstates the cost of the business by the
principal, every period, and still reconciles perfectly against the bank, which is why the
error survives a bank reconciliation.

**Nothing is posted from here.** The journal is a payload for the servers that own the
ledger and the expense book, exactly as `asset_journal` in `servers/asset-register` hands
back an `expense_add` payload rather than appending a row to a store whose id allocation,
category rules and VAT split live inside another server's handler.

**The account ids are the cash book's.** `cash` is `servers/cash-book`'s own `CASH` id,
character for character. `loan_liability` and `interest_expense` are new, because that
server derives no loan entries yet and holds no account for either; they follow its id
convention exactly, so when it does derive them these are the ids it will use and no
journal produced here has to be re-mapped. A contract test greps `cash-book/src/ledger.ts`
for `export const CASH = "cash"`, so a rename over there fails here.

**A balloon is due WITH the last payment and never inside it.** The closing balance of the
final period IS the balloon, and the answer says in words that the borrower owes it on top
of the payment shown. Folding it into the last payment row would make one line of the
schedule the size of a house deposit and would still total correctly.

**Fees are not interest.** An arrangement fee is paid at drawdown, sits outside every
payment row and outside the total interest, and the cost of credit is reported as the two
added together. Rolling the fee into the interest would make the schedule disagree with the
agreement it came from.

**An early settlement is stated gross AND net of the penalty.** A penalty larger than the
interest saved makes repaying early a loss, and the verdict says "COSTS" rather than
reporting a smaller saving. Nothing is written by `loan_repay_early`: the stored agreement
keeps its terms, because an agreement is amended by whoever signs it.

**Currencies are never added together.** This server holds no exchange rate, so one
outstanding figure over a EUR loan and a USD one would be an invented number.

**Month arithmetic clamps.** A loan drawn on the 31st pays on the 28th in February and on
the 31st again in March. Rolling forward would move a payment into the next month and shift
every date after it.

## The worked loan

1,000,000 minor units, nominal 12 percent a year compounded monthly, paid monthly, 12
periods, annuity method, drawn 2026-01-15. `i = 0.12/12 = 0.01` exactly.

    payment = 1,000,000 x 0.01 / (1 - 1.01^-12) = 10,000 / 0.112550770583 = 88,848.79
            = 88,849 minor units, rounded once
    total paid     = 12 x 88,849 = 1,066,188
    total interest = 1,066,188 - 1,000,000 = 66,188

| period | opening | payment | interest | principal | closing |
| --- | --- | --- | --- | --- | --- |
| 1 | 1,000,000 | 88,849 | 10,000 | 78,849 | 921,151 |
| 2 | 921,151 | 88,849 | 9,212 | 79,637 | 841,514 |
| 12 | 87,967 | 88,849 | 882 | 87,967 | 0 |

Period 12 is the one to read: the balance left is 87,967, so the principal is exactly that
and the interest is the rest of the same level payment. An unrounded balance would carry
880, and putting the 2 unit difference in the payment instead would make the final payment
88,847, an amount that is on no agreement.

Three more worked cases are asserted to the minor unit beside it: straight principal on the
same terms (equal principal of 83,333, a payment falling from 93,333 to 84,166, interest
`10,000 + 9,167 + 8,333 + 7,500 + 6,667 + 5,833 + 5,000 + 4,167 + 3,333 + 2,500 + 1,667 +
833 = 65,000`, which is 1,188 less than the annuity charges); a 400,000 balloon (payment
57,309, closing balance exactly 400,000, interest 87,708, principal legs summing to
600,000); and the effective annual rate of a nominal 12 percent compounded monthly,
`1.01^12 - 1 = 12.68` percent.

## Probes

Harness: `servers/amortization/test/_client.mjs` spawns `node servers/amortization/dist/index.js`
on a fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME`. There is no store to seed: this server reads
none. Pro runs use `node scripts/sign-license.mjs amortization`. Every row below is asserted
in `test/{unit,adversarial,concurrency,contract}.test.mjs`.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | The 12-month annuity | PASS | Payment 88,849, total interest 66,188, total paid 1,066,188, id LOAN-2026-0001 |
| 2 | Every row of it, by hand | PASS | Periods 1, 2 and 12 asserted field by field; the chain is walked and closes at zero |
| 3 | The effective annual rate | PASS | 1268 basis points, "12.68", against a nominal "12.00" |
| 4 | Straight principal | PASS | 65,000 of interest, the twelve interest charges asserted as a list, principal legs sum to 1,000,000 |
| 5 | A balloon | PASS | Payment 57,309, closing balance exactly 400,000, interest 87,708, and the note that the balloon is not inside the last payment |
| 6 | A zero rate | PASS | Twelve payments of 83,333 with the last at 83,337, no interest anywhere, payments sum to the principal |
| 7 | Quarterly payments on a monthly-compounded loan | PASS | Periodic rate "3.030100", payment 269,221, first interest 30,301, and the note naming the equivalent rate |
| 8 | Early settlement in full | PASS | At period 6: outstanding 514,920, interest paid 48,014, saved 18,174, net of a 5,000 penalty 13,174 |
| 9 | A penalty larger than the saving | PASS | At period 11 the saving is 882 against a 5,000 penalty; `worth_doing` false and the verdict says COSTS |
| 10 | A partial overpayment, term kept | PASS | 200,000 at period 6 leaves 314,920 over 6 periods, a lower payment, 11,114 of new interest, 7,060 saved |
| 11 | A partial overpayment, payment kept | PASS | The 88,849 payment holds, the term falls to 4, the last payment is 55,793, and 10,754 is saved |
| 12 | The journal | PASS | Dr interest_expense 10,000, Dr loan_liability 78,849, Cr cash 88,849, balanced, in the cash book's names |
| 13 | The expense payload | PASS | 100.00, not 888.49: the principal is not an expense and is named as excluded in the note |
| 14 | A journal by month | PASS | Same entry found by date; a month with no payment is refused rather than answered with zeros |
| 15 | The list and the report | PASS | Outstanding 597,791 at 2026-06-30, next payment 2026-07-15, 11 payments in 2026, interest 65,306 |
| 16 | A month-end drawdown | PASS | 2026-01-31 pays 2026-02-28, 2026-03-31, 2026-04-30; never rolls into the next month |
| 17 | A term of zero periods | PASS | Refused in the engine and at the tool, and no register file is written |
| 18 | A negative or fractional principal | PASS | Refused by name; the data directory holds no `loans.json` at all afterwards |
| 19 | A rate over 100 percent | PASS | 12,000 bps is charged as 10 percent a month and an effective 213.84 percent a year; 1,000,001 bps is refused as a typo |
| 20 | A balloon or a fee equal to the principal | PASS | Both refused, the balloon one saying it amortises nothing |
| 21 | Repaying after the end | PASS | Period 13 of a 12 period loan refused by name; period 12 answers with nothing owed and nothing saved |
| 22 | Dates and months that are not | PASS | 2026-02-30, "yesterday", "15-01-2026" and "" all refused; so is month 2026-13 |
| 23 | A journal asked for both a period and a month, or neither | PASS | Refused: a journal over both would post the same payment twice |
| 24 | A corrupt register | PASS | Every tool refuses, the bytes are quarantined verbatim, and an unreadable store is never read as an empty one |
| 25 | The free cap | PASS | Three loans, the fourth refused with the price, and six schedule calls on the three, never metered |
| 26 | Pro gates | PASS | `loan_repay_early`, `loan_journal` and `loans_report` refused on free, each link tagged `src=amortization.<tool>` |
| 27 | Pro key for another product | PASS | A key signed for `deposits` unlocks nothing here |
| 28 | An ambiguous name | PASS | Two loans named "Van finance A" and "B" refuse the partial "Van finance" with both candidates |
| 29 | 720 schedules | PASS | 6 rates x 5 terms x 2 methods x 3 balloons x 4 frequencies: every one closes exactly on its balloon, no negative interest |
| 30 | Early settlement at every period | PASS | interest paid + interest saved equals the schedule's total interest, for all 12 |
| 31 | The rate arithmetic on the edges | PASS | Zero rates, the same-clock shortcut, and the twelfth root of an annual 12 percent |
| 32 | Twenty loans, two processes | PASS | 20 rows, 20 distinct ids, no lost write |
| 33 | Two processes racing the third free loan | PASS | Exactly 3 stored, 5 refused, the check and the write one critical section |
| 34 | Version identity | PASS | package.json, generated `src/version.ts`, `serverInfo` and all four manifests carry 0.15.0; `sync-versions --check` passes repo-wide |
| 35 | Manifest remotes rule | PASS | `server.mcpb.json` remotes deep-equal `remotes.json` (`/mcp/amortization`) with `fileSha256` "TBD"; `server.json`, `server.variant.json` and `server.lease.json` carry none, and the three registry names differ |
| 36 | stdout | PASS | Every line across initialize, tools/list, a success and an error parses as JSON-RPC 2.0 |
| 37 | Tool surface | PASS | 8 tools by name, every description non-empty, trimmed, no emoji, no em dash, all within 220 characters |
| 38 | No tool takes a file path | PASS | Nothing here writes outside its own data directory |
| 39 | Two files and no others | PASS | After all six tools: `loans.json` and `counter.json`, and `mcp-servers/` holds only `amortization` |
| 40 | No schedule is stored | PASS | The raw store file holds no `opening_minor`, `closing_minor` or `rows`, and the record's keys are the terms |
| 41 | The account ids | PASS | `cash-book/src/ledger.ts` still declares `CASH = "cash"`, and this server's three ids follow its convention |

## Final test summary

    npm run build (repo-wide)                  tsc clean, no output
    npm test -w servers/amortization           # tests 41 / # pass 41 / # fail 0
    node --test test/*.test.mjs (repo-wide)    # tests 83 / # pass 83 / # fail 0
    npm test -w servers/invoice                # tests 51 / # pass 50 / # fail 0
    npm test -w packages/mcp-license           # tests 32 / # pass 32 / # fail 0 (with SERVER_COUNT 26, uncommitted)
    node scripts/sync-versions.mjs --check     0 file(s) written
    node scripts/gen-spec.mjs amortization     tools=8 resources=1 prompts=1 failure_modes=18

## RESULT.md block

    status: DONE
    evidence:
    - npm run build -w servers/amortization: tsc clean
    - npm test -w servers/amortization: # tests 41 / # pass 41 / # fail 0
    - node --test test/*.test.mjs: # tests 83 / # pass 83 / # fail 0
    - node scripts/sync-versions.mjs --check: 0 file(s) written
    - Worked annuity to the minor unit: payment 88,849, total interest 66,188, closing 0
    - Effective annual rate of a nominal 12 percent compounded monthly: 1268 bps
    - Straight principal 65,000 of interest; balloon 400,000 closes exactly on 400,000
    - 720-schedule sweep: every one closes on its balloon, no negative interest charge
    artifacts:
    - /Users/mike/mcp-servers/servers/amortization
    - /Users/mike/mcp-servers/docs/AMORTIZATION_RESULT.md
    cost: 55 wall minutes
    failures:
    - The residual rule absorbed the rounding difference into the final interest split
      unconditionally, which on a long schedule reported a huge or a negative interest
      charge on a balance that had already cleared. Bounded to the drift a term can
      accumulate; wider than that, the payment gives way instead
    - keep_payment on a partial overpayment re-derived the payment it was meant to hold;
      fixed with an explicit level_payment_minor used only when the payment is fixed
    insight:
    - Rounding the level payment once is a term change, not a rounding detail

## The measured insight

At 250 basis points over 360 annual periods on 1,000,000 minor units, the level payment
rounds to 25,292. That rounding is worth a fraction of a minor unit, and it repeats 356
times: **the balance clears at period 356, four periods before the term ends, with a final
payment of 4,165.** The schedule stops there and says so.

The reason this matters is what the alternative looks like. A schedule that keeps
subtracting to fill out the declared term does not fail: it reports four more periods, each
with a payment of 25,292 on a balance that has gone negative, each charging negative
interest, and the totals still reconcile against themselves. The chain arithmetic is
self-consistent all the way down; the only thing wrong with it is that the borrower does not
owe the last four rows. That is the case the 720-schedule sweep was written for, and it is
the case the first version of this engine got wrong.

Built by theluckystrike. https://github.com/theluckystrike
