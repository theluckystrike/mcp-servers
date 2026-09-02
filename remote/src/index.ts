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
import { createServer as createTimeTracker } from "./vendor/time-tracker/index.js";
import { createServer as createPriceTracker } from "./vendor/price-tracker/index.js";
import { createServer as createInvoice } from "./vendor/invoice/index.js";

export interface Env { REMOTE_DATA: KVNamespace }

const PUBLIC_KEY_B64 = "VZXpvTpJn2XzaEn9ijFXk1vjPjtZvzAHZazC0Z+0pHU=";
const GUIDE = "https://mcp.zovo.one/guides/mcp-server-free-vs-pro";
const ANON_TTL = 60 * 60 * 24 * 30;   // 30 days, refreshed on every write
const DOWNLOAD_TTL = 60 * 60;         // 1 hour
const RATE_LIMIT_FREE = 600;          // calls per hour per token
const RATE_LIMIT_PRO = 6000;

const FACTORIES: Record<string, () => McpServer> = {
  "time-tracker": createTimeTracker as () => McpServer,
  "price-tracker": createPriceTracker as () => McpServer,
  "invoice": createInvoice as () => McpServer,
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

async function flush(env: Env, tenant: string, server: string, files: Map<string, string>, before: string): Promise<void> {
  const obj: Record<string, string> = {};
  for (const [k, v] of files) if (!k.endsWith(".tmp")) obj[k] = v;
  const after = JSON.stringify(obj);
  if (after === before) return;
  await env.REMOTE_DATA.put(dataKey(tenant, server), after);
}

/* ----------------------------------------------------------------- index */

function indexDoc(base: string) {
  return {
    name: "mcp.zovo.one remote MCP endpoints",
    protocol: "MCP streamable HTTP (2025-06-18)",
    transport: "streamable-http",
    auth: {
      scheme: "Authorization: Bearer <token>",
      oauth: "none - this endpoint deliberately has no OAuth flow; a static bearer token is all a client needs",
      anonymous: { mint: `${base}/mcp/token`, format: "anon_<32 hex>", tier: "free", data_retention_days: 30, rate_limit: `${RATE_LIMIT_FREE}/hour` },
      pro: { buy: `${base}/buy/<product>`, format: "MCPL1.<payload>.<signature>", verified: "Ed25519, offline", rate_limit: `${RATE_LIMIT_PRO}/hour` },
      guide: GUIDE,
    },
    endpoints: [
      { name: "time-tracker", url: `${base}/mcp/time-tracker`, tools: ["timer_start", "timer_stop", "timer_status", "entry_add", "entry_list", "entry_delete", "project_set_rate", "report", "invoice_summary", "export_csv", "license_status", "license_activate"], free_limits: "reports cover the last 7 days, 2 rated projects" },
      { name: "price-tracker", url: `${base}/mcp/price-tracker`, tools: ["price_check", "watch_add", "watch_list", "watch_remove", "watch_refresh", "price_history", "price_add_manual", "alerts_pending", "license_status", "license_activate"], free_limits: "3 watches, last 30 observations per watch" },
      { name: "invoice", url: `${base}/mcp/invoice`, tools: ["business_set", "client_add", "client_list", "invoice_create", "invoice_from_hours", "invoice_list", "invoice_get", "invoice_mark_paid", "invoice_pdf", "overdue_report", "license_status", "license_activate"], free_limits: "3 invoices per calendar month, footer line on the rendered document" },
    ],
    not_hosted: [
      { name: "spreadsheet", reason: "reads and writes xlsx/csv files on your disk; there is nothing for a remote endpoint to open. Install it over stdio: npx -y @theluckystrike/mcp-spreadsheet" },
    ],
    stdio_install: "claude mcp add <name> -- npx -y @theluckystrike/mcp-<name>",
    remote_install: 'claude mcp add --transport http <name> https://mcp.zovo.one/mcp/<name> --header "Authorization: Bearer <token>"',
    source: "https://github.com/theluckystrike/mcp-servers",
  };
}

/* ---------------------------------------------------------------- worker */

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const base = `${url.protocol}//${url.host}`;
    const path = url.pathname.replace(/\/+$/, "") || "/mcp";

    if (path === "/mcp") return json(indexDoc(base));

    if (path === "/mcp/token") {
      if (req.method !== "GET" && req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      const token = "anon_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      await env.REMOTE_DATA.put(`tok:${token}`, String(Date.now()), { expirationTtl: ANON_TTL });
      return json({
        token,
        tier: "free",
        expires_in_days: 30,
        note: "Refreshed for another 30 days on every write. Send it as: Authorization: Bearer " + token,
        endpoints: [`${base}/mcp/time-tracker`, `${base}/mcp/price-tracker`, `${base}/mcp/invoice`],
        pro: `${base}/buy/bundle`,
        guide: GUIDE,
      });
    }

    const dl = path.match(/^\/mcp\/download\/([0-9a-f]{32})$/);
    if (dl) {
      const stored = await env.REMOTE_DATA.get(`dl:${dl[1]}`);
      if (stored === null) return json({ error: "not_found", message: "Download links are valid for one hour." }, 404);
      const { mime, body, filename } = JSON.parse(stored) as Download;
      return new Response(body, { headers: { "content-type": mime, "content-disposition": `inline; filename="${filename.replace(/"/g, "")}"` } });
    }

    const m = path.match(/^\/mcp\/([a-z-]+)$/);
    const product = m?.[1];
    if (!product || !FACTORIES[product]) {
      return json({ error: "not_found", index: `${base}/mcp` }, 404);
    }

    const auth = await authenticate(req, env, product);
    if (auth instanceof Response) return auth;
    const limited = await rateLimit(env, auth);
    if (limited) return limited;

    const files = await hydrate(env, auth.tenant, product);
    const before = JSON.stringify(Object.fromEntries([...files].filter(([k]) => !k.endsWith(".tmp"))));

    const rctx: RequestCtx = {
      tenant: auth.tenant, server: product, isPro: auth.isPro,
      files, dirs: new Set<string>(), downloads: [], baseUrl: base,
    };

    return await STORE.run(rctx, async () => {
      const server = FACTORIES[product]!();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,   // stateless: one server + one transport per request
        enableJsonResponse: true,
      });
      try {
        await server.connect(transport);
        const res = await transport.handleRequest(req);
        for (const d of rctx.downloads) {
          await env.REMOTE_DATA.put(`dl:${d.token}`, JSON.stringify(d), { expirationTtl: DOWNLOAD_TTL });
        }
        await flush(env, auth.tenant, product, files, before);
        if (auth.kind === "anon" && rctx.downloads.length + files.size > 0) {
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
