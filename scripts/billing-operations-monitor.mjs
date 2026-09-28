#!/usr/bin/env node
// Read-only live reconciliation. Never print KV values or Stripe customer data.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = join(ROOT, "billing", "wrangler.toml");
const MAX_OBJECTS = 10000;
const LOOKBACK_SECONDS = 30 * 86400;
const SETTLE_SECONDS = 15 * 60;
const MCP_WEBHOOK = "https://mcp.zovo.one/webhook";
const STRIPE_USER_AGENT = /^Stripe\//;
// Duplicate destination was disabled before the 2026-09-28 02:13:02 UTC
// post-remediation deployment. Earlier 400s at 2026-09-27 02:25 and 09:39
// UTC are historical failures; retain them in the incident report, not the
// hourly current-state alert. The rolling 24h window takes over after 24h.
const WEBHOOK_BASELINE_SECONDS = Math.floor(Date.parse("2026-09-28T02:13:03Z") / 1000);

function run(bin, args) {
  const result = spawnSync(bin, args, { cwd: ROOT, encoding: "utf8", timeout: 120000,
    maxBuffer: 8 * 1024 * 1024, env: { ...process.env, CI: "1" } });
  if (result.error || result.status !== 0) {
    // CLI stderr can contain API payloads. Only report the command and status.
    throw new Error(`${bin} read failed (${result.error?.code || `exit ${result.status}`})`);
  }
  return result.stdout;
}

function stripeList(path, params = []) {
  const records = [];
  let cursor;
  for (;;) {
    const args = ["get", path, "--live", "-d", "limit=100"];
    for (const [key, value] of params) args.push("-d", `${key}=${value}`);
    if (cursor) args.push("-d", `starting_after=${cursor}`);
    let page;
    try { page = JSON.parse(run("stripe", args)); }
    catch { throw new Error(`Malformed Stripe response for ${path}`); }
    if (page.object !== "list" || !Array.isArray(page.data) || typeof page.has_more !== "boolean") {
      throw new Error(`Incomplete Stripe response for ${path}`);
    }
    records.push(...page.data);
    if (records.length > MAX_OBJECTS) throw new Error(`Stripe ${path} exceeded ${MAX_OBJECTS} objects; coverage incomplete`);
    if (!page.has_more) return records;
    const next = page.data.at(-1)?.id;
    if (!next || next === cursor) throw new Error(`Stripe ${path} pagination stalled`);
    cursor = next;
  }
}

function remoteKey(binding, key) {
  const base = ["kv", "key", "list", "--binding", binding, "--prefix", key, "--remote", "--config", CONFIG];
  let entries;
  try { entries = JSON.parse(run("npx", ["wrangler", ...base])); }
  catch { throw new Error(`Malformed remote ${binding} key list`); }
  if (!Array.isArray(entries) || entries.some((entry) => typeof entry.name !== "string")) {
    throw new Error(`Incomplete remote ${binding} key list`);
  }
  if (!entries.some((entry) => entry.name === key)) return null;
  const value = run("npx", ["wrangler", "kv", "key", "get", key, "--binding", binding,
    "--remote", "--text", "--config", CONFIG]).trim();
  if (!/^MCPL1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Malformed ${binding} license value for ${key}`);
  }
  return value;
}

export function isMcpSession(session) {
  return session?.metadata?.site === "mcp.zovo.one" ||
    session?.metadata?.campaign === "mcp_lifetime_checkout";
}

export function paidSessionFindings(sessions, readKey, nowSeconds) {
  const findings = [];
  let checked = 0;
  let pending = 0;
  for (const session of sessions) {
    if (!isMcpSession(session)) continue;
    if (!session.id?.startsWith("cs_live_") || session.livemode !== true ||
        !Number.isSafeInteger(session.created) || session.status !== "complete") {
      throw new Error("Malformed live MCP Session in reconciliation");
    }
    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") continue;
    if (session.created > nowSeconds - SETTLE_SECONDS) { pending++; continue; }
    checked++;
    const issued = readKey("LICENSES", `session:${session.id}`);
    if (!issued) {
      findings.push({ sessionId: session.id, issue: "issued key missing" });
      continue;
    }
    const tenant = session.metadata?.tenant;
    if (typeof tenant === "string" && /^anon_[0-9a-f]{32}$/.test(tenant)) {
      const bound = readKey("REMOTE_DATA", `bind:${tenant}`);
      if (!bound) findings.push({ sessionId: session.id, issue: "hosted binding missing" });
      else if (bound !== issued) findings.push({ sessionId: session.id, issue: "hosted binding differs from issued key" });
    }
  }
  return { checked, pending, findings };
}

export function webhookFindings(endpoints, events, nowSeconds) {
  const findings = [];
  const enabled = endpoints.filter((endpoint) => endpoint.url === MCP_WEBHOOK && endpoint.status === "enabled");
  if (enabled.length !== 1) findings.push(`expected one enabled MCP webhook destination; found ${enabled.length}`);
  else {
    const types = enabled[0].enabled_events;
    if (!Array.isArray(types) || !types.includes("checkout.session.completed") ||
        !types.includes("checkout.session.async_payment_succeeded")) {
      findings.push("enabled MCP webhook destination lacks a completion event type");
    }
  }
  let overdue = 0;
  for (const event of events) {
    if (!isMcpSession(event.data?.object)) continue;
    if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) continue;
    if (!Number.isSafeInteger(event.created) || !Number.isSafeInteger(event.pending_webhooks)) {
      throw new Error("Malformed MCP webhook event in delivery check");
    }
    if (event.pending_webhooks > 0 && event.created <= nowSeconds - SETTLE_SECONDS) overdue++;
  }
  if (overdue) findings.push(`${overdue} MCP completion event(s) have pending webhook deliveries after 15 minutes`);
  return { enabled: enabled.length, overdue, findings };
}

function cloudflareToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const authEnv = { ...process.env };
  delete authEnv.CLOUDFLARE_API_TOKEN;
  const result = spawnSync("npx", ["wrangler", "auth", "token", "--json"], {
    cwd: ROOT, encoding: "utf8", timeout: 30000, env: { ...authEnv, CI: "1" },
  });
  if (result.error || result.status !== 0) throw new Error("Cloudflare OAuth token unavailable");
  let credential;
  try { credential = JSON.parse(result.stdout); }
  catch { throw new Error("Cloudflare OAuth token response malformed"); }
  if (typeof credential.token !== "string" || !credential.token) throw new Error("Cloudflare OAuth token missing");
  return credential.token;
}

async function cloudflareJson(url, token, body) {
  const response = await fetch(url, { method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Cloudflare returned malformed JSON"); }
  if (!response.ok || data.errors?.length) throw new Error(`Cloudflare analytics read failed (HTTP ${response.status})`);
  return data;
}

export function stripeWebhookHttpFindings(rows) {
  if (!Array.isArray(rows)) throw new Error("Cloudflare webhook status rows missing");
  if (rows.length >= 1000) throw new Error("Cloudflare webhook status result reached row cap");
  let failures = 0;
  const statuses = new Set();
  for (const row of rows) {
    const { edgeResponseStatus: status, userAgent } = row?.dimensions || {};
    if (!Number.isSafeInteger(row?.count) || !Number.isSafeInteger(status) || typeof userAgent !== "string") {
      throw new Error("Cloudflare webhook status row malformed");
    }
    if (STRIPE_USER_AGENT.test(userAgent) && status >= 400 && status <= 599) {
      failures += row.count;
      statuses.add(status);
    }
  }
  return { failures, statuses: [...statuses].sort((a, b) => a - b) };
}

async function cloudflareWebhookStatuses(nowSeconds) {
  const token = cloudflareToken();
  const zones = await cloudflareJson("https://api.cloudflare.com/client/v4/zones?name=zovo.one", token);
  const zone = zones.result?.find((entry) => entry.name === "zovo.one");
  if (!/^[a-f0-9]{32}$/.test(zone?.id || "")) throw new Error("Cloudflare zovo.one zone unavailable");
  const since = new Date(Math.max(nowSeconds - 86400, WEBHOOK_BASELINE_SECONDS) * 1000).toISOString();
  const query = `{ viewer { zones(filter:{zoneTag:${JSON.stringify(zone.id)}}) { ` +
    `httpRequestsAdaptiveGroups(filter:{datetime_geq:${JSON.stringify(since)},` +
    `clientRequestHTTPHost:"mcp.zovo.one",clientRequestPath:"/webhook",` +
    `clientRequestHTTPMethodName:"POST"},limit:1000) { count dimensions { ` +
    `edgeResponseStatus userAgent } } } } }`;
  const data = await cloudflareJson("https://api.cloudflare.com/client/v4/graphql", token, { query });
  const results = data.data?.viewer?.zones;
  if (!Array.isArray(results) || results.length !== 1) throw new Error("Cloudflare webhook analytics zone missing");
  return { ...stripeWebhookHttpFindings(results[0].httpRequestsAdaptiveGroups), since };
}

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const sessions = stripeList("/v1/checkout/sessions", [["status", "complete"], ["created[gte]", now - LOOKBACK_SECONDS]]);
  const paid = paidSessionFindings(sessions, remoteKey, now);
  const endpoints = stripeList("/v1/webhook_endpoints");
  const events = stripeList("/v1/events", [["created[gte]", now - 7 * 86400],
    ["type", "checkout.session.completed"], ["delivery_success", "false"]]);
  const delayedEvents = stripeList("/v1/events", [["created[gte]", now - 7 * 86400],
    ["type", "checkout.session.async_payment_succeeded"], ["delivery_success", "false"]]);
  const webhooks = webhookFindings(endpoints, [...events, ...delayedEvents], now);
  const http = await cloudflareWebhookStatuses(now);
  const findings = [...paid.findings.map((finding) => `${finding.sessionId}: ${finding.issue}`), ...webhooks.findings];
  if (http.failures) findings.push(`${http.failures} observed Stripe-user-agent POST /webhook HTTP 4xx/5xx response(s) since ${http.since} (statuses ${http.statuses.join(",")})`);
  const summary = `30d eligible MCP completions checked=${paid.checked}, settling=${paid.pending}; enabled MCP webhook destinations=${webhooks.enabled}; overdue MCP webhook events=${webhooks.overdue}; observed Stripe webhook HTTP 4xx/5xx since ${http.since}=${http.failures}`;
  if (findings.length) throw new Error(`${summary}; ${findings.join("; ")}`);
  console.log(`PASS: ${summary}. Cloudflare adaptive analytics are sampled and identify Stripe by user agent; Stripe's API lacks endpoint response codes.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { await main(); }
  catch (error) { console.error(`BILLING OPERATIONS ALERT: ${error.message}`); process.exitCode = 1; }
}
