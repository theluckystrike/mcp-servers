status: DONE

evidence:

```
$ npm install                       # repo root, npm_config_cache=/Users/mike/.npm-cache-local
added 1 package, and changed 1 package in 325ms

$ npm run build -w servers/currency
> tsc -p tsconfig.json && node -e "import('node:fs').then(f=>f.chmodSync('dist/index.js',0o755))"
(no output, exit 0)

$ npm test -w servers/currency
1..21
# tests 21
# pass 21
# fail 0
# duration_ms 873.813665
```

Live check against the real ECB endpoint (one run, public files, no key), temp data dir:

```
convert 788 ms   {"amount":100,"from":"USD","to":"PLN","rate":3.736828,"rate_date":"2026-09-02",
                  "result":"PLN 373.68","rounding":"rounded to 2 decimal places ..."}
rate_history 3063 ms  EUR/USD 2026-08-04..2026-09-03, business_days 22, min 1.1515, max 1.1699,
                      avg 1.159491, change_pct 0.55
fx_rates_for 2 ms     {"EUR":1.1578,"GBP":1.348317} target USD, rate_date 2026-09-02
cache_status          daily.json 465 B; history.json 2,982,997 B, business_days 7084,
                      earliest 1999-01-04, latest 2026-09-02
```

The 2 ms on `fx_rates_for` is the cache: the network was touched once, by the first call.

Free/pro gate, measured in test/smoke.test.mjs:

```
rate_history {days:91} free -> isError false, "free tier reads 90 days", "mcp.zovo.one", no "rates":
rate_on {date: 400 days ago} free -> isError false, "older than the 90 days"
same two calls with a signed key -> business_days 4, exact true
```

artifacts:

- servers/currency/src/{index.ts,ecb.ts,rates.ts,store.ts,money.ts}
- servers/currency/test/{rates,smoke,corrupt,concurrency}.test.mjs
- servers/currency/{package.json,tsconfig.json,README.md,LICENSE,server.json,server.mcpb.json,smithery.yaml,Dockerfile,glama.json,llms-install.md}
- assets/currency-logo.png (400x400, 1769 bytes, monogram FX)

cost: 38 wall minutes.

failures:

- The refresh lock is held across the download and `withFileLock` defaults to a 5000 ms wait.
  eurofxref-hist.xml is 6 MB, so on a slow first fetch a second process would have thrown
  "timed out waiting for lock" instead of waiting. Fixed by passing timeoutMs 60000 on the
  refresh lock (ecb.ts LOCK_TIMEOUT_MS). The 30 s stale-reap still applies above that, and both
  writers use tmp+rename, so even a stolen lock leaves exactly one valid file.
- The history file carries `rate='N/A'` for a currency not quoted on a given day (legacy codes
  such as ROL). Parsed naively that becomes NaN and silently poisons a cross rate. The parser
  drops any value that is not finite and positive; test/rates.test.mjs asserts it.
- Fixture dates in smoke.test.mjs were first written as fixed 2026-09 dates, which would have
  aged out of the 90-day free window and turned green tests red weeks later. They are now
  generated relative to the clock at run time.

insight:

The four-process concurrency test measures something the lock was not obviously going to give:
`hits === 1`. Four servers sharing one data dir, all calling `convert` at the same instant against
an ECB that answers in 250 ms, produce exactly ONE HTTP request, because the loser of the lock
re-reads the cache inside the critical section and finds the winner's fresh copy rather than
re-downloading. Without that re-read it would be four downloads of a 6 MB file, and the cost is
one line. The second measured number: 7084 published rate days between 1999-01-04 and 2026-09-02,
against 10,104 calendar days - 30 percent of all dates have no ECB rate at all. A converter that
does not implement the nearest-previous-business-day rule is wrong on roughly three days in ten,
and wrong silently.
