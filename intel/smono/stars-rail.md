# Stars Rail for the MCP Product Estate — Verified Plan

STATUS: complete (verified 2026-10-28)
CAN DEPLOY: **YES** — Cloudflare token is valid and deployable (see §2).

## 1. Fleet Stars capability (read-only evidence)

Grep for `sendInvoice|XTR|createInvoiceLink|pre_checkout` across `/Users/mike/tgbots` (`*.ts`/`*.mjs`/`*.js`) hits ~20+ files. The Stars rail is a **shared kit module** copied per-bot, not per-bot bespoke code:

- `hub/src/kit.ts` — line 9: `export const PRO_STARS = 150;`
- `hub/src/kit.ts` line 443: `await ctx.replyWithInvoice(spec.title, spec.description, payload, "XTR", [{ label: spec.title, amount: spec.stars ?? PRO_STARS }]);` — currency XTR, default price **150 stars** (cryptofolio sells at 75 via per-bot `stars` override, S454).
- `hub/src/kit.ts` line 552: `bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));` — auto-approve pre-checkout (comment at line 536: handles `/pro`, "pro" callback, pre_checkout, successful_payment).
- Same kit copied into: `split/src/kit.ts`, `wordrace/src/kit.ts`, `budget/src/kit.ts`, `rsvp/src/kit.ts`, `tarot/src/kit.ts`, `quiz/src/kit.ts`, `crush/src/kit.ts`, `giveaway/src/kit.ts`, `vocab/src/kit.ts`, `focus/src/kit.ts`, and `ackorder.ts` payment-confirmation modules under `split/`, `rsvp/`, `budget/`, `quiz/`, `wordrace/`.
- One real payment in fleet history (FREEZE.md §"birthday is UNFROZEN"): 150⭐ `bday-pro:<group>` on the birthday bot at 2026-10-07T21:10:31Z, f_invoice 2 → f_paid 1.

**The rail already exists end-to-end in the fleet kit; the MCP estate just needs a bot-side invoice with a different payload/licence bridge.**

## 2. Deployment status — CAN DEPLOY

- Wrangler configs: 43 `wrangler.toml` files under `/Users/mike/tgbots` (one per bot incl. `hub/wrangler.toml`). Workers, not server/systemd/pm2/rsync.
- `npx wrangler whoami` — **SUCCEEDED** (contrary to the expected invalid-token failure): logged in with a User API Token, account `dd3f2a29b7707e21a87f26a622c0bb9d`. No blocker.
- `npx wrangler deployments list` in `hub/` — SUCCEEDED with node@22 (default node v20.17.0 is too old for wrangler 4.x; use `/opt/homebrew/opt/node@22/bin`). Shows prior deployments by the same account (latest 2026-10-17T10:56:46Z).
- `git remote -v` in `/Users/mike/tgbots`: empty — deploy is via wrangler push, not git CI.

**Verdict: CAN DEPLOY** — `cd /Users/mike/tgbots/hub && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx wrangler deploy`. Only wrinkle: node ≥22 required on PATH.

## 3. Hub bot live-API evidence

Token read from `/Users/mike/tgbots/.tok_hub.json` (raw token string; not printed). Two read-only calls:

- `getMe` → `ok:true`, bot **@TinyTelegramToolsBot**, id 8892370181, name "Bot Directory · All Tools · Tiny Telegram Tools", supports inline queries & main web app.
- `getMyStarBalance` → `{"ok":true,"result":{"amount":0}}` — **hub balance 0⭐**. The rail is API-live on hub; the 150⭐ earned payment sits on the *birthday* bot's balance, not hub's.

## 4. Exact plan: Stars rail for the $39 bundle

**Stars arithmetic.** Telegram prices XTR at ~1 star ≈ $0.013 (Bot API: XTR amounts are integer stars; Telegram's published proceeds are ≈ $0.013/star after conversion). $39 ÷ $0.013 ≈ **3,000 stars**. If you instead want net $39 after Telegram's ~30-45% proceeds share, you need more stars — recommend pricing by proceeds: to net ≈$39 at ~$0.0095/star proceeds, charge ≈ **4,100 stars**. Suggest launching at 3,000⭐ (face value ≈ $39) and stating proceeds honestly.

**API calls (exact):**

1. Create invoice link (works outside chat context, ideal for the MCP product pages / hub bot):
```http
POST https://api.telegram.org/bot<TOKEN>/createInvoiceLink
Content-Type: application/json

{"title":"MCP Bundle — 46 Servers","description":"All 46 hosted MCP servers + bundle licence",
 "payload":"mcp-bundle:<licence-uuid>","currency":"XTR","provider_token":"",
 "prices":[{"label":"MCP Bundle","amount":3000}]}
```
`provider_token` must be the empty string for Stars. Returns a `https://t.me/$...` link usable from any chat or a web page.
2. Fulfilment: on `successful_payment` (update field `successful_payment.invoice_payload` = `mcp-bundle:<uuid>`), mint the licence key, deliver via reply + email, and record in the same store the Stripe path uses (`mcp-servers` licence store per CONVENTIONS.md). Auto-approve first: `bot.on("pre_checkout_query", ctx => ctx.answerPreCheckoutQuery(true))` — already in the kit.
3. Optional refund: `POST /bot<TOKEN>/refundStarPayment` `{"user_id":...,"telegram_payment_charge_id":...}`.

**Where the handler goes:** clone the `hub/src/kit.ts` pro-block (lines ~536-552: `replyWithInvoice(...,"XTR",...)`, `pre_checkout_query` auto-approve, `successful_payment` handler) into a small `mcp-bundle` handler. Two options:
- (a) On **hub** (`hub/src/index.ts`, registering the kit's `/pro`-style command): add a `/bundle` command that calls `createInvoiceLink` via the raw Bot API (kit uses `replyWithInvoice`; a link is better for cross-sell from product pages), and a `successful_payment` branch keyed on payload prefix `mcp-bundle:` that writes a licence to the mcp-servers store. Deploy: `cd hub && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx wrangler deploy`.
- (b) Minimal-change path: the kit already supports per-bot price overrides (`stars?: number` in `ProSpec`, `hub/src/kit.ts:422`) — set the bundle price there and reuse the existing `/pro` flow with an `mcp-bundle:` payload.

**Buyer journey:** buyer clicks the `t.me/$...` invoice link from the product page → pays stars in Telegram → `successful_payment` fires on hub → handler mints licence key → reply in chat + (already-connected) Resend email → key redeems at `mcp-servers` `/mcp/connect` flow.

## 5. Revenue ceiling (honest)

FREEZE.md user counts (S456 snapshot): frozen 15 bots = 78 users; active 6 = anon 352, countdown 79, anonsay 48, party 48, whisper 45, pulse 27 (= 599); hub 1; approver/spyparty 0. **Total ≈ 638 users fleet-wide.** Estate traction is near zero (CLAUDE.md: Stripe gross $0, 0 paid matches, 38 impressions/0 clicks).

- 1% conversion of 638 ≈ 6 sales × $39 ≈ **$237** (gross stars ≈ $237 × ~65-70% proceeds ≈ $155 net).
- 3% conversion ≈ 19 sales × $39 ≈ **$745** (≈ $487 net).

The Stars rail is cheap to ship (kit exists, deploy works) but the ceiling is a few hundred dollars; the binding constraint is demand, not rails.

## Evidence log
- `hub/src/kit.ts:9,422,437,443,536,552` — PRO_STARS=150, XTR invoice, pre-checkout handler.
- 43× `*/wrangler.toml`; `git remote -v` empty; `scripts/wire-*.sh` helpers exist.
- `npx wrangler whoami` OK (account dd3f2a29…); `wrangler deployments list` OK under node@22 (v22.23.3); node v20 rejected by wrangler 4.151.1.
- `getMe` → @TinyTelegramToolsBot ok; `getMyStarBalance` → 0⭐.
- `FREEZE.md` — 25 bots, ~638 users; birthday 150⭐ payment 2026-10-07T21:10:31Z.
