import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { runDripSweep } from "../src/scheduled-monitor.js";

/** KV stub with list() + per-key get/put so both the route and the drip sweep are testable. */
function kvStub(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get: async (k) => map.get(k) ?? null,
    put: async (k, v) => { map.set(k, v); },
    list: async ({ prefix = "", cursor } = {}) => {
      const keys = [...map.keys()].filter((k) => k.startsWith(prefix))
        .sort().map((name) => ({ name }));
      const start = cursor ? keys.findIndex((k) => k.name > cursor) + 1 : 0;
      const page = keys.slice(start, start + 2);
      return { keys: page, list_complete: start + 2 >= keys.length, cursor: page.at(-1)?.name };
    },
    _map: map,
  };
}

function env() {
  const sent = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), init });
    return Response.json({ id: "em_test" }, { status: 200 });
  };
  return { sent, restore: () => { globalThis.fetch = orig; } };
}

test("POST /api/subscribe stores the sub record and sends the welcome email", async () => {
  const kv = kvStub();
  const f = env();
  try {
    const res = await worker.fetch(new Request("https://mcp.zovo.one/api/subscribe", {
      method: "POST", body: JSON.stringify({ email: "Buyer@Example.com ", source: "test" }),
      headers: { "content-type": "application/json" },
    }), { LICENSES: kv, RESEND_API_KEY: "re_test" }, { waitUntil() {} });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, status: "subscribed" });
    const rec = JSON.parse(kv._map.get("sub:buyer@example.com"));
    assert.equal(rec.source, "test");
    assert.ok(rec.at);
    assert.equal(f.sent.length, 1);
    assert.match(f.sent[0].init.body, /buyer@example\.com/);
    assert.match(f.sent[0].init.headers.authorization, /^Bearer re_test$/);
  } finally { f.restore(); }
});

test("duplicate subscribe is idempotent and does not re-send the welcome email", async () => {
  const kv = kvStub({ "sub:dup@example.com": JSON.stringify({ email: "dup@example.com", at: new Date().toISOString() }) });
  const f = env();
  try {
    const res = await worker.fetch(new Request("https://mcp.zovo.one/api/subscribe", {
      method: "POST", body: JSON.stringify({ email: "dup@example.com" }),
      headers: { "content-type": "application/json" },
    }), { LICENSES: kv, RESEND_API_KEY: "re_test" }, { waitUntil() {} });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, status: "already_subscribed" });
    assert.equal(f.sent.length, 0);
  } finally { f.restore(); }
});

test("invalid email is rejected without storing or sending", async () => {
  const kv = kvStub();
  const f = env();
  try {
    for (const bad of ["not-an-email", "", "a@b", "x".repeat(201) + "@b.co"]) {
      const res = await worker.fetch(new Request("https://mcp.zovo.one/api/subscribe", {
        method: "POST", body: JSON.stringify({ email: bad }),
        headers: { "content-type": "application/json" },
      }), { LICENSES: kv, RESEND_API_KEY: "re_test" }, { waitUntil() {} });
      assert.equal(res.status, 400, `expected 400 for ${bad}`);
    }
    assert.equal(kv._map.size, 0);
    assert.equal(f.sent.length, 0);
  } finally { f.restore(); }
});

test("missing RESEND_API_KEY still stores the subscriber (email is best-effort)", async () => {
  const kv = kvStub();
  const f = env();
  try {
    const res = await worker.fetch(new Request("https://mcp.zovo.one/api/subscribe", {
      method: "POST", body: JSON.stringify({ email: "nok@example.com" }),
      headers: { "content-type": "application/json" },
    }), { LICENSES: kv }, { waitUntil() {} });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, status: "subscribed" });
    assert.ok(kv._map.has("sub:nok@example.com"));
    assert.equal(f.sent.length, 0);
  } finally { f.restore(); }
});

test("the shared page footer carries the subscribe form pointing at /api/subscribe", async () => {
  const html = await (await worker.fetch(new Request("https://mcp.zovo.one/"), {}, { waitUntil() {} })).text();
  assert.match(html, /id="subform"/);
  assert.match(html, /action="\/api\/subscribe"/);
  assert.match(html, /type="email"/);
});

test("runDripSweep sends E2 once past 48h and E3 once past 168h, stamping each step", async () => {
  const now = Date.now();
  const kv = kvStub({
    "sub:fresh@example.com": JSON.stringify({ email: "fresh@example.com", at: new Date(now - 1 * 3600e3).toISOString() }),
    "sub:mid@example.com": JSON.stringify({ email: "mid@example.com", at: new Date(now - 50 * 3600e3).toISOString() }),
    "sub:old@example.com": JSON.stringify({ email: "old@example.com", at: new Date(now - 200 * 3600e3).toISOString() }),
    // already-stamped steps must be skipped
    "sub:old@example.com:e2": new Date(now - 100 * 3600e3).toISOString(),
  });
  const f = env();
  try {
    const out = await runDripSweep({ LICENSES: kv, RESEND_API_KEY: "re_test" }, now);
    assert.deepEqual(out, { e2: 1, e3: 1, errors: 0 });
    // fresh: nothing; mid: only e2; old: both stamped pre-sweep → skipped
    assert.equal(f.sent.length, 2);
    const bodies = f.sent.map((s) => s.init.body);
    assert.match(bodies[0], /mid@example\.com/);
    assert.match(bodies[1], /old@example\.com/);
    assert.ok(kv._map.has("sub:mid@example.com:e2"));
    assert.ok(!kv._map.has("sub:mid@example.com:e3"));
    assert.ok(!kv._map.has("sub:fresh@example.com:e2"));
    assert.ok(kv._map.has("sub:old@example.com:e2")); // already stamped pre-sweep
  } finally { f.restore(); }
});

test("runDripSweep without an API key is a no-op skip", async () => {
  const kv = kvStub({ "sub:x@example.com": JSON.stringify({ email: "x@example.com", at: new Date(Date.now() - 500 * 3600e3).toISOString() }) });
  const out = await runDripSweep({ LICENSES: kv });
  assert.deepEqual(out, { skipped: "no_api_key" });
});
