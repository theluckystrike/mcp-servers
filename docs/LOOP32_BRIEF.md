# Loop 32 brief (2026-09-10)

Loops 29 to 31 briefs still apply. This records what changed and what it unblocks.

## Two experiments are running and neither has resolved

1. **VS Code gallery, subfolder hypothesis.** All 252 gallery entries point at a repository
   with no subfolder; all 89 of ours point at a monorepo subfolder, and subfolders run at
   about 19 percent registry-wide. One control entry was published pointing at a standalone
   repo. As of this morning the gallery is still 252 with zero of ours and zero subfolder
   entries, so the hypothesis is alive and untested. Do not migrate the catalogue until the
   control resolves; migrating now destroys the only clean comparison available.
2. **Glama connector re-score.** The two shared licence descriptions were rewritten and
   deployed. Glama has already re-read the endpoint and shows the new text, but the score
   stamp still reads 2026-09-08, so it has not re-scored. `license_activate` currently
   grades C at 2 of 5, up from 1.4.

## What is newly unblocked

The estate is green: root `npm test` has zero failing assertions, live validation is
951/951, and the working tree is clean. Yesterday a mirror re-sync was refused because 21
servers carried uncommitted rebuilt edits and a sync builds from the working tree. That
condition is gone, so the sync can run, and it carries four things at once: the corrected
Dockerfile to the 30 mirrors still shipping one that cannot build, CI to every mirror, real
commit history instead of a single squashed commit, and the missing `mcp-delivery-schedule`
mirror, since there are 32 servers and only 31 mirrors.

## A defect found this morning, in work done yesterday

The hosted `license_activate` description now says "Takes no arguments and activates
nothing", while the tool's own schema declares a required `key` parameter described as
"License key from checkout". That contradiction is mine and it is exactly the sort of thing
Glama scores on Parameter Semantics. The fix is not to reword it: the hosted worker already
has a binding mechanism, `bind:<anonToken>` in KV, written by the billing worker when a
purchase is made from a hosted connection. So the tool can genuinely do what its name says.

## Hard rules, unchanged and worth restating

1. A description must be true of the code. Improving a score by overstating behaviour is a
   defect.
2. Never rename a tool, a parameter or a schema field.
3. Tool descriptions are a build input: `remote/build-vendor.mjs` patches about 113 exact
   strings and several are descriptions. `node remote/build-vendor.mjs` must exit cleanly.
4. Use `/usr/bin/grep`; plain `grep` is shadowed here and can silently return nothing.
5. No paid APIs, no paid listings, no accounts, no OAuth sign-in.
6. Own only your assigned files. Do not deploy; the orchestrator deploys.
