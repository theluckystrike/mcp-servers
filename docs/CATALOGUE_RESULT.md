# mcp-catalogue: build

Date 2026-09-06. Scope: `servers/catalogue` only, plus `scripts/gen-spec.mjs` (one
`CURATED` entry and one name in `SERVERS`), `servers/invoice/src/index.ts` (one name added
to `PROFILE_READERS`) and this file. Nothing in `packages/mcp-license`, `remote/`, the
pages, the bundles or the hosting layer is in this commit; the orchestrator wires those.
Pulled `--rebase --autostash` first. Zero paid API calls, zero network:
`grep -rEn "fetch\(|https?://|node:http|node:net|node:dns" servers/catalogue/src/` returns
only the checkout host in the licensing copy, and the contract suite asserts that.

`servers/invoice/src/index.ts` had to change: this server imports `readSharedProfile` (for
the default currency, the default VAT rate and the business name at the top of the price
list), and `servers/invoice/test/profile-readers.test.mjs` derives the reader list by
grepping `servers/*/src` for that call, so `PROFILE_READERS` fails the moment a new reader
lands without being named. One entry, `"catalogue"`, was added. That suite passes 1/1.

## One thing outside the scope, for the orchestrator

Adding a 29th server that sells Pro makes `packages/mcp-license/test/bundle-link.test.mjs`
fail, exactly as the work-order and petty-cash builds reported:

    SERVER_COUNT is 28 but 29 servers build a licence gate (... catalogue ... zip).
    Update SERVER_COUNT in packages/mcp-license/src/index.ts and
    remote/src/shims/license.ts together, or every cap message names a stale count.

Both files still read 28 and neither was edited. Bump both to 29 together.

The server is `@theluckystrike/mcp-catalogue` 0.18.0, 10 tools plus the two license tools,
one resource and one prompt. It writes only its own directory. It reads exactly one file it
does not own, read-only and best-effort: the shared business profile. It holds no copy of
the money arithmetic (`computeTotals`, `currencyDecimals`, `formatMoney`, `roundHalfUp` are
imported from `@theluckystrike/mcp-invoice/lib`), no copy of the A4 page (`renderDocPdf`
from `@theluckystrike/mcp-billing-docs/lib`), no copy of the corrupt-store quarantine
(`readJsonFile` from `@theluckystrike/mcp-timezone/lib`), no copy of the timezone-aware
"today" (`@theluckystrike/mcp-quotes/lib`) and no copy of the licensing or locking code. It
exports its own `./lib`: the record types, the valid-from ladder, the two payload builders
and the store accessors.

## Design decisions worth stating

**The two servers this catalogue feeds take the same price in different scales, and the gap
is exactly 100x.** This is the decision the whole server rests on. `invoice_create`'s item
carries `unit_price` in MAJOR units ("Price per unit in major units, e.g. 90 for 90 EUR",
`servers/invoice/src/index.ts`); `quote_create`'s item carries `unit_price_minor` in MINOR
units ("9000 = 90.00 EUR, 90 = JPY 90. Never a decimal", `servers/quotes/src/index.ts`).
Both fields are plain numbers, both are called the unit price, and neither tool can tell
that the number it was handed was scaled for the other one: 45000 passed as `unit_price` is
a perfectly valid invoice line for EUR 45,000.00, and it reconciles against itself. The
unit suite measures the gap on the worked resolution: the correct payload nets 261,363
minor, and the quote payload's field fed into the invoice engine nets 26,136,300, asserted
as exactly 100x. In a 3-decimal currency such as KWD it is 1000x. So the store holds MINOR
units, which is the only lossless form, and `lines_resolve` builds BOTH payloads itself in
one call with the scale printed against each. A catalogue that returned "the price" and let
the caller choose the field would be wrong half the time, and wrong by two orders of
magnitude when it was.

**The price on a date is the latest `valid_from` at or before it, and the answer says which
row.** A price list is not a number, it is a history of numbers. `sku_get` returns the row
it picked, how many rows it considered, and any later row already booked, so a customer
query about a figure on an old invoice lands on one line of one file rather than on an
argument. The unit suite runs a three-row ladder (39000 from 2025-01-01, 45000 from
2026-01-01, 49500 from 2026-07-01) against three dates and asserts three different rows.

**A date before every row has no price, and that is a refusal.** Filling it with the
earliest row is the tempting default and it reprices history: a job done in December 2024
would be billed at the January 2025 price and reconcile perfectly against a price list that
did not exist yet. The refusal names the earliest row and the date it starts.

**One row per currency, tier and valid-from date; setting that key again REPLACES the row.**
Two rows on one key make "the price that day" a coin toss, decided by array order. The
response says what was replaced and what it became. A call that would change nothing at all
is refused by name instead, so `updated` is not rewritten and no repricing is reported that
did not happen.

**No current price is stored.** A SKU record holds its code, its name, its unit, its VAT
rate and its rows. Everything else is derived on the call. `contract.test.mjs` greps the raw
store file for nine derived key names and asserts the record's keys are the facts only. A
stored current price is a second copy of what the rows already decide, and the copy is the
one still being quoted a month after the rise.

**A price is never invented.** No fallback, no profile default rate, no nearest match. An
unknown SKU or role is refused by name, and so is a code with no price in the currency and
tier asked for. The invented number would be printed on a document a customer pays from.
The same rule kills currency conversion: one resolution carries one currency, a line in
another is refused, and `catalogue_report` counts the SKUs that carry no price in the
profile's default currency because those are the rows that stop a resolution dead.

**A byte-identical duplicate is refused BEFORE the free cap is consulted.** Two codes with
one name, one unit and one price are one product filed twice far more often than they are
two products. The refusal names the code already stored, and the adversarial suite asserts
that refusal text does not contain "free tier": a duplicate is not an occasion to sell an
upgrade, and it burns neither a slot nor a place in the list. `duplicate_ok` is the way
through for a genuine second product.

**`sku_delete` is free on every tier, and the register is what makes that safe.** Every
resolution updates one row per SKU and role it priced, so the register is bounded by the
size of the catalogue rather than by traffic. A code that has priced a line, or that a rate
card points at, is refused by name with the times it was used and the last resolution id: a
code printed on a document somebody sent is a fact about that document. Everything else
deletes without a key, because a way back under the cap that only a Pro key can reach is
not a way back (docs/RECOVERABLE_SLOTS_RESULT.md).

**This server creates no invoice and no quote.** `lines_resolve` returns arguments and says
`posted: false`. The caller runs `invoice_create` in the invoice server, or `quote_create`
in the quotes server.

**The price list PDF prints every line at a quantity of one and says so.** A price list has
no total of its own. `renderDocPdf` takes a document with totals, so the page carries the
sum of one of each and the footer states in words that this is a price list and not a
quotation, rather than printing a figure that looks like a document total and means
nothing.

**The name on the price list comes from the shared profile, not from the invoice server's
`getBusiness()`.** MEASURED, and it is why the first contract run failed: `getBusiness()`
and `hasBusiness()` call the invoice store's `dataDir()`, which mkdirs as a side effect of a
READ, so simply printing a price list brought `mcp-servers/invoice/` into existence in a
sandbox where this server had written nothing. The issuer block is now built from
`readSharedProfile()` and the invoice lib is imported for arithmetic only. The contract
suite asserts the only sibling path this process touches is the shared profile file.

## The worked resolution

    EUR, priced as of 2026-03-15, VAT 23% from the shared profile

    WEB-AUDIT          3 x 45000   135,000   (the 2026-01-01 row, not 39000 and not 49500)
    HOST-MO           12 x  3999    47,988
    senior developer 7.5 h x 8500    63,750
    junior developer 3.25 h x 4500   14,625
                                    -------
    net                             261,363
    VAT 23% per line 31050 + 11037 + 14663 + 3364 = 60,114
    gross                           321,477
    rounding_drift_minor                  0

`computeTotals` re-run in the test process over `lines_resolve`'s OWN
`invoice_create.arguments.items` returns the same four line grosses and the same three
totals. What that catches is not an arithmetic slip; it is a payload whose ITEMS do not
carry what the catalogue thought they carried, which is the failure that survives every
internal check.

## Free vs Pro

Free is 25 SKUs, the one `standard` price list, and every text answer including
`lines_resolve` and `price_list_text`. A price list nobody can read is not a price list, and
withholding `lines_resolve` would withhold the one thing the sibling servers came here for.
Pro is an unlimited catalogue, price tiers beyond `standard`, the PDF and the report. The
tier switch is the honest one for this server: a second column of prices for one product is
what a business with trade customers actually pays for.

## Test summary

    npm run build --workspaces --if-present                 tsc clean, no output
    npm test --workspace @theluckystrike/mcp-catalogue      # tests 42 / # pass 42 / # fail 0
      unit 12, adversarial 13, concurrency 4, contract 13
    node scripts/gen-spec.mjs catalogue                     tools=12 resources=1 prompts=1
    node --test servers/invoice/test/profile-readers.test.mjs   1 / 1

Adversarial coverage: unknown sku, a date before any row, two rows on one valid_from, a
negative price, a fractional price, a bad code, an empty name, a bad date, a negative and a
zero quantity, a line with both sku and role, a line with neither, a 26th SKU on the free
tier, delete with a rate-card reference, delete with a resolved-line reference, a Pro tier
on the free tier, the two Pro tools, a corrupt store, a mixed-currency resolution, an
unknown role, and a run with no shared profile at all. Concurrency: forty SKUs from two
processes, the race on the 26th free SKU, thirty price rows on one SKU from two processes,
and twenty resolutions raced for distinct ids and one register row per priced ref.

Not wired, not hosted, not released: no `remote/` entry, no bundle, no page, no tag.
