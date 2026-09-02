# REMOTE_RESULT.md - hosted streamable-HTTP endpoints (INTEL R1)

status: DONE

## What shipped

A second Cloudflare Worker, `mcp-remote`, serving the tool sets of three of the four
stdio servers over MCP streamable HTTP on the domain the billing worker already owns.

| endpoint | tools | free limits |
|---|---|---|
| https://mcp.zovo.one/mcp/time-tracker | timer_start, timer_stop, timer_status, entry_add, entry_list, entry_delete, project_set_rate, report, invoice_summary, export_csv, license_status, license_activate | reports cover the last 7 days, 2 rated projects |
| https://mcp.zovo.one/mcp/price-tracker | price_check, watch_add, watch_list, watch_remove, watch_refresh, price_history, price_add_manual, alerts_pending, license_status, license_activate | 3 watches, last 30 observations per watch |
| https://mcp.zovo.one/mcp/invoice | business_set, client_add, client_list, invoice_create, invoice_from_hours, invoice_list, invoice_get, invoice_mark_paid, invoice_pdf, overdue_report, license_status, license_activate | 3 invoices per calendar month, footer line on the rendered document |
| https://mcp.zovo.one/mcp | JSON index: endpoints, auth model, the no-OAuth bearer note | - |
| https://mcp.zovo.one/mcp/token | mints `anon_<32 hex>`, free tier, 30-day KV TTL | - |

`spreadsheet` is not hosted: every one of its tools takes a path to an xlsx or csv file
on the caller's disk, so a remote endpoint has nothing to open. The index document says
so and points at the stdio install.

Worker: mcp-remote, version 434d8eac-7ae9-489f-afcc-869cdaf7a22b, also on
https://mcp-remote.lipmichal.workers.dev
KV namespace REMOTE_DATA id `cf848cc5c07d4e0a9c7c65ad1c70055c` (account dd3f2a29b7707e21a87f26a622c0bb9d).

## How the stdio logic is reused

`remote/build-vendor.mjs` copies `servers/<name>/src/*.ts` into `remote/src/vendor/<name>/`
and changes exactly three things:

1. `node:fs` and `node:os` are redirected to `remote/src/shims/`. The fs shim is an
   in-memory path -> string map held in an `AsyncLocalStorage` request context, so the
   servers' own store modules (atomic tmp+rename, counter file, lock file) run unmodified.
2. `@theluckystrike/mcp-license` is redirected to a shim whose `isPro()` reads the
   decision the worker already made from the bearer token, and whose `withFileLock` is a
   no-op (one request owns its virtual filesystem).
3. `index.ts`'s module body is wrapped in `export function createServer()` and the stdio
   boot block is dropped, so each POST gets a fresh `McpServer`.

No tool handler, schema, description, gating message or free-tier constant was rewritten.
The only hand-written substitution is the invoice PDF writer (see limitations).

Per request: authenticate -> rate-limit -> read KV `${tenant}:${server}` into the virtual
filesystem -> new `McpServer` + new stateless `WebStandardStreamableHTTPServerTransport`
(`sessionIdGenerator: undefined`, `enableJsonResponse: true`) -> `handleRequest` ->
write changed files back to KV -> close both.

KV document shape is `{ "<absolute virtual path>": "<file contents>" }`, and each file's
contents are byte-for-byte the JSON document the stdio server writes locally
(`data.json`, `watches.json`, `business.json`, `clients.json`, `invoices.json`,
`counter.json`), so a tenant's remote state is portable to a local install and back.

## Auth

`Authorization: Bearer <token>`, no OAuth.

- `MCPL1.<payload>.<sig>` - a Pro key, verified with WebCrypto Ed25519 against the same
  public key as `packages/mcp-license` (`VZXpvTpJn2XzaEn9ijFXk1vjPjtZvzAHZazC0Z+0pHU=`),
  including the `p === "*" || p === product` and `exp` checks. tenant `lic:<license id>`,
  Pro limits, 6000 calls/hour.
- `anon_<32 hex>` from `GET /mcp/token`. tenant `anon:<hex>`, free limits, 600 calls/hour,
  KV TTL 30 days refreshed on every write.
- No token -> 401 with a JSON body naming both options and linking
  https://mcp.zovo.one/guides/mcp-server-free-vs-pro

Rate limiting is a KV counter `rl:<tenant>:<unix hour>` with a 2-hour TTL.

## evidence

Route precedence (mcp-billing keeps the custom domain, this worker takes /mcp*):

```
$ curl -s -o /dev/null -w "%{http_code}" https://mcp.zovo.one/
200                                   # still the billing worker
$ curl -s https://mcp.zovo.one/mcp | head -3
{ "name": "mcp.zovo.one remote MCP endpoints", "protocol": "MCP streamable HTTP (2025-06-18)",
$ curl -s https://mcp.zovo.one/mcp/token
{ "token": "anon_e717f1b27e469a5bc4e7b081d0d43f22", "tier": "free", "expires_in_days": 30, ...
$ curl -s -o /dev/null -w "%{http_code}" -X POST https://mcp.zovo.one/mcp/invoice -d '{}'
401                                   # body lists the anonymous and Pro options
```

MCP over the wire (initialize + tools/list + tools/call per endpoint, fetch-based
JSON-RPC client, `Authorization: Bearer anon_e717...`):

```
time-tracker  initialize  -> serverInfo {"name":"time-tracker","version":"0.1.0"}
time-tracker  tools/list  -> 12 tools, schemas identical to the stdio build
time-tracker  timer_start -> Started timer for "acme" - remote endpoint at 2026-09-02T14:02:56.605Z. Rate EUR 90.00 per hour.
time-tracker  timer_status(separate POST) -> Running: "acme" - remote endpoint for 00:00:05
              # state survived the request boundary: KV round trip works

price-tracker price_check -> Title: A Light in the Attic | Books to Scrape - Sandbox
                             Price: 51.77 GBP  Confidence: low (source regex-fallback)
price-tracker watch_add   -> Watching attic as 72724a30. Target: 40 GBP
price-tracker watch_list  -> Tier: free (1/3 watches used) [{ "id": "72724a30", ... }]

invoice       business_set     -> Business profile saved
invoice       client_add       -> Added client Acme GmbH (8b09430c).
invoice       invoice_from_hours -> Created invoice INV-2026-0001, total EUR 1107.00 (23% tax on EUR 900.00)
invoice       invoice_pdf      -> Download (HTML, valid 1 hour): https://mcp.zovo.one/mcp/download/4cec90f3...
$ curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}" <that url>
200 text/html; charset=utf-8 1668
              # contains "INVOICE INV-2026-0001", "EUR 1107.00", the free-tier footer
```

Pro key (signed locally with scripts/sign-license.mjs, product "*"):

```
price-tracker license_status -> { "product": "price-tracker", "tier": "pro",
                                  "transport": "remote streamable-http",
                                  "tenant": "lic:de6afabb4430" }
```

Real MCP client:

```
$ claude mcp add --transport http --scope local tt  https://mcp.zovo.one/mcp/time-tracker  --header "Authorization: Bearer anon_e717..."
$ claude mcp add --transport http --scope local inv https://mcp.zovo.one/mcp/invoice       --header ...
$ claude mcp add --transport http --scope local pt  https://mcp.zovo.one/mcp/price-tracker --header ...
$ claude mcp list
tt:  https://mcp.zovo.one/mcp/time-tracker  (HTTP) - Connected
inv: https://mcp.zovo.one/mcp/invoice       (HTTP) - Connected
pt:  https://mcp.zovo.one/mcp/price-tracker (HTTP) - Connected
```

(run in a scratch directory with --scope local, then removed.)

`servers/<name>/remotes.json` validated against
https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json
`#/definitions/RemoteTransport` with python jsonschema: valid. The file is not merged into
server.json here - another process owns that file.

## artifacts

- remote/wrangler.toml, remote/package.json, remote/build-vendor.mjs
- remote/src/index.ts (router, auth, rate limit, KV storage, index document)
- remote/src/shims/{ctx,fs,os,license,pdf}.ts
- remote/src/vendor/{time-tracker,price-tracker,invoice}/ (generated, checked in so the
  deploy does not depend on a build step)
- servers/{time-tracker,price-tracker,invoice}/remotes.json
- docs/REMOTE_RESULT.md

## limitations

1. **invoice_pdf returns HTML, not PDF.** pdfkit needs a real filesystem for its AFM font
   metrics and a writable stream; neither exists on Workers. `remote/src/shims/pdf.ts`
   renders the same document - issuer block, BILL TO, dates, line table, subtotal,
   discount, per-rate tax lines, total, balance due, payment details, notes, free-tier
   footer - as a self-contained A4 `@page` HTML document stored in KV under a random
   128-bit token and served from `/mcp/download/<token>` for one hour. The browser's
   Print to PDF produces the file. The stdio server still emits a true PDF.
2. **Last write wins per tenant.** The file lock is a no-op remotely; two concurrent
   clients on one token can lose a write. The stdio servers keep their advisory lock.
3. **Download links are unauthenticated** for their one-hour life: the 128-bit token is
   the capability. Nothing else in KV is reachable that way.
4. **The rate-limit counter is eventually consistent** (KV), so the 600/hour ceiling is
   approximate under bursts from several colos.
5. **spreadsheet is not hosted at all** - see above.
6. **No sitemap change.** The billing worker was left untouched; adding /mcp to its
   sitemap needs an edit inside billing/, which was out of scope for this unit.
7. Anonymous tenant data is dropped 30 days after the last write (the token key expires;
   the data document itself has no TTL and is orphaned - a future sweep should delete
   `${tenant}:*` when `tok:` expires).

## insight

The stdio servers turned out to be portable to Workers without touching a single tool
handler, because every one of them reaches the disk through exactly two modules
(`node:fs` and the licence gate). Redirecting those two imports at build time and holding
the "filesystem" in an AsyncLocalStorage request context converted 1,766 lines of
local-only server code into a hosted endpoint. The measured cost was the wrapper, not the
logic: the only hand-written replacement in the whole port is the PDF writer, and that is
because pdfkit reads its own font metrics off disk - the one filesystem use that is not
the server's own state.
