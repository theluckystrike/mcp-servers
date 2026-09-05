status: DONE
evidence:
- npm run build -w servers/amortization: tsc clean, no output
- npm test -w servers/amortization: # tests 41 / # pass 41 / # fail 0
- node scripts/sync-versions.mjs --check: 0 file(s) written
- node scripts/gen-spec.mjs amortization: tools=8 resources=1 prompts=1 failure_modes=18
- Worked annuity asserted to the minor unit: 1,000,000 minor at 1200 bps nominal,
  compounded and paid monthly, 12 periods, annuity: payment 88,849, total interest 66,188,
  closing balance 0, final period 87,967 principal against 882 interest
- Effective annual rate of a nominal 12 percent compounded monthly: 1268 bps, "12.68"
- Straight principal on the same terms: 65,000 of interest, first payment 93,333, last
  84,166, principal legs sum to 1,000,000
- Balloon of 400,000: payment 57,309, closing balance exactly 400,000, interest 87,708
- Sweep of 720 schedules (6 rates x 5 terms x 2 methods x 3 balloons x 4 frequencies):
  every one closes exactly on its balloon, no negative interest charge
artifacts:
- /Users/mike/mcp-servers/servers/amortization
- /Users/mike/mcp-servers/docs/AMORTIZATION_RESULT.md
cost: 55 wall minutes
failures:
- The first residual rule absorbed the difference into the final period's interest split
  unconditionally. On a 360-period schedule the balance clears before the term ends, and
  the rule then reported a negative interest charge on a negative balance. Fixed by
  bounding the absorption to the drift a term can actually accumulate, about one minor
  unit a period: wider than that is a short final period, and then the payment gives way
  instead of the split. The 720-schedule sweep is the regression test.
- keep_payment on a partial overpayment first re-derived a level payment for the shortened
  term, so the payment it was meant to hold moved. Fixed with an explicit
  level_payment_minor on the terms, used only when the payment is the fixed quantity.
insight:
- Rounding the level payment once is not a rounding detail, it is a term change. At 250
  basis points over 360 annual periods the payment rounds to 25,292 minor units and that
  same half-unit repeats: the balance clears at period 356, four periods before the term
  ends, with a final payment of 4,165. A schedule that keeps subtracting to fill the term
  reports four periods the borrower does not owe, on a balance that has gone negative,
  charging negative interest that still sums to a total that looks right.
