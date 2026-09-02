status: DONE

evidence:

    $ export npm_config_cache=/Users/mike/.npm-cache-local
    $ npm install            # repo root, workspaces resolved
    up to date; 1.14s

    $ npm run build -w servers/spreadsheet   # after rm -rf dist
    > tsc -p tsconfig.json && node -e "require('fs').chmodSync('dist/index.js',0o755)"
    0.83s wall (1.86s user)

    $ npm test -w servers/spreadsheet
    ok 1 - quoted commas stay in one field
    ok 2 - CRLF line endings
    ok 3 - embedded newline inside quotes
    ok 4 - doubled quotes unescape
    ok 5 - semicolon delimiter is sniffed
    ok 6 - tab delimiter is sniffed
    ok 7 - comma wins over stray semicolons in data
    ok 8 - BOM is stripped from the first header
    ok 9 - trailing newline does not create an empty row
    ok 10 - empty fields are preserved
    ok 11 - round trip through toCsv re-parses identically
    ok 12 - coerce keeps leading zeros as text but converts real numbers
    ok 13 - comparison on a bracketed column
    ok 14 - bare column names without spaces
    ok 15 - string equality is case and whitespace insensitive
    ok 16 - contains / startswith / endswith
    ok 17 - AND binds tighter than OR
    ok 18 - parentheses group correctly
    ok 19 - NOT negates
    ok 20 - arithmetic precedence in formulas
    ok 21 - quoted strings with embedded quotes
    ok 22 - currency and comma text compares numerically
    ok 23 - missing and empty columns are falsy, never throw
    ok 24 - string concatenation when a side is not numeric
    ok 25 - division by zero yields null instead of Infinity
    ok 26 - column lookup is case insensitive
    ok 27 - malformed expressions raise ExprError
    ok 28 - no code execution: identifiers are columns, not globals
    ok 29 - stdio: initialize, tools/list, and the full read-query-edit-convert path
    ok 30 - safety: missing files, clobbering and bad expressions are refused with a clear message
    ok 31 - pro gate: a 300-row write is capped at 200 free and complete with a license key
    # tests 31
    # pass 31
    # fail 0
    # duration_ms 830.593125

    npm test wall: 0.959s

    Smoke test path, over stdio JSON-RPC against dist/index.js:
    initialize -> tools/list (10 tools) -> fixture orders.xlsx written by the xlsx lib inside the test
    -> sheet_info (headerRow 1, Qty typed number, Customer typed text)
    -> resources/read sheet://<path>
    -> sheet_read as csv (quoted comma "Beta, Inc" preserved)
    -> sheet_query where '[Qty] > 3 AND ([Status] = "open" OR [Region] contains "north")' sort Qty desc
    -> sheet_stats (sum 23, median 4, max 10)
    -> sheet_find ("gamma" -> cell B4)
    -> sheet_add_column formula "[Qty] * [Unit Price]" (new file, source re-read and asserted unchanged at 6 columns)
    -> sheet_convert to csv, file bytes read back: header row exact, row "3,Gamma GmbH,North East,2,99.99,open,199.98"
    -> the produced csv re-opened through sheet_info (format csv, delimiter , , 5 rows)

    Pro gate, MCP_LICENSE_KEY from `node scripts/sign-license.mjs spreadsheet`:
    free  license_status tier=free ; 300-row sheet_write -> file has 201 lines, text contains
          "Free tier writes at most 200 rows" and "mcp.zovo.one/buy/spreadsheet", isError false
    pro   license_status tier=pro  ; same call -> file has 301 lines, no "Free tier" text
    XDG_DATA_HOME / XDG_CONFIG_HOME point at a mkdtemp dir in every test.

    Messy-file check (manual, /private/tmp scratchpad):
    file = title row, blank row, then "name;qty;amount" CRLF with a quoted "1.250,00"
    delim ";" headerRow 2 headers [ 'name', 'qty', 'amount' ] rows [ [ 'Widget', 2, '1.250,00' ], [ 'Gadget', 10, 99 ] ]

artifacts:
    /Users/mike/mcp-servers/servers/spreadsheet/src/index.ts        444 lines, 8 sheet_* tools + license tools + sheet://{path} resource
    /Users/mike/mcp-servers/servers/spreadsheet/src/expr.ts         251 lines, tokenizer + recursive descent parser + evaluator, no eval
    /Users/mike/mcp-servers/servers/spreadsheet/src/csv.ts           95 lines, RFC 4180 parser + delimiter sniffer + writer
    /Users/mike/mcp-servers/servers/spreadsheet/src/sheet.ts        214 lines, load/normalise/header-guess/type-infer/A1-range/atomic paths
    /Users/mike/mcp-servers/servers/spreadsheet/test/expr.test.mjs  16 tests
    /Users/mike/mcp-servers/servers/spreadsheet/test/csv.test.mjs   12 tests
    /Users/mike/mcp-servers/servers/spreadsheet/test/smoke.test.mjs  3 tests, stdio JSON-RPC client written inline
    /Users/mike/mcp-servers/servers/spreadsheet/package.json
    /Users/mike/mcp-servers/servers/spreadsheet/tsconfig.json
    /Users/mike/mcp-servers/servers/spreadsheet/README.md
    /Users/mike/mcp-servers/servers/spreadsheet/LICENSE
    /Users/mike/mcp-servers/servers/spreadsheet/server.json
    /Users/mike/mcp-servers/servers/spreadsheet/smithery.yaml
    /Users/mike/mcp-servers/servers/spreadsheet/Dockerfile
    /Users/mike/mcp-servers/servers/spreadsheet/RESULT.md

cost: 24 wall minutes

failures:
    1. tsc TS5076 in sheet.ts: `ext ?? extname(input) || ".csv"` mixes ?? and ||. Fixed with parentheses.
    2. Test "no code execution" failed: compile("constructor")({}) returned [Function: Object].
       The column lookup used `name in row`, which walks the prototype chain, so any expression
       naming a prototype member resolved to a JS value. Fixed with Object.prototype.hasOwnProperty.call.
       This was a real information leak from the expression language, found only because the test
       asserted on identifiers that are not columns.
    3. Smoke test expectation was wrong, not the code: I expected "Beta, Inc" (Qty 10) to match
       `[Qty] > 3 AND ([Status] = "open" OR [Region] contains "north")`. It is closed and in the
       South, so the OR group correctly excludes it. Expectation corrected; precedence was right.

insight:
    Guessing the header row cannot be done on the first row alone and cannot be done on types alone.
    The rule that survived the messy fixtures is: first row within the top 12 whose non-empty cells
    are all non-blank strings AND are all distinct, with a non-empty row after it. Distinctness is
    what does the work: a title row like "Sales export 2026-08" has one filled cell, and a numeric
    data row fails the all-strings test, but the case that actually breaks type-only heuristics is a
    sheet whose data rows are all text; there, duplicate values in a data row are common while a real
    header row has none. Same fixture also showed the type sniffing must be scoped: `1.250,00` in a
    semicolon CSV is European currency text, and coercing it to a number would silently turn 1250 into
    1.25, so the CSV coercer only accepts strict ASCII decimal and leaves everything else as text --
    the numeric reading happens later, in the expression evaluator, where it is per-comparison and
    reversible rather than baked into the stored value.
