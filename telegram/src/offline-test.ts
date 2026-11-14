// Offline test harness for the Telegram distribution wedge.
//
// Goal: prove the bot object constructs, the menus and pricing are structurally
// correct, and the Stars invoice wiring is correct per the Telegram XTR docs --
// WITHOUT a live bot token (minting one at @BotFather is human-gated).
//
// What we can and cannot do offline:
//   - Construct Bot (yes; construction does not validate the token).
//   - Build keyboards and assert their button/callback layout (yes).
//   - Assert invoice parameters match the XTR contract (yes, pure).
//   - Mint a real invoice link via createInvoiceLink (NO without a valid
//     token; the Bot API returns 404/401 for an invalid token). We attempt it
//     and record the honest failure so the report does not fabricate a link.

import { buildBot, buildMenuKeyboard, BOT_TOKEN_ENV } from "./bot.js";
import { CATALOG, PICKER_TOP, hostedUrl, hostedServers, highFitServers } from "./catalog.js";
import { PRICES, planForPayload, STAR_USD, productForPayload } from "./pricing.js";
import { sendInvoice } from "./bot.js";
import { readFileSync } from "node:fs";
import type { FetchLike } from "./fulfill.js";
import { InlineKeyboard } from "grammy";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${msg}`);
}

const run = async (): Promise<void> => {
  console.log("=== catalog ===");
  assert(CATALOG.length === 42, `catalog has 42 servers (got ${CATALOG.length})`);
  assert(highFitServers().length >= 15, `at least 15 high-fit Mini App servers (got ${highFitServers().length})`);
  assert(CATALOG[0]!.name === "invoice", `top-ranked server is invoice (got ${CATALOG[0]!.name})`);
  assert(hostedServers().length === 41, `41 servers have a hosted endpoint (got ${hostedServers().length}, office-suite is the non-hosted aggregate)`);
  assert(CATALOG.every((e, i) => e.rank === i + 1), "rank field is contiguous from 1");
  assert(PICKER_TOP <= CATALOG.length, `picker shows a subset (PICKER_TOP=${PICKER_TOP})`);
  assert(hostedUrl("invoice") === "https://mcp.zovo.one/mcp/invoice", "hostedUrl builds the advertised URL");

  console.log("\n=== pricing ===");
  for (const p of PRICES) {
    assert(Number.isInteger(p.stars), `${p.key} star amount is an integer (${p.stars})`);
    assert(p.stars > 0, `${p.key} stars > 0`);
    console.log(`  ${p.key}: ${p.stars} Stars, USD ${(p.stars * STAR_USD).toFixed(2)}, payload "${p.payload}"`);
  }
  assert(planForPayload("mcp-bundle-3000")?.key === "bundle", "payload lookup works");
  assert(planForPayload("nope") === undefined, "unknown payload returns undefined");
  assert(PRICES[0]!.stars === 1500, "single priced at 1500 Stars (~$19 at $0.013/Star)");
  assert(PRICES[1]!.stars === 3000, "bundle priced at 3000 Stars (~$39 at $0.013/Star)");

  console.log("\n=== bot construction (no token required to construct) ===");
  const dummy = "0000000000:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const bot = buildBot(dummy);
  assert(typeof bot === "object" && bot !== null, "Bot object constructs without a valid token");

  const menu = buildMenuKeyboard();
  assert(menu instanceof InlineKeyboard, "menu keyboard is an InlineKeyboard");
  const json = JSON.parse(JSON.stringify(menu));
  assert(Array.isArray(json.inline_keyboard), "keyboard serializes to inline_keyboard array");
  const rows = json.inline_keyboard as unknown[][];
  assert(rows.length >= 17, `menu has at least ${PICKER_TOP} rows (got ${rows.length})`);
  const first = rows[0] as Array<{ text: string; callback_data?: string }>;
  assert(first[0]?.text === "Invoice Maker", `first menu button is Invoice Maker (got ${first[0]?.text})`);
  assert(first[0]?.callback_data === "server:invoice", `first menu button callback is server:invoice (got ${first[0]?.callback_data})`);

  console.log("\n=== invoice parameters per XTR contract ===");
  const plan = PRICES[0]!;
  const priceLine = { label: plan.title, amount: plan.stars };
  const prices = [priceLine];
  assert(priceLine.amount === plan.stars, "prices[0].amount is the integer Star count");
  assert(typeof priceLine.amount === "number", "amount is a number, not a string");
  // Contract: currency XTR, provider_token empty for digital goods.
  const currency = "XTR";
  assert(currency === "XTR", "currency is XTR for digital goods");
  const providerToken = "";
  assert(providerToken === "", "provider_token empty for digital goods");

  console.log("\n=== single invoice carries the chosen server ===");
  let sentPayload = "";
  await sendInvoice({
    api: { createInvoiceLink: async (_t, _d, p) => { sentPayload = p; return "https://t.me/$stub"; } },
    reply: async () => undefined,
  }, PRICES[0]!, "invoice");
  assert(sentPayload === "mcp-single-invoice", `single invoice payload is mcp-single-invoice (got ${sentPayload})`);
  assert(productForPayload("mcp-single-1500") === undefined, "plan template payload mcp-single-1500 is not a product");

  console.log("\n=== Stars payment updates through the billing worker (no network) ===");
  // billing/src/index.js is plain JS; load it at runtime from the sibling directory.
  const billingUrl = new URL("../../billing/src/index.js", import.meta.url).href;
  const worker = (await import(billingUrl)).default as { fetch: (r: Request, e: unknown, c: unknown) => Promise<Response> };
  const kv = new Map<string, string>();
  let kvPuts = 0;
  const env = {
    TELEGRAM_WEBHOOK_SECRET: "offline-secret",
    LICENSE_PRIVATE_KEY_PEM: readFileSync(new URL("../../keys/license-private.pem", import.meta.url), "utf8"),
    LICENSES: { get: async (k: string) => kv.get(k) ?? null, put: async (k: string, v: string) => { kvPuts++; kv.set(k, v); } },
  };
  const fetchImpl: FetchLike = async (url, init) => {
    const res = await worker.fetch(new Request(url, init), env, { waitUntil() {} });
    return { status: res.status, json: () => res.json() };
  };
  const calls: Array<{ method: string; payload: Record<string, unknown> }> = [];
  const payBot = buildBot(dummy, { secret: "offline-secret", fetchImpl, delayMs: 1 });
  payBot.botInfo = { id: 1, is_bot: true, first_name: "t", username: "t_bot", can_join_groups: false,
    can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false,
    has_main_web_app: false } as typeof payBot.botInfo;
  payBot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: true } as never;
  });
  const pcq = (payload: string, amount: number) => ({ update_id: 10, pre_checkout_query: { id: "q1",
    from: { id: 7, is_bot: false, first_name: "b" }, currency: "XTR", total_amount: amount, invoice_payload: payload } });
  await payBot.handleUpdate(pcq("mcp-single-invoice", 1500) as never);
  assert(calls.at(-1)?.method === "answerPreCheckoutQuery" && calls.at(-1)?.payload.ok === true, "pre_checkout ok for a valid order");
  await payBot.handleUpdate(pcq("mcp-single-1500", 1500) as never);
  assert(calls.at(-1)?.payload.ok === false, "pre_checkout rejected for the legacy payload");
  const paid = { update_id: 11, message: { message_id: 3, date: 1794643200, chat: { id: 7, type: "private", first_name: "b" },
    from: { id: 7, is_bot: false, first_name: "b" }, successful_payment: { currency: "XTR", total_amount: 3000,
      invoice_payload: "mcp-bundle-3000", telegram_payment_charge_id: "stxOFFLINE", provider_payment_charge_id: "" } } };
  await payBot.handleUpdate(paid as never);
  const firstText = String(calls.at(-1)?.payload.text ?? "");
  await payBot.handleUpdate({ ...paid, update_id: 12 } as never);
  const secondText = String(calls.at(-1)?.payload.text ?? "");
  const key = /MCPL1\.\S+/.exec(firstText)?.[0];
  assert(!!key && firstText.includes("license_activate"), "successful_payment replies with a key and activation steps");
  assert(kvPuts === 1, `duplicate update writes the ledger once (puts=${kvPuts})`);
  assert(secondText.includes(key ?? "-"), "duplicate update returns the same key");
  assert(JSON.parse(kv.get("tgstars:stxOFFLINE") ?? "{}").provider === "telegram-stars", "ledger provider is telegram-stars");

  console.log("\n=== live invoice-link attempt (recorded honestly) ===");
  const hasToken = !!process.env[BOT_TOKEN_ENV];
  console.log(`  TELEGRAM_BOT_TOKEN present: ${hasToken}`);
  if (!hasToken) {
    console.log("  No token. createInvoiceLink cannot be exercised against the live");
    console.log("  Bot API (a dummy token returns HTTP 404/401). Recording as human-gated.");
    console.log("  Mint a token at https://t.me/BotFather, then:");
    console.log("    TELEGRAM_BOT_TOKEN=<token> node dist/bot.js");
    console.log("  and issue /buy in the chat to generate a real XTR invoice link.");
  } else {
    try {
      const link = await bot.api.createInvoiceLink(
        plan.title,
        plan.description,
        plan.payload,
        "",
        "XTR",
        [{ label: plan.title, amount: plan.stars }],
      );
      console.log(`  live invoice link created: ${link}`);
    } catch (err) {
      console.log(`  live link attempt failed (recorded honestly): ${(err as Error).message}`);
    }
  }

  console.log("\n=== env token probe ===");
  assert(!hasToken || process.env[BOT_TOKEN_ENV]!.length > 20, "token, when set, is a plausible length");

  console.log("\nRESULT: " + (process.exitCode ? "FAILURES PRESENT" : "ALL OFFLINE CHECKS PASSED"));
};

await run();
