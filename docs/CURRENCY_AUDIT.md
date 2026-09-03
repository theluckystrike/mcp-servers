# mcp-currency: adversarial audit and user-value run

Date 2026-09-03. Scope: `servers/currency` only (src, test, README). Zero paid API calls. The only
network the server makes is to the two public ECB files, and every Part 1 probe is served by a local
fixture HTTP server (`ECB_BASE_URL`), so Part 1 touched the internet zero times. Part 2 used one real
download of `eurofxref-daily.xml` and `eurofxref-hist.xml` to warm the cache before the model ran.

Part 1 harness: `/private/tmp/curaudit/probe{,2,3}.mjs` -- spawns `dist/index.js`, speaks JSON-RPC
over stdio, flags any stdout line that is not parseable JSON, and inspects the data directory on
disk after each run. Fresh `XDG_DATA_HOME` per probe; `MCP_LICENSE_KEY=""` (free) except where the
probe needs Pro, which uses a key from `scripts/sign-license.mjs`.

Part 2 harness: the real `claude` CLI as MCP client -- `claude -p ... --model sonnet
--strict-mcp-config --mcp-config <lane>/mcp.json --output-format stream-json --verbose --max-turns 16`
with a per-tool allowlist written out by name (an `mcp__*` glob grants nothing). Two lanes, each with
its own fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` and `MCP_LICENSE_KEY=""`:

| Lane | Dir | Servers registered | Scenarios |
|---|---|---|---|
| A | `/private/tmp/cv1` | currency alone | 1, 2, 3, 4 |
| B | `/private/tmp/cv2` | currency + expense-tracker | 5 |

---

## Part 1 -- adversarial probes

| # | Probe | Verdict | Fixed | After |
|---|---|---|---|---|
| P1 | `convert` with no arguments | PASS | - | zod: `Required at amount / from / to` |
| P2 | `convert {amount, from}`, `to` missing | PASS | - | `Required at to` |
| P3 | `convert {amount: "1,250.00"}` (string) | **FAIL (unhelpful)** | yes | `amount must be a JSON number, not a string: send 4500.5, not "4,500.50" (no thousands separator, no currency symbol)` |
| P4 | `convert {amount: 1e308, to: "JPY"}` | **FAIL** | yes | `Error: that amount is too large to convert exactly ... The largest amount this handles is about 52206568450362 EUR.` Was: `"result": "JPY Infinity"`, `"result_number": null` |
| P5 | `convert {amount: -250.5}` | PASS | - | `USD -270.84` -- a negative amount is a credit note, converted and signed, not an error |
| P6 | `convert {amount: Infinity}` (JSON `null`) | PASS | - | refused at the schema |
| P7 | unknown `from` code `XYZ` | PASS | - | `"XYZ" is not in the ECB reference set. The ECB quotes N currencies: ...` |
| P8 | unknown `to` code `ZZZ` | PASS | - | same, naming the set |
| P9 | 4-letter code `EURO` | PASS | - | `from must be a 3-letter ISO code such as EUR` |
| P10 | `from === to` (`USD` -> `USD`) | PASS | - | `rate: 1`, `USD 1234.56`, no round trip through EUR |
| P11 | `date: "2026-13-45"` | PASS | - | `date must be YYYY-MM-DD, got "2026-13-45"` (also `2026-02-30`, P24) |
| P12 | `date: "1998-06-01"` (before the series, Pro) | PASS after fix | yes | `1998-06-01 is before the first ECB reference rate. The series starts on 1999-01-04.` See A-C3 for the partial-cache wording |
| P13 | `date` in the future | PASS | - | `2099-01-01 is in the future; the ECB has not published it yet.` |
| P14 | weekend date (nearest previous business day) | PASS | - | `requested_date` Sunday, `rate_date` the Friday, `exact: false`, `rule: "nearest previous business day..."`, and the note says *why* |
| P15 | `rate_history {days: 0}` | PASS | - | `Number must be greater than or equal to 1 at days` |
| P16 | `rate_history {days: 100000}` | PASS | - | `Number must be less than or equal to 20000 at days` |
| P17 | `rate_history {days: -5}` | PASS | - | same floor |
| P18 | `from_date` after `to_date` | PASS | - | `from_date 2026-09-03 is after to_date 2026-08-29.` |
| P19 | `convert_many {to: []}` | PASS | - | `Array must contain at least 1 element(s) at to` |
| P20 | `convert_many` with 3 good + 1 unknown code | PASS | - | 3 results plus `unknown_codes: ["ZZZ"]`; the bad code never silently vanishes |
| P21 | `fx_rates_for {target: "ZZZ"}` | PASS | - | named-set error |
| P22 | `rates_latest {base: "ZZZ"}` | PASS | - | named-set error |
| P23 | `date: ""` (empty string) | PASS (lenient, documented) | - | treated as omitted -> latest rate. Safe because every answer states its `rate_date`, so an empty date is never passed off as a specific past date |
| P25 | network down, warm cache | PASS | - | answers from cache, `isError: false`, note: `could not refresh the daily rates from the ECB (...); using the copy cached at 2026-09-02T17:11:42.865Z` **and** the `rate_date` |
| P26 | network down, cold cache | PASS | - | `Error: could not reach the ECB (fetch failed)`; the data dir is **empty** -- no partial file, no zero-rate cache |
| P27 | truncated history XML over a good cache | **FAIL (worst defect)** | yes | see below |
| P27b | garbage HTML body (`<html>503</html>`) over a good cache | PASS | - | `the ECB file held no dated rate block; the download was truncated or is not the eurofxref file` -- cache bytes unchanged |
| P28 | corrupt cache file (`{not json at all`) | PASS | - | quarantined to `daily.json.corrupt-<ts>`, marker `daily.json.corrupt` written, `Error: ... nothing was written. Delete <marker> to let the next call re-download it` |
| P29 | four processes, one data dir, simultaneous cold `convert` | PASS | - | four identical answers, **1** HTTP request, one `daily.json`, no `.tmp` left |
| P30 | stdout is JSON-RPC only | PASS | - | 0 non-JSON stdout lines across 5 tool calls + a resource read; the readiness line goes to stderr |
| P30 | no writes outside the data dir | PASS | - | after the same run the only files under `XDG_DATA_HOME` are `mcp-servers/currency/{daily,history}.json`; nothing anywhere else |

### The one that mattered: P27

`eurofxref-hist.xml` is newest-day-first, so a body that stops mid-stream is still **valid parseable
XML** -- it just holds the newest few days. Measured, before the fix: a 40-day cache was refreshed
from a truncated body and became a **3-day** cache. Nothing said so.

```
history days BEFORE refresh: 40   AFTER truncated refresh: 3
rate_history {days: 40} -> "business_days": 3, min/max/avg computed over 3 rows,
                           still labelled from_date 2026-07-25 to_date 2026-09-03
rate_on {date: 30 days ago} -> Error: 2026-08-04 is before the first ECB reference rate
                               (2026-09-01). The series starts on 1999-01-04.
```

Two separate wrongs: a 40-day min/max/average silently answered from 3 rows, and an error message
that contradicts itself in a single sentence. On the real 6 MB file the loss would be 27 years of
history, and the only symptom is a number that is quietly wrong.

Fix, `src/ecb.ts` + `src/rates.ts`:

- `assertComplete(xml)` -- the body must end with `</Envelope>` (any namespace prefix). That closing
  tag is the only in-band proof the download finished, and it is checked before parsing for both the
  daily and the history file.
- A monotonicity guard in `getHistory()`: the ECB series only ever grows, so a refresh that yields
  fewer days than the copy already on disk is a bad download, not a revision. It throws, and
  `readThrough` then falls back to the cache with an `offline_note`, exactly as for a dead network.
- `resolveDate()` no longer asserts 1999-01-04 as the start of a cache that does not reach back that
  far; it names the cache's own earliest date and says the cache is incomplete.

After: `history days BEFORE 40, AFTER 40`; `rate_on` 30 days back answers `exact: true`, and no rate
from the truncated body (`9.9999`) reaches any answer.

### Edits made

| File | Change |
|---|---|
| `src/ecb.ts` | `assertComplete()`; called in `getDaily()` and `getHistory()`; history shrink guard |
| `src/rates.ts` | `convertAmount()` refuses a non-finite amount and any result past `MAX_SAFE_INTEGER` minor units, naming the largest amount it can handle |
| `src/rates.ts` | `resolveDate()` stops quoting 1999-01-04 over an incomplete cache |
| `src/index.ts` | `AMOUNT` schema with an `invalid_type_error` that names the fix; used by `convert` and `convert_many` |
| `src/index.ts` | `rate_on` description states the ECB quoting convention (per 1 EUR) -- see D-C4 |
| `test/rates.test.mjs` | A-C1 overflow, A-C2 `assertComplete`, A-C3 partial-cache wording; the pre-existing 1999 assertion updated to the honest message |
| `test/smoke.test.mjs` | end-to-end: a truncated history download does not replace a good cache; overflow / string amount / negative amount over stdio |

---

## Part 2 -- user value through the claude CLI

All numbers below were verified independently against the cache files
`/private/tmp/cv1/data/mcp-servers/currency/{daily,history}.json` with a separate script, not by
re-reading the model's own output.

Ground truth from the cache (daily rate date **2026-09-02**):

```
EUR->USD 2026-09-02 1.1578    4500 EUR = 5210.10
EUR->USD 2026-08-03 1.1535    4500 EUR = 5190.75
250 GBP: PLN 5.03843 -> 1259.61 | USD 1.348317 -> 337.08 | JPY 215.185746 -> 53796
EUR/USD 2026-08-04..2026-09-02, 22 business days: min 1.1515 max 1.1699 avg 1.159491
2026-08-30 has NO row (Sunday); previous business day 2026-08-28, EUR->USD 1.1643
45 EUR at 1.1578 = USD 52.10
```

| # | Lane | Prompt | Score | Tool calls | ms | Outcome |
|---|---|---|---|---|---|---|
| 1 | A | "What is 4,500 EUR in USD right now, and what was it a month ago?" | **3** | 2 | 7894 | `convert {4500 EUR USD}` then `convert {..., date: "2026-08-03"}`. Answered **$5,210.10** at 1.1578 (rate date stated) and **$5,190.75** at 1.1535. Both verified exact against the cache; 2026-08-03 is a real published day, so no fallback was needed |
| 2 | A | "Convert 250 GBP to PLN, USD and JPY." | **3** | 1 | 7649 | One `convert_many`. **PLN 1,259.61 / USD 337.08 / JPY 53,796** -- all three exact, JPY correctly whole, rate date stated |
| 3 | A | "How did EUR to USD move over the last 30 days, min max average?" | **3** | 1 | 9027 | One `rate_history {days: 30}`. min **1.1515** (Aug 4), max **1.1699** (Aug 21), avg **1.1595**, 22 business days, +0.55%. All exact |
| 4 | A | "What was the ECB rate for USD on Sunday 2026-08-30?" | **2** | 1 | 6909 | `rate_on` returned the right date and rule; the model said *"The ECB doesn't publish rates on weekends -- 2026-08-30 was a Sunday. The last published rate before it was Friday 2026-08-28"*. The rule is stated correctly and the date is right. It called the pair as `USD -> EUR` and quoted **0.858885 EUR per USD** -- arithmetically correct but the reciprocal of the number the ECB actually publishes (1 EUR = 1.1643 USD). D-C4 |
| 5 | B | "Log a 45 EUR Amazon receipt for Nova, then rebill Nova in USD at today's ECB rate." | **3** | 3 | 20064 | `expense_add {45 EUR Amazon Nova}` -> `rate_on {EUR USD 2026-09-03}` -> `expense_to_invoice {target_currency: "USD", fx_rates: {EUR: 1.1578}}`. **The rate was never asked of the user**, and the model said out loud that 2026-09-03 has no rate yet so 2026-09-02 applies. Result **USD 52.10**, which is 45 x 1.1578 = 52.101 -> 52.10, verified against `daily.json`. It stopped at the preview and named `invoice_create` + `expense_mark_rebilled` as the next steps rather than inventing an invoice |

**Total: 14 / 15.**

The chained scenario, which is the reason this server exists, worked on the first attempt with no rate
typed by the user and no arithmetic done by the model.

### Defects

**D-C1 (high, fixed) -- `convert` emitted `Infinity` as money.**
Repro: `convert {amount: 1e308, from: "EUR", to: "JPY"}` returned `isError: false`,
`"result": "JPY Infinity"`, `"result_number": null`. A downstream invoice line would have taken
`null` as its amount. Fixed in `src/rates.ts`; `test/smoke.test.mjs` and `test/rates.test.mjs` assert it.

**D-C2 (high, fixed) -- a truncated history download silently replaced a good cache.**
Repro in `/private/tmp/curaudit/probe3.mjs`: warm a 40-day cache, age `fetched_at` past 24 h, serve a
body cut mid-stream. Before: the cache became 3 days and `rate_history {days: 40}` answered min/max/avg
over 3 rows without a word. Fixed by `assertComplete()` plus the shrink guard; `test/smoke.test.mjs`
covers it end to end.

**D-C3 (medium, fixed) -- a self-contradicting error over a partial cache.**
`2026-08-04 is before the first ECB reference rate (2026-09-01). The series starts on 1999-01-04.`
Both halves cannot be true. Now the message names the cache's earliest date and says the cache is
incomplete, with the remedy (`cache_status`, delete the cache).

**D-C4 (low, mitigated in the tool description) -- the model quoted the reciprocal rate.**
Repro: `/private/tmp/cv1/out/s4.jsonl`, `CALLS: mcp__currency__rate_on {"from":"USD","to":"EUR",...}`.
Asked for "the ECB rate for USD", the model chose `USD -> EUR` and answered 0.858885 rather than the
published 1.1643. The server answered exactly what it was asked, so this is a prompting defect, but it
is one the tool description can prevent: `rate_on` now states that the ECB quotes every currency per
1 euro and that "the ECB rate for USD" means `from: "EUR", to: "USD"`. Not re-measured after the edit.

**D-C5 (low, not fixed, client-side) -- every lane spent its first turn on `ToolSearch`.**
All five conversations opened with a `ToolSearch select:mcp__currency__...` call before any real work,
which is a fixed cost of the deferred-tool harness, not of this server. No action taken.

**Not a defect: a string amount.** `"1,250.00"` is refused by the schema rather than parsed. Parsing
it would mean guessing whether `1,250` is one thousand two hundred fifty or one and a quarter, which
differs by locale; the fix is a message that tells the caller exactly what to send. Scenario 5 shows a
model handed "45 EUR" in prose sends `45`, not `"45"`.

---

## Final test summary

```
$ npm run build -w servers/currency
> tsc -p tsconfig.json && node -e "import('node:fs').then(f=>f.chmodSync('dist/index.js',0o755))"
(no output, exit 0)

$ npm test -w servers/currency
1..26
# tests 26
# suites 0
# pass 26
# fail 0
# duration_ms 1160.078333
```

21 tests before this audit, 26 after: +3 unit (A-C1 overflow, A-C2 `assertComplete`, A-C3 cache
wording) and +2 stdio integration (truncated-history cache survival, amount limits over the wire).

---

## RESULT.md block

```
status: DONE

evidence:

$ npm test -w servers/currency
1..26  # tests 26  # pass 26  # fail 0  # duration_ms 1160.078333

Part 1, 30 probes over stdio against a fixture ECB (zero internet):
  27 PASS, 3 FAIL -> fixed (P3 string amount message, P4 1e308 -> "JPY Infinity",
  P27 truncated history XML replacing a good cache).
  network down + warm cache -> answers from cache, states the cache timestamp and the rate date.
  network down + cold cache -> clean error, data dir empty.
  corrupt cache -> quarantined to daily.json.corrupt-<ts> + marker, nothing overwritten.
  4 processes / 1 data dir / simultaneous cold convert -> 1 HTTP request, 4 identical answers.
  stdout: 0 non-JSON lines. Filesystem: only <XDG_DATA_HOME>/mcp-servers/currency/{daily,history}.json.

Part 2, claude CLI (sonnet, per-tool allowlist, fresh XDG dirs), 5 scenarios, 14/15:
  4500 EUR -> USD now and a month ago      3/3  5210.10 @1.1578 and 5190.75 @1.1535
  250 GBP -> PLN, USD, JPY                 3/3  1259.61 / 337.08 / 53796 (JPY whole)
  EUR/USD 30 days min max avg              3/3  1.1515 / 1.1699 / 1.1595 over 22 business days
  ECB rate for USD on Sunday 2026-08-30    2/3  right date (Fri 2026-08-28) + rule, reciprocal pair
  expense-tracker chain, 45 EUR -> USD     3/3  expense_add -> rate_on -> expense_to_invoice,
                                                USD 52.10, no rate typed by the user
  Every number re-derived from daily.json / history.json by a separate script.

artifacts:
- servers/currency/src/{ecb.ts,rates.ts,index.ts}
- servers/currency/test/{rates,smoke}.test.mjs
- docs/CURRENCY_AUDIT.md
- /private/tmp/curaudit/probe{,2,3}.mjs, /private/tmp/cv1/out/s{1,2,3,4}.jsonl, /private/tmp/cv2/out/s5.jsonl

cost: 30 wall minutes.

failures:
- convert {amount: 1e308} returned isError false with "result": "JPY Infinity" and
  "result_number": null. Fixed: refused past MAX_SAFE_INTEGER minor units, naming the ceiling.
- A truncated eurofxref-hist.xml still parses, because the file is newest-day-first, so a
  dropped connection replaced a 40-day cache with a 3-day one and rate_history answered a
  40-day min/max/average from 3 rows, silently. Fixed: assertComplete() requires the closing
  </Envelope>, and a refresh holding fewer days than the cache is refused as a bad download.
- resolveDate said "before the first ECB reference rate (2026-09-01). The series starts on
  1999-01-04" - two claims that cannot both be true. Fixed to name the cache's own earliest date.

insight:
The failure mode that mattered is not the one that throws. Every probe that produced malformed
input - bad codes, bad dates, days 0, days 100000, a dead network, a corrupt file - was already
handled, because those paths announce themselves. The one that got through was a download that
succeeded: HTTP 200, valid XML, correct schema, parses clean, 3 days instead of 7084. The ECB
history file is newest-first, so truncation removes the OLD end, which means the newest rate
stays right and only the past goes missing - the caller sees a plausible answer to the question
they asked. Only two out-of-band facts catch it: the closing tag, and the knowledge that a
published rate series can never shrink.
```

Built by theluckystrike.

---

## Codex v4 fixes

Date 2026-09-03. Scope `servers/currency` only. Items 1, 2 and 3 of `docs/CODEX_REVIEW_V4.md`.
Zero paid API calls; every test is served by a local fixture HTTP server over `ECB_BASE_URL`.

### 1 -- conversion rounded the rate before it multiplied

`convertAmount` multiplied by the 6-decimal cross rate, so any pair whose rate is far from 1 lost
significant digits before the amount was touched. `crossRate(30000, 0.35)` is `0.000012`, and
1,000,000 VND therefore converted to KWD 12.000 instead of KWD 11.667 -- 2.9% of the money.

- [servers/currency/src/money.ts:78](servers/currency/src/money.ts#L78) -- new `exactCrossRate(fromPerEur, toPerEur)` returns `toPerEur / fromPerEur` unrounded.
- [servers/currency/src/money.ts:88](servers/currency/src/money.ts#L88) -- `crossRate` now wraps it and is documented as display only.
- [servers/currency/src/rates.ts:42](servers/currency/src/rates.ts#L42) -- the multiplier is `exactCrossRate(fr, tr)`; the only rounding left in the path is the final one to the target's ISO 4217 minor units.
- [servers/currency/src/rates.ts:22](servers/currency/src/rates.ts#L22), [servers/currency/src/rates.ts:52](servers/currency/src/rates.ts#L52) -- `Conversion` carries both: `rate` (6 decimals, display) and `rate_exact` (the multiplier).
- [servers/currency/src/index.ts:147](servers/currency/src/index.ts#L147), [servers/currency/src/index.ts:178](servers/currency/src/index.ts#L178), [servers/currency/src/index.ts:309](servers/currency/src/index.ts#L309) -- `convert`, `convert_many` and `rate_on` report the displayed rate and the exact rate separately, with a `rate_note` saying which one the arithmetic used.
- [servers/currency/README.md:121](servers/currency/README.md#L121) -- the "reference rates" section restated; the old claim that the printed 6-decimal rate is the multiplier is removed.

Tests: [servers/currency/test/precision.test.mjs:15](servers/currency/test/precision.test.mjs#L15) (the KWD 11.667 case, including the assertion that the 6-decimal rate would have produced 12.000),
[servers/currency/test/precision.test.mjs:38](servers/currency/test/precision.test.mjs#L38) (EUR -> USD -> PLN equals EUR -> PLN, to the minor unit and at the rate level),
[servers/currency/test/precision.test.mjs:53](servers/currency/test/precision.test.mjs#L53) (the same chain through the rounding-hostile VND leg).

### 2 -- the fetch deadline stopped at the headers and the lock expired under it

The abort timer was cleared as soon as the response headers arrived, so a body that stalled was
unbounded, while the refresh lock leased 60 s. A stalled download therefore lost its lock, a second
process refreshed, and the first response landed last and overwrote the newer cache.

- [servers/currency/src/ecb.ts:106](servers/currency/src/ecb.ts#L106) -- `fetchText(url, totalTimeoutMs)` arms one `AbortController` before the request and clears it in a `finally` after the last byte; connect, headers and body all run against the one deadline, and an abort during body reads is reported as a timeout rather than a network error.
- [servers/currency/src/ecb.ts:23](servers/currency/src/ecb.ts#L23) -- `HISTORY_TIMEOUT_MS = 60_000` for the ~6 MB history; the daily file keeps `TIMEOUT_MS = 20_000`.
- [servers/currency/src/ecb.ts:43](servers/currency/src/ecb.ts#L43) -- `LOCK_TIMEOUT_MS` raised to 90_000 so the lease outlasts the longest body deadline, with a load-time check at [servers/currency/src/ecb.ts:44](servers/currency/src/ecb.ts#L44) that fails the module rather than shipping the inversion again.
- [servers/currency/src/ecb.ts:238](servers/currency/src/ecb.ts#L238) -- a daily download whose rate date is older than the cached one is refused as a stale response.
- [servers/currency/src/ecb.ts:262](servers/currency/src/ecb.ts#L262) -- the existing shrink guard (fewer rate days) is extended with a newest-date guard: a history whose latest day is before the cache's latest day is refused. Both guards read the cache inside the lock, immediately before the write.

Tests: [servers/currency/test/guards.test.mjs:29](servers/currency/test/guards.test.mjs#L29) (headers sent, body stalls forever: the fetch aborts on the total deadline instead of hanging),
[servers/currency/test/guards.test.mjs:50](servers/currency/test/guards.test.mjs#L50) (`LOCK_TIMEOUT_MS >= HISTORY_TIMEOUT_MS`),
[servers/currency/test/guards.test.mjs:61](servers/currency/test/guards.test.mjs#L61) (a download with the same day count but an older newest day is refused, the file on disk still reaches the newer day, and the caller is told why).

### 3 -- every cache miss was labelled a weekend

`ratesForDate` printed "weekend or TARGET holiday" for any inexact date, including a weekday that
was missing only because the cache had not been refreshed that far.

- [servers/currency/src/ecb.ts:220](servers/currency/src/ecb.ts#L220) -- `latestDay(days)` exported.
- [servers/currency/src/index.ts:115](servers/currency/src/index.ts#L115) -- the answer states whether this call refreshed, attempted a refresh and failed, or did not attempt one because the cache is under 24 h old.
- [servers/currency/src/index.ts:123](servers/currency/src/index.ts#L123) -- a date after the cache's newest day now reads "No rate published yet in the cache for YYYY-MM-DD (latest YYYY-MM-DD)" plus that refresh status. Only a gap inside the cached range is still called a weekend or TARGET holiday.

Tests: [servers/currency/test/guards.test.mjs:130](servers/currency/test/guards.test.mjs#L130) -- one spawned server, one fixture history that ends two days before today and has a hole three days back: the out-of-range date gets the cache-miss wording and the refresh status, the in-range hole still gets the weekend wording, and a repeat call on a fresh cache reports that no refresh was attempted.

### Verification

`npm run build` clean. `npm test` in `servers/currency`, verbatim summary:

```
# tests 35
# suites 0
# pass 35
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1136.43825
```

`node scripts/validate.mjs`, verbatim tail:

```
docx: 16/16 in 413 ms
timezone: 16/16 in 287 ms
currency: 16/16 in 3730 ms
expense-tracker: 22/22 in 416 ms
time-tracker: 24/24 in 229 ms
price-tracker: 18/18 in 280 ms
spreadsheet: 18/18 in 393 ms
invoice: 20/20 in 441 ms
remote: 20/20
billing: 14/14
validation db: /Users/mike/mcp-servers/data/validation.json run 50: 184/184
```

insight:
The 6-decimal cross rate was introduced so a user could check the arithmetic by hand, and that is
exactly what made it wrong: the number that is easiest to read is not the number that must be
multiplied. The error is invisible on the pairs anyone tests -- USD/PLN is off by 5 parts in
10 million -- and only appears where the rate is nowhere near 1, which is where the ECB set is
widest (VND at 30,000 per EUR, KWD at 0.35). A display value and a multiplier are two different
numbers and the answer has to carry both.
