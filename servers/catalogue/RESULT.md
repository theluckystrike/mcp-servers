status: DONE

evidence:
- npm run build --workspace @theluckystrike/mcp-catalogue: tsc clean, no output
- npm test --workspace @theluckystrike/mcp-catalogue: # tests 42 / # pass 42 / # fail 0
  (unit 12, adversarial 13, concurrency 4, contract 13)
- node scripts/gen-spec.mjs catalogue: tools=12 resources=1 prompts=1 failure_modes=12
- node --test servers/invoice/test/profile-readers.test.mjs: 1/1 after "catalogue" was
  added to PROFILE_READERS
- worked ladder: WEB-AUDIT rows 39000 from 2025-01-01, 45000 from 2026-01-01, 49500 from
  2026-07-01. sku_get on 2025-06-30 -> 39000 (row 2025-01-01); on 2026-03-15 -> 45000
  (row 2026-01-01, superseded_by 2026-07-01); on 2026-09-01 -> 49500 (row 2026-07-01)
- worked resolution, EUR, 2026-03-15, VAT 23%: WEB-AUDIT 3 x 45000 = 135,000;
  HOST-MO 12 x 3999 = 47,988; senior developer 7.5 h x 8500 = 63,750; junior developer
  3.25 h x 4500 = 14,625. net 261,363, VAT 60,114, gross 321,477, rounding_drift_minor 0.
  computeTotals re-run in the test process over the payload's OWN items returns the same
  four line grosses and the same three totals
- the 100x measurement: the same items with quote_create's unit_price_minor fed into the
  invoice engine's unit_price net 26,136,300 minor against the correct 261,363, asserted
  as exactly 100x
- grep -rEn "fetch\(|https?://|node:http|node:net|node:dns|console\." servers/catalogue/src
  returns only the checkout host in the licensing copy; the contract suite asserts it

artifacts:
- /Users/mike/mcp-servers/servers/catalogue (src, test, SPEC.md, README.md, manifests)
- /Users/mike/mcp-servers/docs/CATALOGUE_RESULT.md

cost: 52 wall minutes

failures:
- The first contract run reported a sibling store: `mcp-servers/invoice/` appeared in the
  sandbox although this server writes nothing there. Cause: `getBusiness()` /
  `hasBusiness()` from @theluckystrike/mcp-invoice/lib call that server's `dataDir()`,
  which mkdirs as a side effect of a READ. Fixed by building the issuer block from
  `readSharedProfile()` instead; the invoice lib is now imported for arithmetic only.
- The first PDF assertion expected EUR 505.99 for one of each of three lines. The correct
  figure is 45000 + 3999 + 12000 = EUR 609.99. Arithmetic error in the test, not the
  server; corrected.

insight:
- The two sibling servers this catalogue exists to feed take the same number in different
  scales, and nothing in either tool can detect the swap. invoice_create's `unit_price` is
  in MAJOR units and quote_create's `unit_price_minor` is in MINOR units; both are plain
  numbers, both are called the unit price, and 45000 passed to invoice_create is a valid
  line for EUR 45,000.00. Measured on the worked resolution the gap is exactly 100x
  (261,363 against 26,136,300 minor), and 1000x in a 3-decimal currency. That single fact
  decided the whole design: minor units in the store because it is the only lossless form,
  and lines_resolve emitting BOTH payloads itself, in one call, with the scale printed
  against each, rather than returning one price for the caller to reshape. A catalogue
  that returned "the price" and let the model pick the field would be wrong 50 percent of
  the time and wrong by two orders of magnitude when it was.
