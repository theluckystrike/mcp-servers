# Billing release control

Production billing releases use `cd billing && npm run deploy`. This command runs
the full local billing test suite, the checkout release tests, and a Wrangler dry
run; then it deploys, probes the live GET-to-Stripe guard, and pins the verified
Worker version. A direct `wrangler deploy` bypasses those checks and leaves the
scheduled monitor's approved-version pin behind.

The `Billing preflight` GitHub check is required on `main` for non-admins. Its job
always runs on pushes and pull requests, so unrelated changes can finish the
required check. For billing source, tests, or release-control files, CI runs the
key-independent billing suite and a pinned Wrangler dry run. It also runs both
paid fulfillment-route tests with a temporary Ed25519 signer in an isolated
copy of the source. CI never receives the production signing key. The six tests
in `billing/test/mint.test.mjs` and the real-key cross-verification test in
`billing/test/license-auth.test.mjs` remain in the full local deploy gate.

This GitHub rule does not bind repo admins, and the current Cloudflare API token
can still deploy the Worker directly. Restricting production deployment to CI
requires a scoped Cloudflare write credential, a protected GitHub environment,
and retirement of direct write access after the CI release path has passed its
live postdeploy probe. The current token cannot list or create API tokens through
Cloudflare's API (`GET /user/tokens` returns 403), so that credential transition
is a separate operational step.
