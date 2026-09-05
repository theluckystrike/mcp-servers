# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/per-diem/Dockerfile .
#
# servers/timezone is copied and built too: the start and end of a trip are instants, and
# the DST-aware wall-clock resolver and the corrupt-store quarantine both come from
# @theluckystrike/mcp-timezone/lib. mcp-license also reads the shared profile through it.
# The rate tables are plain JSON inside this package and are copied into dist by the build.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-timezone \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-per-diem

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/servers/timezone/package.json ./servers/timezone/package.json
COPY --from=build /app/servers/timezone/dist ./servers/timezone/dist
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/per-diem/package.json ./servers/per-diem/package.json
COPY --from=build /app/servers/per-diem/dist ./servers/per-diem/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-per-diem --include-workspace-root=false
CMD ["node", "servers/per-diem/dist/index.js"]
