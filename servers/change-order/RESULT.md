status: DONE

evidence:
- npm run build --workspace @theluckystrike/mcp-change-order: tsc clean, no output
- npm test --workspace @theluckystrike/mcp-change-order: # tests 47 / # pass 47 / # fail 0
  (unit 12, adversarial 17, concurrency 4, contract 14)
- node scripts/gen-spec.mjs change-order: tools=11 resources=1 prompts=1 failure_modes=13, twice, no diff
- node --test servers/invoice/test/profile-readers.test.mjs: 1/1 after "change-order" was
  added to PROFILE_READERS
- worked change order against Q-2026-0003, EUR, original 2,000,000 minor, VAT 23%:
  L01 added 2 x 45000 = +90,000; L02 removed 12 x 3999 = -47,988; L03 changed was
  3 x 45000, now 5 x 42000 = +75,000. delta net 117,012, VAT 26,913 (per item: 20700,
  -11037, -31050, 48300), delta gross 143,925, rounding_drift_minor 0. Running value once
  approved 2,117,012; while draft or sent the current value stays 2,000,000 and the
  117,012 is reported as pending
- computeTotals re-run in the test process over the payload's OWN invoice_create items
  returns the same four item values (90,000, -47,988, -135,000, 210,000) and the same
  three totals
- the 100x measurement: the same items with quote_create's unit_price_minor fed into the
  invoice engine's unit_price net 11,701,200 minor against the correct 117,012, asserted
  as exactly 100x, both re-derived from each payload's own items
- grep -rEn "fetch\(|https?://|node:http|node:net|node:dns|console\." servers/change-order/src
  returns only the checkout host in the licensing copy; the contract suite asserts it

artifacts:
- /Users/mike/mcp-servers/servers/change-order (src, test, SPEC.md, README.md, manifests)
- /Users/mike/mcp-servers/docs/CHANGE_ORDER_RESULT.md

cost: see docs/CHANGE_ORDER_RESULT.md

failures:
- The signed-money helper first printed a negative delta as "EUR -479.88" beside a
  positive "+EUR 900.00", so the two did not read as a pair on the document. It now puts
  the sign in front of the code for both. Caught on the first smoke run, before the tests.
- The concurrency race on the sixth open change order seeds one order first (the reference
  needs its original value stated once), so the race is over four slots, not five; the
  assertion counts accepted plus the seed.

insight:
- A changed line is two items, not one, because one net item shows the customer nothing
  they can check. 3 x 450.00 becoming 5 x 420.00 is +750.00, and an item of quantity 1
  at 750.00 reproduces from nothing on the change order the client signed; -3 x 450.00
  and 5 x 420.00 both reproduce on a calculator and sum to the same +750.00 because the
  invoice server's roundHalfUp is symmetric in sign. That same symmetry is what lets a
  removal ride as a negative quantity through invoice_create, and it is what quote_create
  refuses (quantity must be greater than zero), so the quote payload carries a ready flag
  instead of a promise. Both scales are emitted in one call, as in catalogue, and the unit
  suite asserts the 100x quotient by re-deriving the net from each payload's own items.
