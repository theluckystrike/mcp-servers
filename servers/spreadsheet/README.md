# mcp-spreadsheet

Hand your AI assistant a spreadsheet and talk to it. Point it at any `.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.ods`, `.csv` or `.tsv` file on your machine and ask what is in it, filter it, compute a new column, or save it in another format. It handles the messy parts of real files for you: it guesses which row holds the headers, sniffs whether a CSV is separated by commas, semicolons or tabs, keeps quoted commas and newlines intact, reads numbers out of `$1,250.00` style text, and reports per-column types and empty counts. It never edits your original file: every write goes to a new path unless you explicitly choose `overwrite`. Nothing leaves the machine, and there is no API key to get.

![spreadsheet demo](../../assets/demo-spreadsheet.gif)

**Read, query and extend real spreadsheets from chat without ever touching the original file.**

## 60-second install

npm publish for `@theluckystrike/mcp-spreadsheet` is pending. Until then, the `.mcpb` one-click bundle or a clone+build
is the working path -- both are verified below.

**One-click (.mcpb):** download `spreadsheet.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

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

**Claude Code:**

```sh
claude mcp add spreadsheet -- npx -y @theluckystrike/mcp-spreadsheet
```

**Cursor** (`.cursor/mcp.json`):

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

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these three commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/spreadsheet
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/spreadsheet/dist/index.js`.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Tools

| Tool | What it does |
| --- | --- |
| `sheet_info` | Sheet names, size, guessed header row, per-column type, sample values, empty counts |
| `sheet_read` | Read rows as a text table, JSON records or CSV; `limit`/`offset` paging or an A1 `range` |
| `sheet_query` | Filter with `where`, `group_by` + `aggregate` (sum, count, avg, min, max), pick columns with `select`, `sort` (aggregate aliases too), `limit` |
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
| Every tool that reads a file (`sheet_info`, `sheet_read`, `sheet_query`, `sheet_stats`, `sheet_find`, `sheet_add_column`, `sheet_convert`) | Files up to 5 MB and 5,000 rows | No limit (up to the 50 MB file ceiling) |
| `sheet_write`, `sheet_add_column`, `sheet_convert` | Up to 500 rows written per file; over that nothing is written and the tool says so | No limit |
| Sheets, formats, expression language | All | All |

Over a free read limit the tool still does the work and returns the part it is allowed to return (the first 5,000 rows), with a note saying what was left out. Over the free write limit nothing at all is written: a partial file that looks complete is worse than no file, so the tool refuses, tells you the row count and the cap, and suggests a free workaround (filter the rows down first, or write in 500-row batches). Nothing fails silently.

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
