# mcp-maintenance-log

An mcp maintenance log for the workshop, the rental flats, the van fleet or the studio: one local register of every piece of equipment you look after, and the work that has been done on it. Add each asset once -- name, serial or asset tag, where it lives -- then log each service or repair as it happens: the date, what was done, what it cost in cents, who did it, and when the next service falls due, either as a date or as an interval in days. Ask what is due and the report answers what is overdue and what comes up in the next N days, computed from the stored dates at the moment you ask, so it can never go stale. Per-asset history keeps the chronological log with its total spend, and export hands the record over as CSV for a spreadsheet or a Markdown summary per asset. Everything stays on this machine; there is no account and no network call.

Built by theluckystrike.

npm publish for `@theluckystrike/mcp-maintenance-log` is pending, so `npx -y @theluckystrike/mcp-maintenance-log` returns 404 today. Until then, a clone+build is the working path.

## Install

### Claude Desktop

macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maintenance-log": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-maintenance-log"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add maintenance-log -- npx -y @theluckystrike/mcp-maintenance-log
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), same entry as Claude Desktop.

## Tools

| tool | what it does |
| --- | --- |
| `asset_add` | Add an asset: name, serial or asset tag, location, notes, currency. Returns `AST-YYYY-NNNN`. A duplicate tag is refused |
| `maintenance_log` | Log work on an asset: the day, what was done, cost in cents, technician, and the next due date -- as `next_due` or as `interval_days`, never both |
| `maintenance_due` | The due report: what is overdue and by how many days, what falls due within N days (default 30), what is scheduled later, what has no schedule. Pro |
| `asset_history` | One asset in full: every entry in chronological order, total spend in integer cents, spend per technician, the schedule it currently lives under |
| `maintenance_export` | Entries in a date range as CSV (free) or a Markdown summary per asset (Pro) |
| `asset_remove` | Remove an asset. One carrying a log is refused unless `confirm: true`, naming what would be lost. The AST number is never reissued |
| `license_status` / `license_activate` | Free or Pro, and the key |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Assets on the register | 3 | Unlimited |
| Logging work, cost and technician | Yes | Yes |
| Per-asset history and total spend | Yes | Yes |
| CSV export of a date range | Yes | Yes |
| Due report: overdue and due-within-N-days | -- | Yes |
| Markdown summary per asset | -- | Yes |

The record is never metered. Three assets with full logging and CSV export is a real working register for a one-machine shop, and nothing you have logged is ever held back. What Pro lifts is how many assets are on the register, and adds the due report and the Markdown summaries.

**Get Pro:** https://mcp.zovo.one/buy/maintenance-log -- $19 one-time for this server, or $39 for the bundle.

## Dates and money

Every date is stored as ISO 8601 (`YYYY-MM-DD`). Whether a service is overdue is computed from today's date at call time, never stored, so the register cannot go stale. An interval is turned into a date once, when the work is logged: the work date plus the interval, in whole days, in UTC so the answer does not depend on the server's timezone. Every cost is an integer number of cents in the asset's own currency (1200 is 12.00), stored on the entry; a total spend is the sum of the stored entries, so it can never drift from the lines it is made of.

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/maintenance-log/`. Two files: `assets.json`, `counter.json`. Nothing is sent anywhere, there is no account, no API key and no network call in this server at all. License keys are verified offline.

Built by theluckystrike. https://github.com/theluckystrike
