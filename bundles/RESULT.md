status: DONE

evidence:
- Build: `./scripts/build-mcpb.sh` (requires bash >= 4, shebang pins `/opt/homebrew/bin/bash`; system `/bin/bash` is 3.2 and lacks associative arrays). Ran twice; second run identical output and byte-identical .mcpb sizes (idempotent).
- `npx -y @anthropic-ai/mcpb validate manifest.json` per server, verbatim:
  - time-tracker: `Manifest schema validation passes!`
  - price-tracker: `Manifest schema validation passes!`
  - spreadsheet: `Manifest schema validation passes!`
  - invoice: `Manifest schema validation passes!`
- `npx -y @anthropic-ai/mcpb pack . <out>.mcpb` per server, verbatim tail:
  - time-tracker: `filename: mcp-time-tracker-0.1.0.mcpb / package size: 3.1MB / unpacked size: 9.7MB / shasum: 48f9f1160a764d27ec0b5068e202929f1144e58c / total files: 2163 / ignored (.mcpbignore) files: 1243`
  - price-tracker: `filename: mcp-price-tracker-0.1.0.mcpb / package size: 3.1MB / unpacked size: 9.7MB / shasum: 85496d3f6ba38c1383db8752a792fb08f4da548d / total files: 2166 / ignored (.mcpbignore) files: 1243`
  - spreadsheet: `filename: mcp-spreadsheet-0.1.0.mcpb / package size: 7.1MB / unpacked size: 21.0MB / shasum: 5e6d2d9634c08d6f48d45dfafffe2b82b3a4ad04 / total files: 2386 / ignored (.mcpbignore) files: 1268`
  - invoice: `filename: mcp-invoice-0.1.0.mcpb / package size: 6.6MB / unpacked size: 20.7MB / shasum: 35de939cf6adc8a6bdbe7cc2da7795e075f4dfca / total files: 3074 / ignored (.mcpbignore) files: 1417`
- Verification: unpacked each `.mcpb` into a fresh temp dir, spawned `node server/index.js` from that dir, sent `initialize` + `notifications/initialized` + `tools/list` over stdin as JSON-RPC, diffed the returned tool name list against `manifest.json`'s `tools[].name` list.
  - time-tracker: 13/13 tools match (11 feature tools + license_status + license_activate). stderr: `mcp-time-tracker ready (free), data in /Users/mike/.local/share/mcp-servers/time-tracker`
  - price-tracker: 10/10 tools match (8 feature tools + 2 license tools). stderr: `price-tracker ready (free), data in /Users/mike/.local/share/mcp-servers/price-tracker/watches.json`
  - spreadsheet: 10/10 tools match (8 feature tools + 2 license tools). stderr: `mcp-spreadsheet 0.1.0 ready (free)`
  - invoice: 12/12 tools match (10 feature tools + 2 license tools). stderr: `mcp-invoice ready (free), data in /Users/mike/.local/share/mcp-servers/invoice`
  - `diff manifest_<name>.txt live_<name>.txt` was empty for all four.

artifacts:
- /Users/mike/mcp-servers/bundles/time-tracker.mcpb (3,210,579 bytes)
- /Users/mike/mcp-servers/bundles/price-tracker.mcpb (3,215,549 bytes)
- /Users/mike/mcp-servers/bundles/spreadsheet.mcpb (7,411,039 bytes)
- /Users/mike/mcp-servers/bundles/invoice.mcpb (6,971,650 bytes)
- /Users/mike/mcp-servers/bundles/<name>/manifest.json, /Users/mike/mcp-servers/bundles/<name>/server/ (self-contained, dist + node_modules + vendored @theluckystrike/mcp-license) for each of the 4 servers
- /Users/mike/mcp-servers/scripts/build-mcpb.sh (orchestrator, idempotent)
- /Users/mike/mcp-servers/scripts/extract-tools.mjs (TypeScript-AST-based tool name/description extractor, reads src/index.ts registerTool() calls plus the two shared license tools from packages/mcp-license/dist/index.js)
- /Users/mike/mcp-servers/scripts/gen-manifest.mjs (manifest.json writer)

cost: 19 wall minutes

failures:
- System `/bin/bash` on this machine is 3.2.57 (no associative arrays); `declare -A` failed with `time: unbound variable` (misparsed `[time-tracker]` subscript). Fixed by pinning the shebang to `/opt/homebrew/bin/bash` (5.3.9), which is present.
- Naive regex/description extraction missed `price-tracker`'s `alerts_pending` tool, whose `description` is a template literal with a `${DROP_ALERT_PCT}` interpolation, not a plain string. Fixed by parsing src/index.ts with the TypeScript compiler API (already a repo devDependency) and resolving simple top-level `const` numeric/string literals inside template expressions.
- `npm install --omit=dev` inside `bundles/<name>/server/` (no lockfile, no workspace context) pulls in `@modelcontextprotocol/sdk`'s own transitive deps (express, hono, ajv, fontkit for pdfkit, etc.), which is why unpacked sizes run 9.7-21MB despite each server's own dist being 28-72KB; this is expected sdk footprint, not bundle bloat from this task. `npm install` also overwrites/symlinks the vendored `@theluckystrike/mcp-license` dir since it isn't on the npm registry, so the script re-vendors it (copy dist/package.json again) after every `npm install`.

insight: the mcpb v0.2 schema's `user_config` entries require `type`, `title`, `description` (not just `type`); `env` values reference config with `${user_config.<key>}` string interpolation (confirmed by grepping the mcpb CLI's own `dist/shared/config.js`, which builds `user_config.${key}` lookups), not a nested object reference.

## Update: office-suite standalone bundle (2026-09-02)

status: DONE

goal: `scripts/build-mcpb.sh` now also produces `bundles/office-suite.mcpb`, a standalone Claude Desktop bundle that proxies all five sibling servers without depending on the monorepo layout or a prior `npm install` at the workspace root.

evidence:
- `servers/office-suite/src/index.ts` resolves each child as `../../<id>/dist/index.js` (monorepo) or `require.resolve("@theluckystrike/mcp-<id>/dist/index.js")` (installed). Neither exists in a packed `.mcpb`, so the build script now vendors, for `office-suite` only:
  - each sibling's `dist/` into `server/node_modules/@theluckystrike/mcp-<id>/dist/` with a minimal `package.json` (`name`, `version`, `type: module`, `main: dist/index.js`) so `require.resolve` finds it.
  - the shared `@theluckystrike/mcp-license` package the same way the existing per-server loop already does.
- `server/package.json`'s `dependencies` is the union of office-suite's own deps and all five siblings' runtime deps (`@modelcontextprotocol/sdk`, `zod`, `xlsx`, `pdfkit`), with `@theluckystrike/*` entries excluded (vendored, not installed) and a hard conflict check (throws if two children pin different versions of the same package — none did: sdk `^1.30.0`, zod `^3.25.0` were consistent across all five).
- `npm install --omit=dev --ignore-scripts --no-package-lock` ran once inside `bundles/office-suite/server/` for all merged deps; it clobbers the vendored `@theluckystrike/*` dirs (not on the npm registry), so the script re-vendors them a second time after install, same pattern as the existing `vendor_license` re-run.
- Tool list = union of `extract-tools.mjs` run once per sibling's `src/index.ts` (against `packages/mcp-license/dist/index.js`), deduped by tool name (the two license tools appear once even though each sibling's extraction includes them).
- `npx -y @anthropic-ai/mcpb validate manifest.json`: `Manifest schema validation passes!`
- `npx -y @anthropic-ai/mcpb pack . office-suite.mcpb`: `filename: mcp-office-suite-0.2.0.mcpb / package size: 10.7MB / unpacked size: 32.3MB / shasum: 2e50794d07a9018c6091e67ee08386ee8d5e32e0 / total files: 3314 / ignored (.mcpbignore) files: 1443`
- Verification: unpacked `office-suite.mcpb` into a fresh temp dir (`/private/tmp/.../os-verify`), ran `node server/index.js` from that dir with `initialize` + `notifications/initialized` + `tools/list` piped over stdin as JSON-RPC.
  - stderr: `mcp-office-suite ready, proxying [time-tracker, price-tracker, spreadsheet, invoice, expense-tracker], 49 tools` (49 feature-tool proxy entries plus 2 aggregate license tools handled directly by the server = 51 tools in `tools/list`).
  - `tools/list` returned 51 tools (>= the 48+ target): 11 time-tracker + 8 price-tracker + 8 spreadsheet + 10 invoice + 12 expense-tracker feature tools, plus `license_status`/`license_activate`.
  - `diff` between the sorted manifest tool-name list and the sorted live `tools/list` name list was empty (51/51 match).
  - No child crashed or fell back to "optional child not found" — all five spawned and connected inside the unpacked bundle.

artifacts:
- /Users/mike/mcp-servers/bundles/office-suite.mcpb (11,239,920 bytes)
- /Users/mike/mcp-servers/bundles/office-suite/manifest.json, /Users/mike/mcp-servers/bundles/office-suite/server/ (dist + merged node_modules + vendored @theluckystrike/mcp-{time-tracker,price-tracker,spreadsheet,invoice,expense-tracker,license})
- /Users/mike/mcp-servers/scripts/build-mcpb.sh (office-suite section appended after the per-server loop)
- /Users/mike/mcp-servers/servers/office-suite/server.mcpb.json (description updated from "four servers" to "five servers" now that expense-tracker is proxied too; `name` and `fileSha256: "TBD"` left unchanged, the real value is only known once the GitHub release asset exists)

failures:
- First attempt at the merged-dependencies `node -e` call passed `$CHILDREN` (unquoted, 5 words) and the output path as trailing positional args, then read `process.argv.slice(3)` for the children list — that slice ran to the end of argv and silently swallowed the output path as a sixth "child", producing a corrupt `path.join()` and `MODULE_NOT_FOUND`. Fixed with `process.argv.slice(3, -1)` to exclude the last (output path) argument.

cost: ~20 wall minutes
