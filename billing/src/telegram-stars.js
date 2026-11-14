// Telegram Stars (XTR) fulfillment for the billing worker.
//
// Route: POST /telegram/webhook, guarded by the X-Telegram-Bot-Api-Secret-Token header
// (TELEGRAM_WEBHOOK_SECRET). The route is inert (404) until that secret is configured.
// The body is a Telegram Update. It can come straight from Telegram (setWebhook with
// secret_token) or be forwarded by the grammY bot in telegram/src/bot.ts, which keeps the
// chat UI on long polling and hands only the two payment updates to this worker.
//
// The response body is a Bot API method call in webhook-reply form
// ({ method, ...params }), so the worker needs no bot token to answer.
//
// Fulfillment uses the same mint as the Stripe path (mintLicense + verifyLicenseKey from
// license.js, the LICENSE_PRIVATE_KEY_PEM secret, the LICENSES KV namespace) and is
// idempotent on telegram_payment_charge_id: the license id is derived from the charge id
// and iat from the payment message date, so every retry signs the same payload, exactly
// like keyForSession does for a Stripe Session. The KV record stores the charge id and
// the buyer's user id, which refundStarPayment needs.

import { mintLicense, verifyLicenseKey, sha256Hex } from "./license.js";

export const STARS_PROVIDER = "telegram-stars";
export const STARS_PRICE = { single: 1500, bundle: 3000 };
const RECORD_TTL = 60 * 60 * 24 * 365 * 10;
const PROBE_TTL = 60 * 60 * 24;
const SUPPORT = "support@zovo.one";

/**
 * Invoice payload grammar, as set by telegram/src/pricing.ts invoiceParams():
 *   mcp-bundle-3000          every server ("*")
 *   mcp-single-<product>     one sellable single product
 * An optional "probe:" prefix marks an operator probe so it is excluded from KPIs.
 * Aliases such as office-suite are refused: their only working key is the bundle key.
 */
export function parseStarsPayload(payload, products) {
  if (typeof payload !== "string" || payload.length > 128) return null;
  const m = /^(probe:)?mcp-(?:(bundle)-3000|single-([a-z0-9][a-z0-9-]*))$/.exec(payload);
  if (!m) return null;
  const probe = Boolean(m[1]);
  if (m[2]) return { productId: "bundle", stars: STARS_PRICE.bundle, probe };
  const id = m[3];
  if (id === "bundle" || !Object.prototype.hasOwnProperty.call(products, id)) return null;
  return { productId: id, stars: STARS_PRICE.single, probe };
}

/** Pre-checkout check: known product, XTR, exact Star amount. */
export function checkStarsOrder(order, products) {
  const parsed = parseStarsPayload(order?.invoice_payload, products);
  if (!parsed) return { ok: false, reason: "unknown product" };
  if (order.currency !== "XTR") return { ok: false, reason: "currency must be XTR" };
  if (order.total_amount !== parsed.stars) return { ok: false, reason: `amount must be ${parsed.stars} Stars` };
  return { ok: true, ...parsed };
}

export async function starsLicenseId(chargeId) {
  return (await sha256Hex(`mcp-license-tgstars-v1:${chargeId}`)).slice(0, 24);
}

const chargeRef = async (chargeId) => (await sha256Hex(`mcp-tgstars-log-v1:${chargeId}`)).slice(0, 12);
export const starsRecordKey = (chargeId) => `tgstars:${chargeId}`;

/** Buyer-facing delivery text; mirrors the activation steps on the Stripe /success page. */
export function starsDeliveryText(key, product, chargeId) {
  const label = product.name;
  return [
    "Payment received. Thank you.",
    `${label}, lifetime licence.`,
    "",
    "Your licence key:",
    key,
    "",
    "Save this key now. If you lose it, write to " + SUPPORT + " with this payment id:",
    chargeId,
    "",
    "Activate it",
    "In Claude: run license_activate with this key.",
    "Alternative, set an environment variable before starting the server:",
    `MCP_LICENSE_KEY=${key}`,
    "",
    "Install",
    "1. Claude Desktop, one click: download the .mcpb from https://mcp.zovo.one/downloads and open it.",
    "2. No install at all: open https://mcp.zovo.one/mcp/connect and paste the key where the token goes.",
    product.pkg
      ? `3. Local, with npx: claude mcp add ${product.bin.replace(/^mcp-/, "")} -- npx -y ${product.pkg}`
      : "3. Local, with npx: claude mcp add <server> -- npx -y @theluckystrike/mcp-<server> (this key unlocks every server).",
    "",
    `14-day refund on the first payment, from ${SUPPORT}. The key verifies offline; activation sends nothing anywhere.`,
  ].join("\n");
}

function sendMessage(chatId, text) {
  return { method: "sendMessage", chat_id: chatId, text, disable_web_page_preview: true };
}

function logStarsPayment(env, fields) {
  console.log(JSON.stringify({ event: "checkout_payment_verified", provider: STARS_PROVIDER,
    source: "telegram_webhook", version_id: env.CF_VERSION_METADATA?.id || "unknown", ...fields }));
}

/**
 * Handle one Telegram Update. Returns { status, body }. A thrown error (KV or mint failure)
 * is the caller's 500, so Telegram or the forwarding bot retries the same update.
 */
export async function handleStarsUpdate(env, update, products) {
  const q = update?.pre_checkout_query;
  if (q) {
    const check = checkStarsOrder(q, products);
    if (!check.ok) {
      console.log(JSON.stringify({ event: "telegram_precheckout_rejected", provider: STARS_PROVIDER, reason: check.reason }));
    }
    return { status: 200, body: check.ok
      ? { method: "answerPreCheckoutQuery", pre_checkout_query_id: q.id, ok: true }
      : { method: "answerPreCheckoutQuery", pre_checkout_query_id: q.id, ok: false,
        error_message: `This order cannot be completed (${check.reason}). Nothing was charged.` } };
  }

  const msg = update?.message;
  const sp = msg?.successful_payment;
  if (!sp) return { status: 200, body: { ok: true, ignored: true } };

  const chatId = msg.chat?.id;
  const userId = msg.from?.id ?? chatId;
  const chargeId = sp.telegram_payment_charge_id;
  if (typeof chargeId !== "string" || !chargeId || chargeId.length > 256) {
    return { status: 400, body: { ok: false, error: "telegram_payment_charge_id missing" } };
  }
  const ref = await chargeRef(chargeId);
  const recordKey = starsRecordKey(chargeId);

  const existing = await env.LICENSES.get(recordKey);
  if (existing) {
    const rec = JSON.parse(existing);
    console.log(JSON.stringify({ event: "telegram_stars_duplicate", provider: STARS_PROVIDER, charge_ref: ref,
      product: rec.product, probe: Boolean(rec.probe) }));
    if (!rec.key) {
      return { status: 200, body: sendMessage(chatId, `Payment received. Your key needs a manual check; ` +
        `write to ${SUPPORT} with payment id ${chargeId} for the key or a refund.`) };
    }
    return { status: 200, body: sendMessage(chatId, starsDeliveryText(rec.key, products[rec.product], chargeId)) };
  }

  const check = checkStarsOrder(sp, products);
  const base = { provider: STARS_PROVIDER, telegram_payment_charge_id: chargeId,
    provider_payment_charge_id: sp.provider_payment_charge_id || "", user_id: userId, chat_id: chatId,
    payload: sp.invoice_payload, stars: sp.total_amount, currency: sp.currency, paid_at: msg.date,
    recorded_at: new Date().toISOString() };
  if (!check.ok) {
    // Money was taken for an order we cannot fulfil: keep everything a refund needs.
    await env.LICENSES.put(recordKey, JSON.stringify({ ...base, product: null, key: null, error: check.reason,
      probe: false }), { expirationTtl: RECORD_TTL });
    console.error(JSON.stringify({ event: "telegram_stars_unfulfilled", provider: STARS_PROVIDER, charge_ref: ref,
      reason: check.reason }));
    return { status: 200, body: sendMessage(chatId, `Payment received, but this order could not be matched to a ` +
      `product (${check.reason}). Write to ${SUPPORT} with payment id ${chargeId} for your key or a full refund.`) };
  }

  if (!Number.isSafeInteger(msg.date)) throw new Error("payment message date missing");
  const product = products[check.productId];
  const { key } = await mintLicense(env.LICENSE_PRIVATE_KEY_PEM, {
    product: product.payload,
    id: await starsLicenseId(chargeId),
    iat: msg.date,
  });
  const verified = await verifyLicenseKey(key, check.productId);
  if (!verified.ok) throw new Error(`mint verification failed: ${verified.reason}`);

  await env.LICENSES.put(recordKey, JSON.stringify({ ...base, product: check.productId, key, probe: check.probe }),
    { expirationTtl: check.probe ? PROBE_TTL : RECORD_TTL });
  logStarsPayment(env, { charge_ref: ref, product: check.productId, amount_total: sp.total_amount,
    currency: "XTR", probe: check.probe });
  return { status: 200, body: sendMessage(chatId, starsDeliveryText(key, product, chargeId)) };
}

function secretMatches(given, expected) {
  if (typeof given !== "string" || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** HTTP wrapper for POST /telegram/webhook. */
export async function telegramWebhook(request, env, products) {
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return new Response("Not found", { status: 404 });
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), secret)) {
    return new Response("forbidden", { status: 401 });
  }
  let update;
  try {
    update = JSON.parse(await request.text());
  } catch {
    return Response.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  try {
    const { status, body } = await handleStarsUpdate(env, update, products);
    return Response.json(body, { status, headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(JSON.stringify({ event: "telegram_stars_mint_failed", provider: STARS_PROVIDER,
      error: String(e?.message || e).replace(/MCPL1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[license]") }));
    return Response.json({ ok: false, error: "fulfillment failed, retry" }, { status: 500 });
  }
}
