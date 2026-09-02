# mcp-servers — build contract (all agents read this first)

Owner handle: theluckystrike (GitHub https://github.com/theluckystrike). Support: support@zovo.one.
Brand line for READMEs: "Built by theluckystrike".
NO EMOJIS anywhere (code, docs, dashboard, commit messages).

## Stack (fixed)
- TypeScript, ESM ("type":"module"), Node >= 18. `@modelcontextprotocol/sdk` ^1.30.0 + `zod`.
- No native deps (no better-sqlite3, no sharp). Pure JS only so `npx` works everywhere.
- npm workspaces root at /Users/mike/mcp-servers (package.json at root; workspaces: packages/*, servers/*).
- Package name: `@theluckystrike/mcp-<name>`; bin name `mcp-<name>`; entry `dist/index.js` with `#!/usr/bin/env node`.
- tsconfig: strict, module NodeNext, target ES2022, outDir dist, rootDir src.
- Transport: stdio via `StdioServerTransport`. Use `McpServer` + `server.registerTool(name, {title, description, inputSchema}, handler)`.
- Tool results: `{ content:[{type:"text", text}] }`; errors: `{ content:[{type:"text", text:"Error: ..."}], isError:true }`. Never throw across the transport.
- Storage: JSON files under `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/<name>/`. Write atomically (tmp + rename).
- Logging: stderr only. NEVER write to stdout except the protocol.

## Licensing (shared package `@theluckystrike/mcp-license`, already in packages/mcp-license)
- import { createLicenseGate } from "@theluckystrike/mcp-license";
  const gate = createLicenseGate({ product: "<name>" });
  gate.isPro() -> boolean; gate.status() -> object; gate.activate(key) -> {ok, reason}
  gate.upgradeText(feature) -> string with checkout URL to return to the user.
- Every server registers two tools: `license_status` and `license_activate` (via gate.registerTools(server)).
- Key lookup order: MCP_LICENSE_KEY env -> ~/.config/mcp-servers/license.json -> free tier.
- Free tier must be genuinely useful. Pro removes limits. Limits are listed per server in each README.
- Checkout URL base: https://mcp.zovo.one/buy/<product>  (product ids: time-tracker, price-tracker, spreadsheet, invoice, bundle).
- Prices: $19 one-time per server, $39 bundle (all servers, lifetime).

## Required files per server (servers/<name>/)
- src/index.ts, package.json, tsconfig.json, README.md, LICENSE (MIT), server.json (official MCP registry schema
  https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json, name "io.github.theluckystrike/<name>"),
  smithery.yaml (runtime: typescript or startCommand stdio), Dockerfile (node:22-alpine, build, CMD node dist/index.js),
  test/smoke.test.mjs (node:test; spawns dist/index.js, runs initialize + tools/list + one tools/call over stdio JSON-RPC).
- README sections: what it does (one paragraph, user language), install snippets for Claude Desktop / Claude Code (`claude mcp add`) / Cursor,
  tool list table, free vs pro table, "Get Pro" link, privacy line (all data stays local), Built by theluckystrike link.
- `npm run build` clean, `npm test` green. Record measured timings in RESULT.md (schema below).

## RESULT.md schema (write to servers/<name>/RESULT.md or the unit dir)
status: DONE|PARTIAL|BLOCKED
evidence: commands run + outputs (verbatim, short)
artifacts: paths
cost: wall minutes
failures: what broke and how fixed
insight: one measured, non-obvious thing

## Hard rules
- Zero paid API calls. No external API keys. Network only to public pages when the tool itself needs it (price-tracker fetch).
- Do not touch anything outside /Users/mike/mcp-servers except reading. Do not run npm publish / git push (orchestrator does).
- Do not use the Desktop folder (iCloud, dataless). Do not run `killall` or `ps aux`.
- Use `npm_config_cache=/Users/mike/.npm-cache-local` for every npm command.
- Cold, precise, measured. No adjectives in RESULT.md.
Test script convention: "test": "node --test test/*.test.mjs"
