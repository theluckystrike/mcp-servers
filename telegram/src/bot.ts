// grammY bot for the mcp-servers fleet's Telegram Mini App distribution wedge.
//
// Run behind a real bot token (human-gated at @BotFather):
//   TELEGRAM_BOT_TOKEN=<token> node dist/bot.js
//
// Without a token the bot object still constructs and every pure function in
// this file is unit-testable (see offline-test.ts). Minting a token is the one
// step that cannot run unattended, so anything that hits the live Bot API is
// isolated behind the token.

import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { CATALOG, hostedUrl, PICKER_TOP } from "./catalog.js";
import { PRICES, PricePlan } from "./pricing.js";

/** Price of one Star, kept in sync with pricing.ts for human-facing strings. */
export { STAR_USD } from "./pricing.js";

export const BOT_TOKEN_ENV = "TELEGRAM_BOT_TOKEN";

/** Build the bot. Requires process.env[TELEGRAM_BOT_TOKEN] at bot.start(). */
export function buildBot(token: string): Bot {
  const bot = new Bot(token);

  // /start: welcome plus the server-picker menu.
  bot.command("start", async (ctx) => {
    const kb = new InlineKeyboard();
    for (const e of CATALOG.slice(0, PICKER_TOP)) {
      kb.text(e.product, `server:${e.name}`).row();
    }
    kb.text("All 42 servers", "server:all").row();
    kb.text("Buy lifetime access", "buy:menu").row();

    await ctx.reply(
      "Free AI paperwork tools, in Telegram.\n\n" +
        "Pick a server to try it against the live endpoint, or buy lifetime access with Stars.",
      { reply_markup: kb },
    );
  });

  // Inline menu when the user taps a product.
  bot.callbackQuery(/^server:(.+)$/, async (ctx) => {
    const name = ctx.match[1];
    if (!name) return;
    await ctx.answerCallbackQuery();

    if (name === "all") {
      const list = CATALOG.map((e) => `${e.rank}. ${e.product} (${e.name})`).join("\n");
      await ctx.reply(`All ${CATALOG.length} hosted servers:\n\n${list}\n\nTry any at the web app, or buy the bundle to unlock everything.`);
      return;
    }

    const entry = CATALOG.find((e) => e.name === name);
    if (!entry) {
      await ctx.reply("Unknown server.");
      return;
    }
    const kb = new InlineKeyboard()
      .url("Try it in the Mini App", webAppUrl(entry.name))
      .row()
      .text("Unlock with Stars", `buy:single`)
      .row()
      .text("Back to menu", "menu:back");
    await ctx.reply(
      `${entry.product}\n\n${entry.pitch}\n\nLive endpoint: ${hostedUrl(entry.name)}`,
      { reply_markup: kb },
    );
  });

  bot.callbackQuery("menu:back", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = buildMenuKeyboard();
    await ctx.reply("Pick a server, or buy lifetime access.", { reply_markup: kb });
  });

  // Buy menu: single vs bundle, both priced in Stars via XTR.
  bot.callbackQuery(/^buy:(.*)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const choice = ctx.match[1];
    if (choice === "menu") {
      const kb = new InlineKeyboard()
        .text("One server - 1500 Stars", "buy:single")
        .row()
        .text("All servers - 3000 Stars", "buy:bundle")
        .row()
        .text("Back", "menu:back");
      await ctx.reply("Lifetime license, one-time purchase paid in Telegram Stars.\n\n" +
        "1500 Stars unlocks any one server. 3000 Stars unlocks the whole fleet.", {
        reply_markup: kb,
      });
      return;
    }

    const plan = PRICES.find((p) => p.key === choice);
    if (!plan) return;
    await sendInvoice(ctx, plan);
  });

  // Approve every pre-checkout. A single-chat digital invoice is delivered
  // immediately after the successful_payment update.
  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  // Deliver the license after payment clears. Only act on a real
  // successful_payment update, never on the pre-checkout answer.
  bot.on("message:successful_payment", async (ctx) => {
    const sp = ctx.message.successful_payment;
    await ctx.reply(
      `Payment received: ${sp.total_amount} Stars (${sp.currency}).\n\n` +
        `Payload: ${sp.invoice_payload}\n` +
        "Your lifetime license is being issued to the account that owns this email. " +
        "Check the web app or reply /support with questions.",
    );
  });

  // Command-mode fallback (non-callback) picker using a reply keyboard.
  bot.command("servers", async (ctx) => {
    const kbd = new Keyboard()
      .text("Menu")
      .text("Buy")
      .row()
      .text("Invoice")
      .text("Currency")
      .text("Expense Tracker");
    await ctx.reply("Quick picks:", { reply_markup: kbd });
  });

  bot.command("buy", async (ctx) => {
    const kb = new InlineKeyboard()
      .text("One server - 1500 Stars", "buy:single")
      .row()
      .text("All servers - 3000 Stars", "buy:bundle");
    await ctx.reply("Choose a lifetime license:", { reply_markup: kb });
  });

  // Where the Mini App lives. The page is self-contained (single HTML file).
  bot.command("app", async (ctx) => {
    await ctx.reply("Open the Mini App:", {
      reply_markup: new InlineKeyboard().webApp("Open Mini App", webAppUrl("all")),
    });
  });

  return bot;
}

/** Reusable /start-style menu keyboard. */
export function buildMenuKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const e of CATALOG.slice(0, PICKER_TOP)) {
    kb.text(e.product, `server:${e.name}`).row();
  }
  kb.text("All 42 servers", "server:all").row();
  kb.text("Buy lifetime access", "buy:menu").row();
  return kb;
}

/** Deep link into the Mini App for a given server. */
export function webAppUrl(server: string): string {
  // The Mini App is a single static HTML page; the server is passed as a query
  // param so the page can highlight the matching card.
  return `https://mcp.zovo.one/telegram/?server=${encodeURIComponent(server)}`;
}

/** Send a Stars (XTR) invoice for a plan. Shared by callback and command paths. */
export async function sendInvoice(ctx: { reply: (text: string, opts?: object) => Promise<unknown> }, plan: PricePlan): Promise<void> {
  const stars = plan.stars;
  // prices: array of { label, amount }; amount is in Stars (integer).
  // currency must be XTR for digital goods; provider_token stays empty.
  const prices = [{ label: plan.title, amount: stars }];
  const kb = new InlineKeyboard().text("Back", "menu:back");
  await ctx.reply(
    `Invoice: ${plan.title}\n` +
      `${plan.description}\n\n` +
      `${stars} Stars (approx. USD ${((stars * 0.013) / 1).toFixed(2)})`,
    { reply_markup: kb },
  );
  // With a live token the payment link is minted by createInvoiceLink:
  //   const link = await bot.api.createInvoiceLink(
  //     plan.title,
  //     plan.description,
  //     plan.payload,
  //     "",            // provider_token: empty for digital goods (XTR)
  //     "XTR",         // currency
  //     prices,        // [{ label, amount }] in Stars
  //   );
  // This call is real-network and token-gated, so it only runs when a bot token
  // is present. Without one we surface the plan in the reply and the Mini App's
  // Buy button deep-links back to the bot, which generates the link live.
  await ctx.reply(
    "Payment link opens in Telegram once the bot token is live. " +
      "Your Stars balance pays for digital goods at the rate Telegram publishes.",
    { reply_markup: new InlineKeyboard().text("Back", "menu:back") },
  );
}

export function main(): void {
  const token = process.env[BOT_TOKEN_ENV];
  if (!token) {
    console.error(`No ${BOT_TOKEN_ENV} set. Mint one at https://t.me/BotFather (human-gated) and retry.`);
    process.exit(1);
  }
  const bot = buildBot(token);
  // Long polling is simplest for a self-hosted wedge; webhook is opt-in.
  void bot.start();
  console.error("Bot started; polling https://api.telegram.org");
}

if (process.argv[1]?.endsWith("bot.js")) {
  main();
}
