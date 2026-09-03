1. `servers/time-tracker/src/index.ts:65` — P0 — Any read or JSON parse failure is treated as an empty database; the next mutation overwrites the existing history. Minimal input: malformed `data.json` followed by `timer_start`. Fix: treat only `ENOENT` as empty and fail without saving on corruption or permission errors.

2. `servers/spreadsheet/src/sheet.ts:75` — P2 — CSV files with a UTF-16 BOM are decoded as UTF-8, corrupting headers and values. Minimal input: bytes `FF FE 69 00 64 00 2C 00 78 00`. Fix: inspect the byte BOM before decoding and support UTF-8, UTF-16LE, and UTF-16BE.

3. `servers/spreadsheet/src/csv.ts:67` — P2 — An unterminated quoted field silently consumes the rest of the file into one cell. Minimal input: `a,b\n"x,y\nz,w`. Fix: throw a parse error when EOF is reached with `inQ === true`.

4. `servers/spreadsheet/src/sheet.ts:159` — P1 — Locale numbers are coerced incorrectly during aggregation: `12,99` becomes `1299`, `EUR 1 250,00` becomes `125000`, and European `1.234` is treated as `1.234`. Minimal input: `item;price\nx;12,99`. Fix: parse decimal and grouping separators using an explicit locale or validated separator patterns before removing characters.

5. `servers/spreadsheet/src/csv.ts:99` — P1 — Integers beyond JavaScript’s safe range are rounded during CSV import. Minimal input: `id\n9007199254740993` becomes `9007199254740992`. Fix: retain integers outside `Number.isSafeInteger` as strings or decimals.

6. `servers/spreadsheet/src/sheet.ts:75` — P1 — `maxRows` is applied only after reading, parsing, coercing, and copying the entire CSV. Minimal input: a 49 MiB CSV with `maxRows: 100`. Fix: parse incrementally and stop after the requested row limit.

7. `servers/spreadsheet/src/expr.ts:147` — P1 — Expression comparisons undo identifier preservation and misparse locale strings. Minimal input: row `{Code:"007", Price:"12,99"}` with `[Code] = 7` or `[Price] > 13`; both return true. Fix: compare strings as strings unless both operands are numbers, and use the shared locale-aware numeric parser for explicit numeric coercion.

8. `servers/spreadsheet/src/expr.ts:217` — P2 — Mixed number/text ordering falls back to lexical comparison instead of reporting an incompatible type. Minimal input: row `{v:"abc"}` with `[v] > 2` returns true. Fix: reject ordered comparisons when only one operand is numeric.

9. `servers/spreadsheet/src/sheet.ts:116` — P1 — A one-cell report title is accepted as the header row, so the actual headers become data. Minimal input: `Sales report\nName,Amount\nA,1`. Fix: score candidate rows against following rows and reject sparse title rows even when their physical width is one.

10. `servers/spreadsheet/src/index.ts:272` — P2 — Group keys erase cell types and can collide. Minimal input: XLSX rows containing numeric `1` and text `"1"` in the group column are merged. Fix: serialize keys with explicit type tags and collision-safe encoding.

11. `servers/spreadsheet/src/index.ts:269` — P2 — A global aggregate over zero matching rows returns no row instead of `count=0` or `sum=0`. Minimal input: `where: "1 = 0"`, no `group_by`, aggregate `count(*)`. Fix: create one empty global group when aggregates are requested without group columns.

12. `servers/spreadsheet/src/index.ts:281` — P2 — Every aggregate over `col:"*"` returns the row count regardless of `fn`. Minimal input: aggregate `{col:"*", fn:"sum", as:"total"}` over three rows returns `3`. Fix: permit `*` only with `count` or implement defined semantics for each function.

13. `servers/spreadsheet/src/index.ts:267` — P1 — Aggregate aliases can overwrite group columns or other aggregates. Minimal input: group by `Region` and use `{col:"Sales", fn:"sum", as:"Region"}`; the region label is replaced by the sum. Fix: reject duplicate aliases and aliases colliding with group columns.

14. `servers/spreadsheet/src/index.ts:257` — P2 — `Math.min(...nums)` and `Math.max(...nums)` can exceed the argument limit on large columns. Minimal input: an aggregate over roughly 150,000 numeric rows. Fix: calculate min and max with a loop or reducer.

15. `servers/spreadsheet/src/index.ts:148` — P2 — Array input during append retains the documented header row as data. Minimal input: append `[["Name","Qty"],["B",2]]`; `"Name","Qty"` is appended as a record. Fix: validate and remove the first array as headers in append mode.

16. `servers/spreadsheet/src/index.ts:135` — P1 — Appending to or overwriting one XLSX sheet rebuilds the workbook with only that sheet, discarding other sheets, formulas, formatting, and metadata. Minimal input: append to `Sheet1` of a workbook containing `Sheet1` and `Sheet2`. Fix: mutate the loaded workbook and replace only the selected worksheet.

17. `servers/spreadsheet/src/sheet.ts:55` — P1 — XLSX date cells are converted to `YYYY-MM-DD` strings, losing their cell type and time before any write or conversion. Minimal input: a date cell containing `2026-09-03 15:30`, then convert to XLSX. Fix: preserve `Date` values and number formats through the internal cell model.

18. `servers/time-tracker/src/index.ts:138` — P1 — Grouped hourly rates are parsed as decimal-comma values. Minimal input: `hourly_rate: "1,200 USD"` is stored as USD 1.20/hour. Fix: use a locale-aware decimal parser and reject ambiguous separators.

19. `servers/time-tracker/src/index.ts:160` — P1 — Entries without explicit rates or currencies resolve against the current project metadata, so later rate changes rewrite historical billing. Minimal input: set Acme to USD 50, log one hour without an override, then set Acme to EUR 100; the old entry reports EUR 100. Fix: snapshot the effective rate and currency onto every entry when it is created.

20. `servers/time-tracker/src/index.ts:260` — P1 — Date-only bounds are parsed as UTC midnight, and `to` denotes the start rather than the end of that date. Minimal input: `from:"2026-09-01", to:"2026-09-30"` excludes most or all of September 30 and shifts both bounds in non-UTC zones. Fix: parse date-only bounds as local/IANA-zone calendar boundaries with an exclusive next-day upper bound.

21. `servers/time-tracker/src/index.ts:270` — P1 — Period and free-tier selection tests only entry start times and never clips overlapping entries. Minimal input on 2026-09-03: entry `2026-08-27T23:30`–`2026-08-28T01:30` is excluded from the seven-day window beginning August 28. Fix: select interval overlaps and apportion seconds and money to the requested bounds.

22. `servers/time-tracker/src/index.ts:547` — P1 — Entries crossing midnight or a month boundary are assigned wholly to their start day. Minimal input: `2026-03-31T23:30`–`2026-04-01T01:30` contributes two hours to March 31 and none to April 1. Fix: split entries at local calendar boundaries before day aggregation.

23. `servers/time-tracker/src/index.ts:364` — P1 — “Today” omits the portion of entries started yesterday and counts the full duration of a running timer started yesterday. Minimal input: a timer running from 23:30 through 00:30 reports one hour today. Fix: intersect every logged and running interval with `[todayStart, tomorrowStart)`.

24. `servers/time-tracker/src/index.ts:92` — P1 — Offsetless timestamps are ambiguous across DST folds despite being shown in API examples. Minimal input under `TZ=America/New_York`: start `2026-11-01T01:30:00`, end `2026-11-01T02:30:00` is billed as two hours even when the second 01:30 was intended. Fix: require an offset or IANA timezone for ambiguous local timestamps.

25. `servers/time-tracker/src/day.ts:8` — P2 — Input offsets are discarded for day grouping and replaced by the server’s timezone. Minimal input under `TZ=Asia/Ho_Chi_Minh`: `2026-09-01T23:30:00-04:00` groups under September 2. Fix: persist a reporting timezone or accept one explicitly for grouping and bounds.

26. `servers/time-tracker/src/index.ts:592` — P1 — `group_by:"tag"` double-counts totals because each multi-tag entry is copied into multiple buckets and totals are derived from buckets. Minimal input: one hour at USD 100 tagged `["a","b"]` reports two total hours and USD 200. Fix: calculate report totals directly from entries, independently of group buckets.

27. `servers/time-tracker/src/index.ts:594` — P1 — JSON reports expose one arbitrary `amount_cents`/`currency` pair for mixed-currency totals, selected by comparing nominal minor-unit amounts. Minimal input: USD 100 plus EUR 90 yields scalar USD 100 while `amounts` contains both. Fix: omit scalar amount fields when more than one currency exists.

28. `servers/time-tracker/src/index.ts:156` — P2 — Money is rounded per entry and then summed, producing different totals based on entry fragmentation. Minimal input: three one-second entries at USD 100/hour total USD 0.09 instead of rounding the combined amount to USD 0.08. Fix: accumulate exact rational minor-unit values per invoice line and round once.

29. `servers/time-tracker/src/index.ts:267` — P1 — Reporting and invoicing use exact project matching while creation uses fuzzy resolution, and rate/edit operations bypass resolution. Minimal input: projects `Acme Web` and `Acme Mobile`, then `invoice_summary {project:"Acme"}` returns no entries instead of ambiguity. Fix: use one resolver for all tools and return a tool error with candidates on ambiguity.

30. `servers/price-tracker/src/extract.ts:245` — P1 — JSON-LD offers from unrelated products are pooled and the lowest exact price is selected while the first product name is retained. Minimal input: main Product USD 100 plus recommended Product USD 10 returns title “Main” with price 10. Fix: associate offers with the selected product node and ignore unrelated graph products.

31. `servers/price-tracker/src/extract.ts:293` — P1 — `twitter:data1` is treated as a high-confidence price although it commonly contains shipping thresholds. Minimal input: `<meta name="twitter:data1" content="Free shipping over $50">` returns USD 50. Fix: remove this key or require product-price context and a matching currency field.

32. `servers/price-tracker/src/extract.ts:340` — P1 — Class extraction takes the first price-like value without excluding strike-through or old-price markup. Minimal input: `<span class="price"><s>$199</s></span><span class="price">$99</span>` returns USD 199. Fix: exclude `s`, `del`, hidden, old-price, and compare-at nodes and prefer current/sale nodes.

33. `servers/price-tracker/src/extract.ts:398` — P2 — Regex fallback chooses the largest currency-adjacent number, so list prices and shipping thresholds beat the current price. Minimal input: `Was $199; now $99; free shipping over $50` returns USD 199. Fix: rank candidates by nearby “now/current/sale” and “was/list/shipping” context instead of value.

34. `servers/price-tracker/src/extract.ts:137` — P1 — A dollar sign is inferred from the ccTLD before later explicit currency text is considered. Minimal input at `https://shop.ca/x`: amount `10` with visible text `$10 USD` returns CAD. Fix: prefer explicit ISO codes and structured currency fields; use ccTLD only when no explicit currency exists.

35. `servers/price-tracker/src/redirect.ts:139` — P1 — Any newly introduced `/products/` segment is classified as a listing even when it is a product route and the SKU survives. Minimal input: requested `/item/12345`, final `/products/widget?sku=12345`, title `Widget`; the redirect is rejected. Fix: do not treat `products` as a listing when a product identity token survives or a product-detail pattern follows it.

36. `servers/price-tracker/src/redirect.ts:79` — P2 — The unanchored not-found title regex rejects legitimate product names containing `404`. Minimal input: a redirect to a product titled `Acme 404 Router`. Fix: match 404/not-found page-title patterns as complete phrases rather than arbitrary substrings.

Verdict  
One P0 data-loss path and multiple P1 financial, spreadsheet, extraction, and redirect defects block release.