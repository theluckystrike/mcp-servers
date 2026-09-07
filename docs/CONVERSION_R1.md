# Conversion audit, loop 29 (2026-09-07)

Agent G. Read-only everywhere except this file and `data/conversion_r1.json`.
Every number names the command or `file:line` that produced it. Nothing is estimated.

## Verdict

**The funnel does not leak money, because no money has ever entered it. The "152 upgrade-link
clicks" that framed this investigation are, in the majority, this repository's own agents.**
I proved it with a controlled experiment rather than an inference: one `curl` carrying the
Chrome User-Agent that `docs/LOOP29_BRIEF.md:18` instructs every agent in this loop to send
raised `time-tracker.unknown` from 5 to 6 and `total_clicks` from 293 to 294 on
`https://mcp.zovo.one/stats/clicks`, and returned a `303` to a freshly created live Stripe
Checkout Session. The scripted-UA guard at `billing/src/index.js:845` is
`/^(curl|python|node|wget|go-http|undici|axios|httpie)/i` — anchored to the start of the
string — so spoofing a browser UA walks straight past it into `recordClick`
(`billing/src/index.js:876`). Decomposing the live `by_src` table, **229 of 294 clicks (77.9%)
carry a `src` that no live page on the site emits**: 194 (66.0%) have no `?src=` at all and
were therefore labelled `<product>.unknown` by the fallback at `billing/src/index.js:875`,
31 (10.5%) carry the bare `src=store.home` while the live home page only ever emits
`store.home.table.<id>`, and 4 (1.4%) carry the literal internal tag `src=audit`. Only **3
clicks in the instrument's entire lifetime (1.0%)** came from an in-product free-tier cap
message — the one click type that is necessarily a person who was using the product and hit a
wall. Against that, `data/intel_r6.json` records **0 pages and 0 queries with any Google
impression** for mcp.zovo.one over 2026-08-28..09-03, and the orchestrator's
`docs/AUDIENCE_REALITY_R1.md` measures 22 unique human repo visitors in 14 days. Zero payments
from that population is not a conversion defect; it is the arithmetic of an empty room. The
storefront is broken in several real and specific ways catalogued below — the advertised
install command 404s, the home page's only working install link points at a release containing
4 of 30 servers, 33 live links lead to a 503 or a 404 — but **none of those defects has cost a
sale yet, because there is no evidence a single human has ever clicked Buy with intent to pay.**
Fix them because they will cost sales the moment traffic exists, not because they are costing
sales now. And fix the instrument first: while it counts its own operators, every conversion
number this project produces is fiction, and the loop will keep re-diagnosing a funnel it
cannot see.

## The primary finding, reproduced

```
$ curl -sS -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 \
    (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" https://mcp.zovo.one/stats/clicks
   -> time-tracker.unknown total=5   total_clicks=293
$ curl -sS -A "<same Chrome UA>" -o /dev/null -w '%{http_code}' https://mcp.zovo.one/buy/time-tracker
   -> 303   (Location: https://checkout.stripe.com/f/pay/cs_live_...)
$ curl -sS -A "<same Chrome UA>" https://mcp.zovo.one/stats/clicks
   -> time-tracker.unknown total=6   total_clicks=294
```

The KPI's own `how` field in `data/kpi.json` claims the figure counts humans, "the billing
worker excludes probe-tagged and scripted user agents before counting". It does not. The
loop brief's mandated UA is the exact bypass.

A second, independent tell: `data/kpi.json` (generated 2026-09-06T08:21:51Z) recorded
`clicks_7d = 152`. `GET /stats/clicks` at 2026-09-07T01:06:24Z returned `clicks_7d = 293`.
**+141 clicks in roughly 17 hours** on a site with zero search impressions and 22 human repo
visitors in a fortnight. Also note `total_clicks == clicks_7d == 293`: every click the
instrument has ever recorded falls inside its own 7-day window, i.e. the instrument is younger
than any claim made from it.

### Full click taxonomy, live counts

Source: `GET https://mcp.zovo.one/stats/clicks`, 2026-09-07T01:06Z, `by_src[*].total`.

| Category | Clicks | Share | What it actually is |
|---|---:|---:|---|
| A. `<product>.unknown` (30 products + `bundle`) | 194 | 66.0% | `/buy/<id>` fetched with **no `?src=`**. Grep of every page I fetched found **zero** live `/buy/` links without a `src` — so no live surface can produce these. Signature of a browser-UA sweep over the product ids, which is exactly what the loop brief prescribes. |
| B. `store.home` (bare) | 31 | 10.5% | The live home page emits only `store.home.table.<id>` (31 links, verified in `home.html`). Bare `store.home` is emitted by **no live page**. 31 = the exact count of `PRODUCTS`. One sweep. |
| C. `audit` | 4 | 1.4% | A literal internal tag. Not a customer under any reading. |
| D1. `store.home.table.*` | 23 | 7.8% | Home table row. Provenance indistinguishable from a crawler. |
| D2. `store.s.*` | 7 | 2.4% | Product page. |
| D3. `store.setup.*` | 15 | 5.1% | Setup page. |
| D4. `store.guide.*` | 14 | 4.8% | Guide page. |
| D5. `store.pending.*` | 3 | 1.0% | Clicked the bundle rescue link **on** the 503 page. The 503 recovery path works. |
| E. in-product cap messages | 3 | 1.0% | `per-diem.perdiem_report` 1, `time-tracker.full_history` 1, `time-tracker.full_history.bundle` 1. **The only clicks that necessarily came from a person running the software.** |
| **Total** | **294** | | |

Surfaces the live site emits that have produced **zero** clicks, ever: `store.bundle` (the
dedicated $39 landing page, in the sitemap), `store.compare.*` (all 19 compare pages),
`store.setup.claude-desktop`, and 14 of the 30 `store.home.table.*` rows including
`invoice`… (`store.home.table.invoice` did fire, 4).

## Ranked leak table

Share is expressed against the **294 measured clicks**, not against the 152 in `kpi.json`,
which is the same instrument at an earlier timestamp.

| # | Leak | Evidence | Share of clicks affected | Fixable today? |
|---|---|---|---:|---|
| 1 | **Click instrument counts its own operators.** Scripted-UA guard is start-anchored, so any spoofed browser UA is counted as a human and creates a live Stripe Session. | `billing/src/index.js:845` regex; `:876` `recordClick` after the guard; `:875` `${id}.unknown` fallback. Reproduced above (5→6, 293→294). | 229 / 294 = **77.9%** measured contamination; true human share is **unmeasured** and cannot exceed 65 (22.1%). | **Agent A today** (worker change). |
| 2 | **The advertised install command does not exist.** `npx -y @theluckystrike/mcp-<name>` is the primary install path printed across the site; every package 404s on the registry. | `npm view @theluckystrike/mcp-invoice` → `E404`; same for `-spreadsheet`, `-time-tracker`, `-pdf`, `-docx`. 35 of 39 sampled sitemap pages (**89.7%**) print a `@theluckystrike/mcp-` package name. | Every visitor who tries the headline install path. Unquantifiable in clicks. | **Operator** (npm publish needs interactive login). Agent can demote the path today. |
| 3 | **Home and `/bundle` print the dead install command with no disclaimer**, while every `/s/` and `/setup/` page does disclose it. The two most commercial pages are the two that lie. | `grep -c 'npm publish' home.html` → `0`; `bundle.html` → `0`; `s_invoice.html` → 2 ("npm publish for … is pending"); all 24 sampled `/setup/` pages → 1. | Home is the origin of 23 of the 65 live-surface clicks (35%). | **Agent A today.** |
| 4 | **Home's `.mcpb` link — the only genuinely working install path — points at release `v0.1.1`, which contains 4 of 30 bundles.** | `billing/src/index.js:302` hardcodes `${REPO}/releases/tag/v0.1.1`; verified live in `home.html`. `gh api .../releases/tags/v0.1.1` → 4 assets. `.../releases/latest` → v0.20.0, 31 assets. | Every home visitor who picks the working path and finds 26 of 30 servers missing. | **Agent A today** (one-line change to `/releases/latest`). |
| 5 | **33 live links point at a dead buy route**, and the leak is structurally invisible to the instrument. | Verified dead: `/buy/work-order`, `/buy/catalogue`, `/buy/change-order` → `503 x-mcp-buy: price-pending-human`; `/buy/office-suite` → `404` with **no bundle rescue**. Link count from the sitemap: 3 on home, 3 on `/s/`, 27 on `/setup/` (21 pending + 6 office-suite). | **0 measurable.** Both the 404 branch and the `PENDING_HUMAN` branch return *before* `recordClick` (`billing/src/index.js:848`, `:849-856`), so a click on a dead route is never counted. Size is **unmeasured by construction**. | Agent A is on it. |
| 6 | **`office-suite` is a product with 6 setup pages and no product record**, so its buy link is a bare 404 — the only dead route with no rescue path to the bundle. | `grep -rn office-suite billing/src/` → no `PRODUCTS` entry; `/setup/claude-desktop/office-suite` carries `href="/buy/office-suite?src=store.setup.claude-desktop"`; that URL returns 404 "Unknown product". | 0 measured (see #5). | **Agent A today.** |
| 7 | **A paying customer's first instruction is the broken install command.** `/success` renders `installSnippet()`, which prints the `npx` line that 404s. | `billing/src/index.js:588-606` (`installSnippet`), called at `:632` inside `successPage`. | 100% of buyers — of whom there are 0. Pure refund risk. | **Agent A today.** |
| 8 | **Stale, checkable claims on the highest-traffic page.** The live home page says "Seventeen" servers four times (there are 30), its JSON-LD `SoftwareApplication.description` says "Seventeen local-first MCP servers", and its "Measured, not claimed" section claims "399 of 399 automated checks" while the repo's own `git log` records `validate 951/951`. | `grep -oi seventeen home.html` → 4; `grep -o '[0-9]* of [0-9]* automated checks' home.html`; `git log --oneline -1` → "validate 951/951". | 23 home-table clicks + 31 bare-`store.home`. | **Agent A today.** |
| 9 | **Refund terms appear on 2 page types out of 6.** "Refunds within 14 days" is on home and `/guides`; absent from `/bundle`, `/s/`, `/compare/`, `/setup/`. | `grep -ci refund` → `home.html` 2, `guides.html` 2, `bundle.html` 0, `s_invoice.html` 0, `compare.html` 0, `pg_setup_cursor_docx.html` 0. `billing/src/index.js:305`, `billing/src/content.js:405,423`. | `/bundle` and `/s/` = 7 of 65 live-surface clicks, plus the entire `store.bundle` surface which has 0. | **Agent A today.** |
| 10 | **No key is emailed; it exists only on one page.** `/success` renders the key once and says so; recovery is `/recover?session_id=` from the Stripe receipt. | `billing/src/index.js:608-631`; `checkoutCustomText` `after_submit` at `:105-108` does warn pre-purchase. | 0 buyers. Real risk at volume, adequately disclosed. | Operator decision (needs an email sender). |

## Is there an honest reason to pay $19?

Yes for most servers, and the free tier is genuinely enforced — this is **not** a case of a
paywall that does not exist. `servers/invoice/src/index.ts:23` sets
`FREE_INVOICES_PER_MONTH = 3` and `:526-531` refuses the fourth with an upgrade message;
`packages/mcp-license/src/index.ts:151-208` is a real offline-verified gate.

But the caps are set where a trial user never reaches them. 12 of the 30 servers describe
their **free** tier with the word "unlimited" (`time-tracker`, `price-tracker`,
`expense-tracker`, `billing-docs`, `deposits`, `per-diem`, `asset-register`,
`statement-of-account`, `cash-book`, `amortization`, `petty-cash`, `catalogue`), and several
put the server's whole reason for existing on the free side by explicit design —
`billing/src/index.js:32` says the cash-book's trial balance is "unlimited on every tier,
because whether the books add up is the question this server exists for", and `:33` says the
same of the amortization schedule. That is defensible product design, and it is also why the
instrument recorded **3 in-product cap clicks in its lifetime**: 3 invoices a month, 5
statements a month, 5 deposits a month are limits a person meets in week three, not in the
first session. The free tier is not too generous to be worth paying past; it is too generous
to produce a *purchase signal* inside a trial. That is a real conversion problem, but it
ranks below the instrument and the install path because it only binds on users who exist.

## The three changes that would most raise paid conversion

Concrete enough to implement without further analysis.

**1. Make the click counter countable. (Agent A, `billing/src/index.js`.)**
Three edits in the `/buy/` handler. (a) Replace the start-anchored scripted test at `:845`
with a substring test that also catches spoofed automation — at minimum require that a
counted request carry `accept: text/html` and a `sec-fetch-mode: navigate` header, which every
real browser navigation sends and no `curl -A` sweep sends by default. (b) Never count a
request whose resolved `src` is the `${id}.unknown` fallback (`:875`) — no live link on the
site omits `src`, so that value is definitionally not a storefront click; bucket it as
`unattributed:<id>` in a separate counter and keep it out of `total_clicks` and `clicks_7d`.
(c) Move `recordClick` *above* the 404 and `PENDING_HUMAN` returns at `:848-856` with a
distinct `dead:<id>` src, so the 503/404 leak becomes measurable instead of invisible. Then
reset the KV `click:` prefix once, and restate the KPI's `how` field to say what is now true.

**2. Stop printing an install command that does not exist. (Agent A, `billing/src/index.js`.)**
On the home page and `/bundle`, reorder "Three ways to start" so **connect-by-URL is first and
`npx` is last**, and add to the `npx` bullet the same sentence the `/s/` pages already carry:
"npm publish is pending; use the .mcpb bundle or connect by URL until it lands." Change
`:302`'s `${REPO}/releases/tag/v0.1.1` to `${REPO}/releases/latest` (v0.1.1 has 4 of 30
bundles). In `installSnippet()` at `:588-606`, put the `/mcp/connect` URL and the `.mcpb`
download above the `npx` block so a paying customer's first instruction is one that works.
This is the only path that is verified end-to-end: `/mcp/connect` returns 200 and mints a
token, and `POST /mcp/invoice/t/<token>` answered `initialize` and `tools/list` correctly
during this audit.

**3. Make the free tier produce a purchase signal in the first session. (Owner of the server
packages, not agent A.)** Not by lowering the caps — by making the cap *visible before it
binds*. Every free-tier response that is one step from a limit should say so and carry the
tagged upgrade URL: "invoice 2 of 3 this month". Today the upgrade URL is emitted only at
refusal, which is why 3 of 294 clicks carry a cap src. Also fix
`packages/mcp-license/src/index.ts:154` — `LicenseGate.status()` returns
`upgradeUrl = ${CHECKOUT_BASE}/buy/${product}` with **no `src`**, so every click arriving from
`license_status` is silently filed as `.unknown` and mixed in with the crawler traffic. Give
it `?src=<product>.license_status`.

## What I could not measure, and why

- **How many of the 294 clicks are human.** I proved 229 (77.9%) carry a `src` that no live
  page emits. The remaining 65 arrived on real storefront links and are **indistinguishable
  from a crawler walking the sitemap** — the worker stores no IP, no timestamp beyond the day
  bucket, and no UA alongside the click. The human count is unmeasured and I will not estimate
  it. It is bounded above by 65.
- **How many clicks hit the 503 or 404 buy routes.** Structurally unmeasurable: both branches
  return before `recordClick` (`billing/src/index.js:848`, `:849-856`). I can report 33 dead
  links across the live site; I cannot report a single click on them.
- **What the Stripe hosted checkout page actually shows.** `checkout.stripe.com` served a
  564,105-byte JavaScript shell containing no product string, no merchant name, and no price
  in its initial HTML — the content is fetched client-side. `checkoutDescription()`
  (`billing/src/index.js:110-119`) is only a *source* for a `stripe-sync` step the file's own
  comment says is "run by hand with a live key", and `docs/LOOP29_BRIEF.md:21-23` records that
  the available key lacks `product_write`. **Whether the live Stripe Products carry the right
  name and description is unverified by anyone**, and it needs a browser or a broader key.
- **Whether checkout completes.** No payment has been attempted. 27 of 31 routes reaching
  `checkout.stripe.com` proves a Session is created; it proves nothing about the pay button,
  card acceptance, or the webhook. The `/success` and `/recover` paths have never run against
  a real payment.
- **Whether the 5,105 bundle downloads contain any human installs.** Delegated to
  `docs/AUDIENCE_REALITY_R1.md`; my own spot check of v0.19.0 agrees with it — 30 assets, mean
  6.4, stdev 1.62, range 4–13, with `invoice.mcpb` at 4 tying `office-suite.mcpb`, a server
  that is not even a purchasable product. Flat where human demand is a power law.
- **Any per-click timing or referrer.** The KV schema is `click:<src>:<yyyy-mm-dd>` and
  `click:<src>:total` (`billing/src/index.js:508-509`) with a 120-day TTL on the day buckets.
  There is no session, no referrer and no funnel-step data, so click→session→payment cannot be
  joined for any individual visitor.

## Evidence retained

Raw HTML of every page fetched during this audit, the sitemap, the two `/stats/clicks`
snapshots and the Stripe checkout shell are in
`/private/tmp/claude-501/-Users-mike/791603f5-7436-4058-a8e8-9cdc5fafea5f/scratchpad/funnel/`.
Machine-readable leak table: `data/conversion_r1.json`.
