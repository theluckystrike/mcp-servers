# mcp-supplier-list

[![theluckystrike/mcp-supplier-list MCP server](https://glama.ai/mcp/servers/theluckystrike/mcp-supplier-list/badges/score.svg)](https://glama.ai/mcp/servers/theluckystrike/mcp-supplier-list)

**In the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.theluckystrike%2Fsupplier-list/versions/latest)** (`io.github.theluckystrike/supplier-list`).
This is the mcp supplier list server: a supplier directory inside your MCP client that does not rot the way the spreadsheet does. Add each supplier once -- what they supply, who to contact and how, the payment terms, the lead time in days, and notes -- and every record carries the date it was last reviewed, so "which of these records have gone stale?" is a question the directory answers instead of a chore you forget. Ask for a supplier by name, list the directory by category, and export the whole thing to CSV or Markdown when someone else needs it. Everything stays on this machine; there is no account and no network call.

Built by theluckystrike.

npm publish for `@theluckystrike/mcp-supplier-list` is pending, so `npx -y @theluckystrike/mcp-supplier-list` returns 404 today. Until then, a clone+build is the working path.

## Why not a spreadsheet

A spreadsheet of suppliers rots because nothing in it tells you it is stale: the phone number changed eight months ago and you find out when the order bounces. An mcp supplier list lives where the purchasing conversations already happen, and the review stamp on every record turns "is this still true?" into a report instead of a memory test.

## Install

### Claude Desktop

macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "supplier-list": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-supplier-list"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add supplier-list -- npx -y @theluckystrike/mcp-supplier-list
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), same entry as Claude Desktop.

## Tools

| tool | what it does |
| --- | --- |
| `supplier_add` | Add a supplier: name, category, contact fields, payment terms, lead time in days, notes. Returns `SUP-YYYY-NNNN` |
| `supplier_list` | List the directory A to Z with contact, terms, lead time and review age; filter by category and free text |
| `supplier_get` | Read one supplier record in full by SUP number or name |
| `supplier_update` | Change any fields on a record; only what you pass changes |
| `supplier_remove` | Remove a supplier, returning the record as it stood. The number is never reissued |
| `supplier_mark_reviewed` | Stamp a record as reviewed on a date, today by default |
| `supplier_due_review` | The due-review report: records not reviewed in N days (default 90), most overdue first. Pro |
| `supplier_export` | Export the directory as CSV (free) or a Markdown table (Pro), with optional category and text filters |
| `license_status` / `license_activate` | Free or Pro, and the key |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Suppliers in the directory | 10 | Unlimited |
| Add, list, get, update, remove | Yes | Yes |
| Review stamps | Yes | Yes |
| CSV export | Yes | Yes |
| Markdown export | No | Yes |
| Due-review report | No | Yes |

The directory itself is never metered. Ten suppliers is a real working list for a freelancer, and reading, changing, searching and CSV-exporting the suppliers you have stays free for good. What Pro lifts is how many suppliers the directory holds, Markdown export, and the due-review report that keeps a bigger directory honest.

**Get Pro:** https://mcp.zovo.one/buy/supplier-list -- $19 one-time for this server, or $39 for the bundle.

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/supplier-list/`. Two files: `suppliers.json`, `counter.json`. Nothing is sent anywhere, there is no account, no API key and no network call in this server at all. License keys are verified offline.

Built by theluckystrike. https://github.com/theluckystrike
