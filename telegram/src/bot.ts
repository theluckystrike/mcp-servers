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
import { PRICES, PricePlan, productForPayload, invoiceParams } from "./pricing.js";
import { forwardUpdate, recordPendingPayment, ForwardOptions } from "./fulfill.js";

/** Buyer-facing USD per Star, kept in sync with STAR_USD in pricing.ts. */
export const STAR_RATE = 0.013;
void STAR_RATE;

/** Price of one Star, kept in sync with pricing.ts for human-facing strings. */
export { STAR_USD } from "./pricing.js";

export const BOT_TOKEN_ENV = "TELEGRAM_BOT_TOKEN";

/** Build the bot. Requires process.env[TELEGRAM_BOT_TOKEN] at bot.start(). */
export function buildBot(token: string, forward: ForwardOptions = {}): Bot {
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
    if (plan.key === "single") {
      // A single-server key must name its server in the payload, so offer the
      // picker instead of an anonymous invoice.
      const kb = new InlineKeyboard();
      for (const e of CATALOG.slice(0, PICKER_TOP)) {
        kb.text(`${e.product} - 1500 Stars`, `buy:single:${e.name}`).row();
      }
      kb.text("Back", "buy:menu").row();
      await ctx.reply("Which server? Top picks below - every hosted server is eligible:", { reply_markup: kb });
      return;
    }
    await sendInvoice(ctx, plan);
  });

  // Single-server invoice with the server baked into the payload, so the
  // minted key unlocks exactly what was paid for.
  bot.callbackQuery(/^buy:single:([a-z0-9][a-z0-9-]*)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const name = ctx.match[1];
    if (!CATALOG.some((e) => e.name === name)) {
      await ctx.reply("Unknown server - pick one from /buy.");
      return;
    }
    const plan = PRICES.find((p) => p.key === "single");
    if (!plan) return;
    await sendInvoice(ctx, plan, name);
  });

  // Pre-checkout and delivery are decided by the billing worker (POST /telegram/webhook),
  // which validates product, currency and Star amount, and mints through the same path as
  // Stripe, idempotent on telegram_payment_charge_id. Telegram allows 10 s to answer.
  bot.on("pre_checkout_query", async (ctx) => {
    try {
      const reply = await forwardUpdate(ctx.update, { attempts: 2, delayMs: 500, ...forward });
      if (reply.method === "answerPreCheckoutQuery") {
        if (reply.ok) await ctx.answerPreCheckoutQuery(true);
        else await ctx.answerPreCheckoutQuery(false, { error_message: reply.error_message || "Order refused." });
        return;
      }
      throw new Error("unexpected worker reply");
    } catch (err) {
      console.error("pre_checkout forward failed:", String(err));
      await ctx.answerPreCheckoutQuery(false, {
        error_message: "Checkout is unavailable for a moment. Nothing was charged; please try again shortly.",
      });
    }
  });

  bot.on("message:successful_payment", async (ctx) => {
    const sp = ctx.message.successful_payment;
    try {
      const reply = await forwardUpdate(ctx.update, forward);
      if (reply.method === "sendMessage" && typeof reply.text === "string") {
        await ctx.reply(reply.text, { link_preview_options: { is_disabled: true } });
        return;
      }
      throw new Error("unexpected worker reply");
    } catch (err) {
      recordPendingPayment({
        ts: new Date().toISOString(),
        provider: "telegram-stars",
        telegram_payment_charge_id: sp.telegram_payment_charge_id,
        user_id: String(ctx.from?.id ?? "unknown"),
        payload: sp.invoice_payload,
        stars: sp.total_amount,
        error: String(err),
      });
      await ctx.reply(
        `Payment received: ${sp.total_amount} Stars. Your key could not be issued right now ` +
          "(a problem on our side, not yours). Write to support@zovo.one with this payment id " +
          `and you will get the key or a full refund:\n${sp.telegram_payment_charge_id}`,
      );
    }
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
export async function sendInvoice(ctx: { api?: { createInvoiceLink: (t: string, d: string, p: string, token: string, cur: string, prices: { label: string; amount: number }[]) => Promise<string> }, reply: (text: string, opts?: object) => Promise<unknown> }, plan: PricePlan, server?: string): Promise<void> {
  const params = invoiceParams(plan, server);
  const prices = params.prices;
  const kb = new InlineKeyboard().text("Back", "menu:back");
  // With a live bot the invoice link is minted by createInvoiceLink (real-network,
  // token-gated). Without one, surface the plan so the buyer sees pricing.
  if (ctx.api) {
    try {
      // params, not plan: a single invoice must carry mcp-single-<server>. The plan
      // template payload "mcp-single-1500" would mint a key for product "1500".
      const link = await ctx.api.createInvoiceLink(
        params.title,
        params.description,
        params.payload,
        "", // provider_token: empty for XTR digital goods
        "XTR",
        prices,
      );
      await ctx.reply(`Buy ${plan.title} - ${plan.stars} Stars:`, {
        reply_markup: new InlineKeyboard().url("Pay with Stars", link).row().text("Back", "menu:back"),
      });
      return;
    } catch (err) {
      console.error("createInvoiceLink failed:", err);
      // fall through to the plan surface below
    }
  }
  await ctx.reply(
    `Invoice: ${plan.title}\n` +
      `${plan.description}\n\n` +
      `${plan.stars} Stars (approx. ${(plan.stars * STAR_RATE).toFixed(2)} USD)\n\n` +
      "Payment link opens once the bot token is live.",
    { reply_markup: kb },
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
