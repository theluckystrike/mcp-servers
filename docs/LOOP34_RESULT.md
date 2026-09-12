# LOOP 34 RESULT — 2026-09-12

Orchestrated loop, 12 agents total (6 wave-1 + 4 builders + wiring + hosted-wiring), all
numbers below carry their commands in the cited files.

## Shipped

**Four new servers, end to end, same day.** Picked by measurement, not taste
(docs/LOOP34_FIELDS_R1.md: GitHub repo-search field sizes for 20 candidates; the four sit on
fields of 0, 3, 2 and 7 results): **bill-of-sale**, **credit-note**, **job-card**,
**dunning-letters**. Each: full CONVENTIONS contract, contract suites 19/19, 17/17, 20/20,
18/18, live-hosted on the worker with real mutating `tools/call` through the advertised URL
shape with a minted token (BOS-2026-0001, CN-DRAFT-2026-0001, JC-2026-0001, DUN-2026-0001
recorded; no-token control 401), mirror repo created and released at v0.21.0, mcpb bundle on
the monorepo release (38 assets), storefront product page + setup pages + buy flow live, and
EIGHT registry names verified at 0.21.0 by exact GET (4 primaries + the phrase variants
bill-of-sale-generator, credit-memo, job-card-template, overdue-invoice-reminder).

**The rename experiment ran.** mcp-invoice -> mcp-invoice-generator (docs/RENAME_TEST_PLAN_R1.md).
Baseline measured, override hook in all three repo-name derivation points, redirect verified,
T0 re-measure: **rank 6 -> rank 2** on `mcp invoice generator` (field 11), controls flat
(quotes 69/399, deposits 3/24). Success criterion is rank <= 3 at T+7d and T+14d;
`MEASURE_ONLY=t7d scripts/rename-invoice-test.sh`.

**Distribution.** 5 PRs opened and verified OPEN (Chat2AnyLLM/awesome-mcp-servers#22 with
`make ci` green quoted, zencoderai/zenagents-library#31, jaw9c/awesome-remote-mcp-servers#769,
Appnova-EU-OU/awesome-remote-mcp-servers#614 with their CI replicated locally,
composio-community/awesome-claude-plugins#465). Loop-33's Sagargupta16#88 confirmed MERGED.
Gemini CLI gallery verified already-live end to end (30/30 hosted mirrors carry the topic and
a schema-valid gemini-extension.json; httpUrl launch with the token settings prompt; control
401 without). toolhive-catalog measured NOT compliant (SHA pinning + caret ranges) — decision
recorded in the operator pack.

## Measured movement

| KPI | was (9/10) | now (9/12) |
|---|---|---|
| Registry names at latest | 91 | 97 |
| Hosted endpoints | 30 of 33 | **34 of 37 [met]** |
| Live validation | 1028/1028 | **1135/1135** |
| Hosted tenants with data | 583 | 616 |
| Anon tokens minted | 123 | 130 |
| Named by a blind assistant | 0/18 | 0/18 (R2) |
| Paid sessions | 0 | 0 |

Blind R2 (docs/BLIND_RECOMMENDATION_R2.md): still 0 named, but the failure shape changed —
our Glama connector was RETRIEVED on Q1 and Q16 (the two wedge questions) and passed over.
Retrieval is no longer the whole story; the connector surface loses to GitHub repos when
read. Glama /mcp/servers/ census: 1 of 34 mirrors has the page assistants actually cite;
ingestion is GitHub-OAuth gated -> operator pack item 1.

## Fixed in passing

- release-check word table ended at thirty-six; the 37-server bundle gate could never pass.
- validate.mjs's new bill-of-sale finalize check matched `"status": "final"` against a
  JSON.stringify'd envelope (escaped quotes) and could never pass; fixed to unescape first,
  reproducing the estate's own boRT pattern. Server behavior was correct; the test was wrong.
- sync-mirrors.sh override hook's first version read an unexported env var and died
  KeyError: ROOT; the fail-fast caught it before any mirror was touched.
- Pre-existing gaps closed by the wiring pass: checklist/packing-list/delivery-schedule setup
  pages, compare notes (7 honest dated compare_none after registry probes), 6 demo gifs +
  6 logos (the 4 new + checklist + packing-list).
- Hosted shim SERVER_COUNT drift 33 -> 37.

## What did not move

Paid sessions 0. Google impressions 0. Named-by-assistant 0/18. The audience constraint from
CLAUDE.md stands; this loop widened every surface that feeds it (34 hosted endpoints, 99+
registry rows, 38 mirrors, 5 open catalogue PRs, Gemini gallery rows) and started the one
controlled experiment (rename) with a visible T0 effect.

Operator pack: docs/OPERATOR_ACTIONS_LOOP34.md (Glama OAuth first, then npm login).
