status: DONE

evidence:

1. GIF demos, recorded via `vhs` (brew-installed: vhs 0.11.0, deps ttyd 1.7.7, ffmpeg 9.0.1, libwebsockets 5.0.0 --
   install completed in under 5 minutes, no SVG fallback needed).

   Driver: `scripts/demo/drive.mjs <server>` spawns `servers/<name>/dist/index.js` over stdio in a sandboxed
   XDG_DATA_HOME, sends `initialize` then 3 real `tools/call` requests per server, and prints each call and its
   result the way a person would see it in a chat, with a 1.4s pause between steps. price-tracker's steps hit a
   throwaway local HTTP fixture (127.0.0.1, random port) instead of the network, so the demo is deterministic and
   makes zero external calls. Tapes: `scripts/demo/<name>.tape` (80-col-equivalent 900x480, Dracula theme, 40ms
   typing speed).

   Command run for each: `vhs scripts/demo/<name>.tape` from repo root.

   Output sizes (limit 1.5 MB):
   - assets/demo-time-tracker.gif   63 KB  (timer_start, timer_stop, report)
   - assets/demo-price-tracker.gif  180 KB (price_check, watch_add, watch_list against local fixture)
   - assets/demo-spreadsheet.gif    168 KB (sheet_info, sheet_add_column, sheet_query)
   - assets/demo-invoice.gif        196 KB (business_set, invoice_create, invoice_list)
   All four under 200 KB, well inside the 1.5 MB cap.

2. README updates:
   - servers/time-tracker/README.md, servers/price-tracker/README.md, servers/spreadsheet/README.md,
     servers/invoice/README.md: each now opens with the demo GIF, a one-line value statement, and a
     "60-second install" section with the .mcpb one-click line (pointing at
     https://github.com/theluckystrike/mcp-servers/releases/latest), Claude Desktop config JSON, `claude mcp add`,
     Cursor `.cursor/mcp.json`, and an explicit statement that npm publish is pending with the exact 3-command
     clone+build path. Existing Tools and Free vs Pro tables were left in place, unmodified.
   - README.md (root): demo-thumbnail table, MIT/registry/release shields.io static badges (no third-party
     tracking pixels), a "Why these four" paragraph citing the measured finding (median server: zero repeat use;
     the two differentiators are a working config snippet and a visible demo), and a Guides section linking the
     5 requested https://mcp.zovo.one/guides/<slug> pages.

3. Verification (commands run against the real v0.1.1 GitHub release, in /private/tmp scratch dirs, cleaned up
   after):

   .mcpb path:
   $ gh release download v0.1.1 -R theluckystrike/mcp-servers -p "time-tracker.mcpb"
   $ npx -y @anthropic-ai/mcpb unpack time-tracker.mcpb unpacked
     -> "Extension unpacked successfully" ; unpacked/{manifest.json, server/{index.js,node_modules,package.json}}
   $ echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | node unpacked/server/index.js
     -> stderr: "mcp-time-tracker ready (free), data in /Users/mike/.local/share/mcp-servers/time-tracker"
     -> stdout: {"result":{"protocolVersion":"2025-06-18",...,"serverInfo":{"name":"time-tracker","version":"0.1.0"}},...}
   Result: .mcpb one-click path works end to end.

   Clone + build path:
   $ git clone --depth 1 https://github.com/theluckystrike/mcp-servers.git
   First attempt with only `npm install` inside servers/time-tracker failed:
     "error TS2307: Cannot find module '@theluckystrike/mcp-license'"
   because it is a workspace package with its own build step, not published to npm. Fixed path (this is the one
   published in the READMEs and root README):
   $ npm install                                              (from repo root, installs all workspaces)
   $ npm run build -w packages/mcp-license -w servers/time-tracker
   $ echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | node servers/time-tracker/dist/index.js
     -> same successful initialize response as above.
   Result: the 3-command clone+build path documented in every README is the one actually verified working;
   the naive `cd servers/<name> && npm install && npm run build` does NOT work and was not shipped.

artifacts:
- scripts/demo/drive.mjs
- scripts/demo/time-tracker.tape, scripts/demo/price-tracker.tape, scripts/demo/spreadsheet.tape, scripts/demo/invoice.tape
- assets/demo-time-tracker.gif, assets/demo-price-tracker.gif, assets/demo-spreadsheet.gif, assets/demo-invoice.gif
- servers/time-tracker/README.md, servers/price-tracker/README.md, servers/spreadsheet/README.md, servers/invoice/README.md
- README.md

cost: 33 wall minutes

failures:
- spreadsheet demo step originally ran sheet_query against the pre-add_column file and errored "column Total not
  found" because sheet_add_column writes to a new out_path by default, not in place; fixed the driver to query
  the out_path instead of the source file.
- clone+build path fails with the workspace package unbuilt if you `npm install` only inside the server directory
  (TS2307 on @theluckystrike/mcp-license); the README and root README ship the two-workspace build command that
  actually works, not the naive one.

insight: `npm run build -w packages/mcp-license -w servers/<name>` is required, not just `-w servers/<name>` --
the shared license package is a workspace dependency with no npm registry copy, so a single-workspace build looks
correct until `tsc` hits the missing module; the failure only surfaces on a clean clone, never in this repo's own
node_modules where it is already built.

---

## Update 2026-09-03: expense-tracker and office-suite demos

Added the two remaining demos so all six servers (five standalone + the office-suite bundle) now have a real GIF
instead of a static logo / "no demo yet" placeholder.

1. Driver changes (`scripts/demo/drive.mjs`):
   - `client()` gained an optional `showStderr` predicate: office-suite's proxy-ready line is written to real
     stderr (not the JSON-RPC stdout stream drive.mjs otherwise parses), so it is opted into the recording only
     for that server, printed dimmed, matching one line per matched stderr line.
   - New `expense-tracker` sequence: seeds one category rule (`Adobe -> software`, silent setup call, not
     recorded), then records `expense_add` (61.50 EUR, merchant Adobe, vat_rate 23, auto-categorised from the
     rule), `mileage_add` (45 km, region PL, built-in table rate), and `expense_to_invoice` for the same project
     and day -- output shows the EUR line item at net 50.00 / tax_rate 23 (61.50 gross at 23% nets to exactly
     50.00), with the PLN mileage claim correctly excluded (different currency does not appear in this project's
     unbilled call because it was not tied to the `acme` project).
   - New `office-suite` sequence: `timer_start`, `expense_add` (18.90 EUR, vat_rate 23), then `invoice_from_hours`
     -- all three tools come from three different proxied children (time-tracker, expense-tracker, invoice) in
     one stdio session. `business_set` and `client_add` are called silently first (same pattern as the invoice
     demo) so the invoice result is not cluttered with placeholder-issuer warnings.

2. Tapes: `scripts/demo/expense-tracker.tape`, `scripts/demo/office-suite.tape` -- identical settings to the
   existing four (900x480, Dracula, 40ms typing, `Sleep 10s`).

   Command run for each: `vhs scripts/demo/<name>.tape` from repo root.

   Output sizes (limit 400 KB):
   - assets/demo-expense-tracker.gif  145,664 bytes (142.2 KB) (expense_add, mileage_add, expense_to_invoice)
   - assets/demo-office-suite.gif     139,218 bytes (136.0 KB) (timer_start, expense_add, invoice_from_hours, one
     proxied session, stderr line confirming all five children)
   Both well under the 400 KB cap.

3. Verification (`file` + `ffprobe`):
   ```
   $ file assets/demo-expense-tracker.gif assets/demo-office-suite.gif
   assets/demo-expense-tracker.gif: GIF image data, version 89a, 900 x 480
   assets/demo-office-suite.gif:    GIF image data, version 89a, 900 x 480

   $ ffprobe -v error -select_streams v -show_entries stream=width,height,nb_frames,avg_frame_rate \
       -of default=noprint_wrappers=1 assets/demo-expense-tracker.gif
   width=900
   height=480
   avg_frame_rate=25/1
   nb_frames=283

   $ ffprobe ... assets/demo-office-suite.gif
   width=900
   height=480
   avg_frame_rate=25/1
   nb_frames=279
   ```
   Both GIFs are valid 900x480 images at 25 fps with ~280 frames (~11s), matching the four existing demos.
   Separately confirmed office-suite's proxy startup line by direct probe of `servers/office-suite/dist/index.js`:
   `mcp-office-suite ready, proxying [time-tracker, price-tracker, spreadsheet, invoice, expense-tracker], 49
   tools` on stderr, plus `tools/list` returning 51 tools total (49 proxied + `license_status` +
   `license_activate`), confirming the README's "51 tools" and "five children" claims.

4. README updates:
   - `servers/expense-tracker/README.md` and `servers/office-suite/README.md`: each now opens with its demo GIF
     right under the title, above the existing description.
   - `README.md` (root): the demo-thumbnail table's `mcp-expense-tracker` cell now points at
     `assets/demo-expense-tracker.gif` (previously the static logo PNG) and the `mcp-office-suite` cell now shows
     `assets/demo-office-suite.gif` (previously "(bundle, no demo yet)"). No other table cells or prose changed.

artifacts (this update):
- scripts/demo/drive.mjs (extended)
- scripts/demo/expense-tracker.tape, scripts/demo/office-suite.tape
- assets/demo-expense-tracker.gif, assets/demo-office-suite.gif
- servers/expense-tracker/README.md, servers/office-suite/README.md
- README.md


---

## Update 2026-09-03: currency, timezone and docx demos

Added demos for the three remaining servers not covered by the original six (currency, timezone, docx),
following the same driver/tape pattern.

1. Driver changes (`scripts/demo/drive.mjs`):
   - `startEcbFixture()`: a local HTTP fixture serving `eurofxref-daily.xml` and `eurofxref-hist.xml` (USD, GBP,
     PLN over several days), the same approach as `servers/currency/test/smoke.test.mjs`. When `run("currency")`
     is called, the driver starts this fixture and passes its URL to the spawned server via `ECB_BASE_URL`, so
     the demo makes zero external network calls and produces identical output on every run.
   - New `currency` sequence: `convert` (100 USD -> PLN, with rate date), `fx_rates_for` (USD target vs EUR/GBP),
     `rate_history` (USD/PLN, 30 days, summary with min/max/avg/change_pct).
   - New `timezone` sequence: `convert_time` (Warsaw 15:00 -> Denver, Sydney), `find_meeting_slots` for three
     participants (Warsaw, London, New York -- chosen because Denver/Sydney together have no realistic 9-5
     overlap; Warsaw/London/New York overlap by roughly 2 hours UTC), limited to 3 results for a readable demo,
     and `ics_create` writing a real `.ics` file into the sandbox data dir.
   - New `docx` sequence: `business_set`, `proposal_create` (Acme GmbH, Checkout rebuild, EUR 4,500, three
     timeline phases -- summary/scope/deliverables kept short to keep the recorded output, and so the GIF, small),
     then `doc_read` of the resulting `.docx` path (parsed out of the `proposal_create` JSON response) to show a
     round trip.

2. Tapes: `scripts/demo/currency.tape`, `scripts/demo/timezone.tape`, `scripts/demo/docx.tape` -- identical
   settings to the existing six (900x480, Dracula, 40ms typing, `Sleep 10s`).

   Command run for each: `vhs scripts/demo/<name>.tape` from repo root.

   Output sizes (limit 400 KB):
   - assets/demo-currency.gif  229,518 bytes (224.1 KB) (convert, fx_rates_for, rate_history)
   - assets/demo-timezone.gif  181,435 bytes (177.2 KB) (convert_time, find_meeting_slots, ics_create)
   - assets/demo-docx.gif      285,043 bytes (278.4 KB) (business_set, proposal_create, doc_read)
   All three under 400 KB.

3. Verification (`file` + `ffprobe`):
   ```
   $ file assets/demo-currency.gif assets/demo-timezone.gif assets/demo-docx.gif
   assets/demo-currency.gif: GIF image data, version 89a, 900 x 480
   assets/demo-timezone.gif: GIF image data, version 89a, 900 x 480
   assets/demo-docx.gif:     GIF image data, version 89a, 900 x 480

   $ ffprobe -v error -select_streams v -show_entries stream=width,height,nb_frames,avg_frame_rate \
       -of default=noprint_wrappers=1 assets/demo-<name>.gif
   currency: width=900 height=480 avg_frame_rate=25/1 nb_frames=268
   timezone: width=900 height=480 avg_frame_rate=25/1 nb_frames=267
   docx:     width=900 height=480 avg_frame_rate=25/1 nb_frames=264
   ```
   All three are valid 900x480 GIFs at 25 fps with roughly 265-270 frames (about 10-11s), matching the existing
   six demos.

4. README updates:
   - `servers/currency/README.md`: replaced the `<img src="../../assets/currency-logo.png" ...>` line with
     `![currency demo](../../assets/demo-currency.gif)` (only that line changed).
   - `servers/timezone/README.md`: replaced `![mcp-timezone](../../assets/timezone-logo.png)` with
     `![timezone demo](../../assets/demo-timezone.gif)` (only that line changed).
   - `servers/docx/README.md`: had no logo image line, so a `![docx demo](../../assets/demo-docx.gif)` line was
     inserted right after the intro paragraph, matching where the other five READMEs place their demo GIF.
   - `README.md` (root): added three table rows (mcp-currency, mcp-timezone, mcp-docx) after the existing six,
     matching the existing row format exactly (link, thumbnail, one-line description, npx install line with the
     `*` footnote marker). No other rows or prose changed.

artifacts (this update):
- scripts/demo/drive.mjs (extended)
- scripts/demo/currency.tape, scripts/demo/timezone.tape, scripts/demo/docx.tape
- assets/demo-currency.gif, assets/demo-timezone.gif, assets/demo-docx.gif
- servers/currency/README.md, servers/timezone/README.md, servers/docx/README.md
- README.md
