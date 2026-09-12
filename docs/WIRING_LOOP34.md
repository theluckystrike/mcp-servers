# WIRING_LOOP34 - wiring close-out for bill-of-sale, credit-note, job-card, dunning-letters

Date: 2026-09-12. Scope: the four servers built and version-synced to 0.21.0, plus the
pre-loop setup/compare gaps the loop brief names on checklist, packing-list and
delivery-schedule. Method: each file type copied from the nearest existing exemplar
(petty-cash for hosted manifests, checklist for the unhosted shape), then adapted.

## Mid-loop discovery that changed the premise

The brief said the four servers have no hosted endpoint and their mcpb manifests must not
carry a remotes block. At 08:03 local, mid-loop, the hosting loop landed
(docs/HOSTED_LOOP34.md): `servers/<x>/remotes.json` was written for all four (invoice
shape) and `remote/src/index.ts` routes `/mcp/<x>` for all four in source. Probed live
2026-09-12, all four endpoints answer 404 (`curl -X POST https://mcp.zovo.one/mcp/<x>` with
an initialize body, `-o /dev/null -w '%{http_code}'`): the worker deploy is an operator
action and has not happened. The wiring therefore follows the petty-cash hosted shape
(remotes block merged into server.mcpb.json by value from remotes.json), and the one check
that cannot be closed honestly before the deploy, `hosted-row`, carries a dated waiver.

## Per-server results

All four: `node scripts/release-check.mjs` shows `ok` on every wiring column; the only
non-ok cells are `gap` cells: `hosted-row` (waived, dated) and `first-five` (the built-in
named gap; no user_value round has exercised these servers and the section is not written
by hand).

| item | bill-of-sale | credit-note | job-card | dunning-letters |
| --- | --- | --- | --- | --- |
| server.mcpb.json | written, remotes merged | written, remotes merged | written, remotes merged | written, remotes merged |
| server.variant.json | bill-of-sale-generator (88 chars) | credit-memo (83) | job-card-template (88) | overdue-invoice-reminder (92) |
| glama.json | written | written | written | written |
| llms-install.md | written, mcpb + source paths, no hosted URL | same | same | same |
| test/_client.mjs | written (none existed) | existed | written (none existed) | existed |
| test/contract.test.mjs | 19/19 | 17/17 | 20/20 | 18/18 |
| SPEC.md via gen-spec | 10 tools, deterministic x3 | 10 tools, deterministic x3 | 11 tools, deterministic x3 | 11 tools + 1 resource + 1 prompt, deterministic x3 |

Contract suite commands: `cd servers/<x> && node --test test/contract.test.mjs`.
Determinism command: `shasum -a 256 servers/<x>/SPEC.md` across three consecutive
`node scripts/gen-spec.mjs <x>` runs, identical hash each time.

Fixes the contract suites forced into the server folders:

- `servers/*/package.json` descriptions were 137 to 199 chars; the estate rule is under
  100. Trimmed to the server.json wording (93, 87, 86, 86).
- `servers/bill-of-sale/src/render.ts` printed "DRAFT -- NOT FINALIZED" with an em dash;
  its own smoke test already asserted the ASCII form. Replaced, rebuilt the dist, and the
  vendored hosted copy picked it up via `node remote/build-vendor.mjs` (exits clean).
- `servers/bill-of-sale/README.md` and `RESULT.md` each carried em dashes; replaced with
  the ASCII form. The contract suites scan src, test and docs for em dash and emoji.
- Tool descriptions over the 220-char ratchet ceiling were recorded in each suite's
  OVER_LENGTH_BASELINE (4, 5, 6 and 4 tools) rather than rewritten, because
  remote/build-vendor.mjs patches exact description strings and editing them mid-deploy
  is trap 2 in CLAUDE.md.
- job_card_log_material takes `qty`, not `quantity`; the demo and tests were corrected to
  the schema, not the other way round.

## Registry-name note for whoever publishes

`io.github.theluckystrike/credit-note` and `io.github.theluckystrike/job-card` already
exist in the official registry at 0.10.0-0.13.0, from billing-docs and work-order
publications under those names. Publishing the new servers at 0.21.0 continues those names
rather than minting them; (name, version) immutability is not violated, but the two older
listings' descriptions describe the older servers. Recorded in the compare_none notes.

## compare probe outcomes, verbatim

API: `curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=<token>"`,
distinct names per token, 2026-09-12. Control on every run: `service` returns 30 rows.

- bill-of-sale: `bill-of-sale` 0, `bill of sale` 0, `sale-receipt` 0, `proof-of-purchase` 0,
  `vehicle-sale` 0.
- credit-note: `credit-note` 24 rows, every one this estate's own
  (billing-docs-credit-notes-purchase-orders and credit-note, versions 0.10.0-0.13.0);
  `credit note` 0, `credit-memo` 0, `credit memo` 0.
- job-card: `job-card` 1 (io.github.theluckystrike/job-card, our own), `job card` 0,
  `field-service` 0, `field service` 0, `trades` 13 and every one the financial or
  directory meaning of the word (congressional trade trackers, MT5 connectors, trade-SEO
  lead pages, an Australian trades directory).
- dunning-letters: `dunning` 1 (io.github.theluckystrike/dunning, our own),
  `debt-collection` 1 (io.github.Evozim/debt-collection-bot-mcp, a generated metered
  wrapper whose whole description is "Premium agentic endpoint for
  debt-collection-bot-mcp"; not called, because probing a metered remote endpoint is a
  paid API call), `debt collection` 0, `payment-reminder` 0, `payment reminder` 0,
  `overdue-invoices` 0, `overdue invoice` 0.
- checklist: `checklist` 8 (three ours; CASP Checklist, Grant Readiness and soschecklist
  are site-enquiry wrappers; access-review-checklist creates one fixed access-review
  checklist and its repo 404s today; checklist-day is a Python library registry on a
  substring; ehr-migration-checklist is a fixed HL7/FHIR audit), `check-list` 0,
  `snag-list` 1 (ours), `snag list` 0, `inspection` 2 (ours plus a racking-inspection cost
  page), `handover` 3 (ours; sh.handover/handover, shared context publishing; and
  io.github.CSOAI-ORG/meok-vehicle-handover-mcp, a genuine installable MIT server, pypi
  v1.0.4, 8 tools, but a FIXED UK vehicle-handover compliance workflow, NAMA grading,
  BVRLA fair wear and RHA liability caps, with no reusable checklist and no dated runs,
  so a side-by-side table would mislead a reader about both), `sign-off` 1 (DottedSign,
  e-signature, not checklist runs).
- packing-list: `packing-list` 1 (ours), `packing list` 0, `packing-slip` 1 (ours),
  `packing slip` 0.
- delivery-schedule: `delivery-schedule` 2 (io.github.theluckystrike/delivery-schedule and
  com.bestremotetools/delivery-schedule-milestones-late-report, the second pointing at
  this estate's repository, bundle sha and website, so the same server under a second
  namespace), `delivery schedule` 0, `deliverables` 0, `milestones` 1 (the same
  second-namespace row), `due-dates` 0.

No genuine competitor exists for any of the seven, so no COMPARE page was written and no
competitor was invented. Dated `compare_none.<server>` notes with the token lists are in
data/facts.json; the compare check accepts each for 30 days from 2026-09-12.

## Guides (billing/src/content.js)

- New guide `bill-of-sale-from-chat` (bill-of-sale had no natural host).
- `chase-unpaid-invoices-without-a-crm`: one paragraph naming mcp-dunning-letters added to
  the letter section (due-date anchoring, ordered letters, the late-fee rule, free tier).
- `credit-notes-and-purchase-orders-from-chat`: one section naming mcp-credit-note added
  (the standalone case, when the invoice is not in the invoice store).
- `work-orders-and-job-cards-from-chat`: one section naming mcp-job-card added (the card
  without the invoice machinery, same rounding rule).
- `delivery-schedule-and-work-order-documents-from-mcp`: one section naming
  mcp-packing-list added (the shipment record beside the schedule; the 20.000 vs 20.400 kg
  divisor figure from its RESULT.md).

Every new prose block: no emoji, no em dashes, and figures copied from the servers' own
README, RESULT.md or test fixtures rather than invented.

## Estate lists

- servers/office-suite/src/index.ts CHILDREN: 4 added, optional, after checklist. No
  further wiring: the proxy resolves `../../<id>/dist/index.js`. Rebuilt with
  `npm_config_cache=/Users/mike/.npm-cache-local npm run build --workspace
  @theluckystrike/mcp-office-suite`; `dist/index.js` carries the four ids. A stdio probe
  of the built office-suite answered tools/list with 352 tools (350 own per
  scripts/build-figures.mjs plus the deduped license pair).
- scripts/build-mcpb.sh: SERVERS, DISPLAY_NAME (Bill of Sale, Credit Note, Job Card,
  Dunning Letters) and KEYWORDS all carry the four. `/opt/homebrew/bin/bash -n` clean.
- scripts/sync-mirrors.sh ALL_SERVERS += 4. data/mirror_repo_overrides.json untouched
  (`git diff --stat data/mirror_repo_overrides.json` empty).
- scripts/mirror-seo.py CAPABILITY += 4 buyer-language entries, SPECIFIC_TOPICS += 4
  (bill-of-sale: bill-of-sale, sales-receipt, vehicle-sale, proof-of-purchase;
  credit-note: credit-note, credit-memo, accounts-receivable, invoicing;
  job-card: job-card, field-service, trades, sign-off;
  dunning-letters: dunning, debt-collection, accounts-receivable, overdue-invoices).
  Verified: `python3 scripts/mirror-seo.py topics <x>` and `description <x>` print for
  all four.
- scripts/build-pages.mjs ids += 4 and `node scripts/build-pages.mjs` regenerated
  billing/src/pages.js (38 pages). The four warn "no round has ever covered it", which is
  the first-five named gap working as intended.
- data/facts.json servers += 4, drafted from each README free-vs-pro table and description.
  Also corrected servers.office-suite.tagline, which read "all 33 servers, 318 of them":
  measured 37 children and 352 tools off the built bundle's tools/list.
- data/tools.json += 4 via `node scripts/extract-tools.mjs servers/<x>/src/index.ts
  packages/mcp-license/dist/index.js` (10, 10, 11, 11 tools).
- data/distribution.json per_server += 4. hosted is a "pending deploy: ..." sentence, a
  non-"published ..." string, because the endpoints 404 today; see the waiver table.
- billing/src/index.js PRODUCTS += 4 (usd 19, name, no price id: the inline price_data
  path, same shape as work-order and later). HOSTED_SERVERS += 4, asserted by
  billing/test/hosted-servers.test.mjs to equal the set of manifests declaring a remote.
- billing/src/setup.js SETUP_SERVERS += 7 (the four plus checklist, packing-list,
  delivery-schedule, closing the pre-loop gaps) with hosted: null and an ANGLE sentence
  per server for each of the six installed clients; WEB_ANGLE += 4, required once
  remotes.json exists. All seven pages render via `setupPage`; verified no "undefined"
  appears in any body.

## Waiver table entries added (scripts/release-check.mjs WAIVERS)

| check | servers | reason |
| --- | --- | --- |
| hosted-row | bill-of-sale, credit-note, job-card, dunning-letters | 2026-09-12: worker deploy pending (docs/HOSTED_LOOP34.md); endpoints probed 404 today. The orchestrator sets the exact published string after deploy and the post-deploy validation run, and deletes this waiver. The waiver goes STALE on its own once the row is reconciled. |

The four `first-five` cells are not waivers: they are the built-in named gap
(MEASURED_SERVERS), printed on every run, closed by running a user_value round against
each server and regenerating pages, never by hand.

## What I could not close, and why

1. `first-five` x7 (the four plus checklist, packing-list, delivery-schedule): closing it
   means running a measured user_value round per server against the real Claude CLI, which
   is a separate instrument and not a wiring edit.
2. billing/test "the catalogue counts agree with each other": VALIDATION in
   billing/src/index.js reads "1028 of 1028 across 34 servers" from the 2026-09-10
   recorded run while the site now lists 38. The honest fix is a full
   `node scripts/validate.mjs` run after the worker deploy (its own doc sequences it
   post-deploy), then updating VALIDATION with the measured numbers. Not fabricated.
3. Estate `README generated sections are current` and `PRODUCTS.bundle names the right
   count and saving`: the orchestrator's release steps (build-readme.mjs and the bundle
   description), named in the brief as out of scope.
4. The four claude-web setup pages and product pages reference the connect-by-URL flow
   while the endpoints still 404. Both surfaces deploy only when the storefront worker is
   deployed, which the hosting loop sequences after the remote worker deploy. If the
   storefront must deploy before that, flip nothing: the pages are generated content and
   the deploy order is the guard.

## Verification commands and what they printed

- `node scripts/release-check.mjs`: the four servers show `ok` on every column except
  `hosted-row` and `first-five`, both `gap`. 11 named gaps total (7 first-five, 4 waived
  hosted-row). Failures: only the three estate rows named above. Exit code 1 on those
  estate rows, unchanged in kind from pre-loop; the billing half of the test-suite row
  improved from 2 failing tests to 1.
- `cd servers/<x> && node --test test/contract.test.mjs`: 19/19, 17/17, 20/20, 18/18.
- `cd billing && node --test test/*.test.mjs`: 133/134, the one failure being the
  VALIDATION count above. Pre-loop measured 132/134 (failures: bundle description count,
  figures.js drift), so the pass count went up by one, not down.
- `node scripts/gen-spec.mjs bill-of-sale credit-note job-card dunning-letters` run three
  times per server, `shasum -a 256 servers/<x>/SPEC.md` identical across runs.
- `node scripts/build-figures.mjs` (not --check) then `git diff --stat
  billing/src/figures.js`: wrote 38 server dirs, 38 listed, 37 children, 34 hosted, 350
  own tools, $19/$39, v0.21.0; diff vs HEAD is the regeneration, 40 insertions.
- `node remote/build-vendor.mjs`: exits clean (the description patches still match).
- `npm_config_cache=/Users/mike/.npm-cache-local npm test`: exit 0; tallied from
  /tmp/npm-test-full.log with awk over the `# tests/pass/fail` summary lines: 1827 tests,
  1816 pass, 0 fail, 11 skipped (the /proc livelock branches skip on darwin).
- Assets: `vhs < scripts/demo/<x>.tape` rendered assets/demo-<x>.gif for the four new
  servers plus checklist and packing-list (which were missing pre-loop), driven by new
  per-server scenarios in scripts/demo/drive.mjs, each dry-run first with
  `node scripts/demo/drive.mjs <x>` (exit 0). Logos: assets/<x>-logo.png for the same six,
  generated with python3/PIL at 400 x 400 in the estate's shape (muted solid background,
  white centered initials, matching assets/petty-cash-logo.png), no placeholders.
