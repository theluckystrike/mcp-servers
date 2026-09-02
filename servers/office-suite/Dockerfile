# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/office-suite/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-time-tracker \
 && npm run build --workspace @theluckystrike/mcp-price-tracker \
 && npm run build --workspace @theluckystrike/mcp-spreadsheet \
 && npm run build --workspace @theluckystrike/mcp-invoice \
 && npm run build --workspace @theluckystrike/mcp-office-suite

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/time-tracker/package.json ./servers/time-tracker/package.json
COPY --from=build /app/servers/time-tracker/dist ./servers/time-tracker/dist
COPY --from=build /app/servers/price-tracker/package.json ./servers/price-tracker/package.json
COPY --from=build /app/servers/price-tracker/dist ./servers/price-tracker/dist
COPY --from=build /app/servers/spreadsheet/package.json ./servers/spreadsheet/package.json
COPY --from=build /app/servers/spreadsheet/dist ./servers/spreadsheet/dist
COPY --from=build /app/servers/invoice/package.json ./servers/invoice/package.json
COPY --from=build /app/servers/invoice/dist ./servers/invoice/dist
COPY --from=build /app/servers/office-suite/package.json ./servers/office-suite/package.json
COPY --from=build /app/servers/office-suite/dist ./servers/office-suite/dist
RUN npm install --omit=dev --no-audit --no-fund \
      --workspace @theluckystrike/mcp-time-tracker \
      --workspace @theluckystrike/mcp-price-tracker \
      --workspace @theluckystrike/mcp-spreadsheet \
      --workspace @theluckystrike/mcp-invoice \
      --workspace @theluckystrike/mcp-office-suite \
      --include-workspace-root=false
CMD ["node", "servers/office-suite/dist/index.js"]
