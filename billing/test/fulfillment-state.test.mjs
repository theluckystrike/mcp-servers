import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptFulfillmentJob, processFulfillment } from "../src/fulfillment-engine.js";
import { sessionLicenseId } from "../src/index.js";

const tenant = `anon_${"a".repeat(32)}`;
const incoming = { sessionId: "cs_live_unit", product: "invoice", key: "MCPL1.payload.signature", tenant };

function harness(failBind = false) {
  const saved = new Map();
  const writes = [];
  const alarms = [];
  const storage = {
    get: async (key) => structuredClone(saved.get(key)),
    put: async (key, value) => { saved.set(key, structuredClone(value)); },
    setAlarm: async (at) => { alarms.push(at); },
    deleteAlarm: async () => { alarms.push(null); },
  };
  const env = {
    LICENSES: { put: async (...args) => { writes.push(["license", ...args]); } },
    REMOTE_DATA: { put: async (...args) => {
      if (failBind) throw new Error("bind unavailable");
      writes.push(["bind", ...args]);
    } },
  };
  return { storage, env, writes, alarms, saved, restore: () => { failBind = false; } };
}

test("Session-derived key identity is stable across workers and unique by Session", async () => {
  const a = await sessionLicenseId("cs_live_a");
  assert.equal(a, await sessionLicenseId("cs_live_a"));
  assert.notEqual(a, await sessionLicenseId("cs_live_b"));
  assert.match(a, /^[0-9a-f]{24}$/);
});

test("failed hosted bind remains durable and is retried without repeating key persistence", async () => {
  const h = harness(true);
  const accepted = await acceptFulfillmentJob(h.storage, incoming);
  assert.equal(accepted.job.sessionId, incoming.sessionId);
  assert.equal(h.alarms.length, 1);
  const failed = await processFulfillment(h.storage, h.env, accepted.job);
  assert.deepEqual(failed, { complete: false, licenseSaved: true, bound: false, retryScheduled: true });
  assert.equal(h.saved.get("job").attempts, 1);
  assert.equal(h.alarms.length, 2);
  assert.deepEqual(h.writes.map((x) => x[0]), ["license"]);
  h.restore();
  const recovered = await processFulfillment(h.storage, h.env, await h.storage.get("job"));
  assert.equal(recovered.complete, true);
  assert.deepEqual(h.writes.map((x) => x[0]), ["license", "bind"]);
  assert.equal(h.saved.get("job").bound, true);
  assert.equal(h.alarms.at(-1), null);
});

test("a replay cannot replace the durable key or tenant for a Session", async () => {
  const h = harness();
  assert.ok((await acceptFulfillmentJob(h.storage, incoming)).job);
  assert.ok((await acceptFulfillmentJob(h.storage, incoming)).job);
  const changed = await acceptFulfillmentJob(h.storage, { ...incoming, key: "MCPL1.other.signature" });
  assert.equal(changed.status, 409);
  assert.equal(h.saved.get("job").key, incoming.key);
});

test("license cache failure is retried before a hosted bind is attempted", async () => {
  const h = harness();
  let failLicense = true;
  h.env.LICENSES.put = async (...args) => {
    if (failLicense) throw new Error("license cache unavailable");
    h.writes.push(["license", ...args]);
  };
  const accepted = await acceptFulfillmentJob(h.storage, incoming);
  const first = await processFulfillment(h.storage, h.env, accepted.job);
  assert.equal(first.complete, false);
  assert.equal(first.licenseSaved, false);
  assert.deepEqual(h.writes, []);
  failLicense = false;
  const second = await processFulfillment(h.storage, h.env, await h.storage.get("job"));
  assert.equal(second.complete, true);
  assert.deepEqual(h.writes.map((x) => x[0]), ["license", "bind"]);
});
