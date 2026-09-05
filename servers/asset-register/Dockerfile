# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/asset-register/Dockerfile .
#
# servers/timezone is copied and built too: the corrupt-store quarantine comes from
# @theluckystrike/mcp-timezone/lib, and mcp-license reads the shared business profile
# through it. The rate tables are plain JSON inside this package and are copied into dist
# by the build; nothing is fetched at run time.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-timezone \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-asset-register

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/servers/timezone/package.json ./servers/timezone/package.json
COPY --from=build /app/servers/timezone/dist ./servers/timezone/dist
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/asset-register/package.json ./servers/asset-register/package.json
COPY --from=build /app/servers/asset-register/dist ./servers/asset-register/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-asset-register --include-workspace-root=false
CMD ["node", "servers/asset-register/dist/index.js"]
