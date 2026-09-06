status: DONE
evidence:
- npm run build (repo-wide): tsc clean, no output
- npm test -w servers/petty-cash: # tests 41 / # pass 41 / # fail 0
- node --test test/*.test.mjs (repo-wide): # tests 86 / # pass 86 / # fail 0
- node scripts/sync-versions.mjs --check: 0 file(s) written
- node scripts/gen-spec.mjs petty-cash: tools=9 resources=1 prompts=1 failure_modes=11, run twice, no diff
- Worked month to the minor unit: expected 29,806, counted 29,795, difference -11
- Replenishment 20,205 against a voucher total of 20,194: the 11 is a cash_over_short line
- Categories: expenses:office 13,399, expenses:postage 1,250, expenses:travel 5,545
- Three cycles reimbursed at the voucher total: the float ends 33 minor units light
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
- The replenishment cheque is imprest minus balance, never the sum of the vouchers, and
  the gap is exactly what the counts found short
