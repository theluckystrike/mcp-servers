const HEALTH_URL = "https://mcp.zovo.one/health/checkout-monitor";
const NTFY_BASE = "https://ntfy.sh/";
const STATE_KEY = "checkout-monitor-alert-state";
const REMINDER_MS = 60 * 60 * 1000;

function stateIsValid(value) {
  return value && typeof value === "object" &&
    (value.kind === "healthy" || value.kind === "unhealthy") &&
    (value.lastSentAt === null || Number.isFinite(value.lastSentAt));
}

async function checkHealth(fetcher) {
  try {
    const response = await fetcher(HEALTH_URL, {
      method: "GET",
      redirect: "manual",
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status !== 200) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    if (response.headers.get("content-length") !== "2") {
      return { ok: false, reason: "unexpected response length" };
    }
    if (await response.text() !== "ok") {
      return { ok: false, reason: "unexpected response body" };
    }
    return { ok: true, reason: "ok" };
  } catch (error) {
    return { ok: false, reason: error?.name === "TimeoutError" ? "timeout" : "request failed" };
  }
}

async function publish(fetcher, topic, title, message, priority) {
  if (!/^[a-zA-Z0-9_-]{24,100}$/.test(topic || "")) {
    throw new Error("NTFY_TOPIC is missing or invalid");
  }
  const response = await fetcher(NTFY_BASE + topic, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      Title: title,
      Priority: priority,
      Click: HEALTH_URL,
    },
    body: message,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`ntfy publish returned HTTP ${response.status}`);
  }
  await response.body?.cancel();
}

export async function runWatchdog(env, { fetcher = fetch, now = Date.now() } = {}) {
  const health = await checkHealth(fetcher);
  let previous;
  let stateError = false;
  try {
    previous = await env.STATE.get(STATE_KEY, "json");
    if (!stateIsValid(previous)) previous = null;
  } catch {
    stateError = true;
    previous = null;
  }

  if (!health.ok || stateError) {
    const reason = stateError ? `${health.reason}; watchdog state unavailable` : health.reason;
    const shouldSend = stateError || previous?.kind !== "unhealthy" ||
      now - previous.lastSentAt >= REMINDER_MS;
    if (shouldSend) {
      await publish(fetcher, env.NTFY_TOPIC, "MCP checkout monitor unhealthy",
        `MCP checkout monitor: ${reason}. Check ${HEALTH_URL}`, "high");
      if (!stateError) {
        await env.STATE.put(STATE_KEY, JSON.stringify({ kind: "unhealthy", lastSentAt: now }));
      }
    }
    console.error(JSON.stringify({ event: "checkout_watchdog_unhealthy", reason, notified: shouldSend }));
    return { healthy: false, notified: shouldSend, reason };
  }

  if (previous?.kind === "unhealthy") {
    await publish(fetcher, env.NTFY_TOPIC, "MCP checkout monitor recovered",
      `MCP checkout monitor is healthy again. ${HEALTH_URL}`, "default");
  }
  await env.STATE.put(STATE_KEY, JSON.stringify({ kind: "healthy", lastSentAt: null }));
  console.log(JSON.stringify({ event: "checkout_watchdog_healthy", recovered: previous?.kind === "unhealthy" }));
  return { healthy: true, notified: previous?.kind === "unhealthy", reason: "ok" };
}

export default {
  async scheduled(_controller, env) {
    await runWatchdog(env);
  },
};
