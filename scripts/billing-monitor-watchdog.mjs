#!/usr/bin/env node
// Independent GitHub Actions watchdog for Cloudflare Cron. No Stripe or
// Cloudflare management credential is needed in CI.
const url = process.env.BILLING_MONITOR_STATUS_URL || "https://mcp.zovo.one/internal/monitor-status";
const token = process.env.BILLING_MONITOR_STATUS_TOKEN;
if (!token) throw new Error("BILLING_MONITOR_STATUS_TOKEN is not configured");
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error(`billing monitor status unavailable (HTTP ${response.status})`);
const status = await response.json();
const age = Date.now() - Date.parse(status.checkedAt);
const operationsAge = Date.now() - Date.parse(status.operationsCheckedAt);
const failureAge = status.lastFailureAt ? Date.now() - Date.parse(status.lastFailureAt) : Infinity;
if (!status.ok || !Number.isFinite(age) || age < -5 * 60_000 || age > 20 * 60_000 ||
    !Number.isFinite(operationsAge) || operationsAge > 75 * 60_000 ||
    failureAge < 40 * 60_000) {
  throw new Error(`billing monitor failed or stale (ok=${status.ok === true}, age_minutes=${Number.isFinite(age) ? Math.floor(age / 60_000) : "invalid"}, operations_age_minutes=${Number.isFinite(operationsAge) ? Math.floor(operationsAge / 60_000) : "invalid"}, recent_failure=${failureAge < 40 * 60_000})`);
}
console.log(`PASS: Cloudflare checkout monitor healthy; last run ${Math.floor(age / 60_000)} minute(s) ago`);
