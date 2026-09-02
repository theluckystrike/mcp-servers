# mcp-price-tracker

Ask your assistant what something costs right now. Point it at any product page and it reads the price off the page, remembers it, and tells you next time whether the price moved, how far, and whether it reached the number you were waiting for. It works on ordinary shop pages by reading the structured data most stores already publish (JSON-LD, Open Graph, microdata) and falling back to the visible price when they do not. When a large retailer blocks automated requests it says so plainly and lets you record the price yourself so the history stays intact. Everything is stored in a JSON file on your own machine.

Built by [theluckystrike](https://github.com/theluckystrike).

## Install

Claude Desktop (`claude_desktop_config.json`):

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

Claude Code:

```sh
claude mcp add price-tracker -- npx -y @theluckystrike/mcp-price-tracker
```

Cursor (`.cursor/mcp.json`):

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

To run Pro, add `"env": { "MCP_LICENSE_KEY": "MCPL1...." }` to the entry, or call `license_activate` once.

## Tools

| Tool | What it does |
| --- | --- |
| `price_check` | Fetch a page now; returns price, currency, title and the change against the last stored observation for that URL. No watch needed. |
| `watch_add` | Start tracking a URL. Stores the first observation. Optional `label`, `target_price`, `currency`. |
| `watch_list` | Every watch with current price, min, max, change and target. |
| `watch_remove` | Stop tracking, by `id` or `url`. |
| `watch_refresh` | Re-fetch one watch (`id`) or all of them (`all: true`); appends observations and returns current, previous, min, max, change % and target-hit flags. |
| `price_history` | Stored observations for one watch, oldest first, optional `limit`. |
| `price_add_manual` | Record a price you read yourself, for shops that block bots. Creates the watch if needed. |
| `alerts_pending` | Watches whose latest price is at or below target, or which dropped 5% or more since the previous observation. |
| `license_status` | Free or Pro, and where to upgrade. |
| `license_activate` | Activate a Pro key. Verified offline. |

Resource: `prices://watches` - JSON of every watch with its latest price.

## Free vs Pro

| | Free | Pro ($19 one-time) |
| --- | --- | --- |
| `price_check` | Unlimited | Unlimited |
| Watches | 3 | Unlimited |
| History per watch | Last 10 observations | Full history |
| `watch_refresh` one item | Yes | Yes |
| `watch_refresh` all at once | No | Yes |
| `alerts_pending` | No | Yes |
| `price_add_manual` | Yes | Yes |

[Get Pro](https://mcp.zovo.one/buy/price-tracker) - $19 for this server, $39 for [every server, lifetime](https://mcp.zovo.one/buy/bundle).

## How prices are read

In order: JSON-LD `Product`/`Offer` (`price`, `priceCurrency`, `lowPrice`), microdata `itemprop="price"`, Open Graph `og:price:amount` / `product:price:amount`, `meta itemprop`, `data-price` attributes, common price class and id hints (including Amazon's `a-offscreen`), and finally a regex over the visible text of the first 200 KB. European and US separators are both understood, so `1.299,00 EUR` and `1,299.00 USD` both become `1299.00`.

Prices are stored as decimal strings in the major unit with a `.` decimal separator and no grouping, for example `"1299.00"`. Timestamps are ISO 8601 UTC.

Pages are fetched with a desktop browser User-Agent, a 12 second timeout, redirects followed, and a 2 MB body cap.

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/price-tracker/watches.json`. The only network requests are to the product pages you name. License keys verify offline; nothing is sent anywhere.

MIT licensed.
