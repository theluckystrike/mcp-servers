# VARIANTS_LOOP35 - phrase-variant registry names for the 8 blind-question servers

Date: 2026-09-12. Agent: registry-variants, loop 35 wave A. Owns: this file,
data/variants_plan.json, data/organic_variant_probes.json, data/variants_stage/.

## What was published in wave A (no worker change needed)

16 stdio-only registry variants, 2 per target server, all at v0.21.0, all carrying the
mcpb package of the parent (real release asset, real sha256), no remotes[]:

| parent | variants | blind-question phrase they carry |
| --- | --- | --- |
| invoice | invoice-generator, freelance-invoice | "generate an invoice PDF for my freelance clients" (Q1) |
| pdf | merge-pdf, split-pdf | "merges and splits PDF files" (Q2) |
| time-tracker | time-tracking, timesheets | "time tracking and timesheets" (Q7) |
| expense-tracker | business-expenses, mileage-tracker | "track my business expenses and mileage" (Q3) |
| spreadsheet | spreadsheet-builder, spreadsheet-generator | "builds a spreadsheet from data" (Q10) |
| currency | currency-exchange, exchange-rates | "convert currencies with real exchange rates" (Q8) |
| quotes | quote-template, estimate-template | "fill in a quote or estimate template" (Q6) |
| bank-statement | bank-statement-pdf, categorize-transactions | "read a bank statement PDF and categorise the transactions" (Q4) |

Publish command: `mcp-publisher login github --token "$(gh auth token)"` then
`mcp-publisher publish data/variants_stage/<slug>.json` per manifest. Staged in data/
rather than servers/<d>/ because the loop-35 brief forbids this agent editing server
dirs; registry-publish-all.mjs only scans servers/, so mcp-publisher was called
directly with the same auth pattern the script uses.

Why stdio-only, again: the registry rejects a second row reusing the parent's remote
URL (400 "remote URL ... is already used", measured NAMING_R2; trap 9), and the worker
route table keys SERVERS by exact name so /mcp/<alias> 404s today (negative control:
POST /mcp/invoice-generator initialize -> 404). A hosted variant therefore needs BOTH
a worker route entry AND its own remote URL, which is wave C.

## Verification (all commands and results in data/organic_variant_probes.json)

- Availability pre-publish: GET versions/latest for each slug -> 404 (free); controls:
  invoices-invoicing -> 200, nonsense name -> 404.
- Exact GET post-publish: all 16 resolve 200 @ 0.21.0.
- Search reprobe after 3-minute index lag: 12 of 16 tokens are rank 1 of 1;
  time-tracking 2 of 2, currency-exchange 2 of 2, invoice-generator 6 of 6,
  exchange-rates 11 of 12. Under p = min(1, 10/rank): 15 tokens at p=1.0,
  exchange-rates at 0.909. Token matched-to-us went 0/16 -> 16/16.
- Parent hosted endpoints: initialize -> 200 on all 8 (invoice, pdf, time-tracker,
  expense-tracker, spreadsheet, currency, quotes, bank-statement); tools/call without
  token -> 401 on invoice. This is the infra the wave-C hosted variants alias onto.
- Contest notes: invoice-generator has 2 incumbents (CSOAI invoice-generator-ai-mcp,
  amehiny/invoice-generator); time-tracking 1 (ai.timix); currency-exchange 1
  (datakoot); exchange-rates 3 distinct (12 version rows). The other 12 tokens had
  zero rows registry-wide before publish.

## Queued for wave C (data/variants_plan.json, mechanically apply)

1. Routing patch to remote/src/index.ts (two hunks, exact old/new text in the plan):
   a VARIANT_ALIASES map after the SERVERS literal, and one-line canonicalization of
   `product` at the endpoint lookup. Aliases deliberately do NOT enter SERVERS, so
   ENDPOINT_URLS, SERVER_COUNT and the /mcp index are unchanged (no KPI double-count).
   Canonicalization happens before authenticate(), so per-product MCPL1 licenses and
   tenant documents behave byte-identically to the parent.
2. 16 hosted manifests (same name + remotes[] pointing at /mcp/<slug>). Because
   (name, version) is immutable and <slug>@0.21.0 is now live stdio-only, each hosted
   row must publish at the NEXT estate version; copy version/identifier/fileSha256
   from the parent's server.mcpb.json at publish time. Publish only AFTER the deploy.

## KPI note

kpi.json "Registry findable share" (50%, target 60%) is recomputed by the
orchestrator. Contribution this wave: 16 net-new tokens, all matched, 15 at p=1.0.
Whether they join the tracked set is the wave-D measurement's call; the before/after
probe rows are in data/organic_variant_probes.json.
