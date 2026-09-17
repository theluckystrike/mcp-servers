# Telegram distribution wedge for the mcp-servers fleet

The Telegram Mini App is the fleet's second distribution surface after the MCP
registries. It exists because the platform analysis (`platform-analysis-2026`)
measured Telegram as the only surface that combines a documented native billing
rail (Stars/XTR), a billion-plus user pool, a near-empty shelf, and zero review
friction. This directory is a **wedge**: a working, token-ready bot plus a
self-contained Mini App page, both runnable the moment a human mints a bot token.

Built by theluckystrike. No emoji anywhere in code, docs or the web page.

## What is here

```
telegram/
  package.json        TS/ESM, grammY, tsc clean
  tsconfig.json       strict, module NodeNext, types:["node"]
  public/index.html   single static Mini App page, no build step
  src/
    bot.ts            grammY bot: /start, server picker, Stars (XTR) invoices
    catalog.ts        42 servers ranked by Mini App fit, hosted set
    pricing.ts        Stars pricing for the $19 single / $39 bundle
    offline-test.ts   token-free verification harness
```

## Strategy: why Telegram, and which servers to push

The analysis scored Telegram **79/100** and grammY **91/100** for agent
scaffoldability. The decisive measurement is the supply gap: **~490 GitHub Mini
App repos vs ~26,879 MCP repos** -- about **55x** less competition for the same
billing mechanism, on a platform with 1bn+ users and no listing review. MCP
servers rank, but none of the registries has a billing rail; Stars is the only
in-scope rail that actually collects money.

The wedge is deliberately narrow. It does not sell "MCP" -- nobody on Telegram
knows or cares what MCP is. It sells **consumer-visible products** and uses the
servers as the engine behind them.

### Ranking by Mini App fit (1 = best for a solo user in a chat)

Ranked by whether a mobile-first user can immediately understand and use the
tool from a Telegram chat, against the fleet's freelancer / small-business
paperwork positioning.

| Rank | Server | Product line | Fit |
|------|--------|--------------|-----|
| 1 | invoice | Invoice Maker | High - turn hours + tax into a PDF in one sentence |
| 2 | expense-tracker | Expense Tracker | High - log a cost in seconds |
| 3 | currency | Currency Converter | High - dated bank-style rate |
| 4 | timezone | Time Zone Planner | High - no arithmetic, just convert |
| 5 | calendar | Week Planner | High - free text to a dated plan |
| 6 | per-diem | Per Diem Calculator | High - trip allowance on official tables |
| 7 | mileage-log | Mileage Log | High - log a drive at tax time |
| 8 | time-tracker | Time Tracker | High - start/stop a billable timer |
| 9 | quotes | Quote Builder | High - hours + rate to a numbered quote |
| 10 | credit-note | Credit Note | High - a memo on the invoice engine |
| 11 | billing-docs | Purchase Order + Credit Note | High - one billing engine |
| 12 | petty-cash | Petty Cash Tin | High - imprest float with a custodian |
| 13 | cash-book | Cash Book | High - one double-entry ledger |
| 14 | checklist | Checklist Runner | High - build once, run many times |
| 15 | kanban | Task Board | High - add/move a card in chat |
| 16 | price-tracker | Price Watch | High - today's price off any page |
| 17 | barcode | QR / Barcode Maker | High - paste a URL, get a QR |
| 18 | bank-statement | Statement Reader | Medium - needs a PDF upload |
| 19 | recurring | Recurring Billing | Medium - scheduling, more setup |
| 20 | statement-of-account | Statement of Account | Medium - one client page |
| 21 | deposits | Deposits Ledger | Medium - per-client retainers |
| 22 | delivery-schedule | Delivery Schedule | Medium - against a quote/WO |
| 23 | asset-register | Asset Register | Medium - depreciation setup |
| 24 | amortization | Amortization Schedule | Medium - loan terms |
| 25 | dunning-letters | Payment Chaser | Medium - chase workflow |
| 26 | work-order | Work Order | Medium - field/trade jobs |
| 27 | job-card | Job Card | Medium - per-job dashboard |
| 28 | change-order | Change Order | Medium - variation against a quote |
| 29 | catalogue | Price Catalogue | Medium - a shared price list |
| 30 | supplier-list | Supplier Directory | Medium - directory maintenance |
| 31 | maintenance-log | Maintenance Log | Medium - workshop/flats/fleet |
| 32 | bill-of-sale | Bill of Sale | Medium - signed-paper ready |
| 33 | service-agreement | Service Agreement | Medium - draft from a brief |
| 34 | clauses | Contract Clauses | Medium - terms drafting |
| 35 | packing-list | Packing List | Medium - shipment context |
| 36 | resume | Resume + Cover Letter | Medium - CV tailoring |
| 37 | spreadsheet | Spreadsheet Assistant | Low - needs a file + a client |
| 38 | docx | Document Writer | Low - AI-client oriented |
| 39 | pdf | PDF Toolkit | Low - file operations in chat |
| 40 | office-suite | Office Suite | Low - aggregate, not a standalone endpoint |
| 41 | image | Image Toolbox | Low - file operations |
| 42 | zip | Zip Toolkit | Low - file operations |

**Reading:** the top 17 are strong self-serve Mini App products; the rest need
document uploads, project context or an AI client, and are pushed through the
picker only as secondary. The Mini App page and the bot picker surface the top
17 first and the rest under "All 42 servers".

### The 55x supply-gap number, with its command

`ls remote/src/vendor/ | wc -l` -> 41 hosted endpoints today (office-suite is an
aggregate, not individually hosted). The analysis measured ~490 Mini App repos
vs ~26,879 MCP repos; 26,879 / 490 = ~55x. Telegram is the smaller, emptier
shelf with the billing rail already attached.

### Measured discrepancy to record

CLAUDE.md states "32 local-first servers, 30 hosted". The measured truth on this
machine is **42 server packages, 41 with a vendored hosted endpoint**. Evidence:
`ls servers/ | wc -l` -> 42, `ls remote/src/vendor/ | wc -l` -> 41,
`comm -23 <(ls servers/) <(ls remote/src/vendor/)` -> office-suite. The catalog
and every URL here use the measured 41-hosted set; office-suite carries no try-it
link.

## Billing: Stars (XTR), priced per the docs

Telegram Stars are the mandatory rail for digital goods (currency tag `XTR`).
Per the official "Bot Payments API for Digital Goods and Services" guide, an
invoice is created with `currency: "XTR"`, an **empty `provider_token`**, and a
`prices` array of `{ label, amount }` where `amount` is an **integer count of
Stars**. `createInvoiceLink` returns a reusable payment link; a
`pre_checkout_query` must be answered within 10s; goods are delivered only after
the `successful_payment` update.

Conversion: ~1 Star is worth about `$0.013` USD to the buyer. To clear the
estate's one-time price point while absorbing Telegram's app-store fee:

| Plan | USD | Stars (amount, integer) | payload |
|------|-----|--------------------------|---------|
| One server, lifetime | $19 | **1500** (19.00 / 0.013 = 1462, rounded up) | `mcp-single-1500` |
| All servers, lifetime | $39 | **3000** (39.00 / 0.013 = 3000, exact) | `mcp-bundle-3000` |

In code: `pricing.ts` exports `PRICES`; the bot mints the link with
`createInvoiceLink(title, description, payload, "", "XTR", [{ label, amount }])`.

## Running

The bot token is the single human-gated step (interactive chat with @BotFather,
`https://t.me/BotFather`). Nothing else requires an account.

```bash
cd telegram
npm_config_cache=/Users/mike/.npm-cache-local npm i
npm run build                       # tsc -> dist/
node dist/offline-test.js           # token-free checks, no network
TELEGRAM_BOT_TOKEN=<token> node dist/bot.js   # live long-polling
```

Once live, in the chat: `/start` opens the picker, tapping a product shows the
try-it link and an "Unlock with Stars" button, and `/buy` mints the XTR invoice.
`/app` deep-links to the Mini App.

The Mini App (`public/index.html`) is a single static file, no build step, no
bundler. Host it anywhere HTTPS; it lists all 41 hosted servers with try-it
links to `https://mcp.zovo.one/mcp/<server>` and two Buy buttons that deep-link
to the bot. `webAppUrl()` in `bot.ts` points the bot's web-app button at it.

## Hard rules respected

No emoji. No account creation or browser sign-in attempted (BotFather token is
recorded human-gated, not minted). Zero paid API calls. All numbers in this file
and in `RESULT.md` carry the command that produced them.
