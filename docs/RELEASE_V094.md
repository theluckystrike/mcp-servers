# Release v0.9.4 (2026-09-05)

status: done
evidence: 21 package.json and 38 ranges at 0.9.4; 67 manifests bumped; release-check green; npm test 966 tests, 955 pass, 0 fail, 0 cancelled; 20 bundles, three boot-checked at 0.9.4 (pdf, calendar, clauses); GitHub release with 20 assets; sha256 into 47 manifests; registry 47 of 47 published first pass and verified at 0.9.4 by name; mirrors synced (sync-mirrors exit 0, mcp-zip main at the sha commit).
artifacts: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.9.4
cost: run by hand in background steps (about 50 minutes wall) because agent turns stall on this machine when iCloud file sync loads it.
failures: round 16 (hosted re-run of timezone, bank-statement, expense-tracker) stalled twice this loop and is deferred again.
insight: the whole release is five bounded steps (bump, build+test+bundles, push+release, sha+publish, mirrors+verify). Kept as short foreground and background commands it survives machine load that kills a single long agent turn; the publish loop from a bash array landed 47 of 47 on the first pass.
