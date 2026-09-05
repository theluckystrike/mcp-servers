# Round 13: wire mcp-billing-docs into the estate, guide, demo GIF, logo, Docker + Cline

status: DONE

date: 2026-09-05. Scope: everything outside `servers/billing-docs/` that the server's own build round
(docs/BILLING_DOCS_RESULT.md) listed as "not done here (orchestrator)", plus the two content pieces and the
two marketplace submissions. `remote/**` was owned by another agent this round and shipped
`/mcp/billing-docs` mid-round, which changed two of these checks; that is recorded below rather than
smoothed over.

`node scripts/release-check.mjs` -> **green, 0 recorded gaps**, 20 servers at 0.9.5, 25 checks each.
`node scripts/validate.mjs` -> **510/510** (run 50), billing-docs 34/34 in 553 ms.
`billing/` test suite -> **62/62**.

## A. The thirteen gaps from docs/BILLING_DOCS_RESULT.md

The list that file left, in its order, with what closed each one.

- **`scripts/gen-spec.mjs` CURATED + SERVERS.** `"billing-docs"` added to `SERVERS` and a curated block
  added with the `summary`, three `storageFiles`, `primaryFile: "credit-notes.json"`, four `caps` and six
  `extra` invariants, all lifted from the committed SPEC.md rather than reinvented. `node
  scripts/gen-spec.mjs billing-docs` now reproduces the file, with one improvement: the committed SPEC.md
  said `_No README.md._` under Free vs Pro because it was generated before the README existed, and the
  regeneration picks the real table up. That is the whole diff (7 insertions, 1 deletion).

- **office-suite `CHILDREN`.** One row, `{ id: "billing-docs", pkg: "@theluckystrike/mcp-billing-docs",
  optional: true }`. Optional children resolve from the monorepo path first, so no dependency was added to
  `servers/office-suite/package.json`. Rebuilt and read back over stdio: the bundle now lists **198 tools**
  and the stderr line reads `proxying [... zip, billing-docs], 196 tools`. All twelve billing-docs tools come
  through under their bare names; the only two prefixed collisions are still `invoice_business_set` and
  `docx_business_set`.

- **`scripts/build-mcpb.sh`.** `billing-docs` appended to `SERVERS`, `[billing-docs]="Billing Docs"` to
  `DISPLAY_NAME`, and
  `[billing-docs]='["mcp","model-context-protocol","credit-note","purchase-order","invoice","vat","accounting"]'`
  to `KEYWORDS`. The bundle build itself was not run (release chain, out of scope), so
  `bundles/billing-docs.mcpb` does not exist and `server.mcpb.json` still carries `fileSha256: "TBD"`.
  `data/distribution.json` records `mcpb: pending` and says so.

- **`scripts/sync-mirrors.sh`.** `billing-docs` added to `ALL_SERVERS` before `office-suite`, which stays
  last, and `billing-docs) echo "credit-note purchase-order invoicing vat" ;;` to `topics_for`. Not run.

- **`data/facts.json`.** `servers["billing-docs"]` added with the same eight keys as every other server,
  `free` and `pro` copied from the README's Free vs Pro table. `build-pages.mjs` dereferences
  `facts.servers[id]` with no guard, so this had to land before the page build.

- **`scripts/build-pages.mjs` + billing deploy.** `"billing-docs"` appended to `ids`; the build reports
  20 pages, 348,465 bytes. Deployed three times as the round progressed (the last being version
  `a1912b3b-1a7f-467e-a8b3-a00f95ccb74a`). Verified live on mcp.zovo.one:
  ```
  /s/billing-docs                                        200  <title>MCP Billing Docs for Claude, Cursor and any MCP client
  /buy/billing-docs                                      303 -> https://checkout.stripe.com/f/pay/cs_live_a1hyyXsb6b6tFIESPCSzmmVx...
  /guides/credit-notes-and-purchase-orders-from-chat     200
  /setup/claude-desktop/billing-docs                     200
  /setup/claude-web/billing-docs                         200
  /sitemap.xml   contains https://mcp.zovo.one/s/billing-docs
  /llms.txt      - [MCP Billing Docs](https://mcp.zovo.one/s/billing-docs): Credit notes and purchase orders...
                 - [Twenty-server bundle, $39 lifetime](https://mcp.zovo.one/bundle): saves $341 against buying all 20 singly
  /bundle        20 &times; $19 = $380; the bundle is $39, a saving of $341.
  ```

- **`data/tools.json`.** Generated from a live `tools/list` over stdio against
  `servers/billing-docs/dist/index.js`, not from `src` or SPEC.md. Twelve entries; the two `license_*` tools
  are filtered out, matching every other server's entry in the file.

- **Stripe `PRODUCTS`.** `"billing-docs"` added with the price the operator provisioned,
  `price_1UCCo9JKCamubEm1TyBUQdzO`, name `MCP Billing Docs Pro`, payload `billing-docs`, $19, and `free` /
  `pro` sentences written from the server README's Free vs Pro table. `FREE_FIVE_WORDS` gained
  `"Five documents a month, unlimited text"` for the /bundle table.

- **`SETUP_SERVERS` + six `ANGLE` entries.** One `SETUP_SERVERS` block (title, slug, 14 tools, package,
  sPage, tagline, does, three prompts, free, pro, and the mixed-VAT measurement as `measured`) and one
  `ANGLE` block with a distinct paragraph for each of claude-desktop, claude-code, cursor, vscode, windsurf
  and cline. 42 setup pages now, up from 40.

- **`COMPARE`.** No comparison page: the honest search finds no competitor. Cleared through the
  self-expiring `compare_none` note in `data/facts.json` rather than a `WAIVERS` entry, per the mechanism
  release-check documents, with today's date, twelve tokens (`credit-note`, `credit note`,
  `purchase-order`, `purchase order`, `po`, `debit note`, `refund`, `invoice reversal`, `procurement`,
  `supplier order`, `goods receipt`, `accounts payable`) and a 30-day TTL. Nothing in the registry writes a
  credit note against an invoice or raises a purchase order: `credit` returns credit-scoring and API-credit
  meters, `purchase order` returns e-commerce order lookups, `procurement` returns RFP text search. The note
  expires in 30 days so a competitor that appears later is re-probed rather than excused forever.

- **A guide.** `/guides/credit-notes-and-purchase-orders-from-chat`, "Credit notes and purchase orders from
  chat, against your real invoices", 7.8 KB of HTML and six FAQ entries. Its centre is the measured insight
  below. It also carries the three ways to credit and why two of them copy rather than recompute, the
  over-credit refusal quoted verbatim, why the link lives on the credit note and not on the invoice, partial
  receiving, and the `CN-YYYY-NNNN` numbering argument. The guide index description gained
  "credit notes and purchase orders".

- **Demo GIF.** `assets/demo-billing-docs.gif`, **154,595 bytes (151.0 KB)**, GIF89a 900x480, under the
  400 KB cap. `scripts/demo/billing-docs.tape` is byte-identical in settings to the other nineteen
  (900x480, Dracula, FontSize 13, 40ms typing, `Sleep 10s`), and `scripts/demo/drive.mjs` gained a
  `billing-docs` sequence that seeds `business.json`, `clients.json` and a mixed-VAT `invoices.json` into
  the run's invoice data directory, the same way `servers/billing-docs/test/_client.mjs` and the existing
  `quotes` sequence do. Three free-tier beats: a EUR 177.00 credit against the mixed-VAT invoice showing the
  split across 8% and 23%; a second credit for EUR 2,000.00 refused with the full remaining-amount sentence
  printed unedited; and a purchase order created and then partially received. The final frame was extracted
  with ffmpeg and read: all three beats are on screen and legible, 19 rows against the roughly 29 that fit.
  Linked from `servers/billing-docs/README.md` between the intro and `## Install`, and from the root
  README's demo table immediately before the office-suite row.

- **Logo.** `assets/billing-docs-logo.png`, 400x400, 1,494 bytes, the letters `CN` in the house style: a
  two-letter 5x7 bitmap in white at 26 px per cell, first letter at x0=55 y0=109, 30 px gap. The glyphs were
  extracted from the existing marks by sampling cell centres rather than redrawn, so the estate's unusual
  `N` is reproduced deliberately. Ground `#4a5d16`; all 20 existing grounds were sampled first and the
  nearest is `#1e5a32` (spreadsheet) at Euclidean RGB distance 52.2, the largest minimum distance available
  in a palette that is otherwise blues, teals, greens, two oranges, three purples and two wine reds.

## B. Twenty, and $341, derived rather than typed

`billing/src/index.js` already computed `SERVER_COUNT` and `BUNDLE_SAVING_USD` from `PRODUCTS`. Three
strings did not use them, and all three went wrong in the same commit:

- `PRODUCTS.bundle.desc` read `"Saves $322 against buying nineteen."` as a literal inside the object
  literal. It cannot reference `BUNDLE_SAVING_USD` from inside its own initialiser, so the field is now
  empty in the literal and assigned immediately after `SERVER_COUNT`, `BUNDLE_SAVING_USD` and `NUMBER_WORD`
  exist. `countWord()` is exported for the same reason the numbers are.
- `/llms.txt` had `Nineteen-server bundle` hard-coded next to a computed saving on the same line.
- `billing/test/bundle.test.mjs` and `billing/test/checkout.test.mjs` pinned `19`, `nineteen`, `$322` and
  `19 &times; $19 = $361` as literals, in eight assertions.

The tests now derive the same way the copy does, with the arithmetic asserted instead of the answer:
`BUNDLE_SAVING_USD === single total - bundle price` **and** `=== SERVER_COUNT * 19 - 39`, plus a floor of
`SERVER_COUNT >= 20` so the suite cannot pass by deriving from an empty catalogue. One literal is kept on
purpose, `assert.match(checkoutDescription("bundle"), /^Twenty MCP servers/)`, so a broken `NUMBER_WORD`
lookup that silently fell back to `"20"` would still fail.

This is the failure that release-check's estate-wide assertion was written for, and it caught all of it in
one line before any of it shipped:

```
FAIL  PRODUCTS.bundle names the right count and saving
  estate  ...: per-server prices are not uniform: 19, ; desc does not name the saving $341
  (20 x $19 - $39); desc does not name the server count 20 (twenty)
```

The `per-server prices are not uniform: 19, ` fragment is the same defect seen from the other side: the
twentieth server existed in `servers/` before it existed in `PRODUCTS`, so `PRODUCTS[s]?.usd` was
`undefined`.

## C. Round 19: the measurement the product page quotes

`billing/test/first-five.test.mjs` failed on four assertions the moment billing-docs entered `ids`, because
every `/s/<id>` page carries a "First five minutes" section built out of `data/user_value_r*.json` and no
round had ever covered this server. That is not a wiring gap that can be edited into a list: the section
quotes a verbatim prompt and a sentence of that scenario's own evidence, so it needed a real run.

`data/user_value_r19.json`: six natural-language prompts through the `claude` CLI 2.1.261 as MCP client,
`-p --model sonnet --strict-mcp-config --max-turns 12`, two stdio servers (`billing-docs` and `invoice`) on
a fresh `XDG_DATA_HOME` with `MCP_LICENSE_KEY` empty, 26 explicit `mcp__<server>__<tool>` allowlist entries
written out by name, the CLI's own file and web tools denied, one conversation via `--session-id` then
`--resume`, empty working directory. Seeded by direct JSON-RPC: the business profile, one client, the
mixed-VAT `INV-2026-0001` and a plain `INV-2026-0002`.

**16 of 18, 9 tool calls, 57.8 s, zero tool errors.** b1 credit in full 3, b2 the EUR 177.00 partial 3,
b3 the over-credit 1, b4 purchase order 3, b5 partial receipt 3, b6 overdue deliveries 3.

The one lost scenario is a client-side defect, recorded as D-R86: on b3 the model refused the over-credit
itself, without calling the tool, and its own paraphrase contained a fabricated figure (it said a further
EUR 1,700.00 would take total credits to EUR 3,400.00; the sum is EUR 1,877.00). The decision and the
EUR 1,593.00 remaining were right and nothing was stored, and a direct probe afterwards confirms the
server's refusal text is correct and better written than the paraphrase. b6 never reached the Pro gate
because the model answered from the free `purchase_order_list` and was right to (nothing was overdue); the
gate itself is asserted separately in `scripts/validate.mjs`.

## D. validate.mjs probes

A `billing-docs` block at the head of `PROBES`, **17 checks per tier, 34 total, 553 ms**, plus
`"billing-docs"` added to the `/buy/<product>` list in the billing section. The invoice store is seeded
directly rather than by spawning `servers/invoice`, so a failure here means billing-docs failed. Both
invoices are written with the engine's own field shapes; the first is mixed-VAT on purpose, because a
single-rate invoice cannot show the thing worth probing.

1. `credit_note_create {amount_minor: 17700}` against EUR 1,770.00 of consulting at 23% plus print at 8%:
   asserts `EUR -177.00`, **both** rate lines verbatim (`8% on EUR -50.00 = EUR -4.00` and
   `23% on EUR -100.00 = EUR -23.00`) and `"still_creditable": "EUR 1593.00"`. A regression to one blended
   rate fails here rather than passing on the gross.
2. One cent past the remainder (`159301`): refused, `can still be credited`,
   `refund, not a credit note`, `Nothing was stored`.
3. A full credit note on the second invoice copies its own `EUR -1107.00`, gets a different id, and a second
   full credit of the same invoice is refused.
4. `credit_note_text` is free on both tiers and carries no buy link.
5. `purchase_order_create` of 40 x EUR 4.90 and 8 x EUR 42.00 at 23%: `"net": "EUR 532.00"`,
   `23% on EUR 532.00 = EUR 122.36`, `"total": "EUR 654.36"`.
6. A partial receipt leaves the order `partially_received` with the note on the record; receiving in full
   twice is refused and names the date of the first full receipt.
7. Report gate, written per tier: free must match `mcp.zovo.one/buy/billing-docs` and must NOT contain
   `"credited"`, Pro must contain the credited total. Same shape for `credit_note_pdf`: Pro writes a file
   over 1 KB, free names the buy link and `cn.pdf` does not exist afterwards.
8. The free cap counts credit notes and purchase orders together: three documents already exist, so the
   fourth and fifth land and the sixth is refused naming the count and the buy link, while Pro gets
   `PO-2026-0004`. A document dated in October is not blocked by September's five, on either tier.

Two assertions were wrong on the first run and both were wrong about the server's own output, not about the
server: the VAT rate is rendered `"tax_rate": "23%"` as a string, not `"rate": 23`, and the purchase order
totals EUR 532.00 net (40 x 4.90 = 196.00 plus 8 x 42.00 = 336.00), not the EUR 536.00 I had arithmetic for.
Both were found by running the probe standalone before adding it to the file, which is why they cost a
minute rather than a full 510-check run.

## E. Docker MCP catalog, Cline marketplace, distribution

Order mattered and rounds 8, 9 and 11 recorded why: **mcp-servers was pushed first, then the fork was
repinned to the pushed HEAD.** The pin is `05dfa1871b42e2132cca70eb02ad853158d7b7d2`, the first commit that
contains `servers/billing-docs/Dockerfile` and `assets/billing-docs-logo.png` together, taken from
`git rev-parse origin/main` after a fetch and confirmed with `git cat-file -e <sha>:<path>` for both.

Docker MCP catalog (docker/mcp-registry PR #4892, fork theluckystrike/mcp-registry branch
`add-theluckystrike-mcp-servers`, clone reused at /private/tmp/docker-mcp-registry, remote `fork`).

- `git -c rebase.autoStash=true pull --rebase` first: up to date.
- Added `servers/billing-docs/{server.yaml,tools.json}`. `about.description` quoted from the start, so the
  colon-space YAML trap did not recur. Category `finance`, matching invoice, quotes, recurring and
  bank-statement rather than zip's `productivity`. No `directory` key, matching the servers whose Dockerfile
  builds from the repo root and copies its workspace siblings. Secret named `billing-docs.license_key`.
  `tools.json` generated from a live stdio `tools/list` against `dist/index.js`: 14 tools with their
  argument names, types and descriptions.
- All **20** entries repinned, both `commit:` and the icon URL. The loop was written as
  `grep -rl ... | while read -r f` from the start, per round 9's zsh word-splitting failure, and the count
  was verified three ways: 20 files matched, 20 `commit:` lines carry the sha, 20 icon URLs carry it, with
  zero placeholders and zero stale 40-hex shas left in any theluckystrike line.
- **The raw HEAD guard ran before the fork push**: one `curl -o /dev/null -w '%{http_code}'` per entry
  against `raw.githubusercontent.com/theluckystrike/mcp-servers/<pinned sha>/<dockerfile>` and against the
  icon URL. 40 requests, all 200, `raw-check fail=0`. This is what catches an entry pinned to a commit that
  predates its own Dockerfile, which `cmd/validate` cannot see.
- `go run ./cmd/validate --name <n>` for all 20: **20/20 green** (`npm_config_cache` exported to
  /private/tmp/npmcache per the round-5 fix). Run in two batches because the first shell call hit a 2 minute
  timeout after 16 entries.
- Fork commit `02e4b0e` "Add billing-docs server; repin all 20 to 05dfa18", pushed `ef26f59..02e4b0e`.
  PR #4892 updates from the branch, still one PR, now twenty servers; state OPEN, mergeable MERGEABLE.
- PR body: read with `gh pr view 4892 --json body`, patched to add billing-docs to the Server Names line,
  add one table row after the zip row, change three "nineteen" to "twenty" and move the pin from `9513023`
  to `05dfa18`; written back with `gh pr edit --body-file` and re-read: 3 occurrences of "twenty", 0 of
  "nineteen". Not rewritten.

Cline marketplace: https://github.com/cline/mcp-marketplace/issues/2439, same template and the same
honest-checkbox pattern as the nineteen prior submissions ("installed from the README" unchecked because the
npm package is unpublished, "stable" checked), free-tier limits quoted verbatim from the README's Free vs
Pro table, `servers/billing-docs/llms-install.md` confirmed present before writing the issue, and its own
dedicated logo URL at the pinned sha (verified 200) so it needed no icon caveat. The working claim in the
issue was proved first rather than asserted: a real `purchase_order_create` plus `purchase_order_list`
against a clean `XDG_DATA_HOME` produced `PO-2026-0001` at EUR 369.00, status `open`. That probe's first
attempt failed on `supplier_name` / `unit_price` / `expected_delivery`, where the live schema wants
`supplier` / `unit_price_minor` / `expected_delivery_date`, which is exactly why `tools.json` has to come
from the live server and never from SPEC.md.


`data/distribution.json`: `per_server["billing-docs"]` added with the eleven surface keys. `hosted` records
the endpoint the remote agent shipped this round; `registry`, `github-mirror`, `smithery` and `glama` are
`pending`; `mcpb` records `pending` with the reason (`fileSha256` is `TBD` until the bundle is built).

Paid surfaces: none encountered, none submitted. Zero paid API calls.

## F. Caused by this round, and fixed inside it

The remote agent shipped `/mcp/billing-docs` while this round was running, which added
`servers/billing-docs/remotes.json` and turned three green checks red:

```
billing-docs  remotes: server.mcpb.json has no remotes block
billing-docs  web: WEB_EXCLUDED lists billing-docs although it is hosted
estate  every hosted server has a claude-web page: no WEB_ANGLE for billing-docs
```

All three were correct. `billing-docs` had been put in `WEB_EXCLUDED` deliberately, because at the time it
was not hosted and a claude-web setup page would have advertised an endpoint that did not exist; the moment
it was hosted, that same entry became the lie in the other direction. It was removed, a `WEB_ANGLE`
paragraph written, and the `remotes` block merged into `server.mcpb.json` byte-equal to `remotes.json`.

Adding a twentieth child also made the office-suite setup pages stale: they said nineteen children and
186 tools. `billing/src/setup.js` now says twenty and 198, verified by reading `tools/list` off the rebuilt
bundle rather than by adding 12 to 186. The two sentences that report the six-prompt cross-server audit keep
`186`, because that is the number of tools that audit actually ran against; changing it would turn a
measurement into a guess.

## Open, named rather than hidden

- `billing/src/content.js` still carries the guide `one-install-nineteen-servers-office-suite`, whose slug,
  title and body say nineteen and 186. The slug is a live URL and the body is a narrative of one dated audit
  round, so rewriting it is a content job with a redirect attached, not a find and replace. Recorded here
  rather than half-done.
- `bundles/billing-docs.mcpb` is not built and `server.mcpb.json` carries `fileSha256: "TBD"`. That is the
  release chain, which this round does not run.
- `scripts/sync-mirrors.sh` and `scripts/build-mcpb.sh` are wired but were not executed.
- npm publication, the MCP registry entry and the Smithery/Glama listings are all `pending` for this server.

## Measured insight

**A wiring list that is checked by a script and a wiring list that is checked by a person fail differently,
and the difference is which half of a pair goes stale.**

Every gap docs/BILLING_DOCS_RESULT.md handed over was a one-line omission in a list, and
`scripts/release-check.mjs` named all thirteen of them before a single edit was made, by server and by
check. None of those thirteen cost more than a minute. What actually cost time this round was the class of
thing the script could only see from one side: `PRODUCTS.bundle.desc` said "nineteen" and "$322" in prose
while `SERVER_COUNT` and `BUNDLE_SAVING_USD` sat two lines below it computing 20 and 341, and eight test
assertions pinned the stale literals so that the tests would have gone green on the wrong numbers if the
estate assertion had not existed. The prose and the arithmetic were both in the same file, thirty lines
apart, and neither knew about the other.

The general form: a derived value and a hand-written sentence describing it are a pair, and a checker that
reads only the derived value proves nothing about the sentence. The fix is not more checks, it is deleting
one side of the pair, which is what `PRODUCTS.bundle.desc = ...` and `countWord()` do. Where the sentence
genuinely cannot be derived, because it reports a measurement rather than a state, the right move is the
opposite one: leave the number alone and let it disagree with the current count, as the office-suite audit
sentences now do at 186 tools against 198 installed. A stale measurement is a fact about the past. A stale
derived number is a bug.

The corollary the round-19 requirement makes concrete: `first-five.test.mjs` is the one check in this repo
that a wiring edit cannot satisfy. Adding `"billing-docs"` to a list is what turned it red, and the only
thing that turned it green was running six real prompts through a real client and writing down what came
back, including the one that scored 1.

artifacts:
- /Users/mike/mcp-servers/scripts/gen-spec.mjs, scripts/build-mcpb.sh, scripts/sync-mirrors.sh, scripts/build-pages.mjs, scripts/validate.mjs
- /Users/mike/mcp-servers/servers/office-suite/src/index.ts
- /Users/mike/mcp-servers/billing/src/index.js, billing/src/setup.js, billing/src/content.js, billing/src/pages.js (generated)
- /Users/mike/mcp-servers/billing/test/bundle.test.mjs, billing/test/checkout.test.mjs
- /Users/mike/mcp-servers/data/facts.json, data/tools.json, data/user_value_r19.json, data/validation.json (run 50), data/distribution.json
- /Users/mike/mcp-servers/servers/billing-docs/SPEC.md, servers/billing-docs/server.mcpb.json, servers/billing-docs/README.md
- /Users/mike/mcp-servers/scripts/demo/drive.mjs, scripts/demo/billing-docs.tape, assets/demo-billing-docs.gif
- /Users/mike/mcp-servers/assets/billing-docs-logo.png
- /Users/mike/mcp-servers/README.md
- mcp-billing deployed to mcp.zovo.one, version a1912b3b-1a7f-467e-a8b3-a00f95ccb74a
- /Users/mike/mcp-servers/docs/DIST_R13_RESULT.md (this file)

Built by theluckystrike. https://github.com/theluckystrike
