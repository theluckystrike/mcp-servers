# R35 Session — 2026-10-15 (upsell trailer + monetization audit)

## Verified result (shipped, live, proven)
- **Free-tier upsell trailer**: every successful `tools/call` JSON-RPC response for a
  non-Pro token now ends with a `content[]` text item:
  "Free tier: 600 calls/hour, 30-day retention. Pro ($19/server or $39 for all 47, one-time):
  https://mcp.zovo.one/buy/single?tenant=<token>&src=<server>.success"
- Checkout link verified 200; tenant query pre-bound; src-tag = <server>.success so
  conversion per server is measurable in the buy endpoint logs.
- Deployed worker version 7af7c65a; PR #56 merged to main (d76f3a30); live curl proof on
  invoice server (2 content parts, trailer present) and on fresh anon token.

## Monetization audit (intel/R35-monetization-audit.md, full list)
Top lever implemented: in-success upsell (only addressable population without new traffic
is the free tenants already holding data here — 280 anon tokens; 429 body already names
the price but only fires on limit, trailer fires on every success).
Next levers, in order:
1. Checkout page A/B: $19 single vs $39 bundle framing (bundle is 2.05x revenue per
   conversion at equal volume; measure which anchor converts free users better).
2. Resend outreach (needs user to create RESEND_API_KEY restricted to hello@zovo.one,
   store via `wrangler secret put RESEND_API_KEY` in billing worker — preferred, key
   never touches local files). Drip to free tenants with stored data = highest-intent list.
3. Dead remote endpoints fix: hourly-rate, office-suite (registry rows point at 404s).

## Platform-analysis takeaways (~/Desktop/research/platform-analysis-2026)
- Telegram (grammy + Stars/XTR): smallest most-stable toolchain (0 majors in 5y, 14 deps),
  1B+ users, official billing docs. Decision score 91/100.
- MCP supply: 26,879 topic repos = 55x more crowded than Telegram Mini Apps (490).
- Free demand instrument: public MAU badge on t.me/<bot> pages (crawlable, >=10k threshold).
- Conclusion: MCP fleet remains the asset; Telegram Mini App re-skins paid in Stars are the
  unsaturated second distribution surface — candidate for a future round.

## Distribution state
- Official registry: all 149 server names live (versions aligned 0.22.6–0.22.8), publish
  pipeline idempotent. Smithery still BLOCKED on interactive user login.
- Dashboard regenerated (data/ledger.json + dashboard/index.html) this session.

## Sound played (Glass.aiff) at wrap.
