status: DONE
evidence:
- npm run build (repo-wide): tsc clean, no output
- npm test -w servers/work-order: # tests 43 / # pass 43 / # fail 0
- node --test test/*.test.mjs (repo-wide): # tests 89 / # pass 89 / # fail 0
- npm test -w servers/invoice (profile-readers): 1/1 pass with work-order added to PROFILE_READERS
- node scripts/sync-versions.mjs --check: 0 file(s) written
- node scripts/gen-spec.mjs work-order: tools=12 resources=1 prompts=1 failure_modes=14, twice, no diff
- Worked job: 4.75 h, labour 40,375, materials 19,458, parts cost 18,093, net 59,833, VAT 23% 13,762, gross 73,595
- The invoice payload's totals recomputed with servers/invoice computeTotals over the payload's OWN
  items: net 59,833, VAT 13,762, total 73,595, line grosses 29,750 / 10,625 / 10,458 / 9,000,
  rounding_drift_minor 0
- Markup basis: 7 x 1299 + 15% is 1494 a unit and 10,458 on the line; round(9093 x 1.15) is 10,457
artifacts:
- /Users/mike/mcp-servers/servers/work-order
- /Users/mike/mcp-servers/docs/WORK_ORDER_RESULT.md
cost: 58 wall minutes
failures:
- A status change dated before the requested date was refused with the requested-date message
  rather than the history message, so the "backwards in the history" case was never exercised.
  The test now uses a date inside the job's own life and asserts both refusals separately
- The no-stored-total contract test grepped for the substring "vat" and matched the client
  record's vat_id. The assertion is now on exact derived keys, not on substrings
insight:
- The markup goes on the unit cost, not on the line total. The invoice rounds the unit first,
  so the line-total basis quotes a figure the invoice cannot reproduce, one minor unit at a time

## Free vs Pro

Free: 5 OPEN work orders (draft, scheduled, in_progress), every record-keeping tool, and the
text completion report. Pro: unlimited work orders, the PDF completion report, the invoice
payload and the board report. Closing a job frees its slot, and deleting a draft with no
lines is free on every tier.

## What it holds no copy of

The money and VAT arithmetic (`computeTotals`, `currencyDecimals`, `formatMoney`,
`roundHalfUp`) is imported from `@theluckystrike/mcp-invoice/lib`, the client records from
the same package's `findClient`, the A4 page from `@theluckystrike/mcp-billing-docs/lib`
`renderDocPdf`, the corrupt-store quarantine from `@theluckystrike/mcp-timezone/lib`, the
timezone-aware "today" from `@theluckystrike/mcp-quotes/lib`, and the licensing and locking
from `@theluckystrike/mcp-license`. It exports its own `./lib`: the record types, the status
machine and the money basis.

Built by theluckystrike. https://github.com/theluckystrike
