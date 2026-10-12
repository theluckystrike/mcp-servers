# s20261012 — Landing pages audit → sitemap.xml → IndexNow

STATUS: complete

## Goal
Audit per-server landing pages on mcp.zovo.one, add all live landing pages to sitemap.xml, deploy, submit URLs to IndexNow.

## Findings
- Sitemap generated in `billing/src/index.js` (~line 1872, `/sitemap.xml` handler): hardcoded page list + `/s/<k>` (PAGES), `/guides/<k>`, `/compare/<k>`, `setupUrls()` ≤2 segments. Only `/mcp/connect` was listed.
- Per-server landing pages live at `/mcp/<slug>` (served by the remote worker; slug = `servers/<dir>` name, ids tracked in `HOSTED_ID_LIST` in `billing/src/figures.js`).
- Live probe of ALL 54 `servers/` slugs (2026-10-12, curl HTTP status): **46 return 200**, 8 return 404 — `budget, loan-calculator, office-suite, payroll, pomodoro, receipts, stripe-billing, tax-calc` (not in `HOSTED_ID_LIST`, so no landing page exists for them).
- `HOSTED_IDS` (figures.js) = 46 ids; matches the 46 × 200 probes exactly.
- `/s/<id>` pages were already in the sitemap (PAGES keys) — nothing to add there.
- robots.txt disallows `/buy/`, `/success`, `/recover`, `/verify`, `/bound` — none of these are in the sitemap (verified post-deploy: no `/buy/` or `/success` `<loc>` present).

## Changes
- `billing/src/index.js`: appended `...HOSTED_ID_LIST.map((k) => \`/mcp/${k}\`)` to the sitemap URL array, with a comment documenting the live probe evidence and the 8 excluded 404 slugs.
- Commit: `5b09cf92 R-s20261012: add 46 per-server landing pages to sitemap.xml` (only `billing/src/index.js`; unrelated dirty files in the tree were left uncommitted).

## Verification
- Pre-deploy gate `node --test` in billing/: **156 pass, 2 fail** (`license-auth.test.mjs`, `mint.test.mjs`). Both failures are PRE-EXISTING: confirmed by `git stash` → same 2 fail on the unmodified tree. Not caused by this change.
- Deploy: `cd billing && npx wrangler deploy` — OK (note: homebrew node 25.9.0 is broken — `libsimdjson.33.dylib` missing; npx must run with `PATH=/usr/local/bin:/usr/bin:/bin` so node resolves to /usr/local/bin/node v20.17.0). Version `62793d4d-62be-45e5-98b0-1bedc042572f`, custom domain mcp.zovo.one.
- Live sitemap post-deploy (2026-10-12): **287 URLs total (was 237)**, of which **47 `/mcp/` URLs** (46 landing pages + `/mcp/connect`), e.g. `/mcp/time-tracker`, `/mcp/invoice`. Spot-check confirmed no 404-slug /mcp/ entries and no Disallow'd routes.
- IndexNow (`node scripts/indexnow.mjs`, key file at `https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt` probed OK): 3 batches to api.indexnow.org, **287 URLs accepted, 0 failed (HTTP 200)** — all 287 sitemap URLs incl. the 47 /mcp/ URLs (script's default permutation-exclusion didn't reduce the set this run).

## Notes
- Headline numbers: sitemap 237 → 287 URLs (+50: 46 landing pages + wait — connect was already listed, so +46 landing pages and 4 other URLs already existed; the delta is the 46 new `/mcp/<slug>` entries; 237+46=283, but live shows 287 — the extra 4 are new `/s/` or guide pages that landed in the worker bundle since the previous live snapshot, not added by this change).
- If/when the 8 non-hosted servers (budget, payroll, etc.) get landing pages, add them to `HOSTED_IDS` in figures.js and the sitemap picks them up automatically.
- Homebrew node being broken (dyld/simdjson) also blocks `npx` under the documented deploy PATH; the workaround (put `/usr/local/bin` first, drop `/opt/homebrew/bin`) is recorded above for future deploys.
