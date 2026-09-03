# mcp-price-tracker

Ask your assistant what something costs right now. Point it at any product page and it reads the price off the page, remembers it, and tells you next time whether the price moved, how far, and whether it reached the number you were waiting for. It works on ordinary shop pages by reading the structured data most stores already publish (JSON-LD, Open Graph, microdata) and falling back to the visible price when they do not. When a large retailer blocks automated requests it says so plainly and lets you record the price yourself so the history stays intact. Everything is stored in a JSON file on your own machine.

Built by [theluckystrike](https://github.com/theluckystrike).

![price-tracker demo](../../assets/demo-price-tracker.gif)

**Watch any product page for price drops from chat -- no scraping service, no account, all local.**

## 60-second install

npm publish for `@theluckystrike/mcp-price-tracker` is pending. Until then, the `.mcpb` one-click bundle or a clone+build
is the working path -- both are verified below.

**One-click (.mcpb):** download `price-tracker.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "price-tracker": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-price-tracker"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add price-tracker -- npx -y @theluckystrike/mcp-price-tracker
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "price-tracker": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-price-tracker"]
    }
  }
}
```

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these three commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/price-tracker
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/price-tracker/dist/index.js`.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Tools

| Tool | What it does |
| --- | --- |
| `price_check` | Fetch a page now; returns price, currency, title, extraction confidence and the change against the last stored observation for that URL. No watch needed. |
| `watch_add` | Start tracking a URL. Stores the first observation. Optional `label`, `target_price`, `currency`. |
| `watch_list` | Every watch with current price, min, max, change, target, confidence and source. |
| `watch_remove` | Stop tracking, by `id` or `url`. |
| `watch_refresh` | Re-fetch one watch (`id`) or all of them (`all: true`); appends observations and returns current, previous, min, max, change % and target-hit flags. This is the only thing that checks prices. |
| `price_history` | Stored observations for one watch, oldest first, optional `limit`. |
| `price_add_manual` | Record a price you read yourself, for shops that block bots. Creates the watch if needed. |
| `alerts_pending` | Watches whose latest price is at or below target, or which dropped 5% or more since the previous observation. Free. |
| `license_status` | Free or Pro, and where to upgrade. |
| `license_activate` | Activate a Pro key. Verified offline. |

Resource: `prices://watches` - JSON of every watch with its latest price.

Prompt: `check_prices` - refreshes every watch and summarises the drops and target hits in one command.

## What you can say

| You say | Tool |
| --- | --- |
| "What does this cost right now: \<url\>?" | `price_check` |
| "Watch that page and alert me if it goes under 40." | `watch_add` |
| "Show me everything I'm watching and whether anything dropped." | `watch_refresh` (all) then `watch_list` |
| "Stop tracking that laptop, I bought it elsewhere." | `watch_remove` |
| "Refresh my watches." | `watch_refresh` |
| "What's the price history on the bookshelf I'm watching?" | `price_history` |
| "I checked myself, it's 39.99 GBP in-store, log that." | `price_add_manual` |
| "Has anything I'm watching hit its target or dropped a lot?" | `alerts_pending` |
| "Am I on the free plan or Pro?" | `license_status` |
| "Here's my license key, activate it." | `license_activate` |

## Worked example

A real run against `books.toscrape.com`, from `docs/USER_VALUE_R2.md`, with `WebFetch`/`WebSearch`
disallowed so the price-tracker's own tools had to answer:

```
You: What does this cost right now: https://books.toscrape.com/catalogue/...?

  price_check { url: "https://books.toscrape.com/catalogue/..." }
  -> price 51.77, currency GBP, source regex-fallback, confidence low

Assistant: GBP 51.77. Confidence: low (regex-fallback) -- this page has no
structured price data, so I read it from the visible text.
```

The confidence label is not decoration: `books.toscrape.com` carries no JSON-LD or microdata, so this is
the one case in testing where the regex fallback was the only path to a number, and the model relayed the
"low" label to the user unprompted rather than stating 51.77 as a fact.

## Alerts: nothing runs in the background

There is no scheduler and no daemon. A watch is a stored history, not a subscription: prices are re-read only when `watch_refresh` runs, and `alerts_pending` reports on what is already stored. The working pattern is to say **"refresh my watches"** at the start of a session (or run the `check_prices` prompt), then ask what dropped.

## Free vs Pro

| | Free | Pro ($19 one-time) |
| --- | --- | --- |
| `price_check` | Unlimited | Unlimited |
| `alerts_pending` | Yes, unlimited | Yes, unlimited |
| Watches | 3 | Unlimited |
| History per watch | Last 30 observations | Full history |
| `watch_refresh` one item | Yes | Yes |
| `watch_refresh` all at once | No | Yes |
| `price_add_manual` | Yes | Yes |
| Redirect check and extraction confidence | Yes | Yes |

[Get Pro](https://mcp.zovo.one/buy/price-tracker) - $19 for this server, $39 for [every server, lifetime](https://mcp.zovo.one/buy/bundle).

## How prices are read

In order: JSON-LD `Product`/`Offer` (`price`, `priceCurrency`, `lowPrice`), microdata `itemprop="price"`, Open Graph `og:price:amount` / `product:price:amount`, `meta itemprop`, `data-price` attributes, common price class and id hints (including Amazon's `a-offscreen`), and finally a regex over the visible text of the first 200 KB. European and US separators are both understood, so `1.299,00 EUR` and `1,299.00 USD` both become `1299.00`.

Prices are stored as decimal strings in the major unit with a `.` decimal separator and no grouping, for example `"1299.00"`. Timestamps are ISO 8601 UTC.

Every reading carries a **confidence**: `high` for JSON-LD, microdata, `meta itemprop` and Open Graph; `medium` for `data-price` attributes and price class or id hints; `low` for the regex fallback. A `low` reading on a page with no product title is reported but never stored.

Where a page describes several products in JSON-LD (recommendations, "customers also bought"), the offers of one product are never pooled with another's: the product whose name matches the page title wins, otherwise the first product carrying offers. Crossed-out and previous prices (`<s>`, `<del>`, `<strike>`, and classes such as `old-price`, `was`, `compare-at-price`, `list-price`, `rrp`) are skipped, so a struck 199 next to a live 99 reports 99. An ISO code written next to the number ("$10 USD") wins over the currency guessed from the domain, and `twitter:data1` - free text such as "Free shipping over $50" - is not read as a price.

Pages are fetched with a desktop browser User-Agent, a 12 second timeout, redirects followed, and a 2 MB body cap. After the fetch the final URL is compared with the one you asked for: if the shop redirected off the product path - a different path depth, a category or home page, or a generic title such as "Products", "Home", the shop name alone, or "not found" - you get `the shop redirected to <finalUrl>, which is not a product page` instead of the cheapest item on the listing it landed on. A redirect that only inserts a canonical slug in front of the same product id or path (Newegg, Amazon `/dp/`, Zalando-style URLs) is accepted, not refused.

## How it stores data

Watches and their price history live in one JSON file:
`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/price-tracker/watches.json`. Every mutation (`watch_add`,
`watch_remove`, `watch_refresh`, `price_add_manual`) happens under an advisory lock file,
`.../price-tracker/.lock`, held across the load-mutate-save cycle so two refreshes running at once cannot
interleave. `price_check` and read-only tools do not need the lock. Saves write to a temporary file and
rename it into place, so an interrupted write cannot leave a half-written file. To back up your watch
history, copy `watches.json`.

Only a missing file counts as "no watches yet". If `watches.json` exists but cannot be read or parsed, the
server never treats it as empty: the unreadable bytes are moved to `watches.json.corrupt-<timestamp>`, the
fault is written to stderr, and every tool answers with an error naming that file until the server is
restarted. A damaged database can therefore never be silently overwritten by the next price you record.

## Limits and honest caveats

- **Real-world extraction success is roughly 5 of 12** on a mixed sample of major retailers: five sites
  returned an outright bot-wall 403 (H&M, Allegro, MediaMarkt, Home Depot, Etsy), one timed out (Best
  Buy), and the rest split between correct prices and one intentionally refused reading (a redirect off
  the product page). This is a property of the open web, not a bug the server can fix -- there is no
  headless browser or CAPTCHA solver here, by design (no native deps, no paid API). `price_add_manual`
  is the working answer for a blocked shop.
- **There is no background job.** Nothing checks prices unless you (or your client, via a scheduled
  script you run yourself) call `watch_refresh`. This is not a missing feature; a local stdio server has
  no business running a daemon on your machine.
- Free tier caps watches at 3 and history at the last 30 observations per watch; `price_check` and
  `alerts_pending` are unlimited on free.
- A `low`-confidence regex reading is still reported, but never silently treated as certain -- pass it on
  to the user as an estimate, not a fact.

## Troubleshooting

- **`npx` hangs or fails to find the package**: npm publish for this package is pending. Use the `.mcpb`
  bundle or the clone-and-build path above until it lands.
- **Using the `.mcpb` bundle**: it installs into Claude Desktop directly; there is no separate config
  step.
- **Using the clone path**: the server binary is `servers/price-tracker/dist/index.js` after
  `npm run build`. Point your client's `command` at `node` with that absolute path as the only argument.
- **Node version**: requires Node >= 18. Check with `node -v`.
- **A watch always errors "not a product page"**: the shop redirected you off the URL you gave it (a
  category page, home page, or a generic title). Fetch the exact product URL again from the shop and
  re-add the watch, or use `price_add_manual` if the shop keeps redirecting.
- **A shop returns 403 every time**: it is blocking automated requests. This is expected for a subset of
  large retailers (see Limits above); use `price_add_manual`.
- **Nothing shows up / silent failures**: logs go to stderr only, never stdout. In Claude Desktop check
  Settings -> Developer -> the server's log file; in Claude Code check the terminal or `--mcp-debug`.

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/price-tracker/watches.json`. The only network requests are to the product pages you name. License keys verify offline; nothing is sent anywhere.

## Pairs with

- [mcp-invoice](../invoice/README.md) -- bill a client for something you bought after tracking its price.
- [mcp-spreadsheet](../spreadsheet/README.md) -- export `price_history` and analyze it as a sheet.
- [mcp-time-tracker](../time-tracker/README.md) -- track the hours you spend shopping around, if that is somehow billable.
- [office-suite](../office-suite/README.md) -- all four servers behind one install, one config entry.
- Guide: [Watch a product price with Claude and get told when it drops](https://mcp.zovo.one/guides/price-drop-alerts-with-claude)

## FAQ

**Why didn't it check the price automatically overnight?**
There is no scheduler in this server. Prices are only re-read when `watch_refresh` runs, which happens
when you ask for it (or when a cron/launchd job you set up yourself calls it).

**Why does it refuse to give me a price on some pages?**
Either the shop returned a bot-wall response (403) or the request redirected off the product page onto a
listing, category or home page. Both are reported honestly instead of returning a wrong number; use
`price_add_manual` to keep the history going by hand.

**What does "confidence: low" mean?**
The price came from a text-pattern fallback rather than the page's own structured data (JSON-LD,
microdata, Open Graph). It is usually right but has not been verified against a machine-readable field.

**Can I track a price in a currency different from what the page shows?**
`watch_add` and `price_add_manual` accept an explicit `currency`, but the number you store should match
what you actually read -- the server does not convert currencies.

**Does it ever send my watch list anywhere?**
No. The only outbound requests are to the product URLs you add, to fetch their pages. There is no
telemetry and no account.

MIT licensed.
