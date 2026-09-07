# Checkout round 1: every product reaches a real Stripe checkout (loop 29, 2026-09-07)

Agent A, billing owner. Deployed worker version `48112829-284a-43d6-aa8d-08464d8e9c33`.

## Result

| | before | after |
|---|---|---|
| /health products routing to checkout.stripe.com | 28 of 31 | **31 of 31** |
| 503 `x-mcp-buy: price-pending-human` | 3 | 0 |
| 404 (office-suite) | 1 | 0 |
| Human step still required in Stripe | yes | **no** |

The loop brief recorded 27 of 31 before. The measured baseline was 28: 27 single servers plus
the bundle. The three 503s were work-order, catalogue and change-order; office-suite is a
thirty-second buyable id that is not in /health at all, which is why the two counts differ.

## What was wrong

Three products carried the literal string `PENDING_HUMAN` where a Stripe Price id belongs, and
`/buy/<id>` short-circuited to a 503 before touching Stripe. Creating a Price needs the
`product_write` permission and no available key has it, so the shop was waiting on a person to
open a dashboard. `office-suite`, the aggregator whose homepage URL is
`https://mcp.zovo.one/buy/office-suite` on every directory submission in
docs/HUMAN_GATED_PACK.md, had no PRODUCTS entry and answered 404.

## What fixed it

A Checkout Session does not need a Price id. It accepts the price inline:

```
line_items[0][price_data][currency]=usd
line_items[0][price_data][unit_amount]=1900
line_items[0][price_data][product_data][name]=MCP Work Order Pro
line_items[0][price_data][product_data][description]=...
```

Stripe creates the Product and the Price implicitly as the Session is created. That path needs
only `checkout_session_write`, which the deployed worker's key demonstrably has. This could not
be tested from the terminal - the key in the operator's keychain has neither permission - so it
was tested by deploying and probing, and it works: see the table below, where work-order,
catalogue and change-order each return a `cs_live_` Session carrying their own name at $19.00
with `livemode` true.

`unit_amount` is derived from the same `usd` field the storefront prints, so the page price and
the charged price cannot drift apart.

### office-suite sells the bundle, and that is not a substitution

office-suite spawns time-tracker, price-tracker, spreadsheet and invoice as child processes and
forwards one key to all four; its `license_activate` is all-or-nothing
(servers/office-suite/README.md). `verifyLicenseKey` in billing/src/license.js accepts a key for
a child only when the signed payload is that child's own id or the wildcard `*`. So a separate
$19 "office-suite" product would mint a key that every one of its four children rejects: the
money taken and nothing unlocked. The only key that turns office-suite Pro on is the bundle key.
The bundle is also $39 against the $76 those four servers cost singly, so it is the buyer's
price as well as the only fulfillable one.

`/buy/office-suite` therefore resolves to the bundle in one hop. It is kept in `PRODUCT_ALIASES`
rather than in `PRODUCTS`, because SERVER_COUNT, BUNDLE_SAVING_USD and every sentence derived
from them count sellable servers and an alias is not a new server. The Stripe page says why the
name changed, in `custom_text[submit]`: "You clicked office-suite. office-suite runs its sibling
servers as child processes and forwards one key to all of them, so the only key that turns it Pro
is this bundle key." The Session also carries `metadata[asked]=office-suite`, so the two demand
signals stay separable in Stripe.

### Any server added later gets a checkout with no human action

A PRODUCTS row with `usd`, `name` and `desc` and no `price` now produces a complete inline line
item. billing/test/checkout-r1.test.mjs adds a synthetic id, `synthetic-server-r1`, that exists
nowhere in Stripe, drives it through the real request handler with Stripe stubbed, and asserts
the route 303s to a checkout with the right name and amount, and that the sale it would make
passes `fulfillmentAllowed`. The synthetic id is deleted again in the test's `finally`.

## Buyer-loss defects found and fixed on the way

1. **`fulfillmentAllowed` would have taken the money and withheld the key.** It required
   `item.price.id === PRODUCTS[id].price`. An inline-priced sale has an ad-hoc Price id nobody
   can know in advance, so every work-order, catalogue and change-order purchase would have been
   refused after payment with "price undefined is not the price for work-order". Products with a
   configured Price id keep the strict identity check; inline ones are bound by
   `metadata.product`, which the worker writes at Session creation and a buyer cannot touch, plus
   `type === "one_time"`, the unit amount, the currency and the total.
2. **A browser that sends no User-Agent could never buy.** The guard treated an empty UA as a
   script and redirected to `/s/<id>`, whose Buy link leads straight back to `/buy/` - an
   unbreakable loop for anyone behind a UA-stripping extension, proxy or content blocker. An
   empty UA is now scripted only when the request does not also look like a browser navigation
   (`accept: text/html` or `sec-fetch-mode: navigate`). Crawlers with `accept: */*` are still
   turned away and still create no Stripe object.
3. **The 404 was a dead end.** It said "Unknown product" and linked back to a list. It now names
   the reflected id, states that nothing was charged, and offers the bundle. The id is escaped:
   `/buy/<img src=x onerror=alert(1)>` renders `&lt;img`, not `<img`.
4. **`firstSentences` returned more than its budget.** It appended the ellipsis after slicing to
   `max`, so a 300-character cap produced 302 characters. Found by the new test against the real
   catalogue, not in review.

`?src=` tracking was audited and is correct: the click is recorded before any Stripe call and
before the redirect, probes and scripted UAs are excluded, and an alias records the click under
the id the buyer actually clicked rather than the product it resolves to.

## Also shipped in the same deploy (orchestrator request)

- **IndexNow key file.** `GET /db6dbf5cfdbc08d1cc9b5365d398145b.txt` returns exactly the 32-byte
  key with `content-type: text/plain; charset=utf-8` and no markup. Key files are now a set, so
  adding another engine is one line, and a 32-hex path that is not in the set still 404s.
- **/llms.txt** already listed all 30 single servers with page URL, tagline and install command,
  plus the bundle. office-suite was the only product missing; it now has its own line. A test
  asserts the catalogue and llms.txt cannot drift apart.
- **robots.txt** was left exactly as it was and is confirmed clean: `User-agent: *`, `Allow: /`,
  no crawler named anywhere, and only the private per-buyer paths (`/buy/`, `/success`,
  `/recover`, `/verify`, `/bound`) disallowed.

## Conversion defects fixed in the same deploy (docs/CONVERSION_R1.md)

The orchestrator's conversion audit found seven live defects, six of them in this agent's file.
All six are fixed and deployed; the seventh is not this agent's file and is reported below.

1. **The home page sent everyone to an obsolete release.** The `.mcpb` link pointed at
   `releases/tag/v0.1.1`, a release carrying 4 bundles, while the current release carries 31 -
   and the `.mcpb` is the only install path that works today. All three occurrences (home,
   /bundle, /s/) now use `${REPO}/releases/latest`, which cannot go stale again. A test fails if
   a pinned tag comes back.
2. **The two most commercial pages stated something untrue.** The home page and /bundle printed
   `npx -y @theluckystrike/mcp-<server>` with no disclosure, while every /s/ and /setup page did
   disclose that the npm publish is pending. There is now one `NPM_PENDING_NOTE` constant used by
   all of them, so a page cannot be corrected without correcting the others - and the day the
   packages publish, one edit removes the caveat everywhere. Both pages also now say plainly that
   the first two paths need no npm.
3. **/success handed a paying customer the broken command first.** `installSnippet` led with
   `npx`. It now leads with the one-click `.mcpb` and the hosted endpoint, both of which work
   today, and keeps the npx form third with the same disclosure. A test asserts the ordering, for
   both a single server and the bundle.
4. **Stale numbers on the home page, including in its JSON-LD.** It said "Seventeen" servers in
   four places and claimed "399 of 399 automated checks" and "25 unit tests". The server count is
   now derived from `PRODUCTS` (Thirty), and the validation claim reads 951 of 951 across 32
   servers at a 504 ms median, with 104 billing unit tests. data/validation.json is 9.2 MB and
   cannot be bundled into a Worker, so those figures are restated in one `VALIDATION` constant
   and a test recomputes every field from that file and fails if they disagree. The unit-test
   count is likewise counted off disk. Neither number can drift silently again.
5. **office-suite** is covered above: 404 to a working bundle checkout. /bundle stays live, as
   the repointed registry manifests require.
6. **Dead-route clicks were structurally uncountable.** The 503 and 404 branches returned before
   `recordClick`, so the audit's 33 dead links could only be found from outside. The 404 branch
   now records the click first, under the same validated `src` a live route uses - which names
   the page the link was on. An unvalidated `src` falls back to the fixed tag
   `buy.unknown-product`, so a stranger's URL can never become a KV key, and a scripted UA is
   still not counted. Verified live: `/stats/clicks` now shows `probe.deadroute.loop29` with a
   total of 2, from two probes of a product that does not exist. Before this deploy that was 0
   and unobservable.
7. **Not done, and not this agent's file.** `packages/mcp-license/src/index.ts` line 154 builds
   `const upgradeUrl = \`${CHECKOUT_BASE}/buy/${product}\`` with no `src`, so every genuine
   in-product upgrade click is filed as `<id>.unknown`. `/stats/clicks` currently carries 28
   distinct `.unknown` sources, which is the fingerprint. The fix is one line:
   `` `${CHECKOUT_BASE}/buy/${product}?src=product.${product}.status` ``. Handing it back rather
   than editing a file owned elsewhere.

### A note on the click counter

This agent's probes carried `x-mcp-probe: 1` throughout, which skips `recordClick` entirely, so
they did not inflate the counter. One deliberate exception: a single request without the probe
header, made to prove that a real buyer receives none of the `x-mcp-probe-*` headers. That is one
click under `store.home.table.work-order`, plus two under `probe.deadroute.loop29`. The counter
reads 299 total as of this writing and should not be read as demand.

## Live probe table, after

Probed with a Chrome desktop User-Agent and `x-mcp-probe: 1`. The browser UA is required: without
one the scripted-UA guard answers 303 to `/s/<id>` with `x-mcp-buy: scripted-ua-no-session`, which
is the guard working and not an outage. The probe header keeps these requests out of the
conversion counters and makes the worker echo back what Stripe stored, so the name and the amount
below are read from Stripe's own reply rather than from the request the worker sent.

| id | http | Location host | x-mcp-buy | Stripe item name | amount | live |
|---|---|---|---|---|---|---|
| time-tracker | 303 | checkout.stripe.com | - | MCP Time Tracker Pro | $19.00 | yes |
| price-tracker | 303 | checkout.stripe.com | - | MCP Price Tracker Pro | $19.00 | yes |
| spreadsheet | 303 | checkout.stripe.com | - | MCP Spreadsheet Pro | $19.00 | yes |
| invoice | 303 | checkout.stripe.com | - | MCP Invoice Pro | $19.00 | yes |
| expense-tracker | 303 | checkout.stripe.com | - | MCP Expense Tracker Pro | $19.00 | yes |
| currency | 303 | checkout.stripe.com | - | MCP Currency Converter Pro | $19.00 | yes |
| docx | 303 | checkout.stripe.com | - | MCP Docx Pro | $19.00 | yes |
| timezone | 303 | checkout.stripe.com | - | MCP Timezone Planner Pro | $19.00 | yes |
| resume | 303 | checkout.stripe.com | - | MCP Resume and Cover Letter Pro | $19.00 | yes |
| recurring | 303 | checkout.stripe.com | - | MCP Recurring Invoices Pro | $19.00 | yes |
| clauses | 303 | checkout.stripe.com | - | MCP Clause Library Pro | $19.00 | yes |
| calendar | 303 | checkout.stripe.com | - | MCP Calendar Pro | $19.00 | yes |
| pdf | 303 | checkout.stripe.com | - | MCP PDF Tools Pro | $19.00 | yes |
| image | 303 | checkout.stripe.com | - | MCP Image Tools Pro | $19.00 | yes |
| bank-statement | 303 | checkout.stripe.com | - | MCP Bank Statement Pro | $19.00 | yes |
| kanban | 303 | checkout.stripe.com | - | MCP Kanban Pro | $19.00 | yes |
| quotes | 303 | checkout.stripe.com | - | MCP Quotes Pro | $19.00 | yes |
| barcode | 303 | checkout.stripe.com | - | MCP Barcode Pro | $19.00 | yes |
| zip | 303 | checkout.stripe.com | - | MCP Zip Pro | $19.00 | yes |
| billing-docs | 303 | checkout.stripe.com | - | MCP Billing Docs Pro | $19.00 | yes |
| deposits | 303 | checkout.stripe.com | - | MCP Deposits Pro | $19.00 | yes |
| per-diem | 303 | checkout.stripe.com | - | MCP Per Diem Pro | $19.00 | yes |
| asset-register | 303 | checkout.stripe.com | - | MCP Asset Register Pro | $19.00 | yes |
| statement-of-account | 303 | checkout.stripe.com | - | MCP Statement of Account Pro | $19.00 | yes |
| cash-book | 303 | checkout.stripe.com | - | MCP Cash Book Pro | $19.00 | yes |
| amortization | 303 | checkout.stripe.com | - | MCP Amortization Pro | $19.00 | yes |
| petty-cash | 303 | checkout.stripe.com | - | MCP Petty Cash Pro | $19.00 | yes |
| work-order | 303 | checkout.stripe.com | - | MCP Work Order Pro | $19.00 | yes |
| catalogue | 303 | checkout.stripe.com | - | MCP Catalogue Pro | $19.00 | yes |
| change-order | 303 | checkout.stripe.com | - | MCP Change Order Pro | $19.00 | yes |
| bundle | 303 | checkout.stripe.com | - | MCP Servers Bundle (all servers, lifetime) | $39.00 | yes |
| office-suite | 303 | checkout.stripe.com | - | MCP Servers Bundle (all servers, lifetime) | $39.00 | yes |

An empty `x-mcp-buy` means no error tag. `office-suite` is the alias; every other row is a
/health product.

### The four rows that changed

| id | before http | before x-mcp-buy | after http | after Location host |
|---|---|---|---|---|
| work-order | 503 | price-pending-human | 303 | checkout.stripe.com |
| catalogue | 503 | price-pending-human | 303 | checkout.stripe.com |
| change-order | 503 | price-pending-human | 303 | checkout.stripe.com |
| office-suite | 404 | - | 303 | checkout.stripe.com |

## Commands, as evidence

```sh
# baseline, before the deploy
curl -s https://mcp.zovo.one/health | python3 -c 'import json,sys;print(" ".join(json.load(sys.stdin)["products"]))'
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
curl -s -D - -o /dev/null -A "$UA" -H "x-mcp-probe: 1" "https://mcp.zovo.one/buy/work-order?src=probe.loop29"
#   -> HTTP/2 503, x-mcp-buy: price-pending-human
curl -s -o /dev/null -w "%{http_code}" -A "$UA" https://mcp.zovo.one/buy/office-suite     # -> 404

# work in a copy, never in the shared tree while six other agents are editing it
cp -R /Users/mike/mcp-servers/billing /private/tmp/loop29/billing
cd /private/tmp/loop29/billing && npm test        # 80 of 81, one pre-existing changelog failure
cd /private/tmp/loop29/billing && wrangler deploy  # version 48112829-284a-43d6-aa8d-08464d8e9c33

# after
curl -s -D - -o /dev/null -A "$UA" -H "x-mcp-probe: 1" "https://mcp.zovo.one/buy/work-order?src=probe.loop29"
#   -> HTTP/2 303
#      location: https://checkout.stripe.com/c/pay/cs_live_a19BPIfquxQj8P1ur8xR0gzjjQXVtYN0mpc20q6DpC1jvcaaUUac7bJIsm#...
#      x-mcp-probe-item: MCP Work Order Pro
#      x-mcp-probe-amount: 1900
#      x-mcp-probe-livemode: true
curl -s https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt | wc -c    # -> 32
curl -s https://mcp.zovo.one/robots.txt                                      # -> Allow: /, no bot named

# no-UA browser can now buy; no-UA crawler still cannot start a session
curl -s -D - -o /dev/null --user-agent "" -H "Accept: text/html" -H "Sec-Fetch-Mode: navigate" \
  -H "x-mcp-probe: 1" "https://mcp.zovo.one/buy/invoice?src=probe.loop29.noua"   # -> 303 checkout.stripe.com
curl -s -D - -o /dev/null --user-agent "" -H "Accept: */*" https://mcp.zovo.one/buy/invoice
#   -> 303 https://mcp.zovo.one/s/invoice, x-mcp-buy: scripted-ua-no-session

cd /Users/mike/mcp-servers/billing && npm test    # 103 of 104
```

## Test state

103 of 104 pass in billing/. The single failure, "no sentence on the changelog page is invented",
fails identically on the untouched tree (`cd /Users/mike/mcp-servers/billing && node --test
test/changelog.test.mjs` before any edit: 4 pass, 1 fail). It reads CHANGELOG in src/pages.js,
which is generated and is not this agent's file. 23 of the 104 are new, in
billing/test/checkout-r1.test.mjs.

## Open, for other owners

- `/s/office-suite` is a 404 and office-suite has no entry in `PAGES` (src/pages.js) or in the
  storefront table. The checkout works now, but the aggregator still has no product page to sell
  it from. That is the content owner's file, not this one's.
- The office-suite copy disagrees with itself across owners: servers/office-suite/README.md says
  it proxies four siblings, the guide rendered into /llms.txt says "all twenty sibling servers as
  198 tools", and the loop brief says 76 tools. One of those is right; none of them is this
  agent's file.
- assets/office-suite-logo.png exists, but docs/HUMAN_GATED_PACK.md still says office-suite has
  no icon and to flag it before submitting.
