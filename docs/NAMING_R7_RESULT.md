# NAMING_R7_RESULT.md -- registry name variants, round 7, 2026-09-05

status: DONE (0 new variants published; all 6 INTEL_R10 candidates fail the honesty rule)

## Input

`docs/INTEL_R10.md` listed 6 uncapped variant-name candidates left over from its scoring
table: fuel, parking, toll (mapped to expense-tracker), loan (unmapped), margin and
discount (mapped to quotes or invoice). This round probed each, then read the actual
tool code of `servers/expense-tracker/src/index.ts`, `servers/quotes/src/index.ts` and
`servers/invoice/src/index.ts` to apply the honesty rule before publishing anything.

## Method

One bounded `GET registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100`
per token, `curl -s -m 15`, first page only, `count = metadata.count`, same style as
prior rounds. 6 tokens probed, 6 registry requests used for the pre-check (well under
the 40-request cap), zero paid APIs.

## Honesty rule (from the brief, applied literally)

- **fuel / parking / toll**: honest for expense-tracker only if a category or tag
  exists specifically for them, not just a generic free-text field.
- **loan**: honest for nothing this estate ships.
- **discount**: honest for quotes/invoice only if a **line-level** discount field
  exists (not just a whole-document percent).
- **margin**: honest only if a margin (cost vs price, profit) is actually computed
  somewhere.

## Code check

- `expense-tracker`'s `expense_add` tool has one `category` field
  (`servers/expense-tracker/src/index.ts:184`), free text, described only by example
  ("software, travel, office"). There is no enum, no dedicated fuel/parking/toll
  category, and no tool logic keyed on any of those three words. `mileage_add` is a
  real, separate feature (distance x a regional per-km/mile rate from
  `MILEAGE_RATES` in `money.ts`), but it prices distance travelled, not fuel litres,
  parking tickets or toll charges -- it does not cover any of the three tokens.
- `quotes`' `itemSchema` (`servers/quotes/src/index.ts:97-109`) has `description`,
  `quantity`, `unit_price_minor`, `tax_rate` and `currency` per line -- no per-line
  discount field. `discount_percent` (`quote_create`/`quote_update`,
  `totalsFor`/`computeTotals`) is a single value applied uniformly to every line at
  the whole-quote level. `invoice/src/index.ts` has the identical shape: one
  `discount_percent` per invoice (line 449), no per-line discount.
- Neither `quotes` nor `invoice` records a cost field or computes cost-vs-price
  profit anywhere in either file -- only discount, tax and totals. No margin is ever
  computed.

## Decision table

| token | count | capped | mapped server | on page 1 before | decision | reason |
|---|---|---|---|---|---|---|
| fuel | 7 | no | expense-tracker | no | **skip** | category is generic free text, no fuel-specific field/tag |
| parking | 2 | no | expense-tracker | no | **skip** | same generic free-text category, no parking-specific field/tag |
| toll | 49 | no | expense-tracker | no | **skip** | same generic category, plus page 1 is mostly x402/crypto "toll" servers (weak signal) |
| loan | 9 | no | none | no | **skip** | brief's rule: honest for nothing we ship; the real gap is the not-yet-built amortization server INTEL_R10 recommends |
| margin | 8 | no | quotes / invoice | no | **skip** | no server computes a cost-vs-price margin anywhere |
| discount | 3 | no | quotes / invoice | no | **skip** | discount exists but only at the whole-quote/whole-invoice level, not per line -- fails the literal "line-level" test |

All 6 fail the honesty filter. **0 of 6 published this round.**

## Before/after

No registry state changed. All 6 counts were re-confirmed via `curl -s -m 15`
immediately before writing this result (fuel 7, parking 2, toll 49, loan 9, margin 8,
discount 3 -- all uncapped, all matching INTEL_R10 exactly, none showing a
theluckystrike entry on page 1). No re-probe after was needed since nothing was
published, so no `data/distribution.json` registry-name rows changed this round.

## Findable share

Unchanged from NAMING_R6 (49.96%, 73 of 100 tracked tokens matched on page 1): no new
tokens were added to the tracked set this round because nothing was published.

## Files

- `data/naming_r7.json` (new)
- `docs/NAMING_R7_RESULT.md` (this file)
- no new `servers/<x>/server.<token>.json` files
- no `data/distribution.json` changes (nothing published)

## RESULT.md schema block

```
status: DONE
evidence: Probed INTEL_R10's 6 uncapped variant candidates (fuel 7, parking 2, toll
  49, loan 9, margin 8, discount 3 -- all confirmed via curl -s -m 15, first page
  only, none showing a theluckystrike entry on page 1). Read the actual tool code of
  expense-tracker, quotes and invoice before deciding: expense-tracker's category
  field is generic free text with no fuel/parking/toll-specific category, tag or
  tool, so those three fail the honesty rule. loan maps to no server this estate
  ships (the brief's rule states this explicitly). quotes and invoice both have a
  discount_percent field but it is applied at the whole-quote/whole-invoice level,
  not per line item, failing the brief's literal "line-level discount field" test.
  Neither server computes a cost-vs-price margin anywhere, so margin fails too. All
  6 candidates skipped; 0 published.
artifacts: docs/NAMING_R7_RESULT.md, data/naming_r7.json; no new server manifest
  files; no distribution.json changes (nothing published this round)
cost: well under 25 wall minutes; 6 bounded registry GETs (curl -s -m 15, sequential,
  no background jobs); zero paid APIs; zero paid submissions
failures: none; all 6 probes succeeded on first attempt
insight: honesty remained the binding constraint, this round more severely than
  R6 -- every one of the 6 leftover uncapped candidates had an open registry slot
  (empty_slot_score was the reason INTEL_R10 flagged them at all) but none had a
  server whose tools genuinely, specifically did the named thing. The clean pattern:
  a single generic free-text field (category) or a single whole-document numeric
  field (discount_percent) is not the same as a dedicated capability, and the
  literal wording of the honesty rule (line-level, category/tag, computed) is
  precise enough to fail all 6 without ambiguity. The real fixes are new servers
  (amortization for loan, per-line discount support for quotes/invoice, dedicated
  fuel/parking/toll tracking for expense-tracker), not new names on existing ones.
```
