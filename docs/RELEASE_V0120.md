# Release v0.12.0 (2026-09-05)

status: done
evidence: per-diem joins as the twenty-second server (Polish, UK domestic and US GSA rate tables bundled byte-exact with provenance; UK overseas deliberately not bundled; audit 18/18; stdio round 22 17/18); the invoice profile-reader list gained per-diem (D-R89, caught by the invoice test that greps every server); 24 package.json and 47 ranges at 0.12.0; 82 manifests bumped, 59 reference a bundle; release-check green on 22 servers incl. the new hosted-row check; npm test 1016 tests, 1004 pass, 0 fail after the reader fix; 23 bundles (invoice and office-suite rebuilt after the fix), three boot-checked at 0.12.0; GitHub release with 23 assets; sha256 into 59 manifests; registry 58 of 59 on the first pass and the 59th a confirmed duplicate; mirrors and by-name verify running in the background at loop close.
artifacts: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.12.0
cost: by hand in bounded steps, about 60 minutes wall at load 11 to 27; one extra bundle rebuild for the reader fix.
failures: none open. GSC unmeasurable again: the key file returned to iCloud-dataless.
insight: a source edit after the bundle build started means two bundles are stale (the server and office-suite, which vendors it); a per-server rebuild needs SERVERS trimmed to that one name because office-suite always follows the loop.
