# HOSTED_LOOP34 - hosted endpoints for bill-of-sale, credit-note, job-card, dunning-letters

Loop 34 wired the four servers built at 0.21.0 onto the remote worker as
`/mcp/bill-of-sale`, `/mcp/credit-note`, `/mcp/job-card` and `/mcp/dunning-letters`.
Every check below ran locally (`wrangler dev`, KV in local mode) and in process
(`node --test`). Nothing was deployed.

## Verdicts

| server | hosted | remotes.json |
| --- | --- | --- |
| bill-of-sale | PASS - behaves as the stdio build, with out_path reduced to a bare name | written |
| credit-note | PASS - no file outputs exist, so no publish rule | written |
| job-card | PASS - no file outputs exist, so no publish rule | written |
| dunning-letters | PASS - no file outputs exist, so no publish rule | written |

No server was skipped. The readSharedProfile question (bill-of-sale, dunning-letters) has
a shim answer, not a gap: `remote/src/shims/license.ts` exports `readSharedProfile`, which
reads `/profile/business.json`, and `remote/src/index.ts` hydrates that path from the
`${tenant}:profile` KV document into EVERY endpoint's request. Verified live below: a
profile written through `/mcp/invoice` business_set surfaced in `/mcp/bill-of-sale`
sale_create and in a `/mcp/dunning-letters` letter.

## Vendored files (remote/build-vendor.mjs SERVERS)

- `bill-of-sale`: index.ts, version.ts, lib.ts, render.ts, store.ts
- `credit-note`: index.ts, version.ts, jsonstore.ts, lib.ts, money.ts, note.ts, render.ts, store.ts
- `job-card`: index.ts, version.ts, card.ts, store.ts (no lib.ts exists in the stdio source)
- `dunning-letters`: index.ts, version.ts, engine.ts, letters.ts, lib.ts, store.ts

## Patches added, with why

`patchBillOfSaleIndex` (bill-of-sale index.ts), six substitutions:

1. fs import gains `mkdirSync`, because the patched outputPath creates `/out` and the stdio
   source never imported it.
2. `expandPath` reduced to the bare document name (1-64 of letters, digits, underscore,
   dash; any .md/.html extension dropped). The hosted endpoint has no disk; a path
   argument is only the stem the downloads are named with. Same rule as
   statement-of-account, work-order, catalogue.
3. `outputPath` targets `/out/<name><ext>` instead of
   `join(dataDir(), "documents", <id>)` and makes `/out` with the shim's mkdirSync. The
   exclusive-create on an explicit name and the `-2`, `-3` dedupe on a derived one are
   unchanged. The occupied-name error no longer quotes a virtual path.
4. `sale_render` description: "Files default to the server's documents folder..." becomes
   "Every file comes back as a download link valid for one hour...". A documents folder on
   a disk the caller does not have is the D-R69 species.
5. `out_path` schema description: name, not location.
6. sale_create's seller refusal: "run business_set {name} in the invoice server once"
   becomes "...on your https://mcp.zovo.one/mcp/invoice endpoint once". Hosted, the
   profile is set on the caller's own endpoint, not in a local install.

The store needed no patch: sales.json and counter.json are one document per token under
the homedir shim, written tmp + rename. The rendered files publish on the rename through
the fs shim (`publish: (p) => p.startsWith("/out/")` in SERVERS), so the download endpoint
serves rendered documents only, never the JSON store. `strip: ["/out/"]`,
`persistPublished` unset (rendered documents are transient downloads, not tenant state).

`patchDunningIndex` (dunning-letters index.ts), three substitutions:

1. The `dunning://ladder` resource reported `dir: dataDir()` - the worker's virtual
   homedir, a path no caller can open (the D-R60 species). It now reads "not a directory
   on this endpoint: the chase register is one document held per token...".
2. The same resource's description said "the one directory this server writes"; now "the
   one document this server writes".
3. The sender note "Run business_set {name} in the invoice server once..." now names
   `https://mcp.zovo.one/mcp/invoice`.

No patches for credit-note or job-card. Both were read in full: neither index.ts touches
node:fs, node:os, out_path or a local-install sentence. `credit_note_render` and
`job_card_print` return their documents inline and their descriptions say so; that is true
on both transports, so no publish rule exists for either endpoint.

No existing patch was loosened; no new server's source accidentally matched an existing
patch pattern (patches dispatch by server name, and the two new patch functions run only
for their own entries).

## Shim reuse / gaps

- fs shim: reused unchanged (existsSync, mkdirSync, readFileSync, writeFileSync,
  renameSync, unlinkSync, openSync "wx", closeSync). bill-of-sale's tmp + rename
  (`writeFileAtomic`, store writes) publishes through `renameSync` when the target matches
  the publish rule. The `.tmp` names match TMP_RE and are never persisted.
- os shim: reused unchanged (`homedir()` = /home/mcp; the stores land under
  `/home/mcp/.local/share/mcp-servers/<name>/` inside the tenant document).
- license shim: reused unchanged for createLicenseGate, withFileLock (no-op per request),
  readSharedProfile, writeSharedProfile.
- No new shim was written. No storage pattern needed one.
- EXTRA_IMPORTS: one entry, bill-of-sale gets `import { Buffer } from "node:buffer"`
  (Buffer.byteLength on the renderings; the calendar/image/barcode/zip pattern).
- LIB_RESOLUTIONS: one entry, `dunning-letters: ["asset-register", "timezone"]`.
  letters.ts and index.ts import formatMoney from `@theluckystrike/mcp-asset-register/lib`
  (vendored); store.ts imports readJsonFile from `@theluckystrike/mcp-timezone/lib`
  (vendored). Asserted on the written bytes by the build.
- VENDORED_LIBS passes for all four (no `./pdf.js` re-export anywhere).

One pre-existing drift fixed in passing: `remote/src/shims/license.ts` SERVER_COUNT was
33 while `packages/mcp-license/src/index.ts` carries 37 (37 sellable servers counted:
`createLicenseGate` present in 37 servers/*/src/index.ts). The shim comment says the two
are one number; hosted cap messages named "all 33 servers" where stdio names 37. Bumped to
37. The bundle-link test asserts the package side only; no remote test pins 33.

## Worker wiring (remote/src/index.ts)

- Four factory imports, four SERVERS entries (bill-of-sale with publish/strip; the other
  three factory-only), four TOOLS entries, four indexDoc endpoint entries.
- No sharedDoc anywhere: none of the four opens a sibling tenant document. The shared
  business profile is not a sharedDoc; it is hydrated into every endpoint already.
- BUILD_VERSION bumped 2026-09-06.1 -> 2026-09-12.1 (the tools/list cache key).

## Tests

- `remote/test/hosted-loop34.test.mjs` (new): boots each vendored createServer over the
  SDK's InMemoryTransport inside the request context and runs initialize, tools/list
  (exact names, license pair included), a mutating call chain per server, and the
  bill-of-sale render/publish path (two /out/ files published, downloads minted, HTML
  mime). The vendored timezone engine does not load under Node's strip-only mode
  (parameter properties), so a data: module stands in for `timezone/lib.js` exporting a
  readJsonFile that runs the same ENOENT-means-empty contract over the fs shim - the same
  stubbing pattern payment-hosted.test.mjs uses.
- `remote/test/vendor-paths.test.mjs` scans the four new vendored trees as written; pass.
- `node remote/build-vendor.mjs` exits cleanly (all patches applied or the build throws).
- `npm test` in remote/: 64 tests, 64 pass, 0 fail.
- `scripts/validate.mjs` hosted section: four names added to the tools/list sweep and an
  "Extension 22" probe block added after change-order's: per endpoint a mutating chain
  with figures checked (sale_finalize immutability, credit-note per-line tax rounding
  3 x 10420 + 23% = 38,450, job-card line values 11,250 + 12,999 = 24,249 and the one-step
  status rule, dunning ladder anchored to the due date 2026-08-08/15/22 and the
  no-leapfrog refusal), plus the bill-of-sale publish path fetched over HTTP. These probes
  run against the deployed worker and are the post-deploy validation (order below).
- `node --check` clean on both edited scripts.

## Local probe (wrangler dev, local KV, no deploy)

Caveat, pre-existing: wrangler 4.80 `dev` refuses remote/src/index.ts at workerd startup
("Incorrect type for map entry 'CONNECT_URL'") because the entry module has a string
named export. That export predates this loop; production accepted and validated it
(119/119, 2026-09-10 15:03). The probe therefore ran through a two-line entry that
re-exports only the default handler (`/tmp/loop34-dev-entry.ts`), with the project config:

    cd /Users/mike/mcp-servers/remote
    wrangler dev --config wrangler.toml /tmp/loop34-dev-entry.ts --port 8787 --local

Token: `anon_97683e81173e07c4c3ac69c0f6340d4b` from GET /mcp/token.

Verbatim results:

    == bill-of-sale initialize ==
    serverInfo: mcp-bill-of-sale 0.21.0
    == bill-of-sale tools/list ==
    10 tools: sale_create, sale_update, sale_finalize, sale_list, sale_get, sale_delete, sale_render, sale_summary, license_status, license_activate
    == credit-note initialize ==
    serverInfo: mcp-credit-note 0.21.0
    == credit-note tools/list ==
    10 tools: credit_note_create, credit_note_update, credit_note_finalize, credit_note_list, credit_note_get, credit_note_delete, credit_note_render, credit_note_summary, license_status, license_activate
    == job-card initialize ==
    serverInfo: mcp-job-card 0.21.0
    == job-card tools/list ==
    11 tools: job_card_create, job_card_log_labor, job_card_log_material, job_card_update_status, job_card_list, job_card_get, job_card_print, job_card_delete, job_card_summary, license_status, license_activate
    == dunning-letters initialize ==
    serverInfo: mcp-dunning-letters 0.21.0
    == dunning-letters tools/list ==
    11 tools: invoice_register, payment_record, letter_render, letter_sent, overdue_list, aging_summary, chase_today, invoice_status, invoice_delete, license_status, license_activate

Stdio counts, taken from the built dist/index.js of each server the same day: 10, 10, 11,
11. Identical.

Mutating calls (same token, one local KV):

- bill-of-sale sale_create -> `BOS-2026-0001`, `"price": "1,200.00 USD"`, `"as_is": true`.
- bill-of-sale sale_render {format: "both"} -> two download links substituted into the
  response:
  `"path": "http://mcp.zovo.one/mcp/download/bdf8cff036bc15cbe92b4e32dfd2b159 (valid 1 hour)"` (markdown, 1290 bytes)
  `"path": "http://mcp.zovo.one/mcp/download/9b2bdf4c11e4b784828310a1e6de2176 (valid 1 hour)"` (html, 4594 bytes)
  The substituted links carry the configured route's host (mcp.zovo.one) even in dev; the
  download route matches by path and answered on localhost:
  `GET /mcp/download/9b2b...` -> `status=200 type=text/html; charset=utf-8`, body starts
  `<!doctype html` and carries the DRAFT watermark (2 matches). Note: the .md download is
  served application/octet-stream; the fs shim's MIME table has no md entry. That is a
  hosted-only header with no stdio counterpart and no consumer contract; recorded, not
  patched.
- credit-note credit_note_create (3 x 10420 + 23%) -> `CN-DRAFT-2026-0001`;
  credit_note_finalize -> `"number": "CN-2026-0001"`; credit_note_render markdown ->
  `# CREDIT NOTE CN-2026-0001` ... `**Credit to:** Acme GmbH`. Inline, no file written.
- job-card job_card_create -> `JC-2026-0001`; job_card_log_labor 2.5 h @ 4500 ->
  `"value_cents": 11250`; job_card_print markdown ends with the client signature block.
- dunning-letters invoice_register -> `DUN-2026-0001`; letter_render -> stage 1,
  `"subject": "Payment reminder: invoice INV-L34-1 for USD 1,250.00"` (the asset-register
  formatMoney, imported); letter_sent stage 1; payment_record 25,000 -> reminder 2 then
  reads "...invoice INV-L34-1 for USD 1,000.00, due 2026-08-01, remains unpaid...I have
  received USD 250.00 towards it".
- Profile crossing endpoints: business_set {name: "Probe Profile Ltd"} on /mcp/invoice,
  then bill-of-sale sale_create WITHOUT seller_name -> `"seller": {"name": "Probe Profile Ltd"}`
  plus the note "came from the shared business profile"; the dunning reminder 2 is signed
  "Probe Profile Ltd".

`wrangler deploy --dry-run`: `Total Upload: 6659.94 KiB / gzip: 1508.10 KiB`, no build
errors.

## Deploy sequence for the orchestrator

Order matters (CLAUDE.md trap 8: validate only when nothing is deploying).

    cd /Users/mike/mcp-servers
    node remote/build-vendor.mjs                     # must exit cleanly (patches throw on a miss)
    cd remote && npm test                            # 64/64 green
    cd /Users/mike/mcp-servers/remote && npm run deploy    # vendors again, then wrangler deploy

Then, after the deploy has fully landed and no other deploy is in flight:

    cd /Users/mike/mcp-servers
    node scripts/validate.mjs remote                 # filtered run; exits non-zero on any failure
    # then, when the estate is quiet, the full recorded run:
    node scripts/validate.mjs

The filtered `remote` run covers the four new endpoints (tools/list sweep plus the
Extension 22 probe block) and does not write data/validation.json by design; the full run
records the pass. Only after the validation is green does the orchestrator reconcile
data/distribution.json (untouched here), and the storefront, llms.txt and registry rows
for the four new endpoints follow the existing reconciliation, not this loop.

## Files touched

- remote/build-vendor.mjs (SERVERS x4, patchBillOfSaleIndex, patchDunningIndex,
  EXTRA_IMPORTS x1, LIB_RESOLUTIONS x1, dispatch x2)
- remote/src/index.ts (imports x4, SERVERS x4, TOOLS x4, indexDoc endpoints x4,
  BUILD_VERSION)
- remote/src/shims/license.ts (SERVER_COUNT 33 -> 37)
- remote/test/hosted-loop34.test.mjs (new)
- scripts/validate.mjs (tools/list sweep names, Extension 22 hosted probes)
- servers/bill-of-sale/remotes.json, servers/credit-note/remotes.json,
  servers/job-card/remotes.json, servers/dunning-letters/remotes.json (new, invoice shape)

Not touched: data/distribution.json, billing/, scripts/sync-mirrors.sh, every
servers/<x>/src, and no git or deploy action.
