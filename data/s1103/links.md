# S1103 links lane

## Result
PR https://github.com/theluckystrike/mcp-servers/pull/119 is merged (merge commit ec5c66a2, 2026-11-03T12:21:19Z). Both checks passed: Billing preflight and clean-mirror. The fix is NOT deployed.

## Sources (details in links.json)
- The scan reported 21 README links that return 404. All 21 come from markdown links in `servers/<page>/README.md`. `scripts/build-pages.mjs` renders those READMEs with marked into `billing/src/pages.js`, and the links stay verbatim:
  - `../<id>` and `../<id>/README.md`. These links work in the GitHub tree, but on /s/<page> they resolve to mcp.zovo.one/<id>.
  - `llms-install.md` (hourly-rate). It resolves to /s/llms-install.md.
  - `[Awesome MCP Servers](mcpservers.org)` in invoice, price-tracker, spreadsheet and time-tracker. The link has no scheme, so it is broken on GitHub too.
- I found one more: every demo gif (`../../assets/demo-<id>.gif`) became /assets/demo-*.gif, which returns 404. The scan checked hrefs only, so it missed these.
- The /recover link is in `billing/src/content.js`, in the guide paid-mcp-servers-and-how-you-pay-for-one. The 400 is correct: the handler needs `session_id`. The guide text was also wrong, because it said "with the email". I changed the copy to point to `/recover?session_id=...` and support@zovo.one. The endpoint is unchanged.

## Fix
- build-pages.mjs now rewrites relative links in the rendered READMEs:
  - A sibling link goes to `/s/<id>`.
  - Any other file link goes to its GitHub blob URL.
  - A relative img src goes to raw.githubusercontent.com.
- In the 4 READMEs, the link is now `https://mcpservers.org`.
- `billing/test/readme-links.test.mjs` adds 4 tests. 3 of them fail on the pre-fix main, and all 4 pass after the fix. BILLING_TEST_COUNT goes from 278 to 282.
- Full local billing suite: 257 of 264 pass. The 6 failures are the same 6 that fail on main, because they need the untracked keys/ and server builds.

## Serving worker
- The CF API (`workers/domains?hostname=mcp.zovo.one`) shows the custom domain belongs to **mcp-billing**, so mcp-billing serves both /s/* and /recover.
- mcp-remote serves only /mcp*, /.well-known/* and /oauth*. mcpstamp-check serves /stamp*.

## Why it is not deployed
- The lane rule says not to deploy mcp-billing.
- The live version is 2bcaa00c-d6ef-403e-879a-f1e389af10a4, deployed 2026-11-02T07:09Z.
- origin/main also carries two other changes that are not live:
  - the s1102m release. It is gated by ~/mcpstamp-work/s1102m/deploy-chain.sh, which waits for a Stripe live login. Its last start was 05:15Z with no result.
  - the salvage patch from PR #116.

Deploy command for the orchestrator:
1. Precheck: `ps -axo pid,command | /usr/bin/grep -E "wrangler|deploy-chain" | /usr/bin/grep -v grep` must print nothing.
2. In an origin/main checkout at ec5c66a2 or later, with deps installed, run `cd billing && timeout 1200 npm run deploy`. That runs scripts/deploy-billing-gated.mjs.

Rollback: `npx wrangler rollback 2bcaa00c-d6ef-403e-879a-f1e389af10a4 --yes`, then `npx wrangler kv key put monitor:approved-version 2bcaa00c-d6ef-403e-879a-f1e389af10a4 --binding REMOTE_DATA --remote --config wrangler.toml`.

## Pre-checks run now (live, before deploy)
- All 14 target pages /s/<id> return 200.
- The GitHub blob for llms-install.md returns 200.
- The raw demo gif returns 200.
- mcpservers.org returns 403 to curl, which looks like bot protection.
- /buy/invoice?src=probe.s1103 with `x-mcp-probe: 1` returns a GET 200. The leak lane reports a 303 to Checkout, which I did not re-run.

## After deploy
1. Re-run leak/scripts/linkscan.py. It should find 0 broken links on mcp.zovo.one.
2. Probe /buy/invoice and /buy/bundle with the probe header and confirm both reach checkout.stripe.com.
