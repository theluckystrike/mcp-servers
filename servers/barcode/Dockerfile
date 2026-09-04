# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/barcode/Dockerfile .
#
# servers/timezone ships too: mcp-license reads the shared business profile's home zone
# through it. No other server is needed; the invoice store, when it exists, is read as
# plain JSON from the shared data directory rather than through a package dependency.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-timezone \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-barcode

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/servers/timezone/package.json ./servers/timezone/package.json
COPY --from=build /app/servers/timezone/dist ./servers/timezone/dist
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/barcode/package.json ./servers/barcode/package.json
COPY --from=build /app/servers/barcode/dist ./servers/barcode/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-barcode --include-workspace-root=false
CMD ["node", "servers/barcode/dist/index.js"]
