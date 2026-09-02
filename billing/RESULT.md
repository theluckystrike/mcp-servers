status: DONE

## What is live
- Worker: mcp-billing (Cloudflare account dd3f2a29b7707e21a87f26a622c0bb9d)
- URLs: https://mcp.zovo.one (custom domain, active) and https://mcp-billing.lipmichal.workers.dev
- Stripe mode: LIVE. Real cards will be charged. Restricted key rk_live_... (expires 2026-11-04).
- KV namespace LICENSES id 75f8bf4872a0433285d11575cece8641
- Webhook endpoint we_1UBDXNJKCamubEm1bVV0lqnX -> https://mcp.zovo.one/webhook, event checkout.session.completed
- Custom domain outcome: SUCCEEDED on the first redeploy. zone zovo.one is on this account; wrangler provisioned the
  DNS record and cert without manual steps. CHECKOUT_BASE in packages/mcp-license needs no change.

## Stripe objects (LIVE)
product id | Stripe product | Stripe price | amount
time-tracker  | prod_VBaes22x8ep6dy | price_1UBDU5JKCamubEm1wPMZI8Zf | 1900
price-tracker | prod_VBaf0G0s9cXwUA | price_1UBDU6JKCamubEm1ufsEKwSS | 1900
spreadsheet   | prod_VBafhH6MyyTg6X | price_1UBDU7JKCamubEm1LZTfrsMd | 1900
invoice       | prod_VBaftxRo2s4HVY | price_1UBDU8JKCamubEm1Ybcp5IUs | 1900
bundle        | prod_VBafU5C9o9d0f3 | price_1UBDU9JKCamubEm1dWgRjtoW | 3900
All five products carry statement_descriptor "MCP PRO"; each Checkout Session also sets
payment_intent_data[statement_descriptor_suffix]=MCP PRO.

## Routes
GET  /                 5 products, Buy buttons, activation note, repo link
GET  /buy/:product     backend-created Checkout Session (mode payment, allow_promotion_codes,
                       metadata.product, success_url https://<host>/success?session_id={CHECKOUT_SESSION_ID}),
                       303 to session.url. No Payment Links anywhere.
GET  /success          retrieves the session, requires payment_status == paid, mints the Ed25519 key,
                       stores session:<id> -> key in KV (read-before-write so reloads and the webhook agree),
                       renders key + "In Claude: run license_activate with this key" + MCP_LICENSE_KEY env
                       alternative + per-product install snippet
POST /webhook          checkout.session.completed, HMAC-SHA256 v1 signature check with 300 s tolerance,
                       constant-time compare, pre-mints into the same KV key
GET  /verify?key=      {ok, product, id, iat, exp}; optional &product= to scope the check
GET  /health           {ok, signer, products, stripe_mode}

## evidence

$ stripe products create --live --name "MCP Time Tracker Pro" ...
prod_VBaes22x8ep6dy   (LIVE creation with the restricted key succeeded; no fallback to test mode was needed)

$ wrangler kv namespace create LICENSES
id: 75f8bf4872a0433285d11575cece8641

$ wrangler deploy
Deployed mcp-billing triggers
  https://mcp-billing.lipmichal.workers.dev
  mcp.zovo.one (custom domain)

$ curl -s https://mcp.zovo.one/health
{"ok":true,"service":"mcp-billing","signer":"ok","products":["time-tracker","price-tracker","spreadsheet","invoice","bundle"],"stripe_mode":"live","time":"2026-09-02T12:46:02.582Z"}

$ curl -sI https://mcp.zovo.one/buy/time-tracker
HTTP/2 303
location: https://checkout.stripe.com/c/pay/cs_live_b1hy5398lsltSfoQR2MJjsQ14fw3i7OyLl6I83TODfLA7CGRYLgEHzwgFX#...

$ curl -so /dev/null -w '%{http_code}' https://mcp.zovo.one/buy/nope
404

$ KEY=$(node ../scripts/sign-license.mjs invoice buyer@example.com)
$ curl -s "https://mcp.zovo.one/verify?key=$KEY"
{"ok":true,"product":"invoice","id":"373a73893b9a","iat":1788353169,"exp":null}
$ curl -s "https://mcp.zovo.one/verify?key=$KEY&product=spreadsheet"
{"ok":false,"product":null,"id":null,"reason":"key is for invoice, not spreadsheet"}

$ curl -so /dev/null -w '%{http_code}' -X POST https://mcp.zovo.one/webhook -H 'stripe-signature: t=1,v1=deadbeef' -d '{}'
400
$ curl -so /dev/null -w '%{http_code}' -X POST https://mcp.zovo.one/webhook -d '{}'
400
$ curl -so /dev/null -w '%{http_code}' https://mcp.zovo.one/success
303   (no session_id -> back to /)
$ curl -so /dev/null -w '%{http_code}' "https://mcp.zovo.one/success?session_id=cs_live_bogus"
500   (Stripe: no such session)

$ npm_config_cache=/Users/mike/.npm-cache-local node --test test/*.test.mjs
# tests 6
# pass 6
# fail 0
# duration_ms 75.271541
Cases: public-key constant matches keys/license-public.raw.b64; pemToDer yields a 48-byte PKCS8 DER;
a key minted by the worker signer verifies under packages/mcp-license/dist/index.js verifyLicense for all
four products and fails for the wrong product; a "*" bundle key unlocks all four; a payload swapped to "*"
under the original signature is rejected by both verifiers; identical inputs mint an identical key.

## Full command list
stripe products create --live --name "MCP Time Tracker Pro" --description "..."          (x5, one per product)
stripe products update <prod> --live -d "statement_descriptor=MCP PRO"                   (x5)
stripe prices create --live -d product=<prod> -d unit_amount=1900|3900 -d currency=usd   (x5)
stripe webhook_endpoints create --live -d url=https://mcp.zovo.one/webhook -d "enabled_events[]=checkout.session.completed" -d "description=mcp-billing worker"
stripe webhook_endpoints delete we_1UBDXCJKCamubEm1usV2qNyE --live
stripe webhook_endpoints retrieve we_1UBDXCJKCamubEm1usV2qNyE --live
security find-generic-password -s StripeCLI -a default.live_mode_api_key -w
wrangler kv namespace create LICENSES
wrangler deploy                                    (x4: initial, custom domain, HEAD fix, health signer probe)
wrangler secret put STRIPE_SECRET_KEY              (x2, see failures)
wrangler secret put LICENSE_PRIVATE_KEY_PEM        (< ../keys/license-private.pem)
wrangler secret put STRIPE_WEBHOOK_SECRET
curl on /health /buy/:product /buy/nope /verify /webhook /success, both hosts
node --test test/*.test.mjs

## artifacts
/Users/mike/mcp-servers/billing/src/index.js       router, Stripe REST, pages, webhook
/Users/mike/mcp-servers/billing/src/license.js     WebCrypto Ed25519 mint + verify, PEM->DER
/Users/mike/mcp-servers/billing/test/mint.test.mjs cross-verification against the shipped package
/Users/mike/mcp-servers/billing/wrangler.toml
/Users/mike/mcp-servers/billing/package.json
/Users/mike/mcp-servers/billing/RESULT.md

## cost
32 wall minutes. Zero paid API calls (Stripe object creation and Cloudflare deploys are free).

## failures
1. ~/.config/stripe/config.toml stores live_mode_api_key REDACTED (asterisks, first 8 and last 4 chars only).
   Uploading it as STRIPE_SECRET_KEY produced "Invalid API Key provided" and every /buy returned 502.
   Fixed by pulling the real 107-char key from the macOS keychain:
   security find-generic-password -s StripeCLI -a default.live_mode_api_key -w. The stripe CLI itself works
   because it reads the keychain, not the toml value.
2. First verification pass reported 404 on /buy/:product. Cause: curl -I sends HEAD and the router matched
   request.method === "GET" only. Fixed by normalizing HEAD to GET before routing.
3. stripe webhook_endpoints returns the signing secret only in the create response; retrieve omits it.
   The first endpoint had to be deleted and recreated with the secret captured from the create output.

## insight
A Stripe restricted key (rk_live_) created by the CLI could create products, prices, Checkout Sessions and
webhook endpoints in live mode with no permission error, so the planned test-mode fallback was never needed.
The blocker was never the key's scope; it was that the CLI persists a masked copy in config.toml and the
usable key only in the keychain. Any automation that reads the toml gets a string that looks valid, passes
every format check, and fails at the API. Read the keychain entry, not the config file.
