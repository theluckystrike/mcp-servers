# Distribution round 22: wire mcp-catalogue into the estate (2026-09-06)

status: DONE

Written first as a checklist and updated as each item closed, so a stalled agent leaves a
verifiable state rather than an unknown one. The agent that opened this round was killed by a
session limit partway through item 2; a second agent read this file, reviewed the uncommitted
working tree it left, and finished the round.

Opening state: `node scripts/release-check.mjs` -> 29 servers, 28 checks each, 16 failures,
14 of them `catalogue` and 2 estate-wide, plus the `work-order` named product gap carried
over from round 21.

Two named product gaps are expected at the end of this round, not one: the Stripe key in the
keychain still lacks `product_write` (docs/HUMAN_GATED_PACK.md), so `catalogue` ships the
literal price `PENDING_HUMAN` exactly as `work-order` did.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SERVER_COUNT 28 -> 29 committed | done | c4f4efd, `packages/mcp-license/src/index.ts` and `remote/src/shims/license.ts`, both read 29. Landed by the killed agent before it stopped, and re-verified by grep at the end of this round: `docs/CATALOGUE_RESULT.md` still says both read 28, and that note is now stale |
| 2 | PRODUCTS entry, bundle derives twenty-nine and $512 | done | f276957, `billing/src/index.js` PRODUCTS["catalogue"], price the literal `PENDING_HUMAN`, usd 19, payload catalogue. `SERVER_COUNT` 29 and `BUNDLE_SAVING_USD` 512 both derive from PRODUCTS (29 x 19 = 551, less the $39 bundle). NUMBER_WORD gained a 29 row, FREE_FIVE_WORDS a catalogue row, and `billing/test/checkout.test.mjs` moved to `/^Twenty-nine MCP servers/`. Verified by importing the module: `checkoutDescription("bundle")` reads "Twenty-nine MCP servers for Claude, one lifetime key, saves $512 against buying singly" |
| 3 | validate.mjs asserts /buy/catalogue 503 | done | `scripts/validate.mjs`, alongside the work-order assertion and out of the 303 loop, with the comment saying why. Verified live: `curl https://mcp.zovo.one/buy/catalogue` -> 503, `x-mcp-buy: price-pending-human`. The /buy route needed no edit: the branch added in round 21 keys on the `PENDING_HUMAN` literal rather than on the server name, so it covered the second such product with no change |
| 4 | office-suite CHILDREN | done | `servers/office-suite/src/index.ts` CHILDREN, one entry, optional true |
| 5 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | done | `scripts/build-mcpb.sh` SERVERS, DISPLAY_NAME "Catalogue", KEYWORDS |
| 6 | sync-mirrors ALL_SERVERS + topics_for | done | `scripts/sync-mirrors.sh` ALL_SERVERS and topics_for (catalogue price-list rate-card pricing) |
| 7 | data/facts.json | done | `data/facts.json` servers["catalogue"], inserted as text at the file's own indent so the diff is added lines only: 22 insertions, 0 deletions across both the server row and the compare_none note |
| 8 | build-pages ids, regenerate, deploy billing | done | `scripts/build-pages.mjs` ids; `node scripts/build-pages.mjs` regenerated `billing/src/pages.js` over 29 pages, 472,219 bytes; billing deployed by wrangler, version 5bfb75b8. Verified live: /s/catalogue 200, /buy/catalogue 503, /guides/price-lists-and-rate-cards-from-chat 200, /setup/claude-web/catalogue 200 |
| 9 | data/tools.json from a live tools/list | done | `data/tools.json`, 12 rows read from a live tools/list over stdio on a fresh XDG_DATA_HOME. Added lines only |
| 10 | validate.mjs probes + buy list | done | `scripts/validate.mjs` PROBES["catalogue"], 16 assertions per tier: the three-row ladder, three dates picking three different rows each naming its valid_from, the from_row and superseded_by block, the pre-ladder date refused, an unknown sku refused by name, the worked resolution's four line values and three totals, THE 100x SCALE re-derived from the two payloads themselves, posted false, the tier gate, the PDF gate with the free text list ungated, the report gate, the 26th SKU, the free delete against a used-code refusal, no stored current price, and the write footprint. `node scripts/validate.mjs` 902/902, exit 0 |
| 11 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | done | `billing/src/setup.js` SETUP_SERVERS["catalogue"], six ANGLE entries, one WEB_ANGLE; the module was imported to prove it parses, 30 entries |
| 12 | guide /guides/price-lists-and-rate-cards-from-chat | done | `billing/src/content.js` GUIDES entry, 9 FAQ rows, 6,639 bytes of html, carrying the 100x scale insight as its first section after the install |
| 13 | compare_none note | done | `data/facts.json` compare_none["catalogue"], 4 tokens (price-list, rate-card, catalogue, pricing) probed on 2026-09-06, with a control, ttl 30 days |
| 14 | demo GIF under 400 KB | done | `assets/demo-catalogue.gif`, 307,255 bytes, 900x720, 432 frames, from a new `scripts/demo/catalogue.tape` driving the real built server over stdio, and the final frame read back for legibility |
| 15 | assets/catalogue-logo.png | done | `assets/catalogue-logo.png`, 400x400, the same four flat colours as the work-order logo with no anti-aliased in-between pixels |
| 16 | Docker catalog entry + repin 29 entries + PR 4892 body row | done | fork commit b848085 on `add-theluckystrike-mcp-servers`: `servers/catalogue/server.yaml` added and all 29 entries repinned to 8920da5 after the HEAD check; PR 4892 body gained the row, the name list and the twenty-nine/8920da5 pin line. See "The repin pinned a descendant" below |
| 17 | Cline marketplace issue | done | https://github.com/cline/mcp-marketplace/issues/2460 |
| 18 | data/distribution.json hosted row | done | `data/distribution.json` per_server["catalogue"], inserted at the file's own indent so the diff is added lines only |
| 19 | Round 37 user-value run into data/user_value_r37.json | done | `data/user_value_r37.json`, six-prompt stdio free-tier round through the claude CLI, 14/18. Every figure re-derived over stdio afterwards on a COPY of the round's store |
| 20 | `node scripts/release-check.mjs` green apart from the two named product gaps | GREEN | 29 servers, 28 checks each, 0 failures, 2 named gaps |

Not in scope here: `remote/src/index.ts` SERVERS (`endpoint`), which the remote agent owns.
It landed `catalogue` while this round was running, so the `endpoint` gap closed without this
agent touching that file, and `scripts/validate.mjs` already carried the server in its hosted
`tools/list` sweep.

## What the working tree held when this round was picked up

The killed agent left `billing/src/index.js` and `billing/test/checkout.test.mjs` uncommitted
among 35 other modified paths, most of them bundle manifests belonging to a different round.
Both edits were reviewed rather than trusted and both were right: the PRODUCTS entry with the
`PENDING_HUMAN` literal, the NUMBER_WORD 29 row, the FREE_FIVE_WORDS row, and the test moved
from Twenty-eight to Twenty-nine. The derivation was checked by importing the module before
committing, because the count and the saving are both derived and a wrong NUMBER_WORD row
would have shipped a bundle description that reads "undefined MCP servers". They were
committed BY PATH, so none of the 35 unrelated modified paths rode along.

## The insight, and where it went

The measured figure this server exists to demonstrate is that the two servers it feeds take
the same price in different scales, and the gap is exactly 100x. `invoice_create`'s item
carries `unit_price` in MAJOR units, documented in its own schema as "Price per unit in major
units, e.g. 90 for 90 EUR". `quote_create`'s item carries `unit_price_minor` in MINOR units,
documented as "9000 = 90.00 EUR, 90 = JPY 90. Never a decimal". Both fields are plain
numbers, both are called the unit price in ordinary speech, and neither tool can tell that the
number it was handed was scaled for the other one: 45000 passed as `unit_price` is a perfectly
valid invoice line for EUR 45,000.00, and it reconciles against itself all the way to the
total. On the worked resolution the correct payload nets 261,363 minor units and the quote
payload's field fed into the invoice engine nets 26,136,300. In a 3-decimal currency such as
KWD the gap is 1000x.

That figure is now carried, in the same terms, by the guide
`/guides/price-lists-and-rate-cards-from-chat`, the `measured` field of the setup entry, the
`facts.json` server row, the vscode and claude-web angles, the Docker catalog description and
the Cline issue. It is asserted in the validator probe, and the assertion is deliberately not
"both payloads exist": the probe parses the response, re-derives the net from
`invoice_create.arguments.items` on a major basis and from `quote_create.arguments.items` on a
minor basis, and asserts the quotient is exactly 100. A change of scale fails the build rather
than quietly mispricing every invoice by two orders of magnitude. It is also on screen in the
demo GIF, where the ratio is computed by the driver from the response's own two arrays rather
than hardcoded.

## compare_none rather than a comparison page

Four tokens were probed on 2026-09-06: `price-list`, `rate-card`, `catalogue`, `pricing`. The
run carried a control, because a search API that has broken returns zero for everything. What
the tokens do not turn up is a server that HOLDS a price list as a history: rows with
valid-from dates, the price on a date worked out on the call, and a refusal for a date before
every row. The rows the control surfaces are a different object in both directions: e-commerce
and marketplace connectors that READ a price out of somebody else's system, and currency and
market-data servers that fetch a rate, which is a price nobody set and nobody has to stand
behind on an invoice. None were called, because probing a remote endpoint someone else meters
is a paid API call. The self-expiring note stands in place of a page and re-probes in 30 days.

## The repin pinned a descendant, and why that was the right call

The guard in round 21 was: local HEAD must equal `git ls-remote origin main`, and both the
logo and the Dockerfile must return 200 at that sha over raw.githubusercontent, before any
file is rewritten. The first check passed cleanly at `f276957`, and at that sha the Dockerfile
returned 200 and `assets/catalogue-logo.png` returned 404, because the logo had not been
committed yet: it was still being produced. Polling held it at 404 for the full ten minutes,
19 tries.

Pinning `f276957` anyway would have written a measured 404 into 29 `icon:` URLs, which is the
exact failure the raw fetch exists to catch, so the guard was honoured rather than waived.
During the poll the logo landed and remote main moved to `8920da5`, where both assets return
200. That sha was pinned after confirming with `gh api compare` that it is a strict
fast-forward descendant of the verified HEAD, ahead 6 and behind 0. The deviation from round
21 is that local HEAD no longer equals remote main at repin time, and the reason is a sibling
push during the poll rather than drift in a working tree. The state that matters is the one
the guard actually tests, which is that both assets are 200 at the sha being written, and it
is.

`go run ./cmd/validate --name catalogue` passed name, directory and title and then hung at the
step that needs a Docker daemon this machine does not run; it was killed at 55 seconds and
that is recorded rather than waited on, with the PR 4892 submitter checklist saying so in the
same words rather than leaving a check mark that claims more than was done.

## Round 37, and what it found

Six prompts, one conversation, free tier, stdio, on an empty store, one server registered.
14 of 18, against work-order's 16 in round 35. Every numeric figure was re-derived over stdio
afterwards on a COPY of the round's store, so the verification never mutated what it verified:
the copy's own resolution came back RES-2026-0002 against the round's RES-2026-0001, which
proves the original counter was untouched. Every figure the model READ from a tool result
matched to the minor unit.

**The finding of the round is that the model stated the valid-from rule correctly and then
applied it backwards, but only to the one date the user did not supply.** On turn one it
described the rule in its own words, that the row picked is the latest `valid_from` still on or
before the date, and then called the in-force row "not active until July" two months after that
July, said the price was the middle row "since today is 2026-09-06", and told the user two
other SKUs "would report no price in force yet" because a 2026-01-01 row is "in the future".
The `sku_set` result it was quoting carried `"in_force_on": "2026-09-06"` with the correct
`in_force` block in the same message. Re-derived on the copied store, all three of those
prices are in force today.

Prompts 2 and 3 then answered the identical ladder perfectly on dates the user supplied, and
nothing in the rest of the conversation ever corrected the record. So the defect is confined
to the question the user did not date, which is precisely the question a price list exists for:
what is this worth now. The server already answers it, in the field the model was reading. This
is a case for the setup copy and the guide to state the rule in the direction the failure takes
rather than the direction it is naturally written in, and the guide's ladder section now works
an example forwards through three dates for that reason.

The clean parts are worth recording too. Prompt 4 is a 3: one `lines_resolve` call, both
payloads reproduced byte for byte, the net verified at zero VAT and zero rounding drift, and
the 100x scale trap named without being asked. Prompt 6 refused an invited "just tell me yes"
and worked the 100x error in both directions, which is the point round 35 lost on a softened
closing sentence. And for the second round running, no refused Pro output was rebuilt by hand
with invented figures, which was the recurring defect of rounds 29, 31 and 33. Prompt 5 lost a
point for predicting two Pro refusals rather than producing them, saying it had not attempted
them since they would fail the same way, and for offering to hold a trade price outside the
catalogue, which is the spreadsheet this server exists to replace.

## Evidence

    node scripts/release-check.mjs   green, 2 named gaps, 29 servers, 28 checks each
    node scripts/validate.mjs        902/902, exit 0
    node --test billing/test/*.test.mjs      81/81
