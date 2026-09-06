# Release v0.19.0 (2026-09-06)

status: in progress at loop close; evidence below is what was verified before the cut
evidence: catalogue joins as the twenty-ninth server (SKUs with per-currency, per-tier, valid-from price rows; a labour rate card; lines_resolve builds both the invoice and the quote payload itself because the two engines take prices in different scales, a 100x gap asserted exactly; audit and hosted round recorded when they land); checkout for catalogue and work-order both stay named gaps because the keychain Stripe key lacks product write; release-check gained a per-server dist-version check so a stale build is caught before bundling; work-order hosted round 16/18; intel round 13 found five more empty slots led by change-order.
artifacts: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.19.0
cost: by hand in bounded steps.
failures: two checkouts human-gated on the Stripe key (docs/HUMAN_GATED_PACK.md). GSC unmeasurable: key file iCloud-dataless.
insight: two sibling engines that accept the same field name in different units cannot detect a swap; the one place that knows both shapes must emit both payloads and print the scale next to each.
