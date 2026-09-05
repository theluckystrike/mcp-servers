# mcp-asset-register: build

Date 2026-09-05. Scope: `servers/asset-register` only, plus `scripts/gen-spec.mjs` (one
`CURATED` entry and one name in `SERVERS`) and this file. Nothing in
`servers/expense-tracker`, `servers/per-diem`, `packages/mcp-license`, `remote/`, the pages,
the bundles or the hosting layer was touched; the orchestrator wires those. Zero paid API
calls, zero network:
`grep -rEn "fetch\(|https?://|node:http|node:net|node:dns" servers/asset-register/src/`
returns only the `source_url` fields inside the bundled JSON rate tables, and the contract
suite asserts that.

The server is `@theluckystrike/mcp-asset-register` 0.12.0, 6 tools plus the two license
tools, one resource and one prompt. It holds no copy of the corrupt-store code
(`readJsonFile` comes from `@theluckystrike/mcp-timezone/lib`) and no copy of the licensing
or locking code (`createLicenseGate`, `withFileLock` and `readSharedProfile` from
`@theluckystrike/mcp-license`). It exports its own `./lib` (the tables, `buildSchedule`,
`allocate`, `monthlyRows`, the asset store) for the next server that needs to depreciate
something.

## Design decisions worth stating

**The rate tables are bundled files, not a feed.** `src/tables/*.json`, read from disk on
first use and copied into `dist/tables` by the build. There is no network call anywhere in
this server. A depreciation rate that changed under the user between two runs of the same
register is worse than one that is visibly stale: the stale one is checkable against the file
the build shipped, the moving one is not. Every table carries a `header` with the authority,
the instrument, the source URL, the date the rates took effect, the date they were read and
the convention they imply, and the `assets://categories` resource returns that header with
the rates, so the provenance travels with the number.

**A value that could not be stated with confidence was omitted, and the header says so.**
This is the single rule the tables were built under. See "What is not bundled" below. A
depreciation rate ends up on a tax return; a wrong figure that looks authoritative is worse
than an absent one, because the absent one is refused by name and sends the caller to the
source.

**The schedule sums to the depreciable base by construction, not by luck.** `allocate` rounds
the CUMULATIVE total at each step and takes each period as the difference between two rounded
cumulatives, with the last period set to the remainder. `sum(periods) == cost - residual`
therefore holds for every input, and the same rule splits a period into months, so the months
sum to their year and the years sum to the base. The contract suite asserts the identity for
every schedule the three tables can produce, 67 of them, rather than for the two or three a
unit test would have picked.

**The convention is the table's, not the caller's, and every answer names it.** Poland charges
from the month AFTER the asset enters the register (art. 16h ust. 1 pkt 1), so an asset in
service on 15 March starts on 1 April and year one is nine twelfths. The US GDS percentages
already carry the half-year convention inside them, which is why a 5-year class runs six
periods. A UK writing down allowance is a full-period allowance on a pool and is not prorated
by month at all. The same asset gives three different year-one figures under the three
schemes, and all three are right.

**The Polish declining-balance method switches, and says which year it switched.** Art. 16k:
the rate times a coefficient of up to 2.0 on the written-down value, and from the first year
the declining amount would fall below the straight-line one, the rest of the schedule is
straight line. A truck at 20 percent times 2 on 10,000.00 gives 4000.00 / 2400.00 / 2000.00 /
1600.00, and the `basis` field on the third period names the article. Classes the annex
excludes from the method (passenger cars, buildings, civil engineering works) refuse it by
name rather than computing it anyway.

**MACRS ignores salvage, so a residual is reported as ignored rather than applied.** The
published percentages recover the whole cost. Applying a residual under them would either
break the published row or silently rebase it; both are worse than saying in the answer that
the number was not used and keeping it on the record for book purposes.

**A category is matched exactly or by prefix, never as a substring.** `"land".includes("and")`
is true, and so is the same trap in six other row names. With a deliberately partial table a
substring fallback is not a near miss, it is a row that should never have matched at all: it
would price a delivery van at the land row's 0 percent and say nothing. The fallback is a
prefix of four characters or more, and an ambiguous prefix is refused.

**Currencies are never added together.** `asset_list`, `asset_journal` and `asset_report`
total per currency. There is no exchange rate in this server, so there is no rate to be
silently wrong, and one number over a PLN register and a USD one would be invented.

**Ids are `ASSET-YYYY-NNNN`.** Same reasoning as `TRIP-YYYY-NNNN` and `INV-YYYY-NNNN`: a
counter that resets every January collides with last January's schedule. The counter is
written before the row, so a crash burns an id rather than reusing one, and existing ids are
scanned so a restored register cannot reissue one that is already on a filed return.

**The free cap is on the SIZE of the register, not on the arithmetic.** `asset_schedule` is
free and unlimited on every tier. The rates are public information published by a tax
authority; metering the reading of a regulation would be charging for the government's work
rather than for this server's.

**The scheme is derived, and reported as a derivation.** The shared business profile has
`name`, `address` and `default_currency` but no country field. Rather than infer a country
from free-text address lines, the scheme is derived from `default_currency`, which is a
closed set, and every answer that uses it says in words that it is a derivation. A profile
with no currency yields no default scheme at all rather than a plausible one.

## asset_journal writes nothing, and why

`servers/expense-tracker/package.json` exposes only `"."` in its `exports` map: there is no
`./lib` and no published store API. Its id allocation, its category-rule matching, its VAT
split and its currency defaulting all live inside `src/index.ts`, inside the `expense_add`
handler, under that server's own lock. Reaching around that and appending a row to its
`data.json` directly would create an entry with no rule-matched category, no VAT split and an
id allocated outside the counter: a row that looks native and is not.

So there is no safe write path, and `asset_journal` returns an `expense_add`-ready payload
instead, one per currency, exactly as `servers/per-diem` does for a trip and `servers/kanban`
does for time-tracker's `timer_start`. `amount` is in MAJOR units because that is what
`expense_add` takes; the minor-unit figures stay on the journal lines. `billable` is false and
no `vat_rate` is set: depreciation is a book charge, not a purchase, so there is no input VAT
on it and putting a rate there would invent a deductible amount.

## What is not bundled

| table | bundled | omitted, and why |
| --- | --- | --- |
| `pl-kst` | 33 rows at the KST group and subgroup level covering the annex positions that could be stated with confidence: 0 percent (land, art. 16c), 1.5, 2.5, 4.5, 7, 10, 14, 20 and 30 percent, each with its declining-balance eligibility | The **18 and 25 percent positions** of the annex. Their KST membership could not be stated with confidence from the public text in this build, so no row claims them. Also every individual six-digit code: the taxpayer classifies the asset, the table carries the rate |
| `uk-capital-allowances` | The main rate pool at 18 percent, the special rate pool at 6 percent, and the AIA as a 100 percent first-year row with its GBP 1,000,000 cap and the note that cars never qualify | First-year and full-expensing rules, the structures and buildings allowance, the small pools allowance, the CO2 thresholds that decide which pool a car enters, and every balancing charge. All date-sensitive; none stated with confidence here |
| `us-macrs` | The 3, 5 and 7 year GDS classes under the **half-year** convention, as the published Pub 946 Table A-1 percentages, with the class examples | The mid-quarter and mid-month convention tables, the 27.5 and 39 year real property classes, the 10, 15 and 20 year classes, the Alternative Depreciation System, section 179 and bonus depreciation. A 10-year class is refused by name, not approximated to the 7-year one |

The brief asked for at least 25 Polish groups; 33 are bundled. The two annex positions that
are missing are named in the header's `coverage` field and in the refusal text, so a caller
who asks for something they cover is told the table is partial rather than told no rate
exists.

## Probes

Harness: `servers/asset-register/test/_client.mjs` spawns `node
servers/asset-register/dist/index.js` on a fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` and
seeds the shared business profile directly (spawning the invoice server to write it would
test that server, not this one). Pro runs use `node scripts/sign-license.mjs asset-register`.
Every row is asserted in `test/{unit,adversarial,corrupt,concurrency,contract}.test.mjs`.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | PL straight-line, KST 487 at 30 percent, 8,499.00, in service 2026-03-15 | PASS | First charge 2026-04, not 2026-03. Periods 1912.28 / 2549.70 / 2549.70 / 1487.32, summing to 8499.00. The half cent on the nine-twelfths first year lands in period one by the cumulative rule |
| 2 | PL declining-balance, KST 742 at 20 percent times 2, 10,000.00 | PASS | 4000.00 / 2400.00 / 2000.00 / 1600.00. Year three's declining amount would be 1440.00, below the 2000.00 straight-line amount, so art. 16k switches and the `basis` field says so |
| 3 | US MACRS 5-year half-year, 10,000.00 | PASS | 2000.00 / 3200.00 / 1920.00 / 1152.00 / 1152.00 / 576.00, identical to Pub 946 Table A-1, six periods for a five-year class |
| 4 | US MACRS 3-year and 7-year | PASS | 999.90 / 1333.50 / 444.30 / 222.30 on 3,000.00, and the eight published 7-year percentages on 10,000.00. Both sum to cost |
| 5 | UK main pool at 18 percent, 10,000.00 | PASS | 1800.00 / 1476.00 / 1210.32 ..., 25 periods, the last writing off the balance with a `basis` line saying a reducing rate never closes a pool |
| 6 | UK special rate pool and AIA | PASS | 6 percent on the special pool; AIA is a single 100 percent period |
| 7 | Residual under straight line | PASS | 120,000.00 car with a 20,000.00 residual: base 100,000.00, last period closes at 20,000.00 not at zero |
| 8 | Cost that does not divide evenly | PASS | 10,000.01 with a 0.01 residual over a 14 percent life: periods differ from each other and still sum to 10,000.00 exactly |
| 9 | Monthly view | PASS | 45 months for probe 1, first month 2026-04, months summing to their own year and to 8,499.00 |
| 10 | Residual over cost, and residual equal to cost | PASS | Both refused by name with "nothing was written"; the register stays empty |
| 11 | Negative cost, zero cost, fractional cost | PASS | All three refused. A decimal in a minor-unit field is a caller who thought the field was major units, so it is refused rather than rounded |
| 12 | Disposal before the in-service date | PASS | Refused naming both dates. Disposal ON the in-service date is allowed; a second disposal of the same asset is refused |
| 13 | Life of zero, negative life, rate of zero, rate over 100 | PASS | All refused. A life of zero would divide the cost by nothing |
| 14 | Land at 0 percent | PASS | In the table and refused as a schedule, citing art. 16c |
| 15 | Category outside the table | PASS | "goodwill" refused with the annex gap named; a US 10-year class refused rather than approximated to the 7-year one |
| 16 | Substring match | PASS | `category: "and"` refused; `"Computers"` resolves to 487 by prefix |
| 17 | Declining balance where the scheme forbids it | PASS | Polish passenger cars and buildings refused by name; a coefficient of 3 refused against the annex maximum of 2 |
| 18 | Corrupt `assets.json` | PASS | Quarantined byte for byte with a marker, every store-reading tool keeps failing, and `asset_schedule` on an unstored asset still answers: a broken register is not a broken rate table |
| 19 | Corrupt `counter.json` | PASS | The write is blocked and the already-stored asset is still readable |
| 20 | Two processes racing `asset_add` | PASS | 40 unique ids, counter at exactly 40, nothing lost |
| 21 | Two processes racing the tenth free asset | PASS | Exactly 10 stored, 6 refused, the check and the write one critical section |
| 22 | Two processes racing the same disposal | PASS | Booked exactly once; the loser is told it was already disposed of |
| 23 | Journal balance and the disposal cut-off | PASS | Debit equals credit per line and in total; the month of disposal is charged and the month after is not; a month with nothing to charge returns no lines rather than a zero line |
| 24 | `expense_add` payload shape | PASS | One payload per currency, `amount` in major units, `date` the last day of the month, `billable: false`, no `vat_rate` |
| 25 | Free-tier refusals | PASS | Eleventh asset, `asset_journal` and `asset_report` all refuse with the tool name, the one-time price, both purchase URLs and the instruction to run `license_activate` |
| 26 | Pro key for another product | PASS | A key signed for `per-diem` does not unlock `asset_report` here |
| 27 | stdout | PASS | Every line across initialize, tools/list, a success and an error parses as JSON-RPC 2.0 |
| 28 | Version identity | PASS | package.json, generated `src/version.ts`, `serverInfo` and all four manifests carry 0.12.0; `sync-versions --check` passes repo-wide |
| 29 | Manifest remotes rule | PASS | `server.mcpb.json` remotes deep-equal `remotes.json` (`/mcp/asset-register`); `server.json`, `server.variant.json` and `server.fixed-assets.json` carry none |
| 30 | Every schedule the tables can produce | PASS | 67 combinations of scheme, category and method: each sums to its depreciable base to the minor unit and closes at the residual |

## Final test summary

    npm run build -w servers/asset-register   tsc clean, no output
    npm test -w servers/asset-register        # tests 45 / # pass 45 / # fail 0 / # skipped 0
    node scripts/sync-versions.mjs --check    0 file(s) written
    node scripts/gen-spec.mjs asset-register  tools=8 resources=1 prompts=1 failure_modes=18

45 tests across `unit` (16), `adversarial` (14), `corrupt` (2), `concurrency` (3) and
`contract` (10).

## RESULT.md block

    status: DONE
    evidence:
    - npm run build -w servers/asset-register: tsc clean
    - npm test -w servers/asset-register: # tests 45 / # pass 45 / # fail 0 / # skipped 0
    - node scripts/sync-versions.mjs --check: 0 file(s) written
    - no network and no stdout write in src, asserted in contract.test.mjs
    - US MACRS 5-year on 10,000.00 reproduces IRS Pub 946 Table A-1 exactly
    - 67 of 67 schedules the tables can produce sum to their depreciable base to the cent
    artifacts:
    - /Users/mike/mcp-servers/servers/asset-register/
    - /Users/mike/mcp-servers/docs/ASSET_REGISTER_RESULT.md
    cost: 52 wall minutes
    failures:
    - A life override test asserted four equal periods and got five; the code was right and
      the test was wrong, because the Polish month-following rule makes year one eleven
      twelfths for a January purchase. Test corrected
    - asset_schedule's description was 235 characters, over the 220 ceiling; rewritten to 218
      rather than added to the contract suite's baseline
    - gen-spec.mjs run without arguments regenerated all 19 SPEC.md files, most stale for
      unrelated reasons; reverted with git checkout
    insight:
    - The yearly schedule is where rounding errors are looked for and the monthly journal is
      where they are. Of the 67 schedules these tables can produce for one test asset, the
      yearly rows survive almost any rounding rule; splitting the same years into months with
      a per-month Math.round leaves 35 of 67 no longer summing to the base, off by up to 390
      minor units, worst on the longest-lived rows (a 1.5 percent building spreads its base
      over 800 months). The monthly split looks like the presentational step after the real
      arithmetic, so it is the one that goes untested, and it is the only output anybody posts

Built by theluckystrike. https://github.com/theluckystrike
