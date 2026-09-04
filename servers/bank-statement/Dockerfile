# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/bank-statement/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-spreadsheet \
 && npm run build --workspace @theluckystrike/mcp-bank-statement

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
# The CSV reader and the locale number parser live in the spreadsheet server and are
# imported at runtime as @theluckystrike/mcp-spreadsheet/lib, so its dist ships too.
COPY --from=build /app/servers/spreadsheet/package.json ./servers/spreadsheet/package.json
COPY --from=build /app/servers/spreadsheet/dist ./servers/spreadsheet/dist
COPY --from=build /app/servers/bank-statement/package.json ./servers/bank-statement/package.json
COPY --from=build /app/servers/bank-statement/dist ./servers/bank-statement/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-bank-statement --include-workspace-root=false
CMD ["node", "servers/bank-statement/dist/index.js"]
