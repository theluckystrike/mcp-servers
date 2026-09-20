# T19: Port onboarding test suite to onboarding_* tools

## STATUS: in progress

## Goal
Port `servers/onboarding/test/` from checklist tool names (checklist_create, run_start, etc.)
to the onboarding domain (`onboarding_*` tools) until `npm test` is 0-fail and build still passes.

## Files to port
- test/_client.mjs (seed helpers)
- test/adversarial.test.mjs
- test/concurrency.test.mjs
- test/contract.test.mjs
- test/paths.test.mjs
- test/unit.test.mjs

## Gates
- `cd /Users/mike/mcp-servers/servers/onboarding && npm test` green (0 fail)
- `npm run build` still passes
- Never commit/deploy.

## Evidence log