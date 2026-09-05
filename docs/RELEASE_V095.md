# Release v0.9.5 (2026-09-05)

status: done
evidence: 21 package.json and 38 ranges at 0.9.5; 70 manifests bumped (three new names this loop: letterhead on docx, label on barcode, appointment on calendar); release-check green; npm test 968 tests, 957 pass, 0 fail, 0 cancelled; 20 bundles, three boot-checked at 0.9.5 (calendar, bank-statement, docx); GitHub release with 20 assets; sha256 into 50 manifests; registry 50 of 50 published on the first pass (verification by name ran in the background, see the loop close note); mirrors synced (exit 0).
artifacts: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.9.5
cost: by hand in five bounded steps, about 40 minutes wall; the registry search answers in about seven seconds per query today, so a 50-name verification walk takes half an hour.
failures: none.
insight: the release recipe is now stable enough that every step is a one-line command with a log file; the only variable is the registry's search latency, which decides how long the verification takes, never whether it succeeds.
