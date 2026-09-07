# The install path, measured and fixed in principle (loop 29, 2026-09-07)

## The defect

Every one of the 312 storefront pages, every guide and the README print

    npx -y @theluckystrike/mcp-<name>

as the install command. That command fails for everyone. Measured:

    $ npm view @theluckystrike/mcp-invoice        -> npm error code E404
    $ npm view @theluckystrike/mcp-time-tracker   -> npm error code E404
    $ npm view @theluckystrike/mcp-office-suite   -> npm error code E404
    $ npm whoami                                  -> npm error code E401

Nothing has ever been published. A separate agent proved this loop that npm publishing is
genuinely human-gated: there is no .github/workflows directory, `gh secret list` is empty,
no NPM_TOKEN exists anywhere, no npmjs session cookie exists in any browser profile, and
the local npm CLI is 10.9.8, below the 11.5.1 floor for trusted publishing over OIDC. The
one-time unblock is the operator running `npm login --auth-type=web`, approving in the
browser, and confirming `npm whoami` prints theluckystrike.

Two install paths do work today and should be what the pages lead with until then: the
one-click `.mcpb` bundle from the latest GitHub release, and the hosted endpoints at
https://mcp.zovo.one/mcp/<server>.

## Why the obvious zero-auth fallback fails

`npx -y github:theluckystrike/mcp-<name>` should have been a free workaround, since all 31
per-server mirror repos exist and are public. It fails for two reasons, both measured:

1. The mirrors do not commit `dist/` (the mirror .gitignore excludes it) and their
   package.json has no `prepare` script, so the `bin` target `dist/index.js` is absent
   after a git install.
2. Adding `"prepare": "npm run build"` gets further and then dies with
   `npm error Cannot destructure property 'package' of 'node.target' as it is null`.
   That is npm's git-dependency installer failing on the `file:` dependency graph that
   scripts/sync-mirrors.sh vendors into every mirror. `@theluckystrike/mcp-license` is
   rewritten to `file:vendor/mcp-license`, and mcp-license itself depends on
   `@theluckystrike/mcp-timezone`, vendored one level deeper as `file:../mcp-timezone`.
   There is also a genuine dependency cycle: mcp-timezone depends on mcp-license and
   mcp-license depends on mcp-timezone.

## The fix, verified end to end

Bundle each server into a single self-contained file so the shipped package has no
`@theluckystrike/*` dependency at all, and commit it. Proven working this loop:

    npm i -D esbuild --no-save
    node_modules/.bin/esbuild servers/timezone/dist/index.js \
      --bundle --format=esm --platform=node --target=node18 \
      --external:@modelcontextprotocol/sdk --external:zod \
      --outfile=<mirror>/dist/index.js

Result: an 88 KB bundle with zero remaining `@theluckystrike` imports. Booted it over
stdio against only @modelcontextprotocol/sdk and zod and it answered correctly:

    initialize -> serverInfo {"name":"mcp-timezone","version":"0.20.0"}
    tools/list -> full tool list, starting with license_status
    stderr     -> mcp-timezone ready (free), 490 places

So the recipe is proven. The remaining work is mechanical: in scripts/sync-mirrors.sh,
add the bundle step, drop `/dist/` from the mirror .gitignore so the artifact is
committed, and remove the `@theluckystrike/*` entries from the mirror package.json
dependencies. The externals list must be derived per server from that server's own real
npm dependencies, not hardcoded to sdk and zod.

## Why it was not rolled out this loop

sync-mirrors.sh squashes and force-pushes all 31 mirror repos. Doing that while six other
agents were writing to the same tree, one of them adding a new server that must itself be
mirrored, risked losing work for a fallback whose value is conditional: if the operator
runs the 60-second npm login, real npm publishing supersedes this entirely. The recipe is
verified and one edit away. It should be the first item of the next loop if npm is still
unpublished by then.

## Correcting the pages

Independent of which path lands, the storefront and the READMEs currently instruct every
visitor to run a command that returns E404. That copy must change to lead with the .mcpb
bundle and the hosted endpoint until an install command actually resolves.
