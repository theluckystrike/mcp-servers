# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/bill-of-sale/Dockerfile .
#
# The siblings below are copied and built too, because this server is assembled from them:
# mcp-license is the offline license gate, and mcp-timezone is what the license package's
# shared-profile reader is built against. Nothing is fetched over the network at runtime.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-timezone \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-bill-of-sale

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/servers/timezone/package.json ./servers/timezone/package.json
COPY --from=build /app/servers/timezone/dist ./servers/timezone/dist
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/bill-of-sale/package.json ./servers/bill-of-sale/package.json
COPY --from=build /app/servers/bill-of-sale/dist ./servers/bill-of-sale/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-bill-of-sale --include-workspace-root=false
CMD ["node", "servers/bill-of-sale/dist/index.js"]
