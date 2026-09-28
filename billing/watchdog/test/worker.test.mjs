import assert from "node:assert/strict";
import test from "node:test";
import { runWatchdog } from "../worker.js";

function harness(statuses) {
  let state = null;
  const sent = [];
  const env = {
    NTFY_TOPIC: "mcp-checkout-abcdefghijklmnopqrstuvwxyz012345",
    STATE: {
      async get() { return state; },
      async put(_key, value) { state = JSON.parse(value); },
    },
  };
  const fetcher = async (url, options) => {
    if (url.includes("health/checkout-monitor")) {
      const [status, body] = statuses.shift();
      return new Response(body, { status, headers: { "Content-Length": String(body.length) } });
    }
    sent.push({ url, title: options.headers.Title, message: options.body });
    return new Response("{}", { status: 200 });
  };
  return { env, fetcher, sent, getState: () => state };
}

test("alerts on failure, throttles repeats, and reports recovery", async () => {
  const h = harness([[200, "ok"], [503, "bad"], [503, "bad"], [503, "bad"], [200, "ok"]]);
  assert.equal((await runWatchdog(h.env, { fetcher: h.fetcher, now: 0 })).notified, false);
  assert.equal((await runWatchdog(h.env, { fetcher: h.fetcher, now: 1_000 })).notified, true);
  assert.equal((await runWatchdog(h.env, { fetcher: h.fetcher, now: 2_000 })).notified, false);
  assert.equal((await runWatchdog(h.env, { fetcher: h.fetcher, now: 3_601_000 })).notified, true);
  assert.equal((await runWatchdog(h.env, { fetcher: h.fetcher, now: 3_602_000 })).notified, true);
  assert.deepEqual(h.sent.map(x => x.title), [
    "MCP checkout monitor unhealthy", "MCP checkout monitor unhealthy", "MCP checkout monitor recovered",
  ]);
  assert.equal(h.getState().kind, "healthy");
});

test("rejects unexpected successful content and retries a failed publisher", async () => {
  const h = harness([[200, "unexpected"], [200, "unexpected"]]);
  let fail = true;
  const fetcher = async (...args) => {
    const response = await h.fetcher(...args);
    if (args[0].startsWith("https://ntfy.sh/") && fail) {
      fail = false;
      return new Response("no", { status: 503 });
    }
    return response;
  };
  await assert.rejects(runWatchdog(h.env, { fetcher, now: 1_000 }), /ntfy publish returned HTTP 503/);
  assert.equal(h.getState(), null);
  assert.equal((await runWatchdog(h.env, { fetcher, now: 2_000 })).notified, true);
});
