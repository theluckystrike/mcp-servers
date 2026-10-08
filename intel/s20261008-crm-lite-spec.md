# Spec: crm-lite MCP server (s20261008)

STATUS: complete — build-ready

## Background / rationale
- Picked in intel/s20261007-new-server-picks.md: HubSpot MCP tops the Skyvia 2026 list; estate gap in CRM tooling; fits the docx→pdf→invoice→e-sign paperwork chain.
- Deliberately vendor-free: zero external API deps, no HubSpot lock-in. Local-first CRM data (contacts, companies, notes) with search and CSV/JSON export. Small uncontested query fields are where the estate wins (CLAUDE.md GH_SEARCH_R2).

## House pattern (verified against servers/invoice)
- TypeScript, ESM (`"type":"module"`), Node >= 18. Deps: `@modelcontextprotocol/sdk` ^1.30.0, `zod` ^3.25.0, `@theluckystrike/mcp-license` ^0.22.5. No native deps, pure JS only.
- Package name `@theluckystrike/mcp-crm-lite`; bin `mcp-crm-lite`; entry `dist/index.js` with `#!/usr/bin/env node`; `"test": "node --test test/*.test.mjs"`.
- tsconfig: strict, module/moduleResolution NodeNext, target ES2022, outDir dist, rootDir src, skipLibCheck, types ["node"].
- index.ts: `McpServer` + `server.registerTool(name, {title, description, annotations, inputSchema}, handler)`; zod schemas for input; annotations per tool (`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint: false`).
- Results `{ content:[{type:"text", text}] }`; errors `{ content:[{type:"text", text:"Error: ..."}], isError:true }`. Never throw across the transport.
- Storage: JSON files under `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/crm-lite/`, atomic writes (tmp + rename), read-modify-write serialised via `withFileLock(dataDir/.lock)` from mcp-license.
- `createLicenseGate({ product: "crm-lite" })`; `gate.registerTools(server)` registers `license_status` + `license_activate`. Free tier genuinely useful; Pro removes limits via `gate.upgradeText(feature)`. Checkout base https://mcp.zovo.one/buy/<product> (new product id `crm-lite` must be registered with billing before Pro goes live).
- Logging stderr only; nothing on stdout but the protocol.
- Test convention (invoice/test/smoke.test.mjs): spawn dist/index.js with a mkdtemp XDG_DATA_HOME/XDG_CONFIG_HOME, run initialize + tools/list + one tools/call over stdio JSON-RPC (newline-delimited).
- Hosted: also served at `https://mcp.zovo.one/mcp/crm-lite` via remote/ (Cloudflare Worker, KV storage). Any tool-description change must be mirrored in remote/build-vendor.mjs exact-string patches (`/usr/bin/grep -n 'crm-lite <tool> description' remote/build-vendor.mjs`) or the build throws. `/mcp/<server>` answers initialize/tools/list without a token but refuses tools/call without one (Bearer header or `/t/<token>` path); tokens minted at `/mcp/connect`.
- Registry note: `(name, version)` immutable once published; one hosted URL binds one server name.

## Data model (JSON files in dataDir)
- `contacts.json`: `{ contacts: [{ id, first_name, last_name, email, phone, company_id?, title?, tags: string[], created_at, updated_at }] }`
- `companies.json`: `{ companies: [{ id, name, domain?, industry?, phone?, address?, notes_count derived, created_at, updated_at }] }`
- `notes.json`: `{ notes: [{ id, body, entity: "contact"|"company", entity_id, created_at }] }`
- `counter.json` or in-file id counters: incrementing IDs, never reuse (invoice house style).
- Free tier limit: 50 contacts, 10 companies, 200 notes (Pro unlimited).

## Tools (8, including the two license tools)
All zod input schemas; handler wraps results per house error convention.

1. `contact_add` — create contact. inputSchema: `{ first_name: string (min 1), last_name: string (optional, default ""), email: string email (optional), phone: string (optional), company_id: string (optional), title: string (optional), tags: string[] (optional) }`. Returns new contact JSON.
2. `contact_get` — read contact with its notes. inputSchema: `{ id: string }` or `{ email: string }` (oneOf). readOnly, idempotent.
3. `contact_update` — partial update by id. inputSchema: `{ id: string, first_name?, last_name?, email?, phone?, company_id? (nullable to clear), title?, tags? }`. Unknown id → Error text.
4. `contact_delete` — delete contact (cascade-deletes its notes). inputSchema: `{ id: string }`. destructiveHint: true.
5. `company_add` — create company. inputSchema: `{ name: string (min 1), domain?: string, industry?: string, phone?: string, address?: string }`.
6. `company_list` — list companies with contact counts, optional `{ name?: string }` substring filter. readOnly, idempotent.
7. `note_add` — attach note to contact or company. inputSchema: `{ entity: "contact"|"company", entity_id: string, body: string (min 1) }`.
8. `search` — cross-entity substring search (name, email, phone, tags, company name, note bodies), case-insensitive. inputSchema: `{ query: string (min 1), entity?: "contact"|"company"|"note"|"all" (default "all"), limit?: number (default 20, max 100) }`. readOnly, idempotent.
9. `export` — dump contacts/companies/notes as CSV or JSON text. inputSchema: `{ format: "csv"|"json" (default "csv"), entity: "contacts"|"companies"|"notes"|"all" (default "all") }`. CSV: header row + RFC-4180 quoting. readOnly, idempotent.
10. `license_status` + `license_activate` — via `gate.registerTools(server)`, not hand-written.

(Note: that is 9 hand-registered + 2 gate tools; if 8 must be the cap, drop `company_list` — `search` covers it. Recommendation: keep all 9, they are cheap.)

## File list (servers/crm-lite/)
| File | Purpose |
|---|---|
| `src/index.ts` | Entry: shebang, McpServer, license gate, register all tools, StdioServerTransport |
| `src/store.ts` | dataDir(), atomic read/write of contacts/companies/notes JSON, withFileLock serialisation, id allocation, free-tier limit checks |
| `src/csv.ts` | CSV escape/serialize helpers (RFC-4180 quoting) |
| `src/version.ts` | exported VERSION string |
| `package.json` | House fields: name @theluckystrike/mcp-crm-lite, bin, exports, engines >=18, scripts build/test, keywords, MIT |
| `tsconfig.json` | Copy of invoice tsconfig (strict, NodeNext, ES2022, dist/src) |
| `server.json` | Official MCP registry record, schema 2025-12-11 (fields below) |
| `smithery.yaml` | runtime: typescript, startCommand stdio, optional licenseKey configSchema (copy invoice) |
| `Dockerfile` | node:22-alpine, npm build, CMD node dist/index.js (copy invoice) |
| `README.md` | House sections: one-paragraph what-it-does, Claude Desktop / `claude mcp add` / Cursor install snippets, tool table, free-vs-pro table, Get Pro link, privacy line (all data stays local), Built by theluckystrike |
| `LICENSE` | MIT |
| `test/smoke.test.mjs` | Spawn dist over stdio: initialize + tools/list + contact_add/contact_list roundtrip in tmp XDG_DATA_HOME |
| `test/store.test.mjs` | Atomic write, lock serialisation, id monotonicity, corrupt-file recovery |
| `test/crud.test.mjs` | contact/company/note CRUD, cascade delete, unknown-id errors |
| `test/search-export.test.mjs` | search ranking, entity filter, CSV quoting (commas, quotes, newlines), JSON export |
| `test/license.test.mjs` | Free-tier limits enforced at 50 contacts, upgradeText returned, gate tools listed |

## server.json (registry fields)
```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.theluckystrike/crm-lite",
  "description": "Tiny local-first CRM: contacts, companies, notes, search and CSV export from your AI chat. No accounts, no cloud.",
  "version": "0.1.0",
  "repository": {
    "url": "https://github.com/theluckystrike/mcp-servers",
    "source": "github",
    "subfolder": "servers/crm-lite"
  },
  "websiteUrl": "https://mcp.zovo.one/s/crm-lite",
  "packages": [
    {
      "registryType": "mcpb",
      "identifier": "https://github.com/theluckystrike/mcp-servers/releases/download/v0.1.0/crm-lite.mcpb",
      "version": "0.1.0",
      "transport": { "type": "stdio" },
      "environmentVariables": [
        {
          "name": "MCP_LICENSE_KEY",
          "description": "Optional Pro license key (MCPL1....). Verified offline.",
          "isRequired": false,
          "isSecret": true
        }
      ],
      "fileSha256": "<fill at release>"
    }
  ]
}
```
- npm package.json mirrors invoice: description, keywords (`mcp`, `model-context-protocol`, `crm`, `contacts`, `freelance`, `small-business`), repository.directory `servers/crm-lite`, homepage tree URL.

## Test list (npm test, root must stay green)
1. smoke: initialize + tools/list exposes all 11 tools; contact_add returns a contact.
2. store: atomicity (tmp+rename), cross-process lock, id monotonic, corrupt JSON recovers to empty state not crash.
3. crud: add/get/update/delete for contacts and companies; note_add to bad entity_id → Error text, isError:true; contact_delete cascades notes.
4. search: matches across names/emails/tags/notes; entity + limit honored; case-insensitive.
5. export: CSV quoting of comma/quote/newline; JSON matches stored data; "all" includes every entity.
6. license: 51st contact blocked on free tier with upgrade text; MCP_LICENSE_KEY env lifts limit.

## Distribution hooks
- Directory categories: CRM / Sales / Contacts; also fits Freelance paperwork set (invoice companion).
- One-line listing description: "Local-first CRM for freelancers: contacts, companies, notes, search and CSV export — no accounts, no cloud, all data on disk."
- README SEO title: "MCP CRM Server — contacts, companies and notes for Claude, Cursor and any MCP client".
- README SEO description: "crm-lite is an open-source MCP server that gives your AI assistant a tiny local CRM: add and search contacts and companies, attach notes, export CSV or JSON. Local-first, MIT, zero external APIs."
- Hosted route: `https://mcp.zovo.one/mcp/crm-lite` (token-gated tools/call; mirror tool descriptions in remote/build-vendor.mjs before deploy).
- Free/Pro split: free = 50 contacts / 10 companies / 200 notes; Pro unlimited. New billing product id `crm-lite` at https://mcp.zovo.one/buy/crm-lite ($19; bundle unchanged $39).

## Build order (implementation notes, out of scope for this spec)
1. Scaffold from invoice tsconfig/package.json shape; store.ts first; then index.ts tools; then tests; `npm run build` clean + root `npm test` green.
2. Then wire remote/ (build-vendor.mjs patches + wrangler) and billing product before publishing hosted route.
