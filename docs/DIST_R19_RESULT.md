# Distribution round 19: wire mcp-amortization into the estate (2026-09-06)

status: DONE

This file is written first, as a checklist, and updated as each item closes, so a stalled
agent leaves a verifiable state rather than an unknown one.

Opening state: `node scripts/release-check.mjs` -> 26 servers at 0.15.0, 27 checks each,
17 failures, 15 of them `amortization` and 2 estate-wide.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SERVER_COUNT 25 -> 26 committed | done | 64bf5a5, packages/mcp-license/src/index.ts and remote/src/shims/license.ts, by path |
| 2 | PRODUCTS entry, bundle derived to twenty-six and $455 | done | billing/src/index.js PRODUCTS["amortization"], price_1UCROyJKCamubEm1eWJBgzIj. SERVER_COUNT 26 and BUNDLE_SAVING_USD 455 both derive from PRODUCTS; the bundle desc reads "Saves $455 against buying twenty-six". NUMBER_WORD gained a 26 row, billing/test/checkout.test.mjs moved to /^Twenty-six MCP servers/, and scripts/release-check.mjs's own count-word table gained "twenty-six" |
| 3 | office-suite CHILDREN | done | servers/office-suite/src/index.ts CHILDREN, one entry, verified by re-reading the block |
| 4 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | done | scripts/build-mcpb.sh SERVERS, DISPLAY_NAME "Amortization", KEYWORDS |
| 5 | sync-mirrors ALL_SERVERS + topics_for | done | scripts/sync-mirrors.sh ALL_SERVERS and topics_for (amortization loan-schedule lease finance) |
| 6 | data/facts.json | done | data/facts.json servers.amortization, inserted as text at the file's own indent so the diff is added lines only |
| 7 | build-pages ids, regenerate, deploy billing | done | scripts/build-pages.mjs ids; `node scripts/build-pages.mjs` regenerated billing/src/pages.js over 26 pages; billing deployed by wrangler, version f97aaeb2. /s/amortization 200, /buy/amortization 303, /guides/loan-and-lease-schedules-from-chat 200, /setup/claude-web/amortization 200 |
| 8 | data/tools.json from a live tools/list | done | data/tools.json, 8 rows read from a live tools/list over stdio on a fresh XDG_DATA_HOME |
| 9 | scripts/validate.mjs probes + buy list, validate green | done | scripts/validate.mjs PROBES["amortization"], 12 assertions per tier, plus amortization in the buy list. `node scripts/validate.mjs` 762/762, exit 0 |
| 10 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | done | billing/src/setup.js SETUP_SERVERS entry, six ANGLE entries, one WEB_ANGLE; the module was imported to prove it parses |
| 11 | guide /guides/loan-and-lease-schedules-from-chat | done | billing/src/content.js GUIDES["loan-and-lease-schedules-from-chat"], 9 FAQ rows, 6,842 bytes of html |
| 12 | compare_none note | done | data/facts.json compare_none.amortization, 5 tokens probed on the live registry API on 2026-09-06 |
| 13 | demo GIF under 400 KB | done | assets/demo-amortization.gif, 389,228 bytes at the tape defaults, and the final frame read back for legibility |
| 14 | assets/amortization-logo.png | done | assets/amortization-logo.png, 400x400 |
| 15 | Docker catalog entry + repin 26 entries + PR 4892 body row | done | fork commit d3d5bd7 on add-theluckystrike-mcp-servers: servers/amortization/server.yaml added and all 26 entries repinned to d980af5 after the HEAD check; PR 4892 body gained the row, the name list and the twenty-six/d980af5 pin line |
| 16 | Cline marketplace issue | done | https://github.com/cline/mcp-marketplace/issues/2455 |
| 17 | data/distribution.json hosted row | done | data/distribution.json per_server.amortization.hosted, inserted at the file's own indent 1 so the diff is 13 added lines |
| 18 | Round 31 user-value run into data/user_value_r31.json | done | data/user_value_r31.json, six-prompt stdio free-tier round through the claude CLI 2.1.261, 15/18. Every figure re-derived over stdio afterwards |
| 19 | `node scripts/release-check.mjs` green | GREEN | 26 servers at 0.15.0, 27 checks each, 0 recorded gaps |

Not in scope here: `remote/src/index.ts` SERVERS (`endpoint`), which the remote agent owns.

## What closed the seventeen gaps

`release-check` opened the round with 17 failures, 15 of them `amortization` and 2 estate-wide.
One of the estate-wide ones, the missing `claude-web` page, closed itself the moment the
`WEB_ANGLE` entry landed. The other, `PRODUCTS.bundle names the right count and saving`, did
NOT close on its own, and that is worth writing down: `SERVER_COUNT` and `BUNDLE_SAVING_USD`
both derive from `PRODUCTS`, so the bundle description rendered `Saves $455 against buying
twenty-six` with nothing typed by hand, and the check still failed. The failure was in the
gate: `scripts/release-check.mjs` carries its own English number-word table for spelling out
the count, and that table stopped at `twenty-five`, so `words[26]` was `undefined` and the
check reported that the description does not name the count. Two hand-maintained tables move
with a new server rather than one: `NUMBER_WORD` in `billing/src/index.js` and the `words`
array inside the checker. `billing/test/checkout.test.mjs` moved to `/^Twenty-six MCP
servers/` for the same reason it moved last round: that is the one place the count is
deliberately spelled out rather than derived, so the test can catch a broken `countWord`.

The `SERVER_COUNT` 25 to 26 bump was already sitting uncommitted in the working tree when the
round opened, exactly as `docs/AMORTIZATION_RESULT.md` recorded. It was committed on its own,
by path, as the first act of the round (64bf5a5) so that nothing else could bury it.

## The rounding insight, and where it went

The measured figure this server exists to demonstrate is that rounding a level payment once is
a term change and not a rounding detail: at 250 basis points over 360 annual periods on
1,000,000 minor units the payment rounds to 25,292, that rounding repeats, and the balance
clears at period 356, four periods before the declared term, with a final payment of 4,165. A
schedule that fills out the term instead reports four more rows charging negative interest on
a negative balance while every total still reconciles. That figure is now carried, in the same
terms, by the guide `/guides/loan-and-lease-schedules-from-chat`, the `measured` field of the
setup entry, the `facts.json` server row and the Docker catalog description, and its sibling
figure, the final period charging 882 rather than 880 so the payment can stay at 88,849, is
asserted in the validator probe and shown on screen in the demo GIF.

## compare_none rather than a comparison page

Five tokens were probed against the live registry search API on 2026-09-06: `amortization`,
`loan-schedule`, `lease`, `mortgage-calculator`, `effective-rate`. Three return 0 rows.
`lease` returns 30 and 28 of them are a substring match on the word *release*: release
trackers, release gates, release notes, CI signoff. The one genuine lease row is document Q&A
over a lease already signed. `mortgage-calculator` returns 4 rows and all four are the same
server at four versions, a remote US-mortgage payment calculator. It was not called: probing a
remote endpoint someone else meters is a paid API call. That server answers what a payment
would be on a hypothetical mortgage; this one holds a register of agreements actually signed,
closes every schedule exactly on its balloon in integer minor units, costs an early settlement
net of its penalty and hands back a balanced double entry in the cash book's own account ids.
Nothing in the registry does the second thing, so a table would be dishonest about which one a
reader wants, and the self-expiring `data/facts.json` note stands in place of a page and
re-probes in 30 days.

## The Docker catalog entry

The repin was guarded: the local HEAD was compared against `git ls-remote origin main` and
both `assets/amortization-logo.png` and `servers/amortization/Dockerfile` were fetched at that
sha over raw.githubusercontent before any file was rewritten. The first guard pass returned
404 for the logo, because it had not been pushed yet, and the repin was correctly HELD rather
than run. It succeeded on the retry at `d980af5`, which is the sha all 26 entries now carry.
`go run ./cmd/validate --name amortization` passed name, directory and title and then hung at
the step that needs a Docker daemon this machine does not run; it was killed at 45 seconds and
that is recorded rather than waited on, with the PR 4892 submitter checklist saying so in the
same words rather than leaving a check mark that claims more than was done.

## Round 31, and what it found

Six prompts, one conversation, free tier, stdio, no token and no network call, on an empty
register, because this server reads no sibling store and the terms the user types are the only
input. 15 of 18. The three full-mark prompts are the ones that matter most: it priced a credit
agreement out of ordinary speech, laid out the schedule, and when challenged head-on that
period 12's interest looked wrong it defended the design in the design's own terms and named
the number the other convention would produce.

All three lost points are the same shape, and none of them is an arithmetic error. Every
figure the server returned was relayed exactly. What the model got wrong was what to do when
the server said NO. Asked for a total across four agreements after the free cap refused two of
them, it relayed the refusal perfectly and then reported a bolded `Total owed` of EUR
23,767.06 containing EUR 11,955.82 of debt for agreements that do not exist. Refused
`loan_journal`, it hand-built the entry with account names of its own, `Loan payable` and
`Bank`, rather than the `loan_liability` and `cash` ids the real payload carries, which are
the part that makes the payload usable downstream. That is the same class as round 29's lost
point, now twice in a row: refused a Pro tool, the model rebuilds its answer by hand, the
figures reconcile perfectly and the shape silently drops what made the tool worth buying.

The third is different and is a genuine finding about the server. The model reported that
`loan_create` had written two records from one request. It had not: `loans.json` carries
created timestamps thirty seconds apart, which is two calls in two turns. But the underlying
gap is real. `loan_create` accepts a byte-identical agreement twice with no duplicate guard,
and there is no delete tool, so a user who records the same lease twice on the free tier has
two of their three slots gone and no way back except a Pro key.

## Evidence

    node scripts/release-check.mjs   green, 0 gaps, 26 servers at 0.15.0, 27 checks each
    node scripts/validate.mjs        762/762, exit 0
    node --test billing/test/*.test.mjs      81/81
    npm test -w packages/mcp-license 32/32
    round 31 user value              15/18, six-prompt stdio free-tier round
    https://mcp.zovo.one/s/amortization                              200, with a First five minutes section
    https://mcp.zovo.one/buy/amortization                            303 to Stripe
    https://mcp.zovo.one/guides/loan-and-lease-schedules-from-chat   200
    https://mcp.zovo.one/setup/claude-web/amortization               200

## Failures

- The first Docker repin guard found `assets/amortization-logo.png` returning 404 at the
  then-current remote HEAD, because the logo had not been pushed yet. The guard did its job
  and the repin was held rather than run against a sha whose files are not public.
- `node scripts/validate.mjs` came back 760/762 on its first run with two failures, one per
  tier: the probe asserted `outstanding_minor: 514920` from `loan_list` at 2026-06-30, which
  is the balance AFTER payment 6 on 2026-07-15 rather than the balance ON 2026-06-30, which is
  597,791. Caught by the run rather than by review.
- `buy/amortization` returned 404 in the same run, because the billing worker had not been
  deployed since the `PRODUCTS` entry landed. The wiring commit and the deploy are two
  separate acts and the validator is the thing that notices.
- `node --test billing/test/*.test.mjs` was 76/81 for most of the round, all five failures
  being `First five minutes` assertions that cannot pass until a user-value round covers the
  server. `build-pages` says so out loud, `warn amortization: no round has ever covered it`,
  and the page regenerates at almost its previous byte count either way. Green at 81/81 once
  `data/user_value_r31.json` landed and the pages were rebuilt at 427,026 bytes.

insight: the estate-wide gate failed on a server count that nothing in the estate had typed by
hand. `SERVER_COUNT` and `BUNDLE_SAVING_USD` both derive from `PRODUCTS` and rendered
`twenty-six` and `$455` correctly, and the check still reported the description does not name
the count, because the CHECKER carries its own English number-word table and that table ended
at twenty-five. Deriving a value does not remove the hand-maintained table; it moves it into
the thing that verifies the value, where a stale entry reads as a product defect rather than a
gate defect. The place to look when a derived number fails its own check is the checker.
