status: DONE
evidence:
- npm run build -w servers/deposits: tsc clean, 1.1 s, no output
- npm test -w servers/deposits: # tests 31 / # pass 31 / # fail 0 / # skipped 0, 2.9 s
- node scripts/gen-spec.mjs deposits: servers/deposits/SPEC.md tools=10 resources=1 prompts=1
- node scripts/sync-versions.mjs --check: passes for the whole repo (asserted in contract.test.mjs)
- grep -rEn "fetch|https?://|node:http|node:net|node:dns" servers/deposits/src/ : the checkout
  URL in the licence gate's upgrade text only. Zero network, zero paid API calls
- 200 deposits, one client, Pro: deposit_record 0.8 ms each, deposit_balance 1 ms,
  deposits_report 1 ms, deposit_statement_text 1 ms (14,975 chars), deposit_statement_pdf 37 ms
  (19,034-byte multi-page A4), store 76,602 bytes
- two processes, one data dir, 40 concurrent deposit_record: 40 rows, 40 unique ids,
  counter.json {"DEP-2026": 40}
- two processes, ten concurrent EUR 200.00 applications against a EUR 500.00 deposit:
  exactly 2 land, applied EUR 400.00, invoice paid_minor 40000
artifacts:
- /Users/mike/mcp-servers/servers/deposits
- /Users/mike/mcp-servers/docs/DEPOSITS_RESULT.md
- /Users/mike/mcp-servers/scripts/gen-spec.mjs (CURATED + SERVERS entry for deposits)
cost: 48 wall minutes
failures:
- None during the build. The one thing that had to be read before it could be written: the
  invoice engine exports no recordPayment or payment-add function (servers/invoice/src/lib.ts),
  so the payment is written through getInvoices/setInvoices exactly as invoice_mark_paid does.
  Measured first: invoice_mark_paid SETS paid_minor, it does not add, so calling it for a
  deposit would erase an earlier part payment. deposit_apply adds.
insight:
- The invoice server's own payment tool overwrites. Measured on a EUR 1,000.00 invoice through
  servers/invoice/dist/index.js: invoice_mark_paid {amount: 200} then {amount: 300} leaves
  paid_minor at 30000 and reports "balance due EUR 700.00". The EUR 200.00 bank transfer is
  gone from the record. A deposit server that reused that tool, or copied its assignment, would
  silently delete real payments and chase clients for money already received. deposit_apply
  writes the same three fields on the same record and ADDS: the same two payments leave
  paid_minor at 50000 and EUR 500.00 due. Field names matching between two servers is not the
  contract; the arithmetic on them is.
