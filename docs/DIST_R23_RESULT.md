# Distribution round 23: wire mcp-change-order into the estate (2026-09-06)

status: DONE apart from item 20, see below

Written first as a checklist and updated as each item closes, so a stalled agent leaves a
verifiable state rather than an unknown one. An item is `done` only once the file exists on
disk in its final shape and the evidence column holds a measured result, never a plan.

Opening state: `node scripts/release-check.mjs` -> 30 servers, 28 checks each; the
change-order line reads 14 FAIL plus the `product` named gap (docs/CHANGE_ORDER_RESULT.md).
The hosting agent, running in parallel, owns `remote/` and the hosted fields of
`data/distribution.json` (hosted-row, endpoint); this round does not touch either.

Three named product gaps are expected at the end of this round: the Stripe key still lacks
`product_write` (docs/HUMAN_GATED_PACK.md), so `change-order` ships the literal price
`PENDING_HUMAN` exactly as `work-order` and `catalogue` did.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | office-suite CHILDREN | done | b5fdec9, `servers/office-suite/src/index.ts` CHILDREN, one entry, optional true |
| 2 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | done | b5fdec9, `scripts/build-mcpb.sh` SERVERS, DISPLAY_NAME "Change Order", KEYWORDS; `bash -n` clean |
| 3 | sync-mirrors ALL_SERVERS + topics_for | done | b5fdec9, `scripts/sync-mirrors.sh` ALL_SERVERS and topics_for (change-order variation-order scope-change contract-value) |
| 4 | build-pages ids | done | b5fdec9, `scripts/build-pages.mjs` ids, 30 entries |
| 5 | data/facts.json server row, added lines only | done | `data/facts.json` servers["change-order"], inserted as text at the file's own indent: 22 insertions, 0 deletions across the server row and the compare_none note together |
| 6 | data/facts.json compare_none note, 30-day TTL, with a control | done | `data/facts.json` compare_none["change-order"], 4 tokens (change-order, variation-order, scope-change, contract-value) probed on 2026-09-06 on registry.modelcontextprotocol.io/v0/servers?search=, all 0, the two-word form 0, control `service` 100 in the same minute; ttl 30 days |
| 7 | data/tools.json from a live stdio tools/list | done | `data/tools.json`, 11 rows read from a live tools/list over stdio on a fresh XDG_DATA_HOME, no licence key. 46 insertions, 0 deletions |
| 8 | data/distribution.json per_server row, added lines only, hosted fields left to the hosting agent | done | `data/distribution.json` per_server["change-order"], 13 insertions, 0 deletions; `hosted` left as a pending placeholder naming the hosting agent, so the hosted-row check stays red until that agent writes the published value |
| 9 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | done | 0d775fe, `billing/src/setup.js` SETUP_SERVERS["change-order"], six ANGLE entries, one WEB_ANGLE; the module was imported to prove it parses, 31 entries, and setupPage rendered for all seven clients |
| 10 | guide /guides/change-orders-and-contract-value-from-chat | done | 0d775fe, `billing/src/content.js` GUIDES entry, 9 FAQ rows, 7,151 bytes of html, carrying the two-items insight as its first section after the install and the 100x scale as the second |
| 11 | validate.mjs PROBES["change-order"] with the 100x assertion re-derived from each payload's own items | done | 8f37031, `scripts/validate.mjs` PROBES["change-order"], 16 probe blocks per tier: the first change order with the original value on file, a second original value refused by name, the three lines at +900.00 / -479.88 / +750.00 with change_order_get deriving 117,012 / 26,913 / 143,925, the two-items note, contract_value on a draft (2,000,000 with 117,012 pending), a draft approved directly refused, sent then a line under the client refused then a backdated step refused then approved on the 15th at 2,117,012, contract_value once approved, inheritance on CO-2026-0002, a bare reference refused, the document gate, the payload gate with on Pro the four items 2x450 / -12x39.99 / -3x450 / 5x420 netting 117,012 from its own items and the quote basis 11,701,200 = exactly 100x re-derived from each payload's own items with ready false and posted false, the sixth open change order, the free delete, no delta stored, and the write footprint. Run in isolation: change-order 44/44 |
| 12 | validate.mjs asserts /buy/change-order 503 | done | 8f37031, `scripts/validate.mjs`, alongside the work-order and catalogue assertions and out of the 303 loop. The /buy route needed no edit: the PENDING_HUMAN branch keys on the literal |
| 13 | demo GIF under 400 KB, scripts/demo/change-order.tape + drive.mjs branch | done | 8f37031, `assets/demo-change-order.gif`, 343,573 bytes, 900x720, 47 frames over 17,400 ms, from `scripts/demo/change-order.tape` driving the real built server over stdio on a Pro key; vhs wrote 599,750 bytes at 435 frames, so identical consecutive frames were merged with their durations summed and the palette cut to 32 colours, total duration unchanged; the final frame read back for legibility, with the 100x ratio computed by the driver from the response's own two arrays |
| 14 | assets/change-order-logo.png 400x400 | done | 0d775fe, `assets/change-order-logo.png`, 400x400, the same four flat colours as the catalogue logo, 4 colours counted by PIL with no in-between pixels |
| 15 | build-pages regenerated, billing deployed by wrangler | done | `node scripts/build-pages.mjs` regenerated `billing/src/pages.js` over 30 pages (acd9457); billing deployed by wrangler, version 1b58f47c. build-pages warns that no round has covered change-order, so the /s page has no First five minutes section: see "Left undone" |
| 16 | live: /s/change-order 200, /buy/change-order 503 price-pending-human, guide 200, /setup/claude-web/change-order 200 | done | curl after the deploy: /s/change-order 200, /buy/change-order 503 with x-mcp-buy price-pending-human, /guides/change-orders-and-contract-value-from-chat 200, /setup/claude-web/change-order 200 |
| 17 | Docker catalog entry + repin 30 entries + PR 4892 body row | done | fork commit c5b82e5 on `add-theluckystrike-mcp-servers`: `servers/change-order/server.yaml` added and all 30 entries repinned to 8f37031 after the guard: local HEAD equalled `git ls-remote origin main` and the logo, the GIF and the Dockerfile all fetched 200 over raw.githubusercontent at that sha before any file was rewritten. PR 4892 body gained the row, the name list and the thirty/8f37031 pin line. `go run ./cmd/validate --name change-order` passed name, directory and title and hung at the Docker daemon step; killed at 60 s and recorded |
| 18 | Cline marketplace issue in the shape of 2460 | done | https://github.com/cline/mcp-marketplace/issues/2461 |
| 19 | `node scripts/release-check.mjs` change-order green apart from product and hosted-row | GREEN | 30 servers, 28 checks each, 0 failures, 3 named gaps. The hosted-row and endpoint columns are green too: the hosting agent landed `remote/src/index.ts` and rewrote the `hosted` field of the distribution row to the published value while this round was running, so neither gap is open |
| 20 | `node scripts/validate.mjs` run, remote block count reported only | todo | |

## Not in scope, and what the sibling agents did meanwhile

`remote/` and the hosted fields of `data/distribution.json` belong to the hosting agent. It
landed the `/mcp/change-order` endpoint and set `hosted` to the published value in the
working tree while this round ran, so the `hosted-row` and `endpoint` columns read `ok`
without this round touching either file. The distribution row this round added carried a
placeholder for `hosted` naming that agent; the agent's rewrite of that one field is left
uncommitted in the tree for it to commit. A third agent landed the 18-item adversarial audit
(c9ad909, docs/CHANGE_ORDER_AUDIT.md) and the v0.20.0 release notes, which is why the
regenerated pages.js also carries the v0.20.0 changelog entry.

## The GIF came out at 600 KB, and what was done about it

vhs wrote 599,750 bytes at 435 frames of 40 ms, against the 400 KB recipe cap, because this
demo prints more lines than catalogue's (four payload items, two contract-value readings,
a refusal). gifsicle is not on this machine, so the GIF was reduced in PIL: consecutive
byte-identical frames were merged with their durations summed (435 frames to 47, the sum of
the durations 17,400 ms before and after, asserted), and the palette cut to 32 colours with
no dither. 343,573 bytes. The final frame was read back and every line is legible.

## compare_none rather than a comparison page

Four tokens were probed on 2026-09-06: `change-order`, `variation-order`, `scope-change`,
`contract-value`, plus the two-word form `change order`. All five return 0. The run carried
a control, because a search API that has broken returns zero for everything: `service`
returned 100 rows on the same API in the same minute. What the control surfaces is a
different object in every case (service discovery, name services, pay-per-call trading
tools); nothing in the registry records a variation to a contract or states what the
contract is worth after it. None were called. The self-expiring note stands in place of a
page and re-probes in 30 days.

## The probe's first draft asserted detail fields on a summary response

Check 3 first asserted `added_minor`, `vat_minor` and `delta_gross_minor` on the
`change_order_add_line` response, which carries an order SUMMARY (id, status, delta) and
not the detail. 42/44 on the first isolated run. The probe now calls `change_order_get`
after the third line and asserts the derived figures there, plus `vat_rate_source`
"shared profile", which is the stronger assertion anyway: it proves the VAT came from the
profile the probe wrote and not from a default. The demo driver had the same defect in its
summary line (it printed `undefined` for added and VAT on the first dry run) and was fixed
the same way, with a `change_order_get` call on screen.

## Left undone

- A user-value round for change-order. `billing/test/first-five.test.mjs` requires every
  /s page to carry a First five minutes section quoting a prompt a measured round actually
  ran, and no round has covered change-order, so `node --test billing/test/*.test.mjs` is
  76/81 with all five failures on that one gate for this one server. Plan v25 assigns no
  round to change-order (item 4 is catalogue hosted, item 5 the audit, which landed as
  c9ad909). The page is deployed without the section, as build-pages allows with a warning.
  The next round that covers change-order closes all five.
- The Stripe product and price (human, product_write key), as for work-order and catalogue.

## Evidence

    node scripts/release-check.mjs   green, 3 named gaps, 30 servers, 28 checks each
    change-order  ok ok ok ok ok ok ok ok ok ok ok ok ok ok ok ok gap ok ok ok ok ok ok ok ok ok ok ok
    node --test billing/test/*.test.mjs      76/81, the five on the First five minutes gate for change-order
    scripts/validate.mjs, change-order in isolation   44/44
    wrangler deploy                  version 1b58f47c
    live                             /s/change-order 200, /buy/change-order 503 price-pending-human, guide 200, /setup/claude-web/change-order 200
