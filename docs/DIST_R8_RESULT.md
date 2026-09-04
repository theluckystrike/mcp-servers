# Round 8: wire mcp-quotes into the estate, demo GIF, Docker MCP catalog + Cline marketplace

status: DONE

evidence:

## A. Wiring the 17th server into the estate

`servers/quotes` existed as a self-contained unit (docs/QUOTES_RESULT.md) with nothing outside it touched.
Seven wiring points, in the order the checklist lists them.

- **office-suite CHILDREN** (`servers/office-suite/src/index.ts`): one row appended,
  `{ id: "quotes", pkg: "@theluckystrike/mcp-quotes", optional: true }`, the same optional-flag shape
  expense-tracker, kanban, image and bank-statement use. Optional children are resolved from the monorepo
  path first, so no dependency was added to `servers/office-suite/package.json` (bank-statement, kanban and
  image are absent from it too). Rebuilt and read back over stdio: office-suite now lists **171 tools**,
  including all nine `quote_*` tools (`quote_create, quote_list, quote_get, quote_update, quote_send_text,
  quote_accept, quote_decline, quote_pdf, quote_report`).

- **scripts/build-mcpb.sh**: `quotes` appended to `SERVERS`, `[quotes]="Quotes"` to `DISPLAY_NAME`, and
  `[quotes]='["mcp","model-context-protocol","quote","estimate","proposal","invoice","vat","freelance"]'`
  to `KEYWORDS`. The bundle build itself was NOT run (release chain, out of scope this round).

- **scripts/sync-mirrors.sh**: `quotes` added to `ALL_SERVERS` (before `office-suite`, which stays last) and
  `quotes) echo "quote estimate proposal" ;;` to `topics_for`. Verified without pushing:
  `DRY_RUN=1 bash scripts/sync-mirrors.sh quotes` -> `DRY_RUN: mirror built at /var/.../mirror-quotes.imrcJp
  (not pushed)`. `tagline_for` reads `data/facts.json`, which is why the facts entry below had to exist first.

- **data/facts.json**: `servers.quotes` added (title, tagline, does, for, example, free, pro, storage), the
  same eight keys as every other server, free/pro copied from the README's Free vs Pro table verbatim
  (5 open quotes, unlimited `quote_send_text`; Pro adds unlimited quotes, PDF with logo and the report).
  `build-pages.mjs` dereferences `facts.servers[id]` with no guard, so a missing entry is a hard crash, not
  a skip.

- **scripts/build-pages.mjs + billing deploy**: `"quotes"` appended to `ids`; `node scripts/build-pages.mjs`
  -> `pages: ... bank-statement, quotes bytes 278552` (17 pages). `cd billing && npx wrangler deploy` ->
  `Uploaded mcp-billing (9.39 sec)`, version `951b1acd-6ad3-4c48-85f0-197b0da552a8`, custom domain
  mcp.zovo.one. Verified live:
  ```
  /s/quotes                 200   <title>MCP Quotes for Claude, Cursor and any MCP client</title>
  /buy/quotes               303 -> https://checkout.stripe.com/c/pay/cs_live_b1rW5FGY...
  /sitemap.xml              contains https://mcp.zovo.one/s/quotes
  /llms.txt                 - [MCP Quotes](https://mcp.zovo.one/s/quotes): ...
  ```
  Note the product path is `/s/<id>`, not `/<id>` (a bare `/quotes` is 404 for every server, including
  bank-statement). `billing/src/index.js` already carried the quotes Stripe product, so no billing source
  was edited; only the generated `billing/src/pages.js`.

- **data/tools.json**: `quotes` inserted after `bank-statement`, generated from a live `tools/list` over
  stdio JSON-RPC against `servers/quotes/dist/index.js`, not from `src` or `SPEC.md`. Nine entries; the two
  `license_*` tools are filtered out, matching every other server's entry in the file.

- **scripts/validate.mjs**: a `quotes` probe added at the head of `PROBES` (12 checks per tier, 24 total),
  and `"quotes"` added to the `/buy/<product>` list in the billing section (1 check). The probe:
  1. `quote_create` Acme Ltd, 12 x EUR 90.00 plus a EUR 300.00 setup, 23% VAT, `validity_days: 14`,
     prices in minor units -- asserts an allocated `Q-YYYY-NNNN` and the total **1697.40**.
  2. `quote_list` shows that id in state `open`.
  3. `quote_send_text` succeeds on BOTH tiers and its text carries no checkout URL (it is the free-tier
     core value; a regression that paywalled it would otherwise pass silently).
  4. Free cap: five more quotes, so the sixth open quote is the boundary -- free gets
     `mcp.zovo.one/buy/quotes`, Pro gets `Q-YYYY-0006`.
  5. Accept flow: `quote_accept` carries the agreed 1697.40 through to either an `INV-YYYY-NNNN` or
     `invoice_create_args`, then a second `quote_accept` on the same id is refused with `already accepted`.
  6. `quote_report`: gated on free with the buy URL, returns the win rate on Pro.

  `node scripts/validate.mjs` -> **395/395** (run 50 in `data/validation.json`), quotes **24/24 in 438 ms**,
  remote 46/46, billing 23/23, 19 units. The previous run (run 49, same session, before this round) was
  370/370 over 18 units; the delta of 25 is exactly the 24 quotes checks plus `buy/quotes -> 303 to Stripe`.

## B. Demo GIF

`assets/demo-quotes.gif`, **385,043 bytes (376.0 KB)**, under the 400 KB cap.

```
$ file assets/demo-quotes.gif
assets/demo-quotes.gif: GIF image data, version 89a, 900 x 480
$ ffprobe ... assets/demo-quotes.gif
width=900 height=480 avg_frame_rate=25/1 nb_frames=267
```

`scripts/demo/quotes.tape` is byte-identical in settings to the other sixteen (900x480, Dracula, FontSize 13,
40ms typing, `Sleep 10s`). `scripts/demo/drive.mjs` gained a `quotes` sequence plus the run-time Pro-key env
block (`execFileSync(process.execPath, [scripts/sign-license.mjs, "quotes"])` -> `MCP_LICENSE_KEY`), the same
pattern bank-statement uses, so `quote_pdf`/`quote_report` are genuinely unlocked in the recording rather than
showing upgrade text. Four beats: `quote_create` (Acme GmbH, 12h API work at EUR 90 plus a EUR 300 setup, 23%
VAT, 14 days -> Q-2026-0001, EUR 1697.40), `quote_send_text` (the pasteable email), `quote_accept` (becomes
INV-2026-0001), `quote_report` (pipeline and win rate).

One thing the driver had to do differently from every earlier demo: `business_set` and `client_add` are
invoice-server tools and quotes does not re-register them, so the sequence writes `business.json` and
`clients.json` straight into the sandbox's `data/mcp-servers/invoice/` before the first call. That is also
what makes `invoiceStorePresent()` true, which is why the recorded `quote_accept` creates a real invoice
instead of handing back `invoice_create_args`.

Linked from `servers/quotes/README.md` (`![quotes demo](../../assets/demo-quotes.gif)`, placed where the
invoice README places its GIF) and from the root `README.md` demo table, one row for mcp-quotes immediately
before the mcp-office-suite bundle row, same four-column format as the other sixteen.

## C. Docker MCP catalog and Cline marketplace

Docker MCP catalog (docker/mcp-registry PR #4892, fork theluckystrike/mcp-registry branch
`add-theluckystrike-mcp-servers`, clone reused at /private/tmp/docker-mcp-registry).
- `git -c rebase.autoStash=true pull --rebase` first: already up to date since round 7's push.
- Added `servers/quotes/{server.yaml,tools.json}`. `about.description` was quoted from the start, so the
  colon-space YAML trap that broke round 7's first validate did not recur. `tools.json` generated from a
  live stdio `tools/list` against `servers/quotes/dist/index.js`: 11 tools.
- No `directory` key, matching recurring and bank-statement: `servers/quotes/Dockerfile` builds from the
  repo root as context and copies its workspace siblings (`packages/mcp-license`, `servers/invoice`).
- **Icon**: `assets/quotes-logo.png` does not exist in this repo at any commit (raw URL 404). The entry
  reuses `assets/invoice-logo.png`, confirmed HTTP 200 at the pinned commit, on the grounds that quotes is
  built on the invoice engine. Recorded openly in the Cline issue and in `data/distribution.json` rather
  than left implicit. A real `quotes-logo.png` is the clean fix next round.
- All 17 entries (16 existing plus quotes) repinned, both `commit` and the icon URL, to
  `e89ac6fd0c74e62c573d5214bbebfc6f680c42e2` (origin/main HEAD from `git ls-remote`).
- `go run ./cmd/validate -name <n>` for all 17: **17/17 green**, all eleven checks each
  (`npm_config_cache` exported to /private/tmp/npmcache per the round-5 fix).
- Fork commit `c334505` "Add quotes server; pin all 17 to latest commit", pushed
  `9f85c99..c334505 add-theluckystrike-mcp-servers`. PR #4892 updates from the branch, still one PR, now
  seventeen servers; state OPEN, mergeable MERGEABLE.
- PR body: read with `gh pr view 4892 --json body`, patched to add the quotes row and bump the counts and
  commit references, then written back with `gh pr edit 4892 --body-file`. Not rewritten.

Cline marketplace: https://github.com/cline/mcp-marketplace/issues/2426 (quotes), same template and the same
honest-checkbox pattern as the sixteen prior submissions ("installed from the README" unchecked because the
npm package is unpublished, "stable" checked), free-tier limits quoted verbatim from the README's Free vs Pro
table, `servers/quotes/llms-install.md` confirmed present before writing the issue.

`data/distribution.json`: `per_server.quotes` added with the four surface keys, notes appended to
`surfaces["docker-mcp-catalog"].note` and `surfaces["cline-marketplace"].note`, `updated_at` bumped.

Paid surfaces: none encountered, none submitted.

## OPEN, and it needs the orchestrator

**The Docker catalog pin cannot yet point at a commit that contains this server.** origin/main is
`e89ac6f`; the two commits that carry `servers/quotes` (`8de23f9` the server, `c9c8255` this round's wiring)
exist only in the local checkout, and pushing is the orchestrator's job. So all 17 catalog entries are
pinned to `e89ac6f`, and Docker's build of the quotes entry will fail with a missing Dockerfile until
mcp-servers pushes. `cmd/validate` does not catch this: it checks that a commit is pinned, not that the
pinned tree contains the referenced Dockerfile. Follow-up after the push, in order: (1) repin all 17 to the
new HEAD and push the fork again, (2) add `assets/quotes-logo.png` and point the quotes entry's icon at it,
(3) flip `per_server.quotes.github` in `data/distribution.json` to `published`.

artifacts:
- /Users/mike/mcp-servers/servers/office-suite/src/index.ts
- /Users/mike/mcp-servers/scripts/build-mcpb.sh, scripts/sync-mirrors.sh, scripts/build-pages.mjs, scripts/validate.mjs
- /Users/mike/mcp-servers/data/facts.json, data/tools.json, data/validation.json (run 50), data/distribution.json
- /Users/mike/mcp-servers/billing/src/pages.js (generated), deployed as mcp-billing version 951b1acd-6ad3-4c48-85f0-197b0da552a8
- /Users/mike/mcp-servers/scripts/demo/drive.mjs, scripts/demo/quotes.tape, assets/demo-quotes.gif
- /Users/mike/mcp-servers/servers/quotes/README.md, /Users/mike/mcp-servers/README.md
- /private/tmp/docker-mcp-registry servers/quotes/{server.yaml,tools.json} (new) plus 16 server.yaml repins, fork commit c334505
- https://github.com/docker/mcp-registry/pull/4892 (updated in place, 17 entries)
- https://github.com/cline/mcp-marketplace/issues/2426
- /Users/mike/mcp-servers/docs/DIST_R8_RESULT.md (this file)

cost: 42 wall minutes

failures:
- `/quotes` returned 404 after the billing deploy. Not a defect: product pages are served at `/s/<id>`, and
  `/bank-statement` 404s identically. Checked a known-good neighbour before touching anything.
- `npm test -w @theluckystrike/mcp-office-suite` reports 1 pass, 0 fail, 4 cancelled
  ("Promise resolution is still pending but the event loop has already resolved"). Bisected: checked out
  `HEAD~1:servers/office-suite/src/index.ts`, rebuilt and re-ran, and the same four cancel identically with
  no quotes child at all. Pre-existing, not caused by this round; left for whoever owns that suite. The
  working tree was restored and rebuilt afterwards.
- The Docker pin problem in the OPEN section above.

insight: `cmd/validate` passing 17/17 is not evidence that the catalog entries build. Its "Commit is pinned"
check is satisfied by any well-formed sha; it never fetches the tree, so an entry pinned to a commit that
predates its own Dockerfile validates green and fails only in Docker's build. The cheap guard, worth adding
to this repo's own routine before the next fork push, is one `curl -o /dev/null -w '%{http_code}'` against
`raw.githubusercontent.com/<owner>/<repo>/<pinned-sha>/<dockerfile path>` per entry: it costs 17 requests
and catches exactly the class of failure that only surfaces downstream, in someone else's CI.
