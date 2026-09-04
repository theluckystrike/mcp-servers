# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/quotes/Dockerfile .
#
# servers/invoice is copied and built too: this server reuses its money, VAT, client and
# numbering engine (@theluckystrike/mcp-invoice/lib) and writes accepted quotes into the
# invoice data directory as real invoices. servers/timezone ships too: mcp-license reads
# the shared profile's home zone through it.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-timezone \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-invoice \
 && npm run build --workspace @theluckystrike/mcp-quotes

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
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-quotes --include-workspace-root=false
CMD ["node", "servers/quotes/dist/index.js"]
