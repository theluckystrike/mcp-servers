# mcp-per-diem: build

Date 2026-09-05. Scope: `servers/per-diem` only, plus `scripts/gen-spec.mjs` (one `CURATED`
entry and one name in `SERVERS`) and this file. Nothing in `servers/expense-tracker`,
`servers/timezone`, `packages/mcp-license`, `remote/`, the pages, the bundles or the hosting
layer was touched; the orchestrator wires those. Zero paid API calls, zero network:
`grep -rEn "fetch\(|https?://|node:http|node:net|node:dns" servers/per-diem/src/` returns only
the `source_url` fields inside the bundled JSON rate tables.

The server is `@theluckystrike/mcp-per-diem` 0.11.0, 8 tools, one resource, one prompt. It holds
no copy of the datetime, zone or corrupt-store code: `isValidZone`, `resolveZone`, `wallIn`,
`offsetMinutes`, `zonedToUtc` and `readJsonFile` come from `@theluckystrike/mcp-timezone/lib`,
and `createLicenseGate`, `withFileLock` and `readSharedProfile` from
`@theluckystrike/mcp-license`. It exports its own `./lib` (the tables, `calc`, `findRate`, the
trip store) for the next server that needs to price a trip.

## Design decisions worth stating

**The rate tables are bundled files, not a feed.** `src/tables/*.json`, read from disk on first
use and copied into `dist/tables` by the build. There is no network call anywhere in this
server. A per diem figure that changed under the user between two runs of the same trip is worse
than one that is visibly stale: the second is checkable, the first is not. Every table carries a
`header` with the authority, the instrument, the source URL, the date the rates took effect and
the date they were read, and `perdiem_rates` returns that header with the rates, so the
provenance travels with the number.

**A value that could not be stated with confidence was omitted, and the header says so.** This
is the single rule the tables were built under, and it is why this build is PARTIAL rather than
DONE. See "What is not bundled" below. A per diem ends up on a tax return; a wrong figure that
looks authoritative is worse than an absent one, because the absent one is refused by name and
sends the caller to the source.

**Start and end are instants, never wall clocks.** Either ISO 8601 carrying its own offset, or a
local datetime plus an IANA `timezone` resolved through the timezone engine's DST-aware
resolver. Elapsed time is an epoch difference throughout. A per diem is counted in elapsed
hours, so a trip across a clock change is 23 or 25 hours, and a naive text difference gets that
wrong every March and October. A local time inside a spring-forward gap is moved forward rather
than silently kept, so the allowance is the one the traveller could actually have earned.

**The day model differs by scheme, and the answer says which one it used.** `pl` and `uk` count
24-hour periods from departure (the Polish `doba`, and the shape HMRC's hour bands assume). `us`
counts calendar days in the destination zone (FTR 301-11.101). The same 23-hour DST crossing is
therefore one day under the Polish rule and two under the US one, and both are right.

**Meal deductions are each scheme's own, and a day is floored at zero.** Poland domestic
25/50/25 percent of the day, Poland foreign 15/30/30, US the published breakfast, lunch and
dinner amounts of the M&IE tier with the incidentals never deducted, UK a pro rata share of the
band. The UK pro rata is the one place this server interprets rather than transcribes: HMRC
states that the rate is not payable for a meal that was provided, but not the arithmetic when
only one of the three is. The answer's `rule` field says so in those words.

**Currencies are never added together.** `trip_list` and `perdiem_report` total per currency.
There is no exchange rate in this server, so there is no rate to be silently wrong, and one
number over a PLN diet and a EUR one would be invented.

**Ids are `TRIP-YYYY-NNNN`.** Same reasoning as `INV-YYYY-NNNN` and `DEP-YYYY-NNNN`: a counter
that resets every January collides with last January's claim. The counter is written before the
row, so a crash burns an id rather than reusing one, and existing ids are scanned so a restored
store cannot reissue one.

**The free cap is on SAVING a trip, not on pricing one.** `perdiem_rates` and `perdiem_calc` are
free and unlimited on every tier. The rates are public information published by a tax authority;
metering the reading of a regulation would be charging for the government's work rather than for
this server's.

**The home scheme is derived, and reported as a derivation.** The shared business profile
(`packages/mcp-license` `readSharedProfile`) has `name`, `address` and `default_currency` but no
country field. Rather than infer a country from free-text address lines, the home scheme is
derived from `default_currency`, which is a closed set, and every answer that uses it says in
words that it is a derivation and not a stored fact. A profile with no currency yields no
default scheme at all rather than a plausible one.

## trip_export writes nothing, and why

`servers/expense-tracker/package.json` exposes only `"."` in its `exports` map: there is no
`./lib` and no published store API. Its id allocation, its category-rule matching, its VAT split
and its currency defaulting all live inside `src/index.ts`, inside the `expense_add` handler,
under that server's own lock. Reaching around that and appending a row to its `data.json`
directly would create an expense with no rule-matched category, no VAT split and an id allocated
outside the counter: a row that looks native and is not.

So there is no safe write path, and `trip_export` returns an `expense_add`-ready payload
instead, one per currency, exactly as `servers/kanban` hands back `timer_start` arguments for
time-tracker rather than writing into its store. `amount` is in MAJOR units because that is what
`expense_add` takes; the minor-unit figures stay on the trip record. No `vat_rate` is set: a
statutory per diem is an allowance, not a purchase, so there is no input VAT to reclaim, and
putting a rate there would invent a deductible amount.

## What is not bundled

| table | bundled | omitted, and why |
| --- | --- | --- |
| `pl-domestic` | Diet PLN 45.00, lodging lump sum PLN 67.50 (150 percent), the partial-day ladder and the 25/50/25 meal rule | The 20 percent local-transport lump sum is listed in the row note but never paid: it is not subsistence |
| `pl-foreign` | 34 countries with the diet and its currency, from the Dz.U. 2022 poz. 2302 wording of the annex | The other roughly 90 countries, and every per-country lodging limit. A missing country is refused by name as "not verified here", not as "no rate exists" |
| `uk-domestic` | All four HMRC benchmark scale rates: GBP 5.00 at 5 hours, GBP 10.00 at 10, GBP 25.00 at 15 with the journey ongoing at 8pm, and the GBP 10.00 late-evening supplement | Nothing |
| `uk-overseas` | **Nothing.** Empty rate list, `bundled: false`, and a header that explains it | The whole per-city table: roughly 250 cities times eight figures each, in the destination currency. Not statable with confidence here |
| `us-gsa` | CONUS **standard** lodging cap and M&IE for FY2025 and FY2026, with the published meal breakdown (16/19/28 plus 5 incidentals, first and last day 51.00) | The roughly 300 non-standard localities. A destination that is not one of them takes the standard rate anyway, which is what this table gives |

The brief asked for the HMRC overseas scale rates for at least 30 cities. They are not here, and
that is the one thing this build did not deliver. The brief's own rule decided it: "If a value
cannot be stated with confidence, omit the country and say so in the README rather than guess."
Roughly 2,000 individual tax-relief figures could not be stated with confidence from public
regulation text in this session, so none of them is bundled, the file is kept with an empty rate
list so the shape is stable for a later build, `perdiem_rates` reports the gap in its `notes`,
and `perdiem_calc {scheme:"uk", destination:"Paris"}` refuses by name with the HMRC URL.

## Probes

Harness: `servers/per-diem/test/_client.mjs` spawns `node servers/per-diem/dist/index.js` on a
fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` and seeds the shared business profile directly
(spawning the invoice server to write it would test that server, not this one). Pro runs use
`node scripts/sign-license.mjs per-diem`. Every row is asserted in
`test/{unit,adversarial,corrupt,concurrency,contract}.test.mjs`.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | PL domestic, 58 h to Krakow, one free breakfast, 2 nights | PASS | days 33.75 / 45.00 / 45.00 = PLN 123.75, ryczalt 2 x 67.50 = PLN 135.00, total PLN 258.75. The 10-hour remainder is over 8 h so it pays a whole diet |
| 2 | PL foreign, 29 h to Germany, 2 nights | PASS | EUR 55.00 + one third (EUR 18.33) = EUR 73.33; the 2 nights add nothing and the answer names the missing lodging limit |
| 3 | PL foreign meal deductions | PASS | all three free meals take 15 + 30 + 30 percent, EUR 41.25 off EUR 55.00, not the domestic 25/50/25 |
| 4 | UK, the four bands | PASS | 4 h = GBP 0 and "under 5 hours"; 6 h = GBP 5.00; 13 h = GBP 10.00; 16 h with a free lunch = GBP 25.00 less GBP 8.33 = GBP 16.67; late_evening on a 13.5 h day = GBP 20.00 |
| 5 | US FY2026, three calendar days, 2 nights | PASS | 51.00 + 68.00 + 51.00 = USD 170.00 M&IE, lodging 2 x 115.00 = USD 230.00, total USD 400.00, and the answer says the lodging figure is a CAP |
| 6 | US meal deductions and FY2025 | PASS | breakfast + dinner on the middle day deducts USD 44.00 exactly (16 + 28), not a percentage; `fiscal_year: "FY2025"` gives the USD 110.00 cap |
| 7 | JPY | PASS | `JPY 7,532`, no decimal point, `decimals: 0` |
| 8 | end before start | PASS | refused, "is not after start ... compared as instants, not as text"; a zero-length trip too; and `12:00+02:00 -> 23:00+00:00` is correctly 13 hours, which a text comparison would have refused |
| 9 | unknown country, all three schemes | PASS | PL names the partial table in the words "not verified here, not no rate exists"; UK names the unbundled overseas table; US names the CONUS standard restriction. Nothing is priced |
| 10 | Oman | PASS (after a fix) | refused. Before the fix it was priced at Romania's EUR 42.00: see the measured insight |
| 11 | 400-day trip | PASS | refused, "past a year a posting is a relocation"; a 366-day trip is accepted and returns 366 day lines totalling PLN 16,470.00 |
| 12 | DST crossing | PASS | Europe/Warsaw noon-to-noon over 2026-03-29 is 23 h, one day, PLN 45.00; over 2026-10-25 it is 25 h, two days, PLN 67.50. The same 23 h crossing under the US scheme is two calendar days, USD 102.00 |
| 13 | a local time inside the spring-forward gap | PASS | 02:30 on 2026-03-29 does not exist in Europe/Warsaw; it resolves forward to 03:30 and the trip is 8.5 h, not 9.5 |
| 14 | no timezone, unparseable datetime, 2026-02-30, unknown zone | PASS | all four refused; the first says why in one line ("a per diem is counted in elapsed hours") |
| 15 | every meal provided; a duplicated meal | PASS | a US day floors at 0 rather than going negative; `["lunch","lunch"]` deducts once |
| 16 | ambiguous and unknown trip name | PASS | "matches more than one trip ... Pass the exact id"; an unknown id is named |
| 17 | out-of-range arguments | PASS | negative, fractional and 100000 `lodging_nights`, an unknown scheme and an unknown meal are all refused at the schema, and the data dir is never created |
| 18 | corrupt `trips.json` | PASS | moved byte-for-byte to `trips.json.corrupt-<stamp>` with a marker, nothing written back, and `trip_list`, `trip_record`, `trip_export` and `perdiem_report` all fail afterwards. `perdiem_calc` and `perdiem_rates` still answer: a broken trip file is not a broken rate table. A corrupt `counter.json` blocks the write and leaves the stored trip readable |
| 19 | two processes, one data dir, 40 concurrent `trip_record` | PASS | 40 rows, 40 unique ids, `counter.json` reads `{"TRIP-2026": 40}` |
| 20 | two processes racing the last free trip of the month | PASS | exactly 5 stored, exactly 3 refused, `trips.json` never holds 6: the cap check and the write are one critical section under one lock |
| 21 | free tier | PASS | 5 trips in a calendar month, then a refusal naming the count and `https://mcp.zovo.one/buy/per-diem?src=per-diem.trip_record`; a trip starting in another month is not blocked; `perdiem_calc`, `perdiem_rates` and `trip_list` keep working; `trip_export` and `perdiem_report` refuse with the Pro text and write nothing. A key signed for `deposits` does not unlock them |
| 22 | `trip_export` | PASS | two `expense_add` payloads (subsistence PLN 123.75, lodging PLN 135.00 as `travel/lodging`), major units, `billable: true` from the project, no `vat_rate`, and `why_not_written` naming the missing library entry point. `mark_exported` stamps the trip |
| 23 | provenance | PASS | all five tables carry authority, instrument, `https://` source URL, effective date, retrieved date and currency; the empty one carries a `coverage` explaining itself; no header carries an emoji or an em dash |
| 24 | stdout carries JSON-RPC only | PASS | no `console.*` in `src/`; the readiness line goes to stderr. Asserted over `initialize`, `tools/list` and both the success and the error paths |
| 25 | version contract | PASS | `package.json`, generated `src/version.ts`, `serverInfo.version` and all four manifests agree, the three registry names differ, every manifest description is under 100 characters, every package entry is stdio, `server.mcpb.json` `remotes` equals `remotes.json` and no second-name manifest carries one, every mcpb entry carries `fileSha256: "TBD"`, and `scripts/sync-versions.mjs --check` passes for the whole repo |
| 26 | 200 trips, Pro | PASS | `trip_record` 4.3 ms each, `trip_list` 2 ms (70,840 chars), `perdiem_report` 2 ms, `perdiem_rates` 1 ms, a 366-day calculation 2 ms (124,626 chars), store 424,092 bytes |

## Free vs Pro, as shipped

| | Free | Pro |
| --- | --- | --- |
| `perdiem_rates`, `perdiem_calc` | Yes, unlimited | Yes |
| Trips saved per calendar month | 5, by start date | Unlimited |
| `trip_list` | Yes, unlimited | Yes |
| `trip_export` | No | Yes |
| `perdiem_report` | No | Yes |

## Measured insight

**Substring matching a country name priced a trip to Oman at Romania's rate, silently.**

The first build resolved a destination by exact country name, then ISO code, then
`country.includes(destination)`. `"romania".includes("oman")` is `true`. A trip to Oman -- a
country this build deliberately does not bundle -- came back priced at EUR 42.00, in the wrong
currency, from a country 3,000 km away, with no note and no error. Measured on the shipped build
before the fix, in `test/adversarial.test.mjs`'s Oman probe, which failed with a successful
calculation rather than the expected refusal.

The fix is one line: the fallback is a prefix match of four characters or more, so a destination
that is genuinely absent is refused by name.

The general form is what matters. A fuzzy match is safe when a miss is cheap and dangerous when
a miss is silent, and this table is DELIBERATELY partial, which is exactly what makes the
substring fallback unsafe. With a complete table, a wrong row is a near miss on a real country.
With a partial one, it is a row that should never have matched at all, and the caller is handed
a confident tax figure in place of the refusal that would have sent them to the regulation. The
same reasoning is why `perdiem_rates` filters by prefix too, and why an empty result there
carries the table's `coverage` text rather than an empty list.

## Not done here (orchestrator)

- Not wired, not hosted, not released. `server.mcpb.json` carries `fileSha256: "TBD"` until the
  bundle is built. `remotes.json` and the `remotes` block on the mcpb manifest describe the
  intended host at `/mcp/per-diem`; nothing here assumes it exists, and the two second-name
  manifests (`server.variant.json`, `server.delegacja.json`) are stdio-only.
- `node scripts/release-check.mjs` will fail for `per-diem` on the wiring outside
  `servers/per-diem/`: the bundle, the mirrors, the pages, the facts and tool lists, the product
  and setup entries, the comparison and guide pages, the demo gif and the logo.
- The README has no demo gif line, because `assets/demo-per-diem.gif` does not exist yet.
- The HMRC overseas per-city scale rates are not bundled. That is the one brief item not
  delivered; the reason and the shape left in place for a later build are above.

Built by theluckystrike. https://github.com/theluckystrike
