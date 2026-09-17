status: DONE

## evidence

$ npx --yes -p typescript@5.9 tsc --noEmit -p tsconfig.license-auth.json
TSC_CLEAN
(strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes; zero errors)

$ node --test test/*.test.mjs            (billing/, repo default node v20.17.0 path)
# tests 146
# pass 142
# fail 4          (the 4 pre-existing count-staleness failures below; license-auth adds 12 passing)

$ /opt/homebrew/opt/node@22/bin/node --experimental-strip-types --no-warnings --test test/license-auth.test.mjs
1..12
# tests 12
# pass 12
# fail 0

Cases: product key verifies; bundle "*" key verifies for any product; foreign-product key
refused with both products named; one flipped signature bit refused; payload swapped to "*"
after signing refused (escalation case); expired key refused, lifetime key passes; five
malformed inputs all fail closed; payloadShapeError rejects wrong shapes (version, empty p,
tenant-unsafe id "bad:id", non-integer iat, negative exp, non-string h); extract prefers
Bearer header > /t/<token> path > ?token=; gate denies tokenless requests naming
/mcp/connect; gate allows tools/call with a valid Bearer key and reports the license id;
a key minted by the real scripts/sign-license.mjs verifies under the real
keys/license-public.raw.b64 with the expected sha256(email) prefix and fails for the
wrong product.

$ npx wrangler secret list        (billing/, live worker mcp-billing)
[ { "name": "LICENSE_PRIVATE_KEY_PEM", "type": "secret_text" },
  { "name": "STRIPE_SECRET_KEY", "type": "secret_text" },
  { "name": "STRIPE_WEBHOOK_SECRET", "type": "secret_text" } ]
-> STRIPE_SECRET_KEY exists as a live worker secret, so Stripe is agent-wirable, not
human-gated; recorded as such in PAYMENTS.md.

$ security find-generic-password -s StripeCLI -a default.live_mode_api_key -w
rk_liv...Neuw      (live restricted key present locally; expires 2026-11-04 per billing/RESULT.md)

$ npm_config_cache=/Users/mike/.npm-cache-local node --test billing/test/*.test.mjs  (pre-existing suite, unchanged)
# tests 134
# pass 130
# fail 4          (same 4 pre-existing failures listed under failures; no new failures introduced)

## artifacts
billing/PAYMENTS.md                      options matrix, 5 rails, fees from official pages, wiring steps
billing/src/license-auth.ts              LicenseAuth middleware (WebCrypto Ed25519, Workers-compatible)
billing/tsconfig.license-auth.json       strict tsc config (noEmit)
billing/test/license-auth.test.mjs       12 unit tests, node:test + node:assert, no new deps

## cost
28 wall minutes. Zero paid API calls.

## failures
1. Pre-existing, NOT fixed (out of scope): 4 failures in billing/test/figures.test.mjs and
   billing/test/checkout-r1.test.mjs, all count-staleness between the home page copy and
   derived figures:
   - checkout-r1.test.mjs:407  VALIDATION/BILLING_TEST_COUNT: 411 !== 500
   - figures.test.mjs:53       catalogue counts: home claims 1135 checks / 38 servers, derived 42/41
   - figures.test.mjs:63       home page server count 38 not derivable (derived 42, 41)
   - figures.test.mjs:138      guide figure 0.22 has no source file
2. Local default node is v20.17.0, which has no --experimental-strip-types, so
   billing/test/license-auth.test.mjs self-hosts: on node >= 22.6 it imports
   src/license-auth.ts directly; on node 20 it first compiles the module with the repo's
   tsc (node_modules/.bin/tsc, 5.9.3) into test/.build/ (gitignored) and imports that.
   The default `npm test` glob path (node 20) and the strip-types path (node 22.23.2)
   both run the same 12 cases. Node's strip-only mode rejects TypeScript parameter
   properties, so the class field is written out explicitly.

## insight
Stripe is NOT human-gated on this estate and should stop being described as if it were:
the live worker secret (verified with `npx wrangler secret list`), the local keychain
restricted key, and the inline-price_data path proven in data/checkout_r1.json mean a new
sellable product is a code change plus one wrangler deploy, with no dashboard step. The
only human-gated rails in the matrix are GitHub Sponsors (signed-in enablement) and Lemon
Squeezy setup (KYC), plus the Telegram bot token at @BotFather.
