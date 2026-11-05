# S1103 salvage-deploy

Status: stopped before deploy. PR #116 is merged. The fix is not live.

## Done
- PR #116 merged at 2026-11-03T08:19:36Z, merge commit 7462ff6a. Branch protection wanted an up-to-date head, so I ran `gh pr update-branch 116` first. Main was ahead by two data-only commits (e298c3d8, 99f4575a). Billing preflight then passed again (run 41602330678).
- `npx wrangler deployments list` shows the live version is still 2bcaa00c-d6ef-403e-879a-f1e389af10a4 (created 2026-11-02T07:09:23Z).

## Why I stopped
The bill4 tree is not the source of the live version. It is the pending s1102m release.
- bill4 is a git worktree at 967cfd74, "retire launch deposit", committed 10:58Z. The directory was created at 10:02Z, about 3 hours after 2bcaa00c was deployed at 07:09Z (`~/mcpstamp-work/s1102m/billing/deploy2.log`).
- bill4 `billing/src` defines svc-launch-one, svc-care-quarter and svc-custom-simple. Live, with `x-mcp-probe: 1`, those paths and /buy/svc-launch return 404. /buy/svc-audit, /buy/svc-custom-deposit and /buy/svc-launch-deposit return 200.
- If I deployed bill4 with the patch, it would ship the other session's release. The brief forbids that. I made no copy, applied no patch, ran no tests and deployed nothing. There is nothing to roll back.

## What happens next without action
`deploy-chain.sh` runs `git checkout -B s1102m-deploy origin/main` in bill4 before `npm run deploy`. Main now holds the fix, so it ships with the s1102m release after the owner does a Stripe live login. No deploy-chain process was running when I checked. The log's last start was 2026-11-03T05:15:30Z.

## Option to ship sooner (not done)
Build the deploy tree from the real live source plus the patch. 7a88a66f is the last billing commit before the 07:09Z deploy, but nothing confirms yet that it was the deployed source. To prove it, download the 2bcaa00c script content through the Cloudflare API and diff it against a `wrangler deploy --dry-run --outdir` bundle of 7a88a66f. Only then use `npm run deploy` (scripts/deploy-billing-gated.mjs).

## Proof route (coordinator follow-up, 2026-11-03 08:21Z)
Status: proof done, stopped at the gate. Nothing was deployed and live is still 2bcaa00c.

- **Live content.** I downloaded it through the Cloudflare API: `content/v2?version=2bcaa00c`, etag aa593a6d. It is a single module, worker.js (2,681,729 B), saved at `salvage-deploy/live/worker.js`.
- **7a88a66f equals live.** I built 7a88a66f with `wrangler 4.80.0 deploy --dry-run --outdir` from the worktree `salvage-deploy/wt`. The raw diff is only module-path comments (one extra `../` from the deeper directory). After normalizing those comments and the sourceMappingURL comment, the diff is 0 lines. Both files have sha256 945533b9... and 22,682 lines.
- **Settings match.** The live version's bindings, runtime (2025-09-01, nodejs_compat, cpu_ms 400), handlers and DO classes match `wrangler.toml` at 7a88a66f. So do the live script settings (observability and traces on, cron */5, custom domain mcp.zovo.one, workers.dev on). There are no vars. The six secrets carry across versions.
- **Patch ported.** The original patch failed 2 of its 3 hunks on 7a88a66f. The port is `salvage-deploy/billing-salvage-7a88.patch`. It drops the `SERVICE_REDIRECTS` clause (that constant does not exist at 7a88a66f), changes the count 268 to 272, and uses 7a88a66f context. The salvage logic is otherwise identical.
- **Tests at parity.** Unpatched: 232 tests, 223 pass, 8 fail. Patched: 236 tests, 227 pass, 8 fail. The failure set is identical by name. The 4 buy-salvage tests pass.

### Why it stopped
- The gate's `verify` step runs `stripe get /v1/checkout/sessions --live`. That command currently returns "live mode API key needs to be re-configured. Run stripe login". Verify would fail after activation and the gate would roll back automatically. Deploying now would only cause churn on live.
- The gate's `preflight` also needs `npm test` to exit 0. The 8 env-dependent failures (untracked keys/ and server builds) would stop it before upload. bill4 had a `keys -> ~/mcp-servers/keys` symlink, and this worktree does not yet.

### To finish once the owner runs `stripe login`
1. `ln -s ~/mcp-servers/keys salvage-deploy/wt/keys`, then get `npm test` in `wt/billing` to exit 0.
2. Re-check that no deploy-chain or billing deploy is running and that live is still 2bcaa00c.
3. `cd wt/billing && timeout 1200 npm run deploy`.

Rollback: `npx wrangler rollback 2bcaa00c-d6ef-403e-879a-f1e389af10a4 --yes`, then `npx wrangler kv key put monitor:approved-version 2bcaa00c-d6ef-403e-879a-f1e389af10a4 --binding REMOTE_DATA --remote --config wrangler.toml`. Also set `~/.config/mcp-billing-gate/approved-version` back to 2bcaa00c.

deploy-chain.sh waits for the same Stripe login and then ships origin/main, which is the s1102m release plus this fix. Decide which of the two runs first.
