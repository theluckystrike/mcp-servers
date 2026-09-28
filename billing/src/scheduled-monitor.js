// Scheduled, read-only checkout reconciliation. Only aggregate counts and hashed
// Session references are logged; customer data and license values stay in memory.
import app, { PRODUCTS, PRODUCT_ALIASES } from "./index.js";

const ORIGIN = "https://mcp.zovo.one";
const WEBHOOK = `${ORIGIN}/webhook`;
const MAX_OBJECTS = 10000;
const SETTLE_SECONDS = 15 * 60;
const BATCHES = 5;
const APPROVED_VERSION = "monitor:approved-version";
const STATUS_KEY = "monitor:status";
const WEBHOOK_PREFIX = "monitor:webhook-status:";
const encoder = new TextEncoder();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sessionRef(id) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`mcp-session-log-v1:${id}`));
  return [...new Uint8Array(digest)].slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function stripeList(env, path, params = []) {
  const records = [];
  let cursor;
  do {
    const query = new URLSearchParams({ limit: "100", ...Object.fromEntries(params) });
    if (cursor) query.set("starting_after", cursor);
    const response = await fetch(`https://api.stripe.com${path}?${query}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
      signal: AbortSignal.timeout(30000),
    });
    assert(response.ok, `Stripe ${path} read failed (HTTP ${response.status})`);
    const page = await response.json();
    assert(page?.object === "list" && Array.isArray(page.data) && typeof page.has_more === "boolean",
      `Stripe ${path} response malformed`);
    records.push(...page.data);
    assert(records.length <= MAX_OBJECTS, `Stripe ${path} exceeded ${MAX_OBJECTS} objects`);
    if (!page.has_more) return records;
    const next = page.data.at(-1)?.id;
    assert(next && next !== cursor, `Stripe ${path} pagination stalled`);
    cursor = next;
  } while (true);
}

function isMcpSession(session) {
  return session?.metadata?.site === "mcp.zovo.one" ||
    session?.metadata?.campaign === "mcp_lifetime_checkout";
}

function buyPaths() {
  return [...Object.keys(PRODUCTS), ...Object.keys(PRODUCT_ALIASES)]
    .map((id) => `/buy/${encodeURIComponent(id)}`)
    .concat("/buy/bundle?session_id=cs_live_release_gate_sentinel", "/buy/bundle?src=release.gate.probe");
}

async function probeBuyPages(batch, source, env, ctx, route) {
  const paths = buyPaths().filter((_, index) => index % BATCHES === batch);
  for (const path of paths) {
    const target = new URL(path, ORIGIN);
    target.searchParams.set("src", source);
    const request = new Request(target, {
      method: "GET", redirect: "manual", cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 cloudflare-checkout-monitor",
        accept: "text/html,application/xhtml+xml",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        "x-mcp-probe": "1",
      },
    });
    // Calling our own Custom Domain with global fetch can depend on route
    // behavior. Invoke the deployed handler directly; the GitHub watchdog
    // separately checks public routing through the status endpoint.
    const response = await route(request, env, ctx);
    const body = await response.text();
    assert(response.status === 200 && response.headers.get("x-mcp-buy") === "checkout-intent-required" &&
      /text\/html/i.test(response.headers.get("content-type") || "") &&
      /<form\b[^>]*method=["']post["']/i.test(body) &&
      /name=["']intent["'][^>]*value=["']checkout["']/i.test(body) &&
      !/checkout\.stripe\.com|cs_live_/.test(response.headers.get("location") || ""),
    `GET ${path} did not return a checkout intent page (HTTP ${response.status})`);
  }
  return paths.length;
}

async function checkBuyBatch(env, now, batch, ctx, route) {
  const version = env.CF_VERSION_METADATA?.id;
  const approved = await env.REMOTE_DATA.get(APPROVED_VERSION);
  assert(version && approved && version === approved, "deployed version differs from approved release");
  const created = now - 1;
  const source = `monitor.get.${crypto.randomUUID().replaceAll("-", "")}`;
  const before = await stripeList(env, "/v1/checkout/sessions", [["created[gte]", created]]);
  const beforeIds = new Set(before.map((session) => session.id));
  const paths = await probeBuyPages(batch, source, env, ctx, route);
  const after = await stripeList(env, "/v1/checkout/sessions", [["created[gte]", created]]);
  // Every legitimate checkout created by current code records POST. A concurrent
  // customer POST must not page us; a GET regression either carries our unique
  // source tag or lacks the current POST metadata invariant.
  assert(!after.some((session) => !beforeIds.has(session.id) &&
    (session.metadata?.source === source || session.metadata?.request_method !== "POST")),
  "new live Stripe Session attributable to GET checkout probe");
  assert(env.CF_VERSION_METADATA?.id === version, "deployed version changed during checkout probe");
  return { paths, batch, version };
}

async function listWebhookStatuses(env, since) {
  let cursor;
  let inspected = 0;
  let failed = 0;
  do {
    const page = await env.REMOTE_DATA.list({ prefix: WEBHOOK_PREFIX, cursor });
    assert(Array.isArray(page.keys), "webhook status list malformed");
    for (const key of page.keys) {
      const timestamp = Number(key.name.slice(WEBHOOK_PREFIX.length, WEBHOOK_PREFIX.length + 13));
      if (!Number.isSafeInteger(timestamp) || timestamp < since * 1000) continue;
      inspected++;
      const raw = await env.REMOTE_DATA.get(key.name);
      assert(/^\d{3}$/.test(raw || ""), "webhook status record malformed");
      const status = Number(raw);
      if (status >= 400 && status <= 599) failed++;
    }
    assert(inspected <= MAX_OBJECTS, "webhook status list coverage incomplete");
    if (page.list_complete) break;
    assert(page.cursor && page.cursor !== cursor, "webhook status pagination stalled");
    cursor = page.cursor;
  } while (true);
  return { inspected, failed };
}

async function checkOperations(env, now) {
  const recent = await stripeList(env, "/v1/checkout/sessions", [
    ["created[gte]", now - 48 * 3600], ["created[lt]", now - 24 * 3600],
  ]);
  const hours = new Map();
  for (const session of recent) {
    if (!isMcpSession(session) || session.metadata?.probe === "1") continue;
    const hour = Math.floor(session.created / 3600);
    const bucket = hours.get(hour) || { count: 0, expired: 0 };
    bucket.count++;
    if (session.status === "expired") bucket.expired++;
    hours.set(hour, bucket);
  }
  const sweepHours = [...hours.values()].filter((b) => b.count >= 10 && b.expired === b.count).length;

  const complete = await stripeList(env, "/v1/checkout/sessions", [
    ["status", "complete"], ["created[gte]", now - 30 * 86400],
  ]);
  let paidChecked = 0;
  let paidSettling = 0;
  const missing = [];
  for (const session of complete) {
    if (!isMcpSession(session)) continue;
    assert(session.id?.startsWith("cs_live_") && session.livemode === true &&
      Number.isSafeInteger(session.created) && session.status === "complete", "malformed live MCP Session");
    if (!["paid", "no_payment_required"].includes(session.payment_status)) continue;
    if (session.created > now - SETTLE_SECONDS) { paidSettling++; continue; }
    paidChecked++;
    const issued = await env.LICENSES.get(`session:${session.id}`);
    if (!issued) { missing.push(`${await sessionRef(session.id)}:license`); continue; }
    const tenant = session.metadata?.tenant;
    if (typeof tenant === "string" && /^anon_[0-9a-f]{32}$/.test(tenant)) {
      const bound = await env.REMOTE_DATA.get(`bind:${tenant}`);
      if (!bound || bound !== issued) missing.push(`${await sessionRef(session.id)}:binding`);
    }
  }

  const endpoints = await stripeList(env, "/v1/webhook_endpoints");
  const enabled = endpoints.filter((endpoint) => endpoint.url === WEBHOOK && endpoint.status === "enabled");
  const destinationOk = enabled.length === 1 &&
    ["checkout.session.completed", "checkout.session.async_payment_succeeded"]
      .every((event) => enabled[0].enabled_events?.includes(event));

  const events = [];
  for (const type of ["checkout.session.completed", "checkout.session.async_payment_succeeded"]) {
    events.push(...await stripeList(env, "/v1/events", [
      ["created[gte]", now - 7 * 86400], ["type", type], ["delivery_success", "false"],
    ]));
  }
  for (const event of events.filter((entry) => isMcpSession(entry.data?.object))) {
    assert(Number.isSafeInteger(event.created) && Number.isSafeInteger(event.pending_webhooks),
      "malformed MCP webhook event");
  }
  const overdue = events.filter((event) => isMcpSession(event.data?.object) &&
    event.pending_webhooks > 0 && event.created <= now - SETTLE_SECONDS).length;
  const webhook = await listWebhookStatuses(env, now - 86400);
  const result = { sweepHours, paidChecked, paidSettling, missing, enabled: enabled.length,
    destinationOk, overdue, webhookFailures: webhook.failed, webhookObserved: webhook.inspected };
  assert(!sweepHours && !missing.length && destinationOk && !overdue && !webhook.failed,
    `operations check failed: ${JSON.stringify(result)}`);
  return result;
}

export async function runScheduledMonitor(env, scheduledTime, ctx, route = app.fetch) {
  const now = Math.floor(Date.now() / 1000);
  const slot = Math.floor(scheduledTime / 300000);
  const batch = ((slot % BATCHES) + BATCHES) % BATCHES;
  let previous = {};
  try { previous = JSON.parse(await env.REMOTE_DATA.get(STATUS_KEY) || "{}"); }
  catch { throw new Error("previous monitor status malformed"); }
  const report = { checkedAt: new Date().toISOString(), batch,
    version: env.CF_VERSION_METADATA?.id || null, ok: false,
    operationsCheckedAt: previous.operationsCheckedAt || null,
    lastFailureAt: previous.lastFailureAt || null };
  try {
    report.buy = await checkBuyBatch(env, now, batch, ctx, route);
    if (!report.operationsCheckedAt || now - Date.parse(report.operationsCheckedAt) / 1000 >= 55 * 60) {
      report.operations = await checkOperations(env, now);
      report.operationsCheckedAt = new Date().toISOString();
    }
    report.ok = true;
    console.log(JSON.stringify({ event: "billing_monitor_pass", ...report }));
  } catch (error) {
    report.error = String(error?.message || error).slice(0, 1200);
    report.lastFailureAt = new Date().toISOString();
    console.error(JSON.stringify({ event: "billing_monitor_fail", ...report }));
  }
  await env.REMOTE_DATA.put(STATUS_KEY, JSON.stringify(report));
  if (!report.ok) throw new Error(report.error);
  return report;
}

export async function recordWebhookStatus(env, status, timestamp = Date.now()) {
  await env.REMOTE_DATA.put(`${WEBHOOK_PREFIX}${timestamp}:${crypto.randomUUID()}`,
    String(status), { expirationTtl: 48 * 3600 });
}

export async function readMonitorStatus(env, request) {
  const bearer = request.headers.get("authorization") || "";
  const expected = env.MONITOR_STATUS_TOKEN;
  if (!expected || !bearer.startsWith("Bearer ")) return new Response("Not found", { status: 404 });
  const supplied = bearer.slice(7);
  const a = encoder.encode(supplied);
  const b = encoder.encode(expected);
  // Compare digests so malformed token lengths take the same comparison path.
  const [ad, bd] = await Promise.all([crypto.subtle.digest("SHA-256", a), crypto.subtle.digest("SHA-256", b)]);
  const av = new Uint8Array(ad), bv = new Uint8Array(bd);
  let mismatch = 0;
  for (let i = 0; i < av.length; i++) mismatch |= av[i] ^ bv[i];
  if (mismatch) return new Response("Not found", { status: 404 });
  const raw = await env.REMOTE_DATA.get(STATUS_KEY);
  return new Response(raw || "{}", { status: raw ? 200 : 503,
    headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

// A status-only endpoint for an external health checker. It exposes no Session,
// license, or monitor detail, and treats a missing or stale Cron run as unhealthy.
export async function readMonitorHealth(env, now = Date.now()) {
  let healthy = false;
  try {
    const [raw, approved] = await Promise.all([
      env.REMOTE_DATA.get(STATUS_KEY), env.REMOTE_DATA.get(APPROVED_VERSION),
    ]);
    const status = JSON.parse(raw || "null");
    const version = env.CF_VERSION_METADATA?.id;
    const age = now - Date.parse(status?.checkedAt);
    const operationsAge = now - Date.parse(status?.operationsCheckedAt);
    const failureAge = status?.lastFailureAt ? now - Date.parse(status.lastFailureAt) : Infinity;
    healthy = status?.ok === true && version && approved === version && status.version === version &&
      Number.isFinite(age) && age >= -5 * 60_000 && age <= 20 * 60_000 &&
      Number.isFinite(operationsAge) && operationsAge >= -5 * 60_000 && operationsAge <= 75 * 60_000 &&
      failureAge >= 40 * 60_000;
  } catch {
    healthy = false;
  }
  return new Response(healthy ? "ok" : "unhealthy", { status: healthy ? 200 : 503,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
