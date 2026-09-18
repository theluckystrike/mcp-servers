# mcp-mileage-log

[![theluckystrike/mcp-mileage-log MCP server](https://glama.ai/mcp/servers/theluckystrike/mcp-mileage-log/badges/score.svg)](https://glama.ai/mcp/servers/theluckystrike/mcp-mileage-log)

**In the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.theluckystrike%2Fmileage-log/versions/latest)** (`io.github.theluckystrike/mileage-log`).
An **mcp mileage** tracker that keeps the mileage log freelancers need at tax time, the moment the drive happens instead of reconstructed from memory in April. Log each trip with the date, from and to, the distance in miles or km, the purpose and the category (business, medical, moving, charitable, personal); set the rates that apply to you as an effective-dated series per jurisdiction and category; and the summary prices every trip at the rate in force on the day it was driven, per category and per currency. When the log is right, one call exports it as CSV to hand to your accountant. Everything stays on this machine; there is no account and no network call.

Built by theluckystrike.

npm publish for `@theluckystrike/mcp-mileage-log` is pending, so `npx -y @theluckystrike/mcp-mileage-log` returns 404 today. Until then, a clone+build is the working path.

## Install

### Claude Desktop

macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mileage-log": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-mileage-log"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add mileage-log -- npx -y @theluckystrike/mcp-mileage-log
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), same entry as Claude Desktop.

## Tools

| tool | what it does |
| --- | --- |
| `trip_add` | Log one trip: date, from, to, distance in miles or km, purpose, category. Returns `TR-YYYY-NNNN` |
| `trip_list` | List trips oldest first, with the rate and amount each earns; filter by date range and category |
| `trip_remove` | Remove a trip by its exact id, for entries made by mistake. The id is not reissued |
| `rate_set` | Set what one mile or km is worth for one category in one jurisdiction from a date forward. A series, not one global number |
| `rate_list` | Every rate on file, grouped by jurisdiction and category with effective dates in order |
| `mileage_summary` | A date range (default the current year): per-category distance, the rate each trip earned, and the deductible amount, per currency |
| `mileage_export` | The log as CSV for an accountant: date, from, to, distance, category, rate, amount. Pro |
| `license_status` / `license_activate` | Free or Pro, and the key |

## Rates are a series, and none ship with the server

Tax authorities change their mileage rates, usually every year, so this server never holds one global rate: `rate_set` adds a rate for a jurisdiction, a category and a unit from an effective date, and each trip earns the rate in force on its own day. **No rates ship with this server, and the example below is an EXAMPLE, not a statement of current law.** Verify the figures that apply to you before you file.

An example rate set (illustrative only):

```text
rate_set jurisdiction:"US federal (EXAMPLE)" category:business    rate:0.70  unit:miles currency:USD effective_from:2026-01-01
rate_set jurisdiction:"US federal (EXAMPLE)" category:business    rate:0.655 unit:miles currency:USD effective_from:2025-01-01
rate_set jurisdiction:"US federal (EXAMPLE)" category:medical     rate:0.21  unit:miles currency:USD effective_from:2026-01-01
rate_set jurisdiction:"US federal (EXAMPLE)" category:charitable  rate:0.14  unit:miles currency:USD effective_from:2026-01-01
```

A 2025 trip then prices at 0.655 and a 2026 trip at 0.70, automatically. If your trips are in km and your rate is per mile (or the other way around), the distance is converted with the exact factor (1 mile = 1.609344 km) before pricing.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Trips per calendar month | 20 | Unlimited |
| Trip list and mileage summary | Yes | Yes |
| Rates per jurisdiction and category | 1 (overwrite stays free) | Unlimited series |
| CSV export for the accountant | No | Yes |

The monthly cap is counted on the month of the trip date, so reconstructing last year's log at tax time does not consume this month's allowance. The log itself is never metered: reading, listing and summarizing stay free for good.

**Get Pro:** https://mcp.zovo.one/buy/mileage-log -- $19 one-time for this server, or $39 for the bundle.

## Money and rounding

A trip's deductible amount is its distance times the effective rate, rounded **half-up to the cent** per trip, and every total is the sum of those rounded per-trip amounts: a total can never drift from the lines it is made of, and the CSV export reconciles line by line with the summary. The arithmetic is integer-only (distances as thousandths of a unit, rates as thousandths of a currency unit), so 12.5 miles at 0.70 a mile is exactly 875 cents, never 874.99999. Miles and km are kept apart and never added together; amounts are kept per currency and never mixed. When a trip's unit differs from the rate's, the distance is converted first (1 mile = 1.609344 km exactly) and rounded half-up to the thousandth of the rate's unit, then priced.

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/mileage-log/`. Three files: `trips.json`, `rates.json`, `counter.json`. Nothing is sent anywhere, there is no account, no API key and no network call in this server at all. License keys are verified offline. Nothing this server computes is tax advice; the rates you enter are your own figures to verify.

Built by theluckystrike. https://github.com/theluckystrike
