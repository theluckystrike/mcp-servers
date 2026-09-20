# DIST R36 — S58 (2026-09-20): mcpservers.org resubmission wave

## Outcome: verified-green (submissions) / pending (publication)

## What was done
- Resubmitted 10 flagship servers through mcpservers.org /submit form (free lane):
  quotes, calendar, expense-tracker, pdf, resume, barcode, currency, image, spreadsheet, time-tracker
- Each submission verified 'Submission Successful!' (in-page confirmation, fetch to /_serverFn observed)
- Invoice resubmitted as an 11th (already has a live listing from earlier waves)
- d2 baseline: quotes listing URL (tree pattern) = 'Panel Not Found' pre-publication, as expected —
  S57 established only 4/46 listing pages actually exist despite 46 'accepted' confirmations

## Hypothesis under test
Original S49-S53 acceptances did not publish listing pages for 42/46 servers. This wave re-files the
10 highest-value flags (invoice/quotes/pdf/resume/time-tracker/spreadsheet/etc are the same 10 that
already have percall listings). If listing pages appear within days, the form lane works and we
re-file the remaining 32. If not, mcpservers.org free lane is effectively dead weight -> de-prioritize
and shift that effort to machine-verifiable surfaces (percall pattern: 10/10 verified live).

## KPI snapshot (S58 close)
- mcpservers.org listings verified live: 4/46 (S57 probe) — unchanged pending S59 recheck
- percall: 10/10 listings live (cap reached)
- Official MCP registry: 30 entries; 19 missing (mcp-publisher auth blocked, needs user device-OAuth)
- Backlinks live: 20 README badges (S56) + 4 mcpservers.org badges (S57) + 10 percall (S54)

## Next (S59)
1. Recheck 10 resubmitted slugs' listing pages (browser-only; curl 403)
2. If published: badge + amplify; if not: mark lane unreliable, pivot S59 to amplification + site SEO
3. Standing user unlock: GitHub device-OAuth for mcp-publisher (2 min, ~19 registry listings)
