# Token demand, round 1 (2026-09-10)

status: DONE. 70 capabilities probed against the live registry, 53 scored, 17 listed and
excluded with the reason. Two servers built: `servers/checklist` and `servers/packing-list`.

Machine-readable table: `data/token_demand_r1.json`. Instrument: `scripts/token-demand.mjs`.

## Why this round exists

The prior intel round concluded that the marginal server had stopped paying. That conclusion
was reached with no findability test in the loop: servers were added, and whether anyone
could reach them through the one channel that delivers humans was never computed. This round
makes the selection arithmetic.

## The mechanism, and the one thing that makes it arithmetic

The official registry's `search=` is not a search engine.

- It matches a **substring of the `name` field only**. The description is never searched.
  Confirmed here with two controls: `search=theluckystrike` returns 1,394 rows (a substring
  that exists only in a namespace), and `search=offline` returns 3 rows, none of them ours,
  although our pdf server's description says "all offline".
- Results come back in **strict ASCII order on the whole `<namespace>/<local-name>` string**,
  case-sensitive, so uppercase A-Z sorts before lowercase a-z.
- It is **cursor-paginated**. `metadata.nextCursor` is `"<name>:<version>"` of the last row
  on the page, and `metadata.count` is the row count of THAT PAGE, capped at `limit`. It is
  not the size of the corpus. A prior round was burned by reading it as if it were: `pdf`
  shows 100 on page one and holds 323 rows. Every count below comes from paginating to
  exhaustion.

Two consequences drive everything.

**1. Our namespace decides our rank before the local name is read.**
`io.github.theluckystrike` is compared before the slash is reached. So the local name only
reorders us within our own cluster; it cannot move us ahead of one single competing
namespace. That makes our landing rank for a token **arithmetic on live data, not a guess**:

    landing_rank = 1 + count(rows whose full name sorts strictly before "io.github.theluckystrike/")

**2. Rows are per stored VERSION, not per server.** `com.hellobasestation/pdfkit` is three
rows. Both are reported: `supply_rows` is what the sort actually orders and therefore what
sets our rank; `supply_servers` is the distinct-name count and is the honest measure of how
many other people are attempting the job.

## The instrument

`scripts/token-demand.mjs`, with the cursor loop, a hard 60-page stop, a guard against a
cursor that does not advance, and `--controls` which runs the positive and negative controls
above and exits non-zero if the positive one returns nothing. A zero from an instrument that
has never returned non-zero is unmeasured, not proven.

    node scripts/token-demand.mjs --controls
    node scripts/token-demand.mjs packing checklist snag handover
    node scripts/token-demand.mjs --json --file tokens.txt

## What is already covered, so it is not a candidate

The 32 servers that existed at the start of this round: amortization, asset-register,
bank-statement, barcode, billing-docs, calendar, cash-book, catalogue, change-order, clauses,
currency, delivery-schedule, deposits, docx, expense-tracker, image, invoice, kanban,
office-suite, pdf, per-diem, petty-cash, price-tracker, quotes, recurring, resume,
spreadsheet, statement-of-account, time-tracker, timezone, work-order, zip.

Five probed tokens map onto one of those and are excluded on that ground rather than scored:
`mileage` and `fuel` and `logbook` (expense-tracker), `timesheet` (time-tracker), `cashflow`
(cash-book), `meeting` and `contacts` (timezone), `notes` (kanban).

## Demand: what was actually sourced, and what was not

No search volume was invented. Three free sources were tried and all three are reported.

**Source 1: registry attempts.** How many distinct MCP servers already carry the token in
their name. A crowded token is evidence of demand and evidence of competition at once, so
both `supply_servers` and the resulting `landing_rank` are in the table.

**Source 2: GitHub repository search, QUALIFIED.** `gh api search/repositories` `total_count`
for the token in `name,description`, with and without the word `mcp`.

The first pass used the bare token and produced a table that was wrong. On GitHub, "training"
is machine learning, "packing" is byte packing, "rota" is rotation, "permit" is permission.
So every candidate was re-queried with the two- or three-word phrase a person would actually
use for the office job, and the qualified count is what enters the score. The bare count is
kept beside it as `gh_bare_token_repos` with the ratio as `homonym_contamination_x`, so the
correction is visible rather than hidden. It is not small: 767x on `training`, 1566x on
`retention`, 409x on `donation`, 34x on `readability`, 8.5x on `packing`. Under the bare
counts, `training` scored 1.000 and ranked first; qualified, it scores 0.265 and ranks 25th.

**Source 3: the MCP spec and the official server list. Measured, and empty.** The
`modelcontextprotocol/servers` README and the draft spec index were fetched and grepped for
all 70 tokens. Positive control: `filesystem` returns 3 hits in the official list, so the
instrument works. Real hits for the candidates: **zero**. The five apparent matches were
substrings inside other words (`sla` in "translation", `rma` in "format", `lien` in "client",
`citation`/`poll` in prose). This axis discriminates nothing and is recorded as
measured-and-empty rather than scored. It is in the JSON as `in_official_server_list: 0` and
`in_spec: 0` on every row so a later round does not re-derive it.

**Unsourced candidates are not scored.** A candidate with zero registry attempts AND fewer
than five qualified MCP repos is marked `demand_sourced: false`, listed, and excluded.
Twelve candidates fall out that way. They are not zero-demand; they are unmeasured, and the
difference matters.

## Buildability

Hand-assigned, 0 to 2, on one question: can this ship as a local-computation document tool
with zero paid APIs and no network dependency, like the other 32?

- **2** pure local computation, no bundled reference data needed, fits the existing estate.
- **1** buildable but needs a bundled static table, or the honest scope is thin, or the
  domain is one where an honest claim is narrower than the token suggests (`payslip`,
  `donation`, `citation`, `customs`, `freight`, `pallet`, `waiver`, `affidavit`).
- **0** cannot be done honestly offline: `payroll` (statutory deduction tables), `escrow` and
  `lien` (money rails and filings).

## The score, and its honest limitation

    score = visibility_p * demand_score * (buildability / 2)
    visibility_p  = min(1, 10 / landing_rank) if landing_rank <= 100, else 0
    demand_score  = 0.6 * min(1, log10(1 + gh_mcp) / 2) + 0.4 * min(1, log10(1 + gh_all) / 5)

`visibility_p` barely separates the winners, because `min(1, 10/rank)` saturates at rank 10
and thirty-odd candidates land at or above it. That is the finding rather than a defect:
**once a token is winnable, rank stops being the lever.** What rank still does, decisively,
is act as a hard gate. It zeroes `bom` (109), `sla` (409) and `rma` (502): those three are
permanently unreachable under this namespace, no matter what the local name is, and building
for them would be building something nobody can find. Below rank 100, demand and buildability
decide.

## The full ranked table

| # | token | capability | landing rank | registry rows / servers / namespaces | gh query | gh mcp | gh all | bare | contam | demand | build | score |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `checklist` | Reusable checklists with runs and sign-off | **7** | 6 / 6 / 5 | checklist | 191 | 51379 | 51379 | 1x | 0.9769 | 2 | 0.9769 |
| 2 | `itinerary` | A travel itinerary: legs, times, confirmations | **1** | 0 / 0 / 0 | travel itinerary | 112 | 11933 | 20083 | 1.7x | 0.9261 | 2 | 0.9261 |
| 3 | `glossary` | A term glossary assembled into a document | **1** | 0 / 0 / 0 | glossary | 55 | 8127 | 8127 | 1x | 0.8373 | 2 | 0.8373 |
| 4 | `supplier` | Supplier register with terms and spend | **6** | 7 / 6 / 4 | supplier management | 17 | 5653 | 30033 | 5.3x | 0.6768 | 2 | 0.6768 |
| 5 | `readability` | Readability and length metrics for a block of prose | **1** | 0 / 0 / 0 | readability score | 20 | 1235 | 42490 | 34.4x | 0.644 | 2 | 0.644 |
| 6 | `minutes` | Meeting minutes: attendees, decisions, action items | **4** | 3 / 1 / 1 | meeting minutes | 14 | 3837 | 61929 | 16.1x | 0.6396 | 2 | 0.6396 |
| 7 | `renewal` | Contract and subscription renewal register | **3** | 3 / 3 / 3 | contract renewal | 27 | 344 | 9776 | 28.4x | 0.6372 | 2 | 0.6372 |
| 8 | `inventory` | Stock on hand with movements and reorder points | **16** | 15 / 11 / 11 | inventory management | 86 | 130887 | 396945 | 3x | 0.9819 | 2 | 0.6137 |
| 9 | `changelog` | Changelog and release notes | **13** | 17 / 11 / 9 | changelog generator | 57 | 1015 | 14885 | 14.7x | 0.7696 | 2 | 0.592 |
| 10 | `gantt` | Gantt bars and critical path from dated tasks | **4** | 3 / 1 / 1 | gantt chart | 7 | 5228 | 11369 | 2.2x | 0.5684 | 2 | 0.5684 |
| 11 | `complaint` | Customer complaint log with resolution and SLA clock | **2** | 1 / 1 / 1 | complaint management | 5 | 11742 | 43028 | 3.7x | 0.559 | 2 | 0.559 |
| 12 | `membership` | Member register with dues, renewals and lapses | **1** | 0 / 0 / 0 | membership management | 5 | 4191 | 28766 | 6.9x | 0.5232 | 2 | 0.5232 |
| 13 | `standup` | Daily standup notes | **12** | 31 / 5 / 5 | daily standup | 13 | 967 | 5293 | 5.5x | 0.5827 | 2 | 0.4856 |
| 14 | `packing` | Packing list / packing slip for a shipment | **3** | 2 / 2 / 2 | packing list | 4 | 1803 | 15288 | 8.5x | 0.4702 | 2 | 0.4702 |
| 15 | `commission` | Sales commission per rep from invoiced lines | **2** | 1 / 1 / 1 | sales commission | 4 | 914 | 15764 | 17.2x | 0.4466 | 2 | 0.4466 |
| 16 | `onboarding` | Onboarding checklist | **7** | 6 / 2 / 2 | onboarding checklist | 4 | 364 | 75459 | 207.3x | 0.4147 | 2 | 0.4147 |
| 17 | `waybill` | Waybill for a shipment | **2** | 1 / 1 / 1 | waybill | 3 | 538 | 538 | 1x | 0.3991 | 2 | 0.3991 |
| 18 | `maintenance` | Planned maintenance schedule and service log | **14** | 14 / 4 / 4 | maintenance schedule | 4 | 2532 | 91431 | 36.1x | 0.482 | 2 | 0.3443 |
| 19 | `incident` | Incident report with severity and follow-up | **25** | 26 / 9 / 7 | incident report | 41 | 10089 | 68845 | 6.8x | 0.8073 | 2 | 0.3229 |
| 20 | `roster` | Staff roster | **11** | 10 / 2 / 2 | shift roster | 2 | 402 | 17580 | 43.7x | 0.3516 | 2 | 0.3196 |
| 21 | `redact` | Redact names and identifiers out of text | **19** | 18 / 8 / 8 | redact text | 14 | 871 | 9260 | 10.6x | 0.5881 | 2 | 0.3095 |
| 22 | `agenda` | Meeting agenda with timeboxes | **17** | 33 / 10 / 8 | meeting agenda | 7 | 899 | 103514 | 115.1x | 0.5073 | 2 | 0.2984 |
| 23 | `payslip` | Payslip document from stated gross and deductions | **3** | 2 / 1 / 1 | payslip | 7 | 4231 | 4231 | 1x | 0.5611 | 1 | 0.2806 |
| 24 | `budget` | Budget against actuals per line and period | **36** | 49 / 24 / 20 | budget tracker | 109 | 55213 | 214060 | 3.9x | 0.9794 | 2 | 0.2721 |
| 25 | `training` | Training records with certification expiry | **4** | 5 / 5 / 5 | training records | 0 | 2055 | 1577373 | 767.6x | 0.265 | 2 | 0.265 |
| 26 | `rota` | Shift rota with coverage and hours per person | **5** | 4 / 4 / 4 | shift rota | 0 | 298 | 81468 | 273.4x | 0.1981 | 2 | 0.1981 |
| 27 | `voucher` | Gift vouchers: issue, redeem, balance, expiry | **1** | 1 / 1 / 1 | gift voucher | 0 | 292 | 10698 | 36.6x | 0.1973 | 2 | 0.1973 |
| 28 | `survey` | Survey response tally and cross-tabs | **24** | 31 / 15 / 15 | survey results | 3 | 3601 | 173805 | 48.3x | 0.4651 | 2 | 0.1938 |
| 29 | `rfq` | Request for quotation and the supplier comparison | **5** | 4 / 3 / 2 | request for quotation | 0 | 199 | 2728 | 13.7x | 0.1841 | 2 | 0.1841 |
| 30 | `wbs` | Work breakdown structure for a project | **2** | 1 / 1 / 1 | work breakdown structure | 0 | 195 | 7225 | 37.1x | 0.1834 | 2 | 0.1834 |
| 31 | `pallet` | Carton and pallet fill for a shipment | **2** | 1 / 1 / 1 | pallet load | 2 | 259 | 8014 | 30.9x | 0.3363 | 1 | 0.1681 |
| 32 | `customs` | Commercial invoice for customs | **7** | 6 / 5 / 4 | customs declaration | 2 | 135 | 12986 | 96.2x | 0.3138 | 1 | 0.1569 |
| 33 | `stakeholder` | Stakeholder register with influence and interest | **3** | 2 / 2 / 1 | stakeholder register | 0 | 72 | 13841 | 192.2x | 0.1491 | 2 | 0.1491 |
| 34 | `permit` | Permit to work with hazards and sign-off | **16** | 15 / 11 / 10 | permit to work | 0 | 415 | 22149 | 53.4x | 0.2095 | 2 | 0.1309 |
| 35 | `snag` | Snag / defect list against a completed job | **2** | 2 / 2 / 2 | snag list | 0 | 41 | 1836 | 44.8x | 0.1299 | 2 | 0.1299 |
| 36 | `retention` | Construction retention held and released | **10** | 9 / 4 / 3 | construction retention | 0 | 29 | 45408 | 1565.8x | 0.1182 | 2 | 0.1182 |
| 37 | `recipe` | Recipe costing and yield per portion | **37** | 37 / 18 / 18 | recipe cost | 4 | 648 | 534144 | 824.3x | 0.4347 | 2 | 0.1175 |
| 38 | `donation` | Donation receipts for a cause | **1** | 1 / 1 / 1 | donation receipt | 0 | 157 | 64279 | 409.4x | 0.1759 | 1 | 0.088 |
| 39 | `citation` | Citations and a bibliography in a named style | **30** | 29 / 10 / 10 | citation bibliography | 8 | 400 | 29422 | 73.6x | 0.4945 | 1 | 0.0824 |
| 40 | `poll` | Poll tally | **91** | 94 / 26 / 22 | poll results | 36 | 1980 | 101591 | 51.3x | 0.7342 | 2 | 0.0807 |
| 41 | `tender` | Tender / bid comparison across suppliers | **63** | 67 / 32 / 16 | tender bid | 5 | 639 | 15534 | 24.3x | 0.4579 | 2 | 0.0727 |
| 42 | `risk` | Risk register with likelihood, impact and mitigation | **89** | 154 / 56 / 51 | risk register | 14 | 1383 | 345356 | 249.7x | 0.6041 | 2 | 0.0679 |
| 43 | `okr` | Objectives and key results with progress | **42** | 41 / 5 / 5 | okr tracker | 1 | 252 | 5863 | 23.3x | 0.2826 | 2 | 0.0673 |
| 44 | `waiver` | Liability waiver document | **2** | 2 / 2 / 2 | liability waiver | 0 | 38 | 1285 | 33.8x | 0.1273 | 1 | 0.0636 |
| 45 | `raci` | RACI matrix over tasks and roles | **30** | 49 / 13 / 13 | raci matrix | 0 | 98 | 49840 | 508.6x | 0.1597 | 2 | 0.0532 |
| 46 | `handover` | Handover certificate at practical completion | **3** | 5 / 2 / 2 | handover certificate | 0 | 3 | 4024 | 1341.3x | 0.0482 | 2 | 0.0482 |
| 47 | `freight` | Freight cost from a rate card | **50** | 58 / 12 / 12 | freight rate | 3 | 909 | 12275 | 13.5x | 0.4173 | 1 | 0.0417 |
| 48 | `payroll` | Payroll with statutory deductions | **11** | 12 / 8 / 8 | payroll | 69 | 52807 | 52807 | 1x | 0.9313 | 0 | 0 |
| 49 | `escrow` | Escrow of funds | **11** | 10 / 7 / 6 | escrow | 65 | 13870 | 13870 | 1x | 0.8772 | 0 | 0 |
| 50 | `lien` | Lien filing | **48** | 48 / 26 / 22 | lien waiver | 0 | 21 | 10488 | 499.4x | 0.1074 | 0 | 0 |
| 51 | `bom` | Bill of materials rollup | **109** | 132 / 18 / 16 | bill of materials | 9 | 1673 | 69215 | 41.4x | 0.5579 | 2 | 0 |
| 52 | `sla` | Service level agreement clock | **409** | 430 / 140 / 106 | sla tracker | 54 | 2503 | 198517 | 79.3x | 0.794 | 2 | 0 |
| 53 | `rma` | Returns / RMA register | **502** | 604 / 176 / 140 | rma returns | 0 | 30 | 12774 | 425.8x | 0.1193 | 2 | 0 |

### Listed and NOT scored

| token | capability | landing rank | why excluded |
| --- | --- | --- | --- |
| `consignment` | Consignment note / CMR for a road shipment | 1 | demand unsourced (0 registry attempts and under 5 qualified MCP repos) |
| `attendance` | Attendance register for a course, site or meeting | 1 | demand unsourced (0 registry attempts and under 5 qualified MCP repos) |
| `requisition` | Internal purchase requisition and its approval | 1 | demand unsourced (0 registry attempts and under 5 qualified MCP repos) |
| `stocktake` | Physical stock count against the book quantity, variance report | 1 | demand unsourced (0 registry attempts and under 5 qualified MCP repos) |
| `warranty` | Warranty register per item: start, term, expiry, claims | 1 | demand unsourced (0 registry attempts and under 5 qualified MCP repos) |
| `breakeven` | Break-even units and revenue from fixed cost, price and variable cost | 1 | demand unsourced (0 registry attempts and under 5 qualified MCP repos) |
| `retrospective` | Sprint retrospective: what went well, actions | 1 | demand unsourced (0 registry attempts and under 5 qualified MCP repos) |
| `mileage` | Mileage log | 1 | covered by servers/expense-tracker |
| `timesheet` | Timesheet | 1 | covered by servers/time-tracker |
| `expiry` | Expiry register for certificates, insurance and licences | 1 | demand unsourced (0 registry attempts and under 5 qualified MCP repos) |
| `affidavit` | Sworn statement document | 1 | demand unsourced (0 registry attempts and under 5 qualified MCP repos) |
| `cashflow` | Cash flow forecast | 3 | covered by servers/cash-book |
| `logbook` | Vehicle logbook | 5 | covered by servers/expense-tracker |
| `fuel` | Fuel log | 8 | covered by servers/expense-tracker |
| `meeting` | Meeting scheduling | 11 | covered by servers/timezone |
| `contacts` | Contact list | 44 | covered by servers/timezone |
| `notes` | Notes | 99 | covered by servers/kanban |

## Why the two winners won

### servers/checklist -- the top of the table, and a multi-token play

`checklist` is first on the composite: 191 MCP repos and 51,379 repos carry the word, it is
one of the very few candidate tokens where the bare and qualified counts agree (1.0x, so no
correction was needed), it is pure local computation, and six competing servers put us at
landing rank 7 on page one.

The decisive argument is not the score, though. It is that **one codebase honestly claims
four winnable tokens at once.** Registry search matches the name substring only, so a second
and third registry name on the same bundle is a second and third way to be found, and the
capability genuinely covers all four:

| token | registry rows | distinct servers | our landing rank |
| --- | --- | --- | --- |
| `checklist` | 6 | 6 | 7 |
| `snag` | 2 | 2 | 2 |
| `handover` | 5 | 2 | 3 |
| `onboarding` | 6 | 2 | 7 |

Shipped as `io.github.theluckystrike/checklist`,
`io.github.theluckystrike/snag-list-defect-handover-signoff` and
`io.github.theluckystrike/onboarding-checklist-inspection-runs`. A contract test asserts the
tokens are actually present in the names, because a name that lost its token in an edit is a
server that silently stops being findable and nothing else would catch it.

### servers/packing-list -- 14th on the composite, and built anyway, with the reason stated

`packing` lands at **rank 3 of 3 rows**: two competing servers, one namespace sorting ahead
of ours, so we are on page one by construction and stay there unless a hundred namespaces
appear. Qualified demand is modest: 4 MCP repos and 1,803 repos for "packing list".

It sits at 14 on the composite and it was built anyway. Two reasons, both stated rather than
buried:

1. **The correction that moved it is the same correction this round is about.** Under the
   bare token it scored 0.809 and ranked 17th of the pre-correction table with a demand count
   of 15,288. The qualified count is 1,803. The 8.5x cut is real and it is reported here
   rather than left in a score.
2. **It is the highest-ranked candidate inside the estate's own order-to-invoice chain.** The
   other 32 servers serve one buyer: a trade or small firm running work orders, quotes,
   delivery schedules, catalogues and invoices. `packing-list` is the missing link between
   `delivery-schedule` and `invoice` and reuses that buyer exactly. `itinerary` scores 0.926
   at landing rank 1 with zero competitors, which on the raw arithmetic is better, and it
   serves a different buyer entirely. That is a judgement, and it belongs in the open.

`itinerary` and `glossary` are therefore the standing recommendations for the next build
round: both land at **rank 1 with zero competing servers**, both are pure local computation,
and both are sourced (112 and 55 qualified MCP repos).

## What a later round should not redo

- `bom`, `sla` and `rma` are unreachable under `io.github.theluckystrike` and no local name
  changes it. Measured landing ranks 109, 409 and 502.
- `risk` (89), `poll` (91) and `notes` (99) are technically on page one and worth
  essentially nothing: `visibility_p` 0.11, 0.11 and 0.10.
- The MCP spec and official-server-list axis returns no signal for any office capability. It
  was measured with a working positive control and is empty. Do not measure it again.
- The bare-token GitHub count is not a demand number for any capability whose word has a
  second meaning in software, which is most of them. Always qualify the phrase, and record
  the ratio.

## Files

- `scripts/token-demand.mjs` (the instrument, with `--controls`)
- `data/token_demand_r1.json` (all 70 rows, the method, the controls, the exclusions)
- `docs/TOKEN_DEMAND_R1.md` (this file)
- `servers/checklist/` and `servers/packing-list/` (the builds, with their own RESULT.md)

## RESULT.md schema block

```
status: DONE
evidence: Built scripts/token-demand.mjs, which fully paginates
  registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100 with the cursor loop
  and computes our landing rank as 1 + the rows sorting before "io.github.theluckystrike/".
  Instrument controls pass: positive (search=theluckystrike) 1,394 rows, negative
  (search=offline) 3 rows and none of ours. Probed 70 candidate capabilities not covered by
  the 32 existing servers. Demand sourced from two free instruments only: distinct registry
  servers per token, and QUALIFIED GitHub repo-search total_count. A third (the MCP spec and
  the official server list) was measured with a working positive control and returned zero
  real hits for all 70, so it is recorded as empty and not scored. 12 candidates are marked
  demand-unsourced and excluded rather than scored. Built the top-scoring candidate
  (checklist, landing rank 7, and rank 2/3/7 on snag/handover/onboarding through two further
  registry names on the same bundle) and packing-list (landing rank 3), both to the estate
  standard: 58 tests each, all green, bounded ancestor walk with a /proc test, licence gate,
  README, SPEC, llms-install, Dockerfile, four manifests.
artifacts: scripts/token-demand.mjs, data/token_demand_r1.json, docs/TOKEN_DEMAND_R1.md,
  servers/checklist/, servers/packing-list/
cost: no paid API call, no paid submission, no account created, nothing published.
failures: the first scoring pass used bare single-token GitHub counts and was wrong;
  homonym contamination reaches 767x, and "training" ranked first on it. Re-queried every
  candidate with a qualified phrase and reported both counts with the ratio.
insight: our landing rank is arithmetic, not an estimate, because the registry sorts on the
  full name and our namespace segment is compared before the local name is read. But rank
  stops discriminating once a token is winnable: min(1,10/rank) saturates at rank 10 and 30
  of 53 scored candidates sit at or above it. Rank is a HARD GATE, not a ranking signal. Its
  real work is telling you that bom, sla and rma are permanently unreachable under this
  namespace, and that the way to buy visibility is not a better slug but MORE NAMES on one
  codebase: servers/checklist is on page one for four separate tokens off three names.
```
