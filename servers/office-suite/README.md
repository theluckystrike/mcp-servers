# mcp-office-suite

One install for the whole freelancer office. This MCP server proxies four sibling servers -- **time-tracker**, **price-tracker**, **spreadsheet** and **invoice** -- so a client gets every tool from all four behind a single config entry instead of four. Under the hood it starts each sibling as its own stdio child process, forwards `tools/call`, `resources/*` and `prompts/*` to whichever child owns the name, and merges their license state into one `license_status` / `license_activate` pair. Nothing is re-implemented: each child server runs exactly as it does standalone, with its own local JSON storage.

**Every tool of time-tracker, price-tracker, spreadsheet and invoice, one `claude mcp add`.**

## 60-second install

npm publish for `@theluckystrike/mcp-office-suite` (and its four dependencies) is pending. Until then, the `.mcpb` one-click bundle or a clone+build is the working path -- both are verified below. This server is packaged as `office-suite.mcpb` on release v0.2.1 and is listed on the official MCP registry (`io.github.theluckystrike/office-suite-time-invoice-expense-excel-price`).

**One-click (.mcpb):** download `office-suite.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "office-suite": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-office-suite"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add office-suite -- npx -y @theluckystrike/mcp-office-suite
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "office-suite": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-office-suite"]
    }
  }
}
```

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build
```

`npm run build` (no `-w`) is required here -- it builds `mcp-license` and all four sibling servers that office-suite spawns as children, then office-suite itself. Then point your client's `command` at `node` with one arg: the absolute path to `servers/office-suite/dist/index.js`.

To run every server in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key -- it is forwarded to every connected child. Activation is all-or-nothing: the reply is an error unless **every** child accepted the key, and it prints a per-child table (`OK` / `FAILED` with each child's own message) so a bundle that is half Pro cannot look like a success.

## Why one server instead of four

Aggregation is what usage rewards in this category: the most-used server we track is a tool-aggregator gateway with 2,530 tools and 419,019 uses, 7.5x the next server and 30x the cohort median. A user who wants "office stuff" should not have to add four separate MCP servers to one client config. Installing this one gets every tool below.

## Tools

Tool names are passed through unchanged from each child. If this bundle ever proxies two children that register the same tool name, both are exposed with a `<child>_<tool>` prefix instead -- this has not happened yet among the four servers below.

### time-tracker

| Tool | What it does |
|---|---|
| `timer_start` | Start a stopwatch for a project; stops and logs any previous running timer |
| `timer_stop` | Stop the running timer and log it as a time entry |
| `timer_status` | Show the running timer and today's total hours |
| `entry_add` | Log time you already worked, with a start plus end or minutes |
| `entry_list` | List logged time entries as a table (free: last 7 days) |
| `entry_delete` | Delete one time entry by id |
| `entry_edit` | Change fields of an existing entry |
| `project_set_rate` | Set the hourly rate and currency for a project |
| `report` | Hours and money by project, day, task or tag (tag grouping is Pro) |
| `export_csv` | Export the timesheet to a CSV file |
| `invoice_summary` | Turn tracked billable time into invoice line items |

### price-tracker

| Tool | What it does |
|---|---|
| `price_check` | Check a product's current price right now |
| `watch_add` | Start watching a product URL for price drops |
| `watch_list` | List all watched products and their latest price |
| `watch_remove` | Stop watching a product |
| `watch_refresh` | Re-check all watches (or one) immediately |
| `price_history` | Price history for one watched product |
| `price_add_manual` | Record a price by hand, for sites that block fetching |
| `alerts_pending` | Watches that dropped below their target price |

### spreadsheet

| Tool | What it does |
|---|---|
| `sheet_info` | Overview of a CSV/XLSX file: sheets, columns, row count |
| `sheet_read` | Read rows from a spreadsheet |
| `sheet_query` | Filter, group and sort rows |
| `sheet_stats` | Per-column statistics (min, max, mean, sum, distinct) |
| `sheet_find` | Find text across a spreadsheet |
| `sheet_write` | Write rows into a spreadsheet |
| `sheet_add_column` | Add a computed column |
| `sheet_convert` | Convert between CSV and XLSX |

### invoice

| Tool | What it does |
|---|---|
| `business_set` | Set your business profile: name, address, VAT id, IBAN, default currency and terms |
| `client_add` | Store a client so invoices can refer to them by name |
| `client_list` | List every stored client |
| `invoice_create` | Create an invoice from line items, with tax and discount |
| `invoice_from_hours` | Create an invoice from hours worked at a rate |
| `invoice_list` | List invoices |
| `invoice_get` | Get one invoice by id or number |
| `invoice_mark_paid` | Record a payment against an invoice |
| `invoice_pdf` | Render an invoice as a PDF file |
| `overdue_report` | Invoices past their due date, by how many days (Pro) |

### Bundle-wide

| Tool | What it does |
|---|---|
| `license_status` | Free/Pro status of every proxied server, and the bundle upgrade link |
| `license_activate` | Activate one Pro bundle key across every server at once. Returns an error with a per-child table unless all of them accepted it |

Resources and prompts registered by any child (for example time-tracker's `timetracker://today` resource and `daily_standup` prompt) are also proxied under their original names.

## Free vs Pro

Each child server keeps its own free tier exactly as documented in its own README (see `servers/time-tracker/README.md`, `servers/price-tracker/README.md`, `servers/spreadsheet/README.md`, `servers/invoice/README.md`). This bundle changes nothing about those limits -- it only changes how many config entries it takes to reach all four.

A single **bundle** Pro key ($39 one-time, lifetime) unlocks Pro on every server in the bundle, instead of buying each server's $19 key separately. Activate it once here and it is forwarded to all four children.

**Get Pro:** https://mcp.zovo.one/buy/bundle

## Child processes

Each child runs as its own stdio process. Two things the proxy does on their behalf:

- **Their stderr is drained into ours**, one line at a time, tagged with the child it came from (`[invoice] ...`). A child's stderr is a pipe with a small OS buffer; left unread, a child that logged more than that buffer blocked in `write()` and the tool call it was answering never returned.
- **A child that dies rejects its in-flight requests** before the suite tries to restart it, so a proxied call fails fast instead of hanging until the client's timeout, where a retry could repeat a mutation that had already been applied.

## Privacy

Every child server stores its data locally, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/<name>/` per server. This bundle adds no storage of its own and sends nothing anywhere; it only pipes stdio between your MCP client and the four child processes it starts on your own machine.

## expense-tracker

TODO: `servers/expense-tracker/dist` does not exist yet in this repository. Once that server is built and shipped, add it to `CHILDREN` in `src/index.ts`, its dependency to `package.json`, its build step to the Dockerfile, and its tool table to this README.

---

Built by theluckystrike (https://github.com/theluckystrike).
