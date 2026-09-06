# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/change-order/Dockerfile .
#
# The siblings below are copied and built too, because this server is assembled from them:
# mcp-invoice supplies the money and VAT arithmetic (computeTotals, currencyDecimals,
# formatMoney, roundHalfUp), mcp-quotes the timezone-aware "today", mcp-timezone the
# corrupt-store quarantine. Nothing is fetched over the network.
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
 && npm run build --workspace @theluckystrike/mcp-change-order

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
COPY --from=build /app/servers/change-order/package.json ./servers/change-order/package.json
COPY --from=build /app/servers/change-order/dist ./servers/change-order/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-change-order --include-workspace-root=false
CMD ["node", "servers/change-order/dist/index.js"]
