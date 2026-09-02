# mcp-time-tracker

Track billable time without leaving your AI chat. Say "start a timer on the acme redesign", keep working, then
ask for "my hours this week by project" or "invoice lines for acme in August". It keeps a running timer, lets you
log time you forgot to track, applies your hourly rate per project, and turns the result into a report, a CSV file
or a set of invoice line items. Everything is stored as plain JSON on your own machine.

Built by [theluckystrike](https://github.com/theluckystrike).

![time-tracker demo](../../assets/demo-time-tracker.gif)

**Track billable time from chat and turn it straight into a report or invoice line items -- zero setup, all local.**

## 60-second install

npm publish for `@theluckystrike/mcp-time-tracker` is pending. Until then, the `.mcpb` one-click bundle or a clone+build
is the working path -- both are verified below.

**One-click (.mcpb):** download `time-tracker.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

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

**Claude Code:**

```sh
claude mcp add time-tracker -- npx -y @theluckystrike/mcp-time-tracker
```

**Cursor** (`.cursor/mcp.json`):

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

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these three commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/time-tracker
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/time-tracker/dist/index.js`.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Tools

| Tool | What it does |
| --- | --- |
| `timer_start` | Start a timer on a project (optional task, tags, rate, currency). Starting a new one stops and logs the old one. A partial project name that matches exactly one existing project is used as that project. |
| `timer_stop` | Stop the running timer, write the entry, return the duration. |
| `timer_status` | What is running, for how long, and today's total. |
| `entry_add` | Log time you already worked (start plus end or minutes), with an optional rate and currency: rate "90 euros an hour" bills as EUR 225.00 for 2.5 h. Partial project names resolve like `timer_start`. |
| `entry_list` | Compact table of entries, filtered by date range and project. |
| `entry_edit` | Change any field of an entry. |
| `entry_delete` | Delete an entry by id. |
| `project_set_rate` | Set the hourly rate and currency used for money totals (currency accepts codes or words: EUR, euros, pounds, zl). |
| `report` | Hours and money for a period, grouped by project, day, task or tag; table, JSON or CSV. |
| `export_csv` | Write entries to a CSV file and return the path. |
| `invoice_summary` | Invoice-ready line items for one project: hours, rate, amount, total, in the currency the time was logged in. Free for the last 7 days, Pro for any period from full history. |
| `license_status` | Free or Pro, and where to upgrade. |
| `license_activate` | Activate a Pro key (verified offline). |

Also exposed: the resource `timetracker://today` (today's summary) and the prompt `daily_standup`
(writes a standup update from yesterday's and today's tracked time).

## What you can say

No tool names required. These are the sentences that were actually tested against the server; the tool
column is what answered them.

| You say | Tool |
| --- | --- |
| "Start a timer for the Acme website project." | `timer_start` |
| "Stop the timer and tell me how long I worked." | `timer_stop` |
| "What's running right now, and for how long?" | `timer_status` |
| "Log 2.5 hours yesterday for Acme, design review, at 90 euros an hour." | `entry_add` |
| "Show me my Acme entries for this week." | `entry_list` |
| "That last entry should say API refactor, not design review." | `entry_edit` |
| "Delete the entry I just logged twice." | `entry_delete` |
| "Set my rate for Acme to 90 EUR an hour." | `project_set_rate` |
| "How many hours did I bill this month, grouped by project?" | `report` |
| "Give me invoice lines for Acme in August." | `invoice_summary` |

Two more worth knowing: "export my time to a CSV for my bookkeeper" (`export_csv`) and "write my standup
update from yesterday and today" (the `daily_standup` prompt).

## Worked example

This is a real transcript from the audit in `docs/USER_VALUE_R2.md`, numbers unchanged.

```
You: Log 2.5 hours yesterday for Acme, design review, at 90 euros an hour.

  entry_add { project: "Acme", ... }
  -> "Acme" resolved to the existing project "Acme website"
  -> rate "90 euros an hour" parsed as EUR 90.00/h

Assistant: Logged 2.50 h for Acme website - design review at EUR 90.00/h = EUR 225.00.

You: How much do I bill Acme this week? Give me invoice lines.

  invoice_summary { project: "Acme website", from: "2026-08-31", to: "2026-09-02" }

Assistant: Invoice summary - Acme website
  design review    2.50 h   EUR 90.00/h   EUR 225.00
  TOTAL            2.50 h                 EUR 225.00
```

One call each. The rate carries its currency all the way through: the report never prints a bare "225",
and it never turns into "$225" by accident.

A second worked example, the weekly report and the `daily_standup` prompt:

```
You: How many hours did I put into Acme this week, grouped by task?

  report { project: "Acme website", from: "2026-08-27", to: "2026-09-02", group_by: "task" }

Assistant: Acme website, 2026-08-27 to 2026-09-02
  design review   2.50 h   EUR 225.00
  TOTAL           2.50 h   EUR 225.00

You: Write my standup update.

  (prompt) daily_standup

Assistant: Yesterday: 2.50 h on Acme website (design review).
Today: nothing logged yet.
```

`report` and `invoice_summary` answer overlapping questions on purpose: `report` is for "how much time
and money," grouped any way you like; `invoice_summary` is for "give me the lines I can put on an
invoice," which is a narrower, invoice-shaped view of the same entries for one project.

## How it stores data

Entries, projects and rates live in one JSON file:
`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/time-tracker/data.json`.

Every write (starting or stopping a timer, adding, editing or deleting an entry, setting a rate) happens
under an advisory lock file at `.../time-tracker/.lock`, held across the whole load-mutate-save cycle, so
two overlapping calls cannot interleave and corrupt the file. The save itself writes to a temporary file
and renames it into place, so a crash or a killed process mid-write leaves either the old file or the new
one, never a half-written one. Reads (`entry_list`, `report`, `timer_status`, `export_csv`) do not take
the lock.

To back up your data, copy the single `data.json` file (and `.lock` if present, though it holds no data).
There is no database and no hidden second file.

## Limits and honest caveats

- Free `entry_list`, `report`, `export_csv` and `invoice_summary` only see the last 7 days. Timers and
  entries themselves are unlimited and nothing is ever deleted -- the window just narrows what a free
  call can read back.
- Free tier supports hourly rates on 2 projects; a third rated project needs Pro.
- `report` grouped by tag is Pro-only; grouping by project, day or task is free.
- Only one timer can run at a time. Starting a second one stops and logs the first -- there is no
  concurrent-timer mode.
- There is no reminder or idle-detection: if you forget to stop a timer, it keeps running until you stop
  it or start another.

## Troubleshooting

- **`npx` hangs or fails to find the package**: npm publish for this package is pending. Use the `.mcpb`
  bundle or the clone-and-build path above until it lands.
- **Using the `.mcpb` bundle**: it installs into Claude Desktop directly; there is no separate path to
  configure.
- **Using the clone path**: the server binary is `servers/time-tracker/dist/index.js` after
  `npm run build`. Point your client's `command` at `node` with that absolute path as the only argument.
- **Node version**: requires Node >= 18. Check with `node -v`.
- **Nothing shows up / silent failures**: this server writes logs to stderr only, never stdout (stdout is
  reserved for the MCP protocol). In Claude Desktop, check Settings -> Developer -> the server's log
  file; in Claude Code, run with `--mcp-debug` or check the terminal you launched it from.
- **A Pro key isn't recognized**: run `license_status` to see what the server thinks your tier is, and
  confirm `MCP_LICENSE_KEY` is set in the same process the client launches (not just your shell).

## Privacy

All data stays local: entries live in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/time-tracker/data.json`.
The server makes no network requests, has no telemetry, and needs no account. License keys are Ed25519
signatures verified offline against a public key compiled into the package -- activation works with no
internet connection.

## Pairs with

- [mcp-invoice](../invoice/README.md) -- turn `invoice_summary` output straight into a numbered PDF invoice.
- [mcp-spreadsheet](../spreadsheet/README.md) -- export a CSV with `export_csv` and query or reshape it.
- [mcp-price-tracker](../price-tracker/README.md) -- if you also buy things for the client, watch those prices.
- [office-suite](../office-suite/README.md) -- all four servers behind one install, one config entry.
- Guide: [Track billable hours in Claude Code and Cursor](https://mcp.zovo.one/guides/track-time-in-claude-code)

## FAQ

**Does this work in Cursor as well as Claude Code and Claude Desktop?**
Yes. All three speak MCP over stdio with the same config shape; the tools and the data file are identical
regardless of client.

**What happens when the free 7-day window runs out on an old entry?**
Nothing is deleted. The entry stays in `data.json` forever; it just will not appear in `entry_list`,
`report`, `export_csv` or `invoice_summary` results until you activate Pro, which opens full history.

**Can I bill different clients in different currencies?**
Yes. Currency is set per project (or per entry, overriding the project default) and every total is grouped
by currency -- a report never adds EUR and USD together.

**What happens if two entries have overlapping times?**
The server does not block overlaps; it logs what you tell it. `entry_edit` lets you fix a mistake after
the fact.

**Does it need an internet connection?**
No. There are no network calls anywhere in this server, including for license activation, which is
verified with a local public key.

## License

MIT
