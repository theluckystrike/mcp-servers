# Why no Docker image could be built, and what now builds (2026-09-08)

## Two separate defects, only one of which was known

The Docker MCP catalog entry was abandoned this loop because the pull request added sixteen
servers to a repository whose forty most recent merges each added one. While closing it, a
second and larger problem was measured: **no Dockerfile in this project built at all.**

**Defect one, in the monorepo.** `packages/mcp-license/src/profile.ts` imports `resolveZone`
from `@theluckystrike/mcp-timezone/lib`, and `servers/timezone/src/index.ts` imports the
licence gate from `@theluckystrike/mcp-license`. Every server Dockerfile builds those two in
a linear `npm run build --workspace` sequence, so whichever goes first cannot resolve the
other. Both orders were built for real and both failed with TS2307. This does not affect
`npm run build` at the repository root, because npm workspaces symlinks the packages and
resolves the cycle; it only bites a linear container build.

**Defect two, in the mirrors, and this is the one that was fixed.** Each of the 31 per-server
mirror repositories shipped the monorepo Dockerfile verbatim, including `COPY servers
./servers`. A mirror has no `servers/` directory, so the build failed on its first COPY.
That is galling, because a mirror is otherwise the ideal build context: it is self-contained,
with every `@theluckystrike` dependency vendored under `vendor/` and its `dist` committed.

## What was done

`scripts/sync-mirrors.sh` now writes a mirror-specific Dockerfile rather than letting the
monorepo one be copied in. The build context is the mirror itself:

    FROM node:22-alpine AS build
    WORKDIR /app
    COPY package.json tsconfig.json ./
    COPY vendor ./vendor
    COPY src ./src
    RUN npm install --no-audit --no-fund && npm run build
    ... a second stage that keeps only package.json, vendor and dist
    CMD ["node", "dist/index.js"]

Verified, not assumed. `docker build` on `theluckystrike/mcp-timezone` produced a 324 MB
image, and `docker run -i` answered a real MCP handshake over stdio:

    initialize -> {"name":"mcp-timezone","version":"0.20.0"}
    tools/list -> 11 tools
    stderr    -> mcp-timezone ready (free), 490 places

The version reads 0.20.0 because the mirrors were last synced before the v0.21.0 release;
the next sync carries both the version and this Dockerfile.

## What this unblocks and what it does not

It unblocks a Docker MCP catalog submission, which requires an image that builds from a
named repository and Dockerfile. The correct next step is a single-server pull request,
opened only after `docker run` has answered `tools/list` for that specific server, which is
now a thing that can be demonstrated rather than asserted.

It does not fix defect one. The monorepo Dockerfiles still cannot build, and the fix there
is to break the `mcp-license` and `mcp-timezone` cycle, most cleanly by moving `resolveZone`
and its place table below both of them or by making the licence package's use of it lazy.
That is a change to a package every server depends on and was not attempted at the end of a
long session.
