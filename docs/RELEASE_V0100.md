# Release v0.10.0 (2026-09-05)

status: done
evidence: billing-docs joins as the twentieth server (credit notes and purchase orders on the invoice engine; audit 18/18 with no defects; hosted round 19 16/18); 22 package.json and 41 ranges at 0.10.0; 74 manifests bumped (53 reference a bundle); release-check green with 0 gaps on 20 servers; npm test 1011 tests, 1000 pass, 0 fail, 0 cancelled; 21 bundles, three boot-checked at 0.10.0 (billing-docs, office-suite, invoice); GitHub release with 21 assets; sha256 into 53 manifests; registry 53 of 53 published on the first pass (verification by name running in the background at the loop close); mirrors syncing.
artifacts: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.10.0
cost: by hand in five bounded steps, about 45 minutes wall.
failures: none.
insight: crediting part of a mixed-VAT invoice at one rate is wrong by far more than rounding and invisible downstream because the gross matches; the VAT line on a EUR 177.00 credit of a 23 and 8 percent invoice is out by EUR 6.10. The server splits across the invoice's own rates and the test pins it.
