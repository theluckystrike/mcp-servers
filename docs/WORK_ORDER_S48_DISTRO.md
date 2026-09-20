# S48 distribution work order (parent-run, 2026-09-19)

## Deliverable
`/Users/mike/mcp-servers/docs/T23_DISTRO_S48.md` — evidence file, `STATUS:` + `RESULT: verified-green/blocked`.

## Tasks
1. Add `leave` + `onboarding` entries to `data/facts.json` servers (copy checklist shape: title/tagline/does/for/example/free/pro/storage). Storage paths: `~/.local/share/mcp-servers/leave/` and `~/.local/share/mcp-servers/onboarding/`. Facts prose must match what the servers ACTUALLY do (read servers/leave/README.md + src tool surface; leave: 10 tools, balances/approvals/who-is-out, MAX_REASON 2000, Pro = file export via MCP_LICENSE_KEY one-time $19; onboarding: 7 tools, hire/task/template/progress/overdue, FREE_HIRES_PER_APPLY=1, Pro = multi-hire template_apply + as_csv).
2. Add "leave" and "onboarding" to `const ids` in scripts/build-pages.mjs (after checklist). Run `node scripts/build-pages.mjs`.
3. Add both to data/facts.json-dependent manifests: run `node scripts/gen-manifest.mjs` if it reads facts.json; check llms.txt builder and run it.
4. Fix onboarding README header: still says "mcp-checklist" title + wrong registry link (io.github.theluckystrike/checklist) — rewrite title/description to onboarding, keep glama badge pattern only if a glama page exists (it does not for new servers — REMOVE the badge, keep plain text). Leave README likely same clone issue — check and fix both.
5. Run `node scripts/build-figures.mjs` then `node scripts/indexnow.mjs` and record accepted count.
6. Verify with curl: https://mcp.zovo.one/s/leave and /s/onboarding return 200 AFTER next billing deploy — if deploy is out of scope (no commit/deploy policy), record pages built locally and mark remote 404 as expected-pending-deploy.

## Honesty gate
No fabricated numbers. If build scripts fail, record the exact error.

## Budget: 30 iterations. Every 10 iterations reply one line 'budget: N of 30 used, next: <action>'.
