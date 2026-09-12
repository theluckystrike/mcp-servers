# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/dunning-letters/Dockerfile .
#
# The siblings below are copied and built too, because this server is assembled from them:
# mcp-timezone supplies the corrupt-store quarantine, mcp-asset-register the money
# formatting, and mcp-license the offline license gate. Nothing is fetched over the
# network at runtime.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-timezone \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-asset-register \
 && npm run build --workspace @theluckystrike/mcp-dunning-letters

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
COPY --from=build /app/servers/asset-register/src/tables ./servers/asset-register/src/tables
COPY --from=build /app/servers/dunning-letters/package.json ./servers/dunning-letters/package.json
COPY --from=build /app/servers/dunning-letters/dist ./servers/dunning-letters/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-dunning-letters --include-workspace-root=false
CMD ["node", "servers/dunning-letters/dist/index.js"]
