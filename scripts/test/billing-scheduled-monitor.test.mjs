import assert from "node:assert/strict";
import test from "node:test";
import { runScheduledMonitor, recordWebhookStatus, readMonitorHealth, readMonitorStatus } from "../../billing/src/scheduled-monitor.js";

function kv(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async get(key) { return data.get(key) ?? null; },
    async put(key, value) { data.set(key, value); },
    async list({ prefix }) { return { keys: [...data.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  };
}

function timeOutsideHourlySlot() {
  let time = 1_800_000_000_000;
  while (Math.floor(time / 300000) % 12 === 0) time += 300000;
  return time;
}

test("scheduled monitor checks a buy-page batch without creating a live Session", async () => {
  const version = "6d41c702-9584-441e-bbdf-9748b276b798";
  const remote = kv({ "monitor:approved-version": version,
    "monitor:status": JSON.stringify({ version, operationsVersion: version,
      operationsCheckedAt: new Date().toISOString() }) });
  const env = { REMOTE_DATA: remote, CF_VERSION_METADATA: { id: version }, STRIPE_SECRET_KEY: "restricted-test-key" };
  const original = globalThis.fetch;
  let getCount = 0;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://api.stripe.com/")) {
      return Response.json({ object: "list", data: [], has_more: false });
    }
    throw new Error("unexpected external fetch");
  };
  const route = async () => {
    getCount++;
    return new Response('<form method="post"><input name="intent" value="checkout"></form>',
      { status: 200, headers: { "x-mcp-buy": "checkout-intent-required", "content-type": "text/html" } });
  };
  try {
    const report = await runScheduledMonitor(env, timeOutsideHourlySlot(), {}, route);
    assert.equal(report.ok, true);
    assert.equal(getCount, 10);
    assert.equal(JSON.parse(remote.data.get("monitor:status")).ok, true);
  } finally { globalThis.fetch = original; }
});

test("scheduled probe exercises real billing GET handler without a Stripe create call", async () => {
  const version = "6d41c702-9584-441e-bbdf-9748b276b798";
  const remote = kv({ "monitor:approved-version": version,
    "monitor:status": JSON.stringify({ version, operationsVersion: version,
      operationsCheckedAt: new Date().toISOString() }) });
  const env = { REMOTE_DATA: remote, CF_VERSION_METADATA: { id: version }, STRIPE_SECRET_KEY: "restricted-test-key" };
  const original = globalThis.fetch;
  let stripeCalls = 0;
  globalThis.fetch = async (url) => {
    assert.ok(String(url).startsWith("https://api.stripe.com/v1/checkout/sessions?"));
    stripeCalls++;
    return Response.json({ object: "list", data: [], has_more: false });
  };
  try {
    const report = await runScheduledMonitor(env, timeOutsideHourlySlot(), { waitUntil() {} });
    assert.equal(report.buy.paths, 10);
    assert.equal(stripeCalls, 2, "only the before and after Stripe list reads are allowed");
  } finally { globalThis.fetch = original; }
});

test("unapproved version fails closed and records a failing heartbeat", async () => {
  const remote = kv({ "monitor:approved-version": "prior-version" });
  const env = { REMOTE_DATA: remote, CF_VERSION_METADATA: { id: "new-version" } };
  await assert.rejects(() => runScheduledMonitor(env, timeOutsideHourlySlot()), /deployed version differs/);
  assert.equal(JSON.parse(remote.data.get("monitor:status")).ok, false);
});

test("first scheduled run on a new version refreshes operations despite a recent prior checkpoint", async () => {
  const version = "6d41c702-9584-441e-bbdf-9748b276b798";
  const priorOperationsAt = new Date(Date.now() - 10 * 60_000).toISOString();
  const remote = kv({ "monitor:approved-version": version,
    "monitor:status": JSON.stringify({ version: "previous-version", operationsVersion: "previous-version",
      operationsCheckedAt: priorOperationsAt }) });
  const env = { REMOTE_DATA: remote, CF_VERSION_METADATA: { id: version }, STRIPE_SECRET_KEY: "restricted-test-key",
    LICENSES: kv() };
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = new URL(url);
    if (target.hostname === "api.stripe.com") {
      const data = target.pathname === "/v1/webhook_endpoints" ? [{
        url: "https://mcp.zovo.one/webhook", status: "enabled",
        enabled_events: ["checkout.session.completed", "checkout.session.async_payment_succeeded"],
      }] : [];
      return Response.json({ object: "list", data, has_more: false });
    }
    throw new Error("unexpected external fetch");
  };
  const route = async () => new Response('<form method="post"><input name="intent" value="checkout"></form>',
    { status: 200, headers: { "x-mcp-buy": "checkout-intent-required", "content-type": "text/html" } });
  try {
    const report = await runScheduledMonitor(env, timeOutsideHourlySlot(), {}, route);
    assert.equal(report.ok, true);
    assert.equal(report.operations.enabled, 1);
    assert.ok(report.operationsCheckedAt);
    assert.equal(report.operationsVersion, version);
    assert.notEqual(report.operationsCheckedAt, priorOperationsAt);
  } finally { globalThis.fetch = original; }
});

test("concurrent customer POST is ignored but a Session tagged to GET probe alerts", async () => {
  const version = "6d41c702-9584-441e-bbdf-9748b276b798";
  const remote = kv({ "monitor:approved-version": version,
    "monitor:status": JSON.stringify({ version, operationsVersion: version,
      operationsCheckedAt: new Date().toISOString() }) });
  const env = { REMOTE_DATA: remote, CF_VERSION_METADATA: { id: version }, STRIPE_SECRET_KEY: "restricted-test-key" };
  const original = globalThis.fetch;
  let calls = 0;
  let probeSource;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://api.stripe.com/")) {
      calls++;
      const data = calls % 2 === 0 ? [{ id: "cs_live_customer", metadata: { request_method: "POST" } }] : [];
      return Response.json({ object: "list", data, has_more: false });
    }
    throw new Error("unexpected external fetch");
  };
  const route = async (request) => {
    probeSource = new URL(request.url).searchParams.get("src");
    return new Response('<form method="post"><input name="intent" value="checkout"></form>',
      { status: 200, headers: { "x-mcp-buy": "checkout-intent-required", "content-type": "text/html" } });
  };
  try {
    assert.equal((await runScheduledMonitor(env, timeOutsideHourlySlot(), {}, route)).ok, true);
    calls = 0;
    globalThis.fetch = async (url) => {
      if (String(url).startsWith("https://api.stripe.com/")) {
        calls++;
        const data = calls % 2 === 0 ? [{ id: "cs_live_regression", metadata: { source: probeSource, request_method: "POST" } }] : [];
        return Response.json({ object: "list", data, has_more: false });
      }
      throw new Error("unexpected external fetch");
    };
    await assert.rejects(() => runScheduledMonitor(env, timeOutsideHourlySlot(), {}, route), /attributable to GET/);
  } finally { globalThis.fetch = original; }
});

test("status endpoint requires a token and webhook response status is stored without payload", async () => {
  const remote = kv({ "monitor:status": JSON.stringify({ ok: true, checkedAt: "2026-09-28T00:00:00Z" }) });
  const env = { REMOTE_DATA: remote, MONITOR_STATUS_TOKEN: "expected" };
  const denied = await readMonitorStatus(env, new Request("https://mcp.zovo.one/internal/monitor-status"));
  assert.equal(denied.status, 404);
  const allowed = await readMonitorStatus(env, new Request("https://mcp.zovo.one/internal/monitor-status",
    { headers: { Authorization: "Bearer expected" } }));
  assert.equal(allowed.status, 200);
  await recordWebhookStatus(env, 503, Date.parse("2026-09-28T00:00:00Z"));
  const key = [...remote.data.keys()].find((name) => name.startsWith("monitor:webhook-status:"));
  assert.equal(remote.data.get(key), "503");
});

test("public monitor health fails closed on stale Cron, failed operations, or unapproved version", async () => {
  const now = Date.parse("2026-09-28T04:20:00Z");
  const version = "6d41c702-9584-441e-bbdf-9748b276b798";
  const status = { ok: true, version, operationsVersion: version,
    checkedAt: new Date(now - 5 * 60_000).toISOString(),
    operationsCheckedAt: new Date(now - 30 * 60_000).toISOString(), lastFailureAt: null };
  const remote = kv({ "monitor:approved-version": version, "monitor:status": JSON.stringify(status) });
  const env = { REMOTE_DATA: remote, CF_VERSION_METADATA: { id: version } };
  const healthy = await readMonitorHealth(env, now);
  assert.equal(healthy.status, 200);
  assert.equal(await healthy.text(), "ok");
  assert.equal(healthy.headers.get("cache-control"), "no-store");

  status.checkedAt = new Date(now - 21 * 60_000).toISOString();
  remote.data.set("monitor:status", JSON.stringify(status));
  assert.equal((await readMonitorHealth(env, now)).status, 503);
  status.checkedAt = new Date(now - 5 * 60_000).toISOString();
  status.operationsCheckedAt = new Date(now - 76 * 60_000).toISOString();
  remote.data.set("monitor:status", JSON.stringify(status));
  assert.equal((await readMonitorHealth(env, now)).status, 503);
  status.operationsCheckedAt = new Date(now - 30 * 60_000).toISOString();
  status.lastFailureAt = new Date(now - 10 * 60_000).toISOString();
  remote.data.set("monitor:status", JSON.stringify(status));
  assert.equal((await readMonitorHealth(env, now)).status, 503);
  status.lastFailureAt = null;
  status.operationsVersion = "previous-version";
  remote.data.set("monitor:status", JSON.stringify(status));
  assert.equal((await readMonitorHealth(env, now)).status, 503);
  status.operationsVersion = version;
  remote.data.set("monitor:status", JSON.stringify(status));
  remote.data.set("monitor:approved-version", "different-version");
  assert.equal((await readMonitorHealth(env, now)).status, 503);
  remote.data.set("monitor:approved-version", version);
  remote.data.set("monitor:status", "not-json");
  assert.equal((await readMonitorHealth(env, now)).status, 503);
});

test("scheduled reconciliation alerts on missing paid fulfillment, an expired sweep, and webhook 5xx", async () => {
  const version = "6d41c702-9584-441e-bbdf-9748b276b798";
  const now = Math.floor(Date.now() / 1000);
  const olderHour = Math.floor((now - 30 * 3600) / 3600) * 3600;
  const paid = { id: "cs_live_monitor_paid", livemode: true, status: "complete",
    payment_status: "paid", created: now - 3600,
    metadata: { site: "mcp.zovo.one", tenant: `anon_${"a".repeat(32)}` } };
  const urlOnlyPaid = { ...paid, id: "cs_live_monitor_url_only_paid", metadata: {},
    success_url: "https://mcp.zovo.one/buy/success?session_id={CHECKOUT_SESSION_ID}" };
  const expired = Array.from({ length: 10 }, (_, index) => ({
    id: `cs_live_monitor_expired_${index}`, status: "expired", created: olderHour + index,
    metadata: { site: "mcp.zovo.one" },
  }));
  const urlOnlyExpired = expired.map((session) => ({ ...session, metadata: {},
    cancel_url: "https://mcp.zovo.one/buy/bundle" }));
  const route = async () => new Response('<form method="post"><input name="intent" value="checkout"></form>',
    { status: 200, headers: { "x-mcp-buy": "checkout-intent-required", "content-type": "text/html" } });
  const original = globalThis.fetch;
  try {
    for (const [name, sessions, license, webhookFailure, expected] of [
      ["missing license", { complete: [paid] }, false, false, /license/],
      ["missing license from URL-only MCP Session", { complete: [urlOnlyPaid] }, false, false, /license/],
      ["missing hosted bind", { complete: [paid] }, true, false, /binding/],
      ["all expired sweep", { recent: expired }, false, false, /sweepHours/],
      ["all expired URL-only MCP sweep", { recent: urlOnlyExpired }, false, false, /sweepHours/],
      ["webhook 5xx", {}, false, true, /webhookFailures/],
    ]) {
      const remote = kv({ "monitor:approved-version": version });
      const env = { REMOTE_DATA: remote, LICENSES: kv(license ? { [`session:${paid.id}`]: "signed-key" } : {}),
        CF_VERSION_METADATA: { id: version }, STRIPE_SECRET_KEY: "restricted-test-key" };
      if (webhookFailure) await recordWebhookStatus(env, 503, Date.now());
      globalThis.fetch = async (url) => {
        const target = new URL(url);
        assert.equal(target.hostname, "api.stripe.com", name);
        let data = [];
        if (target.pathname === "/v1/webhook_endpoints") {
          data = [{ url: "https://mcp.zovo.one/webhook", status: "enabled",
            enabled_events: ["checkout.session.completed", "checkout.session.async_payment_succeeded"] }];
        } else if (target.pathname === "/v1/checkout/sessions") {
          if (target.searchParams.get("status") === "complete") data = sessions.complete || [];
          else if (target.searchParams.has("created[lt]")) data = sessions.recent || [];
        }
        return Response.json({ object: "list", data, has_more: false });
      };
      await assert.rejects(() => runScheduledMonitor(env, timeOutsideHourlySlot(), {}, route), expected, name);
      const heartbeat = JSON.parse(remote.data.get("monitor:status"));
      assert.equal(heartbeat.ok, false, name);
      assert.ok(heartbeat.lastFailureAt, name);
    }
  } finally { globalThis.fetch = original; }
});
