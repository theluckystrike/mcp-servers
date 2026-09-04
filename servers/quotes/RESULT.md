status: DONE

evidence:
- `npm install` (root, workspaces): `added 1 package in 448ms`
- `npm run build -w servers/quotes`: `tsc -p tsconfig.json --declaration` clean, no output. dist 92K
- `npm test -w servers/quotes`: `# tests 25 / # pass 24 / # fail 0 / # skipped 1 / # duration_ms 2542.5`,
  wall `npm test 2.707 total`
  - test/smoke.test.mjs 6 tests: tools/list is the 11 expected names and serverInfo.version equals package.json;
    create 12 x EUR 90.00 + EUR 300.00 at 23% = EUR 1697.40, revise to 20 h = EUR 2214.00, text export carries no
    bare number, accept -> INV-2026-0001 written into the INVOICE data dir with total_minor 221400 and lines
    byte-identical to the quote's; accept with no invoice store returns invoice_create args in MAJOR units
    (unit_price 90, 300); decline + report gives win rate 50 and JPY 300000 held as 0-decimal; free tier 5 open
    quotes then refusal with the checkout URL, declining one frees the slot, quote_pdf and quote_report refused;
    Pro renders a 21 KB %PDF- file with no footer credit
  - test/adversarial.test.mjs 10 tests: 12 refusal cases with nothing written (no quotes.json on disk), unsafe
    total refused, two currencies on one quote refused, accept twice never makes a second invoice, expired accept
    refused with the lapse in days and both documented fixes, 6 expired quotes do not consume free open slots,
    ambiguous client ref returns the candidates, stdout JSON-RPC only on the error paths, a VAT rate change
    between quote and acceptance does not move the agreed total, quote_pdf to a directory refuses and the
    session survives
  - test/corrupt.test.mjs 2 tests: truncated quotes.json quarantined byte-for-byte, marker blocks quote_list /
    quote_get / quote_accept as well as writes, no fresh quotes.json appears; a counter.json reset to {} cannot
    reissue an id already on a quote
  - test/concurrency.test.mjs 1 test: two processes, 40 quote_create on one data dir, 40 quotes, 40 unique ids,
    counter Q-2026 = 40
  - test/contract.test.mjs 6 tests (1 skipped, no row-capped write tool): stdout JSON-RPC only, 11 tool
    descriptions all within 220 chars and emoji-free, the file-arg tool (quote_pdf) opens imperatively, corrupt
    store quarantine, free/Pro switch including a key signed for another product
- `node scripts/sync-versions.mjs --check`: clean; serverInfo reads VERSION from the generated src/version.ts
- Scale, measured on a 200-line quote (`/private/tmp/.../probe3.mjs`): quote_create 8 ms, quote_pdf 47 ms for a
  21,213-byte PDF, quotes.json 79,106 bytes, quote_send_text under 1 ms

artifacts:
- /Users/mike/mcp-servers/servers/quotes/src/{index.ts,store.ts,day.ts,pdf.ts,lib.ts,version.ts}
- /Users/mike/mcp-servers/servers/quotes/test/{harness.mjs,smoke,adversarial,corrupt,concurrency,contract}.test.mjs
- /Users/mike/mcp-servers/servers/quotes/{package.json,tsconfig.json,README.md,SPEC.md,LICENSE,server.json,
  server.mcpb.json,smithery.yaml,glama.json,Dockerfile,llms-install.md,RESULT.md}
- /Users/mike/mcp-servers/docs/QUOTES_RESULT.md (adversarial audit, Part 1)

cost: 58 wall minutes

failures:
- The pasteable text totals block was aligned against the description column width, so a long VAT label
  ("VAT 23% on EUR 1800.00") pushed its amount 12 characters right of the line amounts. Fixed by right-aligning
  the totals labels against a computed column so the amount column lands under the line amounts for any
  description width.
- The `out_path: "../../../../etc/passwd"` probe cannot be run in this sandbox: a raw
  `createWriteStream("/etc/passwd")` emits neither `open` nor `error` within 5 s under the macOS seatbelt, so the
  tool call times out with no response. Reported UNMEASURABLE in the audit rather than PASS. The measurable
  neighbour (a directory as out_path) returns `EISDIR` and the session survives.

insight:
- Copying an accepted quote's stored lines into the invoice, instead of recomputing them, is worth money and the
  amount is measurable. A quote of EUR 1,000.00 net issued while the shared business profile's
  `default_tax_rate` is 23% gives the client EUR 1,230.00. Change that profile field to 8% before the client
  answers -- a rate change, a new client class, a corrected setting -- and a recompute-at-acceptance invoice
  reads EUR 1,080.00: EUR 150.00 under the document they agreed to, with nothing on either record explaining the
  gap. The shared profile is what makes this suite coherent AND what makes it dangerous to read twice.
