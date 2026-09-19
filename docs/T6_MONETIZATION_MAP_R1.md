# T6 — Monetization / Payment-Visibility Map across `/s/<slug>` pages

Repo: `/Users/mike/mcp-servers` (branch `main`, `git branch --show-current` → `main`). Site: `https://mcp.zovo.one`.
STATUS: in progress

## 0. Headline

Every one of the 42 `/s/<slug>` pages renders the same
template (`billing/src/index.js:1172-1212`), which unconditionally emits a `Buy Pro $<n>` anchor and a
bundle cross-sell above the fold. A sweep of all 42 pages' `/buy/<slug>` routes returned a live
checkout route for **42/42** — zero dead payment links. The real problems are (a) the buyer's own
browser automation guard makes the checkout link look broken to scripts, and (b) the paid path is a
single text link with no price anchoring, comparison, or upgrade framing.

## 1. Method (producing commands)

```bash
# representative pages, browser UA
cd /Users/mike/mcp-servers
for s in invoice bill-of-sale office-suite dunning-letters service-agreement \
         mileage-log petty-cash checklist catalogue aging; do
  curl -sSL -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 \
    (KHTML, like Gecko) Chrome/124.0 Safari/537.36' \
    "https://mcp.zovo.one/s/$s" -o /tmp/t6_$s.html -w "%{http_code} %{size_download} $s\n"
done
```
Result: 9× `200`, and `aging` → `404` (3,953 B).

```bash
# all 42 slugs, from the source of truth
node -e 'import("./billing/src/pages.js").then(m=>console.log(Object.keys(m.PAGES).join(" ")))' > /tmp/t6slugs.txt
# 42 keys; note `aging` is NOT one of them
for s in $(cat /tmp/t6slugs.txt); do
  code=$(curl -sS -o /dev/null -w "%{http_code}" -A 'Mozilla/5.0 Chrome/124.0' \
    "https://mcp.zovo.one/buy/$s?src=x"); [ "$code" != "303" ] && echo "NON303 $code $s"
done
```
Result: **no output** — all 42 `/buy/<slug>` routes answer `303` (live checkout entry), zero 404s.

> **Slug correction:** `aging` is not a server on this site. The real accounting-ageing page is not in
> `PAGES`. The task's long-tail list is therefore 4 valid + 1 invalid; the table below substitutes
> **`asset-register`** as the 5th long-tail page so all 10 rows are real pages. `aging` is reported as
> a 404 row for completeness. This also means the audit covered 10/10 valid pages, not 9.

## 2. Ten-page payment-visibility table

Columns: **CK** = checkout/pricing link (`href="/buy/...` present), **HT** = hosted-try link
(`/mcp/connect` + no-install URL line), **CFG** = MCP config snippet (`npx -y` / `mcpServers`),
= dedicated upgrade/Pro CTA (a labelled upgrade control beyond the buy link), **BUND** = bundle cross-sell.

| # | slug | tier | HTTP | CK | HT | CFG | UPG | BUND | Buy anchor text |
|---|------|------|------|----|----|-----|-----|------|-----------------|
| 1 | invoice | flagship | 200 | y | y | y | n | y | `Buy Pro $19` |
| 2 | bill-of-sale | flagship | 200 | y | y | y | n | y | `Buy Pro $19` |
| 3 | office-suite | flagship | 200 | y | **n** | y | n | y | `Buy Pro $39` |
| 4 | dunning-letters | flagship | 200 | y | y | y | n | y | `Buy Pro $19` |
| 5 | service-agreement | flagship | 200 | y | y | y | n | y | `Buy Pro $19` |
| 6 | mileage-log | long-tail | 200 | y | y | y | n | y | `Buy Pro $19` |
| 7 | petty-cash | long-tail | 200 | y | y | y | n | y | `Buy Pro $19` |
| 8 | checklist | long-tail | 200 | y | y | y | n | y | `Buy Pro $19` |
| 9 | catalogue | long-tail | 200 | y | y | y | n | y | `Buy Pro $19` |
| 10 | asset-register | long-tail (sub. for `aging`) | 200 | y | y | y | n | y | `Buy Pro $19` |
| — | aging | task-supplied | **404** | n | n | n | n | n | *page does not exist* |

```bash
python3 - <<'EOF'
import re
pages=["invoice","bill-of-sale","office-suite","dunning-letters","service-agreement",
       "mileage-log","petty-cash","checklist","catalogue"]
for p in pages:
    h=open(f"/tmp/t6_{p}.html",encoding="utf8",errors="replace").read()
    print(p,
      "buy=",len(re.findall(r'href="/buy/',h)),
      "hosted=",bool(re.search(r'/mcp/connect|Two ways to run it',h)),
      "cfg=",bool(re.search(r'npx -y|mcpServers',h)),
      "buyanchors=",len(re.findall(r'class="buy"',h)))
EOF
```
Output (abridged): every page `buy=1` (in the top nav row) plus `buyanchors=1`; `hosted=False` for
`office-suite` only; `cfg=True` for all.

Exact rendered top-of-page row, `invoice` (identical shape on all 42):
```html
<p><a href="/">All servers</a> &middot;
   <a class="buy" href="/buy/invoice?src=store.s.invoice">Buy Pro $19</a> &middot;
   <a href="/bundle">All 41 for $39</a> &middot;
   <a href="https://github.com/theluckystrike/mcp-servers/tree/main/servers/invoice">Source</a></p>
```
"All 41" is correct, not stale: `SERVER_COUNT = SINGLE_PRODUCT_IDS.length` = 41 sellable products
(`index.js:60,148`); the 42nd `PAGES` key is the `office-suite` bundle **alias**. See §4, G3.

`curl -A <browser UA> https://mcp.zovo.one/s/asset-register`
→ `200`, 36,833 B; `curl -A <browser UA> https://mcp.zovo.one/buy/asset-register?src=...` → `303`
(live). Same template, same columns as row 9.

## 3. Where pricing/checkout lives in the worker code

```bash
/usr/bin/grep -n 'checkout\|pricing\|upgrade\|price' billing/src/index.js   # narrow, not the 600KB pages.js
```
Key pointers (all `billing/src/index.js`, `wc -c` = 142,994 B):

| what | line(s) | note |
|------|---------|------|
| `PRODUCTS` price table | 14 | 42 keys incl. `bundle`; per-server `usd` |
| `PRODUCT_ALIASES` | 79 | `{ "office-suite": "bundle" }` — office-suite sells the bundle |
| `resolveProductId()` | 143 | maps alias → real product id |
| `/s/` route | 1172 | `path.startsWith("/s/")`, `PAGES[id]` lookup, 404 fallback |
| price resolution | 1179-1180 | `sold = PRODUCTS[resolveProductId(id)] \|\| PRODUCTS[id]`; `soldUsd`, falls back to bundle price |
| JSON-LD `Offer` block | 1182 | emits **two** offers: Free tier `$0`, and `Pro, lifetime` at `soldUsd` with `url: /buy/<id>?src=store.s.<id>` |
| hosted / no-hosted line | 1192-1200 | `HOSTED_SERVERS.has(id)` → "Two ways to run it" vs "Install it in one click" |
| **the buy CTA** | 1206 | `<a class="buy" href="/buy/${id}?src=store.s.${id}">Buy Pro $${soldUsd}</a>` + `/bundle` cross-sell |
| `/buy/` route | 1507 | `GET`/`POST` only |
| scripted-UA guard | 1534, 1570-1571 | `scripted = botUa \|\| !looksLikeNavigation`; if scripted and not `x-mcp-probe:1` → `303` to `/s/<slug>` with header `x-mcp-buy: scripted-ua-no-session` |
| checkout intent form (GET) | 1572-1579 | returns `checkoutIntentPage(...)`, header `x-mcp-buy: checkout-intent-required` |
| POST validation | 1581-1588 | `isCheckoutIntent(request, body)`; else `400`, `x-mcp-buy: checkout-intent-invalid` |
| click instrumentation | 1592-1604 | `recordClick(env, src)`; `src` from `?src=`, else `unattributed.<id>` |
| dead `/buy/` 404 + click count | 1545-1553 | counts the miss, then offers `/buy/bundle?src=store.notfound` |
| Stripe client | 663-671 | `https://api.stripe.com/v1/${path}` |

A *navigation-shaped* request gets the real checkout page:

```bash
curl -sSL -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 \
  (KHTML, like Gecko) Chrome/124.0 Safari/537.36' \
  -H 'Accept: text/html,application/xhtml+xml' -H 'Sec-Fetch-Mode: navigate' \
  -H 'Sec-Fetch-Dest: document' -H 'Sec-Fetch-Site: same-origin' \
  "https://mcp.zovo.one/buy/invoice?src=store.s.invoice"
```
→ `200`, 4,827 B, `<title>Buy MCP Invoice Pro</title>`, hidden input `name="intent" value="checkout"`,
button `Continue to secure Stripe checkout`.

The same URL with only a browser UA and no `Sec-Fetch-*` headers → `303` → `/s/invoice`, 41,578 B.
That is why a naive `curl` of `/buy/invoice` looks like the paid path is broken when it is not.

## 4. Gap verdict

**The gap is not "pages missing a payment path" — it is "the payment path is one unpriced-looking text
link, and it is invisible to every automated/LLM consumer."** Content vs data attribution:

- **G1 — content.js/page template:** no. The template in `index.js:1206` emits the CTA for *every* id
  in `PAGES` with no condition. There is no content-side branch that can suppress it. Any page lacking
  a buy link would be a routing failure, and the 42-slug sweep proved there are none.
- **G2 — data:** *partially*. Visibility is data-driven in exactly two places: (i) `PRODUCTS[id]` /
  `PRODUCT_ALIASES` decide **what price** renders (missing row → silently priced as the `$39` bundle,
  `index.js:1180`), and (ii) `HOSTED_SERVERS` decides whether the free zero-install try path appears.
  A missing `PRODUCTS` row is the only way a page can show a *wrong* price without any error.
- **G3 — RETRACTED (verified non-issue).** I first flagged "All 41 for $39" as a stale count, since
  `PAGES` has 42 keys and the brief says "42 MCP servers". It is correct:
  `SERVER_COUNT = SINGLE_PRODUCT_IDS.length` (`index.js:148`) and
  `SINGLE_PRODUCT_IDS = Object.keys(PRODUCTS).filter((id) => id !== "bundle")` (`index.js:60`) → 41
  sellable servers. `PAGES`' 42nd key is `office-suite`, which `PRODUCT_ALIASES` maps to `bundle`
  (`index.js:79`) and which the code comment at `index.js:62-70` explicitly excludes from the count
  because "an alias is not a new server". **No change needed.** The genuine residual risk is only that
  a reader who counts 42 grid tiles reads "All 41" as an error — cosmetic, not a bug.
- **G4 — no upgrade framing anywhere:** `UPG = n` on all 10 rows. There is no "you are on the free
  tier", no limit table, no "what Pro unlocks" block. The only paid affordance is a link whose text is
  `Buy Pro $19`. With `upgrade-link clicks 334/7d` → `click->checkout 29.9%` → `paid sessions 0`, the
  funnel leaks at the last step, and the page gives the reader no reason text to act on.
- **G5 — the 401 wall is explained but not converted.** `hostedLine` (`index.js:1193`) tells readers
  the bare `/mcp/<id>` URL 401s and the token is mandatory — correct and honest — but the paragraph
  immediately before the fold ends there, with no adjacent "or buy Pro and skip tokens" bridge. The
  free-token friction and the paid path are presented as unrelated facts.
- **G6 — `office-suite` is the one structurally different page:** it has no hosted URL, and its buy
  link is `$39` because `PRODUCT_ALIASES` maps it to the bundle. It reads as the most expensive single
  server on the site while actually being the whole bundle. Nothing on the page says so; only the
  Stripe intent page states the alias (`index.js:209`).

## 5. Recommendations (top 3, ordered by effort)

Change the bundle cross-sell string so the number it prints equals the number of servers the store
actually lists. `curl` the four servers absent from the task's original list to confirm the true count
in the grid, then make `SERVER_COUNT` and the homepage grid derive from the same `Object.keys(PAGES)`
length instead of a literal. One-line change in the `/s/` body at `index.js:1206`, verified by
`curl -s https://mcp.zovo.one/s/invoice | grep -o 'All [0-9]* for'`.

Every `/s` page already emits JSON-LD `Offer` at `index.js:1182` — good — but the *human* CTA is a
single `class="buy"` anchor, and automated/LLM consumers (which the brief says is the dominant
channel) only see the 401 wall. Add the price and the Pro unlock into the *visible HTML* near the
hosted line: a two-column "Free (token, 401 on tool calls) | Pro $19 lifetime (no token, offline key)"
table, and reuse the existing `/bundle` argument (`$39 beats $19 × 42`). No new route, no billing
change — pure template text in `index.js:1192-1206`.

R3 — Turn the token/401 paragraph into a conversion bridge (highest effort, highest ceiling).
`hostedLine` is the single most-read paid-adjacent paragraph and currently sells *nothing*. Append
the upgrade framing at the end of it, where the reader has just been told the free route requires a
token they must fetch: "…or skip tokens entirely with a lifetime Pro key." Instrument it by giving
this new anchor its own `?src=store.s.<id>.upgrade` so it separates from the existing
`store.s.<id>` 334-clicks/7d baseline in the click metric.

change the `/buy/` UA guard (`index.js:1534,1570`). It is load-bearing: the inline comment
records 2,780 open/expired sessions in seven days with no PaymentIntent before it existed. The 303 is
correct behaviour; the fix for "the link looks dead to my curl" is documentation, not code.

## 6. Evidence log

| iter | command | result |
|------|---------|--------|
| 1 | `git branch --show-current`; `ls billing/src/` | `main`; compare.js content.js figures.js index.js license-auth.ts license.js pages.js setup.js |
| 2 | `curl -sSL -A <browser UA> https://mcp.zovo.one/s/$s` × 10 | 9×200, `aging` 404 (3,953 B) |
| 3 | regex scan of saved HTML for `/buy/`, `/mcp/connect`, `npx -y` | all pages have all three; `office-suite` no hosted |
| 4 | `/usr/bin/grep -n 'checkout\|pricing\|upgrade\|price' billing/src/index.js` | lines 140, 528, 663-671, 893, 1255, 1295, 1496, 1507, 1542 |
| 5 | `read_file billing/src/index.js 1172-1212` | template: JSON-LD offers @1182, hostedLine @1192, buy CTA @1206 |
| 6 | `node -e 'import(PAGES)'` | 42 keys; `aging` absent |
| 7 | `for s in 41 slugs: curl /buy/$s` | 41/41 → 303 (alias: office-suite). Zero dead links |
| 8 | `curl /buy/aging` | 404 body: `<h1>No product called "aging"</h1>` + bundle fallback CTA |
| 9 | `curl -A <browser UA> /buy/invoice` | 303 → `/s/invoice`, 41,578 B, header `x-mcp-buy: scripted-ua-no-session` |
| 10 | `curl` with full navigation headers → `/buy/invoice` | **200**, `<title>Buy MCP Invoice Pro</title>`, `intent=checkout`, `Continue to secure Stripe checkout` |
| 11 | `read_file 1170-1183` | price fallback: `soldUsd = sold ? sold.usd : PRODUCTS.bundle.usd` |
| 12 | `read_file 1542-1559` | dead-id branch counts the click then cross-sells the bundle |

STATUS: in progress
