# S48 distribution — T23: wire leave + onboarding into site estate

Date: 2026-09-19
Work order: `docs/WORK_ORDER_S48_DISTRO.md`

STATUS: in progress

## Tasks
1. Add `leave` + `onboarding` to data/facts.json (checklist shape).
2. Add to `const ids` in scripts/build-pages.mjs; run build-pages.
3. facts.json-dependent manifests (gen-manifest, llms.txt builder).
4. Fix onboarding README header (title/wrong registry link); fix leave README clone issue.
5. Run build-figures.mjs then indexnow.mjs; record accepted count.
6. Verify /s/leave + /s/onboarding (build vs deploy).

## Evidence (appended as gathered)
- facts.json: leave rewritten to checklist shape from real src (10 tools incl. leave_export_ics Pro; storage ~/.mcp-leave or $XDG_DATA_HOME); onboarding storage corrected to ~/.mcp-onboarding/store.json.
- servers/onboarding/README.md de-cloned: own title/registry link (io.github.theluckystrike/onboarding), glama badge removed. leave README already correct.
- build-pages.mjs: 46 pages incl. onboarding + leave (646091 bytes). figures.js regen: 46 listed, 45 hosted, 418 tools.
- validate.mjs 1244/1244; node --test test/*.test.mjs 141 pass / 0 fail.
- IndexNow: 193 accepted, 0 failed (2026-09-20).
- Deploy: billing worker afd89c62 live on mcp.zovo.one. /s/leave 200, /s/onboarding 200, /llms.txt 200.
- Commit 84a763cd.

## RESULT: verified-green