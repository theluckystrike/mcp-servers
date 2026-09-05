status: DONE
evidence:
- npm run build -w servers/asset-register: tsc clean, no output
- npm test -w servers/asset-register: # tests 45 / # pass 45 / # fail 0 / # skipped 0
  (unit 16, adversarial 14, corrupt 2, concurrency 3, contract 10)
- node scripts/sync-versions.mjs --check: 0 file(s) written
- node scripts/gen-spec.mjs asset-register: SPEC.md tools=8 resources=1 prompts=1 failure_modes=18
- grep -rEn "fetch\(|https?://|node:http|node:net|node:dns|console\." servers/asset-register/src:
  only source_url fields inside the bundled JSON tables. Asserted in contract.test.mjs
- US MACRS 5-year, cost 10,000.00: 2000.00 / 3200.00 / 1920.00 / 1152.00 / 1152.00 / 576.00,
  identical to IRS Pub 946 Table A-1
- PL KST 487 at 30 percent, cost 8,499.00, in service 2026-03-15: first charge 2026-04,
  periods 1912.28 / 2549.70 / 2549.70 / 1487.32, summing to 8499.00 exactly
- PL KST 742 declining at 20 percent times 2, cost 10,000.00: 4000.00 / 2400.00 / 2000.00 /
  1600.00, the third year switching to straight line under art. 16k
artifacts:
- /Users/mike/mcp-servers/servers/asset-register/
- /Users/mike/mcp-servers/docs/ASSET_REGISTER_RESULT.md
cost: 52 wall minutes
failures:
- The first `life_years` override test asserted four equal periods and got five. The code was
  right and the test was wrong: an asset in service in January starts charging in February
  under the Polish month-following rule, so year one is eleven twelfths and the missing month
  falls out at the far end. Test corrected, and the proration is now the thing it asserts.
- `asset_schedule`'s description came out at 235 characters, over the 220 ceiling the contract
  suite enforces. Rewritten to 218. No baseline entry was added: the ratchet stays empty.
- Running `gen-spec.mjs` without arguments regenerated SPEC.md for all 19 servers, most of
  which were stale in git for unrelated reasons. Reverted with git checkout; only
  servers/asset-register/SPEC.md is new.
insight:
- The yearly schedule is where rounding errors are looked for and the monthly journal is
  where they are. Of the 67 schedules these three tables can produce for one test asset
  (12,345.67 cost, 45.67 residual), the yearly rows survive almost any rounding rule, but
  splitting those same years into months with a per-month `Math.round` leaves 35 of the 67 no
  longer summing to the depreciable base, off by up to 390 minor units. The worst rows are the
  longest-lived: a residential building at 1.5 percent spreads its base over 800 months. The
  monthly split feels like the presentational step after the real arithmetic, so it is the one
  that gets no test, and it is also the only output anybody posts.
