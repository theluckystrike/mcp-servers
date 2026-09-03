/**
 * mcp-remote: the stdio servers' tool sets served over MCP streamable HTTP.
 *
 * One Worker, eleven endpoints. Every POST builds a fresh McpServer and a fresh
 * stateless WebStandardStreamableHTTPServerTransport, hydrates an in-memory
 * filesystem from KV, runs the request, then flushes the filesystem back to KV.
 * The tool handlers are the vendored, unmodified handlers of servers/<name>.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { STORE, type RequestCtx, type Download } from "./shims/ctx.js";
import { TMP_RE, recount } from "./shims/fs.js";
import { createServer as createTimeTracker } from "./vendor/time-tracker/index.js";
import { createServer as createPriceTracker } from "./vendor/price-tracker/index.js";
import { createServer as createInvoice } from "./vendor/invoice/index.js";
import { createServer as createExpenseTracker } from "./vendor/expense-tracker/index.js";
import { createServer as createSpreadsheet } from "./vendor/spreadsheet/index.js";
import { createServer as createCurrency } from "./vendor/currency/index.js";
import { createServer as createTimezone } from "./vendor/timezone/index.js";
import { createServer as createDocx } from "./vendor/docx/index.js";
import { createServer as createResume } from "./vendor/resume/index.js";
import { createServer as createRecurring } from "./vendor/recurring/index.js";
import { createServer as createClauses } from "./vendor/clauses/index.js";

export interface Env { REMOTE_DATA: KVNamespace; SWEEP_SECRET?: string }

const PUBLIC_KEY_B64 = "VZXpvTpJn2XzaEn9ijFXk1vjPjtZvzAHZazC0Z+0pHU=";
const GUIDE = "https://mcp.zovo.one/guides/mcp-server-free-vs-pro";
const ANON_TTL = 60 * 60 * 24 * 30;   // 30 days, refreshed on every write
const DOWNLOAD_TTL = 60 * 60;         // 1 hour
const RATE_LIMIT_FREE = 600;          // calls per hour per token
const RATE_LIMIT_PRO = 6000;
const SWEEP_AFTER_DAYS = 35;          // orphan sweep: docs untouched this long are deleted
const SPREADSHEET_MAX_BYTES = 2 * 1024 * 1024;   // inline-data mode, per token
const DOCX_MAX_BYTES = 2 * 1024 * 1024;          // uploaded .docx templates, per token
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
  /** Which virtual paths belong in the tenant document at all. Default: all of them. */
  persist?: (path: string) => boolean;
  /**
   * A second tenant document this endpoint reads and writes. /mcp/recurring creates
   * invoices in the SAME invoice store /mcp/invoice serves, so it hydrates both keys
   * and flushes each path back to the document that owns it.
   */
  sharedDoc?: { server: string; owns: (path: string) => boolean };
}

/** The invoice server's data directory inside the virtual filesystem (homedir shim). */
const INVOICE_DIR = "/home/mcp/.local/share/mcp-servers/invoice/";

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
  "currency": {
    factory: createCurrency as () => McpServer,
    // The ECB files are one shared, cross-tenant cache (see hydrateEcb); this endpoint
    // keeps no per-token state at all, so nothing under /currency/ is ever persisted
    // into a tenant document - not the cache, and not a quarantine marker for it.
    persist: () => false,
  },
  "timezone": {
    factory: createTimezone as () => McpServer,
    publish: (p) => p.endsWith(".ics"),
  },
  "docx": {
    factory: createDocx as () => McpServer,
    // Uploaded templates (/uploads/) and the document register are the tenant's state;
    // everything this server writes lands under /docs/ and is a transient download.
    publish: (p) => p.startsWith("/docs/"),
    maxBytes: DOCX_MAX_BYTES,
  },
  "resume": {
    factory: createResume as () => McpServer,
    // The profile and the letter history are the tenant's state; uploads live under
    // /uploads/ and every generated resume, letter or HTML lands under /docs/ as a
    // transient download.
    publish: (p) => p.startsWith("/docs/"),
    maxBytes: DOCX_MAX_BYTES,
  },
  "recurring": {
    factory: createRecurring as () => McpServer,
    // Schedules and history are this endpoint's own document; the invoices it generates
    // belong to the invoice store, which /mcp/invoice serves for the same token.
    sharedDoc: { server: "invoice", owns: (p) => p.startsWith(INVOICE_DIR) },
  },
  "clauses": {
    factory: createClauses as () => McpServer,
    publish: (p) => p.startsWith("/docs/"),
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

/**
 * What may appear in a tenant id. KV keys are built as `${tenant}:${server}` and the
 * sweep deletes by the `${tenant}:` prefix, so a ":" or any other delimiter inside an
 * id would make one tenant's prefix a prefix of another's. Ids are refused, not
 * escaped: a licence with an unusable id is a minting mistake, not a caller mistake.
 */
const TENANT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

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
    if (!TENANT_ID_RE.test(r.id ?? "")) {
      return json({
        error: "invalid_license",
        reason: "the id in this key is not a usable storage key on the hosted endpoint (allowed: 1-64 characters of letters, digits, underscore or dash)",
        guide: GUIDE,
      }, 401);
    }
    return { tenant: `lic:${r.id}`, isPro: true, kind: "license", limit: RATE_LIMIT_PRO };
  }
  if (/^anon_[0-9a-f]{32}$/.test(token)) {
    const id = token.slice(5);
    if (!TENANT_ID_RE.test(id)) return json({ error: "invalid_token", guide: GUIDE }, 401);
    const seen = await env.REMOTE_DATA.get(`tok:${token}`);
    if (seen === null) return json({ error: "unknown_token", message: "Mint a new one at GET https://mcp.zovo.one/mcp/token", guide: GUIDE }, 401);
    return { tenant: `anon:${id}`, isPro: false, kind: "anon", limit: RATE_LIMIT_FREE };
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

/**
 * Constant-time secret comparison: both sides are HMAC-SHA-256'd under a key generated
 * fresh in this isolate, and the 32-byte digests are compared with no early exit, so
 * neither the length nor any prefix of the real secret is observable from timing.
 */
let cmpKeyPromise: Promise<CryptoKey> | null = null;
async function secretEquals(a: string, b: string): Promise<boolean> {
  // Generated on first use, not at module scope: Workers forbids random values there.
  cmpKeyPromise ??= crypto.subtle.importKey(
    "raw", crypto.getRandomValues(new Uint8Array(32)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const key = await cmpKeyPromise;
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.sign("HMAC", key, enc.encode(a)),
    crypto.subtle.sign("HMAC", key, enc.encode(b)),
  ]);
  const xa = new Uint8Array(x), ya = new Uint8Array(y);
  let diff = xa.length ^ ya.length;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i % ya.length];
  return diff === 0;
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
function persistable(
  files: Map<string, string>, cfg: ServerCfg, published: Map<string, string>,
  only?: (path: string) => boolean,
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of files) {
    if (TMP_RE.test(k)) continue;
    if (only && !only(k)) continue;
    if (cfg.persist && !cfg.persist(k)) continue;
    if (published.has(k) && !cfg.persistPublished) continue;
    obj[k] = v;
  }
  return obj;
}

/**
 * The shared business profile (packages/mcp-license/src/profile.ts, vendored onto the
 * fs shim by remote/src/shims/license.ts) lives at a fixed virtual path and its own
 * tenant document, `${tenant}:profile`, independent of any one server. It is hydrated
 * into every endpoint's request below - not just the ones that read it today - so a
 * server added later that imports readSharedProfile needs no change here.
 */
const PROFILE_SERVER = "profile";
const isProfilePath = (p: string) => p.startsWith("/profile/");

/** Same shape as persistable(), but for the profile document: no server's cfg.persist
 * applies to it (currency's `persist: () => false` must not eat the profile), and it is
 * never a download. */
function persistableProfile(files: Map<string, string>, published: Map<string, string>): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of files) {
    if (TMP_RE.test(k) || !isProfilePath(k) || published.has(k)) continue;
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

/* -------------------------------------------------- shared ECB rate cache */

/**
 * The currency server caches two ECB files. They are the same bytes for every caller and
 * eurofxref-hist.xml is about 6 MB, so a per-tenant copy would multiply that by the number
 * of tokens; they live under one shared pair of KV keys instead, and are hydrated into
 * every request's in-memory filesystem at the paths the vendored store module reads.
 * Nothing about them is per-token, so they are exempt from the tenant caps (ctx.shared)
 * and never written into a tenant document (SERVERS.currency.persist).
 *
 * Refresh happens at most once per worker invocation, because the vendored read-through
 * cache only downloads when its own copy is older than the age limit. A KV lock key makes
 * a concurrent refresh in another isolate unlikely rather than impossible: it is
 * best effort, and the worst case is two isolates downloading the same file, after which
 * both write the same content and the last one wins.
 */
const ECB_DAILY_PATH = "/currency/daily.json";
const ECB_HISTORY_PATH = "/currency/history.json";
const SHARED_DAILY = "shared:ecb:daily";
const SHARED_HISTORY = "shared:ecb:history";
const SHARED_LOCK = "shared:ecb:lock";
const ECB_DAILY_MAX_AGE_MS = 6 * 60 * 60 * 1000;    // same limits as servers/currency/src/ecb.ts
const ECB_HISTORY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ECB_LOCK_TTL = 60;                            // seconds; KV's minimum

/** Which tool calls need the 6 MB history file. The daily file is always hydrated. */
function needsEcbHistory(body: string): boolean {
  return /rate_history|rate_on|cache_status|"date"/.test(body);
}

function ecbAgeMs(raw: string | null): number {
  if (raw === null) return Number.POSITIVE_INFINITY;
  try {
    const t = Date.parse((JSON.parse(raw) as { fetched_at?: string }).fetched_at ?? "");
    return Number.isFinite(t) ? Date.now() - t : Number.POSITIVE_INFINITY;
  } catch { return Number.POSITIVE_INFINITY; }
}

async function hydrateOneEcb(
  env: Env, key: string, path: string, maxAgeMs: number, files: Map<string, string>,
): Promise<string | null> {
  let raw = await env.REMOTE_DATA.get(key);
  if (raw === null || ecbAgeMs(raw) >= maxAgeMs) {
    // Stale or missing: this request will go to the ECB unless someone else already is.
    const lock = `${SHARED_LOCK}:${key}`;
    if ((await env.REMOTE_DATA.get(lock)) !== null) {
      const again = await env.REMOTE_DATA.get(key);   // the holder may have just finished
      if (again !== null) raw = again;
    } else {
      await env.REMOTE_DATA.put(lock, String(Date.now()), { expirationTtl: ECB_LOCK_TTL });
    }
  }
  if (raw !== null) files.set(path, raw);
  return raw;
}

/** Hydrate the shared cache; returns what was hydrated, so a refresh can be detected. */
async function hydrateEcb(env: Env, files: Map<string, string>, body: string): Promise<Map<string, string | null>> {
  const before = new Map<string, string | null>();
  const wantHistory = needsEcbHistory(body);
  const [daily, history] = await Promise.all([
    hydrateOneEcb(env, SHARED_DAILY, ECB_DAILY_PATH, ECB_DAILY_MAX_AGE_MS, files),
    wantHistory
      ? hydrateOneEcb(env, SHARED_HISTORY, ECB_HISTORY_PATH, ECB_HISTORY_MAX_AGE_MS, files)
      : Promise.resolve(null),
  ]);
  before.set(ECB_DAILY_PATH, daily);
  before.set(ECB_HISTORY_PATH, wantHistory ? history : null);
  return before;
}

/** Write a refreshed shared file back, and drop the lock so the next refresh is not blocked. */
async function flushEcb(env: Env, files: Map<string, string>, before: Map<string, string | null>): Promise<void> {
  for (const [path, key] of [[ECB_DAILY_PATH, SHARED_DAILY], [ECB_HISTORY_PATH, SHARED_HISTORY]] as const) {
    const now = files.get(path);
    if (now === undefined || now === before.get(path)) continue;
    await env.REMOTE_DATA.put(key, now);
    await env.REMOTE_DATA.delete(`${SHARED_LOCK}:${key}`);
  }
}

/* ----------------------------------------------------------------- index */

const TOOLS: Record<string, string[]> = {
  "time-tracker": ["timer_start", "timer_stop", "timer_status", "entry_add", "entry_list", "entry_delete", "entry_edit", "project_set_rate", "report", "invoice_summary", "export_csv", "license_status", "license_activate"],
  "price-tracker": ["price_check", "watch_add", "watch_list", "watch_remove", "watch_refresh", "price_history", "price_add_manual", "alerts_pending", "license_status", "license_activate"],
  "invoice": ["business_set", "client_add", "client_list", "invoice_create", "invoice_from_hours", "invoice_list", "invoice_get", "invoice_mark_paid", "invoice_pdf", "overdue_report", "license_status", "license_activate"],
  "expense-tracker": ["expense_add", "expense_list", "expense_update", "expense_delete", "receipt_attach", "category_rules", "expense_settings", "expense_summary", "mileage_add", "expense_export", "expense_to_invoice", "license_status", "license_activate"],
  "spreadsheet": ["sheet_load", "sheet_files", "sheet_unload", "sheet_info", "sheet_read", "sheet_query", "sheet_stats", "sheet_find", "sheet_add_column", "sheet_convert", "sheet_write", "license_status", "license_activate"],
  "currency": ["rates_latest", "convert", "convert_many", "fx_rates_for", "rate_history", "rate_on", "currencies_list", "cache_status", "license_status", "license_activate"],
  "timezone": ["now", "convert_time", "overlap", "find_meeting_slots", "dst_changes", "business_days", "contacts_set", "contacts_list", "ics_create", "license_status", "license_activate"],
  "docx": ["doc_upload", "doc_files", "doc_delete_upload", "business_set", "doc_create", "doc_from_markdown", "doc_read", "doc_to_html", "doc_fill_template", "proposal_create", "contract_create", "license_status", "license_activate"],
  "resume": ["doc_upload", "doc_files", "doc_delete_upload", "profile_set", "profile_get", "resume_create", "resume_to_markdown", "resume_to_html", "resume_read", "cover_letter_create", "tailor_to_job", "license_status", "license_activate"],
  "recurring": ["schedule_create", "schedule_list", "schedule_get", "schedule_update", "schedule_pause", "schedule_resume", "schedule_delete", "schedule_skip", "schedule_upcoming", "invoice_generate_due", "schedule_history", "forecast", "license_status", "license_activate"],
  "clauses": ["clause_add", "clause_get", "clause_update", "clause_delete", "clause_list", "clause_search", "clause_import", "clause_export", "contract_assemble", "variables_list", "license_status", "license_activate"],
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
      {
        name: "currency", url: `${base}/mcp/currency`, tools: TOOLS["currency"],
        free_limits: "historical rates over the last 90 days (Pro reads the series back to 1999-01-04)",
        notes: "ECB reference rates. The two ECB files are one shared cache for the whole endpoint, refreshed at most every 6 hours (daily) and 24 hours (history); nothing here is per-token, and only https://www.ecb.europa.eu is ever fetched",
      },
      {
        name: "timezone", url: `${base}/mcp/timezone`, tools: TOOLS["timezone"],
        free_limits: "3 participants, 5 days per search, 5 saved contacts, 3 calendar files per month",
        notes: "contacts are kept per token; ics_create returns a download link valid for one hour instead of a local file path, and out_path is only the name that file carries",
      },
      {
        name: "docx", url: `${base}/mcp/docx`, tools: TOOLS["docx"],
        mode: "upload and download",
        how: "There is no disk here: doc_upload {name, docx_base64} stores an existing .docx under your token and every tool takes that name as its `path`; doc_read and doc_fill_template also accept docx_base64 directly, which stores the file under the same root (default name 'inline' / 'template'). doc_files lists what is uploaded, doc_delete_upload removes one.",
        outputs: "doc_create, doc_from_markdown, proposal_create, contract_create, doc_fill_template and doc_to_html return a download link valid for one hour; .docx comes back as the real binary file (application/vnd.openxmlformats-officedocument.wordprocessingml.document).",
        free_limits: "3 proposals or contracts per calendar month, templates up to 10 placeholders, footer line and default letterhead",
        storage: `${DOCX_MAX_BYTES / 1048576} MB of uploaded documents per token, and at most 2 MB in one upload (the ${MAX_BODY_BYTES / 1024} KB request-body cap binds first)`,
      },
      {
        name: "resume", url: `${base}/mcp/resume`, tools: TOOLS["resume"],
        mode: "upload and download",
        how: "The profile is stored per token: profile_set once, then resume_create, resume_to_html, resume_to_markdown, cover_letter_create and tailor_to_job read it. There is no disk here, so resume_read takes docx_base64 directly, or a name uploaded with doc_upload {name, docx_base64}.",
        outputs: "resume_create, resume_to_html and cover_letter_create return a download link valid for one hour; .docx comes back as the real binary file. resume_to_markdown returns the markdown in the answer.",
        free_limits: "3 cover letters per calendar month, the \"modern\" resume style, one default profile variant, 2,000 characters of job description in tailor_to_job",
        storage: `${DOCX_MAX_BYTES / 1048576} MB of profile, letter history and uploaded documents per token`,
      },
      {
        name: "recurring", url: `${base}/mcp/recurring`, tools: TOOLS["recurring"],
        mode: "shares the invoice store",
        how: "invoice_generate_due writes real invoices into the same per-token invoice data the /mcp/invoice endpoint serves, under the same number series, so invoice_list and overdue_report there show them. Set the issuer and the clients once with business_set and client_add on /mcp/invoice.",
        outputs: "each generated invoice comes back as a print-ready HTML document behind a one-hour download link (there is no PDF renderer on Workers)",
        free_limits: "3 active schedules, 30 days of schedule_upcoming, 12 periods per forecast",
      },
      {
        name: "clauses", url: `${base}/mcp/clauses`, tools: TOOLS["clauses"],
        how: "The clause library is per token and is seeded with the starter set on first use. clause_import needs a file on a disk, which this endpoint does not have: add clauses with clause_add, or import locally over stdio.",
        outputs: "contract_assemble and clause_export return a download link valid for one hour; .docx comes back as the real binary file.",
        free_limits: "10 clauses of your own on top of the starter set, 8 clauses per assembled document, markdown import and export (JSON is Pro)",
      },
    ],
    limits: {
      request_body_bytes: MAX_BODY_BYTES,
      jsonrpc_batching: "not accepted - send one request object per POST",
      stored_bytes_per_token_per_endpoint: { default: DEFAULT_MAX_BYTES, spreadsheet: SPREADSHEET_MAX_BYTES, docx: DOCX_MAX_BYTES, resume: DOCX_MAX_BYTES, currency: "no per-token storage" },
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

/**
 * Read the request body with the cap enforced on the stream, so a chunked body with no
 * content-length is abandoned the moment it crosses the ceiling instead of being
 * buffered whole. Returns null when the cap is exceeded.
 */
async function readBodyCapped(req: Request, limit: number): Promise<string | null> {
  const body = req.body;
  if (!body) {
    const text = await req.text();
    return new TextEncoder().encode(text).length > limit ? null : text;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) { try { await reader.cancel(); } catch { /* client already gone */ } return null; }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
  const buf = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { buf.set(c, at); at += c.byteLength; }
  return new TextDecoder().decode(buf);
}

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
      // Method first: the sweep deletes data, so it is never reachable by a link,
      // a prefetch or a GET with the secret in a header.
      if (req.method !== "POST") {
        return json({ error: "method_not_allowed", message: "The sweep is a POST." }, 405, { allow: "POST" });
      }
      const secret = env.SWEEP_SECRET;
      if (!secret || !(await secretEquals(secret, req.headers.get("x-sweep-secret") ?? ""))) {
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
    let bodyText = "";
    if (req.method === "POST") {
      const declared = Number(req.headers.get("content-length") ?? "0");
      if (declared > MAX_BODY_BYTES) {
        return json({ error: "payload_too_large", limit_bytes: MAX_BODY_BYTES, message: `The request body is ${declared} bytes; this endpoint accepts ${MAX_BODY_BYTES}. Send less data per call - for spreadsheet, load a smaller sheet or run the server locally over stdio.` }, 413);
      }
      const body = await readBodyCapped(req, MAX_BODY_BYTES);
      if (body === null) {
        return json({ error: "payload_too_large", limit_bytes: MAX_BODY_BYTES, message: `This endpoint accepts ${MAX_BODY_BYTES} bytes per request and stopped reading at that point. Send less data per call - for spreadsheet, load a smaller sheet or run the server locally over stdio.` }, 413);
      }
      if (isBatch(body)) {
        return json({
          jsonrpc: "2.0", id: null,
          error: { code: -32600, message: "JSON-RPC batching is not supported on this endpoint. Send one request object per POST." },
        }, 400);
      }
      bodyText = body;
      request = new Request(req.url, { method: "POST", headers: req.headers, body });
    }

    const files = await hydrate(env, auth.tenant, product);
    // /mcp/recurring works inside the invoice store: its document is hydrated on top of
    // this endpoint's, and every path is flushed back to whichever document owns it.
    if (cfg.sharedDoc) {
      for (const [k, v] of await hydrate(env, auth.tenant, cfg.sharedDoc.server)) files.set(k, v);
    }
    // The shared business profile (D-R31) is hydrated on top of every endpoint, the same
    // way: business_set on /mcp/invoice must be visible to /mcp/docx, /mcp/expense-tracker,
    // /mcp/recurring, /mcp/resume, /mcp/clauses, /mcp/time-tracker and /mcp/timezone for
    // the same token, so it is not scoped to the servers that read it today.
    for (const [k, v] of await hydrate(env, auth.tenant, PROFILE_SERVER)) files.set(k, v);
    const ownPaths = (p2: string) => !isProfilePath(p2) && (!cfg.sharedDoc || !cfg.sharedDoc.owns(p2));
    const maxBytes = cfg.maxBytes ?? DEFAULT_MAX_BYTES;
    const counted = recount(files);

    // The ECB cache is shared across tenants: hydrated after recount(), so its bytes are
    // never charged to this token, and listed in `shared` so no write charges them either.
    const shared = new Set<string>();
    let ecbBefore: Map<string, string | null> | null = null;
    if (product === "currency") {
      ecbBefore = await hydrateEcb(env, files, bodyText);
      shared.add(ECB_DAILY_PATH);
      shared.add(ECB_HISTORY_PATH);
    }

    const rctx: RequestCtx = {
      tenant: auth.tenant, server: product, isPro: auth.isPro,
      files, dirs: new Set<string>(), downloads: [], baseUrl: base,
      publish: cfg.publish, published: new Map<string, string>(), maxBytes,
      bytes: counted.bytes, nfiles: counted.nfiles,
      shared,
      fds: new Map(), nextFd: 100,
    };
    const before = JSON.stringify(persistable(files, cfg, rctx.published, ownPaths));
    const sharedBefore = cfg.sharedDoc
      ? JSON.stringify(persistable(files, cfg, rctx.published, cfg.sharedDoc.owns))
      : "";
    const profileBefore = JSON.stringify(persistableProfile(files, rctx.published));

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
        if (ecbBefore) await flushEcb(env, files, ecbBefore);
        await flush(env, auth.tenant, product, JSON.stringify(persistable(files, cfg, rctx.published, ownPaths)), before);
        if (cfg.sharedDoc) {
          await flush(env, auth.tenant, cfg.sharedDoc.server,
            JSON.stringify(persistable(files, cfg, rctx.published, cfg.sharedDoc.owns)), sharedBefore);
        }
        await flush(env, auth.tenant, PROFILE_SERVER, JSON.stringify(persistableProfile(files, rctx.published)), profileBefore);
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
