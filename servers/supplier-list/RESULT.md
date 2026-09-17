# RESULT.md - supplier-list (loop 35, wave B)

status: DONE

## evidence

Root workspace wiring (serialized per LOOP35 hard rule 8):

```
$ while ! mkdir /tmp/mcp35-npm.lock 2>/dev/null; do sleep 5; done && npm_config_cache=/Users/mike/.npm-cache-local npm install --no-audit --no-fund; rmdir /tmp/mcp35-npm.lock
added 2 packages in 837ms
```

Build (cold, dist removed first):

```
$ rm -rf dist && time npm_config_cache=/Users/mike/.npm-cache-local npm run build
tsc -p tsconfig.json --declaration && node -e "..."
1.63s user 0.11s system 193% cpu 0.895 total
BUILD_EXIT=0
```

Tests:

```
$ time npm_config_cache=/Users/mike/.npm-cache-local npm test
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1269.400458
1.37s user 0.23s system 113% cpu 1.413 total
```

The 7 tests cover: initialize + tools/list (all 10 tools present) + supplier_add then
supplier_list showing the added row (the required smoke path); category/text filters, get,
update, remove with id non-reissue; review stamps and the due-review report ordering;
CSV export free with quoted cells, Markdown gated on free tier and rendered on Pro;
guard refusals (bad date, bad email, duplicate name, ambiguous ref, empty update);
the free-tier 10-supplier cap with slot-freeing on remove and Pro lifting the cap;
license_status free tier naming the checkout.

README phrase check:

```
$ /usr/bin/grep -o "mcp supplier list" servers/supplier-list/README.md | wc -l
       2
```

## artifacts

- servers/supplier-list/package.json - @theluckystrike/mcp-supplier-list 0.1.0, bin mcp-supplier-list
- servers/supplier-list/tsconfig.json - strict, NodeNext, ES2022
- servers/supplier-list/src/index.ts - 8 domain tools + license_status/license_activate
- servers/supplier-list/src/supplier.ts - Supplier model, date math, CSV/Markdown cell escaping
- servers/supplier-list/src/store.ts - JSON store, atomic tmp+rename, corrupt quarantine, SUP-YYYY-NNNN ids
- servers/supplier-list/src/version.ts - 0.1.0
- servers/supplier-list/server.json - io.github.theluckystrike/supplier-list, registry schema 2025-12-11
- servers/supplier-list/smithery.yaml, Dockerfile, LICENSE (MIT), README.md
- servers/supplier-list/test/smoke.test.mjs - 7 tests over stdio JSON-RPC

## cost

Wall: ~40 minutes (including the two test-fix rounds below).

## failures

1. supplier_add spread the shared editable-fields schema without .optional(), so the SDK
   refused every add with "Required at address" (-32602). Fixed by making the shared
   fields optional and re-requiring only category in supplier_add.
2. supplier_due_review aged never-reviewed records from creation, so a supplier added
   today was "fresh" for 90 days despite never having been checked. Fixed: never-reviewed
   is always due; age-from-creation is kept for ordering only.
3. The CSV quoting test fixture claimed a comma in notes but held none; nothing was
   quoted. Fixed the fixture to carry a real comma.
4. Two tests closed their stdio child only on the success path; a mid-test assertion
   failure left the spawned server alive, which refs the node --test event loop, so the
   runner never exited (two 240-300s hangs). Fixed by closing unconditionally in finally.

## insight

A never-reviewed record and a fresh record are the same shape (no last_reviewed date) but
opposite meanings; keying "due" off age-from-creation silently treats unverified as fresh.
The gate has to be on the absence of the review stamp itself, not on a computed age.

Contract deviations: none.
