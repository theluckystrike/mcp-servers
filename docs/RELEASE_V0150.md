# Release v0.15.0 (2026-09-06)

status: done
evidence: cash-book joins as the twenty-fifth server (one double-entry ledger from six sibling stores, trial balance to zero, bank rows matched as evidence rather than posted because 99.6 percent of bank cash movement is already in the documents; audit 18/18; stdio round 29 17/18); copy buttons on every prompt block on the storefront; statement-of-account hosted round 18/18; findable share re-measured at 50 percent on the tracked 97 tokens and 55 percent on the extended set; 27 package.json and 61 ranges at 0.15.0; 94 manifests bumped, 68 reference a bundle; release-check green on 25 servers; npm test 1242 tests, 1231 pass, 0 fail, 0 cancelled; 26 bundles, three boot-checked at 0.15.0; GitHub release with 26 assets; sha256 into 68 manifests; registry 67 on the first pass and the 68th a confirmed duplicate; mirrors and by-name verify running in the background at loop close.
artifacts: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.15.0
cost: by hand in bounded steps, about 40 minutes wall at load 20 to 23; the first release in a while with zero test fixes needed, because the new server's contract accepted a real sha from the start.
failures: none open. GSC unmeasurable: key file iCloud-dataless.
insight: a server that only reads other servers' stores is the cheapest kind to add and the most revealing: cash-book found that a hosted endpoint with a missing sibling document produces a ledger that balances perfectly with nothing in it, so the shared-store list is a correctness input, not a convenience.
