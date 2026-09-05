# Release v0.11.0 (2026-09-05)

status: done
evidence: deposits joins as the twenty-first server (security and retainer deposits, applied to invoices through the invoice engine; audit 18/18 no defects; round 20 stdio 16/18); invoice_mark_paid now adds payments and records each one (D-R87, found by the deposits build); 23 package.json and 45 ranges at 0.11.0; 78 manifests bumped, 56 reference a bundle; release-check green on 21 servers; npm test 983 tests, 971 pass, 0 fail after the deposits contract was updated to expect its remote (it was written before hosting); 22 bundles, three boot-checked at 0.11.0 (deposits, invoice, office-suite); GitHub release with 22 assets; sha256 into 56 manifests; registry 55 of 56 on the first pass and the 56th refused as a duplicate (already landed on a timed-out first attempt); mirrors and by-name verification running in the background at loop close.
artifacts: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.11.0
cost: by hand in five bounded steps, about 55 minutes wall on a machine at load 10 to 34.
failures: none open.
insight: a contract test that pins "this server is not hosted" is correct for one day and wrong the next; the check belongs on remotes.json equality (hosted) or absence (stdio-only names), which is what the other servers already assert.
