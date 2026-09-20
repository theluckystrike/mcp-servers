# T20 BILLING WIRING — leave + onboarding — S47

STATUS: in progress

## What changed
- billing/src/index.js HOSTED_SERVERS: added "leave" and "onboarding" (43 entries, matches servers/ count).
- billing/src/index.js /llms-full.txt route added (llmstxt.site deep variant; generated from same llms source).

## Honest verdict
BLOCKED (partially): `npm test` shows 3 failures, all the repo's own consistency gates
correctly detecting that leave + onboarding are not in PRODUCTS:
1. checkout.test.mjs "bundle description names the count" — SERVER_COUNT=41 vs 43 on disk.
2. HOSTED_SERVERS drift check — was failing, NOW FIXED by the patch above.
3. figures check — needs `node scripts/build-figures.mjs` after wiring.

PRODUCTS entries for leave/onboarding require two real Stripe price ids at $19.
The Stripe secret key exists only as a Cloudflare Worker secret (billing worker); it is
not in the local env, shell profiles, or scripts. Past sessions created price ids by hand
in the Stripe dashboard. Stubbing price ids would ship broken /buy endpoints, so it is
not done. HUMAN-GATED: Mike creates price_... ids for MCP Leave Pro and MCP Onboarding
Pro in dashboard.stripe.com, then PRODUCTS gets two entries and the count bumps to 43.

## Next
- Estate-wiring leaf (deleg_5d17b23d) is handling release-check matrix for both servers.
- After Stripe ids + estate wiring green: bump BILLING_TEST_COUNT honesty gate with any
  test count change, run node scripts/build-figures.mjs, npm test to 0 fail.
