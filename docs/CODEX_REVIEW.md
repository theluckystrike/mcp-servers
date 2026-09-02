1. `packages/mcp-license/src/index.ts:94-96` — P0 — Pro enforcement is a local boolean in code controlled by the user; modifying `isPro()` unlocks every gated call. Fix: move Pro operations to a service controlled by the vendor or treat offline licensing as non-enforceable.

2. `packages/mcp-license/src/index.ts:36-48` — P1 — Licenses are bearer tokens with no account, installation, or device binding, so one purchased key can be copied to unlimited users. Fix: require account/device activation and periodic server validation.

3. `billing/src/index.js:197-202,219-227` — P1 — Fulfillment checks only `payment_status` and caller-controlled session metadata; it does not verify `mode`, `status`, currency, amount, or the Stripe Price ID. A cheaper Checkout Session in the same Stripe account with accepted metadata can mint the higher entitlement. Fix: retrieve line items and compare all payment fields against `PRODUCTS` before minting.

4. `billing/src/index.js:80-96` — P1 — KV idempotency is a read/read/write sequence without atomic compare-and-set; concurrent requests or KV propagation delay can mint multiple keys for one session. Fix: use a Durable Object or transactional database keyed by session ID, or derive the entire signed payload deterministically from the session ID.

5. `billing/src/index.js:193-202` — P1 — A Checkout Session ID is sufficient to retrieve the license indefinitely; there is no buyer authentication or one-time exchange. Fix: deliver through an authenticated account or email link and make browser retrieval single-use and time-limited.

6. `billing/src/index.js:219-228` — P1 — Refunds and disputes are not processed, and issued keys have no revocation mechanism; a customer can refund or charge back and retain Pro. Fix: process refund/dispute events and require renewable, time-bounded entitlements with revocation checks.

7. `billing/src/index.js:219-228` — P2 — `checkout.session.async_payment_succeeded` is ignored, so delayed payment methods can complete without webhook fulfillment. Fix: handle asynchronous success and failure events idempotently.

8. `billing/src/index.js:70,198,221` — P2 — Promotion codes are enabled, but a valid 100% discount produces `no_payment_required`, which both fulfillment paths reject. Fix: accept completed zero-total sessions only after validating the authorized discount and expected line item.

9. `billing/src/index.js:135-149` — P2 — Signature parsing collapses repeated `v1` fields to one value; Stripe secret rotation can supply multiple signatures and valid deliveries can be rejected. Fix: retain every `v1` value and accept when any value matches in constant time.

10. `billing/src/index.js:148` — P3 — A nonnumeric timestamp becomes `NaN`, causing the replay-window comparison to pass. Fix: require an integer timestamp with `Number.isSafeInteger` before HMAC verification.

11. `billing/src/index.js:209-210` — P2 — The webhook reads and authenticates an unrestricted body, allowing requests to consume memory and HMAC time before rejection. Fix: enforce a small body-size limit before reading the body and rate-limit the route.

12. `billing/src/index.js:182-187` — P2 — Checkout creation uses GET and has no rate limit, so crawlers or attackers can create unbounded Stripe sessions and API traffic. Fix: use POST with rate limiting and bot controls.

13. `billing/src/index.js:68-69,154-156`; `billing/wrangler.toml:6-7` — P3 — Redirect origins come from the incoming host while both the custom domain and `workers.dev` endpoint are exposed. Fix: use a configured origin allowlist and disable `workers_dev` in production.

14. `billing/src/index.js:86-96`; `billing/src/license.js:2` — P1 — Minted keys are stored and returned without checking that the configured private key matches the embedded public key. A configuration error charges customers and returns unusable keys. Fix: verify each minted key for the requested product before committing it.

15. `billing/src/index.js:125,219-229` — P2 — The success page says the key is on the receipt email, but the webhook only stores it and sends no email. A buyer who loses the success URL has no recovery path. Fix: send the key or a recovery link from the webhook and record delivery state.

16. `billing/src/index.js:232-240` — P2 — `/verify` accepts the bearer key in the query string, exposing it to browser history, CDN logs, proxy logs, and monitoring systems. Fix: remove the endpoint or accept the key in a nonlogged POST body with `no-store`.

17. `billing/src/license.js:64` — P2 — The license exposes a truncated, unsalted SHA-256 value of the buyer’s email, enabling dictionary checks against likely addresses. Fix: omit the field or use a server-keyed HMAC that is never exposed for client comparison.

18. `packages/mcp-license/src/index.ts:82-96` — P2 — A successful verification is cached indefinitely; an expiring license that passes once remains Pro until the process exits. Fix: reverify against the current time or invalidate the cache when `exp` is reached.

19. `billing/src/license.js:95-99`; `packages/mcp-license/src/index.ts:45-48` — P2 — Payload fields are not schema-validated, and `if (payload.exp)` treats `exp: 0` as lifetime while allowing coercion of nonnumeric values. Fix: validate every signed field and reject when `exp <= now`.

20. `packages/mcp-license/src/index.ts:60-65` — P2 — License files use default filesystem permissions, commonly producing mode `0644`, so another local user can copy the bearer key. Fix: create and replace the file with mode `0600`.

21. `packages/mcp-license/src/index.ts:57-65` — P2 — Concurrent activations use the same `.tmp` path and perform unlocked read-modify-write operations, causing failed renames or lost licenses. Fix: use per-process exclusive temporary files plus a lock or transactional store.

22. `billing/src/license.js:52-55`; `billing/src/index.js:88` — P3 — License IDs contain 48 random bits, allowing collisions as issuance grows and making IDs unsuitable for audit or revocation records. Fix: use at least 128 random bits or the Stripe Session ID.

## Free Pro paths

1. Change `isPro()` to return `true`, remove its call sites, or patch the distributed JavaScript.
2. Replace `PUBLIC_KEY_B64` with a self-generated public key and sign a `p: "*"` license.
3. Invoke or copy the shipped Pro implementations without executing the license gate.
4. Reuse any purchased key obtained through sharing, publication, logs, backups, or the local configuration file.
5. Obtain a paid Checkout Session ID and retrieve its key from `/success`.
6. Pay, obtain the key, then receive a refund or chargeback.
7. Use a valid expiring key indefinitely by keeping the process running after its first successful verification.
8. Have one buyer race `/success` and webhook fulfillment to mint multiple signed keys for distribution.
9. Modify the clock or verifier when expiration is introduced.
10. Use a cheaper paid session from another integration sharing the Stripe account if it can carry an accepted product metadata value.

## Verdict

Offline Ed25519 verification blocks unsigned keys only in an unmodified client.  
Payment enforcement is bypassable because the client and Pro implementation run under user control, while fulfillment also lacks price binding, atomic issuance, recovery, and revocation.