# INTEL_R4 — next two servers after resume/cover-letter

Measured 2026-09-03. Same instruments as docs/INTEL.md (R1) and docs/INTEL_R3.md: official
registry name-substring counts (`registry.modelcontextprotocol.io/v0/servers?search=`, full
cursor pagination via `metadata.nextCursor`, capped at 6 pages/600 rows per token), Smithery
`registry.smithery.ai/servers?q=&pageSize=100` (`pagination.totalCount` is the real total —
the bare response with no `pageSize` param defaults to a page of 10 and its absent `total`
field, an instrument bug in R1/R3's script that this round found and fixed; see Failures),
npm `registry.npmjs.org/-/v1/search?text=mcp <token>&size=250` (top-250 substring count, not
the OR-matched `total`, per the R1/R3 finding), and `gh api search/repositories` totals. Zero
paid calls. Already-shipped servers (currency, docx, expense-tracker, invoice, office-suite,
price-tracker, spreadsheet, time-tracker, timezone) and the resume/cover-letter server now in
build are excluded from scoring.

## Method

score = demand/(1+supply); demand = Chrome Web Store competing-listing count where measured,
else the R1 imputed consumer median (640), flagged; worst_case recomputes score at the R1
measured minimum (191) to bound the imputation, same as R1/R3. supply_index = registry hyphen
hits + 0.5 x registry token hits + npm mcp-substring count + (best non-outlier Smithery
competitor's useCount)/1000. `pipeworx/gateway` (2,530 tools, 419,019 uses) is excluded from
the Smithery top-use figure wherever it appears — R1 already treats it as a supply-side
outlier (a 2,530-tool aggregator, not a real per-intent competitor) and it surfaced as the
nominal #1 result for `ics reader` and `journal` this round purely because its tool count
covers almost every query; using it would understate supply for every intent it happens to
rank on. fit = score x pairs x local_value, zeroed when not buildable locally, needs hosting,
or is already shipped. pairs (0-1, judgment) = how directly the intent feeds/consumes the
shipped or in-build servers (time, invoice, expense, spreadsheet, currency, docx, timezone,
resume). local_value (0-1, judgment) = fraction of the market leader's value that survives
zero-paid-API / no-native-deps.

## A. Full 25-intent screen

Intents already scored in R1 (meeting notes, pomodoro, habit tracker, unit converter,
markdown-to-pdf, qr code, todo, note-taking, password, generic pdf, receipt OCR) are carried
forward unchanged from `docs/INTEL.md` Part B rather than re-measured, since the instrument
and shipped-server set for those tokens has not moved. New measurement this round covers the
15 intents R1 did not score plus two R1 rows re-run with an intent-specific query (`kanban`
instead of `todo`; `pdf merge` instead of generic `pdf`) because the generic token is
saturated by unrelated servers.

| Intent | reg hyphen | reg token | smithery total | smithery best real top use | npm | supply | score | worst case | buildable | pairs | local value | fit | note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| recurring invoice scheduler | 0 | 0 | 140 | 8514 (favcrm, weak overlap) | 0 | 8.51 | 67.3 | 20.08 | yes | 1.0 | 0.7 | 47.1 | reuses invoice's PDF writer; no real recurring-billing competitor found in top3 |
| contract clause library | 0 | 2 (clause) | 174 | 9347 excluded as unrelated (menjometre) -> next real n/a | 0 | 10.35 | 56.4 | 16.83 | yes | 0.7 | 1.0 | 39.5 | `clause` is the rarest single token measured this round (2 registry hits) |
| calendar ics reader | 0 | 907 (ics, flagged noisy per R3) | 138 | 7305 (claudewilder, gateway excluded) | 0 | 7.3 (using ics-reader=0, not the noisy ics=907) | 77.1 | 23.0 | yes | 0.6 | 0.8 | 37.0 | ics=907 is substring noise (statistics/logistics); ics-reader compound = 0 |
| bank statement categoriser | 6 | 0 | 158 | 6379 (IBANforge, real fintech, weak overlap) | 1 | 13.38 | 44.5 | 13.28 | yes | 0.7 | 0.8 | 24.9 | rule-based categorisation only, no ML; partial local_value |
| kanban / project todo | 5 | 5 | 105 | 2125 (mcp_hkbus, unrelated) | 6 | 15.63 | 38.5 | 11.49 | yes | 0.5 | 1.0 | 19.25 | github count 433 (not in formula) signals real crowding the other instruments miss |
| image resize | 3 | 3 | 156 | noise-dominated (sparkforge 219896, brave 119026); no real competitor found | 0 | 4.5 (nominal, noise discounted) | 116.4 | 34.7 | yes, jimp (pure JS) | 0.3 | 0.6 | 20.95 | low-confidence: Smithery signal unusable for this token, discounted by judgment not measurement |
| iban validator | 0 | 36 | 120 | 6379 (IBANforge, real direct competitor) | 2 | 26.38 | 23.4 | 6.98 | yes | 0.7 | 1.0 | 16.4 | real competitor already serves this niche with meaningful use |
| quote/estimate generator | 0 | 63 (quote) | 192 | 10286 (quotewise, unclear relevance) | 0 | 41.79 | 15.0 | 4.46 | yes | 0.9 | 0.9 | 12.1 | `quote` token crowded by unrelated crypto/finance quote servers |
| tax estimate calculator (PL/UK/US) | 0 | 66 | 141 | 6141 (aiwyn, real accounting-practice competitor) | 4 | 49.67 | 12.6 | 3.77 | yes | 0.8 | 0.9 | 9.1 | `tax` is a broad, crowded generic word; PL/UK/US-specific niche is likely less crowded than the instrument shows |
| email drafts library | 0 | 0 | 157 | 57738 (gmail, irrelevant OAuth account server) | 0 | 57.74 | 10.9 | 3.25 | yes | 0.6 | 1.0 | 6.5 | github(2) is the cleanest signal here; Smithery is noise-dominated by Gmail |
| client CRM | 0 | 74 | 152 | 8514 (favcrm, real direct competitor) | 14 | 59.5 | 10.6 | 3.16 | yes | 0.7 | 0.6 | 4.4 | npm=14 and a real hosted competitor both present; crowded |
| flashcards | 8 | 8 | 102 | 4831 (hsk-mcp, real direct competitor) | 0 | 13.33 | 44.7 | 13.3 | yes | 0.1 | 1.0 | 4.5 | off-thesis: consumer study tool, not freelancer office |
| notes/journal | 26 | 26 | 137 | gateway excluded; next real n/a in top3 | 4 | 27.0 | 22.7 | 6.78 | yes | 0.5 | 1.0 | 11.3 | duplicates R1's "note taking" weak-pairing finding |
| signature/agreement tracker | 6.5 avg | 6.5 avg | 158 avg | 8540 avg (vibe-pay, payments, unrelated) | 0 | 18.29 | 33.2 | 9.9 | yes, tracker only (no real e-sign) | 0.7 | 0.5 | 11.6 | scope-limited: status/date tracking, not legally-binding signing |
| pdf merge/split | 4 | 1 (pdf-merge unique, not generic pdf=100/100) | 161 | 6779 (weak, academic search, unrelated) | 0 | 11.28 | 52.1 | 15.55 | yes, pdf-lib (pure JS) | 0.6 | 1.0 | 31.3 | generic `pdf` token saturated (R1) but the merge/split compound is not |
| vat validator | 19 | 194 | 134 | 1299 (OjasKord/vat-validator-mcp, real direct competitor, exact niche) | 3 | 120.3 | 5.3 | 1.57 | yes | 0.8 | 1.0 | 4.2 | a real competitor already occupies this exact niche |
| password/secret generator | (R1) | (R1) | (R1) | (R1) | (R1) | (R1) | (R1) | (R1) | no | 0 | 0 | 0 | liability, will not ship (R1) |
| receipt OCR | (R1) | (R1) | (R1) | (R1) | (R1) | (R1) | (R1) | (R1) | no | 0 | 0 | 0 | needs a paid/native OCR model (R1) |
| url shortener | not measured | not measured | not measured | not measured | not measured | n/a | n/a | n/a | no | 0 | 0 | 0 | value is a public resolvable link; a local stdio server cannot serve redirects |
| csv cleaner/dedupe | 0 | 26 (csv) | 172 (csv) / 120 (dedupe) | 56138 (googlesheets, dominant noise) | 2 | 71.14 | 8.9 | 2.65 | yes | 0.6 | 1.0 | 5.3 | `csv` token saturated by Google Sheets' huge use count |

Demand for every new row above is the R1 imputed consumer median (640, worst case 191); no
fresh Chrome Web Store crawl was run this round (zero paid APIs, and the existing crawl in
`platform-analysis-2026/measured.json` has no rows for these 15 new intents).

## B. Two picks

Ranked by fit and worst-case together (not fit alone — `vat validator` and `csv
cleaner/dedupe` score respectably on fit but both sit on saturated or already-occupied
tokens; `image resize` and `flashcards` score high but fail on weak pairing or an unusable
Smithery signal). The two picks below are the best fit/worst-case pair that (a) is not
already occupied by a real direct competitor, (b) pairs with >=2 shipped or in-build servers,
and (c) is fully buildable with zero paid APIs and no native deps.

### Pick 1 — recurring-invoice-scheduler

fit 47.1, worst-case 14.06 (highest of both measured columns in this round). No real
recurring-billing competitor surfaced in any top-3 (favcrm is a full CRM, weak overlap;
crontab-generator and well/app are unrelated). Extends the invoice server's PDF writer as a
separate registry entry and product, the same "shared code, new registry name" pattern R1's
R2 recommendation and the docx/timezone split already establish.

Tools (10): `schedule_create`, `schedule_list`, `schedule_get`, `schedule_pause`,
`schedule_resume`, `schedule_delete`, `schedule_upcoming` (forecast next N invoice
dates/amounts), `invoice_generate_due` (renders PDFs for everything due as of a date, via the
shared invoice/docx writer), `schedule_history` (generated-invoice log, paid/unpaid flag),
`license_status`/`license_activate`.

Free/Pro split: free = up to 3 active schedules, manual `invoice_generate_due` trigger, full
CRUD. Pro = unlimited schedules, `schedule_upcoming` forecast, `schedule_history` audit log.

Registry name: `io.github.theluckystrike/recurring-invoice-scheduler-subscription-billing-due-reminders`
(tokens spent, rarest first: `recurring-invoice` 0, `scheduler` 8, `subscription`
unmeasured/assumed rare, `billing` 28, `due` unmeasured, `reminders` unmeasured).

Three riskiest assumptions:
1. favcrm (8,514 Smithery uses, a full CRM/invoicing product) is scored as "weak overlap"
   by judgment, not measurement — it may already ship recurring invoicing as a CRM feature,
   which would make this niche less empty than the instrument shows.
2. Demand is the imputed 640/191 median, not measured for this specific recurring-billing
   intent; freelancers who invoice ad hoc (most of the target market, per every prior
   INTEL round's freelancer framing) may not want a define-once scheduler at all.
3. `invoice_generate_due` without any send capability (no email/SMS) may not clear the bar
   for "reminder" value a user expects from a scheduler — local_value 0.7 assumes the
   generate+list loop is worth using manually, which is unverified.

### Pick 2 — contract-clause-library

fit 39.5, worst-case 16.83 (second-highest worst-case, and the cleanest single-token rarity
signal measured this round: `clause` = 2 registry hits total, the rarest token found in R4,
matching the same class as R3's `proposal` = 2 and `slots`/`world-clock` = 0).

Tools (10): `clause_add`, `clause_get`, `clause_update`, `clause_delete`, `clause_list`,
`clause_search` (full-text over title/body/tags), `clause_import` (bulk from
markdown/JSON), `clause_export`, `contract_assemble` (ordered clause IDs + placeholder fill
-> docx via the shared docx writer), `license_status`/`license_activate`.

Free/Pro split: free = up to 10 stored clauses, manual assemble. Pro = unlimited clauses,
tag/jurisdiction filters, import/export, multi-document assemble.

Registry name: `io.github.theluckystrike/contract-clause-library-proposal-template-docx`
(tokens spent, rarest first: `clause` 2, `proposal` 2 — reused from the docx server, shared
capability — `contract` 94, `library` unmeasured, `template` 181, `docx` 20).

Three riskiest assumptions:
1. `clause` = 2 registry hits may undercount real competitors that never use the literal
   word "clause" in their server name (e.g. a generic "legal-mcp" or "contract-generator")
   — same undercount class R3 flagged for docx-generator vs docx-editor naming.
2. Assumes freelancers will maintain a separate JSON clause store rather than continuing to
   copy-paste from a previous signed contract in Word — an unmeasured workflow-adoption
   assumption, not a supply/demand fact.
3. local_value is scored 1.0, but a real legal clause library's value partly comes from
   lawyer-vetted, jurisdiction-compliant content; ours ships empty and the user populates
   it themselves, so day-one value is likely lower than a populated competitor's, unlike
   the ECB/VIES-style servers where the data source itself is the whole value.

Runner-up not picked: calendar-ics-reader (fit 37.0, worst-case 23.0 — highest worst-case
of the round) was close behind on score but weaker on office-suite pairing (0.6, ties only
to the timezone server) and its underlying token (`ics`) is the one R3 already flagged as
substring-noisy; the compound `ics-reader` measured 0 hits, which is a thinner data point
than `clause`'s 2.

## Failures

- The R1/R3 Smithery-count script read `total`/`len(servers)` from a call with no
  `pageSize` param, which defaults to a 10-row page and carries no total field — every
  Smithery count in this round's raw first pass silently returned exactly 10. Found by
  inspecting the raw response and fixed by adding `&pageSize=100` and reading
  `pagination.totalCount`. R1/R3's Smithery totals (158-247 range) already used the correct
  field, so this was a fresh-script bug this round, not an inherited one; flagging here in
  case the next round reuses this script.
- npm registry rate-limited (HTTP 429) after ~20 concurrent requests; fixed by sequential
  `curl` with a 3s gap for the last 4 tokens.
- `pipeworx/gateway` (2,530 tools) surfaces as the nominal #1 Smithery result for several
  unrelated queries (`ics reader`, `journal`) purely because its tool count is large enough
  to match almost any query; excluded from the "best real top use" column throughout, same
  treatment R1 gives it in Part A.

## RESULT.md schema block

```
status: DONE
evidence: Registry (full cursor pagination): 30 new tokens counted; clause=2 is the
  rarest measured this round. Smithery: 20 queries re-run with pagination.totalCount
  (script bug found and fixed: unpaginated call silently returns a 10-row page with no
  total field). npm: top-250 substring counts for 20 tokens (0-14 range, still not
  saturated). GitHub: 17 gh api search/repositories queries, 0-433 total_count range.
artifacts: docs/INTEL_R4.md, data/intel_r4.json
cost: 25 wall minutes (hard cap)
failures: see Failures section above (Smithery pagination bug, npm 429s, gateway outlier
  contaminating two queries)
insight: the two picks (recurring-invoice-scheduler, contract-clause-library) both score
  higher on worst-case fit than every already-shipped server's original R1 fit score
  except expense-tracker, and both avoid the trap the vat-validator and csv-dedupe rows
  fell into: a real direct competitor (OjasKord/vat-validator-mcp; googlesheets) already
  occupying the exact niche despite a promising raw score.
```
