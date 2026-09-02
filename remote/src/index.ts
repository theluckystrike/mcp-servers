/**
 * mcp-remote: the four stdio servers' tool sets served over MCP streamable HTTP.
 *
 * One Worker, three endpoints. Every POST builds a fresh McpServer and a fresh
 * stateless WebStandardStreamableHTTPServerTransport, hydrates an in-memory
 * filesystem from KV, runs the request, then flushes the filesystem back to KV.
 * The tool handlers are the vendored, unmodified handlers of servers/<name>.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { STORE, type RequestCtx, type Download } from "./shims/ctx.js";
import { TMP_RE } from "./shims/fs.js";
import { createServer as createTimeTracker } from "./vendor/time-tracker/index.js";
import { createServer as createPriceTracker } from "./vendor/price-tracker/index.js";
import { createServer as createInvoice } from "./vendor/invoice/index.js";
import { createServer as createExpenseTracker } from "./vendor/expense-tracker/index.js";
import { createServer as createSpreadsheet } from "./vendor/spreadsheet/index.js";

export interface Env { REMOTE_DATA: KVNamespace; SWEEP_SECRET?: string }

const PUBLIC_KEY_B64 = "VZXpvTpJn2XzaEn9ijFXk1vjPjtZvzAHZazC0Z+0pHU=";
const GUIDE = "https://mcp.zovo.one/guides/mcp-server-free-vs-pro";
const ANON_TTL = 60 * 60 * 24 * 30;   // 30 days, refreshed on every write
const DOWNLOAD_TTL = 60 * 60;         // 1 hour
const RATE_LIMIT_FREE = 600;          // calls per hour per token
const RATE_LIMIT_PRO = 6000;
const SWEEP_AFTER_DAYS = 35;          // orphan sweep: docs untouched this long are deleted
const SPREADSHEET_MAX_BYTES = 2 * 1024 * 1024;   // inline-data mode, per token
const DEFAULT_MAX_BYTES = 512 * 1024;            // stored document per token per endpoint
const MAX_BODY_BYTES = 256 * 1024;               // request body ceiling
const TOKEN_MINTS_PER_IP = 10;                   // anonymous tokens per hour per client IP

interface ServerCfg {
  factory: () => McpServer;
  /** Which finished atomic writes become one-hour download links. */
  publish?: (path: string) => boolean;
  /** Keep published outputs in the tenant document, or treat them as transient downloads. */
  persistPublished?: boolean;
  /** Ceiling on the tenant document for this endpoint. */
  maxBytes?: number;
}

const SERVERS: Record<string, ServerCfg> = {
  "time-tracker": {
    factory: createTimeTracker as () => McpServer,
    publish: (p) => p.endsWith(".csv"),
  },
  "price-tracker": { factory: createPriceTracker as () => McpServer },
  "invoice": { factory: createInvoice as () => McpServer },
  "expense-tracker": {
    factory: createExpenseTracker as () => McpServer,
    // Everything the export tool writes; never the ledger itself.
    publish: (p) => !p.endsWith("/data.json") && !p.endsWith(".lock"),
  },
  "spreadsheet": {
    factory: createSpreadsheet as () => McpServer,
    // Inline-data mode: every tool output is a download, and outputs stay under
    // /sheets/ so a follow-up call can open them by name.
    publish: () => true,
    persistPublished: true,
    maxBytes: SPREADSHEET_MAX_BYTES,
  },
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

/* ------------------------------------------------------------------ auth */

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let keyPromise: Promise<CryptoKey> | null = null;
function publicKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey("raw", b64urlToBytes(PUBLIC_KEY_B64), { name: "Ed25519" }, false, ["verify"]);
  return keyPromise;
}

interface Auth { tenant: string; isPro: boolean; kind: "license" | "anon"; limit: number }

/** Verify an MCPL1 key exactly the way packages/mcp-license does, with WebCrypto. */
async function verifyLicense(key: string, product: string): Promise<{ ok: boolean; reason?: string; id?: string; p?: string }> {
  const parts = key.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "MCPL1") return { ok: false, reason: "malformed key" };
  let payload: any;
  try { payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))); }
  catch { return { ok: false, reason: "bad payload" }; }
  let sigOk = false;
  try {
    sigOk = await crypto.subtle.verify({ name: "Ed25519" }, await publicKey(),
      b64urlToBytes(parts[2]), new TextEncoder().encode(parts[1]));
  } catch { sigOk = false; }
  if (!sigOk) return { ok: false, reason: "signature invalid" };
  if (payload?.v !== 1 || typeof payload.p !== "string" || typeof payload.id !== "string") return { ok: false, reason: "bad payload" };
  if (payload.p !== "*" && payload.p !== product) return { ok: false, reason: `key is for ${payload.p}, not ${product}` };
  if (payload.exp !== undefined && payload.exp <= Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };
  return { ok: true, id: payload.id, p: payload.p };
}

async function authenticate(req: Request, env: Env, product: string): Promise<Auth | Response> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return json({
      error: "unauthorized",
      message: "This endpoint needs an Authorization: Bearer token. Two kinds are accepted.",
      options: [
        { kind: "anonymous", how: "GET https://mcp.zovo.one/mcp/token", tier: "free", limits: "600 calls/hour, free-tier server limits, data kept 30 days" },
        { kind: "pro", how: "Buy a key at https://mcp.zovo.one/buy/" + product + " and send it as the bearer token", tier: "pro", limits: "6000 calls/hour, no server limits" },
      ],
      guide: GUIDE,
    }, 401, { "www-authenticate": `Bearer realm="mcp.zovo.one", error="invalid_token"` });
  }
  if (token.startsWith("MCPL1.")) {
    const r = await verifyLicense(token, product);
    if (!r.ok) return json({ error: "invalid_license", reason: r.reason, guide: GUIDE }, 401);
    return { tenant: `lic:${r.id}`, isPro: true, kind: "license", limit: RATE_LIMIT_PRO };
  }
  if (/^anon_[0-9a-f]{32}$/.test(token)) {
    const seen = await env.REMOTE_DATA.get(`tok:${token}`);
    if (seen === null) return json({ error: "unknown_token", message: "Mint a new one at GET https://mcp.zovo.one/mcp/token", guide: GUIDE }, 401);
    return { tenant: `anon:${token.slice(5)}`, isPro: false, kind: "anon", limit: RATE_LIMIT_FREE };
  }
  return json({ error: "invalid_token", message: "Token is neither an MCPL1 licence key nor an anonymous token.", guide: GUIDE }, 401);
}

async function rateLimit(env: Env, auth: Auth): Promise<Response | null> {
  const bucket = Math.floor(Date.now() / 3_600_000);
  const key = `rl:${auth.tenant}:${bucket}`;
  const n = Number((await env.REMOTE_DATA.get(key)) ?? "0") + 1;
  if (n > auth.limit) {
    return json({ error: "rate_limited", limit: auth.limit, window: "1 hour", guide: GUIDE }, 429, { "retry-after": "3600" });
  }
  await env.REMOTE_DATA.put(key, String(n), { expirationTtl: 7200 });
  return null;
}

/* --------------------------------------------------------------- storage */

const dataKey = (tenant: string, server: string) => `${tenant}:${server}`;

async function hydrate(env: Env, tenant: string, server: string): Promise<Map<string, string>> {
  const raw = await env.REMOTE_DATA.get(dataKey(tenant, server));
  const files = new Map<string, string>();
  if (raw) {
    try {
      for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>)) files.set(k, v);
    } catch { /* corrupt doc: start empty rather than fail the request */ }
  }
  return files;
}

/** The set of files that persist: no scratch files, and no transient download outputs. */
function persistable(files: Map<string, string>, cfg: ServerCfg, published: Map<string, string>): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of files) {
    if (TMP_RE.test(k)) continue;
    if (published.has(k) && !cfg.persistPublished) continue;
    obj[k] = v;
  }
  return obj;
}

async function flush(env: Env, tenant: string, server: string, after: string, before: string): Promise<void> {
  if (after === before) return;
  await env.REMOTE_DATA.put(dataKey(tenant, server), after);
}

/** Last-seen stamp for the orphan sweep. Data documents carry no TTL; tokens do. */
async function touch(env: Env, tenant: string): Promise<void> {
  await env.REMOTE_DATA.put(`meta:${tenant}`, JSON.stringify({ last_seen: Date.now() }));
}

/* ----------------------------------------------------------------- index */

const TOOLS: Record<string, string[]> = {
  "time-tracker": ["timer_start", "timer_stop", "timer_status", "entry_add", "entry_list", "entry_delete", "entry_edit", "project_set_rate", "report", "invoice_summary", "export_csv", "license_status", "license_activate"],
  "price-tracker": ["price_check", "watch_add", "watch_list", "watch_remove", "watch_refresh", "price_history", "price_add_manual", "alerts_pending", "license_status", "license_activate"],
  "invoice": ["business_set", "client_add", "client_list", "invoice_create", "invoice_from_hours", "invoice_list", "invoice_get", "invoice_mark_paid", "invoice_pdf", "overdue_report", "license_status", "license_activate"],
  "expense-tracker": ["expense_add", "expense_list", "expense_update", "expense_delete", "receipt_attach", "category_rules", "expense_settings", "expense_summary", "mileage_add", "expense_export", "expense_to_invoice", "license_status", "license_activate"],
  "spreadsheet": ["sheet_load", "sheet_files", "sheet_unload", "sheet_info", "sheet_read", "sheet_query", "sheet_stats", "sheet_find", "sheet_add_column", "sheet_convert", "sheet_write", "license_status", "license_activate"],
};

const ENDPOINT_URLS = (base: string) => Object.keys(SERVERS).map((n) => `${base}/mcp/${n}`);

function indexDoc(base: string) {
  return {
    name: "mcp.zovo.one remote MCP endpoints",
    protocol: "MCP streamable HTTP (2025-06-18)",
    transport: "streamable-http",
    auth: {
      scheme: "Authorization: Bearer <token>",
      oauth: "none - this endpoint deliberately has no OAuth flow; a static bearer token is all a client needs",
      anonymous: { mint: `${base}/mcp/token`, format: "anon_<32 hex>", tier: "free", data_retention_days: 30, rate_limit: `${RATE_LIMIT_FREE}/hour`, mint_rate_limit: `${TOKEN_MINTS_PER_IP}/hour per client IP` },
      pro: { buy: `${base}/buy/<product>`, format: "MCPL1.<payload>.<signature>", verified: "Ed25519, offline", rate_limit: `${RATE_LIMIT_PRO}/hour` },
      guide: GUIDE,
    },
    endpoints: [
      { name: "time-tracker", url: `${base}/mcp/time-tracker`, tools: TOOLS["time-tracker"], free_limits: "reports cover the last 7 days, 2 rated projects", notes: "export_csv returns a download link valid for one hour instead of a local file path" },
      { name: "price-tracker", url: `${base}/mcp/price-tracker`, tools: TOOLS["price-tracker"], free_limits: "3 watches, last 30 observations per watch", notes: "public http/https pages only; private, loopback, link-local and metadata addresses are refused, before and after every redirect" },
      { name: "invoice", url: `${base}/mcp/invoice`, tools: TOOLS["invoice"], free_limits: "3 invoices per calendar month, footer line on the rendered document", notes: "invoice_pdf renders a print-ready HTML document behind a one-hour download link" },
      { name: "expense-tracker", url: `${base}/mcp/expense-tracker`, tools: TOOLS["expense-tracker"], free_limits: "last 30 days, 3 projects, 5 category rules, 200 export rows, 20 rebill items per call, csv/json export (xlsx is Pro)", notes: "expense_export returns a download link valid for one hour (xlsx is delivered as the real binary workbook). receipt_attach is not available: this endpoint has no filesystem, so attach receipts with the stdio server" },
      {
        name: "spreadsheet", url: `${base}/mcp/spreadsheet`, tools: TOOLS["spreadsheet"],
        mode: "inline data",
        how: "There is no disk here, so you send the data instead of a path: sheet_load {name, csv} or sheet_load {name, xlsx_base64} stores it under your token, and every other tool takes that name as its `path` argument. sheet_files lists what is loaded, sheet_unload deletes one.",
        outputs: "sheet_convert, sheet_write and sheet_add_column write into the same per-token store and return a download link valid for one hour; xlsx comes back as the real binary workbook.",
        free_limits: "5,000 rows and 5 MB read per sheet, 500 rows written per file",
        storage: `${SPREADSHEET_MAX_BYTES / 1048576} MB of loaded sheets per token`,
      },
    ],
    limits: {
      request_body_bytes: MAX_BODY_BYTES,
      jsonrpc_batching: "not accepted - send one request object per POST",
      stored_bytes_per_token_per_endpoint: { default: DEFAULT_MAX_BYTES, spreadsheet: SPREADSHEET_MAX_BYTES },
      download_ttl_seconds: DOWNLOAD_TTL,
      idle_data_retention_days: SWEEP_AFTER_DAYS,
    },
    stdio_install: "claude mcp add <name> -- npx -y @theluckystrike/mcp-<name>",
    remote_install: 'claude mcp add --transport http <name> https://mcp.zovo.one/mcp/<name> --header "Authorization: Bearer <token>"',
    source: "https://github.com/theluckystrike/mcp-servers",
  };
}

/* ------------------------------------------------------------ orphan sweep */

/**
 * Anonymous tokens carry a 30-day TTL and disappear on their own; the data documents
 * they wrote do not. Every authenticated request stamps meta:<tenant>; this deletes
 * `${tenant}:*` and the stamp once nothing has touched the tenant for SWEEP_AFTER_DAYS.
 */
async function sweep(env: Env): Promise<{ scanned: number; expired: number; deleted: number }> {
  const cutoff = Date.now() - SWEEP_AFTER_DAYS * 86_400_000;
  let scanned = 0, expired = 0, deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await env.REMOTE_DATA.list({ prefix: "meta:", cursor, limit: 1000 });
    for (const k of page.keys) {
      scanned++;
      const tenant = k.name.slice("meta:".length);
      if (!tenant) continue;
      let lastSeen = 0;
      try { lastSeen = Number(JSON.parse((await env.REMOTE_DATA.get(k.name)) ?? "{}").last_seen ?? 0); } catch { lastSeen = 0; }
      if (lastSeen > cutoff) continue;
      expired++;
      let dc: string | undefined;
      do {
        const docs = await env.REMOTE_DATA.list({ prefix: `${tenant}:`, cursor: dc, limit: 1000 });
        for (const d of docs.keys) { await env.REMOTE_DATA.delete(d.name); deleted++; }
        dc = docs.list_complete ? undefined : docs.cursor;
      } while (dc);
      await env.REMOTE_DATA.delete(k.name);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return { scanned, expired, deleted };
}

/* ---------------------------------------------------------------- worker */

/** Reject a JSON-RPC batch before the SDK sees it: one POST is one operation here. */
function isBatch(body: string): boolean {
  for (const ch of body) {
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") continue;
    return ch === "[";
  }
  return false;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sweep(env).then((r) => console.log(`sweep: ${JSON.stringify(r)}`)));
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const base = `${url.protocol}//${url.host}`;
    const path = url.pathname.replace(/\/+$/, "") || "/mcp";

    if (path === "/mcp") return json(indexDoc(base));

    if (path === "/mcp/admin/sweep") {
      const secret = env.SWEEP_SECRET;
      if (!secret || req.headers.get("x-sweep-secret") !== secret) {
        return json({ error: "not_found", index: `${base}/mcp` }, 404);
      }
      return json({ ok: true, ...(await sweep(env)), older_than_days: SWEEP_AFTER_DAYS });
    }

    if (path === "/mcp/token") {
      if (req.method !== "GET" && req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      const bucket = Math.floor(Date.now() / 3_600_000);
      const mintKey = `mint:${ip}:${bucket}`;
      const minted = Number((await env.REMOTE_DATA.get(mintKey)) ?? "0") + 1;
      if (minted > TOKEN_MINTS_PER_IP) {
        return json({
          error: "rate_limited",
          message: `This address has minted ${TOKEN_MINTS_PER_IP} anonymous tokens in the last hour, which is the limit. Reuse the token you already have: one token is one data space, and it is refreshed for another 30 days on every write.`,
          limit: TOKEN_MINTS_PER_IP, window: "1 hour", guide: GUIDE,
        }, 429, { "retry-after": "3600" });
      }
      await env.REMOTE_DATA.put(mintKey, String(minted), { expirationTtl: 7200 });
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      const token = "anon_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      await env.REMOTE_DATA.put(`tok:${token}`, String(Date.now()), { expirationTtl: ANON_TTL });
      return json({
        token,
        tier: "free",
        expires_in_days: 30,
        note: "Refreshed for another 30 days on every write. Send it as: Authorization: Bearer " + token,
        endpoints: ENDPOINT_URLS(base),
        pro: `${base}/buy/bundle`,
        guide: GUIDE,
      });
    }

    const dl = path.match(/^\/mcp\/download\/([0-9a-f]{32})$/);
    if (dl) {
      const stored = await env.REMOTE_DATA.get(`dl:${dl[1]}`);
      if (stored === null) return json({ error: "not_found", message: "Download links are valid for one hour." }, 404);
      const { mime, body, filename, encoding } = JSON.parse(stored) as Download;
      const payload: BodyInit = encoding === "base64" ? b64urlToBytes(body.replace(/\+/g, "-").replace(/\//g, "_")) : body;
      return new Response(payload, {
        headers: {
          "content-type": mime,
          "content-disposition": `${encoding === "base64" ? "attachment" : "inline"}; filename="${filename.replace(/"/g, "")}"`,
        },
      });
    }

    const m = path.match(/^\/mcp\/([a-z-]+)$/);
    const product = m?.[1];
    const cfg = product ? SERVERS[product] : undefined;
    if (!product || !cfg) {
      return json({ error: "not_found", index: `${base}/mcp` }, 404);
    }

    const auth = await authenticate(req, env, product);
    if (auth instanceof Response) return auth;
    const limited = await rateLimit(env, auth);
    if (limited) return limited;

    // Body cap and batch rejection happen before anything is parsed as JSON-RPC.
    let request = req;
    if (req.method === "POST") {
      const declared = Number(req.headers.get("content-length") ?? "0");
      if (declared > MAX_BODY_BYTES) {
        return json({ error: "payload_too_large", limit_bytes: MAX_BODY_BYTES, message: `The request body is ${declared} bytes; this endpoint accepts ${MAX_BODY_BYTES}. Send less data per call - for spreadsheet, load a smaller sheet or run the server locally over stdio.` }, 413);
      }
      const body = await req.text();
      if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
        return json({ error: "payload_too_large", limit_bytes: MAX_BODY_BYTES }, 413);
      }
      if (isBatch(body)) {
        return json({
          jsonrpc: "2.0", id: null,
          error: { code: -32600, message: "JSON-RPC batching is not supported on this endpoint. Send one request object per POST." },
        }, 400);
      }
      request = new Request(req.url, { method: "POST", headers: req.headers, body });
    }

    const files = await hydrate(env, auth.tenant, product);
    const maxBytes = cfg.maxBytes ?? DEFAULT_MAX_BYTES;

    const rctx: RequestCtx = {
      tenant: auth.tenant, server: product, isPro: auth.isPro,
      files, dirs: new Set<string>(), downloads: [], baseUrl: base,
      publish: cfg.publish, published: new Map<string, string>(), maxBytes,
    };
    const before = JSON.stringify(persistable(files, cfg, rctx.published));

    return await STORE.run(rctx, async () => {
      const server = cfg.factory();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,   // stateless: one server + one transport per request
        enableJsonResponse: true,
      });
      try {
        await server.connect(transport);
        let res = await transport.handleRequest(request);
        for (const d of rctx.downloads) {
          await env.REMOTE_DATA.put(`dl:${d.token}`, JSON.stringify(d), { expirationTtl: DOWNLOAD_TTL });
        }
        // The tool handlers report the virtual path they wrote; the caller gets the link.
        // The virtual root is an implementation detail, so it never reaches the caller:
        // in inline-data mode a sheet is known by the name it was loaded under.
        if (rctx.published.size > 0 || product === "spreadsheet") {
          let out = await res.text();
          for (const [p2, u] of [...rctx.published].sort((a, b) => b[0].length - a[0].length)) {
            out = out.split(p2).join(`${u} (valid 1 hour)`);
          }
          if (product === "spreadsheet") out = out.split("/sheets/").join("");
          const h = new Headers(res.headers);
          h.delete("content-length");
          res = new Response(out, { status: res.status, headers: h });
        }
        await flush(env, auth.tenant, product, JSON.stringify(persistable(files, cfg, rctx.published)), before);
        await touch(env, auth.tenant);
        if (auth.kind === "anon") {
          await env.REMOTE_DATA.put(`tok:anon_${auth.tenant.slice(5)}`, String(Date.now()), { expirationTtl: ANON_TTL });
        }
        return res;
      } finally {
        await transport.close().catch(() => {});
        await server.close().catch(() => {});
      }
    });
  },
};
