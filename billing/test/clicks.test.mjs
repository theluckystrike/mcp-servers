// Conversion instrument (docs/CONVERSION_INSTRUMENT.md): the /buy route counts a click
// on the tagged upgrade link before redirecting to Stripe, and /stats/clicks aggregates
// those counters. Exercised here against an in-memory KV, not real Cloudflare KV.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validSrc, recordClick, clickStats } from "../src/index.js";

/** Minimal KV mock: enough of get/put/list for recordClick and clickStats. */
function fakeKv() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async list({ prefix = "", cursor } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name }));
      return { keys, list_complete: true, cursor: undefined };
    },
  };
}

test("validSrc accepts <product>.<slug> and rejects anything that could break a KV key", () => {
  assert.equal(validSrc("pdf.custom_stamp_text"), true);
  assert.equal(validSrc("pdf.rate_limit"), true);
  assert.equal(validSrc(""), false);
  assert.equal(validSrc("PDF.upper"), false); // uppercase rejected, keeps keys canonical
  assert.equal(validSrc("pdf stamp"), false); // spaces rejected
  assert.equal(validSrc("pdf:stamp"), false); // colon would collide with the click:<src>:<day> separator
  assert.equal(validSrc(undefined), false);
  assert.equal(validSrc("a".repeat(200)), false); // too long
});

test("recordClick increments both the daily bucket and the running total", async () => {
  const env = { REMOTE_DATA: fakeKv() };
  const day = new Date().toISOString().slice(0, 10);
  await recordClick(env, "pdf.custom_stamp_text");
  await recordClick(env, "pdf.custom_stamp_text");
  await recordClick(env, "docx.business_set");
  assert.equal(await env.REMOTE_DATA.get(`click:pdf.custom_stamp_text:${day}`), "2");
  assert.equal(await env.REMOTE_DATA.get("click:pdf.custom_stamp_text:total"), "2");
  assert.equal(await env.REMOTE_DATA.get(`click:docx.business_set:${day}`), "1");
  assert.equal(await env.REMOTE_DATA.get("click:docx.business_set:total"), "1");
});

test("clickStats aggregates per-src totals and the trailing 7-day window, ignoring older daily buckets", async () => {
  const env = { REMOTE_DATA: fakeKv() };
  await recordClick(env, "pdf.custom_stamp_text");
  await recordClick(env, "pdf.custom_stamp_text");
  // A stale daily bucket outside the 7-day window must not count toward last7d, but a
  // pre-seeded total must still be reflected verbatim.
  await env.REMOTE_DATA.put("click:pdf.custom_stamp_text:2020-01-01", "999");
  await env.REMOTE_DATA.put("click:pdf.custom_stamp_text:total", "50");

  const stats = await clickStats(env);
  assert.equal(stats.by_src["pdf.custom_stamp_text"].total, 50);
  assert.equal(stats.by_src["pdf.custom_stamp_text"].last7d, 2);
  assert.equal(stats.total_clicks, 50);
  assert.equal(stats.clicks_7d, 2);
  assert.ok(stats.generated_at);
});

test("clickStats returns an empty aggregate when no clicks were ever recorded", async () => {
  const env = { REMOTE_DATA: fakeKv() };
  const stats = await clickStats(env);
  assert.deepEqual(stats.by_src, {});
  assert.equal(stats.total_clicks, 0);
  assert.equal(stats.clicks_7d, 0);
});
