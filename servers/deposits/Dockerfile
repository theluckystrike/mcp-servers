# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/deposits/Dockerfile .
#
# servers/invoice is copied and built too: this server reuses its money, currency, client
# and store engine (@theluckystrike/mcp-invoice/lib) and writes the payment an applied
# deposit makes onto the invoices it owns. servers/billing-docs ships for its A4 page
# renderer (the statement is the same page as the credit note), servers/quotes for its
# timezone-aware `today` and ISO date check, and servers/timezone because mcp-license
# reads the shared profile's home zone through it.
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
 && npm run build --workspace @theluckystrike/mcp-billing-docs \
 && npm run build --workspace @theluckystrike/mcp-deposits

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
COPY --from=build /app/servers/billing-docs/package.json ./servers/billing-docs/package.json
COPY --from=build /app/servers/billing-docs/dist ./servers/billing-docs/dist
COPY --from=build /app/servers/deposits/package.json ./servers/deposits/package.json
COPY --from=build /app/servers/deposits/dist ./servers/deposits/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-deposits --include-workspace-root=false
CMD ["node", "servers/deposits/dist/index.js"]
