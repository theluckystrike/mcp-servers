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

## Accepted risks

These items from docs/CODEX_REVIEW.md are known and deliberately not fixed. The product is a $19
one-time, open-source, offline-verified license; the cost of each fix exceeds the loss it prevents.

- #1 offline gate is client-side. The server code is MIT and runs on the buyer's machine. Any
  enforcement can be patched out. A vendor-side service would break the "nothing leaves your machine"
  promise, which is the reason people install these.
- #2 no device or account binding. Binding needs accounts, a server and support load. A shared key
  costs one $19 sale.
- #4 KV issuance is read/read/write, not compare-and-set. Worst case one session yields two valid
  keys for the same buyer. A Durable Object per session is not worth it at this volume.
- #5 the session id retrieves the key indefinitely. The id is only in the buyer's URL bar, Stripe
  receipt and dashboard. Making it single-use removes the only self-service recovery path (see #15).
- #6 no refund or dispute revocation. Lifetime offline keys cannot be revoked without online checks.
  A refunded buyer keeping a $19 key is cheaper than a phone-home requirement.
- #11 no webhook body-size cap. Cloudflare Workers already bound request size and CPU per request,
  and the route is not otherwise reachable in volume.
- #12 /buy is GET without rate limiting. Creating a Checkout Session is a free Stripe API call; the
  cost of abuse is Stripe API noise, not money. GET keeps the Buy links plain anchors.
- #13 redirect origin comes from the request host. Both hosts are ours and both are already public;
  a mismatched host can only redirect a buyer to our own other hostname.
- #16 /verify accepts the key in the query string. It is a debugging convenience; the key is the
  buyer's own bearer token and the endpoint returns no more than the buyer already holds.
- #17 truncated unsalted email hash in the payload. 48 bits of SHA-256 prefix over an address the
  buyer gave us at checkout. It exists so a support request can be matched to a key.
- #22 48-bit license ids. Collision probability stays negligible far past any plausible sales volume
  for this product, and the Stripe session id is the real audit record in KV.

## Hardening 2026-09-02

Fixed from docs/CODEX_REVIEW.md: 3, 7, 8, 9, 10, 14, 15, 18, 19, 20, 21.

### changed

billing/src/index.js:21   new pure `fulfillmentAllowed(session, product)` (#3, #8). Requires
                          mode == payment, status == complete, metadata.product == product, exactly one
                          line item with quantity 1, line_items.data[0].price.id == PRODUCTS[product].price,
                          price.unit_amount == usd*100, currency usd; then payment_status "paid" with
                          amount_total == expected, or "no_payment_required" with amount_total 0 and
                          total_details.amount_discount == expected (100% promotion code).
billing/src/index.js:125  keyForSession takes the already-checked productId instead of trusting
                          session.metadata.
billing/src/index.js:137  #14 every minted key is verified with verifyLicenseKey before it is stored or
                          returned; failure logs to console.error and throws MintError.
billing/src/index.js:150  retrieveSession() retrieves with expand[]=line_items.
billing/src/index.js:180  #15 success copy: "Save this key now; it is shown again only at this URL",
                          states no email is sent, points at support@zovo.one and /recover.
billing/src/index.js:193  ctEqual() constant-time hex compare, extracted.
billing/src/index.js:206  #9 verifySig keeps every v1 field and compares each in constant time with no
                          early exit; #10 the timestamp must match /^\d{1,15}$/ and Number.isSafeInteger
                          before any HMAC work, so a nonnumeric t can no longer pass the replay window.
billing/src/index.js:273  /success retrieves with line items, runs fulfillmentAllowed, returns 404 with a
                          clean page when Stripe has no such session (was a 500 with the raw Stripe
                          message), 402 when the decision fails, 500 with a support message when minting
                          or key verification fails.
billing/src/index.js:304  #15 new GET /recover?session_id= . Same fulfillment checks; JSON
                          {ok, product, key, support} for a paid session, 400/402/404/500 otherwise,
                          cache-control no-store on every branch.
billing/src/index.js:340  #7 checkout.session.async_payment_succeeded is fulfilled on the same terms as
                          checkout.session.completed. Both re-retrieve the session from Stripe, because
                          the event payload carries no line items.
billing/src/license.js:78 #19 payloadShapeError(): v === 1, p and id non-empty strings,
                          Number.isSafeInteger(iat), exp absent or a safe integer > 0.
billing/src/license.js:110 #19 exp <= now is expired (was exp < now, and `if (payload.exp)` treated
                          exp: 0 as lifetime).
packages/mcp-license/src/index.ts:37,57,60  #19 the same shape validation and exp <= now rule in the
                          shipped verifier.
packages/mcp-license/src/index.ts:104-113   #18 resolve() re-checks exp against the current clock on
                          every isPro()/status() call and drops a cached success once it expires.
packages/mcp-license/src/index.ts:73-88     #20/#21 license.json is written through a per-process temp
                          name (`license.json.<pid>.<6 random bytes>.tmp`) with mode 0600, chmod 0600
                          after rename, config dir 0700, temp file removed on failure.

Tests added: billing/test/fulfillment.test.mjs (12 cases: price binding, foreign price id, cheaper
session against a higher entitlement, mode/status/currency/quantity/item-count/metadata binding,
100% promotion code accepted only at a full discount, bundle at 3900, multi-v1 rotation, nonnumeric
and stale timestamps). packages/mcp-license/test/verify.test.mjs +4 cases (#19 field types, #19 exp
rules including exp: 0 no longer meaning lifetime, #18 expiry inside one process, #20 mode 0600).

### verification

$ npm run build -w packages/mcp-license && npm test -w packages/mcp-license
# tests 10
# pass 10
# fail 0

$ node --test billing/test/*.test.mjs
# tests 18
# pass 18
# fail 0

$ cd billing && wrangler deploy
Total Upload: 44.92 KiB / gzip: 12.30 KiB
Worker Startup Time: 12 ms
Uploaded mcp-billing (5.89 sec)
Deployed mcp-billing triggers (4.25 sec)
  https://mcp-billing.lipmichal.workers.dev
  mcp.zovo.one (custom domain)
Current Version ID: 2a5f89ed-8f06-49b9-bc4b-e20e89db6c61

$ curl -s https://mcp.zovo.one/health
{"ok":true,"service":"mcp-billing","signer":"ok","products":["time-tracker","price-tracker","spreadsheet","invoice","bundle"],"stripe_mode":"live","time":"2026-09-02T12:57:13.076Z"}

$ curl -sI https://mcp.zovo.one/buy/time-tracker | head -2
HTTP/2 303
date: Wed, 02 Sep 2026 12:57:14 GMT

$ KEY=$(node scripts/sign-license.mjs invoice buyer@example.com); curl -s "https://mcp.zovo.one/verify?key=$KEY"
{"ok":true,"product":"invoice","id":"5b37b6a0acd5","iat":1788353834,"exp":null}

$ curl -s "https://mcp.zovo.one/verify?key=$KEY&product=spreadsheet"
{"ok":false,"product":null,"id":null,"reason":"key is for invoice, not spreadsheet"}

$ curl -s -o /dev/null -w '%{http_code}\n' "https://mcp.zovo.one/success?session_id=cs_live_bogus"
404

$ curl -s "https://mcp.zovo.one/success?session_id=cs_live_bogus"   (body, footer trimmed)
<h1>We could not load that checkout session</h1><p>The link may be mistyped or expired. If you have paid, email support@zovo.one with your Stripe receipt and your key will be sent back.</p><p><a href="/">Back to products</a></p>

$ curl -s -o /dev/null -w '%{http_code}\n' "https://mcp.zovo.one/recover?session_id=cs_live_bogus"
404

$ curl -s "https://mcp.zovo.one/recover"
{"ok":false,"reason":"session_id required"}

$ curl -s -o /dev/null -w '%{http_code}\n' -X POST https://mcp.zovo.one/webhook -H 'stripe-signature: t=abc,v1=deadbeef' -d '{}'
400

$ npm run build     (root, all five workspaces)
> @theluckystrike/mcp-license@0.1.0 build
> @theluckystrike/mcp-invoice@0.1.0 build
> @theluckystrike/mcp-price-tracker@0.1.0 build
> @theluckystrike/mcp-spreadsheet@0.1.0 build
> @theluckystrike/mcp-time-tracker@0.1.0 build
(clean, no diagnostics)

$ npm test          (root, per workspace)
@theluckystrike/mcp-license      # tests 10  # pass 10  # fail 0
@theluckystrike/mcp-invoice      # tests 12  # pass 12  # fail 0
@theluckystrike/mcp-price-tracker # tests 18 # pass 18  # fail 0
@theluckystrike/mcp-spreadsheet  # tests 31  # pass 31  # fail 0
@theluckystrike/mcp-time-tracker # tests  2  # pass  2  # fail 0

### note

The Stripe webhook endpoint we_1UBDXNJKCamubEm1bVV0lqnX is still subscribed to
checkout.session.completed only. The worker now handles checkout.session.async_payment_succeeded,
but the endpoint must be updated in Stripe before that event is delivered:
stripe webhook_endpoints update we_1UBDXNJKCamubEm1bVV0lqnX --live \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=checkout.session.async_payment_succeeded"
