# Release v0.21.0 (2026-09-07)

status: done

## What this release is for

Two things, one of which is the reason it exists at all.

**The registry manifests.** All 114 manifests carried `websiteUrl:
https://mcp.zovo.one/buy/<id>`. That path is Disallowed in robots.txt and, for a browser,
303s straight into a Stripe checkout. The official MCP registry is the only channel that
demonstrably delivers humans to this project (19 views from 9 uniques in 14 days, against
22 unique visitors in total), and it was dropping every one of them onto a payment form
for a product they had not read about, while passing no link value to any page. Every
manifest now points at `https://mcp.zovo.one/s/<id>`, the product page, with office-suite
pointing at `/bundle` because that is what it sells. The registry rejects a same-version
republish (`invalid version: cannot publish duplicate version`), so this fix could not
ship without a version bump. That is what this release is.

**delivery-schedule**, the thirty-first server. Dated deliverables against a quote, work
order or change order; a status that moves planned to in progress to delivered to
accepted with every step dated; `late_report` answering what has slipped as at a date the
caller names; and accepted milestones as invoice-ready items in both scales. Lateness is
never stored, because a stored late flag is a fact about the afternoon somebody last ran
the report. 53 tests, stdio-verified.

## Also in this release

- Checkout for every product, with the human Stripe gate removed for good. Checkout
  Sessions now carry inline `price_data`, which needs only `checkout_session_write`, so a
  PRODUCTS row with a price and a name gets a working checkout with no dashboard step.
  work-order, catalogue and change-order came off HTTP 503; office-suite came off 404 and
  now sells the bundle, because a $19 key minted under its own name would be rejected by
  every child it forwards to. 33 of 33 buyable ids reach checkout.stripe.com.
- A defect that would have taken a payment and withheld the licence key on every
  inline-priced sale, found and fixed before any such sale existed.
- office-suite's README said it proxies four sibling servers. Measured from the running
  bundle it proxies 31 children and exposes 292 distinct tools. Corrected, along with the
  stale figures that had spread from it across the guides.
- The sitemap dropped from 312 URLs to a curated set. The 216 client-by-product setup
  permutations measured 73.6 to 77.5 percent text-similar to their siblings and drew 8
  human views in 7 days across all 224 setup URLs, while Googlebot read sitemap.xml seven
  times and then crawled 2 of 312 pages. They now carry `noindex, follow` and stay live.
- 28 new guides, all in the two sections that measurably earn attention.
- The number-word table stopped at thirty, so the thirty-first server would silently have
  degraded the bundle copy to a digit. Extended.

## Named gaps

Carried deliberately, in the same shape as previous releases:

- delivery-schedule has no /compare page and no /setup pages. Both are deliberate. All
  20 existing /compare pages drew zero human views in the measured week, and the setup
  permutations drew 8 views across 224 URLs. That exact page shape was measured this loop at
  73.6 to 77.5 percent duplication and put behind noindex, so adding more would work
  against the change above. Its logo and demo GIF were made this loop and are no longer gaps.
- delivery-schedule is not hosted. It ships stdio and .mcpb only this release.
- npm remains unpublished for every package, so `npx -y @theluckystrike/mcp-<name>` still
  returns E404. This needs the operator: `npm login --auth-type=web`, then
  `scripts/publish-all.sh --go`. The pages that print that command now disclose it.

## Shipped

- Release https://github.com/theluckystrike/mcp-servers/releases/tag/v0.21.0, 32 assets,
  every bundle manifest at 0.21.0 and every published digest equal to the local bundle.
- 85 distinct registry names live at 0.21.0, verified by a `version=latest` search.
  81 of 89 returned rows now point at `/s/<server>` and one at `/bundle`. The 7 still on
  `/buy/` are 4 deprecated 0.1.1 short names and the 3 delivery-schedule manifests, whose
  product page did not exist when the estate-wide repoint ran; their source is corrected
  and lands next release.
- 32 manifest variants could not publish: they declare an npm package that has never been
  published, so the registry's own validation rejects them. Each shares a name with a
  manifest that did publish, so no server is missing from the registry. They will validate
  once the operator runs `npm login --auth-type=web`.

## A trap worth recording

`gh release create` with 32 assets exceeded a two-minute command timeout and left an
**untagged draft**. A draft's assets return 404 to anyone unauthenticated, and the registry
refuses any manifest whose bundle is not publicly reachable, so the first publish run failed
32 times with a message about the bundle rather than about the release. What proved the
cause was a control: fetching a v0.20.0 asset over the same connection returned 200 while
the v0.21.0 asset returned 404. An unauthenticated fetch of a draft asset returns a 9-byte
body, which is easy to mistake for a corrupt file; `gh release download` returned the
correct bytes throughout. Publish the draft with `gh release edit <tag> --draft=false
--tag <tag>`, wait for the asset URL to answer 200, and only then publish manifests.
