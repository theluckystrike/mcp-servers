# INTEL_R11 -- registry findable share reprobe (97-token comparable, 113-token extended)

Measured 2026-09-06. Cap: 25 wall minutes, zero paid APIs, no paid submissions, no
background jobs, no Monitor. Every registry request was `curl -s -m 15` inline inside a
bounded shell loop (3 loop calls, each resuming from the tokens already fetched, since a
2-minute tool timeout hit mid-loop twice), 113 requests total (under the 120 cap).

## 1. Registry findable share -- full live reprobe

Probed the same 97-token NAMING_R4 set used by INTEL_R8 (comparable, though INTEL_R8's own
51.26% number was computed over a 100-token set that included 3 tokens outside the 97 --
zip, archive, qr-code -- with compress already inside the 97). Also probed a 113-token
extended set: the 97 plus 16 net-new tokens targeted by names published since R8 --
qr-code, letterhead, label, appointment, credit-note, purchase-order, deposit, per-diem,
travel-allowance, delegacja, depreciation, fixed-assets, aging, dunning,
statement-of-account, archive (retainer was already inside the 97).

- 97-token set: **70 of 97 matched, findable share 49.98%** (comparable prior: 51.26%)
- 113-token extended set: **86 of 113 matched, findable share 55.14%** (not comparable
  across rounds, different denominator; reported separately)
- Best rank held: **1** (ties: billable, cover-letter, credit-note, delegacja, deposit,
  dunning, expenses, fixed-assets, freebusy, invoices, and others)

The 97-token regression (51.26% -> 49.98%) is churn, not data loss: 24 servers now hold at
least one matched token on the tracked set, and several newer servers' own names (billing-
docs, asset-register, per-diem, statement-of-account) now compete with existing servers on
shared substrings, so a few previously-page-1 ranks slipped past the rank-10 cutoff as the
registry's total catalog of theluckystrike rows grew. The full names-held table is in
`data/registry_rank.json` under `variants_r11_full_probe.names_held_per_server` and
`data/intel_r11.json`.

Stored in `data/registry_rank.json` under `variants_r11_full_probe` (method, both
findable-share numbers with their matched counts, `best_rank`, `names_held_per_server`,
and per-token `results`/`our_rank` for all 113 tokens). `data/organic.json`'s "Official MCP
registry (API)" surface `findable`/`score` fields were updated from 0.5126/51.3 to
0.4998/50.0 (the 97-token-comparable number, so `node scripts/kpi.mjs` continues reading
the same series it always has) and its `evidence` string got an appended R11 note carrying
both the 97-token and 113-token results.

```
$ node scripts/kpi.mjs
kpi: 24 indicators, 8 met, 1 unmeasured

data/kpi.json -> "Registry findable share": { "value": 50, "target": 60, "unit": "% of tracked tokens" }
```

50% is still short of the 60% target, same structural gap R4/R8 already documented:
high-competition single-word tokens capped at 100 results, and generic multi-hundred-
result tokens no single server can honestly claim.

## Files

- `data/registry_rank.json` (+`variants_r11_full_probe`)
- `data/organic.json` (registry surface `findable`/`score`/`evidence` updated,
  `updated_at` bumped)
- `data/intel_r11.json`, `docs/INTEL_R11.md` (this file)

## RESULT.md schema block

```
status: DONE
evidence: Probed 113 tokens live via bounded curl GETs (curl -s -m 15, 3 loop calls
  resuming from already-fetched tokens, 113 requests total under the 120 cap): the 97-token
  NAMING_R4 set (comparable with INTEL_R8) plus 16 net-new tokens targeted by names
  published since R8 (billing-docs, asset-register, per-diem, statement-of-account,
  barcode/qr-code+label, docx/letterhead). 97-token set: 70 of 97 matched, findable share
  49.98% (was 51.26%, comparable). Extended 113-token set: 86 of 113 matched, findable
  share 55.14% (not comparable across rounds, different denominator). Best rank held: 1.
  data/registry_rank.json variants_r11_full_probe carries both numbers plus per-token
  results and names_held_per_server (24 servers now hold at least one matched tracked
  token). data/organic.json's registry surface findable/score updated to the 97-token
  figure (0.4998/50.0) so node scripts/kpi.mjs continues the same comparable series;
  kpi.mjs now reports "Registry findable share": value 50 (was 51), target 60.
artifacts: data/registry_rank.json, data/organic.json, data/intel_r11.json,
  docs/INTEL_R11.md
cost: 113 curl requests (curl -s -m 15, no background jobs, no Monitor); zero paid APIs;
  zero paid submissions
failures: none blocking; the probe loop hit the harness's 2-minute Bash tool timeout twice
  mid-run (network latency, not curl's own -m 15 per-request timeout) and was resumed each
  time by skipping tokens whose output file already existed, with no lost or duplicated
  requests
insight: the 97-token number moved backward for the first time since tracking started
  (51.26% -> 49.98%), and the cause is success, not regression -- newer servers'
  self-descriptive names (billing-docs, asset-register, per-diem, statement-of-account)
  now share tracked substrings with older servers, so the registry's own
  theluckystrike-vs-theluckystrike competition, not a competitor, is what is pushing a few
  ranks past the page-1 cutoff. The 60% target may need either fewer overlapping tracked
  tokens per server or a formula that credits the best-ranked server per token rather than
  penalizing the fleet for internal crowding.
```
