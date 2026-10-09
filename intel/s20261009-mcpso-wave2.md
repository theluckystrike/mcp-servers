# mcp.so wave 2 — remaining mcp.zovo.one servers via GitHub issues

Date: 2026-10-09
Repo route: https://github.com/chatmcp/mcpso (issues, free — no payment filed)
Deliverable: this file
Manifest: intel/s20261009-mcpso-wave2-manifest.json (40 entries)
Issue log: intel/s20261009-mcpso-wave2-issues.json

STATUS: complete

## Submitted — 40 of 40

Wave 2 = all hosted servers in `data/distribution.json` (40 hosted keys) minus
the wave-1 five (invoice, pdf, time-tracker, spreadsheet, quotes). All 40 filed
2026-10-09 via `gh issue create -R chatmcp/mcpso`, exit 0, URL returned:

| Server | Issue |
|---|---|
| amortization | https://github.com/chatmcp/mcpso/issues/4966 |
| asset-register | https://github.com/chatmcp/mcpso/issues/4967 |
| bank-statement | https://github.com/chatmcp/mcpso/issues/4968 |
| barcode | https://github.com/chatmcp/mcpso/issues/4969 |
| bill-of-sale | https://github.com/chatmcp/mcpso/issues/4970 |
| billing-docs | https://github.com/chatmcp/mcpso/issues/4971 |
| calendar | https://github.com/chatmcp/mcpso/issues/4972 |
| cash-book | https://github.com/chatmcp/mcpso/issues/4973 |
| catalogue | https://github.com/chatmcp/mcpso/issues/4974 |
| change-order | https://github.com/chatmcp/mcpso/issues/4975 |
| checklist | https://github.com/chatmcp/mcpso/issues/4976 |
| clauses | https://github.com/chatmcp/mcpso/issues/4977 |
| credit-note | https://github.com/chatmcp/mcpso/issues/4978 |
| currency | https://github.com/chatmcp/mcpso/issues/4979 |
| delivery-schedule | https://github.com/chatmcp/mcpso/issues/4980 |
| deposits | https://github.com/chatmcp/mcpso/issues/4981 |
| docx | https://github.com/chatmcp/mcpso/issues/4982 |
| dunning-letters | https://github.com/chatmcp/mcpso/issues/4983 |
| expense-tracker | https://github.com/chatmcp/mcpso/issues/4984 |
| goods-receipt | https://github.com/chatmcp/mcpso/issues/4985 |
| image | https://github.com/chatmcp/mcpso/issues/4986 |
| job-card | https://github.com/chatmcp/mcpso/issues/4987 |
| kanban | https://github.com/chatmcp/mcpso/issues/4988 |
| leave | https://github.com/chatmcp/mcpso/issues/4989 |
| maintenance-log | https://github.com/chatmcp/mcpso/issues/4990 |
| mileage-log | https://github.com/chatmcp/mcpso/issues/4991 |
| onboarding | https://github.com/chatmcp/mcpso/issues/4992 |
| packing-list | https://github.com/chatmcp/mcpso/issues/4993 |
| per-diem | https://github.com/chatmcp/mcpso/issues/4994 |
| petty-cash | https://github.com/chatmcp/mcpso/issues/4995 |
| price-tracker | https://github.com/chatmcp/mcpso/issues/4996 |
| purchase-requisition | https://github.com/chatmcp/mcpso/issues/4997 |
| recurring | https://github.com/chatmcp/mcpso/issues/4998 |
| resume | https://github.com/chatmcp/mcpso/issues/4999 |
| service-agreement | https://github.com/chatmcp/mcpso/issues/5000 |
| statement-of-account | https://github.com/chatmcp/mcpso/issues/5001 |
| supplier-list | https://github.com/chatmcp/mcpso/issues/5002 |
| timezone | https://github.com/chatmcp/mcpso/issues/5003 |
| work-order | https://github.com/chatmcp/mcpso/issues/5004 |
| zip | https://github.com/chatmcp/mcpso/issues/5005 |

(Counts and URL check: `python3` over intel/s20261009-mcpso-wave2-issues.json →
`total 40 ok 40 bad 0`.)

## Failed

none.

## Skipped

- invoice, pdf, time-tracker, spreadsheet, quotes — already submitted in wave 1
  on 2026-10-08 (issues #4945–#4949 per intel/s20261008-mcpso.md); excluded to
  avoid duplicates.

## Evidence

- Pre-flight: `curl -X POST https://mcp.zovo.one/mcp/<slug> … initialize` →
  HTTP 200 with `serverInfo.name` for all 40 hosted endpoints (2026-10-09).
- Repo check: `gh auth status` → logged in as theluckystrike;
  `gh issue list -R chatmcp/mcpso` intake live before filing.
- Per-issue result: returncode 0 + issue URL captured in
  intel/s20261009-mcpso-wave2-issues.json (40 ok / 0 bad).
- Same-day merge to mcp.so not verifiable: maintainer-processed queue
  (~4900 open issues). Re-check in 1–2 weeks at https://mcp.so/search?q=zovo.

## Conclusion

Wave 2 complete: every remaining hosted mcp.zovo.one server (40) submitted free
via the chatmcp/mcpso GitHub-issue route; fleet-wide mcp.so coverage is now all
45 hosted servers. No paid tier purchased.
