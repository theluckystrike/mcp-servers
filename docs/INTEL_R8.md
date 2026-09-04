# INTEL_R8 -- registry findable share reprobe, release-check re-sync, zip compare waiver cleared, distribution registry-name rows

Measured 2026-09-04. Cap: 35 wall minutes, zero paid APIs, no paid submissions, no
background jobs, no Monitor. Every registry request was `curl -s -m 20` inline inside a
bounded shell loop, 102 requests total (under the 110 cap).

## 1. Registry findable share -- full live reprobe

`data/kpi.json`'s "Registry findable share" row read 41 (a `data/organic.json` estimate
carried over from the R3 round, which admitted in its own evidence text that "a precise
global recount was out of the 20-minute budget"). This round did the recount.

Probed the 97-token set from `docs/NAMING_R4_RESULT.md` (66 tokens tracked in
`data/organic.json` servers[].query_set at the time plus the 38 new tokens named in that
round's brief, de-duplicated) plus `zip`, `archive`, `compress`, `qr-code` (`compress`
already inside the 97) -- 100 distinct tokens, each probed once via
`GET .../v0/servers?search=<token>&limit=100`.

- Matched: 74 of 100
- Findable share (NAMING_R4 formula: p = min(1, 10/our_rank) if matched on page 1 else
  0, mean over all 100 tokens): **51.26%**

Stored in `data/registry_rank.json` under `variants_r4_full_probe` (method, per-token
`results`/`our_rank`, and `names_held_per_server`). `data/organic.json`'s "Official MCP
registry (API)" surface `findable`/`score` fields were updated from the estimated
0.4107/41.1 to the measured 0.5126/51.3 so `node scripts/kpi.mjs` reads the real number:

```
$ node scripts/kpi.mjs
kpi: 24 indicators, 10 met, 0 unmeasured

data/kpi.json -> "Registry findable share": { "value": 51, "target": 60, "unit": "% of tracked tokens" }
```

51% is still short of the 60% target; the remaining gap is the same as R4 found --
high-competition single-word tokens capped at 100 results and generic multi-hundred-
result tokens no single server can honestly claim.

## 2. `docs/RELEASE_CHECK.md` -- open-gap table was stale by ten rows

The table was dated 2026-09-04 but described 11 open gaps (spec + contract for
bank-statement, calendar, image, kanban, pdf -- 10 rows -- plus compare/zip). A live run
found only 1:

```
$ node scripts/release-check.mjs
release-check: green (1 recorded gap(s))
  zip  compare: no entry  [waived: ...]
```

`scripts/gen-spec.mjs`'s `CURATED` table had been extended to cover all 19 servers since
the doc was last written by hand, closing the 10 spec/contract rows without anyone
updating the prose. The doc now states the live result (0 gaps after part 3 below) instead
of a hand-maintained table that can drift from the script that actually decides.

## 3. `compare`/zip waiver cleared honestly, self-expiring

`docs/CONTENT_R12_RESULT.md` already recorded a dated, sixteen-term registry search that
found no genuine `.zip`-container competitor. Rather than add a static `WAIVERS` row
(which never re-checks itself and would excuse the gap forever) or invent a comparison
page against a competitor that does not exist, `scripts/release-check.mjs`'s `compare`
check now also accepts a `compare_none` note in `data/facts.json`:

```json
"compare_none": {
  "zip": {
    "date": "2026-09-04",
    "tokens": ["zip", "archive", "compress", "unzip", "tar", "gzip", "7z", "decompress",
      "file compression", "extract", "zip file", "zip archive", "archiver", "unpack",
      "inflate", "deflate", "file archive", "tarball"],
    "guide": "zip-archives-safely-from-chat",
    "ttl_days": 30
  }
}
```

The check accepts the note for 30 days from its `date`; past that it fails again with an
explicit "expired, re-probe the registry for a competitor" message, so a competitor that
shows up later does not stay silently excused. `WAIVERS` in `scripts/release-check.mjs` is
now `[]`.

**Control test:** backdated a scratch copy of `compare_none.zip.date` to 2026-01-01 (246
days old) -- `release-check` failed with `compare_none note expired (246d old, >30d;
re-probe the registry for a competitor)`, exit 1. Restored the real date -- green again,
exit 0.

```
$ node scripts/release-check.mjs
release-check: green (0 recorded gap(s))
```

## 4. `data/distribution.json` -- missing `registry-name` rows

Ten servers from the `NAMING_R4` round (spreadsheet, image, clauses, bank-statement,
docx, timezone, recurring, quotes, resume, kanban) already carried a populated
`per_server.<x>.registry-name` row. Seven did not, even though each holds a second
published registry name via `servers/<x>/server.variant.json` (the source of truth):

| server | registry-name added |
| --- | --- |
| time-tracker | io.github.theluckystrike/timer-tracking |
| price-tracker | io.github.theluckystrike/prices-deal |
| invoice | io.github.theluckystrike/invoices-invoicing |
| expense-tracker | io.github.theluckystrike/expenses |
| currency | io.github.theluckystrike/exchange-fx |
| calendar | io.github.theluckystrike/availability |
| pdf | io.github.theluckystrike/pdfs |

Each was verified against its own `server.variant.json` `name`/`version` fields (all
0.9.1) before writing `"published 0.9.1 (<name>)"` into `data/distribution.json`.

## Files

- `data/registry_rank.json` (+`variants_r4_full_probe`)
- `docs/RELEASE_CHECK.md` (open-gap table rewritten to the live result)
- `scripts/release-check.mjs` (`compare` check reads `data/facts.json` `compare_none`,
  `WAIVERS` emptied)
- `data/distribution.json` (7 `registry-name` rows added, `updated_at` bumped)
- `data/intel_r8.json`, `docs/INTEL_R8.md` (this file)

## RESULT.md schema block

```
status: DONE
evidence: Probed 100 tokens (the 97-token NAMING_R4 set plus zip/archive/compress/qr-code)
  live via bounded curl GETs; 74 matched, findable share 51.26% (data/registry_rank.json
  variants_r4_full_probe). node scripts/kpi.mjs now reports "Registry findable share":
  value 51 (was 41, a stale estimate). node scripts/release-check.mjs: 19 servers x 25
  checks, 0 recorded gaps, exit 0 -- docs/RELEASE_CHECK.md's open-gap table (stale by ten
  spec/contract rows) rewritten to match. compare/zip waiver cleared via a self-expiring
  data/facts.json compare_none note (30-day TTL, control-tested to fail after expiry and
  pass within it) instead of a static waiver or an invented comparison page; WAIVERS is
  now empty. data/distribution.json: 7 missing per_server.<x>.registry-name rows added
  (time-tracker, price-tracker, invoice, expense-tracker, currency, calendar, pdf), each
  sourced from that server's own server.variant.json manifest.
artifacts: data/registry_rank.json, docs/RELEASE_CHECK.md, scripts/release-check.mjs,
  data/distribution.json, data/intel_r8.json, docs/INTEL_R8.md
cost: 102 curl requests (curl -s -m 20, no background jobs, no Monitor); zero paid APIs;
  zero paid submissions
failures: none blocking; 2 of the 100 curl responses needed a one-off re-fetch after a
  JSON parse error (a stray non-ASCII escape and one empty body), both resolved before the
  findable-share computation
insight: the release-check doc had drifted from the script it describes -- the script
  itself already reflected the true state (gen-spec.mjs's CURATED table had grown to cover
  all 19 servers); only the hand-written prose table was stale. A self-expiring fact note
  beats a static waiver for a "no competitor exists" claim because the claim has a shelf
  life the checker can enforce without a human remembering to revisit it.
```
