# S1103 leak lane: buy.unknown-product

## Root cause
No page, README or tool result emits a dead slug. Workers Logs for mcp-billing (telemetry API, status 404 and url containing /buy/, 28 unsampled 6-hour windows, 10-27 to 11-03) hold 92 dead /buy/ requests. 25 have the counted shape, and 24 of those 25 name a real product with text stuck onto the path:

- 21 are answers in Japanese or Chinese. An assistant writes `https://mcp.zovo.one/buy/work-order（買い切り` with no space, and the chat autolinker takes the full-width punctuation into the link. Examples: bill-of-sale。, packing-list（一次性付费）, bundle）.
- English punctuation and markdown get stuck on the same way: `bundle),`, `invoice.`, `pdf**`, `zip**`.
- An old claudecodeguides hub link used `&` where it needed `?`: `/buy/zip&src=csg.mcp.table.zip`. The live page now emits `?src=hub.table.zip`.
- One hit was `/buy/undefined`, with referer about:blank.

These links lose `?src`, so the worker returns a 404 and files the click under `buy.unknown-product`. A related bug: `/buy/invoice%E3` returns HTTP 500 because `decodeURIComponent` throws.

Caveat: the counted dead clicks send `sec-fetch-site: none` together with `Referer: https://mcp.zovo.one`. A typed or pasted visit sends no Referer, so these look more like an AI agent browser following its own answer than like people. The "32 of 35" figure also compares two different things. Valid products count a click only on the checkout POST, but the unknown branch counts the GET.

## Purchase path (probe, src=probe.s1103, x-mcp-probe:1)
| | result |
|---|---|
| /buy/invoice | 303 to checkout.stripe.com, 1900 usd, price_1UBDU8JKCamubEm1Ybcp5IUs, livemode true, Checkout page 200 |
| /buy/bundle | 303 to checkout.stripe.com, 3900 usd, price_1UBDU9JKCamubEm1dWgRjtoW, livemode true, Checkout page 200 |
| /buy/work-order（買い切り | 404, x-mcp-buy: unknown-product (reproduced) |

## Link scan (leak/scripts/linkscan.py)
The scan covered 529 pages: the mcp.zovo.one sitemap, the mcpstamp.com sitemap and claudecodeguides /mcp/. It found 2653 link targets, 865 of them /buy/ links, and **0 broken /buy/ links**.
- mcp.zovo.one has 20 broken relative README links on /s/<id> pages, plus a /recover link that returns 400.
- mcpstamp.com has 0 broken links.
- The claudecodeguides hits are false positives from href strings inside inline JS.

## Fix (patch written, NOT deployed)
`leak/billing-salvage.patch` is written against origin/main 967cfd74 and applies cleanly with `patch -p1`. What it changes:
- Adds `salvageBuyPath()`. When a GET path does not resolve but its leading `[a-z0-9-]` run names a product, alias or service, the worker answers 302 to `/buy/<id>?<query>`. It recovers a lost `&src=`, and when no src survives it sets `src=buy.salvaged`.
- Wraps `decodeURIComponent` so a stray `%` no longer causes a 500.
- Leaves truly unknown ids on the existing 404, which has a bundle button.
- Adds `billing/test/buy-salvage.test.mjs` with 4 tests.
- Changes `BILLING_TEST_COUNT` from 274 to 278.

24 of the 25 counted dead clicks would have reached a working offer page.

Tests: the patched tree runs 242 tests with 233 passing. The 8 failures are the same, by name, as on unpatched origin/main. They need the untracked keys/ directory and server builds, which git archive leaves out.

Why it is not deployed: the live mcp-billing is version 2bcaa00c-d6ef-403e-879a-f1e389af10a4 from 11-02 07:09Z. Run s1102m deployed it from ~/mcpstamp-work/s1102m/bill4. ~/mcp-servers is on the stale branch r38-supplier-monetization, so deploying it would remove the svc-* checkouts. origin/main carries an s1102m release that is not deployed yet, gated by its deploy-chain.sh, which waits for a Stripe live login. Deploying either tree would ship or revert another session's release.

## Deploy for the orchestrator
1. Precheck: `ps -axo pid,command | /usr/bin/grep -E 'wrangler|mcp-remote|deploy-chain' | /usr/bin/grep -v grep` must be empty. Record `npx wrangler deployments list --json`.
2. Either commit the patch on origin/main so deploy-chain.sh ships it with the s1102m release, or, after that release: `cd ~/mcpstamp-work/s1102m/bill4 && patch -p1 < ~/mcp-servers/data/s1103/leak/billing-salvage.patch && cd billing && node --test test/buy-salvage.test.mjs && timeout 1200 npm run deploy`. The gate script records the version and rolls back on its own if verification fails.
3. Rollback: `cd billing && npx wrangler rollback <previous version> --yes`, then put the same id back with `npx wrangler kv key put monitor:approved-version <id> --binding REMOTE_DATA --remote --config wrangler.toml`.
4. Post-probe: `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H 'x-mcp-probe: 1' -A mcp-leak/1 'https://mcp.zovo.one/buy/work-order%EF%BC%88%E8%B2%B7%E3%81%84%E5%88%87%E3%82%8A?src=probe.s1103'` should return 302 to /buy/work-order?src=probe.s1103.

## Open
- Deploy the patch.
- The 20 relative README links on /s/<id> pages.
- Find the source of `/buy/undefined`.
- Do not read the salvaged stream as buyer demand.
