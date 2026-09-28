#!/usr/bin/env node
// Production checkout release gate. Run `preflight` before deploy and
// `verify --expected-version <uuid>` immediately after. `monitor` repeats the
// production probe without a version expectation and exits nonzero on regression.
// A nonzero exit is the alert signal for a scheduler or CI job.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { PRODUCTS, PRODUCT_ALIASES } from "../billing/src/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BILLING = join(ROOT, "billing");
const ORIGIN = "https://mcp.zovo.one";
const MAX_SESSIONS = 10000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const APPROVED_VERSION = join(homedir(), ".config", "mcp-billing-gate", "approved-version");

function command(bin, args, cwd = ROOT) {
  const run = spawnSync(bin, args, { cwd, encoding: "utf8", timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  if (run.error || run.status !== 0) {
    const failedTests = (run.stdout?.match(/^not ok .*$/gm) || []).join("; ");
    throw new Error(`${bin} ${args.slice(0, 3).join(" ")} failed: ${run.error?.message || run.stderr?.trim() || failedTests || `exit ${run.status}`}`);
  }
  return run.stdout;
}

export function activeVersion(deployments) {
  if (!Array.isArray(deployments) || !deployments.length) throw new Error("No Worker deployments returned");
  const latest = [...deployments].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  if (!latest || !Array.isArray(latest.versions) || latest.versions.length !== 1 || latest.versions[0].percentage !== 100) {
    throw new Error("Latest deployment must serve one version at 100% traffic");
  }
  const version = latest.versions[0].version_id;
  if (!UUID.test(version)) throw new Error("Latest deployment has no valid version ID");
  return version;
}

function deployedVersion() {
  return activeVersion(JSON.parse(command("npx", ["wrangler", "deployments", "list", "--json"], BILLING)));
}

function stripePage(created, cursor) {
  const args = ["get", "/v1/checkout/sessions", "--live", "-d", "limit=100", "-d", `created[gte]=${created}`];
  if (cursor) args.push("-d", `starting_after=${cursor}`);
  const page = JSON.parse(command("stripe", args));
  if (!Array.isArray(page.data) || typeof page.has_more !== "boolean") throw new Error("Stripe Session list was malformed");
  return page;
}

function stripeList(path, params) {
  const items = [];
  let cursor;
  for (;;) {
    const args = ["get", path, "--live", "-d", "limit=100"];
    for (const [key, value] of params) args.push("-d", `${key}=${value}`);
    if (cursor) args.push("-d", `starting_after=${cursor}`);
    const page = JSON.parse(command("stripe", args));
    if (!Array.isArray(page.data) || typeof page.has_more !== "boolean") throw new Error(`Malformed Stripe list for ${path}`);
    items.push(...page.data);
    if (items.length > MAX_SESSIONS) throw new Error(`Too many Stripe objects at ${path} to verify safely`);
    if (!page.has_more) return items;
    if (!page.data.length || page.data.at(-1).id === cursor) throw new Error(`Stripe pagination stalled at ${path}`);
    cursor = page.data.at(-1).id;
  }
}

function sessionIdsSince(created) {
  const ids = new Set();
  let cursor;
  for (;;) {
    const page = stripePage(created, cursor);
    for (const s of page.data) {
      if (!s.id?.startsWith("cs_live_") || s.livemode !== true) throw new Error("Stripe returned a non-live or malformed Session");
      ids.add(s.id);
    }
    if (ids.size > MAX_SESSIONS) throw new Error("Too many recent Sessions to verify safely");
    if (!page.has_more) return ids;
    if (!page.data.length) throw new Error("Stripe pagination made no progress");
    const next = page.data.at(-1).id;
    if (next === cursor) throw new Error("Stripe pagination repeated a cursor");
    cursor = next;
  }
}

export function assertIntentResponse(status, headers, body, path) {
  if (status !== 200 || headers.get("x-mcp-buy") !== "checkout-intent-required" ||
      !/text\/html/i.test(headers.get("content-type") || "") ||
      !/<form\b[^>]*method=["']post["']/i.test(body) ||
      !/name=["']intent["'][^>]*value=["']checkout["']/i.test(body) ||
      /checkout\.stripe\.com|cs_live_/.test(headers.get("location") || "")) {
    throw new Error(`GET ${path} did not return the intent page (HTTP ${status}, x-mcp-buy=${headers.get("x-mcp-buy")})`);
  }
}

export async function probeBuyPages(fetcher = fetch) {
  const paths = [...Object.keys(PRODUCTS), ...Object.keys(PRODUCT_ALIASES)].map((id) => `/buy/${encodeURIComponent(id)}`);
  // The former cancel/resume GET path is included: it must never call Stripe.
  paths.push("/buy/bundle?session_id=cs_live_release_gate_sentinel");
  paths.push("/buy/bundle?src=release.gate.probe");
  for (const path of paths) {
    const headers = {
      "user-agent": "Mozilla/5.0 release-gate browser navigation",
      accept: "text/html,application/xhtml+xml",
      "sec-fetch-mode": "navigate",
      "sec-fetch-dest": "document",
    };
    if (path.includes("release.gate.probe")) headers["x-mcp-probe"] = "1";
    const response = await fetcher(`${ORIGIN}${path}`, { method: "GET", headers, redirect: "manual", cache: "no-store" });
    const body = await response.text();
    assertIntentResponse(response.status, response.headers, body, path);
  }
  return paths.length;
}

async function verify(expectedVersion) {
  const beforeVersion = deployedVersion();
  if (expectedVersion && beforeVersion !== expectedVersion) throw new Error(`Deployed version ${beforeVersion} differs from expected ${expectedVersion}`);
  if (!expectedVersion) {
    if (!existsSync(APPROVED_VERSION)) throw new Error("No approved deployed version is pinned; run verify --expected-version after release");
    const approved = readFileSync(APPROVED_VERSION, "utf8").trim();
    if (approved !== beforeVersion) throw new Error(`ALERT: deployed version ${beforeVersion} differs from approved ${approved}`);
  }
  const since = Math.floor(Date.now() / 1000) - 1;
  const before = sessionIdsSince(since);
  const probed = await probeBuyPages();
  const after = sessionIdsSince(since);
  const created = [...after].filter((id) => !before.has(id));
  const afterVersion = deployedVersion();
  if (afterVersion !== beforeVersion) throw new Error(`Deployment changed during probe: ${beforeVersion} -> ${afterVersion}`);
  if (created.length) throw new Error(`ALERT: ${created.length} live Stripe Session(s) appeared during GET /buy probe; fail closed even if concurrent POST traffic caused them`);
  if (expectedVersion) {
    mkdirSync(dirname(APPROVED_VERSION), { recursive: true, mode: 0o700 });
    const pending = `${APPROVED_VERSION}.pending-${process.pid}`;
    writeFileSync(pending, `${afterVersion}\n`, { mode: 0o600 });
    renameSync(pending, APPROVED_VERSION);
  }
  console.log(`PASS: deployed version ${afterVersion}; ${probed} GET /buy paths returned intent pages; zero new live Stripe Sessions`);
}

function preflight() {
  command("node", ["--test", "scripts/test/billing-release-gate.test.mjs"]);
  command("node", ["--test", "scripts/test/billing-scheduled-monitor.test.mjs"]);
  command("npm", ["test"], BILLING);
  command("npx", ["wrangler", "deploy", "--dry-run", "--strict"], BILLING);
  console.log("PASS: local GET-to-Stripe guard, billing tests, Wrangler dry-run");
}

export function healthSignals(sessions, events, nowSeconds) {
  const buckets = new Map();
  for (const session of sessions) {
    const metadata = session.metadata || {};
    if (metadata.site !== "mcp.zovo.one" && metadata.campaign !== "mcp_lifetime_checkout") continue;
    if (metadata.probe === "1") continue;
    const hour = Math.floor(session.created / 3600);
    const bucket = buckets.get(hour) || { count: 0, expired: 0 };
    bucket.count++;
    if (session.status === "expired") bucket.expired++;
    buckets.set(hour, bucket);
  }
  const sweeps = [...buckets.values()].filter((bucket) => bucket.count >= 10 && bucket.expired === bucket.count);
  // Stripe's Events API exposes failed/pending delivery, not the HTTP code or endpoint.
  // A completed checkout event still pending after ten minutes deserves investigation.
  const stuckEvents = events.filter((event) => event.type === "checkout.session.completed" &&
    event.pending_webhooks > 0 && event.created <= nowSeconds - 600);
  return { sweeps: sweeps.length, expiredInSweeps: sweeps.reduce((n, bucket) => n + bucket.count, 0), stuckEvents: stuckEvents.length };
}

function health() {
  const now = Math.floor(Date.now() / 1000);
  const sessions = stripeList("/v1/checkout/sessions", [["created[gte]", now - 48 * 3600], ["created[lt]", now - 24 * 3600]]);
  const events = stripeList("/v1/events", [["created[gte]", now - 24 * 3600], ["created[lt]", now - 600], ["delivery_success", "false"]]);
  const signals = healthSignals(sessions, events, now);
  if (signals.sweeps || signals.stuckEvents) throw new Error(`ALERT: ${signals.sweeps} all-expired MCP Session sweep hour(s) (${signals.expiredInSweeps} Sessions), ${signals.stuckEvents} checkout completion event(s) with undelivered webhooks`);
  console.log("PASS: no all-expired MCP Session sweep hours or overdue failed checkout webhook events in monitoring window");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const [mode, flag, version] = process.argv.slice(2);
    if (mode === "preflight") preflight();
    else if (mode === "verify" && flag === "--expected-version" && UUID.test(version || "")) await verify(version);
    else if (mode === "monitor" && !flag) await verify();
    else if (mode === "health" && !flag) health();
    else throw new Error("Usage: billing-release-gate.mjs preflight | verify --expected-version <uuid> | monitor | health");
  } catch (error) {
    console.error(`BILLING RELEASE GATE FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
