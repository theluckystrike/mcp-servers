# Distribution round 21: wire mcp-work-order into the estate (2026-09-06)

status: DONE

This file was written first, as a checklist, and updated as each item closed, so a stalled
agent leaves a verifiable state rather than an unknown one.

Opening state: `node scripts/release-check.mjs` -> 28 servers, 27 checks each, 17 failures,
15 of them `work-order` and 2 estate-wide.

The one thing that makes this round different from round 20: the Stripe key in the keychain
lost `product_write` (docs/HUMAN_GATED_PACK.md, 2026-09-06), so NO price id exists for
work-order and none could be minted by this agent. The product entry therefore ships with
the literal price `PENDING_HUMAN`, `/buy/work-order` answers 503 rather than calling Stripe,
and the release checker prints the gap by name instead of either failing the run or counting
it green.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SERVER_COUNT 27 -> 28 committed | done | faa71bd, `packages/mcp-license/src/index.ts` and `remote/src/shims/license.ts`, by path, the number line only, pulled first. Nothing else in that commit |
| 2 | PRODUCTS entry, bundle derives twenty-eight and $493 | done | `billing/src/index.js` PRODUCTS["work-order"], price the literal `PENDING_HUMAN`, usd 19, payload work-order. `SERVER_COUNT` 28 and `BUNDLE_SAVING_USD` 493 both derive from PRODUCTS; the bundle desc reads "Saves $493 against buying twenty-eight". NUMBER_WORD gained a 28 row, FREE_FIVE_WORDS a work-order row, and `billing/test/checkout.test.mjs` moved to `/^Twenty-eight MCP servers/`. The single-server desc says checkout opens when the operator adds the price |
| 3 | release-check product check treats PENDING_HUMAN as a NAMED GAP | done | `scripts/release-check.mjs`: a new `gap("...")` return marks a check that is neither green nor blocking. The cell reads `gap`, the reason prints in its own "named gap(s), printed rather than passed" section naming the product, the metadata payload, the $19 price and the human step, and the run exits 0. It does not count as green: `isGap` is checked before the `true` branch everywhere |
| 4 | /buy/work-order answers 503 with the bundle link, never a Stripe call | done | `billing/src/index.js` /buy route, a branch before the click instrument and before every Stripe call. 503, `x-mcp-buy: price-pending-human`, "Checkout for this server is not yet open", a link to `/buy/bundle?src=store.pending.work-order`. Verified live: `curl https://mcp.zovo.one/buy/work-order` -> 503 with that header |
| 5 | validate.mjs asserts the 503 rather than a 303, and says why | done | `scripts/validate.mjs`: work-order is removed from the 303 loop and asserted on its own for 503, the header, the copy and the bundle link, with a comment saying a 303 here would be the validator reporting a checkout that does not exist, and how to flip it back when the price id lands |
| 6 | office-suite CHILDREN | done | `servers/office-suite/src/index.ts` CHILDREN, one entry, optional true |
| 7 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | done | `scripts/build-mcpb.sh` SERVERS, DISPLAY_NAME "Work Order", KEYWORDS |
| 8 | sync-mirrors ALL_SERVERS + topics_for | done | `scripts/sync-mirrors.sh` ALL_SERVERS and topics_for (work-order job-card field-service trades) |
| 9 | data/facts.json | done | `data/facts.json` servers["work-order"], inserted as text at the file's own indent so the diff is added lines only |
| 10 | build-pages ids, regenerate, deploy billing | done | `scripts/build-pages.mjs` ids; `node scripts/build-pages.mjs` regenerated `billing/src/pages.js` over 28 pages; billing deployed by wrangler twice, versions 6bfc9313 and 14577088. /s/work-order 200, /buy/work-order 503, /guides/work-orders-and-job-cards-from-chat 200, /setup/claude-web/work-order 200 |
| 11 | data/tools.json from a live tools/list | done | `data/tools.json`, 12 rows read from a live tools/list over stdio on a fresh XDG_DATA_HOME. Added lines only |
| 12 | validate.mjs probes + buy list | done | `scripts/validate.mjs` PROBES["work-order"], 19 assertions per tier: create, the four lines, the markup gap asserted as exactly 1, the derived totals, an illegal status skip refused, the duplicate refusal, the free text report, the PDF gate, the payload against `computeTotals` re-run from the validator's own process, the board gate, the sixth OPEN order refused, the free delete, no stored total, and the write footprint. `node scripts/validate.mjs` 856/856, exit 0 |
| 13 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | done | `billing/src/setup.js` SETUP_SERVERS["work-order"], six ANGLE entries, one WEB_ANGLE; the module was imported to prove it parses, 29 entries |
| 14 | guide /guides/work-orders-and-job-cards-from-chat | done | `billing/src/content.js` GUIDES entry, 9 FAQ rows, 6,785 bytes of html, carrying the markup-on-unit-cost insight as its first section after the install |
| 15 | compare_none note | done | `data/facts.json` compare_none["work-order"], 4 tokens probed on the live registry API on 2026-09-06, with a control |
| 16 | demo GIF under 400 KB | done | `assets/demo-work-order.gif`, 279,510 bytes, 410 frames, and the final frame read back for legibility |
| 17 | assets/work-order-logo.png | done | `assets/work-order-logo.png`, 400x400 |
| 18 | Docker catalog entry + repin 28 entries + PR 4892 body row | done | fork commit 77341e1 on `add-theluckystrike-mcp-servers`: `servers/work-order/server.yaml` added and all 28 entries repinned to 41fa480 after the HEAD check; PR 4892 body gained the row, the name list and the twenty-eight/41fa480 pin line |
| 19 | Cline marketplace issue | done | https://github.com/cline/mcp-marketplace/issues/2459 |
| 20 | data/distribution.json hosted row | done | `data/distribution.json` per_server["work-order"], inserted at the file's own indent 1 so the diff is added lines only |
| 21 | Round 35 user-value run into data/user_value_r35.json | done | `data/user_value_r35.json`, six-prompt stdio free-tier round through the claude CLI, 16/18. Every figure re-derived over stdio afterwards on a COPY of the round's store |
| 22 | `node scripts/release-check.mjs` green apart from the named product gap | GREEN | 28 servers, 27 checks each, 0 failures, 1 named gap |

Not in scope here: `remote/src/index.ts` SERVERS (`endpoint`), which the remote agent owns.
It had already landed `work-order` before this round's wiring ran, so the `endpoint` gap
closed without this agent touching that file, and `scripts/validate.mjs` already carried the
server in its hosted `tools/list` sweep and its Extension probes.

## The named gap, and why it is a third state

`release-check` had exactly two states before this round: a check passes, or the release is
blocked. `WAIVERS` existed for the second case but is a hand-maintained list keyed by server
and check, which is the wrong shape here: the condition is not "we have decided to tolerate
this", it is "the product entry itself says out loud that a human step is missing". So the
check now reads the product entry and returns `gap(...)` when the price is the literal
`PENDING_HUMAN`. That single sentinel does three things at once. The table cell reads `gap`
rather than `ok`, so nobody scanning the grid sees a green square where there is no checkout.
The reason prints in its own section, naming the product name, the metadata payload, the $19
price and the file to edit, so the human step is a paragraph rather than a memory. And the
run exits 0, so the round can be finished and the other twenty-six checks for this server can
be trusted.

The alternative was to invent a price id, which is the only genuinely dangerous option: a
`price_...` string that Stripe does not know would pass the regex, turn the cell green, and
fail at the one moment it matters, in front of a buyer, with "Checkout could not start". The
503 route exists for the same reason. `PRODUCTS["work-order"].price` handed to Stripe would
400, and the buyer would read an outage where the truth is a shop that is not open yet. The
branch sits before the click instrument as well as before the Stripe call, so a
`PENDING_HUMAN` product records no conversion click it can never convert.

## The insight, and where it went

The measured figure this server exists to demonstrate is that the markup goes on the UNIT
cost and never on the line total, and that the whole difference is one minor unit at a time.
Seven parts at 1299 with 15 percent on top is `roundHalfUp(1299 * 1.15)` = 1494 a unit and
10,458 on the line; marking up the line total is `roundHalfUp(9093 * 1.15)` = 10,457. Both
are defensible arithmetic, both reconcile against their own workings, and only one of them is
what the customer is billed, because the invoice server rounds a unit price into minor units
first and derives the line from that stored value. That figure is now carried, in the same
terms, by the guide `/guides/work-orders-and-job-cards-from-chat`, the `measured` field of
the setup entry, the `facts.json` server row, the Docker catalog description and the Cline
issue, it is asserted in the validator probe (`Math.round(9093 * 1.15) - 10458 === -1`), and
it is on screen in the demo GIF.

## compare_none rather than a comparison page

Four tokens were probed against the live registry search API on 2026-09-06: `work-order`,
`job-card`, `service-report`, `field-service`. All four return 0 rows, and so does the
two-word form `work order`. The run carried a control, because a search API that has broken
returns zero for everything: `service` returns 100 rows and `maintenance` returns 12 on the
same API in the same minute, so the zeroes are the registry answering rather than the search
failing. The nearest rows the control turns up miss in both directions.
`com.checkmycontractorquote/maintenance-concierge-ai` triages a maintenance problem and
generates a vendor packet, which is the step BEFORE a work order exists: it decides who to
call, not what the job used. `io.github.LGDiMaggio/predictive-maintenance-mcp` is industrial
vibration analysis to ISO 20816, which decides when a machine will need work, not what the
customer is billed for the visit. Neither holds a job card. None were called, because probing
a remote endpoint someone else meters is a paid API call. The self-expiring `data/facts.json`
note stands in place of a page and re-probes in 30 days.

## The Docker catalog entry

The repin was guarded: the local HEAD was compared against `git ls-remote origin main`, both
matched at `41fa480`, and `assets/work-order-logo.png` and `servers/work-order/Dockerfile`
were both fetched at that sha over raw.githubusercontent and returned 200 before any file was
rewritten. All 28 entries then carry that sha in both `commit:` and the `icon:` URL, verified
by counting 28 of each. `go run ./cmd/validate --name work-order` passed name, directory and
title and then hung at the step that needs a Docker daemon this machine does not run; it was
killed at 55 seconds and that is recorded rather than waited on, with the PR 4892 submitter
checklist saying so in the same words rather than leaving a check mark that claims more than
was done.

## Round 35, and what it found

Six prompts, one conversation, free tier, stdio, on an empty store, one server registered.
16 of 18, which is what round 34 reached on a server that had already been through a round.
Every numeric figure across all six prompts was re-derived over stdio afterwards on a COPY of
the round's store, so the verification never mutated what it verified, and all matched to the
minor unit.

The two lost points are both about framing rather than about figures. Asked to mark the job
invoiced, the model walked draft, scheduled, in_progress and done in one turn and stamped all
four with the same date, four seconds apart in wall clock, producing a history that is
formally valid and factually empty; it then marked the order invoiced before any invoice
existed, which is the one transition with no way back. It named that consequence out loud in
the same message, which is why it is a 2 rather than a 1. And on the last prompt, having
refused an invited "just tell me yes" and derived the one-cent gap exactly (104.58 against
104.57, which is the server's 10,458 against 10,457 without ever having seen either), it
closed with "it doesn't change what you charge in practice", which is the opposite of what it
had just proved and is the sentence a reader keeps.

**The finding of the round is what did NOT happen, on the fifth prompt.** Rounds 29, 31 and
33 all lost the same point on three different servers: a refused Pro tool gets rebuilt by
hand with invented account ids from figures the free tools returned. Round 33 went further
and named the mitigation sentence inside the cap message as a prompt-injection attempt and
defied it on the record, which is the insight that closed round 20. Here, with TWO Pro
refusals arriving in one turn, the model rebuilt nothing. It repeated only what free tools
had already printed, said in its own words that those are the real figures from the books,
named the one thing it could not construct (per-line VAT in an `invoice_create` payload), and
offered a free tool instead of a guess. It also declined to buy on the user's behalf without
being asked to decline. The cap sentence in this server's refusal is the reworded
statement-of-fact form rather than round 33's imperative. n=1 and this is not a controlled
comparison, but it is the first round in four where the defect did not appear at all.

## Evidence

    node scripts/release-check.mjs   green, 1 named gap, 28 servers, 27 checks each
    node scripts/validate.mjs        856/856, exit 0
    node --test billing/test/*.test.mjs      81/81
    npm test -w packages/mcp-license 34/34
    round 35 user value              16/18, six-prompt stdio free-tier round
    https://mcp.zovo.one/s/work-order                                      200, with a First five minutes section
    https://mcp.zovo.one/buy/work-order                                    503, x-mcp-buy: price-pending-human, links the bundle
    https://mcp.zovo.one/buy/bundle                                        303 to Stripe
    https://mcp.zovo.one/guides/work-orders-and-job-cards-from-chat        200
    https://mcp.zovo.one/setup/claude-web/work-order                       200

## Failures

- The first demo GIF came out at 651 KB, and then at 443 KB, 560 KB, 648 KB and 446 KB as the
  framerate was moved between 5 and 8 and the height between 430 and 480. The framerate was
  not the lever and neither was the font size: the size is dominated by whether the terminal
  SCROLLS. A scrolling frame changes every row, so every frame is a full redraw. Setting
  `Set Height 660` so the whole run fits without scrolling took the same content from 446 KB
  to 279,510 bytes in one change, at a HIGHER framerate and a larger canvas. Five recordings
  were spent tuning the wrong knob.
- The first live probe of the tool outputs was written as one batch of JSON-RPC frames piped
  into the server's stdin, and every call after `work_order_create` came back "there is no
  work order yet". The server answers concurrently, so a batch on stdin is not a sequence:
  the create had not finished writing when the others were dispatched. The replies even
  arrive out of id order, which is the tell. Every figure in the probe, the guide and the
  demo was read off a sequential client afterwards.
- The Pro-tier probe reported every Pro tool refused while holding a valid signed key,
  because the throwaway stdio client set `MCP_LICENSE_KEY: ""` in its own env block AFTER
  spreading `process.env`, so the key was overwritten with an empty string by the very
  helper that was supposed to pass it. The refusal text is identical to a genuine free-tier
  refusal, so nothing on screen said "your key did not arrive".
- `work_order_get` returns `{ work_order, basis }`, not the record. The demo driver read
  `got.lines_detail` off the wrapper and threw on the first run.
- The validator's write-footprint assertion failed on both tiers with `invoice,work-order`.
  It is not a write: resolving the invoice server's client-records path creates an EMPTY
  `invoice` directory as a side effect of the read. The assertion now says the real thing,
  which is that the directory this server does not own stays empty, rather than that it does
  not exist.

insight: a release gate that can only pass or block will be lied to. The Stripe key lost
`product_write` mid-round, so the honest state of the work-order product was neither "wired"
nor "broken" but "waiting on a human with a different key", and the two states the checker
had both misreport it: green claims a checkout that does not exist, red blocks a round over
something no agent can close and trains the next reader to skip the whole report. The fix was
a third state that PRINTS rather than passes, keyed off the product entry saying so itself
with the literal `PENDING_HUMAN` rather than off a hand-maintained waiver list that can go
stale on its own. The dangerous option was the cheap one: a plausible `price_...` string
would have passed the regex, turned the cell green, and failed for the first time in front of
a buyer. A gate with no way to say "not yet" gets one invented for it, in the data.
