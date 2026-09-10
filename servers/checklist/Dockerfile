# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/checklist/Dockerfile .
#
# The siblings below are copied and built too, because this server is assembled from them:
# mcp-quotes supplies the timezone-aware "today" and the ISO date check, mcp-timezone the
# corrupt-store quarantine. There is deliberately no mcp-invoice here: a checklist carries
# no amounts, so no money engine is needed. Nothing is fetched over the network.
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
 && npm run build --workspace @theluckystrike/mcp-checklist

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
COPY --from=build /app/servers/checklist/package.json ./servers/checklist/package.json
COPY --from=build /app/servers/checklist/dist ./servers/checklist/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-checklist --include-workspace-root=false
CMD ["node", "servers/checklist/dist/index.js"]
