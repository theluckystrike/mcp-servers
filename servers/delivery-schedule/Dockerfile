# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/delivery-schedule/Dockerfile .
#
# The siblings below are copied and built too, because this server is assembled from them:
# mcp-invoice supplies the money arithmetic and the date helpers (computeTotals,
# currencyDecimals, formatMoney, daysBetween), mcp-quotes the timezone-aware "today",
# mcp-timezone the corrupt-store quarantine. Nothing is fetched over the network.
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
 && npm run build --workspace @theluckystrike/mcp-delivery-schedule

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
COPY --from=build /app/servers/delivery-schedule/package.json ./servers/delivery-schedule/package.json
COPY --from=build /app/servers/delivery-schedule/dist ./servers/delivery-schedule/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-delivery-schedule --include-workspace-root=false
CMD ["node", "servers/delivery-schedule/dist/index.js"]
