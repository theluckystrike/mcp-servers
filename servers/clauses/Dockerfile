# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/clauses/Dockerfile .
#
# servers/docx is copied on purpose: this server does not carry its own document engine,
# it imports @theluckystrike/mcp-docx/lib, which npm resolves to the workspace.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-docx \
 && npm run build --workspace @theluckystrike/mcp-clauses

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/docx/package.json ./servers/docx/package.json
COPY --from=build /app/servers/docx/dist ./servers/docx/dist
COPY --from=build /app/servers/clauses/package.json ./servers/clauses/package.json
COPY --from=build /app/servers/clauses/dist ./servers/clauses/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-clauses --include-workspace-root=false
CMD ["node", "servers/clauses/dist/index.js"]
