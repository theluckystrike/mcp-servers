# mcp-spreadsheet

Hand your AI assistant a spreadsheet and talk to it. Point it at any `.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.ods`, `.csv` or `.tsv` file on your machine and ask what is in it, filter it, compute a new column, or save it in another format. It handles the messy parts of real files for you: it guesses which row holds the headers, sniffs whether a CSV is separated by commas, semicolons or tabs, keeps quoted commas and newlines intact, reads numbers out of `$1,250.00` style text, and reports per-column types and empty counts. It never edits your original file: every write goes to a new path unless you explicitly choose `overwrite`. Nothing leaves the machine, and there is no API key to get.

## Install

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "spreadsheet": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-spreadsheet"]
    }
  }
}
```

Claude Code:

```bash
claude mcp add spreadsheet -- npx -y @theluckystrike/mcp-spreadsheet
```

Cursor (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "spreadsheet": { "command": "npx", "args": ["-y", "@theluckystrike/mcp-spreadsheet"] }
  }
}
```

With a Pro key, add `"env": { "MCP_LICENSE_KEY": "MCPL1...." }`, or just run the `license_activate` tool once.

## Tools

| Tool | What it does |
| --- | --- |
| `sheet_info` | Sheet names, size, guessed header row, per-column type, sample values, empty counts |
| `sheet_read` | Read rows as a text table, JSON records or CSV; `limit`/`offset` paging or an A1 `range` |
| `sheet_query` | Filter with `where`, pick columns with `select`, `sort`, `limit` |
| `sheet_stats` | count, empty, distinct, min, max, sum, mean, median per column (top values for text columns) |
| `sheet_find` | Find text anywhere in the workbook; returns cell addresses and a row preview |
| `sheet_write` | Write rows (objects or arrays) as a new file, an append, or an explicit overwrite |
| `sheet_add_column` | Add a computed column from a formula, saved to a new file |
| `sheet_convert` | Convert a sheet to csv, xlsx or json |
| `license_status` | Free or Pro, and where to upgrade |
| `license_activate` | Activate a Pro key (verified offline) |

Resource template: `sheet://<path>` returns the `sheet_info` summary for that file.

### The `where` and `formula` language

A small expression language, parsed and evaluated directly. There is no `eval` and no code execution: a bare word is always a column name, never a JavaScript value.

- Columns: `[Unit Price]` for names with spaces, `Qty` otherwise. Lookup is case insensitive.
- Comparisons: `=` `!=` `>` `>=` `<` `<=` `contains` `startswith` `endswith`
- Logic: `AND` `OR` `NOT` and parentheses. `AND` binds tighter than `OR`.
- Arithmetic in formulas: `+` `-` `*` `%` `/` with the usual precedence.
- Strings: `'single'` or `"double"` quotes; double a quote to escape it.

```
[Qty] >= 5 AND ([Status] = "open" OR [Region] contains "north")
[Amount] > 1000 AND NOT [Customer] startswith 'Test'
```

Formula example for `sheet_add_column`: `[Qty] * [Unit Price]`.

Text comparisons ignore case and surrounding whitespace. Values like `$1,250.00`, `1 250`, and `12%` compare as numbers, so `[Amount] > 1000` works on a column your spreadsheet stored as text.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| `sheet_info`, `sheet_read`, `sheet_query`, `sheet_stats`, `sheet_find` | Files up to 5 MB and 5,000 rows | No limit (up to the 50 MB file ceiling) |
| `sheet_write`, `sheet_add_column`, `sheet_convert` | 200 rows written per file | No limit |
| Sheets, formats, expression language | All | All |

Over a free limit the tool still does the work and returns the part it is allowed to return (the first 5,000 rows read, the first 200 rows written), with a note saying what was left out. Nothing fails silently.

## Get Pro

$19 one-time for this server, $39 for every server, lifetime: https://mcp.zovo.one/buy/spreadsheet

## Privacy

All data stays local. Files are read from and written to your own disk, license keys are verified offline with an embedded public key, and the server makes no network requests at all.

## Safety

- Paths that do not exist are refused with the resolved path in the message; `~` is expanded.
- Files over 50 MB are refused with a clear message rather than exhausting memory.
- `sheet_add_column` and `sheet_convert` write to a new file and refuse to clobber an existing one unless you pass `out_path` yourself.
- `sheet_write` with `mode: "new_file"` refuses to write over an existing file. Only `mode: "overwrite"` replaces file contents.
- Output files are written to a temporary name and renamed into place, so an interrupted write cannot truncate a file.

Built by [theluckystrike](https://github.com/theluckystrike). Support: support@zovo.one
