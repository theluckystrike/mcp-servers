# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/credit-note/Dockerfile .
#
# packages/mcp-license is copied on purpose: this server imports
# @theluckystrike/mcp-license, which npm resolves to the workspace.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-credit-note

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/credit-note/package.json ./servers/credit-note/package.json
COPY --from=build /app/servers/credit-note/dist ./servers/credit-note/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-credit-note --include-workspace-root=false
CMD ["node", "servers/credit-note/dist/index.js"]
