status: DONE
evidence:
- npm run build (repo-wide): tsc clean, no output
- npm test -w servers/cash-book: # tests 41 / # pass 41 / # fail 0
- npm test (repo-wide): exit code 0
- node scripts/sync-versions.mjs --check: 0 file(s) written
- node scripts/gen-spec.mjs cash-book: tools=8 resources=1 prompts=1 failure_modes=3
- no network and no stdout write in src, asserted in contract.test.mjs
- the worked month posts 1,638,300 minor units of debits against 1,638,300 of credits,
  recomputed by hand from two invoices, one credit note, one deposit with an application,
  two expenses, five bank rows and two fixed assets
- no sibling store file changes bytes or mtime across all six tools
artifacts:
- /Users/mike/mcp-servers/servers/cash-book/
- /Users/mike/mcp-servers/docs/CASH_BOOK_RESULT.md
cost: 55 wall minutes
failures:
- The first cut posted the bank import to cash alongside the payments and expenses derived
  from the documents. On the worked month that doubled 99.6 percent of the cash movement
  and the trial balance still came to zero, because every duplicated receipt carried its
  own contra. The bank import now posts nothing and is matched as evidence
- A month_close description was 223 characters, three over the 220 ceiling the contract
  suite ratchets. The entries-that-do-not-balance clause came out of it
- An adversarial assertion expected `revenue` to be absent when the invoice ledger is
  unreadable. It is not: a credit note still debits revenue, and the assertion was wrong,
  not the posting
insight:
- Four of the five bank rows in the worked month are the same money as a document already
  posted: 1,375,300 of 1,380,300 minor units of cash movement, 99.6 percent. Posting the
  bank import as well, which is the obvious way to build a cash book, takes the cash
  balance from -10,543.00 to -21,111.00 EUR and the trial balance still comes to zero. The
  duplicate does not break the check that is supposed to catch it. What is left after
  matching is 7,500 minor units, one unexplained withdrawal, and that 0.4 percent is the
  entire reason to import a statement at all
