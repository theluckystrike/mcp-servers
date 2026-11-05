// Scheduled, read-only checkout reconciliation. Only aggregate counts and hashed
// Session references are logged; customer data and license values stay in memory.
import app, { PRODUCTS, PRODUCT_ALIASES, SERVICES, SERVER_COUNT, isService, resolveProductId } from "./index.js";
import { FREE_IDS } from "./figures.js";
import { readBinding } from "./hosted-bindings.js";
import { verifyLicenseKey } from "./license.js";

const ORIGIN = "https://mcp.zovo.one";
const WEBHOOK = `${ORIGIN}/webhook`;
const MAX_OBJECTS = 10000;
const SETTLE_SECONDS = 15 * 60;
const BATCHES = 5;
const APPROVED_VERSION = "monitor:approved-version";
const STATUS_KEY = "monitor:status";
const WEBHOOK_PREFIX = "monitor:webhook-status:";
const encoder = new TextEncoder();

function b64url(bytes) {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function unsubUrl(origin, env, email) {
  const secret = env.UNSUB_SECRET || env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret) return null;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(`unsub:${email.toLowerCase()}`));
  return `${origin}/api/unsub?e=${encodeURIComponent(b64url(encoder.encode(email.toLowerCase())))}&s=${b64url(new Uint8Array(sigBuf))}`;
}

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
  if (session?.metadata?.site === "mcp.zovo.one" ||
    session?.metadata?.campaign === "mcp_lifetime_checkout") return true;
  return [session?.success_url, session?.cancel_url].some((value) => {
    if (typeof value !== "string") return false;
    try { return new URL(value).hostname === "mcp.zovo.one"; }
    catch { return false; }
  });
}

function buyPaths() {
  // Aliases resolve to an existing product, so probing each free-server alias only
  // duplicates the bundle probe; keep the batch at the paid surface it guards.
  const aliasIds = Object.keys(PRODUCT_ALIASES).filter((id) => !FREE_IDS.includes(id));
  return [...Object.keys(PRODUCTS), ...Object.keys(SERVICES), ...aliasIds]
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

/** The LICENSES key that proves a paid Session was fulfilled: the minted key, or a service order record. */
export function entitlementRecordKey(session) {
  return isService(session?.metadata?.product) ? `service:${session.id}` : `session:${session.id}`;
}

/** Shared by the scheduled and native read-only monitors; never return key material. */
export async function paidSessionEntitlementIssue(session, issued, remote) {
  // A paid service has no key: `issued` is then its LICENSES `service:<session>` order record
  // (see entitlementRecordKey), and the record existing is the whole fulfillment.
  if (isService(session?.metadata?.product)) return issued ? null : "service_order";
  if (!issued) return "license";
  const asked = session.metadata?.product;
  const product = typeof asked === "string" &&
    (Object.hasOwn(PRODUCTS, asked) || Object.hasOwn(PRODUCT_ALIASES, asked)) ? resolveProductId(asked) : "";
  if (typeof product !== "string" || !Object.hasOwn(PRODUCTS, product)) return "binding_product";
  const scope = product === "bundle" ? "*" : product;
  const issuedCheck = await verifyLicenseKey(issued, scope);
  if (!issuedCheck.ok) {
    // An expired historical key can prove fulfillment at purchase time, while a
    // later valid key covers current access. Signature, shape and scope are checked
    // before verifyLicenseKey returns "expired"; no other refusal is accepted.
    if (issuedCheck.reason !== "expired") return "license";
    const body = issued.trim().split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body), c => c.charCodeAt(0))));
    if (!Number.isSafeInteger(session.created) || payload.exp <= session.created) return "license";
  }
  const tenant = session.metadata?.tenant;
  if (tenant == null || tenant === "") return null;
  if (typeof tenant !== "string" || !/^anon_[0-9a-f]{32}$/.test(tenant)) return "binding_tenant";
  const bound = await readBinding(remote, tenant, scope, async (key, wanted) => {
    // Here "*" is an actual paid bundle, not whoami's "any product" lookup.
    const result = await verifyLicenseKey(key, wanted);
    return { ...result, p: result.payload?.p };
  });
  return bound?.ok ? null : "binding";
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
    const issued = await env.LICENSES.get(entitlementRecordKey(session));
    const issue = await paidSessionEntitlementIssue(session, issued, env.REMOTE_DATA);
    if (issue) missing.push(`${await sessionRef(session.id)}:${issue}`);
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
  const version = env.CF_VERSION_METADATA?.id || null;
  const sameVersion = Boolean(version) && previous.version === version;
  const report = { checkedAt: new Date().toISOString(), batch,
    version, ok: false,
    operationsCheckedAt: sameVersion ? previous.operationsCheckedAt || null : null,
    operationsVersion: sameVersion ? previous.operationsVersion || null : null,
    lastFailureAt: previous.lastFailureAt || null };
  try {
    report.buy = await checkBuyBatch(env, now, batch, ctx, route);
    const operationsAge = now - Date.parse(report.operationsCheckedAt) / 1000;
    if (!report.operationsCheckedAt || report.operationsVersion !== version ||
      !Number.isFinite(operationsAge) || operationsAge < -5 * 60 || operationsAge >= 55 * 60) {
      report.operations = await checkOperations(env, now);
      report.operationsCheckedAt = new Date().toISOString();
      report.operationsVersion = version;
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
  // Conversion funnel E2/E3 drip (intel/s20261012c/CONVERSION-RESEND-PLAN.md): fire the
  // +48h and +7d emails outside the monitor's own try/catch — a drip failure must never
  // mark the operations monitor unhealthy. Logs outcomes to console (visible in
  // wrangler tail) and stamps each subscriber so every email sends exactly once.
  if (ctx?.waitUntil) ctx.waitUntil(runDripSweep(env).catch((e) => {
    console.error(JSON.stringify({ event: "drip_sweep_failed", error: String(e?.message || e).slice(0, 300) }));
  }));
  return report;
}

const DRIP_STEPS = [
  { key: "e2", ageHours: 48, subject: "Create your first invoice from chat",
    text: [
      "Here is the invoice setup tip you signed up for.",
      "",
      "MCP Invoice creates invoices from chat with client details, line items, totals, currency and PDF export.",
      "",
      "Start with the free tier. The product page lists its limits and the install options:",
      "  https://mcp.zovo.one/s/invoice",
      "",
      "For a hosted connection, create a token and copy the invoice URL from https://mcp.zovo.one/mcp/connect. No install is needed.",
      "",
      "If invoices are not your bottleneck, reply with the paperwork you hate most and I'll point you at the right server.",
    ].join("\n") },
  { key: "e3", ageHours: 168, subject: `One lifetime key for ${SERVER_COUNT} Pro servers`,
    text: [
      "Here is the bundle offer you signed up for.",
      "",
      `If the free-tier limits are getting in the way, the bundle unlocks all ${SERVER_COUNT} Pro servers with one lifetime key for $${PRODUCTS.bundle.usd}, paid once. No subscription.`,
      "You can keep using the free tiers for light use; they do not expire.",
      "",
      "  https://mcp.zovo.one/pricing",
      "",
      "Anything blocking you? Reply — a real person reads it.",
    ].join("\n") },
];

/** Sweep the sub:* KV namespace and send E2 (+48h) / E3 (+7d) to subscribers whose
 *  timestamp crossed the step threshold. Each step is stamped onto the record, so the
 *  every-5-minutes cron sends each email at most once per subscriber. Failures are
 *  logged, not thrown: email is a conversion nicety, never an operations dependency. */
export async function runDripSweep(env, now = Date.now()) {
  if (!env.RESEND_API_KEY) return { skipped: "no_api_key" };
  let cursor;
  const outcomes = { e2: 0, e3: 0, errors: 0 };
  do {
    const page = await env.LICENSES.list({ prefix: "sub:", cursor });
    for (const key of page.keys) {
      const name = key.name;
      if (name.endsWith(":e2") || name.endsWith(":e3")) continue;
      let record;
      try { record = JSON.parse(await env.LICENSES.get(name) || "null"); } catch { continue; }
      if (!record?.at || !record.email) continue;
      if (await env.LICENSES.get(`unsub:${record.email}`)) continue;
      const ageH = (now - Date.parse(record.at)) / 3600_000;
      for (const step of DRIP_STEPS) {
        const stepKey = `${name}:${step.key}`;
        if (await env.LICENSES.get(stepKey)) continue;
        if (ageH < step.ageHours) continue;
        try {
          const email = record.email.toLowerCase();
          const unsub = await unsubUrl("https://mcp.zovo.one", env, email);
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "authorization": `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
            body: JSON.stringify({ from: "MCP Servers <hello@zovo.one>", to: [record.email],
              subject: step.subject, text: `${step.text}\n\nUnsubscribe: ${unsub ?? "(reply STOP and we'll remove you)"}`,
              ...(unsub ? {
                headers: {
                  "List-Unsubscribe": `<${unsub}>`,
                  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
              } : {}),
              reply_to: "support@zovo.one" }),
          });
          if (res.ok) {
            await env.LICENSES.put(stepKey, new Date().toISOString());
            outcomes[step.key]++;
          } else {
            outcomes.errors++;
            console.error(`drip ${step.key} send failed for ${name}: ${res.status}`);
          }
        } catch { outcomes.errors++; }
      }
    }
    if (page.list_complete) break;
    cursor = page.cursor;
  } while (cursor);
  if (outcomes.e2 || outcomes.e3 || outcomes.errors) {
    console.log(JSON.stringify({ event: "drip_sweep", ...outcomes }));
  }
  return outcomes;
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
      status.operationsVersion === version &&
      Number.isFinite(age) && age >= -5 * 60_000 && age <= 20 * 60_000 &&
      Number.isFinite(operationsAge) && operationsAge >= -5 * 60_000 && operationsAge <= 75 * 60_000 &&
      failureAge >= 40 * 60_000;
  } catch {
    healthy = false;
  }
  return new Response(healthy ? "ok" : "unhealthy", { status: healthy ? 200 : 503,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
