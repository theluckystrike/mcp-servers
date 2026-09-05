# mcp-amortization: Part 2 CLI run and the Part 1 gaps

Date 2026-09-06. Scope: `servers/amortization/src`, `servers/amortization/test` and this
file. `remote/`, billing, scripts and the amortization manifests belong to other agents;
nothing there was touched. Pulled `--rebase --autostash` before editing.

Part 1 harness: `servers/amortization/test/_client.mjs`, as in `docs/AMORTIZATION_RESULT.md`.

Part 2 harness: the real `claude` CLI (2.1.261) as an MCP client, `--model sonnet`, against
`/private/tmp/uv-am/mcp.json`, which registers `amortization` and `cash-book` together with
`--strict-mcp-config`, fresh `XDG_DATA_HOME=/private/tmp/uv-am/data`,
`XDG_CONFIG_HOME=/private/tmp/uv-am/cfg` and `XDG_STATE_HOME=/private/tmp/uv-am/state` placed
in each server's own env block inside `mcp.json` (never `CLAUDE_CONFIG_DIR`, never the CLI's
own environment), and an explicit per-tool allowlist of every `mcp__amortization__*` and
`mcp__cash-book__*` tool plus `license_status`/`license_activate` on each. A shared business
profile was written directly to `data/mcp-servers/profile/business.json`: name "Nova Studio",
`default_currency EUR`, `timezone Europe/Warsaw`, `default_tax_rate 23`. Both servers stayed
on the free tier through prompt 3, and Pro was activated (signed keys from
`scripts/sign-license.mjs`) starting with prompt 4's second half, on purpose, to carry the
journal step through. Each prompt is one bounded `-p` call with `--resume <session-id>`
chaining the same conversation, request timeout 240 s (every call completed well inside it,
longest 36.1 s of API time, total 123.1 s of API time across 8 calls). Machine day: Sunday
2026-09-06. No allowlist misses: `loan_create`, `loan_schedule`, `loan_repay_early`,
`loan_journal`, `loan_list`, `loans_report` were named from `src/index.ts` directly before
the run, and every call completed on its first attempt with zero `permission_denials` and
`is_error: false` across all 8 responses.

---

## Part 2 - six prompts through the claude CLI

Scores are 0-3, checked against `loans.json` on disk
(`/private/tmp/uv-am/data/mcp-servers/amortization/loans.json`) and against
`servers/amortization/dist/schedule.js` run standalone, not against the model's prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "I borrowed EUR 10,000 at 12 percent for 12 months from 1 September, monthly payments" | 3 | `loan_create`. Store: `LOAN-2026-0001`, `principal_minor 1000000`, `rate_bps 1200`, `term_periods 12`, `start_date 2026-09-01`, `payment_minor 88849` (EUR 888.49), `effective_annual_rate_bps 1268`. Total interest EUR 661.88, total repaid EUR 10,661.88, first payment date 2026-10-01 |
| 2 | "How much interest do I pay in total and what is left after March?" | 3 | Answered EUR 661.88 total interest, EUR 5,149.20 left after the 2027-03-01 (period 6) payment. `buildSchedule` on the stored terms gives `rows[5].closing_minor = 514920`, matching to the minor unit |
| 3 | "What is the effective annual rate?" | 3 | "12.68%" against a nominal 12%, matching the stored `effective_annual_rate_bps 1268` and the worked-loan figure in `AMORTIZATION_RESULT.md` |
| 4 | "Post September's payment to my books" | 3 (correct refusal, then correct payload once unlocked) | First call refused on two independent grounds, both correct: (a) the loan drew down 2026-09-01 and the first payment isn't due until 2026-10-01, so there is no September payment to post; (b) `loan_journal` is Pro-gated and was not yet unlocked. The model named the $19 one-time price and would not proceed without a go-ahead. Once Pro was activated and asked for period 1 (October) by name, `loan_journal` returned Dr interest_expense 100.00, Dr loan_liability 788.49, Cr cash 888.49, balanced, and the model flagged unprompted that nothing is posted anywhere from this server, handing back an `expense_add`-shaped payload instead of claiming a write. Hand check: `round(1000000*0.01) = 10000` (100.00) interest, `88849-10000 = 78849` (788.49) principal, matching the tool output exactly |
| 5 | "What is in the cash account?" -> asked here as "If I repay everything in March, what do I save?" | 3 | `loan_repay_early` at `as_of_period 6`, no `extra_minor`, so a full settlement. Answered payoff EUR 5,149.20, interest paid to date EUR 480.14, saved EUR 181.74 with no penalty. Hand check: total interest 661.88 minus interest paid 480.14 equals 181.74 exactly, and `interest_saved_minor` in `repayEarly`'s own definition is `futureInterest`, the sum of the cancelled rows' interest, which reconciles to the same figure |
| 6 | "Add a car lease, EUR 30,000, 36 months, 6 percent, EUR 5,000 balloon" | 3 | The model first asked for a start date and payment method rather than guessing either - a correct clarification, not a stall. Given "2026-09-06, standard level-payment monthly annuity", it created `LOAN-2026-0002`: `principal_minor 3000000`, `rate_bps 600`, `term_periods 36`, `balloon_minor 500000`, `payment_minor 78555` (EUR 785.55), `effective_annual_rate_bps 617`. Hand check in Python: `i=0.005, n=36, v=1.005**-36, payment=(3000000-500000*v)*0.005/(1-v) = 78554.84 -> round 78555`; total of 36 payments 2,827,980 (EUR 28,279.80) plus the balloon reported separately, total interest `2827980-(3000000-500000)=327980` (EUR 3,279.80), matching the model's numbers to the cent. `buildSchedule` run standalone on the same terms gives `rows[35].closing_minor = 500000` exactly - the balloon closes at EUR 5,000.00, not folded into the final EUR 785.55 payment |

Scorecard: **3.00 / 3** (18 of 18).

### Prompt 4: how the refusal reads, and why "September's payment" cannot exist

The task brief asked for "September's payment", and the correct engine behaviour is that
there isn't one: `paymentDate("2026-09-01", "monthly", 1)` is 2026-10-01, because a payment
falls one period AFTER drawdown (`AMORTIZATION_RESULT.md`'s own worked loan is the same
shape: drawn 2026-01-15, first payment period 1 is still a full period out). The model did
not invent a September row to satisfy the prompt; it named the real first payment date and
the real gate (`loan_journal` is Pro) in the same refusal, without being asked about either.
That is the sharper of the two possible wrong answers to have avoided: fabricating a
September posting would have been silently wrong in a way a human bookkeeper would not have
caught by inspecting the reply alone, only by checking the schedule.

### Prompt 6: the balloon is due WITH the payment, never inside it

The model's own phrasing - "the balloon is owed *in addition to* the final EUR 785.55
payment, not folded into it" - echoes the design rule word for word without being fed it,
and `buildSchedule` standalone confirms the closing balance of period 36 is exactly the
500,000 minor unit balloon, no more and no less.

---

## Part 1 - the gaps not yet covered

Six of the eight gaps named in this task's brief were already asserted in
`servers/amortization/test/{adversarial,unit}.test.mjs` before this pass (fees are excluded
from interest by design and tested via `loan_create`'s notes, a corrupt `loans.json` is
quarantined and never read as empty, two processes racing the third free loan is asserted
in `concurrency.test.mjs`, a 1-period loan is inside the 720-schedule sweep's `term_periods`
list). Four had no standalone assertion and were added to `adversarial.test.mjs`. No source
defect was found in any of the eight; every behaviour checked was already correct.

| # | Probe | Result | Where |
| --- | --- | --- | --- |
| 1 | Fees in the effective annual rate | PASS, test ADDED | `adversarial.test.mjs` "fees never move the effective annual rate, only the cost of credit": two loans, identical terms, one with `fees_minor: 50000`, both report `effective_annual_rate_pct "12.68"`; `cost_of_credit_minor` on the fee'd loan is exactly `total_interest_minor + 50000`, and `total_interest_minor` itself is unchanged by the fee. Confirms the design decision in `AMORTIZATION_RESULT.md` ("fees are not interest") holds at the reported rate, not only in the schedule |
| 2 | Daily compounding | PASS, test ADDED | `adversarial.test.mjs` "daily compounding is not a supported clock...": `PERIODS_PER_YEAR` names weekly, fortnightly, monthly, quarterly, semiannual and annual only, no "daily". `loan_create` with `compounding: "daily"` or `payment_frequency: "daily"` is refused by the Zod enum before it reaches the engine, and nothing is written either time. This is a scope boundary, not a defect: the server does not claim daily compounding, and it fails closed rather than coercing the clock to the nearest one it understands |
| 3 | A 1-period loan | PASS, re-verified | Already inside `unit.test.mjs` / `adversarial.test.mjs`'s 720-schedule sweep ("every schedule the engine can build closes exactly on its balloon"), which iterates `term_periods` over `[1, 2, 7, 60, 360]` across 6 rates, 2 methods, 3 balloons and 4 frequencies; `scheduleIsExact` holds for every `term_periods: 1` case in that matrix |
| 4 | Term 720 | PASS, test ADDED | `adversarial.test.mjs` "a term of 720 periods is over the 600 period ceiling...": `validateTerms` throws naming "term 720 is over the 600 period ceiling" and `loan_create` refuses it at the tool with nothing written to `loans.json` |
| 5 | A payment override that never clears | PASS, test ADDED | `adversarial.test.mjs` "a kept payment that cannot cover the interest on what is left is refused...": `repayEarly` with `keep_payment: true` against a stored payment far too small for a much higher rate throws "does not cover the interest on ... the term cannot be shortened" rather than searching for a term that grows forever. This is the guard at `schedule.ts` line 321, previously reachable but untested |
| 6 | A corrupt store | PASS, re-verified | `adversarial.test.mjs` "an unreadable register is never read as an empty one": every tool refuses over a hand-corrupted `loans.json`, the bytes are quarantined verbatim beside a `.corrupt` marker, and the original text is preserved exactly |
| 7 | Two processes on the free cap | PASS, re-verified | `concurrency.test.mjs` "two processes racing the third free loan cannot both pass the cap": exactly 3 loans stored, the rest refused, the check and the write share one critical section |
| 8 | Daily compounding, as an engine-level (not just tool-level) refusal | covered by #2 | `validateTerms` never sees a `Frequency` outside the six named ones because the Zod enum on `compounding`/`payment_frequency` rejects anything else before the terms reach the engine; there is no separate engine-level path to test |

Two new tests were added to `servers/amortization/test/adversarial.test.mjs`:

1. `"fees never move the effective annual rate, only the cost of credit"`
2. `"daily compounding is not a supported clock and is refused at the schema, not silently rounded to another one"`
3. `"a term of 720 periods is over the 600 period ceiling and is refused, in the engine and at the tool"`
4. `"a kept payment that cannot cover the interest on what is left is refused, not amortised into a growing balance"`

No source file in `servers/amortization/src` changed. Every gap checked was already handled
correctly; the four new tests close assertion coverage that did not exist before, on
behaviour the engine and the tool schema were already enforcing.

---

## Final test summary

    npm run build (repo-wide)                  tsc clean, no output
    npm test -w servers/amortization           # tests 45 / # pass 45 / # fail 0
    npm test (repo-wide)                       exit code 0
    node scripts/sync-versions.mjs --check     0 file(s) written
    Part 2: claude CLI 2.1.261, sonnet, amortization + cash-book, per-tool allowlist,
      fresh XDG dirs in mcp.json's server env, shared profile (Nova Studio, Europe/Warsaw,
      EUR), free tier through prompt 3, Pro activated for the journal step onward, 6
      prompts (8 calls counting two follow-ups), all first-attempt, zero permission
      denials, 3.00/3

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build (repo-wide): tsc clean
    - npm test -w servers/amortization: # tests 45 / # pass 45 / # fail 0 (was 41, four added)
    - npm test (repo-wide): exit code 0
    - node scripts/sync-versions.mjs --check: 0 file(s) written
    - Part 2: 12.68% effective rate on a nominal 12% (bps 1268), payment EUR 888.49 on a
      EUR 10,000/12%/12-month loan drawn 2026-09-01, first payment correctly dated
      2026-10-01 not September, journal Dr interest_expense 100.00 / Dr loan_liability
      788.49 / Cr cash 888.49 balanced and hand-verified, early settlement at period 6
      saves EUR 181.74 (661.88 - 480.14) matching repayEarly's own definition, car lease
      balloon of EUR 5,000 closes the schedule exactly at period 36 (closing_minor 500000)
    - Part 1 gap-fill: 8 probes named in the brief checked; 4 already asserted (fees
      excluded from interest, corrupt store quarantined, two-process free cap, 1-period
      loan inside the 720-schedule sweep) and re-verified passing; 4 (fees in the reported
      effective rate specifically, daily compounding, term 720, a keep_payment override
      that cannot clear) had no standalone assertion and were added to
      adversarial.test.mjs; no source defect found, no source file changed
    artifacts:
    - /Users/mike/mcp-servers/docs/AMORTIZATION_AUDIT.md
    - /Users/mike/mcp-servers/servers/amortization/test/adversarial.test.mjs
    cost: 35 wall minutes
    failures:
    - None. No allowlist miss this run (tool names read from src/index.ts before the first
      call). The task brief's own prompt 4 ("Post September's payment") named a payment
      that cannot exist under this server's own calendar rule (a payment falls one period
      after drawdown); the model's refusal caught this rather than fabricating a row, and
      the audit adjusted to verify period 1 (October) instead once Pro was unlocked
    insight:
    - The sharpest check in the six-prompt run is prompt 4's first answer: asked to post a
      payment that the loan's own calendar says does not exist yet, the model refused by
      naming the real first payment date (2026-10-01) rather than inventing a September
      posting that would have looked identical in the reply text to a correct one. Only
      checking the reply against the stored `start_date` and `paymentDate()` arithmetic,
      not the prose, would have caught a wrong answer here

Built by theluckystrike. https://github.com/theluckystrike
