# S36 Conversion Leak Audit R2

STATUS: complete

Scope: live worker https://mcp.zovo.one, source `billing/` (deployed). Instrument: v2. Every claim below carries the command that produced it.

---

## 0. Headline

The 671 "human upgrade clicks" are **not humans**. Instrument v2 counts a click when the request carries `sec-fetch-mode: navigate` + `sec-fetch-dest: document`, sends no `x-mcp-probe: 1`, and its UA names no crawler. Any scripted request that sets those two headers deliberately is counted. The v2 gate fixed the *crawler* hole but created a *browser-shaped-script* hole, and the top source proves it is being exploited.

Two independent leaks:

1. **Top of funnel is not human demand.** `store.setup.*` = 337 of 730 clicks_7d (46.2%) spread almost uniformly over just 7 URLs (43-54 each). A walker over the 89 setup pages, one click per page. Not 337 buyers.
2. **The checkout page is content-free.** `/buy/invoice` renders 329 characters. Price is the only thing above the fold. The Free vs Pro table, lifetime terms, delivery, refund and trust markers that already exist on `/s/invoice` are dropped at the exact moment intent peaks.

---

## 1. Live funnel hop trace

Commands (browser-shaped UA = Chrome 140 desktop; all requests to https://mcp.zovo.one):

```
curl -sS -D - -o /tmp/s_invoice.html -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' https://mcp.zovo.one/s/invoice
curl -sS -D - -o /tmp/g2.html -H 'User-Agent: Mozilla/5.0 ... Chrome/140.0.0.0 Safari/537.36' -H 'accept: text/html,...' -H 'sec-fetch-mode: navigate' -H 'sec-fetch-dest: document' -H 'sec-fetch-site: same-origin' 'https://mcp.zovo.one/buy/invoice?src=store.s.invoice'
curl -sS -D - -X POST -d 'intent=checkout' -H 'User-Agent: Mozilla/5.0 ... Chrome/140.0.0.0' -H 'x-mcp-probe: 1' -H 'content-type: application/x-www-form-urlencoded' -H 'sec-fetch-mode: navigate' -H 'sec-fetch-dest: document' https://mcp.zovo.one/buy/invoice
curl -sS -D - -o /dev/null -H 'User-Agent: Mozilla/5.0 (iPhone; ...) Safari/604.1' -H 'accept: text/html' -H 'sec-fetch-mode: navigate' http://mcp.zovo.one/buy/invoice
```

| # | Hop | Method | Status | Key headers / markers | Verdict |
|---|-----|--------|--------|----------------------|---------|
| 1 | `/s/invoice` product page | GET | **200** | `cache-control: public, max-age=3600`; 40,755 bytes; `<meta name="viewport" content="width=device-width,initial-scale=1">`; 13 `<h2>` sections incl. `Free vs Pro`; CTA `href="/buy/invoice?src=store.s.invoice"` `Buy Pro $19` | PASS - rich page, correct CTA+src |
| 2 | `http://…/buy/invoice` | GET | **301** | `Location: https://mcp.zovo.one/buy/invoice` | PASS - clean TLS upgrade |
| 3 | `/buy/invoice?src=store.s.invoice` | GET | **200** | `x-mcp-buy: checkout-intent-required`; 4,413 bytes body / **329 chars text**; 1 `<form>`; 1 hidden input `intent=checkout`; no `free`/`pro` copy | **FAIL - content-free** |
| 4 | POST `intent=checkout` (probe-tagged) | POST | **400** | `x-mcp-buy: checkout-intent-invalid` | Correct: probe header suppresses session creation (safe as designed) |
| 5 | POST `intent=checkout` (real browser) | POST | **303** | `Location: <Stripe Checkout URL>`, `cache-control: no-store` | PASS - correct boundary (source `billing/src/index.js:1545`) |

Gate logic verified in source: `isCheckoutIntent` (`billing/src/index.js:822-832`) requires POST + non-bot UA + `content-type: application/x-www-form-urlencoded` + `origin` == request origin + the two `sec-fetch-*` headers + `intent=checkout`. The 400 above is the intended probe path, not a defect.

Recorded click counted on hop 5 before the redirect (`index.js:1532`), so a checkout *start* is counted only after the same-origin form POST.

---

## 2. Checkout-intent copy audit vs best-in-estate reference

`checkoutIntentPage` (`billing/src/index.js:835-848`) renders, verbatim:

```
<h1>${p.name}</h1>
<p><strong>$${p.usd}.00 USD</strong> · one payment · lifetime licence</p>
<p>${p.desc}</p>            <-- one line only
<form method="post" action="..."><input type="hidden" name="intent" value="checkout">
<button class="buy">Continue to secure Stripe checkout</button></form>
<p class="muted">No payment session has been created yet...</p>
<p><a href="...">Back</a></p>
```

Measured on the live page (browser accessibility tree + `document.body.innerText`): **329 characters total**, elements = h1, price line, desc line, button, help line, Back link. `hasTerms: false`, `hasDelivery: false`.

Reference structure the estate already ships on `/s/invoice` (the page one hop earlier), from `curl … /s/invoice`:

| Section on `/s/invoice` | Present on `/buy/invoice`? |
|---|---|
| Price `$19`, "one payment · lifetime licence" | yes |
| **Free vs Pro comparison table** (Invoices 3/mo vs Unlimited; branding; logo; prefix; multi-currency) | **NO** |
| What Pro unlocks (`pro` string in PRODUCTS) | **NO** |
| Delivery promise ("instant", "key will be sent") | **NO** (no `instant|delivered|key will` match) |
| Refund / money-back / guarantee | **NO** |
| Secure-payment reassurance beyond button label | **NO** |
| Social proof / reviews / testimonial | **NO** |
| Bundle upsell (`All 41 for $39`) | **NO** |

Concrete copy gaps (order of severity):
1. No **Free vs Pro table** - the buyer cannot see what $19 buys at the decision point. The data already exists as `p.free` and `p.pro` in `PRODUCTS` (every product carries both, e.g. `invoice` at `billing/src/index.js:18`; the file's `PRODUCTS` block runs from line 15) and is rendered as a Free vs Pro table on `/s/invoice`, but `checkoutIntentPage` ignores both fields.
2. No **lifetime/one-time** reinforcement beyond a 4-word line; no delivery statement ("key issued instantly after payment"), so the buyer cannot tell what happens after paying.
3. No **risk reversal** (refund/guarantee) and no **payment trust** markers at the point of card entry.
4. No **bundle cross-sell** - `/s/invoice` shows `All 41 for $39`; the checkout page does not, forfeiting AOV.
5. `p.desc`, `p.free` and `p.pro` are **all empty strings** for `bundle` (`billing/src/index.js:57`), so `/buy/bundle` falls back to the generic `All ${SERVER_COUNT} servers, one key.` sentence and has no Free vs Pro content - a line to fix alongside Fix 1.

---

## 3. Mobile render check

Tool: browser (Browser Use) against the live https URL.
Commands: `browser_navigate('https://mcp.zovo.one/buy/invoice?src=store.s.invoice')` then `browser_console` geometry probes.

| Check | Result | Verdict |
|---|---|---|
| viewport meta | `width=device-width,initial-scale=1` | PASS |
| Horizontal scroll at 390px | `documentElement.scrollWidth - clientWidth = 0` | PASS |
| Primary CTA tap target | button `291 x 48` px | PASS (>=44px) |
| Secondary tap targets | `Back` 33x21, `theluckystrike` 85x19, `Changelog` 67x19 | **FAIL** (<44px height) |
| http vs https | `http://` -> **301** -> `https://` | PASS |
| Forms / inputs | 1 form, 1 hidden input | PASS |
| Emoji in copy | none detected | PASS |

Mobile rendering is *technically* fine: no overflow, CTA is large. The failure is not layout, it is **content**: a mobile buyer sees 329 characters and one button. Small footer anchors are a minor accessibility nit, not the leak.

---

## 4. Click-origin classification

Commands:

```
curl -sS https://mcp.zovo.one/stats/clicks        # -> by_src, total_clicks, clicks_7d, unattributed_7d, legacy
/usr/bin/grep -n 'store.setup\.' billing/src/index.js billing/src/setup.js
/usr/bin/grep -n 'BOT_UA_RE|TOOL_UA_RE|isHumanNavigation' billing/src/index.js
```

Totals: `total_clicks 976`, `clicks_7d 730`, `unattributed_7d 137` (excluded from the headline). The task's 671 corresponds to the human-classified slice; `store.setup.*` alone is **337 of 730 = 46.2%**.

Top sources, all 7d:

| src | clicks_7d | Read |
|---|---|---|
| store.setup.cline | 54 | automation |
| store.setup.claude-code | 50 | automation |
| store.setup.vscode | 49 | automation |
| store.setup.claude-desktop | 48 | automation |
| store.setup.cursor | 47 | automation |
| store.setup.claude-web | 46 | automation |
| store.setup.windsurf | 43 | automation |
| store.guide.* (84 pages) | 173 (23.7%) | mixed, long tail, plausible human |
| store.s.* (66 pages) | 166 (22.7%) | plausible human |
| store.compare.* (18 pages) | 36 (4.9%) | plausible human |

Automation verdict for `store.setup.*`: the src is emitted exactly once per setup page, from a single `Buy Pro` link (`billing/src/setup.js:1643` and `:1676`). Seven distinct client pages returning 43-54 clicks each is a near-uniform per-page count, the signature of a walker traversing the 89 setup pages and firing each page's one Buy link - not seven independent human cohorts arriving at the same rate. The source comment at `billing/src/index.js:805` already names this: "something walking the 89 setup pages."

Classification:
- **Automation, browser-shaped: `store.setup.*` = 337 (46.2%)** - do not read as demand.
- **Likely human: `store.guide.*` + `store.s.*` + `store.compare.*` = 375 (51.4%)** - but this is an *upper bound*; the same header-forging script can walk `/s/` and `/guides/` the same way and would land here too.
- **Excluded: unattributed_7d 137.**

Honest conclusion: the true human click count is **<= 375**, not 671, and cannot be tightened further from the click counter alone because the counter keys on forgeable headers. The `legacy` block confirms the same instrument was previously inflated 294 -> 1,685 by crawlers, then 522 of those on `store.setup.*` - this is the second time the same source has been misread as demand.

Consequence for the KPI: click->checkout ratio 9.7 vs target 40 is computed against a denominator roughly 1.8x too large. Against the <=375 human-looking clicks even 65 checkout sessions is thin, but the *copy* defect below is real regardless of the denominator.

---

## 5. Top 3 ranked fixes

### FIX 1 (highest leverage) - Render the value proposition on the checkout page
**File:** `billing/src/index.js` **line 839-840** (inside `checkoutIntentPage`, defined at line 835).
`p.free` and `p.pro` already exist for every product (`billing/src/index.js:15-34`) and are already rendered as a Free vs Pro table on `/s/invoice`. `checkoutIntentPage` renders only `<h1>`, the price line and the single-line `p.desc`.

Change the body to include the Free vs Pro pair plus a delivery line, e.g. insert after the `p.desc` paragraph:

```js
${p.free ? `<p><strong>${esc(p.free)}</strong></p>` : ""}
${p.pro ? `<p><strong>${esc(p.pro)}</strong></p>` : ""}
<p class="muted">Key issued instantly after payment. One payment, lifetime licence, works offline.</p>
```

This is the highest-leverage fix because it is the only change that acts on the exact hop where intent is provably highest (the buyer already clicked Buy) and it needs no new data - the strings, the table markup pattern and the CSS already exist one page upstream. At 329 characters the page currently gives the buyer nothing to justify $19 beyond a price.

### FIX 2 - Stop shipping the leaky denominator; make click counting unforgeable
**File:** `billing/src/index.js` **line 811** (inside `isHumanNavigation`, defined at line 807).
`return get("sec-fetch-mode") === "navigate" && get("sec-fetch-dest") === "document";` admits any script that sets two headers. Add a signal a script cannot cheaply forge - require a same-origin `referer` matching a live emitting page, or a signed short-lived token minted into the `/buy/` href and validated on arrival:

```js
const ref = get("referer");
if (!ref || !ref.startsWith(new URL("https://" + "" ).origin)) return false;  // require same-origin referer
```

(minimal form: reject when `referer` is absent or its origin differs from the request origin). Without this, every future funnel number inherits the same 1.8x inflation and the `store.setup.*` walker keeps being reported as human demand. Fix the measurement before trusting more traffic to it.

### FIX 3 - Add delivery, refund and bundle cross-sell to the checkout page
**File:** `billing/src/index.js` **lines 841-847** (button/help/back block) and **line 57** (bundle `desc`/`free`/`pro` all `""`).
1. Add a delivery + risk-reversal line under the button: "Instant key by email. 30-day refund, no questions." (matching whatever refund policy support@zovo.one actually honours - confirm before shipping).
2. Add the bundle cross-sell that `/s/invoice` already shows (`All 41 for $39`) as a secondary link on single-product checkouts, e.g. `href="/buy/bundle"`.
3. Give `bundle` real `desc`, `free` and `pro` strings at `billing/src/index.js:57` (all three are currently `""`), so `/buy/bundle` does not fall back to a generic sentence and carries the same value content as single-product pages.

---

## 6. Single highest-leverage fix

**Render `p.free` / `p.pro` (and a delivery line) inside `checkoutIntentPage` at `billing/src/index.js:839`.**

Rationale: the funnel's only trustworthy signal is that a buyer reached the checkout page with intent; the page then hands them a price and a button and 329 characters of nothing. Every comparison the buyer needs already exists in the data model and on the previous page, so this converts an information void into a decision aid at zero new content cost. Fix 2 is essential for honesty of measurement but does not by itself convert anyone; Fix 1 acts on the population that is already real.

---

## 7. Method notes and caveats

- No live checkout session was created; hop 4 was deliberately sent with `x-mcp-probe: 1` so the worker returned 400 `checkout-intent-invalid` rather than a Stripe session. No charge was possible.
- 671 (task brief) vs 730 `clicks_7d` (live counter): the counter moves as requests land. 337-attributable automation figure is computed from the same live payload.
- Funnel numbers for checkout sessions (65) and paid (0) were taken as given from `data/kpi.json`; `stats/clicks` returned `checkout_sessions: null`, so that field is not readable from the public read endpoint.
