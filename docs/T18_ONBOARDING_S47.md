# T18 — Onboarding MCP server scaffold

**Task:** Scaffold new MCP server `onboarding` (employee onboarding tracker) cloned from `servers/checklist/`.

**STATUS: in progress**

## Deliverable contract
- Max 30 tool-call iterations.
- Goal: `servers/onboarding/` complete, `npm run build` (tsc) green, `node --test test/*.test.mjs` green from `servers/onboarding/`.
- No git commit, no publish/register.

## Plan
1. `cp -R servers/checklist servers/onboarding`; rename `checklist->onboarding`, `mcp-checklist->mcp-onboarding`, `@theluckystrike/mcp-checklist->@theluckystrike/mcp-onboarding`, `Checklist->Onboarding`, `CHECKLIST->ONBOARDING` across pkg/config/src/test.
2. Rebuild server.json as `io.github.theluckystrike/onboarding`, v0.22.0, websiteUrl `https://mcp.zovo.one/s/onboarding`, subfolder `servers/onboarding`.
3. Rewrite `src/domain` as onboarding model (hires, task templates, per-hire task instances, progress rollup). Store at `os.homedir()/.mcp-onboarding/store.json` (mirror checklist store.ts storage pattern).
4. Tools: onboarding_hire_add, onboarding_hire_list, onboarding_task_add, onboarding_task_done, onboarding_template_apply, onboarding_progress, onboarding_overdue.
5. Node test `.mjs` tests.
6. Write `RESULT.md` in `servers/onboarding/`.

## Evidence log
(append as work proceeds)