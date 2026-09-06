# mcp-change-order: the 18-item adversarial audit

Date 2026-09-06. Scope: `servers/change-order/src`, `servers/change-order/test` and this file.
`remote/`, billing, scripts, the change-order manifests, README and SPEC belong to other
agents; nothing there was touched. Two other agents work in this tree, so every commit is by
path.

Harness: the built server (`servers/change-order/dist/index.js`, rebuilt with
`npm run build -w servers/change-order` before the first probe) driven over stdio through its
own test client, `servers/change-order/test/_client.mjs`, from a probe script in a scratch
directory outside the repo. One sandboxed `XDG_DATA_HOME` per probe, the shared business
profile written by `writeProfile` (Nova Studio, EUR, 23% VAT, Europe/Warsaw) unless the row
says otherwise, free tier unless the row says Pro (a signed key from
`scripts/sign-license.mjs`). Nothing below was scored from the source; every proof is the
tool's own output, quoted, and the two arithmetic rows re-derive the figures in the probe
process with `computeTotals` from `servers/invoice/dist/lib.js`.

The design under test is `docs/CHANGE_ORDER_RESULT.md`: minor units in the store, the delta
derived on every call, a changed line emitted as a reversal and a revised item, the invoice
payload in MAJOR units beside the quote payload in MINOR units, the running value as original
plus APPROVED deltas only, and a status machine with three terminal states.

---

## The 18 items

| # | Probe | Result | Proof |
| --- | --- | --- | --- |
| 1 | Reversal-plus-revised emission for a changed line (a net item would hide the audit trail) | PASS, with D-R100 found in the description | Pro, worked order approved, `change_order_invoice_payload`: L03 (was 3 x 45000, now 5 x 42000) became two items, `part: "reversal"` with `quantity: -3, unit_price: "EUR 450.00", value_minor: -135000` and `part: "revised"` with `quantity: 5, unit_price: "EUR 420.00", value_minor: 210000`. Four items for three lines; no item carries the net 75000. The `invoice_create` items are `2 x 450`, `-12 x 39.99`, `-3 x 450`, `5 x 420`. The defect was in the description the reversal carried: `"Website audit (was 3 x 45000, reversed: ...)"` and `"(now 5 x 42000)"`, a bare MINOR figure inside an item whose `unit_price` is 450 in MAJOR units. That is D-R100 below; after the fix the same call returns `"Website audit (was 3 x EUR 450.00, reversed: Two more sites in scope, volume price agreed)"` and `"(now 5 x EUR 420.00)"` |
| 2 | Negative quantity on removal versus `quote_create` refusing it (the `ready` flag) | PASS | Same payload: `quote_create.ready: false`, `not_ready_because: "quote_create refuses a quantity that is not greater than zero, and this delta carries a removal or a reversal"`, quote quantities `[2, -12, -3, 5]`, unit `"MINOR units, which is what quote_create's unit_price_minor takes"`. The invoice quantities are the same `[2, -12, -3, 5]`, which `invoice_create` takes (its bound is `-1e12..1e12`, `servers/invoice/src/index.ts` line 473). Note: `"quote_create refuses a quantity that is not greater than zero, so this delta cannot be quoted as it stands. The quote payload is shown for its scale, with ready false. Re-quote the job whole in the quotes server, or invoice the delta."` |
| 3 | The 100x scale seam, re-deriving the net from each payload's own items | PASS | `computeTotals(invoice_create.arguments.items, "EUR", 0, 0)` in the probe process: `net_minor 117012, tax_minor 26913, total_minor 143925, drift 0`, equal to the payload's `totals`. The quote items fed into the same engine with `unit_price_minor` read as `unit_price`: `net_minor 11701200`. Quotient `11701200 / 117012 = 100`, exactly, from the two payloads as returned |
| 4 | `contract_value` with pending versus approved versus rejected versus void deltas | PASS | Four change orders against Q-2026-0003 worth 10000, 20000, 30000, 40000, one in each state: `original 2000000, approved 10000, current 2010000, pending 40000, if_all 2050000, rejected 20000, void 30000`, `counts {draft 1, sent 0, approved 1, rejected 1, void 1}`, and per row `CO-2026-0001:approved:10000:approved`, `CO-2026-0002:rejected:20000:nothing`, `CO-2026-0003:void:30000:nothing`, `CO-2026-0004:draft:40000:pending`. The rejected and void deltas are listed and add to nothing; `change_order_list` totals agree: `approved_delta_minor 10000, pending_delta_minor 40000` |
| 5 | Approving twice | PASS | Second `change_order_status approved` on an approved order: `Error: CO-2026-0001 is already approved. Nothing was written.` History still holds 2 events (draft to sent, sent to approved); `contract.current_minor 2117012`, not counted twice |
| 6 | Voiding an approved order | PASS | `Error: CO-2026-0001 is approved, which is final. A change order that has been approved is a fact about what the client answered; a change of mind is a new change order against the same reference. Nothing was written.` `change_order_delete` on it: `Error: CO-2026-0001 is approved, not draft, so it cannot be deleted. It reached approved on 2026-03-15, and that is a fact about what was sent to a client.` Contract stays `current 2117012, counts {approved 1}` |
| 7 | A removal larger than the original quantity | **FAIL, D-R99, FIXED** | Original 47988 (12 x 3999). `change_order_add_line removed 13 x 3999` was accepted (`delta_minor -51987`), `contract_value` then printed `"if_all_pending_approved": "EUR -39.99"`, and after sent plus approved the running value was `current_value EUR -39.99 current_value_minor -3999`. A contract worth less than nothing, approved and on file. A changed line reversing `9 x 10000` against an original of 10000 was accepted the same way (`if_all_pending_approved -90000`). After the fix the same line is refused: `Error: CO-2026-0001 with L01 would take Q-2026-0009 below zero: the original EUR 479.88 plus this change order's -EUR 519.87 is -EUR 39.99. A contract cannot be worth less than nothing, so a removal cannot take out more than is on it. Check the quantity being removed, or the original value on file. Nothing was written.` and the store holds 0 lines. Removing exactly 12 x 3999 lands on zero and is accepted |
| 8 | A changed line whose reason is empty | PASS | `kind: "changed"` with `reason` of `""`, `"   "` and `"\n\t"`: each `Error: reason is empty. A change with no reason is the line the client queries first. Nothing was written.` Omitted: `MCP error -32602: Input validation error: ... Required at reason`. 0 lines on file after all four |
| 9 | Dates out of order (approval before creation) | PASS | Order raised 2026-03-10. `sent` dated 2026-03-09: `Error: CO-2026-0001 was raised on 2026-03-10 and this status change is dated 2026-03-09, before it.` Sent on 03-13, then `approved` dated 2026-03-01: `was raised on 2026-03-10 and this status change is dated 2026-03-01, before it`. `approved` dated 03-12: `reached sent on 2026-03-13 and this change is dated 2026-03-12, before it. A status history that runs backwards cannot be read as a timeline.` `date: "2026-13-40"` on create: `cannot read a date: date "2026-13-40" is not a real date in YYYY-MM-DD form`. An order raised on a future date (2027-01-01) takes a line dated by default on that day, and a status with no date (today, 2026-09-06) is refused as before the raising, so the timeline rule holds in that direction too |
| 10 | Minor-unit prices that are not integers | PASS | `original_value_minor 1999999.5`: `Expected integer, received float at original_value_minor`. `unit_price_minor 449.99`: `Expected integer, received float at unit_price_minor`. `was_unit_price_minor 450.5`: `Expected integer, received float at was_unit_price_minor`. All three refused at the schema, nothing written. A fractional QUANTITY at an integer price is a different thing and is taken: `2.5 x 45001` lands `delta_minor 112503` (`roundHalfUp(112502.5)`), the same basis `computeTotals` uses |
| 11 | A reference with no original value | PASS | First create on Q-2026-0042 without `original_value_minor`: `Error: Q-2026-0042 has no change order yet, so original_value_minor is required: the contract value before any change, net of VAT, in whole minor units (26136300 is EUR 261,363.00). This server does not open the quotes or work-order store to find it, so a running value that started from nothing would be nothing but this change order's own delta. Nothing was written.` `contract_value` on it: `no change order is on file against "Q-2026-0042" ... Nothing was invented.` `original_value_minor -1`: `Number must be greater than or equal to 0`. An explicit `0` is accepted as a stated figure; with D-R99 in place a zero original can only ever carry additions, which is exactly a contract that starts from nothing said out loud |
| 12 | Concurrent creates against one reference | PASS | Two server processes on one data dir, `change_order_create` on Q-2026-0050 at the same instant with `original_value_minor` 100000 and 200000: process 0 `OK CO-2026-0001 original 100000`; process 1 `Error: Q-2026-0050 already has 1 change order(s) and its original value is on file as EUR 1000.00 (100000 minor, from CO-2026-0001). This call says 200000. A contract with two original values has two running values.` One original on file. Six more creates raced from the two processes: four `OK` (CO-2026-0002 to 0005, no id reused) and two refused at the free cap; `open 5` on file |
| 13 | A huge reason string | PASS | 2001 characters: `reason must be 2000 characters or fewer at reason`. 200,000 characters: same refusal. 3000 spaces: same refusal (the length check runs before the whitespace check, so it is refused either way). 2000 characters: accepted, `stored reason length 2000`. A 200,000-character title: `title must be 2000 characters or fewer at title` |
| 14 | The free-tier gate messages | PASS | `change_order_document` on free: `Error: the change order document is Pro. Nothing was written. "the change order document" is a Pro feature. Pro is a one-time $19 for this server, lifetime. Buy at https://mcp.zovo.one/buy/change-order?src=change-order.change_order_document , then run license_activate with the key shown after checkout. Keys verify offline; nothing is sent anywhere. The exact figures for this request are only in the free tools' output above; any total or journal composed outside them is an estimate, not a figure from the books. Or all 30 servers for $39: https://mcp.zovo.one/buy/bundle?src=change-order.change_order_document.bundle`. `change_order_invoice_payload` the same with `src=change-order.change_order_invoice_payload` and `...invoice_payload.bundle`. The sixth open create: `the free tier holds 5 open change orders and 5 are open (CO-2026-0002 draft, ... CO-2026-0006 draft). Closing one frees its slot ... All of those stay free. Nothing was written.` then `upgradeText` with `src=change-order.change_order_create`. Each message: src tag on the buy link, the NO_HAND_MATH sentence, and the bundle sentence last |
| 15 | The profile currency | PASS | Profile `default_currency: "pln"` (lower case): the order is `PLN`, original `PLN 20000.00`. Explicit `currency: "jpy"`: `JPY`, original `JPY 500000` (no decimals). `currency: "EURO"`: `currency must be a 3-letter ISO code such as EUR at currency`. No profile at all: `EUR, vat source none`. A profile with no `default_currency`: `EUR` |
| 16 | The document text on Pro | PASS | Draft document: header `CHANGE ORDER / CO-2026-0001 / Nova Studio / ul. Prosta 1, Warsaw`, `Sent not sent yet`, `Status draft`, the three lines each with its reason (`changed Website audit was 3 x EUR 450.00, now 5 x EUR 420.00 +EUR 750.00`), `Net delta +EUR 1170.12`, `VAT 23% on +EUR 1170.12 +EUR 269.13`, `Delta gross +EUR 1439.25`, then `Original EUR 20000.00 / This change order +EUR 1170.12 (pending, not yet part of the contract) / Value if approved EUR 21170.12 / Value today EUR 20000.00`, the approval block, `NOTES Agreed by phone on 9 March`, and the draft note. A second pending order after the first was approved prints `Previously approved (CO-2026-0001) +EUR 1170.12`, `Value if approved EUR 20690.12`, `Value today EUR 21170.12`. The approved document: `Sent 2026-03-13`, `Status approved on 2026-03-15`, `(approved)` |
| 17 | A zero-decimal currency across the two scales (JPY, profile VAT 10) | PASS | Items `3 x 12345` added and `1 x 1001` changed to `2 x 999`: invoice items `unit_price 12345 / 1001 / 999` (major equals minor at zero decimals), quote items `[3,12345],[-1,1001],[2,999]`. `computeTotals` over the invoice items: `38032` net, `3804` VAT, equal to the payload's `totals` and to `change_order_get`'s `+JPY 38032`. Document: `was 1 x JPY 1001, now 2 x JPY 999 +JPY 997`, `Value today JPY 538032`. Before D-R100 the descriptions read `was 1 x 1001` and happened to be right only because JPY has no minor unit; after, `was 1 x JPY 1001` |
| 18 | A hand-corrupted store, and a duplicate raised against a closed order | PASS | Same reference, title, client and currency once the first is approved: `CO-2026-0001 is already this change order: Q-2026-0003, "Second landing page, drop hosting, widen the audit", Harbour Cafe, EUR. It is approved. Nothing was written.` Store overwritten with `[{"id": "CO-2026-0001"`: `contract_value` and `change_order_create` both `Error: data file is corrupt; moved to .../change-orders.json.corrupt-2026-09-06T07-31-22-232Z; nothing was written.` Directory after: `change-orders.json.corrupt, change-orders.json.corrupt-<stamp>, counter.json`, no fresh empty store written in its place |

Scorecard: **16 / 18** before the fixes, 18 / 18 after; two source defects, both fixed as
rules with a test each that fails on the pre-fix source and passes on the fixed one.

---

## The defects

**D-R99, change-order, high, FIXED.** *A removal larger than the contract was accepted and
approved, and the running value went below zero.* `change_order_add_line` bounded the line
by its own arguments only (quantity positive, price non-negative), never by what the
reference is worth, so `removed 13 x 3999` against an original of 47988 was taken, the
document read `Value if approved EUR -39.99`, and approval put `current_value_minor -3999`
on file as the contract. The server cannot see the original QUANTITY of a line (it never
opens the quotes or work-order store, by design), but it holds the original VALUE and every
approved delta, so the rule is on value. `valueIfApproved(siblings, o)` in `src/order.ts` is
the original plus every OTHER approved delta plus this order's own net; `belowZeroError`
names the three figures and the result when it is negative. It runs twice: in
`change_order_add_line` on the candidate record before the line is pushed (so a refusal
leaves the store as it was), and again in `change_order_status` on the move to `approved`,
because another change order against the same reference may have been approved since the
lines were added and the approval is what commits the value. Two drafts that are each fine
alone (remove 100.00, then remove 0.01 against an original of 100.00) pass the line check
and the second is refused at approval: `approving CO-2026-0003 would take Q-2026-0010
below zero: the original EUR 100.00 plus -EUR 100.00 already approved plus this change
order's -EUR 0.01 is -EUR 0.01. Void it and raise the change against the figures on the
contract.` Landing on exactly zero is accepted: a cancelled contract is worth nothing, not
less than nothing. Test: `adversarial.test.mjs` "D-R99: a removal that takes the reference
below zero is refused at the line, and again at the approval". `if_all_pending_approved`
can still print a negative projection while two such drafts are both open; that is a
projection of a set that the approval rule will not let happen, and it is left visible
rather than clamped.

**D-R100, change-order, medium, FIXED.** *The reversal and revised item descriptions
carried a bare MINOR figure into the MAJOR-unit invoice payload.* `deltaItems` wrote
`"Website audit (was 3 x 45000, reversed: ...)"` and `"(now 5 x 42000)"` while the same
item's `unit_price` was `450` for `invoice_create`. That is the 100x seam the whole payload
is built to keep out of the customer's hands, written into the customer's own invoice line,
where a reader has "3 x 45000" beside "450.00" and no way to tell which one the contractor
meant. On JPY it happened to read right because major equals minor. Rule in `src/order.ts`:
a description never carries a bare minor figure; every price inside one is formatted with
`formatMoney` from the invoice engine and its currency code, so the reversal now reads
`(was 3 x EUR 450.00, reversed: ...)` and the revised item `(now 5 x EUR 420.00)`, the
same words the document already used. Test: `adversarial.test.mjs` "D-R100: an invoice item
description never carries a bare minor figure into a major-unit document", which also
asserts no description across the invoice, quote and item lists matches `45000`, `42000`
or `3999`.

### Findings that are not defects

- An explicit `original_value_minor: 0` is accepted (item 11). It is a stated figure, and
  the refusal for a MISSING one names the exact thing a model reaching for zero is doing.
  With D-R99 a zero original refuses every removal and reversal, so it can only ever grow.
- A fractional quantity at a whole minor price is accepted (item 10, `2.5 x 45001`), and
  the delta is `roundHalfUp` of the product, the basis `computeTotals` applies to the item
  it becomes. Half days and part hours are real; half cents are not, and those are refused.
- A change order raised on a future date takes lines dated that day by default and refuses
  a status change dated today as "before it" (item 9). The timeline rule is consistent;
  whether a change order can be raised in the future at all is a product question, not
  an arithmetic one, and was left as built.

---

## Final test summary

    npm run build -w servers/change-order            tsc clean, no output
    node --test servers/change-order/test/adversarial.test.mjs
      with src stashed (pre-fix)                     # tests 19 / # pass 17 / # fail 2
                                                     not ok 18 D-R99, not ok 19 D-R100
    npm test -w servers/change-order (fixed)         # tests 49 / # pass 49 / # fail 0
                                                     (unit 12, adversarial 19, concurrency 4, contract 14)

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build -w servers/change-order: tsc clean
    - npm test -w servers/change-order: # tests 49 / # pass 49 / # fail 0
    - 18 probes driven over stdio through test/_client.mjs from a scratch directory,
      16 pass on the shipped build, 2 source defects found and fixed as rules
    - D-R99: removed 13 x 3999 against an original of 47988 was approved and the
      running value went to EUR -39.99; now refused at the line and at the approval,
      naming the original, the approved deltas, this delta and the negative result
    - D-R100: the reversal item description read "was 3 x 45000" inside an
      invoice_create item priced 450 in major units; now "was 3 x EUR 450.00"
    - the 100x quotient from each payload's own items: 11701200 / 117012 = 100,
      re-derived in the probe process; JPY lands 38032 in both scales
    artifacts:
    - /Users/mike/mcp-servers/docs/CHANGE_ORDER_AUDIT.md
    - /Users/mike/mcp-servers/servers/change-order/src/order.ts
    - /Users/mike/mcp-servers/servers/change-order/src/index.ts
    - /Users/mike/mcp-servers/servers/change-order/src/lib.ts
    - /Users/mike/mcp-servers/servers/change-order/test/adversarial.test.mjs
    cost: about 40 wall minutes
    failures:
    - The first build after the src edit was run from inside servers/change-order,
      where `npm run build -w servers/change-order` reports "No workspaces found";
      the workspace flag resolves from the repo root only
    - The first git stash was run from the same cwd and doubled the pathspec;
      both were redone from the root
    insight:
    - The two defects are one fact seen from two sides: a server that refuses to
      open the sibling store cannot check a removal against the quantity it removes,
      so the only bound it can put on a removal is the value of the contract, and
      the only figure it can safely print in a customer-facing line is a formatted
      one. Both rules follow from "this server holds minor units and the original
      value, and nothing else"

Built by theluckystrike. https://github.com/theluckystrike
