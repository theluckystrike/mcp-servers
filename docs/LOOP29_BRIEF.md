# Loop 29 brief (2026-09-07)

## Measured at loop start (all by probe, not memory)
| Signal | Value | How |
|---|---|---|
| Bundle downloads, all releases | 5,105 | `gh api repos/theluckystrike/mcp-servers/releases` sum of asset download_count |
| Sitemap URLs | 312 | `curl mcp.zovo.one/sitemap.xml \| grep -c '<loc>'` |
| Products in /health | 31 | `curl mcp.zovo.one/health` |
| Buy routes live (browser UA) | 27 of 31 -> checkout.stripe.com | curl -A "<Chrome UA>" -D - /buy/<id> |
| Buy routes 503 price-pending-human | work-order, catalogue, change-order | header `x-mcp-buy: price-pending-human` |
| Buy routes 404 | office-suite | no PRODUCTS entry |
| Sales | 0 | ledger |
| Upgrade clicks 7d | 152 | data/kpi.json |

## TRAP found this loop (do not repeat)
`curl` without a browser User-Agent gets a 303 to `/s/<id>` with header
`x-mcp-buy: scripted-ua-no-session`. This is the worker's scripted-UA guard, NOT an outage.
ALWAYS probe /buy/ with `-A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"`.

## Stripe key facts (measured 2026-09-07)
- The key in the keychain (`security find-generic-password -s StripeCLI -w`) and in
  `~/.config/stripe/config.toml` is `rk_live_...hu5f`. It has NEITHER `product_write`
  NOR `checkout_session_write`. It cannot be used for anything here.
- The DEPLOYED worker secret `STRIPE_SECRET_KEY` is a different, broader key: the live
  worker successfully creates Checkout Sessions. Its exact scopes are unknown and
  unreadable. Test capability by deploying and probing, never by the keychain key.

## Hard rules for every agent this loop
1. NO paid APIs. No DataForSEO, no paid listing fees, no ads, no paid review. If a
   surface asks for money, record `skipped: paid` and move on.
2. NO submissions on any account other than the ones already in use here.
3. Every number you write must name the command or file it came from. No estimates.
4. Own only your assigned files. Never edit a file another agent owns.
5. Do not run `npx wrangler deploy` unless you are the billing owner (agent A).
6. Never `git push --force`, never rewrite history, never delete another agent's work.
7. If blocked by a human step, write it to docs/HUMAN_GATED_PACK.md and keep going.
