# Funnel round 1: discovery to money, walked end to end (loop 33, 2026-09-10)

Agent A3. Owner of `billing/` and the storefront generator. Nothing deployed.
Every number below carries the command that produced it. Machine-readable: `data/funnel_r1.json`.

## Verdict

**The largest leak is that the zero-install path the product page leads with cannot work, and
has never worked.** Every hosted `/s/` page opens with "Paste `https://mcp.zovo.one/mcp/<id>`
into any client that takes a URL, no install and no account", and `/llms.txt` hands the same
URL to every assistant that reads the catalogue. That URL answers `initialize` and
`tools/list` with **HTTP 200 and the full tool list**, and then answers **every single
`tools/call` with HTTP 401** and a body that is not JSON-RPC. Measured on 8 of 8 hosted
servers. The client connects, all 14 tools appear, the assistant calls one, and the
connection fails at the transport layer with a message the user cannot act on. There is a
`WWW-Authenticate: Bearer` challenge, and the three OAuth discovery documents a spec-following
client would then fetch all return 404, so that path dead-ends too.

The comment in `billing/src/index.js:948-953` states the intent exactly: *"The registry is the
only channel that measurably delivers people here, and a good share of them arrive from
clients that take a URL and cannot set a header, so the hosted line goes above the fold."*
**81 of 85 active registry rows land on a `/s/` page.** The line written for the people who
cannot set a header gives them the one URL form that requires one.

The consequence is arithmetic, not opinion: a visitor who takes the headline path delivers
zero value, meets no cap, sees no upgrade message and never reaches `/buy/`. The monetisation
event is unreachable from the front door.

The free-to-paid trigger itself is **not** the problem, and this corrects
`docs/CONVERSION_R1.md`, which concluded the caps "are set where a trial user never reaches
them". On the tokened path I hit the invoice cap in **4 tool calls and 5,843 ms of tool
latency**, and the refusal carried a tenant-bound, `src`-tagged buy URL that 303s to a live
Stripe Session. The machine works. Almost nobody reaches it.

Second: **the click counter is still lying, and worse than before.** 294 on 2026-09-07,
**1,685 on 2026-09-10T13:35Z — +1,391 in three days (+473%)** on a property with 0 Google
impressions in 99 days. 522 of them (31.0%) sit on the seven `store.setup.<client>` sources,
i.e. something walked the 89 setup pages and followed every Buy Pro link. Meanwhile the one
click type that can only come from a person running the software — an in-product cap message —
still stands at **3 for the instrument's entire lifetime (0.18%)**, unchanged since
2026-09-07. Both are fixed below.

---

## 1. The walk, with evidence

### Hop 0 — the registry, the only channel that delivers humans

```sh
curl -sS "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.theluckystrike&limit=100"   # paginated
```

| | count |
|---|---:|
| rows returned (all versions) | 1,394 |
| distinct names | 89 |
| latest rows | 89 |
| latest and **active** | 85 |
| latest and deprecated | 4 |
| active, `websiteUrl` → `/s/<id>` | **81** |
| active, `websiteUrl` → `/bundle` | 1 |
| active, `websiteUrl` → `/buy/<id>` | **3** |

The prior repointing to `/s/` held for 81 rows. The three that did not are
`delivery-schedule`, `deliverable-tracker` and `milestone-schedule`, all at v0.21.0, all
pointing at `https://mcp.zovo.one/buy/delivery-schedule` — a URL `robots.txt` Disallows and
which 303s straight into Stripe with no product context. The **local manifests are already
correct** (`servers/delivery-schedule/server*.json` say `/s/delivery-schedule`); the live rows
are stale and the registry rejects a duplicate version, so this needs a version bump and a
republish. Not a code fix.

### Hop 1 — `websiteUrl` → the product page

```sh
curl -sS -A "<Chrome UA>" -H 'Accept: text/html' -H 'x-mcp-probe: 1' https://mcp.zovo.one/s/invoice
#   -> 200, 38,335 bytes, 636 lines of rendered text
```

What a person sees, in order: a nav line with `Buy Pro $19`; the hero ("Two ways to run it");
the tagline; a 60-second install block; a 14-row tool table; a "What you can say" table; a
worked example; the Free-vs-Pro table; ~2,000 words of limits, storage and FAQ; and **80+
guide links**. One decision is asked above the fold: hosted URL, or `.mcpb`.

### Hop 2 — the free path the page names. **This is the leak.**

```sh
curl -sS -X POST https://mcp.zovo.one/mcp/invoice \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
#   -> HTTP 200, full tool list

curl -sS -X POST https://mcp.zovo.one/mcp/invoice ... -d '{... "method":"tools/call" ...}'
#   -> HTTP 401
#      www-authenticate: Bearer realm="mcp.zovo.one", error="invalid_token"
#      body: {"error":"unauthorized","message":"This endpoint needs a token....}
#      -> the body has NO `jsonrpc` key and NO `id`
```

Swept across eight servers:

| server | `tools/list` | `tools/call` | body is JSON-RPC |
|---|---:|---:|---|
| invoice | 200 | **401** | no |
| time-tracker | 200 | **401** | no |
| spreadsheet | 200 | **401** | no |
| pdf | 200 | **401** | no |
| currency | 200 | **401** | no |
| kanban | 200 | **401** | no |
| zip | 200 | **401** | no |
| barcode | 200 | **401** | no |

8 of 8. And the spec-shaped escape hatch is also closed:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://mcp.zovo.one/.well-known/oauth-protected-resource              # 404
curl -s -o /dev/null -w '%{http_code}\n' https://mcp.zovo.one/.well-known/oauth-protected-resource/mcp/invoice  # 404
curl -s -o /dev/null -w '%{http_code}\n' https://mcp.zovo.one/.well-known/oauth-authorization-server            # 404
```

So a client that honours the `WWW-Authenticate` challenge fetches the resource metadata, gets
404, and stops. There is no route from the advertised URL to a token that does not involve a
human opening `mcp.zovo.one/mcp/connect` in a browser — which is the thing the sentence says
you do not need to do.

Emitted from exactly two places, both mine:

- `billing/src/index.js:955` — the above-the-fold hero on **30 of 30** hosted `/s/` pages.
- `billing/src/index.js:1183` — `/llms.txt`, **31** catalogue lines, the file assistants read.

The blast radius is the whole human channel: 81 of 85 active registry rows land on a page
whose first instruction is this.

### Hop 2' — the path that does work

```sh
curl -sS https://mcp.zovo.one/mcp/connect          # 200, mints anon_da415cbdfb4b37b76d43a8095243ed9f
```
The page is correct and complete: a token, a ready URL per server, the free-tier terms
("600 calls an hour, free-tier server limits, data kept 30 days"), and the warning that
reloading mints a new, empty data space. Nothing on it is broken. It is simply not what the
product page told anyone to use.

### Hops 3-5 — value, then the cap, then the upgrade message

```sh
U=https://mcp.zovo.one/mcp/invoice/t/anon_da415cbdfb4b37b76d43a8095243ed9f
# invoice_create x5, same arguments
```

| call | result | ms |
|---|---|---:|
| 1 | `INV-2026-0001`, EUR 1080.00 + 23% = EUR 1328.40 | 1,471 |
| 2 | `INV-2026-0002` | 1,300 |
| 3 | `INV-2026-0003` | 1,751 |
| **4** | **cap** | 1,321 |
| 5 | cap (idempotent) | 1,384 |

The refusal, verbatim:

> You have already created 3 invoices in 2026-09. The free tier allows 3 invoices per calendar
> month. "unlimited invoices" is a Pro feature. Pro is a one-time $19 for this server,
> lifetime. Buy at `https://mcp.zovo.one/buy/invoice?tenant=anon_da41...&src=invoice.unlimited_invoices`
> — that link carries your token, so Pro switches on for this same connection right after
> payment, with nothing to paste and no data to move. … Or all 31 servers for $39:
> `https://mcp.zovo.one/buy/bundle?tenant=anon_da41...&src=invoice.unlimited_invoices.bundle`

This is a good monetisation event: it names the limit, names the price, carries the tenant so
nothing has to be migrated, carries a `src` so the click is attributable, and cross-sells the
bundle. **4 tool calls, 5,843 ms, 2 decisions from the registry row.**

### Hop 6 — `/buy/` → Stripe

```sh
curl -sS -o /dev/null -D - -A "<Chrome UA>" -H 'Accept: text/html' -H 'x-mcp-probe: 1' \
  https://mcp.zovo.one/buy/invoice
#   -> 303, location: https://checkout.stripe.com/c/pay/cs_live_a1v2bnhl...
```

Works. So does `/buy/delivery-schedule`, and `/buy/bundle`.

### The tenant is still the token — verified end to end, no payment

```sh
K=$(node scripts/sign-license.mjs invoice funnel-r1@example.com)   # real key, keys/license-private.pem
T=$(curl -sS https://mcp.zovo.one/mcp/token | jq -r .token)        # anon_f6969594799eea64645a812454342b9e
# license_status -> {"tier":"free","tenant":"anon:f696...","source":"URL path segment"}
# license_activate {key: $K} -> accepted
# license_status -> {"tier":"pro","tenant":"anon:f696..."}   <- same tenant
```

**PASS.** A verified key binds to the caller's own anonymous token, the data space is not
migrated, and nothing regressed.

One defect visible in that output, re-reported rather than fixed because it is not this
agent's file: `upgradeUrl` is `https://mcp.zovo.one/buy/invoice?tenant=anon_f696...` with
**no `?src=`** (`packages/mcp-license/src/index.ts:154`). Every in-product upgrade click that
arrives from `license_status` is unattributable.

---

## 2. The free-to-paid trigger, computed from the code

30 servers declare 60 `FREE_*` constants. These are real, offline-verified gates
(`packages/mcp-license/src/index.ts:151-208`), not decoration. A sample of the count-shaped
ones:

| server | constant | value | actions to the wall |
|---|---|---:|---:|
| invoice | `FREE_INVOICES_PER_MONTH` | 3 | 3 (**measured: 5.8 s**) |
| docx | `FREE_AGREEMENTS_PER_MONTH` | 3 | 3 |
| resume | `FREE_LETTERS_PER_MONTH` | 3 | 3 |
| amortization | `FREE_LOANS` | 3 | 3 |
| kanban | `FREE_PROJECTS` | 3 | 3 |
| price-tracker | `FREE_WATCH_LIMIT` | 3 | 3 |
| delivery-schedule | `FREE_OPEN_SCHEDULES` | 3 | 3 |
| deposits | `FREE_DEPOSITS_PER_MONTH` | 5 | 5 |
| statement-of-account | `FREE_STATEMENTS_PER_MONTH` | 5 | 5 |
| petty-cash | `FREE_FLOATS` | 1 | 1 |
| asset-register | `FREE_ASSETS` | 10 | 10 |
| barcode / zip | `FREE_PER_MONTH` | 20 | 20 |
| catalogue | `FREE_SKUS` | 25 | 25 |

**`docs/CONVERSION_R1.md` is wrong on this point and I am contradicting it with new evidence.**
It said the caps "are set where a trial user never reaches them… limits a person meets in week
three, not in the first session." Measured against the live endpoint, the invoice cap is three
actions and I met it in under six seconds. The trigger is not too far away. The reason only
3 cap clicks exist in the instrument's lifetime is that the front door does not open.

One cap was advertised wrongly. `delivery-schedule` said *"Free: 5 open schedules, 200
deliverables each"* against `FREE_OPEN_SCHEDULES = 3` and **no per-schedule cap anywhere in the
code**. A buyer would have met the wall 40% earlier than the page promised. Fixed, and a test
now checks all 29 checkable free-tier counts against the constants the servers enforce, with a
positive control that fails on the exact string this defect had.

---

## 3. Price

| | |
|---|---|
| single server | **$19**, one-time, lifetime, per server |
| sellable servers | 31 |
| all of them singly | $589 |
| bundle | **$39**, one-time, lifetime, all servers |
| saving | $550 (93.4%) |
| subscription | none |
| recurring cost to the buyer | none |

**The external comparison is unsourced and I will not assert one.** `billing/src/compare.js`
carries competitor price points ("$49 a month for 100 calls a day", "$0.25 a call",
"$4.99/month", x402 per-call figures) but cites no primary source in the code, and this round
did not re-verify any of them against a free primary source. Repeating them here would be
laundering an unsourced number through an audit. What can be said from the repo alone: the
pricing is a one-time payment with no metering, which is structurally different from every
comparison the compare pages draw, and the bundle at $39 is priced below two single servers.

---

## 4. Leak ranking

| # | Leak | Number | Fixed here |
|---|---|---|---|
| 1 | **The advertised zero-install path 401s on every tool call.** Hero of 30 `/s/` pages + 31 `/llms.txt` lines; 81 of 85 active registry rows land on an affected page. | **8 of 8** servers; **0** monetisation events reachable by that path, structurally | yes |
| 2 | **Click instrument counts crawlers.** 294 → 1,685 in 3 days (+1,391, +473%); 522 (31.0%) on 7 `store.setup.*` sources; 361 (21.4%) on the `.unknown` fallback; `clicks_7d` (1,688) already exceeds `total_clicks` (1,685). | **3 of 1,685 (0.18%)** clicks provably from a person, unchanged since 2026-09-07 | yes |
| 3 | **Every crawler following a `/buy/` link gets a live Stripe Session.** The 2026-09-09 fix required a "navigation signal" but accepted `accept: text/html`, which every crawler sends. | 2,498 Sessions / 4 days / 0 paid was the prior measurement; ≥900 already attributed to browser-shaped UAs | yes |
| 4 | 3 active registry rows → `/buy/delivery-schedule`, robots-Disallowed, 303 into Stripe with no context. | **3 of 85 (3.5%)** | no — needs a version bump + republish |
| 5 | `delivery-schedule` advertised a free tier 67% larger than the code enforces. | 1 of 31 products | yes |
| 6 | `license_status.upgradeUrl` carries no `?src=`. | every in-product upgrade click from `license_status` | no — not this agent's file |

### What I could not measure, and why

- **How many humans have ever taken the dead path.** No instrument records hosted-endpoint
  401s by referrer, and `mcp.zovo.one` has 0 search impressions. The size is bounded by the
  registry traffic nobody measures. I will not estimate it.
- **Whether an unconfounded live crawler request creates a Stripe Session.** Proving it
  directly would create the object and the click that are the defect. I proved the guard's
  behaviour instead on the dead-route branch, which records a click and never calls Stripe
  (see below), and by reading `billing/src/index.js` where `scripted` is
  `anchored-UA-test || !looksLikeNavigation` and `looksLikeNavigation` is satisfied by
  `accept: text/html`.
- **Whether any of this converts.** Zero payments remains zero payments. Nothing here is
  evidence that fixing it produces one.

---

## 5. The instrument, rebuilt so future numbers are usable

### What was wrong

`billing/src/index.js`, before:

```js
const looksLikeNavigation = /text\/html/i.test(accept) || request.headers.get("sec-fetch-mode") === "navigate";
const scripted = /^(curl|python|node|wget|go-http|undici|axios|httpie)/i.test(ua) || !looksLikeNavigation;
const probeTag = request.headers.get("x-mcp-probe") === "1" || scripted ? "1" : "";
...
if (!probeTag) ctx.waitUntil(recordClick(env, src));
```

Three defects in four lines. The UA test is **anchored to the start of the string**, so
`Mozilla/5.0 (compatible; Googlebot/2.1; …)` and `… HeadlessChrome/120 …` walk past it. The
navigation signal accepts **`accept: text/html`**, which every crawler sends — so the
"navigation" requirement excludes nothing that matters. And exclusion is **opt-out**
(`x-mcp-probe: 1`), so any agent in this repo that forgets the header is counted as demand,
which is exactly how 294 became 1,685.

### Live control, on the branch that cannot cost anything

The dead-route branch records a click and never touches Stripe, so it measures the guard with
no Stripe object created:

```sh
curl -sS -D - -o /dev/null \
  -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  -H 'Accept: text/html,application/xhtml+xml' \
  "https://mcp.zovo.one/buy/a3-nonexistent-product?src=probe.a3.googlebot"
#   -> HTTP/2 404, x-mcp-buy: unknown-product      (no probe header sent)
```

Then, 15 minutes later:

```sh
curl -sS -H 'x-mcp-probe: 1' https://mcp.zovo.one/stats/clicks
#   -> 200 in 116.98 s
#      total_clicks 1690, clicks_7d 1694, 259 sources
#      by_src["probe.a3.googlebot"] = {"total": 1, "last7d": 1}
```

**The live worker counted Googlebot as a human click.** Unconfounded: no `x-mcp-probe` header
was sent, and the 404 branch creates no Stripe object, so the only thing this request could
change is the counter — and it changed it by one, under a `src` I can identify as mine.

A second reading falls out of the same two snapshots. Between 13:35Z and 13:51Z the counter
went **1,685 → 1,690 and 257 → 259 sources**, of which exactly one click and one source are
mine. **Four further clicks and one further source arrived in 16 minutes** on a property with
no search impressions, i.e. roughly 15 counted "buyers" an hour, none of them a person.

That request also measured the endpoint: **116.98 s** to answer `/stats/clicks`.

### What it is now

```js
export function isHumanNavigation(headers) {
  if (probe) return false;
  if (BOT_UA_RE.test(ua) || TOOL_UA_RE.test(ua)) return false;          // unanchored
  return secFetchMode === "navigate" && secFetchDest === "document";     // opt-IN
}
```

- **Not start-anchored.** `BOT_UA_RE` and `TOOL_UA_RE` match a crawler or an HTTP client
  wherever the token sits, and both are exported so tests can assert on them directly.
- **Counting is opt-IN, on a signal our own agents cannot defeat by forgetting something.**
  Every top-level browser navigation since Chrome 76, Firefox 90 and Safari 16.4 sends *both*
  `sec-fetch-mode: navigate` and `sec-fetch-dest: document`. No crawler sends them. No HTTP
  library sends them unless told to, one `-H` at a time. Forging the pair takes two deliberate
  flags; forgetting a probe header takes none. That asymmetry is the whole point.
- **An untagged hit is not a click.** No live page emits a `/buy/` link without a `?src=`, so
  a request without one is bucketed `unattributed.<id>` and kept out of `total_clicks` and
  `clicks_7d`. 361 clicks (21.4%) of the v1 table were this.
- **A fresh key prefix.** v2 writes under `click:v2:`. The 1,685 contaminated v1 counters are
  still readable, under `legacy`, and are never summed into v2. `/stats/clicks` starts at a
  true zero, so the first live control is trivially provable.
- **The instrument states its own rule.** `GET /stats/clicks` now returns `instrument: 2` and
  a `counting_rule` sentence. `data/kpi.json`'s `how` field can be quoted from it instead of
  from an assumption.
- **A crawler no longer reaches Stripe at all.** `scripted` now includes the unanchored bot
  test, so a named crawler is redirected to `/s/<id>` and `createCheckout` is never called.
  A real browser still reaches Stripe: turning away a buyer costs more than a wasted object,
  which is why the *counting* predicate is stricter than the *Stripe* predicate rather than
  the same one.
- **`/stats/clicks` was a two-minute request** (a 45 s `curl` timed out on it at 257 sources)
  because it awaited one KV `get` per key. The gets in a list page now go out together.

### Control test, in the suite

`billing/test/funnel-r1.test.mjs` drives the **real request handler** against a KV that
actually stores, and differences the counter:

- one browser navigation on a tagged link → `total_clicks` moves by **exactly 1**;
- Googlebot, ClaudeBot, HeadlessChrome, a spoofed-Chrome `curl`, `curl`'s own UA,
  `python-requests`, an explicit probe, and a `fetch()`-shaped request (`sec-fetch-dest: empty`)
  → each moves it by **exactly 0**, asserted one at a time;
- the counter ends at 1.

Named crawlers are separately asserted to produce `x-mcp-buy: scripted-ua-no-session` and
**zero** Stripe calls, while a real browser still 303s to `checkout.stripe.com`.

**Is the instrument trustworthy now?** The guard is correct and covered. But no number from it
is trustworthy until it is deployed *and* a live control is run against the deployed worker —
and the v1 numbers must never be quoted at all. Post-deploy, run:

```sh
curl -s https://mcp.zovo.one/stats/clicks | jq '.instrument, .total_clicks'      # expect 2, 0
curl -s -o /dev/null -A "<Chrome UA>" -H 'Accept: text/html' \
  -H 'Sec-Fetch-Mode: navigate' -H 'Sec-Fetch-Dest: document' \
  "https://mcp.zovo.one/buy/a3-nonexistent-product?src=probe.a3.postdeploy"
curl -s https://mcp.zovo.one/stats/clicks | jq '.by_src["probe.a3.postdeploy"], .total_clicks'
#   expect {total:1,last7d:1} and 1
curl -s -o /dev/null -A "Mozilla/5.0 (compatible; Googlebot/2.1)" -H 'Accept: text/html' \
  "https://mcp.zovo.one/buy/a3-nonexistent-product?src=probe.a3.postdeploy"
curl -s https://mcp.zovo.one/stats/clicks | jq '.by_src["probe.a3.postdeploy"].total'   # expect still 1
```

---

## 6. Changes made

All in `billing/`, all reversible by reverting the file.

| file | change |
|---|---|
| `billing/src/index.js:955` | `/s/` hero leads with `/mcp/connect`, prints the `/mcp/<id>/t/<token>` shape, and states that the bare form answers every tool call with 401 |
| `billing/src/index.js:1183` + `/llms.txt` header | assistants are given the tokened URL and told never to recommend the bare form |
| `billing/src/index.js` `/buy/` guard | unanchored `BOT_UA_RE` / `TOOL_UA_RE`; a new `counted` predicate separate from `scripted`; untagged hits bucketed `unattributed.<id>` |
| `billing/src/index.js` `recordClick` / `clickStats` | `click:v2:` prefix, batched gets, `legacy` block, `instrument` and `counting_rule` fields, unattributed excluded from the headline totals |
| `billing/src/index.js` `PRODUCTS["delivery-schedule"].free` | "5 open schedules, 200 deliverables each" → "3 open schedules" |
| `billing/src/index.js` `VALIDATION` / `BILLING_TEST_COUNT` | refreshed against `data/validation.json` (2026-09-10, 951/951, 32 servers, 469 ms median) and the tests on disk (114) |
| `billing/test/funnel-r1.test.mjs` | **new**, 7 tests |
| `billing/test/checkout-r1.test.mjs`, `billing/test/clicks.test.mjs` | updated to the v2 contract; the `buy()` helper now sends the Fetch Metadata a browser sends |

`billing/` tests: **114 of 114 pass** (was 107 declared / 102 pass / 5 fail; the 5 were 3 from
this change plus 2 pre-existing — `VALIDATION.at` was stale after another agent regenerated
`data/validation.json` today, and `BILLING_TEST_COUNT` was one deploy behind).
`node remote/build-vendor.mjs` still exits cleanly; no tool description was touched.

One later failure is **not** from this change and is a live cross-agent race: at 20:53 today
another agent added an untracked `servers/packing-list/`, which makes
`checkout.test.mjs:32` fail with "PRODUCTS sells 31 servers, servers/ ships 32". Adding a
`PRODUCTS` row would mint a checkout for a product with no page, so that belongs to the
catalogue owner, not here. With `servers/packing-list/` absent, `billing/` is 114 of 114.

## 7. What needs deploying

1. **`cd billing && wrangler deploy`** — carries leaks 1, 2, 3 and 5. Then run the post-deploy
   control above. Note `/stats/clicks` will read `total_clicks: 0`: that is the v2 instrument
   starting clean, not data loss; the old numbers are under `legacy`.
2. **`servers/delivery-schedule` version bump + registry republish** for the 3 rows still on
   `/buy/delivery-schedule`. The manifests are already correct; the registry rejects a
   duplicate version, so the fix cannot land without a new version.
3. **`packages/mcp-license/src/index.ts:154`** — one line, another owner:
   `` `${CHECKOUT_BASE}/buy/${product}?src=product.${product}.status` ``.

Recommended, not done, not my file: return the hosted 401 as a **JSON-RPC error object** so the
remediation text in that body reaches the user instead of dying as a transport error
(`remote/src/index.ts`); and serve `/.well-known/oauth-protected-resource` so a spec-following
client has somewhere to go after the `WWW-Authenticate` challenge.

---

## 8. Second pass (same loop), after the orchestrator's review

### 8.1 The `/bundle` hero test — the code and the test now agree, deliberately

The orchestrator reported `test/bundle.test.mjs:68` ("the home hero links to /bundle") failing
against my hero rewrite. **It is not that test and it was not that link.** My hero change is on
the `/s/` product page (`billing/src/index.js:955`); the home hero is a different string and
still carries the link:

```sh
/usr/bin/grep -c '<a href="/bundle">/bundle</a>' src/index.js      # 1, before and after
node --test test/bundle.test.mjs                                    # 8 of 8, "the home hero links to /bundle" ok
```

The failure the orchestrator hit was `bundle.test.mjs:56`, **caused by the sitemap edit in
§8.3, not by the hero**: that assertion matched the *literal ordering* of the sitemap's `urls`
array (`/\["\/", "\/bundle", "\/changelog", …/`), so inserting `/mcp/connect` after `"/"` broke
it while `/bundle` was still perfectly well covered. A test that fails when a page is *added*
to the sitemap is measuring the wrong thing. It now reads the **rendered** sitemap and asserts
`<loc>https://mcp.zovo.one/bundle</loc>` is in it — which cannot be broken by reordering, and
cannot pass while the entry is genuinely missing. Nothing was deleted; the assertion got
stronger.

**The orchestrator's underlying point was right, and I acted on it.** The product-page hero is
now longer than the line it replaced, and the only bundle cross-sell on an `/s/` page sits
several thousand words down inside the generated body. So `/s/<id>` gained a `/bundle` link in
its nav line, beside Buy Pro:

> All servers · **Buy Pro $19** · **All 31 for $39** · Source

with a test (`the product page keeps the price comparison above the fold`) that asserts it is
in the markup *before* the hero, names the bundle price, and that the server's own Buy link
survives. The price comparison is the reason anyone buys the set, and it is now reachable
without scrolling on all 30 pages the registry sends people to.

**Unrelated, and not my file:** the in-body cross-sell on `/s/` reads *"Or the nineteen-server
bundle for $39"*. There are 31. One literal in `billing/src/content.js` (`grep -c nineteen` →
4 in that file). The agent building `billing/src/figures.js` this loop is fixing exactly this
class of number; handing it over rather than editing their file mid-flight.

### 8.2 The 401 body now says where to *get* a token

The orchestrator is right that this is the last line of defence, and right about what was
missing — with one correction: the body **did** name `/mcp/connect`, three times
(`options[0].how`, the top-level `connect` field, and the guide). But **`message` did not**,
and `message` is the only field that reaches a person. An MCP client does not render this
JSON; it shows a tool or transport error, and whatever text surfaces comes from the top of the
payload. The old string said where to **put** a token and never where to **get** one, so all
three mentions were nested where nothing surfaces them.

Before (`remote/src/index.ts:680`):

> This endpoint needs a token. Put it in the Authorization header, or in the URL if your client cannot set headers.

After:

> This endpoint needs a token and it is free. Open https://mcp.zovo.one/mcp/connect in a
> browser: it mints one and prints a ready URL, `https://mcp.zovo.one/mcp/invoice/t/<token>`,
> which you can paste straight into a client that cannot set headers. Or GET
> https://mcp.zovo.one/mcp/token and send it as `Authorization: Bearer <token>`. The bare
> https://mcp.zovo.one/mcp/invoice answers initialize and tools/list without a token and then
> refuses every tool call, which is what just happened.

The last sentence is the one that matters most: "it connected, it listed 14 tools, and now
nothing works" is the symptom, and nothing in the old body explained it. The body was
extracted into an exported pure `unauthorizedBody(product)`; every machine-readable field is
unchanged, asserted field by field. 5 new tests in `remote/test/unauthorized-body.test.mjs`,
including one that fails if a second copy of the body ever appears in the file.

### 8.3 `/mcp/connect` in the sitemap — and the defect that had to be fixed first

The orchestrator's instinct was correct and the defect is real. **`GET /mcp/connect` minted a
token on every single request**, and so did `HEAD`.

```sh
# two consecutive GETs, Googlebot User-Agent, no browser headers, against the LIVE worker
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
     -H 'Accept: text/html' https://mcp.zovo.one/mcp/connect | grep -o 'anon_[0-9a-f]\{32\}' | head -1
#   -> anon_ed048209a21b944a2e0bacf4b987f45d
#   -> anon_ce88d47cd88eb0f23dcdc34bacbe1b53      (second call, different token)

curl -sI -A "Mozilla/5.0 (compatible; Googlebot/2.1)" https://mcp.zovo.one/mcp/connect   # 200
```

Two crawler fetches, two tenants. Per fetch that is **1 KV read + 2 KV writes**
(`mint:<ip>:<hour>` read, `mint:` write, `tok:<token>` write) and the `tok:` key holds a data
space for **`ANON_TTL` = 30 days** (`remote/src/index.ts:51`, `:1630-1648`).

The cost is not the writes. It is the rate limit. `TOKEN_MINTS_PER_IP = 10` per IP per hour
(`remote/src/index.ts:75`), and the 11th mint returns **HTTP 429**. So on the current code, a
NAT, a VPN exit or an office proxy that generates eleven page loads in an hour — which one
crawler does on its own — takes **the entry point to the entire free tier off the air for
everyone behind that address**. Listing the page in a sitemap, having just made it the hero
destination of 30 product pages and every `/llms.txt` line, would have pointed the crawlers
straight at it. **Adding the sitemap entry without this fix would have been the wrong trade.**

Fixed in `remote/src/index.ts`. A token is minted only for a request that is a person opening
the page — the same Fetch Metadata fingerprint the click instrument now uses
(`sec-fetch-mode: navigate` + `sec-fetch-dest: document`, unanchored bot/tool UA denylist) —
or for an explicit `?mint=1`. A prefetch (`sec-purpose: prefetch`) is excluded too: a prefetch
throws the response away, so a token minted for one is a data space the reader never asked for
and will never see. `HEAD` never mints and now returns the same headers with no body, so it
matches the GET it describes.

Everything else gets **the same page**, complete and indexable, with `<token>` where the token
goes, an explanation of why, and one **Get my free token** button to `/mcp/connect?mint=1`. A
browser that strips Fetch Metadata costs its user one click; getting it wrong the other way
costs a 30-day tenant per robot and a 429 for everyone behind a shared address.

6 new tests in `remote/test/connect-mint.test.mjs`: three real browser UAs still mint with no
extra click; seven crawler and library UAs do not, **even when they forge the entire navigation
fingerprint**; a fetch, an empty UA and a prefetch do not; the route mints only on GET with a
navigation or `?mint=1`; the `?token=` reuse path is intact; and the tokenless page is still a
complete page with exactly one link that mints.

**Then** the sitemap entry, in the billing generator (`billing/src/index.js:1166`):

```
before:  curl -s https://mcp.zovo.one/sitemap.xml | grep -c '<loc>'          -> 154
         curl -s https://mcp.zovo.one/sitemap.xml | grep -c 'mcp/connect'    -> 0
after (rendered locally):                                          164 <loc>, /mcp/connect present
```

**robots.txt needs no change, checked rather than assumed.** It is `User-agent: *`, `Allow: /`,
and Disallows only `/buy/`, `/success`, `/recover`, `/verify`, `/bound` — every one a private
per-buyer path. `/mcp/connect` matches none of them, and a test now asserts that no `Disallow:`
line is a prefix of `/mcp/connect`, so a future broad rule cannot silently block it.

**The other pages promoted this pass were already covered**: all 30 `/s/<id>` pages are in the
sitemap (asserted for three of them in the same test), and `/llms.txt` is not a page.

### 8.4 Suite state

```sh
cd billing && npm test    # 131 of 132
cd remote  && npm test    # 56 of 56
```

The single billing failure is `checkout.test.mjs:32`, *"PRODUCTS sells 31 servers, servers/
ships 32"*, from another agent's untracked `servers/packing-list/`. Left alone as instructed.
Everything else is green.

Note the counts moved under me: another agent added `billing/src/figures.js` and its tests to
the same file while I worked, so `BILLING_TEST_COUNT` is now 123 and the totals above are not
the 114 in §6. `BILLING_TEST_COUNT` is a shared constant two agents are both bumping this
loop; if it is stale at deploy time it is a one-number edit, not a defect.

### 8.5 Additions to what needs deploying

`remote/` now needs a deploy too, and it carries the two fixes above. Deploy order does not
matter for correctness, but **deploy `remote/` before or with `billing/`**: the billing sitemap
starts advertising `/mcp/connect` to crawlers, and the mint guard that makes that safe lives in
`remote/`.

Post-deploy control for the connect fix:

```sh
# a crawler must get the page and no token
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" -H 'Accept: text/html' \
  https://mcp.zovo.one/mcp/connect | grep -c 'anon_[0-9a-f]\{32\}'          # expect 0
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" -H 'Accept: text/html' \
  https://mcp.zovo.one/mcp/connect | grep -c 'Get my free token'            # expect 1
# an explicit mint must still work
curl -s "https://mcp.zovo.one/mcp/connect?mint=1" | grep -o 'anon_[0-9a-f]\{32\}' | head -1
# and the 401 must now name where to get one
curl -s -X POST https://mcp.zovo.one/mcp/invoice \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"license_status","arguments":{}}}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["message"])'
#   expect the message itself to contain https://mcp.zovo.one/mcp/connect
```
