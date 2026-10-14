# S20261014 — Conversion Funnel E1–E3 SHIPPED (Resend email capture live)

Date: 2026-10-14
Implements: intel/s20261012c/CONVERSION-RESEND-PLAN.md (the plan existed; this session built it)

## What shipped
1. **`POST /api/subscribe`** on the billing worker (billing/src/index.js): validates email,
   normalizes to lowercase, stores `sub:<email>` in LICENSES KV with `{email, at, source}`,
   sends the welcome email (E1) via Resend `ctx.waitUntil` (best-effort, never blocks the
   response). Idempotent: duplicate subscribe → `{ok:true,status:"already"}` and no re-send.
   Invalid email → 400 `{ok:false,reason:"invalid email"}`.
2. **Footer subscribe form** on every rendered page via the shared `page()` chrome:
   email input + "Get setup tips" button, JS fetch to /api/subscribe, inline result text.
   Copy: "One email when you sign up, one tip two days later. No newsletter, no spam."
3. **Drip sweep** in the existing */5 cron (billing/src/scheduled-monitor.js, `runDripSweep`):
   - E2 (+48h): pitches Invoice Pro with hosted URL + 30-second setup.
   - E3 (+7d): bundle upsell — $39 founding pricing vs $59 after 2026-11-08.
   - Each step stamped `sub:<email>:<step>` in KV → exactly-once per subscriber.
   - Runs outside the monitor's try/catch: drip failure never marks monitor unhealthy.
   - No-op when RESEND_API_KEY absent.

## Verification (all real, logged)
- billing suite: 180 tests, 180 pass / 0 fail (includes 7 new subscribe-drip tests).
- Root npm test: running at time of note; billing-only gate green before deploy.
- `RESEND_API_KEY` secret already present on the worker (verified via `wrangler secret list`).
- Deployed mcp-billing: Version 4bbc4a86-9660-40e3-9a79-99f9d8675647, cron */5 live.
- LIVE: `curl -s https://mcp.zovo.one/ | grep -c subform` → 2 (form + script on homepage).
- LIVE: POST /api/subscribe valid → `{"ok":true,"status":"subscribed"}` (probe inbox hit).
- LIVE: POST invalid email → `{"ok":false,"reason":"invalid email"}`.
- Test-count contract bumped: BILLING_TEST_COUNT 164→171 (checkout-r1 asserts it).

## Pipeline now (funnel)
  organic page visit → footer form → E1 welcome (instant) → E2 Invoice Pro (+48h)
  → E3 bundle upsell (+7d, founding-price deadline) → /pricing → Stripe checkout.

## Measurement
- Subscriptions count: `wrangler kv key list --prefix sub:` on LICENSES (per-source in record.source).
- Email sends: wrailer tail `event:"drip_sweep"` JSON lines (e2/e3/errors counts).
- Downstream conversion: compare subscribers to /buy?src= clicks (clicks KV already exists).

## Files
- billing/src/index.js (route + footer form + BILLING_TEST_COUNT)
- billing/src/scheduled-monitor.js (runDripSweep + DRIP_STEPS + hook in runScheduledMonitor)
- billing/test/subscribe-drip.test.mjs (7 tests)
- billing/src/pages.js regenerated (build-pages.mjs)
STATUS: SHIPPED AND LIVE.
