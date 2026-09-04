# Gate classification: volume/export stays Pro, guardrails go free with a cap

Driver: **D-R55** (docs/USER_VALUE_R11.md). A Pro gate on `recurring_detect` did not stop the
answer, it stripped the server's knowledge out of it: the model hand-computed cadence from
`transactions_list` and annualised two charges fourteen days apart to about EUR 1,656/year, the
exact figure `cadence_confirmed: false` exists to withhold. Gating a guardrail removes the
guardrail, not the answer.

Rule applied to every gate in all 17 servers with a licence gate (`office-suite` has none):

- **volume/export** - unlimited rows, files, PDFs, history depth, custom columns, branding: stays Pro.
- **guardrail/analysis** - a check, detection, comparison or report the user otherwise computes by
  hand and gets wrong: free with a modest cap, and the response names the cap and the Pro extension
  in one line. Never a bare gate.

## Changed: guardrail gates that now answer free

| Server | Tool | Before | After | Cap |
| --- | --- | --- | --- | --- |
| bank-statement | `recurring_detect` | refused entirely, upgrade text only | answers, `free_tier_note` names the cap | last 3 months, 5 recurring charges |
| bank-statement | `reconcile_expenses` | refused entirely, upgrade text only | answers over the most recent slice of the range asked for | 31 days at a time |
| quotes | `quote_report` | `isError`, upgrade text only | answers with counts, totals per currency and both win rates | current calendar year to date |
| calendar | `conflicts` | refused when the window was over 31 days | window shortened and answered, note names what was covered | first 31 days of the window asked for |
| currency | `rate_history` | refused when the span was over 90 days | window shortened to the free 90 days and answered | last 90 days (refused only when the whole window is older) |
| clauses | `clause_search` (jurisdiction) | the whole search was refused if `jurisdiction` was passed | jurisdiction filtering is free: citing a clause from the wrong jurisdiction is the error it prevents | none |
| clauses | `clause_search` (tags) | the whole search was refused if `tags` was passed | search runs without the tag filter and says so | tag filter stays Pro |

## Unchanged: volume/export gates that stay Pro

| Server | Gate | Class |
| --- | --- | --- |
| bank-statement | 2 accounts, 12 months read back, 5 category rules, `statement_export` | volume, export |
| calendar | 2 calendars, 31-day read window, 50 events per export, import from a URL | volume, export, ingest |
| clauses | 10 own clauses, clause version history, JSON import/export, 8 clauses per assembly | volume, export |
| currency | `rate_on` for a date older than 90 days | history depth |
| docx | brand colour, template placeholder count | branding, volume |
| expense-tracker | project count, rule count, 12-month window, xlsx format, export row cap, rebill item cap | volume, export |
| image | output megapixels, batch size, custom watermark text | volume, branding |
| invoice | invoices per month, custom invoice prefix, unbranded PDF with logo | volume, branding |
| kanban | project and open-task caps, `weekly_review` for past weeks, `columns_set` | volume, history depth, custom columns |
| pdf | merge file count, page count, custom stamp text, business footer, `pdf_reorder` | volume, branding |
| price-tracker | watch count, observation history depth, refreshing every watch in one call | volume |
| quotes | 5 open quotes, `quote_pdf`, PDF branding | volume, export, branding |
| recurring | active schedule cap, `schedule_history`, branded PDF | volume, history depth, branding |
| resume | profile variants, non-default styles, accent colour, cover letters per month, job-posting length | volume, branding |
| spreadsheet | rows and bytes read, rows written | volume |
| time-tracker | 7-day free window, rated project count | volume |
| timezone | contact count, participant count, ICS files per month, recurring-slot search | volume |

Already correct before this pass, kept as the model for the rule:

- `image_dominant_colors` answers with the top 3 rather than refusing (measured in docs/IMAGE_AUDIT.md:
  the refusal made the model invent hex codes "from viewing the image").
- `recurring.upcoming` and `recurring.forecast` truncate and name the cap (D-R39, D-R7).
- `timezone.find_meeting_slots` shortens the search rather than refusing (D-R30).
- `time-tracker.report`, `invoice_summary` and tag grouping are free inside the 7-day window (D-R22, D-11).
- `invoice.overdue_report` and `kanban.overdue` were already free and unlimited.

## Counts

| | Before | After |
| --- | --- | --- |
| Servers with a licence gate | 17 | 17 |
| Tools that refused a guardrail/analysis answer outright | 6 (`recurring_detect`, `reconcile_expenses`, `quote_report`, `conflicts` over 31 days, `rate_history` over 90 days, `clause_search` with a filter) | 0 |
| Guardrail/analysis tools answering free with a named cap | 6 (`image_dominant_colors`, `upcoming`, `forecast`, `find_meeting_slots`, `report`, `overdue`) | 13 |
| Volume/export/branding gates left Pro | 41 | 41 |

## Verification

- `npm test` green per changed server: bank-statement 40/40, quotes 29 pass + 1 skipped,
  calendar 50/50, currency 41 pass + 1 skipped, clauses 33 pass + 1 skipped.
- `node scripts/validate.mjs`: **399/399** (run 50), with the three probes that asserted the old
  gates updated to assert the new capped answers (quotes `quote_report`, bank-statement
  `recurring_detect`, currency 91-day `rate_history`).
