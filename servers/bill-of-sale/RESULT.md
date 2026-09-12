# RESULT — mcp-bill-of-sale

status: DONE

## evidence

Build (clean, dist removed first):

```
$ cd /Users/mike/mcp-servers/servers/bill-of-sale && rm -rf dist && time /Users/mike/mcp-servers/node_modules/.bin/tsc -p tsconfig.json
/Users/mike/mcp-servers/node_modules/.bin/tsc -p tsconfig.json  1.57s user 0.09s system 236% cpu 0.700 total
```

No npm install run; deps resolved via root node_modules (@modelcontextprotocol/sdk, zod, @theluckystrike/mcp-license). package-lock.json untouched.

Test:

```
$ time node --test test/*.test.mjs
ok 1 - stdio: initialize, tools/list, and the full sale lifecycle (duration_ms: 168.2 first run, 131.9 clean run)
ok 2 - free tier: the 11th draft and the 6th finalized document are refused, Pro takes both (duration_ms: 350.1 first run, 294.3 clean run)
# tests 2  # pass 2  # fail 0  # duration_ms 460.433208
node --test  0.46s user 0.10s system 115% cpu 0.489 total
```

The smoke test spawns dist/index.js three times over stdio JSON-RPC: initialize, tools/list (all 10 tools asserted), then real tools/call flows — create/get/update/render/finalize/re-render/delete lifecycle with on-disk file assertions (DRAFT watermark present before finalize, absent after; signature lines present; finalized edit refused; finalized delete refused without confirm_finalized), the 10-draft and 5-finalized free-tier caps refused with the https://mcp.zovo.one/buy/bill-of-sale link, and the same calls passing under a Pro key minted by scripts/sign-license.mjs.

## artifacts

- /Users/mike/mcp-servers/servers/bill-of-sale/src/index.ts — 8 domain tools (sale_create, sale_update, sale_finalize, sale_list, sale_get, sale_delete, sale_render, sale_summary) + license_status/license_activate via gate.registerTools
- /Users/mike/mcp-servers/servers/bill-of-sale/src/store.ts — JSON store, atomic tmp+rename writes, bounded-ancestor-walk mkdir (trap 7), BOS-YYYY-NNNN id series
- /Users/mike/mcp-servers/servers/bill-of-sale/src/lib.ts — minor-unit money, ISO-decimal table, real-date check, VIN/IMEI soft checks
- /Users/mike/mcp-servers/servers/bill-of-sale/src/render.ts — Markdown + self-contained HTML with signature lines, DRAFT watermark on drafts
- /Users/mike/mcp-servers/servers/bill-of-sale/src/version.ts
- /Users/mike/mcp-servers/servers/bill-of-sale/test/smoke.test.mjs
- /Users/mike/mcp-servers/servers/bill-of-sale/package.json, tsconfig.json, README.md, LICENSE (MIT, verbatim from petty-cash), server.json, smithery.yaml, Dockerfile (builds mcp-timezone, mcp-license, mcp-bill-of-sale only — the actual dep closure)
- /Users/mike/mcp-servers/servers/bill-of-sale/dist/ — compiled

## cost

14 wall minutes (two reads of conventions/exemplars, write, coordinator fix round, rebuild, test, docs).

## failures

- First-draft index.ts passed `${s.id}` as the explicit out_path to outputPath when no out_path was given, which would have made derived renders collide-refuse instead of suffixing -2, and reserve relative to cwd. Fixed by passing the stem (undefined without out_path) so the derived branch runs.
- writeFileAtomic's error path renamed the temp file onto itself (renameSync(tmp, tmp)); fixed to unlinkSync(tmp).
- sale_update reused partyFields("buyer", false), which attached the seller profile-fallback description to buyer_name; fixed by inlining the buyer field literals (coordinator applied the same inlining to sale_create).
- The DRAFT watermark CSS shipped unconditionally, so a finalized render could match a /watermark/ text probe; the CSS block is now emitted only for drafts (coordinator).
- No runtime failures: tsc clean on first compile after fixes, both tests green on first run.

## insight

A full locked write cycle — file lock acquire, JSON read, atomic tmp+rename write, lock release — costs about 15 ms: the Pro cap test does 24 such writes (12 creates + 12 finalizes) plus renders in 294 ms including process spawn. The free-tier cap checks are reads of the same store, so metering adds no measurable latency to a write path that is already lock-bound.
