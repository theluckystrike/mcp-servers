# Loop 34: candidate new-server fields, round 1

Measured 2026-09-11. Purpose: pick the next 4 servers to build by measuring how contested
each candidate's buyer query is in GitHub repository search, per the strategy in
`docs/GH_SEARCH_R2.md` (small fields are winnable on query-term coverage; contested fields
are star-gated and not winnable).

## Method

One buyer query per candidate, measured with:

    gh api -X GET search/repositories -f q='<query>' -F per_page=10 --jq '.total_count'

Top-3 rows come from the same response (`.items[0:3] | .[] | {full_name, stargazers_count}`).
Name coverage is the fraction of query terms present in the repo name (hyphens/underscores
treated as spaces), computed in `scripts/loop34-fields.mjs`. Calls spaced 5s; the search
budget was checked before and after:

    gh api rate_limit --jq '.resources.search'
    before: {"limit":30,"remaining":30,"used":0}
    after:  {"limit":30,"remaining":30,"used":0}  (window had reset; 21 calls made)

Positive control: `gh api -X GET search/repositories -f q=modelcontextprotocol -F per_page=5`
returned total_count 1249, first hit `modelcontextprotocol/modelcontextprotocol`, so the
instrument was live and zeros below are real zeros.

Existing coverage checked with:

    gh repo list theluckystrike --limit 100 --json name --jq '.[].name'
    ls /Users/mike/mcp-servers/servers

No candidate exists as a repo under theluckystrike or as a folder under `servers/`.
Raw API output: `data/loop34_fields_raw.json`. Scored rows: `data/loop34_fields.json`.

## Winnability rule

A candidate is BUILDABLE when its buyer query has total_count < 100 AND at least one top-3
repo has < 50 stars (no star wall) AND no top-3 repo carries the full query phrase in its
name at high stars.

## The table

| rank | candidate | query | total_count | top-3 (stars, name coverage) | buildable |
|---|---|---|---|---|---|
| 1 | bill-of-sale | mcp bill of sale | 0 | (empty field) | yes |
| 2 | supplier-list | mcp supplier list | 0 | (empty field) | yes |
| 3 | job-card | mcp job card | 2 | 0/0.67, 0/0.00 | yes |
| 4 | credit-note | mcp credit note | 3 | 0/0.33 (ours, mcp-billing-docs), 0/0.33, 0/0.00 | yes |
| 5 | mileage-log | mcp mileage | 4 | 0/0.50 (ours, mcp-expense-tracker), 0/0.50, 1/0.00 | yes |
| 6 | service-agreement | mcp service agreement | 4 | 2/0.33, 0/0.00, 0/0.00 | yes |
| 7 | maintenance-log | mcp maintenance log | 4 | 0/0.67, 0/0.67, 0/0.00 | yes |
| 8 | dunning-letters | mcp dunning | 7 | 9/0.00, 1/0.50, 2/0.00 | yes |
| 9 | rate-card | mcp rate card | 10 | 8/0.67, 0/0.67, 0/0.33 (ours, mcp-catalogue) | yes |
| 10 | meeting-minutes | mcp meeting minutes | 14 | 1472/0.33, 11/0.33, 1/0.67 | yes (see note) |
| 11 | warranty-tracker | mcp warranty | 14 | 9/0.50, 8/0.50, 0/1.00 | yes (see note) |
| 12 | purchase-order | mcp purchase order | 16 | 9/0.33, 2/1.00, 8/0.33 | yes (see note) |
| 13 | sitemap-of-clients | mcp client directory | 41 | 239/0.33, 2/0.67, 1/0.33 | yes |
| 14 | agenda | mcp agenda | 67 | 253/0.00, 5/1.00, 12/1.00 | yes (see note) |
| 15 | timesheet | mcp timesheet | 78 | 38/0.50, 3/0.50, 6/0.50 | yes |
| - | proposal | mcp proposal | 204 | 826/0.50, 64/0.50, 12/0.50 | no, field >= 100 |
| - | estimate | mcp estimate | 204 | 141/0.50, 248/0.00, 55/0.50 | no, field >= 100 |
| - | receipt-book | mcp receipt | 236 | 443/0.00, 58/0.50, 130/0.00 | no, field >= 100 |
| - | inventory-list | mcp inventory | 719 | 140/0.50, 97/0.50, 327/0.50 | no, field >= 100 |
| - | contract-builder | mcp contract | 1344 | 312/0.50, 158/0.00, 96/0.50 | no, field >= 100 |

Notes on rows that pass the rule but carry a caveat:

- **meeting-minutes (10):** rank 1 is `silverstein/minutes` at 1472 stars with 0.33 name
  coverage. The rule passes it (two top-3 repos under 50 stars, no full-coverage incumbent),
  but that is a star-heavy incumbent on a small field; treat as the weakest buildable row.
- **warranty-tracker (11):** `zavora-ai/mcp-warranty` already has 1.00 name coverage at 0
  stars. We would tie its coverage, not beat it.
- **purchase-order (12):** `iabhiroop/MCP_PurchaseOrderFlow` has 1.00 name coverage at 2
  stars. Same tie problem.
- **agenda (14):** two of the top 3 already carry 1.00 name coverage.

Duplicates of existing servers were deprioritized in the ranking but not excluded:
mileage-log overlaps mcp-expense-tracker (already rank 1 on `mcp mileage`), rate-card
overlaps mcp-catalogue (rank 3 on `mcp rate card`), timesheet is adjacent to
mcp-time-tracker, proposal/estimate/receipt-book overlap mcp-quotes and mcp-expense-tracker
and fail the field-size gate anyway.

## The 4 picks

Ranked by field size ascending, then buyer-intent clarity for a freelancer.

1. **bill-of-sale** — field 0: the query `mcp bill of sale` returns nothing at all, so a
   repo named for it is the only result by construction; clear single-document buyer intent.
2. **supplier-list** — field 0: the only other empty field; weakest paperwork intent of the
   four but zero competition.
3. **job-card** — field 2, both incumbents at 0 stars with at most 0.67 name coverage;
   clear field-service paperwork intent.
4. **credit-note** — field 3, every incumbent at 0 stars; we already hold rank 1 with
   mcp-billing-docs at 0.33 name coverage, and a dedicated repo out-covers it on the
   invoice-adjacent document every freelancer eventually needs.

Next in line if any pick is rejected: service-agreement (field 4), maintenance-log
(field 4), dunning-letters (field 7).

## The query each new repo must fully cover

Name + description + topics must carry every term of the buyer query (the small-field
winning shape from `docs/GH_SEARCH_R2.md`):

| repo | query to fully cover | name coverage of repo name |
|---|---|---|
| mcp-bill-of-sale | mcp bill of sale | 1.00 (4 of 4 terms) |
| mcp-supplier-list | mcp supplier list | 1.00 (3 of 3 terms) |
| mcp-job-card | mcp job card | 1.00 (3 of 3 terms) |
| mcp-credit-note | mcp credit note | 1.00 (3 of 3 terms) |

Descriptions and topics must additionally repeat the full phrase (e.g. topics
`bill-of-sale`, `bill`, `sale`, `mcp`; description opening with the phrase verbatim).
