# REGISTRY_VARIANTS_R2 — Next variant-name batch (manifests only)

STATUS: DONE

## Goal
Compute and PREPARE (not publish) the next variant-name batch: pick the top demand tokens not yet
covered by any existing theluckystrike registry name, and prepare variant manifests (manifests only —
no publish, no git push, no gh release, no wrangler, no bundle rebuild).

## Tokens chosen (top 3 uncovered demand tokens) with demand counts
Source: `data/token_demand_r1.json` (70 probed candidates, `rows[]`, sorted by `score`).
Coverage determined by live registry API `https://registry.modelcontextprotocol.io/v0/servers?search=<token>`
— a token is covered if any existing `io.github.theluckystrike/*` name contains the token substring.

| rank | token      | score  | demand_score | covered? | existing theluckystrike names |
|------|------------|--------|--------------|----------|-------------------------------|
| 1    | checklist  | 0.9769 | 0.9769       | YES      | checklist, onboarding-checklist-inspection-runs |
| 2    | itinerary  | 0.9261 | 0.9261       | NO       | none                          |
| 3    | glossary   | 0.8373 | 0.8373       | NO       | none                          |
| 4    | supplier   | 0.6768 | 0.6768       | YES      | supplier-list                 |
| 5    | readability| 0.644  | 0.644        | NO       | none                          |
| 6    | minutes    | 0.6396 | 0.6396       | NO       | none                          |
| 7    | renewal    | 0.6372 | 0.6372       | NO       | none                          |
| 8    | inventory  | 0.6137 | 0.9819       | NO       | none                          |
| 9    | changelog  | 0.592  | 0.7696       | NO       | none                          |
| 10   | gantt      | 0.5684 | 0.5684       | NO       | none                          |

**Top 3 uncovered demand tokens: itinerary (0.9261), glossary (0.8373), readability (0.644).**

## Existing coverage proof
Live registry API queries (search per token, parsed `x['server']['name']`):
- `?search=itinerary` → 0 rows, no theluckystrike name. Token uncovered.
- `?search=glossary` → 0 rows, no theluckystrike name. Token uncovered.
- `?search=readability` → 0 rows, no theluckystrike name. Token uncovered.
- (control) `?search=checklist` → 9 rows incl. `io.github.theluckystrike/checklist` and
  `io.github.theluckystrike/onboarding-checklist-inspection-runs` → covered.
- (control) `?search=supplier` → 9 rows incl. `io.github.theluckystrike/supplier-list` → covered.

## Candidate servers prepared (best 1-2: high demand token + existing built server whose tools fit)
- **itinerary (0.9261) → calendar server.** Calendar reads `.ics` exports: events in a window,
  free-busy, double bookings, export — an itinerary is a planned sequence of events, so the tools
  fit directly. New variant name `io.github.theluckystrike/itinerary-travel-plan-schedule-events`
  (contains the `itinerary` substring → findable on the token).
- **glossary (0.8373) → clauses server.** Clauses is a personal library of reusable items assembled
  into a real Word .docx — a glossary is a term/definition library, same shape. New variant name
  `io.github.theluckystrike/glossary-terms-definitions-library` (contains the `glossary` substring).
- readability (0.644) has no strong existing-server fit (no text-analysis server in the estate), so it
  is deferred to a later round rather than forced onto a mismatched codebase.

## Files changed (manifests only)
- `servers/calendar/server.itinerary.json` (NEW) — variant of calendar, name
  `io.github.theluckystrike/itinerary-travel-plan-schedule-events`, version 0.22.0, package
  `calendar.mcpb` (fileSha256 4af4dc56d5ca639d2965b7518e4d54e8ab43542e7f4b7386446874a40ad93c57).
- `servers/clauses/server.glossary.json` (NEW) — variant of clauses, name
  `io.github.theluckystrike/glossary-terms-definitions-library`, version 0.22.0, package
  `clauses.mcpb` (fileSha256 95359cd7ce95fb2d45385c04d9923e2257c62402257b7bf520f7bd17f96f298b).

Both follow the purchase-requisition variant pattern (server.<variant>.json): same version, same
package identifier + fileSha256, different `name`/`description`, and **NO `remotes` block** (per task
constraint; the pre-existing calendar/clauses `server.variant.json` files carry a remotes block and
were left untouched).

## Verification
- Both new files JSON-validated (`python3 -c "import json;json.load(...)"` → OK) and write_file lint
  reported `status: ok`.
- Version matches current release: `servers/office-suite/package.json` version **0.22.0**; all 47
  `servers/*/server.json` use 0.22.0. New variants use 0.22.0.
- New variant names confirmed free in the registry (`?search=itinerary-travel-plan-schedule-events`
  and `?search=glossary-terms-definitions-library` → no matches).
- `scripts/validate.mjs` is a live server validator (spawns dist/index.js, runs tool calls) — not a
  manifest validator, and it requires rebuilt bundles (forbidden this round). Manifest JSON validation
  above is the applicable check.

## Exact publish command for the orchestrator
Run from repo root `/Users/mike/mcp-servers` (orchestrator only — do NOT run here):
```
node scripts/registry-publish-all.mjs
```
This publishes all manifests (including the two new variants) to the registry. No bundle rebuild is
needed: the variants point at the already-released `calendar.mcpb` and `clauses.mcpb` v0.22.0.

## Cost
Two registry API probes per token (coverage + name-free check) + two JSON validations. No paid API,
no network call in shipped code, no bundle rebuild.

## Failures
None. `scripts/validate.mjs` is not applicable to manifest-only changes (it validates live server
behaviour and needs rebuilt dist bundles, which are out of scope this round); JSON validation was used
instead.

## Insight
The variant-name lever is cheap and compounding: one codebase (calendar) is findable on `calendar`,
`ics`, `events`, `freebusy`, `conflicts`, `availability` — and now `itinerary`, `travel`, `plan`,
`schedule`. Registry search matches the NAME substring only, so each extra hyphenated token in a
variant name is a new findable surface at zero build cost. The binding constraint is not demand but
tool-fit: readability (0.644) is high-demand but has no existing server whose tools plausibly serve it,
so forcing a variant would mislead searchers. Better to defer it to a round where a text-analysis
server exists.
