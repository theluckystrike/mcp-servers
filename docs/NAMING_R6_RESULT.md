# NAMING_R6_RESULT.md -- registry name variants, round 6, 2026-09-05

status: DONE (3 new variants published from 12 INTEL_R9 candidates, all confirmed live)

## Input

`docs/INTEL_R9.md` listed 12 variant-name candidates for existing servers: tokens
already uncapped (under 100 results on the registry search API) and each pre-mapped
to one existing server. This round probed, honesty-checked, and published from that
list, following the `NAMING_R4_RESULT.md` recipe: stdio-only `servers/<x>/server.<token>.json`
manifests at version 0.9.4, reusing the exact same GitHub release asset URL and
`fileSha256` as that server's own `server.mcpb.json` at 0.9.4, published via
`mcp-publisher login github -token "$(gh auth token)"` then `yes y | mcp-publisher publish`.

## Honesty filter

The brief's explicit rule: publish a name only where the server's tools genuinely do
the thing. Signature/e-sign are skipped outright, since no server in the estate signs
or e-signs anything. Escrow is skipped unless invoice truly tracks escrow, which it
does not (invoice only records payments and overdue status, not held funds released
on a milestone).

| token | count | mapped server | decision | reason |
|---|---|---|---|---|
| letterhead | 28 | docx | **PUBLISH** | doc_create/business_set literally print a business letterhead (name, email, logo, brand colour) on proposals/contracts/letters -- "letterhead" is in the tool descriptions verbatim |
| label | 29 | barcode | **PUBLISH** | barcode_create/qr_create generate scannable labels for products and packages -- literal fit |
| appointment | 5 | calendar | **PUBLISH** | events_list/free_busy/conflicts/next_event operate on calendar appointments -- genuine fit |
| inventory | 13 | price-tracker | skip | price-tracker only watches prices (price_check, watch_add/list/remove, price_history); no stock/quantity/SKU tool exists |
| depreciation | 1 | expense-tracker | skip | expense-tracker logs expenses/receipts/mileage; no depreciation-schedule tool |
| signature | 6 | docx / clauses | skip | no server signs or e-signs anything (brief's explicit rule) |
| e-sign | 14 | docx / clauses | skip | same as signature, explicitly excluded by the brief |
| followup | 7 | recurring | skip | recurring generates due invoices and forecasts revenue; it does not chase or nudge clients about outstanding items |
| shipping | 15 | barcode | skip | barcode already used its one new name this round on `label` (max one per server); shipping also overstates barcode as a logistics tool |
| envelope | 3 | docx | skip | docx already used its one new name this round on `letterhead`; no envelope-printing capability exists distinct from document generation |
| escrow | 10 | recurring / invoice | skip | invoice has no held-funds/milestone-release tracking (brief's explicit rule) |
| refund | 4 | invoice | skip | invoice_mark_paid records payments only; no refund/credit-note tool exists on this server |

3 of 12 candidates cleared the honesty filter, one per server (max one new name per
server this round respected: docx, barcode, calendar each contributed exactly one).

## Before/after

| server | token | registry name | count before | rank before | count after | rank after |
|---|---|---|---|---|---|---|
| docx | letterhead | io.github.theluckystrike/letterhead | 28 | absent | 29 | 29 of 29 |
| barcode | label | io.github.theluckystrike/label | 29 | absent | 30 | 30 of 30 |
| calendar | appointment | io.github.theluckystrike/appointment | 5 | absent | 6 | 6 of 6 |

All 3 confirmed absent from page 1 before publishing, then confirmed present on
re-probe after publishing. Index lag on this round: `label` matched on the first
re-probe; `letterhead` and `appointment` needed a third attempt (roughly 40 seconds),
consistent with the documented 1-3 minute registry index lag.

## Findable share

Formula unchanged from NAMING_R4: `p = min(1, 10/our_rank)` if matched on page 1 else
0, mean over the tracked token set. This round's set is the NAMING_R4 97-token set
plus the 3 new tokens published here (100 tokens total).

NAMING_R4 published the 97-token aggregate share (49.77%) but not each token's
individual `p` value, so the pre-existing 97-token sum is reconstructed from that
published aggregate (49.77% x 97 ~= 48.28) rather than re-probed -- re-probing all 97
tokens would have used most of the 60-request budget and most of the 30-minute cap on
confirmation work already done in a prior round. The 3 new tokens were freshly probed
this round and their `p` values are exact:

- letterhead: rank 29 of 29 -> p = 10/29 = 0.3448
- label: rank 30 of 30 -> p = 10/30 = 0.3333
- appointment: rank 6 of 6 -> p = 10/6, capped at 1.0

- **Matched: 70 of 97 -> 73 of 100**
- **Findable share: 49.77% -> 49.96%** (reconstructed baseline + exact new-token contribution)

The gain is small in absolute percentage because all three new tokens landed at the
bottom of an alphabetically-sorted results page rather than in the top 10 -- letterhead
and label in particular sit in genuinely competitive 28-30-result fields where an
empty-slot advantage did not exist (these were picked for honesty of fit, not for
being uncontested, since INTEL_R9 only offered variant candidates in already-uncapped
but non-empty token pools).

## Files

- `servers/docx/server.letterhead.json` (new)
- `servers/barcode/server.label.json` (new)
- `servers/calendar/server.appointment.json` (new)
- `data/naming_r6.json`
- `data/distribution.json` (registry-name rows updated for docx, barcode, calendar)
- `docs/NAMING_R6_RESULT.md` (this file)

## RESULT.md schema block

```
status: DONE
evidence: Probed INTEL_R9's 12 variant-name candidates (each pre-mapped to an
  existing server, all with count < 100 on the registry search API). Applied the
  honesty rule from the brief: signature/e-sign skipped outright (no server signs
  anything), escrow skipped because invoice does not track held funds. 6 more skipped
  for the same reason (no genuine matching tool: inventory, depreciation, followup,
  refund) or the one-name-per-server cap (shipping, envelope, once barcode and docx
  had already used their one slot each on label and letterhead). 3 of 12 cleared the
  filter: docx/letterhead, barcode/label, calendar/appointment. All 3 confirmed
  absent from page 1 before publishing (curl -s -m 15, first page only) and present
  on re-probe after (1-3 retries, ~40s lag, matching the documented index-lag
  pattern). Published at version 0.9.4, stdio-only, reusing each server's existing
  v0.9.4 GitHub release asset URL and fileSha256 (no remotes[]).
artifacts: docs/NAMING_R6_RESULT.md, data/naming_r6.json, 3 new
  servers/<x>/server.<token>.json files, data/distribution.json registry-name rows
  updated for docx/barcode/calendar
cost: well under 30 wall minutes; 17 bounded registry GETs total (curl -s -m 15,
  sequential, no background jobs); zero paid APIs; zero paid submissions
failures: none; all probes and publishes succeeded on first or retried attempt within
  budget
insight: honesty was the binding constraint this round, not registry availability --
  9 of 12 candidates had an open, uncapped slot but only 3 had a server whose actual
  tools did the named thing without stretching. Two proposed capabilities (refund,
  depreciation, escrow) map cleanly onto the credit-note and asset-register servers
  INTEL_R9 already recommended building as new servers, confirming those gaps are
  real product gaps rather than naming opportunities on servers that already exist.
```
