# Recoverable slots: a free-tier cap you can get back under (2026-09-06)

status: DONE

Round 31 (docs/DIST_R19_RESULT.md, finding 3) measured the shape: `loan_create` accepted a
byte-identical agreement twice, there was no delete tool, and a user who recorded the same
lease twice on the free tier had two of their three slots gone with no way back except a Pro
key. The same shape existed on every record-creating server in the estate. Rounds 29 and 31
also lost the same point twice: refused by a cap, the client totalled over data the server
would not return and hand-wrote a journal with account names of its own.

Two changes, both estate-wide.

## 1. Every cap message now says not to do the arithmetic by hand

One sentence, built in the one place every cap message is built:

    Do not total or journal by hand from refused data; the free tools above already carry the
    exact figures.

It sits between the buy line and the bundle line in `upgradeText` and `hostedUpgradeText`
(`packages/mcp-license/src/index.ts`, constant `NO_HAND_MATH`) and in the hosted twin
(`remote/src/shims/license.ts`), so it reaches stdio and streamable-HTTP alike. It was placed
BEFORE the bundle sentence deliberately: `packages/mcp-license/test/bundle-link.test.mjs`
asserts every cap message still ENDS with the bundle link, and the conversion instrument
(docs/CONVERSION_INSTRUMENT.md) depends on that ending being stable.

## 2. Per server: a duplicate is refused by name, and a delete gives the slot back

Every create tool below refuses a byte-identical record BEFORE the cap is consulted, so the
refusal names an existing id rather than selling an upgrade, and burns neither a slot nor an
id. Every delete tool below is free on every tier: a way back that only a Pro key can reach is
not a way back.

| Server | Free cap, and what it counts | Create tool, duplicate refused on | Delete tool | Dependent that refuses the delete |
| --- | --- | --- | --- | --- |
| amortization | 3 loans, stored records | `loan_create`: name, lender, principal, currency, rate, compounding, payment frequency, term, method, start date, fees, balloon, kind | `loan_delete` | a journal taken from it (`loan_journal` now stamps the period or month it produced) |
| deposits | 5 deposits a calendar month, stored rows dated in the month | `deposit_record`: client, amount, currency, kind, received date, reference (notes excluded) | `deposit_delete` | money already applied to an invoice, or already refunded |
| billing-docs | 5 documents a calendar month, both stores by issue date | `credit_note_create` and `purchase_order_create`: the whole document, line for line | `credit_note_delete`, `purchase_order_delete` | a credit note posted to its invoice (`credited_minor`) or rendered to a file; a purchase order with a receipt or rendered to a file |
| quotes | 5 open quotes, stored rows in the open state | `quote_create`: client, lines, totals, dates, notes, against open quotes only | `quote_delete` | sent, accepted, invoiced, declined or exported (send and PDF now leave a stamp) |
| cash-book | 3 periods a calendar month, rows in `periods.json` | `ledger_build`: the range, currency and the figures the rebuild would write | `period_delete` | a closed month whose snapshot covers the period |
| per-diem | 5 trips a calendar month, stored trips dated in the month | `trip_record`: name, traveller, scheme, destination, start and end as instants, meals, deductions, currency, per-day lines | `trip_delete` | marked exported, or an expense-tracker row citing the trip id |
| asset-register | 10 assets, stored records | `asset_add`: name, category as the resolved table code, cost, residual, currency, dates, method, life, scheme, against undisposed assets | `asset_delete` | disposed, or journalled (`asset_journal` now stamps the month) |
| invoice | 3 invoices a calendar month; clients are NOT metered | `client_add`: name, address, email, tax id, normalised | `client_delete` | an invoice, quote, credit note, purchase order, deposit, statement or recurring schedule referencing the client |
| kanban | 3 projects, 200 open tasks | `task_add`: title, project, column, priority, due, estimate, notes, tags, against OPEN tasks only | `project_delete` | any task on the board, open or done |

Three entries in the plan did not survive contact with the source, and are recorded rather
than papered over:

- **kanban has no `project_set`.** A board is created as a side effect of `task_add` when the
  project name resolves to nothing, and boards are keyed by lowercase name, so a second board
  identical to an existing one was already impossible. The real slot burn is a repeated
  `task_add`, and that is where the guard went.
- **invoice does not meter clients.** `client_delete` frees the record and the name for reuse;
  it does not return an invoice slot, and the success message says so rather than implying it,
  so nobody deletes clients hoping to reset the invoice counter.
- **cash-book's `ledger_build` already keyed on the range**, so a repeat never allocated a
  second row. The harm was the softer form: a rebuild that answered as if it had done
  something while writing the same figures back. That is what is refused now; a period whose
  sibling ledger actually moved still rebuilds.

An id is never reissued anywhere. Counters allocate ids, caps count rows, and a deleted
DEP-2026-0003 is retired rather than handed to the next record: an id a client may have seen
on a receipt must not come back attached to different money.

## Evidence

    npm test -w packages/mcp-license          34/34
    npm test -w servers/amortization          49/49
    npm test -w servers/deposits              40/40
    npm test -w servers/billing-docs          50/50
    npm test -w servers/quotes                32/32, 1 pre-existing skip
    npm test -w servers/cash-book             46/46
    npm test -w servers/per-diem              36/36
    npm test -w servers/asset-register        49/49
    npm test -w servers/invoice               53/53, 1 pre-existing skip
    npm test -w servers/kanban                29/29
    npm test (remote)                         30/30
    node remote/build-vendor.mjs              no DRIFT, all 26 vendored
    node scripts/validate.mjs                 764/764, exit 0 (was 762 checks; 2 added)
    cd remote && npm run deploy               version 7832f715-23b1-4559-ba95-a99c79c43821
    live hosted gate                          the sentence returned by mcp.zovo.one/mcp/amortization on an anonymous token

SPEC.md was regenerated by `node scripts/gen-spec.mjs <name>` for every changed server except
`quotes`, which has no curated block in the generator; its SPEC.md was edited by hand in the
generator's own shape, with each tool description verified byte-for-byte against `dist/index.js`.

## Failures

- `node remote/build-vendor.mjs` threw `patch did not apply: quotes quote_send_text download`.
  The quotes work added a `sent_date` stamp inside `quote_send_text`, which split the two-line
  anchor the hosted patch matched on. Re-anchored on the single `const body = ...` line the
  stamp left intact, with the reason written next to it. This is the load-bearing case for the
  DRIFT check: the patch failed loudly rather than vendoring a stdio handler that would have
  written a file Workers cannot write.
- `node scripts/validate.mjs` came back 758/762 on the first run after the server work, four
  failures across two servers, and every one of them was a probe measuring the OLD behaviour
  rather than a defect. The deposits cap probe recorded five identical deposits to fill the
  month, so it now met the duplicate guard instead of the cap; each one was given its own
  reference, and a new check asserts the duplicate refusal by id on both tiers. The cash-book
  probe asserted that an identical rebuild succeeds and keeps its figures; it now asserts the
  refusal names the period id and carries NO buy link, which is the part that matters: a
  refused duplicate must never read as a cap.

insight: a cap probe and a duplicate guard measure the same call. Both cash-book and deposits
filled their free tier by repeating one identical request, which is the cheapest way to write
a cap test and the exact input the new guard rejects, so the guard turned two passing cap
probes red without either cap changing. A probe that fills a cap must vary the record it
writes, or it stops testing the cap the moment the server learns to recognise a duplicate.
