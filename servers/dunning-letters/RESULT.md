status: DONE
evidence:
- /Users/mike/mcp-servers/node_modules/.bin/tsc -p tsconfig.json: exit 0, no output, 1s wall (run twice, before and after the subject fix)
- node --test test/*.test.mjs: # tests 1 / # pass 1 / # fail 0; duration_ms 222; 1s wall
- Sequential stdio probe (test/_client.mjs client, sandboxed XDG_DATA_HOME), worked chase INV-1042 USD 1,250.00 due 2026-06-01, gaps 7/14/21:
  - invoice_register: DUN-2026-0001, schedule 2026-06-08 / 2026-06-15 / 2026-06-22
  - letter_render on 2026-07-01: stage 1, late_fee USD 25.00 (2500 minor = 125000 * 2% * 30/30), total USD 1,275.00
  - letter_sent 2026-06-08: reminder 1 recorded; next action reminder 2 at 2026-06-15
  - payment_record 50000 on 2026-06-20: outstanding USD 750.00, status open
  - letter_render html on 2026-07-01: stage 2, fee_minor 1500, total_minor 76500, doctype true, client name escaped
  - chase_today on 2026-07-01: send_now=1 (DUN-2026-0001: reminder 2)
  - aging_summary on 2026-07-01: USD 750.00, bucket 1-30 = 1 invoice, all others 0
  - invoice_status by reference "INV-1042": resolves to DUN-2026-0001, days_late 30
  - invoice_delete: deleted; a later invoice_status answers isError true
- Errors return in the envelope ("Error: ...", isError: true); nothing is thrown across the transport (smoke test asserts it)
artifacts:
- /Users/mike/mcp-servers/servers/dunning-letters (src: index.ts, engine.ts, letters.ts, store.ts, lib.ts, version.ts; test: _client.mjs, smoke.test.mjs; package.json, tsconfig.json, server.json, smithery.yaml, Dockerfile, LICENSE, README.md, RESULT.md)
cost: 55 wall minutes including a quota pause; measured command timings above
failures:
- First verification harness piped eight JSON-RPC calls into stdio at once; the SDK runs
  tools/call handlers concurrently, so letter_render and aging_summary ran before
  invoice_register's locked write landed and answered "Known: none" / unpaid_invoices 0.
  The server was correct (loud isError, store intact); the harness was fixed to await each
  call, which is how real MCP clients behave
- letter_render's JSON omitted the letter subject (it existed only inside the markdown and
  the HTML title); found by the sequential probe printing subj: undefined; added as a
  top-level field and verified: "Payment reminder: invoice INV-1042 for USD 1,250.00"
- letters.ts carried an unused local and a needless .valueOf() cast; removed on self-review
  before the first compile
insight:
- Concurrently piped stdio requests interleave with the file lock: a dependent call in the
  same pipe can read the register before an earlier call's locked write lands. Every
  read-modify-write in this server is under withFileLock, so the register itself stays
  consistent, but harnesses that batch writes and reads into one pipe will observe
  out-of-order results; test over stdio with one in-flight call, as test/_client.mjs does
