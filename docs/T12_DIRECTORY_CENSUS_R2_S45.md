# T12 DIRECTORY CENSUS R2 — S45

STATUS: complete
Date: 2026-09-19. All probes browser-UA curl, positive controls run for every zero.

## mcp.so — NOT LISTED, and now PAID-ONLY (decision change)
- Our servers still 404 (invoice-pdf-billing-generator, excel-spreadsheet-xlsx-csv,
  office-suite); positive control /server/github → 200. Consistent with T9 finding.
- NEW INTEL from /submit page: organic submissions now require a **$39 one-time
  publishing fee** for immediate publish. Page also mentions a review path but the
  headline flow is paid. Issues #4227/#4228 (open, 0 comments) were the free route.
- Stats they publish: DR 72, 2.2M unique visitors/12mo, 6M pageviews, 266K MAU.
  $39 for a dofollow link on DR72 is defensible spend but HUMAN-GATED (money).
  Logged as an S46 buy-decision for the user, not actioned.

## mcpmarket.com — search returns 0 results (JS-rendered; count grep = boilerplate only)
- Earlier finding stands: requires account + $29 tier for site link → HUMAN-GATED.

## opentools.ai — inconclusive (search fully JS-rendered); /submit is 404.
- Has "Submit a Tool" link in nav (client-side route). Low priority vs other channels.

## smithery.ai — /@theluckystrike 404. Smithery requires package publishing to their
- registry format; earlier sprints deferred. Candidate if npm publish happens (S46).

## Summary of distribution surfaces status (as of 2026-09-19)
- Official MCP registry: 42/42 VERIFIED (0.22.0) ✓
- MCP Playground: 42/42 submitted, review-gated ✓ (pending)
- Glama: 13/42 (their ingest lag — T11) — weekly recheck
- mcp.so: 0/42, free route stalled in issues; $39 paid route now exists (user decision)
- mcpmux PR #300: open/pending
- mcpmarket: gated on account ($29)
- smithery: not listed; needs npm publish first

## Recommended next autonomous win
Nothing free remains unactioned on this front except weekly rechecks. The two
unlockable levers are both human decisions: (a) $39 mcp.so paid listing, (b) npm
publish enabling Smithery + Glama freshness signals. Flag both in dashboard.
