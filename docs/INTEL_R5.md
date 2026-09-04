# INTEL_R5 -- naming slots for image / bank-statement, plus next three candidates

Measured 2026-09-04. Cap: 20 wall minutes, zero paid APIs.

## A. Slot re-measurement -- image, bank-statement

Bounded single-request probe per task spec: one `GET
registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100`, 20s timeout, no
pagination beyond the first page. Count = `servers.length`; flagged `100+` where the page
was full and `metadata.nextCursor` was present (confirmed present for both `image` and
`bank`).

### image (resize, convert, crop, compress, watermark; pure JS)

| token | hits |
|---|---|
| image | 100+ (nextCursor: io.github.pvliesdonk/image-generation-mcp) |
| convert | 71 |
| photo | 55 |
| compress | 14 |
| resize | 3 |
| image-resize | 3 |
| thumbnail | 2 |
| photo-resize | 0 |
| image-compress | 0 |
| image-convert | 0 |
| image-watermark | 0 |
| photo-editor | 0 |

`thumbnail` (2) is the rarest single token measured. Four compound tokens
(photo-resize, image-compress, image-convert, image-watermark) are fully empty but read
poorly as standalone name segments, so the proposed name blends rarity with a natural,
word-rich phrase rather than a strict ascending sort.

**Proposed registry name:** `io.github.theluckystrike/image-resize-thumbnail-compress-photo-convert`
(45 chars)

### bank-statement (CSV import, categorise by rules, reconcile, monthly summary)

| token | hits |
|---|---|
| bank | 100+ (nextCursor: io.github.luke-fairbanks/broll) |
| ledger | 94 |
| budget | 47 |
| cash | 32 |
| statement | 23 |
| bank-statement | 6 |
| transactions | 7 |
| reconcile | 4 |
| categorize | 0 |
| statement-import | 0 |
| expense-categorize | 0 |
| bank-reconcile | 0 |
| cash-ledger | 0 |
| transaction-categorize | 0 |

`categorize` (0 hits, and 0 across every compound tried) is the rarest word measured this
round across both servers -- notably rarer than `clause` (R4's rarest at 2).

**Proposed registry name:** `io.github.theluckystrike/bank-statement-categorize-reconcile-transactions-ledger`
(55 chars)

### Free / Pro split

- **image**: free = resize/convert/crop, single file, up to 5 ops/session. Pro = unlimited
  ops, batch (multi-file), watermark, compress presets, chained ops (resize+convert+
  watermark in one call).
- **bank-statement**: free = CSV import + monthly summary, one account, manual
  categorize. Pro = rule-based auto-categorize, multi-account, reconcile against the
  expense-tracker/invoice servers' records, unlimited history.

## B. Next three candidates (from the R4 list minus taken)

Pool: kanban/todo, flashcards, quote/estimate, unit converter, markdown-to-html/pdf, csv
cleaner, habit tracker, notes/journal, password generator, qr code. All nine already carry
full registry/Smithery/npm/GitHub instrument readings from R1 (`docs/INTEL.md`) or R4
(`docs/INTEL_R4.md`); none of those tokens were touched by any naming publish since, so
this round reuses those measured fit scores rather than re-running an unchanged
instrument a third time -- the same carry-forward policy R4 itself used for R1's
unchanged intents. Password generator stays excluded (not buildable: secret-custody
liability, R1).

| rank | intent | score | worst-case | pairs | local value | fit | source |
|---|---|---|---|---|---|---|---|
| 1 | kanban / project todo | 38.5 | 11.49 | 0.5 | 1.0 | 19.25 | R4 |
| 2 | quote / estimate generator | 15.0 | 4.46 | 0.9 | 0.9 | 12.1 | R4 |
| 3 | notes / journal | 22.7 | 6.78 | 0.5 | 1.0 | 11.3 | R4 |

Remaining, not picked: markdown-to-html/pdf (9.57, R1), qr code (7.62, R1), habit tracker
(6.97, R1), unit converter (6.55, R1), csv cleaner/dedupe (5.3, R4), flashcards (4.5, R4).

Caveats carried from source rounds: kanban's github count (433) signals crowding the
formula doesn't weight; quote/estimate's `quote` token is crowded by unrelated
crypto/finance servers but pairs strongly with the shipped invoice server; notes/journal
duplicates R1's weak-pairing finding for note-taking (pairs 0.5, same as kanban).

## Failures / caveats

- No fresh Smithery/npm/GitHub calls were run for Part A -- the task specified registry
  search only, bounded to one request per token, for slot/naming purposes, not a full
  fit re-score (image and bank-statement are already committed builds, not candidates
  being ranked).
- Part B intentionally reuses prior-round fit numbers rather than re-measuring; if any of
  the nine tokens were touched by an unlogged registry publish between R4 (2026-09-03)
  and today, those numbers could be stale. No such publish is recorded in
  `docs/NAMING_R2_RESULT.md` or `data/registry_rank.json` for these tokens.

## RESULT.md schema block

```
status: DONE
evidence: Part A -- 14 single-page registry probes (image/resize/thumbnail/compress/
  photo/convert/bank/statement/transactions/categorize/reconcile/budget/ledger/cash) plus
  12 compound-token probes, 20s timeout each; categorize=0 (rarest word this round,
  rarer than R4's clause=2); thumbnail=2 rarest for image. Part B -- 3 candidates picked
  by fit from 9 unscored-since-R4 intents, reusing R1/R4 instrument readings (no token
  drift since last publish).
artifacts: docs/INTEL_R5.md, data/intel_r5.json
cost: under 20 wall minutes (hard cap)
failures: none; Part B intentionally not re-instrumented, see caveats above
insight: image and bank-statement both have a fully clean word available (thumbnail=2,
  categorize=0) despite their head tokens (image, bank) being saturated 100+; the
  word-rich compound name captures the clean word while staying readable, the same
  pattern R4's contract-clause-library and R2's expenses/invoices variants used.
```
