# INTEL_R14 -- 30 fresh candidate tokens (round 14) + marginal-server verdict

Measured 2026-09-07. Method and scoring formula reproduced exactly from round 13
(`data/intel_r13.json`) so round 14 is comparable, not a new scale. Budget: at most
~150 external HTTP calls; used 49 registry GETs + 15 gh-api/curl calls. Free sources
only (registry API, `gh` CLI, plain HTTP). No paid APIs, no paid submissions.

## Method (unchanged from round 13)

One `GET https://registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100`
per token, **fully paginated** by following `metadata.nextCursor` until it comes back
null -- the fix for the single-page-undercount mistake a prior round was burned by.
All 30 tokens in this round resolved on page 1 with `nextCursor` null, so
`metadata.count` is confirmed as the true total for every row below, not a
first-page undercount.

- `count` = `metadata.count` (raw row count, one row per stored version, same
  convention as every prior INTEL round).
- `empty_slot_score = 100/(1+count)`.
- `fit` (0-1) = pairing with the **current 31-server suite**: amortization,
  asset-register, bank-statement, barcode, billing-docs, calendar, cash-book,
  catalogue, change-order, clauses, currency, deposits, docx, expense-tracker,
  image, invoice, kanban, office-suite, pdf, per-diem, petty-cash, price-tracker,
  quotes, recurring, resume, spreadsheet, statement-of-account, time-tracker,
  timezone, work-order, zip.
- `buildability` (0-1) = pure-TypeScript, no-network, no-paid-API, honest-in-one-round
  feasibility gate.
- `score = empty_slot_score x fit x buildability`.
- Build gate (unchanged): build only if `count < 20 AND fit > 0.6 AND buildability > 0.7`.

Cross-checked all 30 tokens against every prior `docs/INTEL_R*.md` and
`docs/NAMING_R*_RESULT.md` round (a 239-token exclusion set built from every bold/
table-row token across those files) and against every already-published
`io.github.theluckystrike/*` registry-name variant recorded in
`data/distribution.json`'s per-server notes. Two initial candidates
(`variation-order`, `lease-schedule`) turned out to already resolve to our own rows
-- `variation-order` and `scope-change` are change-order's own published variants,
and `lease-schedule` (alongside `loan-schedule`) is amortization's own published
variant -- so both were dropped and replaced with `retention-money` and
`labour-burden` before scoring, live-checked at 0 competitors each first.

## 30 fresh tokens probed, ranked by score

| rank | token | count | capped | fit | buildability | score | decision |
|---|---|---|---|---|---|---|---|
| 1 | **debit-note** | 0 | no | 0.75 | 0.85 | **63.75** | **BUILD** |
| 2 | **statement-of-work** | 0 | no | 0.70 | 0.80 | **56.0** | **BUILD** |
| 3 | **job-costing** | 0 | no | 0.70 | 0.75 | **52.5** | **BUILD** |
| 4 | **progress-claim** | 0 | no | 0.70 | 0.75 | **52.5** | **BUILD** |
| 5 | **materials-list** | 0 | no | 0.65 | 0.80 | **52.0** | **BUILD** |
| 6 | retainage | 0 | no | 0.65 | 0.80 | 52.0 | no-build, ranked 6th (tied with #5), clears the gate on its own merits |
| 7 | plant-hire | 0 | no | 0.60 | 0.80 | 48.0 | no-build |
| 8 | daywork | 0 | no | 0.60 | 0.80 | 48.0 | no-build |
| 9 | completion-certificate | 0 | no | 0.60 | 0.80 | 48.0 | no-build |
| 10 | labour-burden | 0 | no | 0.60 | 0.75 | 45.0 | no-build |
| 11 | site-diary | 0 | no | 0.55 | 0.80 | 44.0 | no-build |
| 12 | cost-plus-contract | 0 | no | 0.60 | 0.70 | 42.0 | no-build (buildability at the gate boundary, not over it) |
| 13 | cost-code | 0 | no | 0.55 | 0.70 | 38.5 | no-build |
| 14 | defects-liability | 0 | no | 0.55 | 0.70 | 38.5 | no-build |
| 15 | self-billing | 0 | no | 0.55 | 0.70 | 38.5 | no-build |
| 16 | progress-billing | 0 | no | 0.50 | 0.75 | 37.5 | no-build, near-dup of progress-claim (fit capped) |
| 17 | day-rate | 0 | no | 0.50 | 0.75 | 37.5 | no-build |
| 18 | call-off-order | 0 | no | 0.55 | 0.65 | 35.75 | no-build |
| 19 | extension-of-time | 0 | no | 0.55 | 0.65 | 35.75 | no-build |
| 20 | utilisation-report | 0 | no | 0.50 | 0.70 | 35.0 | no-build, thin (derives from time-tracker's own data) |
| 21 | retention-money | 0 | no | 0.40 | 0.80 | 32.0 | no-build, near-dup of retainage (fit capped) |
| 22 | unit-price | 0 | no | 0.40 | 0.80 | 32.0 | no-build, overlaps catalogue's dated unit prices |
| 23 | lien-waiver | 0 | no | 0.55 | 0.55 | 30.25 | no-build, buildability capped: US state-statutory wording risk |
| 24 | subcontractor | 0 | no | 0.50 | 0.60 | 30.0 | no-build, generic/ambiguous scope |
| 25 | toolbox-talk | 0 | no | 0.40 | 0.75 | 30.0 | no-build, off-thesis (safety compliance) |
| 26 | labour-log | 0 | no | 0.35 | 0.80 | 28.0 | no-build, overlaps time-tracker/work-order labour lines |
| 27 | job-sheet | 0 | no | 0.30 | 0.85 | 25.5 | no-build, near-dup of work-order's own 'job-card' variant |
| 28 | daily-report | 3 | no | 0.50 | 0.70 | 8.75 | no-build, real competitors, overlaps site-diary |
| 29 | dilapidations | 2 | no | 0.45 | 0.55 | 8.25 | no-build, off-thesis, needs surveyor judgement |
| 30 | takeoff | 57 | no | 0.40 | 0.30 | 0.21 | no-build, real competitors (construction-takeoff-estimating, opentakeoff) but needs drawing/plan parsing, not a local-files fit |

## Top 5 by score, with build spec

1. **debit-note** (count 0, fit 0.75, buildability 0.85, score 63.75) -- **BUILD**.
   Pure-TS debit-note generator: the debit side of the existing credit-note concept,
   linking to an invoice or statement-of-account reference, itemized adjustment,
   reason, PDF export reusing the invoice/billing-docs template engine; no network.
2. **statement-of-work** (count 0, fit 0.70, buildability 0.80, score 56.0) --
   **BUILD**. Pure-TS SOW builder: engagement scope, deliverables, assumptions,
   exclusions, milestone/sign-off block, reusing clauses' clause-library and the
   quotes/invoice PDF shape; no network.
3. **job-costing** (count 0, fit 0.70, buildability 0.75, score 52.5) -- **BUILD**.
   Pure-TS per-job cost roll-up: labour hours at a rate, materials at cost (reads
   catalogue by SKU), overhead allocation, budget-vs-actual variance; a genuine seam
   server across work-order, time-tracker and catalogue; no network.
4. **progress-claim** (count 0, fit 0.70, buildability 0.75, score 52.5) -- **BUILD**.
   Pure-TS interim/progress payment claim against a running contract value: percent
   complete, amount previously certified, retention withheld, amount now due;
   adjacent to change-order, quotes and invoice; no network.
5. **materials-list** (count 0, fit 0.65, buildability 0.80, score 52.0) -- **BUILD**.
   Pure-TS bill-of-materials / materials list for a job: item, quantity, unit,
   supplier reference, cost resolved from catalogue by SKU; pairs with work-order
   and catalogue; no network.

**retainage** (score 52.0, tied with materials-list, ranked 6th) independently
clears the strict build gate too (count 0, fit 0.65 > 0.6, buildability 0.80 > 0.7)
and is recorded as the closest miss, same pattern as round 13's `sign-off`/
`milestone`.

## Failures / caveats

- All 30 registry probes returned on the first request, single page each, no
  timeouts, no retries needed except one transient JSON-decode failure on
  `materials-list` and `scope-change` (both re-issued successfully).
- `daily-report` (3), `dilapidations` (2) and `takeoff` (57) are the only tokens
  with nonzero, non-noise competitor counts this round -- all three were checked by
  name and are genuine competitors (construction daily-report tools, UK
  dilapidations surveying tools, `com.esti-maite/construction-takeoff-estimating`
  and `io.github.Kentucky-ai/opentakeoff`), not substring collisions, so none were
  excluded as noise the way round 13 excluded `sop`.
- `job-sheet`, `labour-log` and `unit-price` scored inside the top third but were
  deliberately fit-capped: `job-sheet` duplicates work-order's own already-published
  `job-card` registry variant, `labour-log` duplicates time-tracker/work-order's own
  labour lines, and `unit-price` duplicates catalogue's own dated per-SKU pricing --
  same discipline round 13 applied to `expense-claim`/`reimbursement` against
  expense-tracker.

---

# Part 2 -- is the marginal server (#31/32/33) still worth a build round?

**Verdict: no.** On every measurable signal available, the last five servers built
are not paying for themselves, and a 32nd/33rd server would inherit the identical
structural ceiling rather than escape it. The honest answer this round is that the
build round should go into fixing conversion and distribution on the existing
31-server estate, not adding to the catalogue.

## Which five servers, in what order

First-commit timestamps for `servers/<name>/` (`git log --diff-filter=A --follow`),
all on 2026-09-06: cash-book 02:31, **amortization** 05:06, **petty-cash** 07:39,
**work-order** 10:10, **catalogue** 12:46, **change-order** 14:27. The five most
recently built are, oldest to newest: **amortization, petty-cash, work-order,
catalogue, change-order**.

## Evidence, signal by signal

**Sales / revenue.** `data/kpi.json` (2026-09-06): 68 checkout sessions from
humans in the last 100, **0 paid sessions, 0 license keys minted, 0 Pro tenants on
hosted endpoints** -- across the *whole* 31-server estate. Revenue attributable to
the newest 5 specifically cannot exceed the estate total of $0.

**Whether the newest servers can even be bought.** Probed
`https://mcp.zovo.one/buy/<id>` with a browser User-Agent for all 5 (2026-09-07):
amortization and petty-cash return a live `303` to `checkout.stripe.com`.
**work-order, catalogue and change-order -- 3 of the last 5, 60% -- return HTTP 503
with `x-mcp-buy: price-pending-human`**: their Pro tier cannot be purchased at all
right now, a human step is required first. *(Note: these 5 probes were made before
this loop's brief was corrected mid-round to require `?src=probe` on buy-route
checks to avoid polluting the click counter; they should be treated as probe noise
in `data/kpi.json`'s click count, not human demand, and are not cited as such
above.)*

**Registry rank on their own tokens.** All 5 are live at v0.20.0: amortization
rank 1 of 5, petty-cash rank 1 of 4, work-order rank 1 of 3, catalogue rank 11 of 14
(p=10/11=0.91), change-order rank 1 of 1. All 5 also carry 1-2 published
compound-slug registry-name variants (`loan-schedule`, `cash-float`,
`imprest-account`, `job-card`, `price-list`, `rate-card`, `variation-order`,
`scope-change`) that resolve **only to our own row** -- self-created slugs, so a
rank of 1 is tautological, not evidence a real buyer's search reaches us.
`data/organic.json`'s own documented search semantics state that **any two-word
query containing a space returns 0 results fleet-wide**, and the generic single
words a person actually types are swamped by competitors (the existing
price-tracker server ranks 106th of 131 on the bare word "price"). A 32nd/33rd
server, however cleverly named, inherits this identical ceiling; naming variants
cannot fix a search engine that returns 0 on a space.

**Whether the fleet's own findability model even measures them.**
`data/organic.json`'s `servers[]` list -- the file that computes the estate's
tracked organic/findable score -- **contains none of amortization, petty-cash,
work-order, catalogue or change-order**. It was last generated 2026-09-06 against
an earlier server set. The estate's only findability instrument has never checked
whether the newest third of the catalogue clears the ~50% ceiling at all.

**Directory listings.** All 5 ARE submitted: Docker MCP catalog PR #4892's body
names all 5 (30 servers total in that PR), but the PR carries 1 general comment,
**0 review comments**, and `mergeable_state: blocked` -- unchanged engagement from
every prior round. Cline marketplace holds 5 open issues (#2455, #2458, #2459,
#2460, #2461), each with **0 comments**. Smithery and Glama still show 0 presence
for the whole estate. The one directory with real traffic in progress,
`awesome-mcp-servers` PR #13473 (2,237+ real entries), is CI-blocked on a Glama
listing that has not happened -- and doesn't include any of these 5 at all.

**Product page / traffic.** All 5 have a live `/s/<id>` page in the sitemap and a
`/health` product entry, same as every other server. No per-server traffic
instrument exists anywhere in this repo; the estate-wide traffic proxy (GitHub
views/uniques/clones) was last measured flat at 0. Bundle downloads for the 5
newest, summed across every release via `gh api repos/.../releases --paginate`,
range from roughly 8 (change-order, one release old) to 37 (amortization, present
across 5 releases) -- small numbers consistent with the rest of the estate's
zero-to-sale conversion since day one.

## What would pay better than a 32nd server

1. **Fix the 3 broken Pro checkouts** (work-order, catalogue, change-order,
   `price-pending-human`) -- converts existing traffic/downloads immediately, at
   far lower cost than a new build, and removes a defect a 32nd server would risk
   repeating.
2. **Get Glama listed** -- the single hard blocker named on every
   `awesome-mcp-servers` round since PR #13473 opened. Unblocking it reaches a
   2,237+-entry directory with real traffic for all 31 servers at once, a bigger
   distribution lever than any one new server.
3. **Add the 5 newest servers to `data/organic.json`'s tracked query_set** so the
   estate's own findability model measures the newest third of the catalogue
   instead of scoring it blind.
4. **Spend a round on one real human touchpoint** that could produce the estate's
   first sale -- the Docker/Cline PRs have sat at 0 comments for weeks; a real
   backlink from a site with actual traffic would do more than a document
   generator nobody outside this repo has seen yet.

## Files

- `data/intel_r14.json` (all 30 probes, scores, top 5, Part 2 evidence)
- `docs/INTEL_R14.md` (this file)

## RESULT.md schema block

```
status: DONE
evidence: Part 1 -- 30 tokens fully paginated (search=<token>&limit=100, cursor-followed
  to null) against a 239-token exclusion set from every prior INTEL/NAMING round plus every
  already-published io.github.theluckystrike/* variant name; all 30 resolved on page 1
  (metadata.count confirmed as a true total). Top 5 by round-13's unchanged formula
  (empty_slot_score x fit x buildability, gate count<20/fit>0.6/build>0.7): debit-note
  (63.75), statement-of-work (56.0), job-costing (52.5), progress-claim (52.5),
  materials-list (52.0); retainage (52.0) is the closest miss at rank 6.
  Part 2 -- checked the last 5 servers built (amortization, petty-cash, work-order,
  catalogue, change-order) against data/kpi.json (0 paid sessions estate-wide), live
  /buy/ probes (3 of 5 return 503 price-pending-human, unbuyable), registry rank (live but
  only self-referentially via invented slugs; organic.json's own documented space-query=0
  rule caps real-search reach), data/organic.json (does not track any of the 5 at all),
  Docker/Cline directory PRs (submitted, 0 review engagement), and release download counts
  (8-37 total, same zero-to-sale pattern as the rest of the estate). Verdict: the marginal
  server is not paying for itself; named 4 higher-value uses of a build round instead.
artifacts: docs/INTEL_R14.md, data/intel_r14.json
cost: 49 registry GETs + 15 gh-api/curl calls = 64 external calls, well under the ~150
  budget; zero paid APIs; zero paid submissions
failures: 2 transient JSON-decode errors (materials-list, scope-change), both re-issued
  and resolved on retry; no other failures
insight: round 14's empty-slot cluster is still construction/contracting-adjacent
  back-office documents (debit-note, statement-of-work, job-costing, progress-claim,
  materials-list) but the round's real finding is in Part 2 -- the last 5 servers built
  (all same-day, 2026-09-06) show zero measured payoff on every available signal, 60% of
  them have a broken Pro checkout, and the estate's own findability model has never even
  measured them. Building more of the same document-generator shape is not the bottleneck;
  the bottleneck is that nothing built so far has converted a single sale or landed in a
  directory with real human traffic.
```
