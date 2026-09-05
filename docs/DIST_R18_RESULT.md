# Distribution round 18: wire mcp-cash-book into the estate (2026-09-06)

status: DONE

This file is written first, as a checklist, and updated as each item closes, so a stalled
agent leaves a verifiable state rather than an unknown one.

Opening state: `node scripts/release-check.mjs` -> 25 servers at 0.14.0, 27 checks each,
17 failures, 15 of them `cash-book` and 2 estate-wide.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SERVER_COUNT 24 -> 25 committed | done | fc01b89, packages/mcp-license/src/index.ts and remote/src/shims/license.ts |
| 2 | PRODUCTS entry, bundle derived to twenty-five and $436 | done | billing/src/index.js PRODUCTS["cash-book"], price_1UCOv4JKCamubEm15469I5YT; SERVER_COUNT 25 and BUNDLE_SAVING_USD 436 both derive from PRODUCTS, bundle desc reads "Saves $436 against buying twenty-five". NUMBER_WORD gained a 25 row and billing/test/checkout.test.mjs moved to /^Twenty-five MCP servers/ |
| 3 | office-suite CHILDREN | done | servers/office-suite/src/index.ts CHILDREN, one entry, verified by re-reading the block |
| 4 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | done | scripts/build-mcpb.sh SERVERS, DISPLAY_NAME "Cash Book", KEYWORDS |
| 5 | sync-mirrors ALL_SERVERS + topics_for | done | scripts/sync-mirrors.sh ALL_SERVERS and topics_for (bookkeeping double-entry ledger accounting) |
| 6 | data/facts.json | done | data/facts.json servers.cash-book, inserted as text at the file's own indent 2 so the diff is added lines only |
| 7 | build-pages ids, regenerate, deploy billing | done | scripts/build-pages.mjs ids; `node scripts/build-pages.mjs` regenerated billing/src/pages.js over 25 pages; billing deployed by wrangler, version af9702eb. /s/cash-book 200, /buy/cash-book 303, /guides/one-ledger-from-every-server 200, /setup/claude-web/cash-book 200 |
| 8 | data/tools.json from a live tools/list | done | data/tools.json, 8 rows read from a live tools/list over stdio on a fresh XDG_DATA_HOME |
| 9 | scripts/validate.mjs probes + buy list, validate green | done | scripts/validate.mjs PROBES["cash-book"], 12 assertions per tier, plus cash-book in the buy list. `node scripts/validate.mjs` 713/713, exit 0 |
| 10 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | done | billing/src/setup.js SETUP_SERVERS entry, six ANGLE entries, one WEB_ANGLE; the module was imported to prove it parses |
| 11 | guide /guides/one-ledger-from-every-server | done | billing/src/content.js GUIDES["one-ledger-from-every-server"], 9 FAQ rows, 8,067 bytes of html |
| 12 | compare_none note | done | data/facts.json compare_none.cash-book, 5 tokens probed on the live registry API on 2026-09-06 |
| 13 | demo GIF under 400 KB | done | assets/demo-cash-book.gif, 361,417 bytes, re-encoded at 10 fps on a 64-colour palette and a frame read back for legibility |
| 14 | assets/cash-book-logo.png | done | assets/cash-book-logo.png, 400x400 |
| 15 | Docker catalog entry + repin 25 entries + PR 4892 body row | done | fork commit 41bcc19 on add-theluckystrike-mcp-servers: servers/cash-book/server.yaml added and all 25 entries repinned to ca1636e after the HEAD check; PR 4892 body gained the row, the name list and the twenty-five/ca1636e pin line |
| 16 | Cline marketplace issue | done | https://github.com/cline/mcp-marketplace/issues/2453 |
| 17 | data/distribution.json hosted row | done | data/distribution.json per_server.cash-book.hosted, inserted at the file's own indent 1 so the diff is 13 added lines |
| 18 | Round 29 user-value run into data/user_value_r29.json | done | data/user_value_r29.json, six-prompt stdio free-tier round through the claude CLI 2.1.261, 17/18. Every figure re-derived over stdio afterwards |
| 19 | `node scripts/release-check.mjs` green | GREEN | 25 servers at 0.14.0, 27 checks each, 0 recorded gaps |

Not in scope here: `remote/src/index.ts` SERVERS (`endpoint`), which the remote agent owns.

## What closed the seventeen gaps

`release-check` opened the round with 17 failures, 15 of them `cash-book` and 2 estate-wide.
Both estate-wide ones closed themselves the moment the `PRODUCTS` entry landed: `SERVER_COUNT`
and `BUNDLE_SAVING_USD` derive from `PRODUCTS`, so `twenty-five` and `$436` were never typed
anywhere. Two hand-written numbers moved with them. `NUMBER_WORD` in `billing/src/index.js`
needed a `25` row, and `billing/test/checkout.test.mjs` asserts `/^Twenty-five MCP servers/`:
that is the one place in the repo the count is deliberately spelled out rather than derived,
so the test can catch a broken `countWord`. The `endpoint` gap (`remote/src/index.ts` SERVERS)
was closed by the remote agent during the round and is not this round's work.

The `SERVER_COUNT` 24 to 25 bump was already sitting uncommitted in the working tree when the
round opened, exactly as `docs/CASH_BOOK_RESULT.md` recorded. It was committed on its own as
the first act of the round (fc01b89) so that nothing else in the round could bury it.

## The bank-import insight, and where it went

The measured figure this server exists to demonstrate is that four of the five bank rows in
the worked month are money a document already posted: 1,375,300 of 1,380,300 minor units of
cash movement, 99.6 percent. Posting the import as well moves cash from -10,543.00 to
-21,111.00 EUR and the trial balance still comes to zero, because every duplicated receipt
arrives with its own contra. That figure is now carried, in the same terms, by the guide
`/guides/one-ledger-from-every-server`, the `measured` field of the setup entry, the
`facts.json` server row, the Docker catalog description, the Cline issue and the demo GIF,
and it is asserted in the validator probe as `matched: 4` beside a cash balance of -1,054,300.

## compare_none rather than a comparison page

Five tokens were probed against the live registry search API on 2026-09-06: `cash-book`,
`ledger`, `trial-balance`, `bookkeeping`, `double-entry`. Three return 0 rows. `bookkeeping`
returns 1 and `ledger` returns 30, and the rows that are genuinely accounting rather than a
substring match, `ai.craneledger/crane-ledger`, `io.helloledger/bookkeeping`,
`com.npledger/np-ledger` and `com.ledgerbeaver/finance`, are all the same shape: a remote
streamable-http endpoint in front of a hosted book, reached with a bearer key and an account.
None was called: probing a metered remote endpoint is a paid API call. This server is not that
shape, so a comparison table would be dishonest about which one a reader wants, and the
self-expiring `data/facts.json` note stands in place of a page and re-probes in 30 days.

## The Docker catalog entry

`go run ./cmd/validate --name cash-book` in the fork at `/private/tmp/docker-mcp-registry`
was run and produced no output within 45 seconds, which is the step that needs a Docker daemon
this machine does not run. That is recorded rather than waited on, and the PR 4892 submitter
checklist was edited to say so in the same words rather than leaving a check mark that claims
more than was done.

The repin was guarded: the local HEAD was compared against `git ls-remote origin main` and both
`assets/cash-book-logo.png` and `servers/cash-book/Dockerfile` were fetched at that sha over
raw.githubusercontent (200 each) before any file was rewritten, so no entry can be pinned to a
commit that is not public.

## Round 29, and what it found

Six prompts, one conversation, free tier, stdio, no token and no network call, seeded by
importing `servers/cash-book/test/_client.mjs`'s own `workedMonth` rather than reimplementing
it. 17 of 18. Prompt 3 pushed back directly on the bank-import decision and the model held the
line, quoting the server's own build note and explaining that a bank row does not know what it
is, so only the source document carries the second leg. Prompt 5 crossed the free cap on
purpose: the cap fired on the fourth distinct period, the rebuild of an already-built period
was free, and `trial_balance` kept answering for the month whose build was refused, which is
the design intent stated in the README.

The lost point is prompt 6. After a correct Pro refusal on `ledger_export_csv`, the model
hand-assembled a CSV from free-tier `ledger_lines` data and offered it as the substitute
without saying that its schema differs from the real export. The real file carries
`account_name` and `bank_ref` and amounts in minor units; the hand-built one carries neither
and uses major units. `bank_ref` is the column this whole server exists to produce.

That points at something about the pricing rather than the model: `ledger_lines` is free and
unlimited by design, so the CONTENT of the Pro CSV is derivable on the free tier by any client
willing to reformat it. Only the file shape is behind the gate. `month_close` is not like that,
and the model could only infer its exception list, which it labelled as inference and got
right. If the free tier is ever felt to be too generous, `ledger_lines` is the reason, and
narrowing it would take the trial balance's own evidence away with it.

## Evidence

    node scripts/release-check.mjs   green, 0 gaps, 25 servers at 0.14.0, 27 checks each
    node scripts/validate.mjs        713/713, exit 0
    node --test billing/test/*.test.mjs      81/81
    npm test -w packages/mcp-license 32/32
    round 29 user value              17/18, six-prompt stdio free-tier round
    https://mcp.zovo.one/s/cash-book                        200, with a First five minutes section
    https://mcp.zovo.one/buy/cash-book                      303 to Stripe
    https://mcp.zovo.one/guides/one-ledger-from-every-server 200
    https://mcp.zovo.one/setup/claude-web/cash-book         200

## Failures

- `data/facts.json` and `data/tools.json` were first rewritten by a json round trip at
  `indent=2` computed by the writer rather than read from the file, which reformatted every
  line of both. Reverted and redone as text inserts at each file's own indent, so the diffs are
  34 and 21 added lines rather than a thousand changed ones. `data/distribution.json` was done
  as a text insert from the start, at its own `indent=1`, for the same reason.
- The validator probe read the bank store as `bank-statement/transactions.json`, a filename
  guessed from the store's contents rather than read from the seeder. The real file is
  `data.json`. `node scripts/validate.mjs` came back 707/709 with two `ENOENT` exceptions, one
  per tier. Caught by the run, not by review, and fixed to 713/713.
- The first round-29 scenario rows carried no `server` field, so `scripts/build-pages.mjs`
  skipped them all and still printed `warn cash-book: no round has ever covered it`. The page
  regenerated at exactly its previous byte count, which is the only visible symptom. Caught by
  reading the warning rather than trusting the exit code, and the byte count moved from 411,511
  to 414,794 once the field was added.
- `npm test -w billing` reports `No workspaces found` from the repo root; the billing package is
  not in the workspace list. Run as `node --test billing/test/*.test.mjs` instead.

insight: this round's one lost point was not the model getting a number wrong, it was the model
getting every number right and handing them over in the wrong container. Refused the Pro CSV,
it rebuilt the file by hand out of a free tool, and the figures reconcile perfectly to the
ledger while the shape silently drops `bank_ref`, which is the single column this server was
built to produce. A gate that only asks "was the refusal relayed" scores that as a pass. What
caught it was diffing the hand-built file against the real export's header, and the reason it
was possible at all is a pricing fact nobody had written down: `ledger_lines` is free and
unlimited, so the Pro export's content was never actually behind the gate, only its formatting.
