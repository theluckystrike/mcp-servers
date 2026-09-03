# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/recurring/Dockerfile .
#
# servers/invoice is copied and built too: this server writes its invoices through the
# invoice engine (@theluckystrike/mcp-invoice/lib) into the invoice data directory.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-invoice \
 && npm run build --workspace @theluckystrike/mcp-recurring

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/invoice/package.json ./servers/invoice/package.json
COPY --from=build /app/servers/invoice/dist ./servers/invoice/dist
COPY --from=build /app/servers/recurring/package.json ./servers/recurring/package.json
COPY --from=build /app/servers/recurring/dist ./servers/recurring/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-recurring --include-workspace-root=false
CMD ["node", "servers/recurring/dist/index.js"]
