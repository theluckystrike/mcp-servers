# PACKAGING_RESULT.md -- generic @theluckystrike/* vendoring for the three engine-sharing servers

status: PARTIAL (1 of 3 pipelines changed; time cap hit before verification runs)

## Goal

servers/resume, servers/clauses and servers/recurring depend on sibling engines that are
not published on npm: resume and clauses import `@theluckystrike/mcp-docx/lib`, recurring
imports `@theluckystrike/mcp-invoice/lib`. The three packaging pipelines (.mcpb bundles,
public mirrors, the remote Worker) all had `@theluckystrike/mcp-license` hard-coded as
the single unpublished dependency. They needed to handle any `@theluckystrike/*` package,
recursively (resume -> mcp-docx -> mcp-license).

## What is DONE

### scripts/build-mcpb.sh -- rewritten, generic and recursive

- `closure_of <package.json>...` walks `dependencies` recursively and prints
  `<package name><TAB><source dir>` for every `@theluckystrike/*` package reached.
  Resolution rule: `@theluckystrike/mcp-<x>` is `packages/mcp-<x>` if that exists,
  otherwise `servers/<x>`. It throws if a package has no source dir or no `dist/`.
- `vendor_one` replaces the old hard-coded `vendor_license` / `vendor_children_os`. It
  copies `<src>/dist` to `server/node_modules/@theluckystrike/<pkg>/dist` and writes a
  trimmed package.json that **carries `main`, `types` and `exports` through from the
  source**. That is the load-bearing change: `@theluckystrike/mcp-docx/lib` only resolves
  because the vendored package.json keeps the `"./lib": {"default": "./dist/lib.js"}`
  subpath export. The old writer invented a flat `main: index.js` and no `exports`, so a
  `/lib` deep import would have failed at runtime.
  `scripts`, `devDependencies` and `dependencies` are dropped (already built; runtime
  deps are hoisted into the bundle's own node_modules).
- `merged_deps_json` merges the runtime deps of the server plus every vendored sibling
  into the temporary `server/package.json` for one `npm install`, dropping
  `@theluckystrike/*` and throwing on a version conflict. For resume this correctly pulls
  in `docx: ^9.0.0` (docx's own dependency), which the old per-server path never did.
- The closure is re-vendored after `npm install`, same as before (npm clobbers dirs for
  packages it cannot find on the registry).
- resume, recurring and clauses added to `SERVERS`, `DISPLAY_NAME` and `KEYWORDS`.
- Guard: `server_ready()` skips a server with no `package.json` or no `dist/` and prints
  `=== <name>: SKIPPED (no package.json or no dist yet -- server still under
  construction)` instead of the old `FATAL ... exit 1`. This is what keeps the build
  green today: **clauses and recurring currently have only `src/` and `test/` -- no
  package.json and no dist -- so they are skipped, not fatal.**
- office-suite: `CHILDREN` is now derived from `SERVERS` filtered by `server_ready`, so
  resume joins automatically and recurring/clauses join the moment they build. The
  hardcoded 8-line `extract-tools.mjs` block became a loop over `CHILDREN`.
  `servers/office-suite/src/index.ts` already declares resume, recurring and clauses as
  optional children, so no source change was needed there.

Smoke evidence (helper functions sourced out of the script and run directly):

```
CLOSURE:
@theluckystrike/mcp-docx	/Users/mike/mcp-servers/servers/docx
@theluckystrike/mcp-license	/Users/mike/mcp-servers/packages/mcp-license
.../nm/@theluckystrike/mcp-docx/package.json
.../nm/@theluckystrike/mcp-license/package.json
DEPS: {"@modelcontextprotocol/sdk":"^1.30.0","zod":"^3.25.0","docx":"^9.0.0"}
```

`bash -n scripts/build-mcpb.sh` -> clean.

## What is NOT done

- **No full `scripts/build-mcpb.sh` run.** The resume bundle was not packed, unpacked,
  started, or exercised with `profile_set` + `resume_create`. That end-to-end check is
  the acceptance test for this change and it has not been run. Nothing here proves the
  vendored `@theluckystrike/mcp-docx/lib` import resolves inside a packed bundle; the
  reasoning above says it should, the evidence does not say it does.
- **scripts/sync-mirrors.sh unchanged.** Still vendors only `mcp-license` (plus the
  hardcoded office-suite child list) and `ALL_SERVERS`/`topics_for` still omit resume,
  recurring and clauses. Design that was worked out but not written: reuse the existing
  `vendor_pkg` with the rewrite string `"file:../mcp-%s"` for every package in the
  closure, not just office-suite's children, so a vendored mcp-docx's own mcp-license dep
  points at `vendor/mcp-license`; and skip a server with no package.json.
- **remote/build-vendor.mjs unchanged.** Design that was worked out but not written:
  (a) add `lib.ts` to the `SERVERS` file lists for `docx` and `invoice`; (b) in
  `rewriteSpec`, map `@theluckystrike/mcp-<x>/lib` to `${up}<x>/lib.js`; (c) patch
  `servers/invoice/src/lib.ts` on vendoring -- it re-exports `renderInvoicePdf` and
  `RenderOptions` from `./pdf.js`, which is deliberately absent from the remote build, so
  the import has to be redirected to `../../shims/pdf.js` (that shim does export both
  names). No `node build-vendor.mjs` or `wrangler deploy --dry-run` was run.

## failures / notes

- clauses and recurring have no `package.json` at all yet, only `src/` and `test/`. Every
  pipeline therefore needs the skip guard before it needs the vendoring, and the
  vendoring for those two is untestable until they build.
- `servers/resume/dist` ships only `.js`, no `.d.ts`; irrelevant for the bundle (runtime
  only) but it means a mirror consumer cannot type-check against resume.

cost: 35 wall minutes (cap), stopped by the coordinator before the verification runs.
