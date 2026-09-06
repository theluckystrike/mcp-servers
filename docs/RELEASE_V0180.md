# Release v0.18.0 (2026-09-06)

status: done
evidence: work-order joins as the twenty-eighth server (job orders with parts and labour lines, status flow, completion report, invoice-ready payload; markup applied on the unit cost because the invoice engine rounds unit prices first, gap of exactly one minor unit asserted; audit 17/18; stdio round 35 16/18 in which the client rebuilt nothing from refused output); checkout for work-order is a named gap because the Stripe key in the keychain lost product write, so its price is the literal PENDING_HUMAN, /buy answers 503 with the bundle link and release-check reports the gap without turning green; petty-cash hosted round 16/18; scripts/record-tests.mjs writes data/tests.json for the KPI; 30 package.json and 75 ranges at 0.18.0; 106 manifests bumped, 77 reference a bundle; release-check green with one named gap on 28 servers; npm test, 29 bundles, boot-check, GitHub release, sha256, publish, mirrors and by-name verify recorded at loop close.
artifacts: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.18.0
cost: by hand in bounded steps.
failures: checkout for work-order is human-gated on the Stripe key (docs/HUMAN_GATED_PACK.md). GSC unmeasurable: key file iCloud-dataless.
insight: a gap that is named in the checker, the storefront and the validator is safer than a plausible placeholder that turns every cell green and fails for the first time in front of a buyer.
