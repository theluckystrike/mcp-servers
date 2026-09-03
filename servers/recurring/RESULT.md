status: DONE

evidence:
```
$ npm run build -w servers/invoice        # tsc --declaration, emits dist/lib.d.ts
$ npm run build -w servers/recurring
$ npm test -w servers/invoice -w servers/recurring
> @theluckystrike/mcp-invoice@0.3.2 test
# tests 28
# pass 28
# fail 0
# duration_ms 1369.256625
> @theluckystrike/mcp-recurring@0.4.0 test
# tests 13
# pass 13
# fail 0
# duration_ms 791.075416
```
period.test.mjs (10 cases): monthly from 2026-01-31 = 01-31, 02-28, 03-31, 04-30, 05-31, 06-30
(clamp not carried forward); quarterly from 2026-01-31 = 01-31, 04-30, 07-31, 10-31, 2027-01-31;
yearly from 2028-02-29 = 02-29, 02-28, 02-28, 02-28, 2032-02-29; weekly across a year boundary;
{days:10} and {days:1} across a February; end_date inclusive proven both ways (end_date 2026-04-15
yields the 04-15 occurrence, 2026-04-14 drops it); anchor_day/end_of_month; anchored first
occurrence before start_date dropped.

smoke.test.mjs: initialize -> serverInfo.name "mcp-recurring"; tools/list carries the 13 tools and
does NOT carry business_set; schedule_create monthly 12 h x 90 EUR from the 1st of 3 months ago;
invoice_generate_due dry_run reports 4, writes nothing; the real run reports "created 4 invoices,
skipped 0", 4 unique INV-2026-NNNN numbers, EUR 1080.00 each; 4 PDFs exist, > 800 bytes, first 5
bytes "%PDF-"; the invoice server's invoices.json holds exactly those 4 with total_minor 108000; a
SECOND mcp-invoice process on the same XDG_DATA_HOME returns them from invoice_list with client
"Acme Retainer"; the second generate_due reports "created 0 invoices, skipped 4" and invoices.json
still holds 4; free forecast clamps 12 -> 3 months; recurring://upcoming reads; schedule_history is
Pro-gated on free; free tier refuses the 4th active schedule ("free tier allows 3") and a Pro key
from scripts/sign-license.mjs creates it, plus anchor_day 31 -> first period 2026-01-31 and a
12-month forecast.

concurrency.test.mjs: 3 monthly schedules x 12 periods, two processes call invoice_generate_due
{as_of: "2026-12-31"} simultaneously on one data dir; the two runs create 36 between them, 36
invoices with 36 unique numbers in the invoice store, 36 history rows with 36 unique
(schedule_id, period) keys, and a third run reports "created 0 invoices, skipped 36".

artifacts:
- /Users/mike/mcp-servers/servers/recurring/ (src/{index,period,store}.ts, test/{period,smoke,concurrency}.test.mjs,
  package.json, tsconfig.json, README.md, LICENSE, server.json, server.mcpb.json, smithery.yaml,
  Dockerfile, glama.json, llms-install.md, RESULT.md)
- /Users/mike/mcp-servers/servers/invoice/src/lib.ts (engine as a stable API) and the "exports"
  block + --declaration build flag in /Users/mike/mcp-servers/servers/invoice/package.json
- /Users/mike/mcp-servers/assets/recurring-logo.png (400x400, "RI")

cost: 42 wall minutes

failures:
- tsc TS18048 on the invoice_generate_due result union: the not-found branch returned {error} while
  the success branch returned {rows, skipped, dry}, so result.skipped was possibly undefined at the
  call site. Fixed by throwing inside the lock instead of returning an error shape; the existing
  outer catch turns it into the same isError result.
- The first smoke run asserted on invoices.json immediately after the dry run and died on ENOENT.
  That was the test being wrong about a real property: a dry run must create no file at all, so the
  assertion became existsSync(...) === false, which is the stronger check.

insight: the idempotency key has to be (schedule_id, occurrence date), not "has this schedule been
generated since some timestamp". A paused schedule resumed after two months, or a run with an
as_of far in the past, both produce periods out of chronological order, and any last-generated
watermark would silently swallow them. Keying on the period makes catching up and re-running the
same billing run the same operation, which is why the second run in the smoke test is a no-op
rather than 4 duplicate invoices. The cost is that history.json is load-bearing: read as empty it
would re-bill every period ever covered, so it goes through the invoice engine's corrupt-marker
quarantine rather than a plain read with a [] fallback, and schedule_delete deliberately keeps its
rows.
