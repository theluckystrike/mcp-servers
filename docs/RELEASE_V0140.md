# Release v0.14.0 (2026-09-06)

status: done
evidence: statement-of-account joins as the twenty-fourth server (per-client statements from the invoice, credit-note and deposit stores, aging as at any date, dunning with the profile bank details, PDF; audit 18/18; stdio round 26 18/18); the month-end guide is generated from a real nine-prompt run through the 224-tool bundle (round 27, 26/27); invoice balances net credit notes and the profile reader accepts vat_rate (D-R95, D-R96); the hosted worker takes a list of shared stores with read-only shares; sync-mirrors retries network drops; release-check enforces the profile-reader list; 26 package.json and 54 ranges at 0.14.0; 90 manifests bumped, 65 reference a bundle; release-check green on 24 servers; npm test 1119 tests, 1107 pass, 0 fail after the asset-register contract was widened to accept a real sha; 25 bundles, three boot-checked at 0.14.0; GitHub release with 25 assets; sha256 into 65 manifests; registry 63 on the first pass, one more on retry and the last a confirmed duplicate; mirrors and by-name verify running in the background at loop close.
artifacts: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.14.0
cost: by hand in bounded steps, about 60 minutes wall at load 25 to 35.
failures: none open. GSC unmeasurable: key file iCloud-dataless.
insight: the "fileSha256 must be TBD" contract has now broken two consecutive first releases (per-diem, asset-register); every contract test written for a new server should assert the rule (TBD or a 64-hex sha), which the statement-of-account contract already does.
