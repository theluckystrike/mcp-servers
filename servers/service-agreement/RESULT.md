# RESULT - service-agreement (loop 35, wave B)

status: DONE

## evidence

Build (clean, dist removed first), 1.1 s wall:

```
$ rm -rf dist && npm_config_cache=/Users/mike/.npm-cache-local npm run build
npm notice run @theluckystrike/mcp-service-agreement@0.1.0 build
npm notice run tsc -p tsconfig.json --declaration && node -e "import('node:fs').then(f=>f.chmodSync('dist/index.js',0o755))"
build_seconds: 1.1
```

Test (verbatim tail, `npm_config_cache=/Users/mike/.npm-cache-local npm test`):

```
ok 1 - initialize, tools/list, agreement_create then agreement_render carries the party names
ok 2 - the status flow moves one step at a time, stamped, and expiring frees the slot
ok 3 - the checklist flags missing fields and one-sided gaps neutrally
ok 4 - clause library and HTML are Pro-gated; Markdown stays free
ok 5 - free tier: the fourth active agreement is refused, expiring frees the slot, Pro lifts the cap
ok 6 - license_status on the free tier names the tier and the checkout
# tests 6
# pass 6
# fail 0
# duration_ms 1364.179875
```

Required smoke path is test 1: initialize -> tools/list (asserts all 7 domain tools plus license_status/license_activate) -> tools/call agreement_create -> tools/call agreement_render, asserting the rendered text contains both party names (/Anna Nowak/, /Brightleaf Studio/).

Buyer phrase check: `/usr/bin/grep -c "mcp service agreement" README.md` -> 1 (opening paragraph).
Emoji check: python scan over README.md, server.json, package.json, smithery.yaml, Dockerfile, LICENSE, src/*.ts, test/*.mjs -> "non-ascii chars: 0".
server.json: name io.github.theluckystrike/service-agreement, version 0.1.0 (node parse check).

## artifacts

- servers/service-agreement/package.json - @theluckystrike/mcp-service-agreement, bin mcp-service-agreement, 0.1.0
- servers/service-agreement/src/index.ts - 7 domain tools + gate.registerTools
- servers/service-agreement/src/agreement.ts - model, status flow draft->sent->signed->expired, 5-clause library with {{variable}} substitution, checklist, Markdown + self-contained HTML renderers, DISCLAIMER on every render
- servers/service-agreement/src/store.ts - XDG JSON store, atomic writes, corrupt quarantine, SA-YYYY-NNNN counter
- servers/service-agreement/src/version.ts - 0.1.0
- servers/service-agreement/test/smoke.test.mjs - 6 tests over stdio JSON-RPC, sandboxed XDG dirs, Pro keys via scripts/sign-license.mjs
- servers/service-agreement/README.md, LICENSE (MIT), server.json, smithery.yaml, Dockerfile, tsconfig.json

## cost

~14 wall minutes (read brief/conventions/template, write 11 files, serialized root npm install 0.8 s, build 1.1 s, tests 1.4 s).

## failures

None. One self-inflicted drafting artifact in smoke.test.mjs (a nonsense regex ternary on the liability-cap assertion) was caught before the first run and replaced with /capped at EUR 8500\.00/.

## insight

The free/Pro split maps cleanly onto render formats: gating `agreement_render format=html` and clause bodies (not the listing) keeps every free-tier path non-erroring - clause_library on free returns titles+summaries with the upgrade URL as data, so the free tier reads as a working product rather than a demo. Only the 3-active-agreement cap and Pro features produce isError, each carrying gate.upgradeText and "Nothing was written."
