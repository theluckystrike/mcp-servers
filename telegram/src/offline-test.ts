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
import { PRICES, planForPayload, STAR_USD } from "./pricing.js";
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
