# mcp-time-tracker

Track billable time without leaving your AI chat. Say "start a timer on the acme redesign", keep working, then
ask for "my hours this week by project" or "invoice lines for acme in August". It keeps a running timer, lets you
log time you forgot to track, applies your hourly rate per project, and turns the result into a report, a CSV file
or a set of invoice line items. Everything is stored as plain JSON on your own machine.

Built by [theluckystrike](https://github.com/theluckystrike).

## Install

Claude Code:

```sh
claude mcp add time-tracker -- npx -y @theluckystrike/mcp-time-tracker
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "time-tracker": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-time-tracker"]
    }
  }
}
```

Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "time-tracker": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-time-tracker"]
    }
  }
}
```

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Tools

| Tool | What it does |
| --- | --- |
| `timer_start` | Start a timer on a project (optional task, tags, rate). Starting a new one stops and logs the old one. |
| `timer_stop` | Stop the running timer, write the entry, return the duration. |
| `timer_status` | What is running, for how long, and today's total. |
| `entry_add` | Log time you already worked (start plus end or minutes). |
| `entry_list` | Compact table of entries, filtered by date range and project. |
| `entry_edit` | Change any field of an entry. |
| `entry_delete` | Delete an entry by id. |
| `project_set_rate` | Set the hourly rate and currency used for money totals. |
| `report` | Hours and money for a period, grouped by project, day, task or tag; table, JSON or CSV. |
| `export_csv` | Write entries to a CSV file and return the path. |
| `invoice_summary` | Invoice-ready line items for one project: hours, rate, amount, total. |
| `license_status` | Free or Pro, and where to upgrade. |
| `license_activate` | Activate a Pro key (verified offline). |

Also exposed: the resource `timetracker://today` (today's summary) and the prompt `daily_standup`
(writes a standup update from yesterday's and today's tracked time).

## Free vs Pro

| | Free | Pro ($19 one-time) |
| --- | --- | --- |
| Timers and entries | Unlimited | Unlimited |
| `entry_list` / `report` range | Last 7 days | All history |
| Projects with an hourly rate | 2 | Unlimited |
| CSV export | Last 7 days | All history |
| `report` grouped by tag | - | Yes |
| `invoice_summary` | - | Yes |

Get Pro: https://mcp.zovo.one/buy/time-tracker ($19 for this server, $39 for every server, lifetime).
Keys are Ed25519 signed and verified offline.

## Privacy

All data stays local: entries live in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/time-tracker/data.json`.
The server makes no network requests, has no telemetry, and needs no account.

## License

MIT
