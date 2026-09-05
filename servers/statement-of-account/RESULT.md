status: DONE
evidence:
- npm run build (repo-wide): tsc clean, no output
- npm test -w servers/statement-of-account: # tests 47 / # pass 47 / # fail 0
- npm test -w servers/invoice: # tests 49 / # pass 48 / # fail 0
- npm test (repo-wide): exit code 0
- node scripts/sync-versions.mjs --check: 0 file(s) written
- node scripts/gen-spec.mjs statement-of-account: tools=8 resources=1 prompts=1 failure_modes=9
- no network and no stdout write in src, asserted in contract.test.mjs
- the worked month closes at 2,300.00 EUR, recomputed by hand from four invoices, two
  credit notes and one deposit application in test/_client.mjs
- no sibling store file changes bytes or mtime across all six tools, asserted in
  contract.test.mjs
artifacts:
- /Users/mike/mcp-servers/servers/statement-of-account/
- /Users/mike/mcp-servers/docs/STATEMENT_RESULT.md
cost: 50 wall minutes
failures:
- The first design counted a deposit application as a fourth credit column beside payments
  received. It is not: deposit_apply raises the invoice's paid_minor, so the money was
  already in payments received and the closing balance paid every deposited invoice twice.
  Payments received now INCLUDE the applications and of_which_deposits_applied is a
  breakdown of that figure, not a sibling of it
- Four unit assertions were written against "2300.00 EUR" and the shared formatMoney emits
  "EUR 2300.00". The tests were wrong, not the formatter
- A bucket-boundary test asserted 1 day and 30 days into different buckets. 30 days is the
  last day of the 0-30 bucket; the due dates were moved to sit exactly on 0, 30, 31, 61 and
  91 days so each boundary is pinned by a row
- An aging test expected 2,000.00 outstanding at 2026-06-10 and got 2,500.00, because the
  test author forgot that a payment dated 2026-06-12 has not happened on 2026-06-10. The
  code was right; that oversight became the README's measured insight
- The contract suite's grep for network calls in src threw instead of passing, because grep
  exits 1 when it finds nothing, which is the passing case
insight:
- Aging a past date with today's payment figures does not go slightly wrong, it goes
  silently empty. Measured on the worked month at 2026-06-10: the as-at rule reports
  2,500.00 outstanding of which 500.00 is 31 days late; the ordinary "subtract paid_minor,
  bucket by due date" rule reports 1,700.00 outstanding and ZERO overdue, because a payment
  that arrived two days after the aging date has already been subtracted. A third of the
  balance and all of the overdue disappear, the buckets still add up, and the answer cannot
  be reproduced next month because the input keeps moving. The dated subtraction is the
  part nobody writes a test for, and it is the only part that decides who gets chased
