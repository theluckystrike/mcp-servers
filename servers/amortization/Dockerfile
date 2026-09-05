# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/amortization/Dockerfile .
#
# Three siblings are copied and built too, because this server is assembled from them:
# mcp-timezone supplies the corrupt-store quarantine, mcp-asset-register the money
# formatting and the exact minor-unit allocator the straight-principal method splits with,
# mcp-quotes the timezone-aware "today". Nothing is fetched over the network.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-timezone \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-invoice \
 && npm run build --workspace @theluckystrike/mcp-quotes \
 && npm run build --workspace @theluckystrike/mcp-asset-register \
 && npm run build --workspace @theluckystrike/mcp-amortization

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/servers/timezone/package.json ./servers/timezone/package.json
COPY --from=build /app/servers/timezone/dist ./servers/timezone/dist
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/invoice/package.json ./servers/invoice/package.json
COPY --from=build /app/servers/invoice/dist ./servers/invoice/dist
COPY --from=build /app/servers/quotes/package.json ./servers/quotes/package.json
COPY --from=build /app/servers/quotes/dist ./servers/quotes/dist
COPY --from=build /app/servers/asset-register/package.json ./servers/asset-register/package.json
COPY --from=build /app/servers/asset-register/dist ./servers/asset-register/dist
COPY --from=build /app/servers/asset-register/src/tables ./servers/asset-register/src/tables
COPY --from=build /app/servers/amortization/package.json ./servers/amortization/package.json
COPY --from=build /app/servers/amortization/dist ./servers/amortization/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-amortization --include-workspace-root=false
CMD ["node", "servers/amortization/dist/index.js"]
