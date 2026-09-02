status: DONE

evidence:
```
$ export npm_config_cache=/Users/mike/.npm-cache-local
$ npm install
changed 1 package, and audited 184 packages in 2s
$ npm run build -w servers/office-suite
> tsc -p tsconfig.json && node -e "...chmodSync('dist/index.js',0o755)"
(clean exit, 0.78s)
$ npm test -w servers/office-suite
TAP version 13
# Subtest: bundle proxies tools/list, forwards calls, and aggregates license_status
ok 1 - bundle proxies tools/list, forwards calls, and aggregates license_status
# pass 1
# fail 0
duration_ms 807
```
Smoke test asserts: tools/list contains timer_start, price_check, sheet_info, invoice_create;
exactly one license_status and one license_activate; timer_start and invoice_create succeed
through the proxy; license_status returns a "children" object keyed by all four child ids
(time-tracker, price-tracker, spreadsheet, invoice); an unknown tool name returns
isError:true with "unknown tool" text instead of throwing across the transport;
resources/list and prompts/list both return arrays (proxied, empty is fine when no
resource/prompt uri or name is queried).

artifacts:
- servers/office-suite/src/index.ts (low-level Server, not McpServer -- proxied tool
  inputSchema is raw per-child JSON Schema, which McpServer.registerTool cannot accept
  without re-deriving a zod shape, so tools/call, tools/list, resources/*, prompts/* are
  wired directly via setRequestHandler against the SDK's Server class)
- servers/office-suite/package.json, tsconfig.json
- servers/office-suite/README.md, LICENSE, server.json, server.mcpb.json, smithery.yaml,
  glama.json, llms-install.md, Dockerfile
- servers/office-suite/test/smoke.test.mjs

cost: 24 wall minutes

failures:
- git pull --rebase (as instructed) failed: the working tree already had unrelated
  uncommitted modifications outside servers/office-suite/ (bundles/*, dashboard/index.html,
  data/*.json, docs/FORMS_RESULT.md) left by other work in this repo, and local HEAD was
  already one commit ahead of origin/main. Rebase could not proceed without touching files
  this task was told not to edit. Resolution: skipped the rebase (nothing new existed
  upstream to rebase onto -- origin/main was an ancestor of local HEAD), and pushed only
  after staging exactly the servers/office-suite/ paths, leaving every other modified file
  untouched in the working tree.
- initial StdioClientTransport child-crash handling reached into a private `_process`
  field; replaced with the transport's public `onclose` callback, which the SDK's
  StdioClientTransport already calls from its own child.on('close') handler.

insight: the SDK's high-level McpServer.registerTool takes a Zod shape or Zod schema for
inputSchema, not an arbitrary JSON Schema object -- a generic proxy that re-exposes
children's tools verbatim (their JSON Schemas as reported by tools/list) has to drop to the
low-level Server class and answer ListToolsRequestSchema/CallToolRequestSchema/etc by hand;
none of the four sibling servers needed this because each one only ever defines schemas it
authored itself.
