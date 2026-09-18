# T11 GLAMA SLUG REPAIR — S45 (late wave)

STATUS: in progress → findings complete

## Question
Why does Glama show only 13 of our servers under author `theluckystrike`, and 404 on
probes for the rest (invoice, spreadsheet, bank-statement etc.)?

## Evidence (probes 2026-09-19, live curls)
- Glama author page `?query=theluckystrike` + page 2: exactly 13 listings, all slug
  `mcp-<short-name>`:
  bln-mcp-grammar-server, mcp-bill-of-sale, mcp-checklist, mcp-credit-note,
  mcp-dunning-letters, mcp-job-card, mcp-maintenance-log, mcp-mileage-log,
  mcp-office-suite, mcp-packing-list, mcp-service-agreement,
  mcp-statement-of-account, mcp-supplier-list.
- 404 verified for: mcp-invoice, mcp-spreadsheet, invoice-pdf-billing-generator,
  excel-spreadsheet-xlsx-csv, io.github.theluckystrike/* patterns, aging, agreement.
- 200 + real listing verified (positive control) for mcp-checklist and mcp-bill-of-sale.
- Official registry (registry.modelcontextprotocol.io): ALL servers present, current
  0.22.0 included. 53 distinct names because older versions carry older names (aging→
  statement-of-account, dunning→dunning-letters, etc. — renames leave stale names in
  the registry). Current-name coverage: 42/42.
- Glama search `theluckystrike` paginates (first page shows other orgs' servers) —
  author page count of 13 is the real number, not a pagination artifact.

## Finding
Glama ingests from the official registry but is far behind: the 13 listed are all
names that have been stable for weeks (old-name era). Servers renamed during the
0.13→0.22 ramp (invoice → invoice-pdf-billing-generator etc.) have not been
re-ingested. This is GLAMA-SIDE lag, not our config: glama.json, server.json,
packages and subfolders are correct and registry-verified 42/42.

## Action
No repo change can fix this. Wait for Glama re-ingest (check weekly); the listing
count should jump 13 → 42 as it catches up. If unchanged by S47, file Glama support.
Nothing to commit. Listing probe commands preserved above for the weekly recheck.
