# R7 Registry coverage — orchestrator-run (2026-09-29)

Subagent (deleg_f2e4659d) emitted zero tool calls — pure deliberation churn. Orchestrator ran the workstream directly.

## Method
`curl https://registry.modelcontextprotocol.io/v0/servers?search=io.github.theluckystrike/<name>&version=latest` per name; filter status=active and exact name match. Note: naive 'servers[0].version' gives None — version lives at server['server']['version'].

## Result: FULL COVERAGE — 45/45 checked names active (15/15 of the unverified batch)

| name | status |
|---|---|
| bank-statement | active@0.22.1 |
| barcode | active@0.22.1 |
| bill-of-sale | active@0.22.0 |
| billing-docs | active@0.22.1 |
| calendar | active@0.21.0 |
| cash-book | active@0.22.0 |
| catalogue | active@0.22.0 |
| mileage-log | active@0.22.0 |
| maintenance-log | active@0.22.0 |
| work-order | active@0.22.0 |
| kanban | active@0.22.1 |
| price-tracker* | active@0.22.4 (as price-tracker-drop-alert-watch) |
| spreadsheet* | active@0.21.1 (as spreadsheet-builder) |
| time-tracker* | active@0.22.4 (as time-tracker-timesheet-billable-hours) |
| invoice* | active@0.21.1 (as invoice-generator) |

*The 4 'missing' names are NOT missing — the server dirs were renamed (old short names deprecated@0.1.1, new long-tail names active). Local server.json name fields match the long-tail names.

## Conclusion
No publish needed. Zero stale rows (calendar@0.21.0 is the local version too — spot-consistent). Combined with earlier R7 check (30+36 names) the fleet's official-registry coverage is effectively complete for all server dirs.
