status: PARTIAL
evidence:
- npm run build -w servers/per-diem: tsc clean, no output
- npm test -w servers/per-diem: # tests 33 / # pass 33 / # fail 0 / # skipped 0
- node scripts/gen-spec.mjs per-diem: tools=8 resources=1 prompts=1 failure_modes=2
- node scripts/sync-versions.mjs --check: passes for the whole repo (asserted inside test/contract.test.mjs)
- grep -rEn "fetch\(|https?://|node:http|node:net|node:dns|console\." servers/per-diem/src/ returns
  only the source_url fields inside the bundled JSON tables (asserted in test/contract.test.mjs)
- worked examples, exact: PL domestic 58 h to Krakow with one free breakfast = PLN 123.75 subsistence
  (33.75 + 45.00 + 45.00) plus PLN 135.00 ryczalt for 2 nights = PLN 258.75; PL foreign 29 h to
  Germany = EUR 55.00 + EUR 18.33 = EUR 73.33; UK 16 h with a free lunch = GBP 25.00 less GBP 8.33
  = GBP 16.67; US FY2026 three calendar days = USD 51.00 + 68.00 + 51.00 = USD 170.00 plus 2 nights
  at the USD 115.00 cap = USD 400.00
- 200 trips, Pro: trip_record 4.3 ms each, trip_list 2 ms (70,840 chars), perdiem_report 2 ms,
  perdiem_rates 1 ms, a 366-day calculation 2 ms (124,626 chars), store 424,092 bytes
artifacts:
- /Users/mike/mcp-servers/servers/per-diem/ (src, src/tables, test, SPEC.md, README.md, 4 manifests)
- /Users/mike/mcp-servers/docs/PER_DIEM_RESULT.md
cost: 52 wall minutes
failures:
- Destination matching used country.includes(needle) as its fallback. "romania".includes("oman") is
  true, so a trip to Oman -- a country this build deliberately does not bundle -- came back priced at
  Romania's EUR 42.00 with no warning. Fixed to a prefix match of 4 characters or more; asserted in
  test/adversarial.test.mjs.
- Two unit expectations were wrong before the code was: a 12-hour Polish domestic trip is half a diet
  (the band is "8 to 12", inclusive), and a 13-hour foreign one is a whole diet (the foreign band is
  "over 12"). The code was right both times.
insight:
- A fuzzy match is safe when a miss is cheap and dangerous when a miss is silent. This server's tables
  are DELIBERATELY partial, which is exactly what makes a substring fallback unsafe: with a complete
  table a wrong row is a near miss, with a partial one it is a row that should never have matched, and
  the output is a tax figure. The fallback has to fail closed.
partial:
- The brief asked for the HMRC overseas scale rates for at least 30 cities. They are NOT bundled. The
  table is roughly 250 cities times eight figures each (room, breakfast, lunch, dinner, other, drinks,
  over-5-hour, over-10-hour, 24-hour), in the destination currency, and none of it could be stated with
  confidence from public regulation text here. Under the brief's own rule -- omit rather than guess --
  src/tables/uk-overseas.json ships with an empty rate list and a header that says so, perdiem_rates
  reports it, and perdiem_calc refuses a foreign UK destination by name and points at the HMRC page.
  The UK domestic benchmark scale rates (all four figures) ARE bundled and tested.
- The Polish foreign annex ships 34 of its roughly 120 countries, over the 30 asked for. The remaining
  rows and every per-country lodging limit are omitted for the same reason.
- The US table ships the CONUS standard rate for FY2025 and FY2026 only, not the roughly 300
  non-standard localities.
