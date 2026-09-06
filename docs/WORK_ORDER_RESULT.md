# mcp-work-order: build

Date 2026-09-06. Scope: `servers/work-order` only, plus `scripts/gen-spec.mjs` (one
`CURATED` entry and one name in `SERVERS`), `servers/invoice/src/index.ts` (one name added
to `PROFILE_READERS`) and this file. Nothing in `packages/mcp-license`, `remote/`, the
pages, the bundles or the hosting layer is in this commit; the orchestrator wires those.
Pulled `--rebase --autostash` first. Zero paid API calls, zero network:
`grep -rEn "fetch\(|https?://|node:http|node:net|node:dns" servers/work-order/src/` returns
only the checkout host in the licensing copy, and the contract suite asserts that.

`servers/invoice/src/index.ts` had to change, unlike the petty-cash build: this server does
import `readSharedProfile` (for the currency, the VAT rate and the business name on the
completion report), and `servers/invoice/test/profile-readers.test.mjs` derives the reader
list by grepping `servers/*/src` for that call, so `PROFILE_READERS` fails the moment a new
reader lands without being named. One entry, `"work-order"`, was added. That suite passes
1/1.

One thing outside the scope has to be landed by the orchestrator, exactly as the petty-cash
build reported. Adding a 28th server that sells Pro makes
`packages/mcp-license/test/bundle-link.test.mjs` fail:

    SERVER_COUNT is 27 but 28 servers build a licence gate (... work-order ... zip).
    Update SERVER_COUNT in packages/mcp-license/src/index.ts and
    remote/src/shims/license.ts together, or every cap message names a stale count.

Both files still read 27 and neither was edited. Bump both to 28 together.

The server is `@theluckystrike/mcp-work-order` 0.17.0, 10 tools plus the two license tools,
one resource and one prompt. It writes only its own directory. It reads two files it does
not own, both read-only and both best-effort: the shared business profile, and the invoice
server's `clients.json` through `findClient`, so a job carries the same client record the
invoice will be raised against rather than a second spelling of the name. It holds no copy
of the money arithmetic (`computeTotals`, `currencyDecimals`, `formatMoney`, `roundHalfUp`
are imported from `@theluckystrike/mcp-invoice/lib`), no copy of the A4 page (`renderDocPdf`
from `@theluckystrike/mcp-billing-docs/lib`), no copy of the corrupt-store quarantine
(`readJsonFile` from `@theluckystrike/mcp-timezone/lib`), no copy of the timezone-aware
"today" (`@theluckystrike/mcp-quotes/lib`) and no copy of the licensing or locking code. It
exports its own `./lib`: the record types, the status machine and the money basis.

## Design decisions worth stating

**The markup goes on the UNIT cost, never on the line total.** This is the decision the whole
server rests on, and it is worth exactly one minor unit at a time. The invoice server rounds
a unit price into minor units FIRST and computes the line from that stored value (D-R24,
`servers/invoice/src/money.ts`), so the marked-up unit is the only basis an invoice can
reproduce. Seven parts at 1299 with 15 percent on top is `roundHalfUp(1299 * 1.15)` = 1494 a
unit and 10,458 on the line. Marking up the line total instead is `roundHalfUp(9093 * 1.15)`
= 10,457. Both are defensible arithmetic, both reconcile against their own workings, and only
one of them is what the customer will be billed. The unit suite asserts the gap explicitly
(`marked.value_minor - lineTotalBasis === 1`), so a change of basis fails the build rather
than quietly re-pricing every job on the board.

**The payload's totals are the invoice server's own, computed by the invoice server's own
function.** `work_order_invoice_payload` builds the `invoice_create` items, then runs
`computeTotals` over those items to produce the totals it reports. There is no second
implementation to agree or disagree. The unit test then takes the payload as returned and
re-runs `computeTotals` on `p.invoice_create.arguments.items` from the test process, and
asserts net 59,833, VAT 13,762 and total 73,595 line by line. What that catches is not an
arithmetic slip; it is a payload whose ITEMS do not carry what the work order thought they
carried, which is the failure that survives every internal check.

**A parts line's `unit_price` is the marked-up unit in major units, and nothing else.** The
two obvious alternatives both break the identity above: the bare cost with an invoice-level
discount rounds per line against a different base, and the line total as a quantity of one
loses the quantity the customer is being charged for. `rounding_drift_minor` on the recomputed
totals is asserted to be zero, which is the machine-checkable form of "this payload prices the
same under either rounding basis".

**No total is stored.** An order record holds its client, its lines and its status history.
The value, the hours, the materials and the VAT are derived on every call. A stored total is
a second copy of what the lines already decide, and the copy is the one that gets believed
after somebody edits a line. `contract.test.mjs` greps the raw store file for nine derived
key names and asserts the record's keys are the facts only.

**The status machine moves one step forward at a time.** draft, scheduled, in_progress, done,
invoiced. A skipped step is refused naming the step that IS next, because every step carries
its own date: a job that went from scheduled straight to invoiced was never marked done, so no
completion report was ever produced and nothing records the day the work finished. A backwards
step is refused because a job that has to go back is a new work order, and the history of the
first one has to stay true. A change dated before the requested date, or before the step
already recorded, is refused as well, so the history always reads as a timeline.

**This server creates no invoice and marks nothing.** `work_order_invoice_payload` returns
arguments and says `posted: false, marked_invoiced: false`. The caller runs `invoice_create`
in the invoice server and then sets the status to invoiced here. An order already marked
invoiced refuses a second payload by name and refuses further lines, so neither route bills a
customer twice through this server.

**An unknown client name with no address is refused.** A bare name that matches no invoice
client record is a misspelling far more often than a new customer, and an invoice raised from
the job would carry a BILL TO block with nothing in it. Either `client_add` in the invoice
server first, or pass `client_address` here, and the job records the client inline and says
in a note that the invoice server has no record of it.

**A labour rate is never improvised.** The brief asked for the rate to fall back on the shared
profile's default rate "when present". It is not present: `PROFILE_FIELDS` in
`packages/mcp-license/src/profile.ts` carries a default currency, a default tax rate and
payment terms, and `readSharedProfile` drops every key outside that list, so no default hourly
rate can reach this server today. The lookup is implemented against `default_rate_minor` and
will start working the day that package adds the field; until then `rate_minor` is refused by
name, and the refusal says which field would have filled it. The alternative is worse than a
refusal: a rate this server invented would be printed on a completion report the customer
signs and on an invoice nobody typed it into.

**The free cap counts OPEN work orders, and both ways back are free.** Five open jobs is a
one-van trade. Closing a job frees its slot, and `work_order_delete` on a draft with no lines
is free on every tier (docs/RECOVERABLE_SLOTS_RESULT.md: a way back that only a Pro key can
reach is not a way back). A byte-identical work order is refused BEFORE the cap is consulted,
so the refusal names the id already stored rather than selling an upgrade, and burns neither a
slot nor a WO number. The adversarial suite asserts the duplicate refusal text does not
contain "free tier", and that the next real order is WO-2026-0002 rather than 0003.

**Hours are counted on the LINE date, not on the order date.** A February call worked in March
logged its hours in March. Counting by order date moves a whole visit into the month the phone
rang. The unit suite asserts a job requested 2026-03-06 whose only labour line is dated
2026-04-02 contributes zero to March and one hour to April.

## The worked job

    Client Harbour Cafe (from the invoice client records), site 12 Quay Street, Gdansk
    Requested 2026-03-02, priority high, EUR, VAT 23% from the shared profile

    labour  3.5 h   x 8500                     =  29,750
    labour  1.25 h  x 8500                     =  10,625
    parts   7       x 1299 + 15%  (unit 1494)  =  10,458
    parts   2       x 4500 +  0%               =   9,000
                                                  ------
    hours                                          4.75
    labour                                        40,375
    materials                                     19,458   (cost 18,093, markup earned 1,365)
    net                                           59,833
    VAT 23%  6,843 + 2,444 + 2,405 + 2,070      = 13,762
    gross                                         73,595

Every figure above is asserted in `test/unit.test.mjs`, and the last three are asserted a
second time by re-running `computeTotals` over the payload the server returned.

## Tests

`servers/work-order/test/`, 43 tests over four suites.

| suite | tests | what it holds |
| --- | --- | --- |
| `unit.test.mjs` | 11 | The client record, the inline client, the worked job to the minor unit, the markup basis and its one-unit gap, the payload against `computeTotals`, the status machine, the text report, the PDF, the board report, the free delete, and the list filters |
| `adversarial.test.mjs` | 15 | Negative and zero quantities and hours, parts fields on a labour line, a labour line with no rate, a skipped step, a backwards step, a delete with lines and a delete past draft, the duplicate, an unknown client, a corrupt store, both free-cap paths back, the three Pro gates, an invoiced order, an empty payload, bad dates, an ambiguous reference, and no profile at all |
| `concurrency.test.mjs` | 4 | Forty orders from two processes, the race on the sixth free open order, thirty lines on one order from two processes, and a status change racing a line |
| `contract.test.mjs` | 13 | Version identity across four manifests, the remotes rule, stdout, tool hygiene, the one file-path tool, the tier switch, the resource and prompt, the directories written and the sibling read, no stored total, the imported money engine, no network in src, the required files, and integer minor units everywhere |

Selected results:

| # | Case | Result | Evidence |
| --- | --- | --- | --- |
| 1 | The worked job | PASS | 4.75 h, labour 40,375, materials 19,458, net 59,833, VAT 13,762, gross 73,595 |
| 2 | The payload against `computeTotals` | PASS | Re-running the invoice engine on the payload's own items gives 59,833 / 13,762 / 73,595 and line grosses 29,750 / 10,625 / 10,458 / 9,000, `rounding_drift_minor` 0 |
| 3 | The markup basis | PASS | billed unit 1494, line 10,458; the line-total basis is 10,457 and the test asserts the difference is exactly 1 |
| 4 | A skipped status step | PASS | refused "is draft, and the next status is scheduled, not done"; status and history unchanged on disk |
| 5 | A backwards step, and a step dated before the last one | PASS | both refused by name; a step dated before the requested date is refused with the requested date |
| 6 | A delete with lines | PASS | refused naming 1 line worth EUR 297.50; a scheduled order is refused as not draft; the store still holds both |
| 7 | A byte-identical order | PASS | refused naming WO-2026-0001, no "free tier" in the text, the next real order is 0002, `duplicate_ok` admits it |
| 8 | An unknown client | PASS | refused naming "Harbor Cafe" and both ways through; nothing written; with an address it is recorded inline |
| 9 | A corrupt store | PASS | five tools refuse, the bytes are quarantined verbatim beside a `.corrupt` marker |
| 10 | Two processes on the free cap | PASS | 12 calls, exactly 5 stored, 7 refused, the check and the write one critical section |
| 11 | Thirty lines from two processes | PASS | all 30 kept, 30 distinct line ids, no lost update |
| 12 | stdout | PASS | every line across initialize, tools/list, a success and an error parses as JSON-RPC 2.0 |
| 13 | Manifest remotes rule | PASS | `server.mcpb.json` remotes deep-equal `remotes.json` (`/mcp/work-order`) with `fileSha256` "TBD"; `server.json`, `server.variant.json` and `server.service-report.json` carry none, and the three registry names differ |
| 14 | The invoiced order | PASS | a further line and a second payload both refused naming 2026-03-05 |
| 15 | No shared profile | PASS | VAT 0 with `vat_rate_source` "none" and a note naming `default_tax_rate`; an explicit `tax_rate` overrides and is sourced to the call |

## Final test summary

    npm run build (repo-wide)                  tsc clean, no output
    npm test -w servers/work-order             # tests 43 / # pass 43 / # fail 0
    node --test test/*.test.mjs (repo-wide)    # tests 89 / # pass 89 / # fail 0
    npm test -w servers/invoice                profile-readers 1/1 pass with work-order added
    npm test -w packages/mcp-license           # tests 34 / # pass 33 / # fail 1 (SERVER_COUNT 27 vs 28, above)
    node scripts/sync-versions.mjs --check     0 file(s) written
    node scripts/gen-spec.mjs work-order       tools=12 resources=1 prompts=1 failure_modes=14, twice, no diff

## RESULT.md block

    status: DONE
    evidence:
    - npm run build (repo-wide): tsc clean
    - npm test -w servers/work-order: # tests 43 / # pass 43 / # fail 0
    - node --test test/*.test.mjs: # tests 89 / # pass 89 / # fail 0
    - node scripts/sync-versions.mjs --check: 0 file(s) written
    - Worked job: 4.75 h, net 59,833, VAT 13,762, gross 73,595
    - Payload totals recomputed with servers/invoice computeTotals: identical, drift 0
    - Markup: 7 x 1299 + 15% is 1494 a unit and 10,458; the line-total basis is 10,457
    artifacts:
    - /Users/mike/mcp-servers/servers/work-order
    - /Users/mike/mcp-servers/docs/WORK_ORDER_RESULT.md
    cost: 58 wall minutes
    failures:
    - A status change dated before the requested date was refused with the requested-date
      message, so the history-order case was never exercised. Both are now asserted separately
    - The no-stored-total contract test grepped for the substring "vat" and matched the client
      record's vat_id. It now asserts on exact derived key names
    insight:
    - The markup goes on the unit cost, not on the line total

## The measured insight

**A markup is one minor unit away from itself, and the invoice decides which one.**

Seven parts at 1299 minor units with 15 percent on top is 10,458 if the markup goes on the
unit and 10,457 if it goes on the line total. Nothing in the work order can tell you which is
right, because both are arithmetically correct and both reconcile against their own workings.
The answer comes from outside: `servers/invoice/src/money.ts` rounds a unit price into minor
units first and computes the line from that stored value, so 1494 a unit times seven is the
only figure an invoice can print. A work order built on the other basis quotes a number its
own invoice contradicts.

What makes it worth a test rather than a comment is what the wrong version looks like. It is
one cent. It appears only on lines whose marked-up unit does not land on a whole cent, which
is most of them once a markup is not a round divisor. It never nets out across lines, because
it is a rounding direction and not a random error. It is invisible to a spreadsheet check,
because the spreadsheet reproduces whichever basis it was built with. And it reaches the
customer twice: once on a completion report they signed and once on an invoice that disagrees
with it. `unit.test.mjs` asserts the gap is exactly 1 on the worked line, so the day someone
"simplifies" the markup to a line-total multiply, the build says so instead of the customer.

Built by theluckystrike. https://github.com/theluckystrike
