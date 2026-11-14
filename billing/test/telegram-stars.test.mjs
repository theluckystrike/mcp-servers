import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { PRODUCTS } from "../src/index.js";
import { verifyLicenseKey } from "../src/license.js";
import { parseStarsPayload, checkStarsOrder, starsRecordKey } from "../src/telegram-stars.js";

const PEM = readFileSync(new URL("../../keys/license-private.pem", import.meta.url), "utf8");
const SECRET = "tg-secret-for-tests";

function memKv() {
  const map = new Map();
  let puts = 0;
  return {
    map,
    get puts() { return puts; },
    get: async (k) => (map.has(k) ? map.get(k) : null),
    put: async (k, v) => { puts++; map.set(k, v); },
    delete: async (k) => { map.delete(k); },
  };
}

const envWith = (kv) => ({ TELEGRAM_WEBHOOK_SECRET: SECRET, LICENSE_PRIVATE_KEY_PEM: PEM, LICENSES: kv });

function post(update, secret = SECRET) {
  const headers = { "content-type": "application/json" };
  if (secret !== null) headers["x-telegram-bot-api-secret-token"] = secret;
  return new Request("https://mcp.zovo.one/telegram/webhook", { method: "POST", headers, body: JSON.stringify(update) });
}

const call = (env, update, secret) => worker.fetch(post(update, secret), env, { waitUntil() {} });

const preCheckout = (payload, amount, currency = "XTR") => ({
  update_id: 1,
  pre_checkout_query: { id: "pcq-1", from: { id: 42 }, currency, total_amount: amount, invoice_payload: payload },
});

const paid = (payload, amount, chargeId, currency = "XTR") => ({
  update_id: 2,
  message: {
    message_id: 9, date: 1794643200, chat: { id: 42, type: "private" }, from: { id: 42 },
    successful_payment: { currency, total_amount: amount, invoice_payload: payload,
      telegram_payment_charge_id: chargeId, provider_payment_charge_id: "" },
  },
});

test("payload grammar maps to sellable products only", () => {
  assert.deepEqual(parseStarsPayload("mcp-bundle-3000", PRODUCTS), { productId: "bundle", stars: 3000, probe: false });
  assert.deepEqual(parseStarsPayload("mcp-single-invoice", PRODUCTS), { productId: "invoice", stars: 1500, probe: false });
  assert.deepEqual(parseStarsPayload("probe:mcp-single-invoice", PRODUCTS), { productId: "invoice", stars: 1500, probe: true });
  // The legacy plan payload names product "1500", which unlocks nothing.
  assert.equal(parseStarsPayload("mcp-single-1500", PRODUCTS), null);
  assert.equal(parseStarsPayload("mcp-single-office-suite", PRODUCTS), null);
  assert.equal(parseStarsPayload("mcp-single-bundle", PRODUCTS), null);
  assert.equal(checkStarsOrder({ invoice_payload: "mcp-bundle-3000", currency: "XTR", total_amount: 1500 }, PRODUCTS).ok, false);
});

test("route is inert without a secret and refuses a wrong secret", async () => {
  const kv = memKv();
  const off = await worker.fetch(post(preCheckout("mcp-bundle-3000", 3000)),
    { LICENSE_PRIVATE_KEY_PEM: PEM, LICENSES: kv }, { waitUntil() {} });
  assert.equal(off.status, 404);
  assert.equal((await call(envWith(kv), preCheckout("mcp-bundle-3000", 3000), "wrong")).status, 401);
  assert.equal((await call(envWith(kv), preCheckout("mcp-bundle-3000", 3000), null)).status, 401);
  assert.equal(kv.puts, 0);
});

test("pre_checkout_query is approved for a valid order", async () => {
  for (const [payload, amount] of [["mcp-bundle-3000", 3000], ["mcp-single-invoice", 1500]]) {
    const res = await call(envWith(memKv()), preCheckout(payload, amount));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { method: "answerPreCheckoutQuery", pre_checkout_query_id: "pcq-1", ok: true });
  }
});

test("pre_checkout_query is rejected for unknown product, wrong amount or wrong currency", async () => {
  const cases = [
    preCheckout("mcp-single-1500", 1500),
    preCheckout("mcp-single-not-a-server", 1500),
    preCheckout("mcp-single-invoice", 1),
    preCheckout("mcp-bundle-3000", 3000, "USD"),
  ];
  for (const update of cases) {
    const body = await (await call(envWith(memKv()), update)).json();
    assert.equal(body.method, "answerPreCheckoutQuery");
    assert.equal(body.ok, false);
    assert.match(body.error_message, /Nothing was charged/);
  }
});

test("successful_payment mints one verified key, stores the refund fields, and replies with activation steps", async () => {
  const kv = memKv();
  const res = await call(envWith(kv), paid("mcp-single-invoice", 1500, "stxCHARGE1"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.method, "sendMessage");
  assert.equal(body.chat_id, 42);
  const key = /MCPL1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.exec(body.text)?.[0];
  assert.ok(key, "reply carries a key");
  assert.match(body.text, /run license_activate with this key/);
  assert.match(body.text, /MCP_LICENSE_KEY=MCPL1\./);
  assert.match(body.text, /stxCHARGE1/);
  const check = await verifyLicenseKey(key, "invoice");
  assert.equal(check.ok, true);
  assert.equal(check.payload.p, "invoice");
  assert.equal(check.payload.iat, 1794643200);
  assert.equal((await verifyLicenseKey(key, "currency")).ok, false, "single key does not unlock another server");

  const rec = JSON.parse(kv.map.get(starsRecordKey("stxCHARGE1")));
  assert.equal(rec.provider, "telegram-stars");
  assert.equal(rec.telegram_payment_charge_id, "stxCHARGE1");
  assert.equal(rec.user_id, 42);
  assert.equal(rec.product, "invoice");
  assert.equal(rec.stars, 1500);
  assert.equal(rec.key, key);
  assert.equal(rec.probe, false);
  assert.equal(kv.puts, 1);
});

test("a duplicate successful_payment update does not mint twice and returns the same key", async () => {
  const kv = memKv();
  const env = envWith(kv);
  const first = await (await call(env, paid("mcp-bundle-3000", 3000, "stxDUP"))).json();
  const second = await (await call(env, paid("mcp-bundle-3000", 3000, "stxDUP"))).json();
  assert.equal(kv.puts, 1, "one ledger write");
  const k1 = /MCPL1\.\S+/.exec(first.text)[0];
  const k2 = /MCPL1\.\S+/.exec(second.text)[0];
  assert.equal(k1, k2);
  assert.equal((await verifyLicenseKey(k1, "invoice")).ok, true, "bundle key unlocks every server");
});

test("concurrent duplicates sign the identical key (deterministic on the charge id)", async () => {
  const [a, b] = await Promise.all([
    call(envWith(memKv()), paid("mcp-bundle-3000", 3000, "stxRACE")),
    call(envWith(memKv()), paid("mcp-bundle-3000", 3000, "stxRACE")),
  ]);
  assert.equal(/MCPL1\.\S+/.exec((await a.json()).text)[0], /MCPL1\.\S+/.exec((await b.json()).text)[0]);
});

test("a paid order that cannot be matched records the refund fields and mints nothing", async () => {
  const kv = memKv();
  const body = await (await call(envWith(kv), paid("mcp-single-1500", 1500, "stxBAD"))).json();
  assert.doesNotMatch(body.text, /MCPL1\./);
  assert.match(body.text, /refund/);
  const rec = JSON.parse(kv.map.get(starsRecordKey("stxBAD")));
  assert.equal(rec.key, null);
  assert.equal(rec.telegram_payment_charge_id, "stxBAD");
  assert.equal(rec.user_id, 42);
});

test("probe payloads are tagged and short-lived", async () => {
  const kv = memKv();
  let ttl;
  kv.put = async (k, v, opts) => { ttl = opts?.expirationTtl; kv.map.set(k, v); };
  await call(envWith(kv), paid("probe:mcp-single-invoice", 1500, "probe-s1114-x"));
  assert.equal(JSON.parse(kv.map.get(starsRecordKey("probe-s1114-x"))).probe, true);
  assert.equal(ttl, 86400);
});

test("a KV failure returns 500 so Telegram retries the update", async () => {
  const kv = memKv();
  kv.put = async () => { throw new Error("kv down"); };
  const res = await call(envWith(kv), paid("mcp-bundle-3000", 3000, "stxKV"));
  assert.equal(res.status, 500);
});
