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
